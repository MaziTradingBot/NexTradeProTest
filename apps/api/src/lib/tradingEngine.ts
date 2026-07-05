// Background trading engine. On a fixed interval it:
//   1. closes open positions whose Stop Loss / Take Profit has been hit, and
//   2. enforces margin call / stop-out — force-liquidating positions when an
//      account's margin level falls to the stop-out threshold.
// It shares the same P/L and metric math as the request handlers so numbers
// stay consistent across the platform.

import { prisma } from './prisma';
import { getPrices } from './marketPrice';
import { publishBalance } from './events';
import { ACCOUNT_CURRENCY, STOP_OUT_LEVEL, accountMetrics, floatingPnl, requiredMargin, round8 } from './trading';

type Reason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATION';

const num = (v: unknown) => (v == null ? null : parseFloat(v.toString()));

// Cancel a resting working order (and log why).
async function cancelWorkingOrder(id: string, note: string, userId: string, mode: 'DEMO' | 'LIVE') {
  await prisma.order.update({ where: { id }, data: { status: 'CANCELLED' } });
  await prisma.notification.create({ data: { userId, title: 'Order cancelled', body: note, type: 'WARNING' } }).catch(() => {});
  publishBalance(userId, 'order.cancel', mode);
}

// Fill a resting working order at `fillPrice`: reserve margin and turn it into
// an open position. Cancels the order if free margin is insufficient, and
// cancels the OCO sibling (if any) once one leg fills.
async function fillWorkingOrder(order: { id: string; userId: string; mode: 'DEMO' | 'LIVE'; symbol: string; side: string; leverage: number; amount: unknown; ocoGroupId: string | null }, fillPrice: number) {
  const amount = num(order.amount)!;
  const margin = round8(requiredMargin(fillPrice, amount, order.leverage));
  try {
    await prisma.$transaction(async (tx) => {
      const current = await tx.order.findUnique({ where: { id: order.id } });
      if (!current || current.status !== 'OPEN') return; // already handled
      const wallet = await tx.wallet.findUnique({ where: { userId_asset_mode: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode } } });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
      const agg = await tx.order.aggregate({ where: { userId: order.userId, mode: order.mode, status: 'FILLED', closedAt: null }, _sum: { margin: true } });
      const used = agg._sum.margin ? parseFloat(agg._sum.margin.toString()) : 0;
      if (margin > balance - used + 1e-8) {
        throw Object.assign(new Error('insufficient'), { code: 'MARGIN' });
      }
      await tx.order.update({ where: { id: order.id }, data: { status: 'FILLED', price: fillPrice, margin, filled: amount } });
    });
  } catch (e) {
    if (e && (e as { code?: string }).code === 'MARGIN') {
      await cancelWorkingOrder(order.id, `Your ${order.side} ${order.symbol} order was cancelled — insufficient free margin at trigger.`, order.userId, order.mode);
      return;
    }
    throw e;
  }
  // OCO: filling one leg cancels its sibling.
  if (order.ocoGroupId) {
    const siblings = await prisma.order.findMany({ where: { ocoGroupId: order.ocoGroupId, status: 'OPEN', NOT: { id: order.id } } });
    for (const s of siblings) await cancelWorkingOrder(s.id, `OCO sibling cancelled — the linked ${order.symbol} order was filled.`, s.userId, s.mode);
  }
  await prisma.notification.create({
    data: { userId: order.userId, title: 'Order filled', body: `Your ${order.side} ${order.symbol} order filled at ${fillPrice}.`, type: 'SUCCESS' },
  }).catch(() => {});
  publishBalance(order.userId, 'order.fill', order.mode);
}

// Close a single open position at `closePrice`, settling realized P/L into the
// account balance in one atomic transaction, then notify the user.
async function closePosition(orderId: string, closePrice: number, reason: Reason) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.status !== 'FILLED' || order.closedAt) return;
  const pnl = round8(floatingPnl(order.side, order.price, order.amount, closePrice));

  await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'CLOSED', closePrice, realizedPnl: pnl, closeReason: reason, closedAt: new Date() },
    }),
    prisma.wallet.upsert({
      where: { userId_asset_mode: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode } },
      create: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode, balance: pnl },
      update: { balance: { increment: pnl } },
    }),
  ]);

  publishBalance(order.userId, `position.${reason.toLowerCase()}`, order.mode);
  const label = reason === 'STOP_LOSS' ? 'Stop loss' : reason === 'TAKE_PROFIT' ? 'Take profit' : 'Liquidation';
  await prisma.notification
    .create({
      data: {
        userId: order.userId,
        title: `${label} triggered`,
        body: `Your ${order.side} ${order.symbol} position was closed at ${closePrice} for a ${pnl >= 0 ? 'profit' : 'loss'} of ${pnl.toFixed(2)} ${ACCOUNT_CURRENCY}.`,
        type: reason === 'LIQUIDATION' ? 'WARNING' : pnl >= 0 ? 'SUCCESS' : 'INFO',
      },
    })
    .catch(() => {});
}

let ticking = false;

export async function runEngineTick() {
  if (ticking) return; // never overlap ticks
  ticking = true;
  try {
    const [open, working, alerts] = await Promise.all([
      prisma.order.findMany({ where: { status: 'FILLED', closedAt: null } }),
      prisma.order.findMany({ where: { status: 'OPEN', type: { in: ['LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP'] } } }),
      prisma.priceAlert.findMany({ where: { active: true } }),
    ]);
    if (open.length === 0 && working.length === 0 && alerts.length === 0) return;

    const symbols = [...open, ...working].map((o) => o.symbol).concat(alerts.map((a) => a.symbol));
    const prices = await getPrices(symbols);

    // 0) Working orders — fill limit/stop/stop-limit/trailing when triggered.
    for (const o of working) {
      const px = prices[o.symbol.toUpperCase()];
      if (px == null) continue;
      const isBuy = o.side === 'BUY';
      const limit = num(o.price);
      const trigger = num(o.triggerPrice);

      if (o.type === 'LIMIT') {
        if (limit != null && (isBuy ? px <= limit : px >= limit)) await fillWorkingOrder(o, limit);
      } else if (o.type === 'STOP') {
        if (trigger != null && (isBuy ? px >= trigger : px <= trigger)) await fillWorkingOrder(o, px);
      } else if (o.type === 'STOP_LIMIT') {
        // On trigger, activate into a resting LIMIT order at `price`.
        if (trigger != null && (isBuy ? px >= trigger : px <= trigger)) {
          await prisma.order.update({ where: { id: o.id }, data: { type: 'LIMIT', triggerPrice: null } });
        }
      } else if (o.type === 'TRAILING_STOP') {
        const pct = num(o.trailingPercent) ?? 0;
        const ref = num(o.trailRef);
        if (isBuy) {
          // Buy-trailing: track the low; trigger when price rebounds by pct.
          const low = ref == null ? px : Math.min(ref, px);
          if (low !== ref) await prisma.order.update({ where: { id: o.id }, data: { trailRef: low } });
          if (px >= low * (1 + pct / 100)) await fillWorkingOrder(o, px);
        } else {
          // Sell-trailing: track the high; trigger when price drops by pct.
          const high = ref == null ? px : Math.max(ref, px);
          if (high !== ref) await prisma.order.update({ where: { id: o.id }, data: { trailRef: high } });
          if (px <= high * (1 - pct / 100)) await fillWorkingOrder(o, px);
        }
      }
    }

    // 1) Stop Loss / Take Profit — evaluate every open position.
    const remaining: typeof open = [];
    for (const o of open) {
      const px = prices[o.symbol.toUpperCase()];
      if (px == null) {
        remaining.push(o);
        continue;
      }
      const sl = o.stopLoss ? parseFloat(o.stopLoss.toString()) : null;
      const tp = o.takeProfit ? parseFloat(o.takeProfit.toString()) : null;
      const isLong = o.side === 'BUY';
      const slHit = sl != null && (isLong ? px <= sl : px >= sl);
      const tpHit = tp != null && (isLong ? px >= tp : px <= tp);
      if (slHit) await closePosition(o.id, sl!, 'STOP_LOSS');
      else if (tpHit) await closePosition(o.id, tp!, 'TAKE_PROFIT');
      else remaining.push(o);
    }

    // 2) Margin call / stop-out — group surviving positions per account.
    const byAccount = new Map<string, typeof remaining>();
    for (const o of remaining) {
      const key = `${o.userId}:${o.mode}`;
      (byAccount.get(key) ?? byAccount.set(key, []).get(key)!).push(o);
    }

    for (const [key, positions] of byAccount) {
      const [userId, mode] = key.split(':');
      const wallet = await prisma.wallet.findUnique({
        where: { userId_asset_mode: { userId, asset: ACCOUNT_CURRENCY, mode: mode as 'DEMO' | 'LIVE' } },
      });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;

      let live = [...positions];
      // Liquidate the largest-losing position while below the stop-out level.
      for (let guard = 0; guard < positions.length; guard++) {
        const metrics = accountMetrics(balance, live, prices);
        if (metrics.marginLevel == null || metrics.marginLevel > STOP_OUT_LEVEL) break;
        const worst = live
          .map((o) => ({ o, pnl: floatingPnl(o.side, o.price, o.amount, prices[o.symbol.toUpperCase()] ?? parseFloat(o.price.toString())) }))
          .sort((a, b) => a.pnl - b.pnl)[0];
        if (!worst) break;
        const px = prices[worst.o.symbol.toUpperCase()] ?? parseFloat(worst.o.price.toString());
        await closePosition(worst.o.id, px, 'LIQUIDATION');
        live = live.filter((o) => o.id !== worst.o.id);
      }
    }

    // 3) Price alerts — notify and deactivate when the condition is met.
    for (const a of alerts) {
      const px = prices[a.symbol.toUpperCase()];
      if (px == null) continue;
      const target = num(a.value)!;
      let hit = false;
      let detail = '';
      if (a.condition === 'ABOVE') {
        hit = px >= target;
        detail = `is at ${px} (≥ ${target})`;
      } else if (a.condition === 'BELOW') {
        hit = px <= target;
        detail = `is at ${px} (≤ ${target})`;
      } else {
        // PCT_CHANGE: |px - refPrice| / refPrice * 100 >= target
        const ref = num(a.refPrice);
        if (ref && ref > 0) {
          const change = ((px - ref) / ref) * 100;
          hit = Math.abs(change) >= target;
          detail = `moved ${change.toFixed(2)}% (≥ ${target}%)`;
        }
      }
      if (hit) {
        await prisma.priceAlert.update({ where: { id: a.id }, data: { active: false, triggeredAt: new Date() } });
        await prisma.notification.create({
          data: { userId: a.userId, title: `Price alert: ${a.symbol}`, body: `${a.symbol} ${detail}.`, type: 'INFO' },
        }).catch(() => {});
        publishBalance(a.userId, 'alert.trigger', 'DEMO');
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Trading engine tick failed:', err);
  } finally {
    ticking = false;
  }
}

let timer: ReturnType<typeof setInterval> | null = null;

export function startTradingEngine(intervalMs = 5000) {
  if (timer) return;
  timer = setInterval(runEngineTick, intervalMs);
  // eslint-disable-next-line no-console
  console.log(`⚙️  Trading engine started (tick ${intervalMs}ms)`);
}

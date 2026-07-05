// Background trading engine. On a fixed interval it:
//   1. closes open positions whose Stop Loss / Take Profit has been hit, and
//   2. enforces margin call / stop-out — force-liquidating positions when an
//      account's margin level falls to the stop-out threshold.
// It shares the same P/L and metric math as the request handlers so numbers
// stay consistent across the platform.

import { prisma } from './prisma';
import { getPrices } from './marketPrice';
import { publishBalance } from './events';
import { ACCOUNT_CURRENCY, STOP_OUT_LEVEL, accountMetrics, floatingPnl, round8 } from './trading';

type Reason = 'STOP_LOSS' | 'TAKE_PROFIT' | 'LIQUIDATION';

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
    const open = await prisma.order.findMany({ where: { status: 'FILLED', closedAt: null } });
    if (open.length === 0) return;

    const prices = await getPrices(open.map((o) => o.symbol));

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

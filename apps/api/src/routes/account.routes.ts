import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { audit } from '../lib/audit';
import { generateBase32Secret, otpauthUri, verifyTotp } from '../lib/totp';
import { hashPassword, verifyPassword, issueSession } from '../lib/auth';
import { strongPassword } from '../lib/password';
import { getPrice, getPrices } from '../lib/marketPrice';
import { subscribe, publishBalance } from '../lib/events';
import { verifyGoogleIdToken } from '../lib/google';
import {
  ACCOUNT_CURRENCY,
  MARGIN_CALL_LEVEL,
  STOP_OUT_LEVEL,
  MAX_LEVERAGE,
  accountMetrics,
  floatingPnl,
  requiredMargin,
  round8,
} from '../lib/trading';

const router = Router();
router.use(authenticate);

// Active account mode comes from the x-nxp-mode header (default DEMO).
type Mode = 'DEMO' | 'LIVE';
function getMode(req: import('express').Request): Mode {
  return req.header('x-nxp-mode') === 'LIVE' ? 'LIVE' : 'DEMO';
}

// Sum of USDT margin locked by a user's currently open positions (mode-scoped).
async function usedMarginFor(userId: string, mode: Mode): Promise<number> {
  const agg = await prisma.order.aggregate({
    where: { userId, mode, status: 'FILLED', closedAt: null },
    _sum: { margin: true },
  });
  return agg._sum.margin ? parseFloat(agg._sum.margin.toString()) : 0;
}

// GET /api/account/stream — Server-Sent Events feed for this account. Pushes a
// `balance` event whenever the user's wallets/positions change so every open
// page updates in real time without polling or a manual refresh.
router.get('/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // disable proxy buffering (nginx/Render)
  });
  res.write(`event: ready\ndata: ${JSON.stringify({ at: Date.now() })}\n\n`);

  const unsubscribe = subscribe(req.user!.id, res);
  // Heartbeat keeps the connection alive through idle proxies.
  const ping = setInterval(() => {
    try {
      res.write(`: ping\n\n`);
    } catch {
      /* connection gone */
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

// GET /api/account/wallets
router.get('/wallets', async (req, res) => {
  const wallets = await prisma.wallet.findMany({
    where: { userId: req.user!.id, mode: getMode(req) },
    orderBy: { asset: 'asc' },
  });
  res.json(wallets);
});

// GET /api/account/orders
router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id, mode: getMode(req) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(orders);
});

// POST /api/account/orders — simulated order placement on live prices
const orderSchema = z.object({
  symbol: z.string().min(3),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT', 'STOP', 'STOP_LIMIT', 'TRAILING_STOP']),
  price: z.number().positive(),
  amount: z.number().positive(),
  leverage: z.number().int().min(1).max(125).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
  triggerPrice: z.number().positive().optional(),
  trailingPercent: z.number().positive().max(50).optional(),
});

const LIVE_DISABLED_MSG = 'Live trading has not yet been enabled for your account. Please contact support or wait for administrator activation.';

// Whether the authenticated user may place Live-mode orders. A Super Admin
// always can; everyone else needs admin-granted access with full permission
// and an active trading + account status.
function canLiveTrade(user: NonNullable<import('express').Request['user']>): boolean {
  if (user.isSuperAdmin) return true;
  return user.liveTradingEnabled && user.tradingStatus === 'ACTIVE' && user.tradingPermission === 'FULL' && user.accountStatus !== 'SUSPENDED';
}

router.post('/orders', async (req, res) => {
  const mode = getMode(req);
  // Live trading is gated per-user by an administrator (Demo is always open).
  if (mode === 'LIVE' && !canLiveTrade(req.user!)) {
    return res.status(403).json({ error: LIVE_DISABLED_MSG });
  }
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { symbol, side, type, price, amount, leverage, stopLoss, takeProfit, triggerPrice, trailingPercent } = parsed.data;
  const lev = Math.min(MAX_LEVERAGE, Math.max(1, leverage ?? 1));

  // Working-order types require their trigger inputs.
  if ((type === 'STOP' || type === 'STOP_LIMIT') && !triggerPrice) {
    return res.status(400).json({ error: 'A trigger price is required for stop orders.' });
  }
  if (type === 'TRAILING_STOP' && !trailingPercent) {
    return res.status(400).json({ error: 'A trailing distance (%) is required for trailing-stop orders.' });
  }

  // Use the live price for market fills; fall back to the submitted price.
  const live = await getPrice(symbol).catch(() => null);
  const fillPrice = type === 'MARKET' ? live ?? price : price;

  // Market orders open a margin position immediately: reserve the required
  // margin and refuse the trade if free margin is insufficient. Free margin
  // is checked inside a transaction to avoid a double-spend race.
  if (type === 'MARKET') {
    const margin = round8(requiredMargin(fillPrice, amount, lev));
    try {
      const order = await prisma.$transaction(async (tx) => {
        const wallet = await tx.wallet.findUnique({
          where: { userId_asset_mode: { userId: req.user!.id, asset: ACCOUNT_CURRENCY, mode } },
        });
        const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
        const agg = await tx.order.aggregate({
          where: { userId: req.user!.id, mode, status: 'FILLED', closedAt: null },
          _sum: { margin: true },
        });
        const usedMargin = agg._sum.margin ? parseFloat(agg._sum.margin.toString()) : 0;
        const freeMargin = balance - usedMargin;
        if (margin > freeMargin + 1e-8) {
          throw Object.assign(new Error('Insufficient free margin to open this position.'), { code: 'MARGIN' });
        }
        return tx.order.create({
          data: {
            userId: req.user!.id,
            mode,
            symbol,
            side,
            type,
            leverage: lev,
            price: fillPrice,
            amount,
            margin,
            stopLoss,
            takeProfit,
            status: 'FILLED',
            filled: amount,
          },
        });
      });
      await audit({ actorId: req.user!.id, action: 'position.open', target: order.id, meta: { symbol, side, mode, leverage: lev }, ip: req.ip });
      publishBalance(req.user!.id, 'position.open', mode);
      return res.status(201).json(order);
    } catch (e) {
      if (e && typeof e === 'object' && (e as { code?: string }).code === 'MARGIN') {
        return res.status(400).json({ error: (e as Error).message });
      }
      // eslint-disable-next-line no-console
      console.error('Order open failed:', e);
      return res.status(500).json({ error: 'Could not open the position. Please try again.' });
    }
  }

  // Limit / stop / stop-limit / trailing orders rest as pending working orders
  // (no margin reserved until the engine triggers them). trailRef seeds the
  // trailing high/low from the current price.
  const seedTrail = type === 'TRAILING_STOP' ? live ?? price : undefined;
  const order = await prisma.order.create({
    data: {
      userId: req.user!.id, mode, symbol, side, type, leverage: lev, price, amount, stopLoss, takeProfit,
      triggerPrice, trailingPercent, trailRef: seedTrail, status: 'OPEN', filled: 0,
    },
  });
  await audit({ actorId: req.user!.id, action: 'order.place', target: order.id, meta: { symbol, side, type, mode }, ip: req.ip });
  res.status(201).json(order);
});

// POST /api/account/orders/oco — place two linked orders; filling or cancelling
// one automatically cancels the other (One-Cancels-the-Other).
router.post('/orders/oco', async (req, res) => {
  const mode = getMode(req);
  if (mode === 'LIVE' && !canLiveTrade(req.user!)) return res.status(403).json({ error: LIVE_DISABLED_MSG });
  const legSchema = orderSchema.extend({ type: z.enum(['LIMIT', 'STOP', 'STOP_LIMIT']) });
  const parsed = z.object({ legs: z.tuple([legSchema, legSchema]) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'OCO requires exactly two limit/stop legs.' });

  const groupId = `oco_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const created = await prisma.$transaction(
    parsed.data.legs.map((leg) =>
      prisma.order.create({
        data: {
          userId: req.user!.id, mode, symbol: leg.symbol, side: leg.side, type: leg.type,
          leverage: Math.min(MAX_LEVERAGE, Math.max(1, leg.leverage ?? 1)), price: leg.price, amount: leg.amount,
          triggerPrice: leg.triggerPrice, stopLoss: leg.stopLoss, takeProfit: leg.takeProfit,
          ocoGroupId: groupId, status: 'OPEN', filled: 0,
        },
      }),
    ),
  );
  await audit({ actorId: req.user!.id, action: 'order.oco', target: groupId, meta: { mode }, ip: req.ip });
  res.status(201).json({ ok: true, ocoGroupId: groupId, orders: created });
});

// POST /api/account/orders/:id/close — close an open margin position at market.
router.post('/orders/:id/close', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== req.user!.id) return res.status(404).json({ error: 'Position not found' });
  if (order.status !== 'FILLED' || order.closedAt) return res.status(409).json({ error: 'Position is not open' });

  const live = await getPrice(order.symbol).catch(() => null);
  const closePrice = live ?? parseFloat(order.price.toString());
  const pnl = round8(floatingPnl(order.side, order.price, order.amount, closePrice));

  const [updated] = await prisma.$transaction([
    prisma.order.update({
      where: { id: order.id },
      data: { status: 'CLOSED', closePrice, realizedPnl: pnl, closeReason: 'MANUAL', closedAt: new Date() },
    }),
    // Realized P/L settles into the account balance; the margin is released
    // automatically because the position is no longer counted as open.
    prisma.wallet.upsert({
      where: { userId_asset_mode: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode } },
      create: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode, balance: pnl },
      update: { balance: { increment: pnl } },
    }),
  ]);
  await audit({ actorId: req.user!.id, action: 'position.close', target: order.id, meta: { pnl, closePrice }, ip: req.ip });
  publishBalance(order.userId, 'position.close', order.mode);
  res.json({ ok: true, order: updated, realizedPnl: pnl });
});

// GET /api/account/summary — trading-account snapshot for the active mode.
// Floating figures are computed server-side from live prices; the client
// recomputes them in real time from its own price stream between polls.
router.get('/summary', async (req, res) => {
  const mode = getMode(req);
  const uid = req.user!.id;
  const [wallet, positions] = await Promise.all([
    prisma.wallet.findUnique({ where: { userId_asset_mode: { userId: uid, asset: ACCOUNT_CURRENCY, mode } } }),
    prisma.order.findMany({ where: { userId: uid, mode, status: 'FILLED', closedAt: null }, orderBy: { createdAt: 'desc' } }),
  ]);
  const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
  const locked = wallet ? parseFloat(wallet.locked.toString()) : 0;

  const prices: Record<string, number> = positions.length
    ? await getPrices(positions.map((p) => p.symbol)).catch(() => ({}))
    : {};
  const metrics = accountMetrics(balance, positions, prices);

  res.json({
    currency: ACCOUNT_CURRENCY,
    mode,
    locked,
    ...metrics,
    marginCallLevel: MARGIN_CALL_LEVEL,
    stopOutLevel: STOP_OUT_LEVEL,
    maxLeverage: MAX_LEVERAGE,
    positions: positions.map((p) => ({
      id: p.id,
      symbol: p.symbol,
      side: p.side,
      leverage: p.leverage,
      entryPrice: parseFloat(p.price.toString()),
      amount: parseFloat(p.amount.toString()),
      margin: parseFloat(p.margin.toString()),
      markPrice: prices[p.symbol.toUpperCase()] ?? parseFloat(p.price.toString()),
      stopLoss: p.stopLoss ? parseFloat(p.stopLoss.toString()) : null,
      takeProfit: p.takeProfit ? parseFloat(p.takeProfit.toString()) : null,
      createdAt: p.createdAt,
    })),
  });
});

// GET /api/account/positions/history — recently closed positions with realized P/L.
router.get('/positions/history', async (req, res) => {
  const rows = await prisma.order.findMany({
    where: { userId: req.user!.id, mode: getMode(req), status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    take: 50,
  });
  res.json(rows);
});

// GET /api/account/stats — trading statistics computed from closed positions.
router.get('/stats', async (req, res) => {
  const mode = getMode(req);
  const uid = req.user!.id;
  const [closed, deposits, withdrawals] = await Promise.all([
    prisma.order.findMany({ where: { userId: uid, mode, status: 'CLOSED' }, orderBy: { closedAt: 'asc' } }),
    prisma.transaction.aggregate({ where: { userId: uid, mode, type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { userId: uid, mode, type: 'WITHDRAWAL', status: 'COMPLETED' }, _sum: { amount: true } }),
  ]);

  const pnls = closed.map((o) => (o.realizedPnl ? parseFloat(o.realizedPnl.toString()) : 0));
  const wins = pnls.filter((p) => p > 0);
  const losses = pnls.filter((p) => p < 0);
  const grossProfit = wins.reduce((s, p) => s + p, 0);
  const grossLoss = Math.abs(losses.reduce((s, p) => s + p, 0));
  const totalRealized = grossProfit - grossLoss;

  // Max drawdown across the realized-P/L equity curve.
  let peak = 0, equity = 0, maxDrawdown = 0;
  for (const p of pnls) {
    equity += p;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  // Sharpe-like ratio: mean / std-dev of per-trade P/L.
  const mean = pnls.length ? pnls.reduce((s, p) => s + p, 0) / pnls.length : 0;
  const variance = pnls.length ? pnls.reduce((s, p) => s + (p - mean) ** 2, 0) / pnls.length : 0;
  const std = Math.sqrt(variance);
  const sharpe = std > 0 ? (mean / std) * Math.sqrt(pnls.length || 1) : 0;

  const durations = closed
    .filter((o) => o.closedAt)
    .map((o) => new Date(o.closedAt as Date).getTime() - new Date(o.createdAt).getTime());
  const avgDurationMs = durations.length ? durations.reduce((s, d) => s + d, 0) / durations.length : 0;

  const now = Date.now();
  const since = (ms: number) => closed.filter((o) => o.closedAt && now - new Date(o.closedAt as Date).getTime() <= ms).reduce((s, o) => s + (o.realizedPnl ? parseFloat(o.realizedPnl.toString()) : 0), 0);
  const netDeposits = (deposits._sum.amount ? parseFloat(deposits._sum.amount.toString()) : 0) - (withdrawals._sum.amount ? parseFloat(withdrawals._sum.amount.toString()) : 0);

  const tradingVolume = closed.reduce((s, o) => s + parseFloat(o.amount.toString()) * parseFloat(o.price.toString()), 0);

  const base = {
    mode,
    totalTrades: closed.length,
    wins: wins.length,
    losses: losses.length,
    winRate: closed.length ? (wins.length / closed.length) * 100 : 0,
    lossRate: closed.length ? (losses.length / closed.length) * 100 : 0,
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    grossProfit,
    grossLoss,
    realizedPnl: totalRealized,
    unrealizedPnl: 0,
    lifetimePnl: totalRealized,
    tradingVolume,
    bestTrade: pnls.length ? Math.max(...pnls) : 0,
    worstTrade: pnls.length ? Math.min(...pnls) : 0,
    avgDurationMs,
    maxDrawdown,
    sharpe,
    dailyProfit: since(24 * 3600 * 1000),
    weeklyProfit: since(7 * 24 * 3600 * 1000),
    monthlyProfit: since(30 * 24 * 3600 * 1000),
    netDeposits,
    roi: netDeposits > 0 ? (totalRealized / netDeposits) * 100 : 0,
    overridden: false,
  };

  // Admin P&L Manager overrides (any non-null field wins). See docs/08 §4.
  const ov = await prisma.statOverride.findUnique({ where: { userId_mode: { userId: uid, mode } } });
  if (ov) {
    const map: [keyof typeof base, number | null][] = [
      ['realizedPnl', ov.realizedPnl], ['unrealizedPnl', ov.unrealizedPnl], ['dailyProfit', ov.dailyPnl],
      ['weeklyProfit', ov.weeklyPnl], ['monthlyProfit', ov.monthlyPnl], ['lifetimePnl', ov.lifetimePnl],
      ['roi', ov.roi], ['tradingVolume', ov.tradingVolume], ['winRate', ov.winRate], ['lossRate', ov.lossRate],
    ];
    for (const [k, v] of map) if (v != null) { (base as Record<string, unknown>)[k] = v; base.overridden = true; }
  }

  res.json(base);
});

// GET /api/account/login-history — recent sign-in activity for this user.
router.get('/login-history', async (req, res) => {
  const events = await prisma.loginEvent.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, device: true, ip: true, location: true, success: true, createdAt: true },
  });
  res.json(events);
});

// ---------------------------------------------------------------------------
// Watchlists (named, private, per user). The legacy /watchlist endpoints act on
// the user's default "Favorites" list for backward compatibility.
// ---------------------------------------------------------------------------

// Resolve (and lazily create) the user's default watchlist, adopting any legacy
// items that were not yet assigned to a list.
async function ensureDefaultWatchlist(userId: string) {
  // Always guarantee exactly one default list. If none is marked default (e.g.
  // the user created a custom list first), create the Favorites default.
  let list = await prisma.watchlist.findFirst({ where: { userId, isDefault: true } });
  if (!list) list = await prisma.watchlist.create({ data: { userId, name: 'Favorites', emoji: '⭐', isDefault: true } });
  // Adopt orphaned legacy items into the default list.
  await prisma.watchlistItem.updateMany({ where: { userId, watchlistId: null }, data: { watchlistId: list.id } });
  return list;
}

// Legacy: flat list of symbols across all of the user's lists (deduped) — keeps
// the markets/coin star working exactly as before.
router.get('/watchlist', async (req, res) => {
  await ensureDefaultWatchlist(req.user!.id);
  const items = await prisma.watchlistItem.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'asc' } });
  res.json([...new Set(items.map((i) => i.symbol))]);
});
router.post('/watchlist', async (req, res) => {
  const parsed = z.object({ symbol: z.string().min(3).max(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid symbol' });
  const symbol = parsed.data.symbol.toUpperCase();
  const list = await ensureDefaultWatchlist(req.user!.id);
  await prisma.watchlistItem.upsert({
    where: { watchlistId_symbol: { watchlistId: list.id, symbol } },
    create: { userId: req.user!.id, watchlistId: list.id, symbol },
    update: {},
  });
  res.status(201).json({ ok: true, symbol });
});
router.delete('/watchlist/:symbol', async (req, res) => {
  await prisma.watchlistItem.deleteMany({ where: { userId: req.user!.id, symbol: req.params.symbol.toUpperCase() } });
  res.json({ ok: true });
});

// Named multi-list management.
router.get('/watchlists', async (req, res) => {
  await ensureDefaultWatchlist(req.user!.id);
  const lists = await prisma.watchlist.findMany({
    where: { userId: req.user!.id },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { items: { orderBy: { createdAt: 'asc' } } },
  });
  res.json(lists.map((l) => ({ id: l.id, name: l.name, emoji: l.emoji, isDefault: l.isDefault, symbols: l.items.map((i) => i.symbol) })));
});
router.post('/watchlists', async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(40), emoji: z.string().max(8).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid list' });
  await ensureDefaultWatchlist(req.user!.id); // guarantee a default exists first
  const count = await prisma.watchlist.count({ where: { userId: req.user!.id } });
  if (count >= 20) return res.status(409).json({ error: 'Watchlist limit reached' });
  const list = await prisma.watchlist.create({ data: { userId: req.user!.id, name: parsed.data.name, emoji: parsed.data.emoji } });
  res.status(201).json({ id: list.id, name: list.name, emoji: list.emoji, isDefault: list.isDefault, symbols: [] });
});
router.patch('/watchlists/:id', async (req, res) => {
  const parsed = z.object({ name: z.string().min(1).max(40).optional(), emoji: z.string().max(8).optional() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  const list = await prisma.watchlist.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!list) return res.status(404).json({ error: 'List not found' });
  const updated = await prisma.watchlist.update({ where: { id: list.id }, data: { name: parsed.data.name, emoji: parsed.data.emoji } });
  res.json({ id: updated.id, name: updated.name, emoji: updated.emoji, isDefault: updated.isDefault });
});
router.delete('/watchlists/:id', async (req, res) => {
  const list = await prisma.watchlist.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!list) return res.status(404).json({ error: 'List not found' });
  if (list.isDefault) return res.status(409).json({ error: 'Cannot delete the default list' });
  await prisma.watchlist.delete({ where: { id: list.id } });
  res.json({ ok: true });
});
router.post('/watchlists/:id/items', async (req, res) => {
  const parsed = z.object({ symbol: z.string().min(3).max(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid symbol' });
  const list = await prisma.watchlist.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!list) return res.status(404).json({ error: 'List not found' });
  const symbol = parsed.data.symbol.toUpperCase();
  await prisma.watchlistItem.upsert({
    where: { watchlistId_symbol: { watchlistId: list.id, symbol } },
    create: { userId: req.user!.id, watchlistId: list.id, symbol },
    update: {},
  });
  res.status(201).json({ ok: true, symbol });
});
router.delete('/watchlists/:id/items/:symbol', async (req, res) => {
  const list = await prisma.watchlist.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!list) return res.status(404).json({ error: 'List not found' });
  await prisma.watchlistItem.deleteMany({ where: { watchlistId: list.id, symbol: req.params.symbol.toUpperCase() } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Withdrawal methods — saved bank accounts + crypto payout wallets. Strictly
// per-user; exactly one default of each type (enforced in a transaction).
// ---------------------------------------------------------------------------

const bankSchema = z.object({
  accountHolderName: z.string().min(2).max(120),
  bankName: z.string().min(2).max(120),
  accountNumber: z.string().min(2).max(64),
  iban: z.string().max(64).optional().or(z.literal('')),
  swiftBic: z.string().max(32).optional().or(z.literal('')),
  branchName: z.string().max(120).optional().or(z.literal('')),
  branchAddress: z.string().max(240).optional().or(z.literal('')),
  country: z.string().min(2).max(80),
  currency: z.string().min(2).max(8),
  isDefault: z.boolean().optional(),
});

router.get('/bank-accounts', async (req, res) => {
  const rows = await prisma.bankAccount.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  res.json(rows);
});
router.post('/bank-accounts', async (req, res) => {
  const parsed = bankSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid bank account' });
  const d = parsed.data;
  const existing = await prisma.bankAccount.count({ where: { userId: req.user!.id } });
  const makeDefault = d.isDefault || existing === 0;
  const row = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.bankAccount.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    return tx.bankAccount.create({ data: { userId: req.user!.id, ...d, iban: d.iban || null, swiftBic: d.swiftBic || null, branchName: d.branchName || null, branchAddress: d.branchAddress || null, isDefault: makeDefault } });
  });
  res.status(201).json(row);
});
router.post('/bank-accounts/:id/default', async (req, res) => {
  const row = await prisma.bankAccount.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!row) return res.status(404).json({ error: 'Not found' });
  await prisma.$transaction([
    prisma.bankAccount.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } }),
    prisma.bankAccount.update({ where: { id: row.id }, data: { isDefault: true } }),
  ]);
  res.json({ ok: true });
});
router.delete('/bank-accounts/:id', async (req, res) => {
  const del = await prisma.bankAccount.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (del.count === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

const walletSchema = z.object({
  label: z.string().min(1).max(60),
  asset: z.enum(['BTC', 'ETH', 'USDT', 'USDC', 'BNB', 'SOL', 'XRP', 'DOGE', 'ADA', 'LTC']),
  network: z.string().min(2).max(40),
  address: z.string().min(6).max(140),
  memoTag: z.string().max(120).optional().or(z.literal('')),
  isDefault: z.boolean().optional(),
});

router.get('/payout-wallets', async (req, res) => {
  const rows = await prisma.payoutWallet.findMany({ where: { userId: req.user!.id }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }] });
  res.json(rows);
});
router.post('/payout-wallets', async (req, res) => {
  const parsed = walletSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid payout wallet' });
  const d = parsed.data;
  const existing = await prisma.payoutWallet.count({ where: { userId: req.user!.id } });
  const makeDefault = d.isDefault || existing === 0;
  const row = await prisma.$transaction(async (tx) => {
    if (makeDefault) await tx.payoutWallet.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } });
    return tx.payoutWallet.create({ data: { userId: req.user!.id, ...d, memoTag: d.memoTag || null, isDefault: makeDefault } });
  });
  res.status(201).json(row);
});
router.post('/payout-wallets/:id/default', async (req, res) => {
  const row = await prisma.payoutWallet.findFirst({ where: { id: req.params.id, userId: req.user!.id } });
  if (!row) return res.status(404).json({ error: 'Not found' });
  await prisma.$transaction([
    prisma.payoutWallet.updateMany({ where: { userId: req.user!.id }, data: { isDefault: false } }),
    prisma.payoutWallet.update({ where: { id: row.id }, data: { isDefault: true } }),
  ]);
  res.json({ ok: true });
});
router.delete('/payout-wallets/:id', async (req, res) => {
  const del = await prisma.payoutWallet.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  if (del.count === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Price alerts
// ---------------------------------------------------------------------------
router.get('/alerts', async (req, res) => {
  const alerts = await prisma.priceAlert.findMany({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  res.json(alerts);
});
router.post('/alerts', async (req, res) => {
  const parsed = z
    .object({
      symbol: z.string().min(3).max(20),
      condition: z.enum(['ABOVE', 'BELOW', 'PCT_CHANGE']),
      value: z.number().positive(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid alert' });
  const symbol = parsed.data.symbol.toUpperCase();
  // For percentage alerts, capture the current price as the baseline.
  const refPrice = parsed.data.condition === 'PCT_CHANGE' ? await getPrice(symbol).catch(() => null) : null;
  const alert = await prisma.priceAlert.create({
    data: { userId: req.user!.id, symbol, condition: parsed.data.condition, value: parsed.data.value, refPrice: refPrice ?? undefined },
  });
  res.status(201).json(alert);
});
router.delete('/alerts/:id', async (req, res) => {
  await prisma.priceAlert.deleteMany({ where: { id: req.params.id, userId: req.user!.id } });
  res.json({ ok: true });
});

// GET /api/account/transactions/:id — full details for the explorer (own txn)
router.get('/transactions/:id', async (req, res) => {
  const txn = await prisma.transaction.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  });
  if (!txn) return res.status(404).json({ error: 'Transaction not found' });
  res.json(txn);
});

// DELETE /api/account/orders/:id — cancel an open order
router.delete('/orders/:id', async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } });
  if (!order || order.userId !== req.user!.id) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'OPEN') return res.status(409).json({ error: 'Only open orders can be cancelled' });
  const updated = await prisma.order.update({ where: { id: order.id }, data: { status: 'CANCELLED' } });
  // Cancelling one OCO leg cancels its sibling too.
  if (order.ocoGroupId) {
    await prisma.order.updateMany({
      where: { ocoGroupId: order.ocoGroupId, status: 'OPEN', NOT: { id: order.id } },
      data: { status: 'CANCELLED' },
    });
  }
  await audit({ actorId: req.user!.id, action: 'order.cancel', target: order.id, ip: req.ip });
  publishBalance(req.user!.id, 'order.cancel', order.mode);
  res.json(updated);
});

// GET /api/account/transactions
router.get('/transactions', async (req, res) => {
  const txns = await prisma.transaction.findMany({
    where: { userId: req.user!.id, mode: getMode(req) },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(txns);
});

// POST /api/account/withdraw — creates a PENDING withdrawal for admin review
const withdrawSchema = z.object({
  asset: z.string().min(2),
  amount: z.number().positive(),
  network: z.string().optional(),
  address: z.string().optional(),
  payoutWalletId: z.string().optional(),
  bankAccountId: z.string().optional(),
});
router.post('/withdraw', async (req, res) => {
  const mode = getMode(req);
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid withdrawal' });
  const { asset, amount } = parsed.data;
  let { network, address } = parsed.data;
  let methodNote: string | undefined;

  // Resolve a saved destination (ownership-checked) if one was chosen.
  if (parsed.data.payoutWalletId) {
    const w = await prisma.payoutWallet.findFirst({ where: { id: parsed.data.payoutWalletId, userId: req.user!.id } });
    if (!w) return res.status(404).json({ error: 'Payout wallet not found' });
    network = w.network; address = w.address;
    methodNote = `Crypto payout → ${w.label} (${w.asset}/${w.network})`;
  } else if (parsed.data.bankAccountId) {
    const b = await prisma.bankAccount.findFirst({ where: { id: parsed.data.bankAccountId, userId: req.user!.id } });
    if (!b) return res.status(404).json({ error: 'Bank account not found' });
    address = b.accountNumber; network = 'Bank Transfer';
    methodNote = `Bank transfer → ${b.bankName} (${b.accountHolderName})`;
  }
  const fee = +(amount * 0.001).toFixed(8); // 0.1% demo network fee

  // Reserve the funds immediately so the withdrawn amount can no longer be
  // seen or traded. The balance moves to `locked`; it is returned on rejection
  // and cleared on completion. Guarded by a transaction to prevent races.
  try {
    const txn = await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId_asset_mode: { userId: req.user!.id, asset, mode } },
      });
      const balance = wallet ? parseFloat(wallet.balance.toString()) : 0;
      // For the trading currency, margin locked by open positions is not
      // withdrawable — only funds free of margin can leave the account.
      let usedMargin = 0;
      if (asset === ACCOUNT_CURRENCY) usedMargin = await usedMarginFor(req.user!.id, mode);
      const available = balance - usedMargin;
      if (amount > available + 1e-8) {
        throw Object.assign(new Error('Insufficient available balance for this withdrawal.'), { code: 'FUNDS' });
      }
      await tx.wallet.update({
        where: { userId_asset_mode: { userId: req.user!.id, asset, mode } },
        data: { balance: { decrement: amount }, locked: { increment: amount } },
      });
      return tx.transaction.create({
        data: { userId: req.user!.id, mode, type: 'WITHDRAWAL', asset, network, address, amount, fee, status: 'PENDING', reference: `WD-${Date.now()}`, note: methodNote },
      });
    });
    await audit({ actorId: req.user!.id, action: 'withdrawal.request', target: txn.id, meta: { mode, amount, asset }, ip: req.ip });
    publishBalance(req.user!.id, 'withdrawal.request', mode);
    return res.status(201).json(txn);
  } catch (e) {
    if (e && typeof e === 'object' && (e as { code?: string }).code === 'FUNDS') {
      return res.status(400).json({ error: (e as Error).message });
    }
    // eslint-disable-next-line no-console
    console.error('Withdrawal failed:', e);
    return res.status(500).json({ error: 'Could not submit the withdrawal. Please try again.' });
  }
});

// POST /api/account/deposit — DEMO credits instantly; LIVE creates a request
const depositSchema = z.object({
  asset: z.string().min(2),
  amount: z.number().positive(),
  network: z.string().optional(),
});
router.post('/deposit', async (req, res) => {
  const mode = getMode(req);
  const parsed = depositSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid deposit' });
  const { asset, amount, network } = parsed.data;

  if (mode === 'LIVE') {
    // Live deposits are recorded as requests only — no auto-credit.
    const txn = await prisma.transaction.create({
      data: { userId: req.user!.id, mode, type: 'DEPOSIT', asset, network, amount, status: 'PENDING', reference: `DP-${Date.now()}` },
    });
    await audit({ actorId: req.user!.id, action: 'deposit.request', target: txn.id, meta: { mode }, ip: req.ip });
    return res.status(201).json(txn);
  }

  // Demo deposit: simulate confirmations, then credit instantly.
  const [txn] = await prisma.$transaction([
    prisma.transaction.create({
      data: { userId: req.user!.id, mode, type: 'DEPOSIT', asset, network, amount, status: 'COMPLETED', reference: `DP-${Date.now()}` },
    }),
    prisma.wallet.upsert({
      where: { userId_asset_mode: { userId: req.user!.id, asset, mode } },
      create: { userId: req.user!.id, asset, mode, balance: amount },
      update: { balance: { increment: amount } },
    }),
  ]);
  await audit({ actorId: req.user!.id, action: 'deposit.demo', target: txn.id, ip: req.ip });
  publishBalance(req.user!.id, 'deposit.demo', mode);
  res.status(201).json(txn);
});

// Luhn check so obviously-bogus card numbers are rejected client- and server-side.
function luhnValid(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = parseInt(digits[i], 10);
    if (alt) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// POST /api/account/deposit/card — simulated credit/debit card deposit. The
// payment is simulated (no real processor); on success the wallet is credited
// instantly and a completed transaction is recorded.
router.post('/deposit/card', async (req, res) => {
  const mode = getMode(req);
  const schema = z.object({
    asset: z.string().min(2),
    amount: z.number().positive().max(1_000_000),
    cardNumber: z.string().min(12),
    expiry: z.string().regex(/^\d{2}\/\d{2}$/, 'Expiry must be MM/YY'),
    cvc: z.string().regex(/^\d{3,4}$/, 'Invalid CVC'),
    name: z.string().min(2),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { asset, amount, cardNumber } = parsed.data;
  if (!luhnValid(cardNumber)) return res.status(402).json({ error: 'The card number is invalid. Please check and try again.' });

  // Simulated expiry validity check.
  const [mm, yy] = parsed.data.expiry.split('/').map((n) => parseInt(n, 10));
  const exp = new Date(2000 + yy, mm, 1);
  if (mm < 1 || mm > 12 || exp < new Date()) return res.status(402).json({ error: 'The card has expired.' });

  const last4 = cardNumber.replace(/\D/g, '').slice(-4);
  const [txn] = await prisma.$transaction([
    prisma.transaction.create({
      data: { userId: req.user!.id, mode, type: 'DEPOSIT', asset, network: 'CARD', amount, status: 'COMPLETED', reference: `CARD-${Date.now()}`, note: `Card deposit •••• ${last4}` },
    }),
    prisma.wallet.upsert({
      where: { userId_asset_mode: { userId: req.user!.id, asset, mode } },
      create: { userId: req.user!.id, asset, mode, balance: amount },
      update: { balance: { increment: amount } },
    }),
  ]);
  await prisma.notification.create({ data: { userId: req.user!.id, title: 'Card deposit successful', body: `${amount} ${asset} was added to your ${mode.toLowerCase()} account via card ending ${last4}.`, type: 'SUCCESS' } }).catch(() => {});
  await audit({ actorId: req.user!.id, action: 'deposit.card', target: txn.id, meta: { mode, amount, asset }, ip: req.ip });
  publishBalance(req.user!.id, 'deposit.card', mode);
  res.status(201).json(txn);
});

// POST /api/account/request-demo-funds — user asks an admin to top up demo balance
router.post('/request-demo-funds', async (req, res) => {
  const parsed = z.object({ amount: z.number().positive().max(1000000) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid amount' });
  const txn = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      mode: 'DEMO',
      type: 'DEPOSIT',
      asset: 'USDT',
      amount: parsed.data.amount,
      status: 'PENDING',
      reference: `REQ-${Date.now()}`,
      note: 'Demo balance top-up request',
    },
  });
  await prisma.notification.create({
    data: { userId: req.user!.id, title: 'Top-up request submitted', body: `Your request for ${parsed.data.amount} demo USDT is pending admin approval.`, type: 'INFO' },
  });
  await audit({ actorId: req.user!.id, action: 'demo.topup.request', target: txn.id, ip: req.ip });
  res.status(201).json({ ok: true });
});

// GET /api/account/deposit-addresses — public demo deposit addresses per asset
router.get('/deposit-addresses', async (_req, res) => {
  try {
    const addrs = await prisma.walletAddress.findMany({
      where: { enabled: true },
      orderBy: [{ asset: 'asc' }, { isDefault: 'desc' }],
    });
    res.json(addrs);
  } catch {
    res.json([]);
  }
});

// PATCH /api/account/profile — legal name is a protected identity field and
// cannot be self-changed. A legal name change requires identity verification and
// administrator approval (admins update it via the back office).
router.patch('/profile', async (_req, res) => {
  return res.status(403).json({ error: 'Your legal name is protected and cannot be changed here. Please contact support — a name change requires identity verification and administrator approval.' });
});

// GET /api/account/2fa — current status
router.get('/2fa', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactor: true } });
  res.json({ twoFactor: user?.twoFactor ?? false });
});

// POST /api/account/2fa/setup — generate a TOTP secret + otpauth URI (real TOTP)
router.post('/2fa/setup', async (req, res) => {
  const secret = generateBase32Secret();
  await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactorSecret: secret } });
  res.json({ secret, otpauth: otpauthUri(secret, req.user!.email) });
});

// POST /api/account/2fa/verify — confirm a code and enable 2FA
router.post('/2fa/verify', async (req, res) => {
  const schema = z.object({ code: z.string().length(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter the 6-digit code' });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { twoFactorSecret: true } });
  if (!user?.twoFactorSecret) return res.status(400).json({ error: 'Start setup first' });
  if (!verifyTotp(user.twoFactorSecret, parsed.data.code)) {
    return res.status(400).json({ error: 'Invalid code — try again' });
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactor: true } });
  await audit({ actorId: req.user!.id, action: '2fa.enable', ip: req.ip });
  res.json({ ok: true, twoFactor: true });
});

// POST /api/account/2fa/disable
router.post('/2fa/disable', async (req, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactor: false, twoFactorSecret: null } });
  await audit({ actorId: req.user!.id, action: '2fa.disable', ip: req.ip });
  res.json({ ok: true, twoFactor: false });
});

// ---------------------------------------------------------------------------
// KYC — user submission flow
// ---------------------------------------------------------------------------
// Proof-of-Address threshold (USD-equivalent). A single completed deposit at
// or above this, or cumulative completed deposits at or above it, requires POA.
const POA_THRESHOLD = 5000;
const FIAT_LIKE = new Set(['USDT', 'USDC', 'USD', 'EUR', 'GBP']);

async function poaRequirement(userId: string): Promise<{ required: boolean; cumulative: number; threshold: number }> {
  const deposits = await prisma.transaction.findMany({
    where: { userId, type: 'DEPOSIT', status: 'COMPLETED', mode: 'LIVE' },
    select: { amount: true, asset: true },
  });
  let cumulative = 0;
  let maxSingle = 0;
  for (const d of deposits) {
    if (!FIAT_LIKE.has(d.asset)) continue; // only value fiat-like deposits
    const a = parseFloat(d.amount.toString());
    cumulative += a;
    maxSingle = Math.max(maxSingle, a);
  }
  return { required: maxSingle >= POA_THRESHOLD || cumulative >= POA_THRESHOLD, cumulative, threshold: POA_THRESHOLD };
}

router.get('/kyc', async (req, res) => {
  const [user, submission, poaSubmission, poa] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true, poaStatus: true } }),
    prisma.kycSubmission.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } }),
    prisma.addressProof.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } }),
    poaRequirement(req.user!.id),
  ]);
  res.json({
    status: user?.kycStatus ?? 'NONE',
    submission,
    poaStatus: user?.poaStatus ?? 'NONE',
    poaSubmission: poaSubmission ? { docType: poaSubmission.docType, issuedDate: poaSubmission.issuedDate, status: poaSubmission.status, createdAt: poaSubmission.createdAt } : null,
    poaRequired: poa.required,
    poaThreshold: poa.threshold,
    depositsTotal: poa.cumulative,
  });
});

// POST /api/account/poa — submit a proof-of-address document.
router.post('/poa', async (req, res) => {
  const schema = z.object({
    docType: z.enum(['UTILITY_BILL', 'BANK_STATEMENT', 'GOVERNMENT_LETTER', 'TAX_DOCUMENT']),
    issuedDate: z.string().optional(),
    documentName: z.string().optional(),
    documentType: z.string().optional(),
    documentData: z.string().max(5_600_000),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  await prisma.$transaction([
    prisma.addressProof.create({ data: { userId: req.user!.id, ...parsed.data, status: 'PENDING' } }),
    prisma.user.update({ where: { id: req.user!.id }, data: { poaStatus: 'PENDING' } }),
  ]);
  await audit({ actorId: req.user!.id, action: 'poa.submit', target: req.user!.id, meta: { docType: parsed.data.docType }, ip: req.ip });
  res.status(201).json({ ok: true, poaStatus: 'PENDING' });
});

router.post('/kyc', async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    country: z.string().min(2),
    idType: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']),
    addressLine1: z.string().min(3, 'Address line 1 is required'),
    addressLine2: z.string().optional(),
    dob: z.string().min(4),
    documentName: z.string().optional(),
    documentType: z.string().optional(),
    // base64 data URL, capped so the request stays reasonable (~4MB of base64).
    documentData: z.string().max(5_600_000).optional(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  await prisma.$transaction([
    prisma.kycSubmission.create({ data: { userId: req.user!.id, ...parsed.data, status: 'PENDING' } }),
    prisma.user.update({ where: { id: req.user!.id }, data: { kycStatus: 'PENDING' } }),
  ]);
  await audit({ actorId: req.user!.id, action: 'kyc.submit', target: req.user!.id, ip: req.ip });
  res.status(201).json({ ok: true, status: 'PENDING' });
});

// POST /api/account/change-password
router.post('/change-password', async (req, res) => {
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: strongPassword });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  // Bump tokenVersion so every other logged-in session is signed out, then
  // re-issue this session so the current user stays logged in.
  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    // hasPassword=true so a Google-provisioned account gains an email login.
    data: { passwordHash: await hashPassword(parsed.data.newPassword), hasPassword: true, tokenVersion: { increment: 1 } },
    select: { id: true, email: true, tokenVersion: true },
  });
  const accessToken = issueSession(res, updated);
  await audit({ actorId: req.user!.id, action: 'password.change', target: req.user!.id, ip: req.ip });
  res.json({ ok: true, accessToken });
});

// POST /api/account/link-google — link a Google identity to this account.
router.post('/link-google', async (req, res) => {
  const parsed = z.object({ credential: z.string().min(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Missing Google credential' });
  const profile = await verifyGoogleIdToken(parsed.data.credential);
  if (!profile) return res.status(401).json({ error: 'Could not verify Google sign-in' });

  const clash = await prisma.user.findUnique({ where: { googleId: profile.sub } });
  if (clash && clash.id !== req.user!.id) return res.status(409).json({ error: 'That Google account is already linked to another user.' });

  await prisma.user.update({
    where: { id: req.user!.id },
    data: { googleId: profile.sub, googleLinkedAt: new Date(), avatarUrl: profile.picture ?? undefined },
  });
  await audit({ actorId: req.user!.id, action: 'account.google.linked', target: req.user!.id, meta: { googleEmail: profile.email }, ip: req.ip });
  res.json({ ok: true, googleLinked: true });
});

// POST /api/account/unlink-google — remove the Google link (only if an
// email+password login remains, so the user is never locked out).
router.post('/unlink-google', async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { hasPassword: true, googleId: true } });
  if (!user?.googleId) return res.status(400).json({ error: 'No Google account is linked.' });
  if (!user.hasPassword) return res.status(400).json({ error: 'Set a password first so you can still sign in after unlinking Google.' });

  await prisma.user.update({ where: { id: req.user!.id }, data: { googleId: null, googleLinkedAt: null } });
  await audit({ actorId: req.user!.id, action: 'account.google.unlinked', target: req.user!.id, ip: req.ip });
  res.json({ ok: true, googleLinked: false });
});

// POST /api/account/change-email — password-confirmed email change.
// (Email-verification delivery is not configured on this demo deployment, so
// the change applies immediately after re-authentication; the switch to a
// token-verified flow only needs an SMTP transport.)
router.post('/change-email', async (req, res) => {
  const schema = z.object({
    newEmail: z.string().email('Enter a valid email'),
    confirmEmail: z.string().email(),
    currentPassword: z.string().min(1),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { newEmail, confirmEmail, currentPassword } = parsed.data;
  if (newEmail.toLowerCase() !== confirmEmail.toLowerCase()) return res.status(400).json({ error: 'The email addresses do not match.' });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true, email: true } });
  if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  if (newEmail.toLowerCase() === user.email.toLowerCase()) return res.status(400).json({ error: 'That is already your email address.' });
  const taken = await prisma.user.findUnique({ where: { email: newEmail } });
  if (taken) return res.status(409).json({ error: 'That email address is already in use.' });

  const updated = await prisma.user.update({
    where: { id: req.user!.id },
    data: { email: newEmail, tokenVersion: { increment: 1 } },
    select: { id: true, email: true, tokenVersion: true },
  });
  const accessToken = issueSession(res, updated);
  await audit({ actorId: req.user!.id, action: 'email.change', target: req.user!.id, meta: { from: user.email, to: newEmail }, ip: req.ip });
  res.json({ ok: true, email: newEmail, accessToken });
});

// ---------------------------------------------------------------------------
// API keys (demo) — the full secret is shown once at creation time only.
// ---------------------------------------------------------------------------
router.get('/apikeys', async (req, res) => {
  const keys = await prisma.apiKey.findMany({
    where: { userId: req.user!.id, revoked: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true, label: true, prefix: true, lastFour: true, createdAt: true, lastUsed: true },
  });
  res.json(keys);
});

router.post('/apikeys', async (req, res) => {
  const schema = z.object({ label: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Label is required' });

  const rand = () => Math.random().toString(36).slice(2);
  const secret = `nxp_live_${rand()}${rand()}`.slice(0, 40);
  const key = await prisma.apiKey.create({
    data: {
      userId: req.user!.id,
      label: parsed.data.label,
      prefix: secret.slice(0, 12),
      lastFour: secret.slice(-4),
    },
  });
  await audit({ actorId: req.user!.id, action: 'apikey.create', target: key.id, ip: req.ip });
  // Return the full secret exactly once.
  res.status(201).json({ id: key.id, label: key.label, secret });
});

router.delete('/apikeys/:id', async (req, res) => {
  const key = await prisma.apiKey.findUnique({ where: { id: req.params.id } });
  if (!key || key.userId !== req.user!.id) return res.status(404).json({ error: 'Key not found' });
  await prisma.apiKey.update({ where: { id: key.id }, data: { revoked: true } });
  await audit({ actorId: req.user!.id, action: 'apikey.revoke', target: key.id, ip: req.ip });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------
router.get('/notifications', async (req, res) => {
  const items = await prisma.notification.findMany({
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  const unread = items.filter((n) => !n.read).length;
  res.json({ items, unread });
});

router.post('/notifications/:id/read', async (req, res) => {
  await prisma.notification.updateMany({ where: { id: req.params.id, userId: req.user!.id }, data: { read: true } });
  res.json({ ok: true });
});

router.post('/notifications/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Referral / affiliate
// ---------------------------------------------------------------------------
router.get('/referral', async (req, res) => {
  let user = await prisma.user.findUnique({
    where: { id: req.user!.id },
    select: { referralCode: true },
  });
  // Backfill a referral code for older accounts.
  if (!user?.referralCode) {
    const code = `NXP${req.user!.id.slice(-6).toUpperCase()}`;
    user = await prisma.user.update({ where: { id: req.user!.id }, data: { referralCode: code }, select: { referralCode: true } });
  }

  const referrals = await prisma.user.findMany({
    where: { referredById: req.user!.id },
    select: { fullName: true, email: true, createdAt: true, kycStatus: true },
    orderBy: { createdAt: 'desc' },
  });

  const COMMISSION = 25; // demo $ per referred, active user
  const active = referrals.filter((r) => r.kycStatus === 'APPROVED').length;
  const earnings = referrals.length * 10 + active * COMMISSION;

  const tiers = [
    { name: 'Bronze', min: 0, rate: '20%' },
    { name: 'Silver', min: 5, rate: '30%' },
    { name: 'Gold', min: 15, rate: '40%' },
    { name: 'Platinum', min: 50, rate: '50%' },
  ];
  const tier = [...tiers].reverse().find((t) => referrals.length >= t.min) ?? tiers[0];

  res.json({
    code: user!.referralCode,
    totalReferrals: referrals.length,
    activeReferrals: active,
    earnings,
    tier,
    tiers,
    referrals: referrals.map((r) => ({
      name: r.fullName,
      email: r.email.replace(/(.{2}).*(@.*)/, '$1***$2'),
      joined: r.createdAt,
      verified: r.kycStatus === 'APPROVED',
    })),
  });
});

// ---------------------------------------------------------------------------
// Achievements — derived from real account activity
// ---------------------------------------------------------------------------
router.get('/achievements', async (req, res) => {
  const uid = req.user!.id;
  const [orders, deposits, referrals, user, twoFa] = await Promise.all([
    prisma.order.count({ where: { userId: uid } }),
    prisma.transaction.count({ where: { userId: uid, type: 'DEPOSIT' } }),
    prisma.user.count({ where: { referredById: uid } }),
    prisma.user.findUnique({ where: { id: uid }, select: { kycStatus: true, twoFactor: true } }),
    Promise.resolve(null),
  ]);
  void twoFa;

  const defs = [
    { key: 'first_trade', title: 'First Trade', desc: 'Place your first order', icon: '🎯', earned: orders >= 1 },
    { key: 'active_trader', title: 'Active Trader', desc: 'Place 10 orders', icon: '⚡', earned: orders >= 10 },
    { key: 'whale', title: 'Market Mover', desc: 'Place 50 orders', icon: '🐳', earned: orders >= 50 },
    { key: 'funded', title: 'Funded', desc: 'Make a deposit', icon: '💰', earned: deposits >= 1 },
    { key: 'verified', title: 'Verified', desc: 'Complete KYC', icon: '✅', earned: user?.kycStatus === 'APPROVED' },
    { key: 'secured', title: 'Fort Knox', desc: 'Enable 2FA', icon: '🔐', earned: !!user?.twoFactor },
    { key: 'connector', title: 'Connector', desc: 'Refer a friend', icon: '🤝', earned: referrals >= 1 },
    { key: 'influencer', title: 'Influencer', desc: 'Refer 5 friends', icon: '🌟', earned: referrals >= 5 },
  ];
  res.json({ achievements: defs, earned: defs.filter((d) => d.earned).length, total: defs.length });
});

export default router;

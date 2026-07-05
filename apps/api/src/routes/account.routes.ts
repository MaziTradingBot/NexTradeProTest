import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { audit } from '../lib/audit';
import { generateBase32Secret, otpauthUri, verifyTotp } from '../lib/totp';
import { hashPassword, verifyPassword } from '../lib/auth';
import { getPrice, getPrices } from '../lib/marketPrice';
import { subscribe, publishBalance } from '../lib/events';
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
  type: z.enum(['MARKET', 'LIMIT', 'STOP']),
  price: z.number().positive(),
  amount: z.number().positive(),
  leverage: z.number().int().min(1).max(125).optional(),
  stopLoss: z.number().positive().optional(),
  takeProfit: z.number().positive().optional(),
});

router.post('/orders', async (req, res) => {
  const mode = getMode(req);
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { symbol, side, type, price, amount, leverage, stopLoss, takeProfit } = parsed.data;
  const lev = Math.min(MAX_LEVERAGE, Math.max(1, leverage ?? 1));

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

  // Limit / stop orders rest as pending working orders (no margin reserved
  // until they trigger). They can be cancelled from the terminal.
  const order = await prisma.order.create({
    data: { userId: req.user!.id, mode, symbol, side, type, leverage: lev, price, amount, stopLoss, takeProfit, status: 'OPEN', filled: 0 },
  });
  await audit({ actorId: req.user!.id, action: 'order.place', target: order.id, meta: { symbol, side, mode }, ip: req.ip });
  res.status(201).json(order);
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
  await audit({ actorId: req.user!.id, action: 'order.cancel', target: order.id, ip: req.ip });
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
});
router.post('/withdraw', async (req, res) => {
  const mode = getMode(req);
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid withdrawal' });
  const { asset, amount, network, address } = parsed.data;
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
        data: { userId: req.user!.id, mode, type: 'WITHDRAWAL', asset, network, address, amount, fee, status: 'PENDING', reference: `WD-${Date.now()}` },
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

// PATCH /api/account/profile — update display name
router.patch('/profile', async (req, res) => {
  const schema = z.object({ fullName: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid name' });
  await prisma.user.update({ where: { id: req.user!.id }, data: { fullName: parsed.data.fullName } });
  res.json({ ok: true });
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
router.get('/kyc', async (req, res) => {
  const [user, submission] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.user!.id }, select: { kycStatus: true } }),
    prisma.kycSubmission.findFirst({ where: { userId: req.user!.id }, orderBy: { createdAt: 'desc' } }),
  ]);
  res.json({ status: user?.kycStatus ?? 'NONE', submission });
});

router.post('/kyc', async (req, res) => {
  const schema = z.object({
    fullName: z.string().min(2),
    country: z.string().min(2),
    idType: z.enum(['PASSPORT', 'NATIONAL_ID', 'DRIVERS_LICENSE']),
    idNumber: z.string().min(3),
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
  const schema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8, 'New password must be at least 8 characters') });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  const user = await prisma.user.findUnique({ where: { id: req.user!.id }, select: { passwordHash: true } });
  if (!user || !(await verifyPassword(parsed.data.currentPassword, user.passwordHash))) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }
  await prisma.user.update({ where: { id: req.user!.id }, data: { passwordHash: await hashPassword(parsed.data.newPassword) } });
  await audit({ actorId: req.user!.id, action: 'password.change', target: req.user!.id, ip: req.ip });
  res.json({ ok: true });
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

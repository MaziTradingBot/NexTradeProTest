import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { audit } from '../lib/audit';
import { generateBase32Secret, otpauthUri, verifyTotp } from '../lib/totp';

const router = Router();
router.use(authenticate);

// Active account mode comes from the x-nxp-mode header (default DEMO).
type Mode = 'DEMO' | 'LIVE';
function getMode(req: import('express').Request): Mode {
  return req.header('x-nxp-mode') === 'LIVE' ? 'LIVE' : 'DEMO';
}

const LIVE_TRADING_MSG =
  'Real trading is available only after exchange integration, regulatory compliance, and administrator activation.';

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
  // Live trading stays disabled until real exchange integration.
  if (mode === 'LIVE') return res.status(403).json({ error: LIVE_TRADING_MSG });

  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { symbol, side, type, price, amount, leverage, stopLoss, takeProfit } = parsed.data;

  const order = await prisma.order.create({
    data: {
      userId: req.user!.id,
      mode,
      symbol,
      side,
      type,
      leverage: leverage ?? 1,
      price,
      amount,
      stopLoss,
      takeProfit,
      // Market orders fill instantly in the demo engine.
      status: type === 'MARKET' ? 'FILLED' : 'OPEN',
      filled: type === 'MARKET' ? amount : 0,
    },
  });

  await audit({ actorId: req.user!.id, action: 'order.place', target: order.id, meta: { symbol, side, mode }, ip: req.ip });
  res.status(201).json(order);
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

  const txn = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      mode,
      type: 'WITHDRAWAL',
      asset,
      network,
      address,
      amount,
      fee,
      status: 'PENDING',
      reference: `WD-${Date.now()}`,
    },
  });
  await audit({ actorId: req.user!.id, action: 'withdrawal.request', target: txn.id, meta: { mode }, ip: req.ip });
  res.status(201).json(txn);
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

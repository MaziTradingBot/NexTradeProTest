import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth';
import { audit } from '../lib/audit';

const router = Router();
router.use(authenticate);

// GET /api/account/wallets
router.get('/wallets', async (req, res) => {
  const wallets = await prisma.wallet.findMany({ where: { userId: req.user!.id }, orderBy: { asset: 'asc' } });
  res.json(wallets);
});

// GET /api/account/orders
router.get('/orders', async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user!.id },
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
});

router.post('/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { symbol, side, type, price, amount } = parsed.data;

  const order = await prisma.order.create({
    data: {
      userId: req.user!.id,
      symbol,
      side,
      type,
      price,
      amount,
      // Market orders fill instantly in the demo engine.
      status: type === 'MARKET' ? 'FILLED' : 'OPEN',
      filled: type === 'MARKET' ? amount : 0,
    },
  });

  await audit({ actorId: req.user!.id, action: 'order.place', target: order.id, meta: { symbol, side }, ip: req.ip });
  res.status(201).json(order);
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
    where: { userId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(txns);
});

// POST /api/account/withdraw — creates a PENDING withdrawal for admin review
const withdrawSchema = z.object({ asset: z.string().min(2), amount: z.number().positive() });
router.post('/withdraw', async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid withdrawal' });
  const txn = await prisma.transaction.create({
    data: {
      userId: req.user!.id,
      type: 'WITHDRAWAL',
      asset: parsed.data.asset,
      amount: parsed.data.amount,
      status: 'PENDING',
      reference: `WD-${Date.now()}`,
    },
  });
  await audit({ actorId: req.user!.id, action: 'withdrawal.request', target: txn.id, ip: req.ip });
  res.status(201).json(txn);
});

// POST /api/account/deposit — demo deposit, instantly credited
router.post('/deposit', async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid deposit' });
  const { asset, amount } = parsed.data;

  const [txn] = await prisma.$transaction([
    prisma.transaction.create({
      data: { userId: req.user!.id, type: 'DEPOSIT', asset, amount, status: 'COMPLETED', reference: `DP-${Date.now()}` },
    }),
    prisma.wallet.upsert({
      where: { userId_asset: { userId: req.user!.id, asset } },
      create: { userId: req.user!.id, asset, balance: amount },
      update: { balance: { increment: amount } },
    }),
  ]);
  await audit({ actorId: req.user!.id, action: 'deposit.demo', target: txn.id, ip: req.ip });
  res.status(201).json(txn);
});

// PATCH /api/account/profile — update display name
router.patch('/profile', async (req, res) => {
  const schema = z.object({ fullName: z.string().min(2) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid name' });
  await prisma.user.update({ where: { id: req.user!.id }, data: { fullName: parsed.data.fullName } });
  res.json({ ok: true });
});

// POST /api/account/2fa — toggle two-factor (demo)
router.post('/2fa', async (req, res) => {
  const schema = z.object({ enabled: z.boolean() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid value' });
  await prisma.user.update({ where: { id: req.user!.id }, data: { twoFactor: parsed.data.enabled } });
  await audit({ actorId: req.user!.id, action: parsed.data.enabled ? '2fa.enable' : '2fa.disable', ip: req.ip });
  res.json({ ok: true, twoFactor: parsed.data.enabled });
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

export default router;

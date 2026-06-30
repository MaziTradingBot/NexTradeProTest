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

export default router;

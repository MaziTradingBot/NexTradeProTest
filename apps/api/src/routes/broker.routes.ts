import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requirePermission } from '../middleware/auth';

const router = Router();
router.use(authenticate, requirePermission('broker.access'));

// Reference prices to value demo portfolios (USD).
const REF: Record<string, number> = {
  USDT: 1, USDC: 1, BTC: 67000, ETH: 3500, SOL: 150, BNB: 600, XRP: 0.6,
  ADA: 0.45, DOGE: 0.16, LTC: 85, AVAX: 38, MATIC: 0.9,
};

function walletsToUsd(wallets: { asset: string; balance: unknown }[]): number {
  return wallets.reduce((sum, w) => sum + Number(w.balance) * (REF[w.asset] ?? 0), 0);
}

// GET /api/broker/overview
router.get('/overview', async (req, res) => {
  const clients = await prisma.user.findMany({
    where: { brokerId: req.user!.id },
    select: { id: true, kycStatus: true, wallets: { where: { mode: 'DEMO' }, select: { asset: true, balance: true } } },
  });
  const aum = clients.reduce((s, c) => s + walletsToUsd(c.wallets), 0);
  const verified = clients.filter((c) => c.kycStatus === 'APPROVED').length;
  const orders = await prisma.order.count({ where: { userId: { in: clients.map((c) => c.id) } } });
  // Demo commission model: 0.1% of AUM + $5 per client trade.
  const commission = +(aum * 0.001 + orders * 5).toFixed(2);

  res.json({ totalClients: clients.length, verifiedClients: verified, aum, totalTrades: orders, commission });
});

// GET /api/broker/clients
router.get('/clients', async (req, res) => {
  const clients = await prisma.user.findMany({
    where: { brokerId: req.user!.id },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, fullName: true, status: true, kycStatus: true, createdAt: true, lastLoginAt: true,
      wallets: { where: { mode: 'DEMO' }, select: { asset: true, balance: true } },
      _count: { select: { orders: true } },
    },
  });
  res.json(
    clients.map((c) => ({
      id: c.id,
      email: c.email,
      fullName: c.fullName,
      status: c.status,
      kycStatus: c.kycStatus,
      createdAt: c.createdAt,
      lastLoginAt: c.lastLoginAt,
      portfolioUsd: walletsToUsd(c.wallets),
      trades: c._count.orders,
    })),
  );
});

// GET /api/broker/clients/:id — detail (only if assigned to this broker)
router.get('/clients/:id', async (req, res) => {
  const client = await prisma.user.findFirst({
    where: { id: req.params.id, brokerId: req.user!.id },
    select: {
      id: true, email: true, fullName: true, status: true, kycStatus: true, createdAt: true,
      wallets: { where: { mode: 'DEMO' }, orderBy: { asset: 'asc' } },
      orders: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json({ ...client, portfolioUsd: walletsToUsd(client.wallets) });
});

export default router;

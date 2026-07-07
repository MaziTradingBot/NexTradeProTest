import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { audit } from '../lib/audit';

const router = Router();
router.use(authenticate, requireAdmin, requirePermission('system.settings'));

// Standard demo funding applied on refill/reset.
const DEMO_FUNDING: [string, number][] = [
  ['USDT', 100000],
  ['BTC', 1.5],
  ['ETH', 20],
  ['SOL', 200],
  ['BNB', 50],
  ['XRP', 5000],
];
const REF: Record<string, number> = { BTCUSDT: 67000, ETHUSDT: 3500, SOLUSDT: 150, BNBUSDT: 600, XRPUSDT: 0.6 };
const SYMBOLS = Object.keys(REF);
const rand = <T>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)];

async function refillWallets(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const u of users) {
    for (const [asset, balance] of DEMO_FUNDING) {
      await prisma.wallet.upsert({
        where: { userId_asset_mode: { userId: u.id, asset, mode: 'DEMO' } },
        create: { userId: u.id, asset, mode: 'DEMO', balance },
        update: { balance, locked: 0, frozen: false },
      });
    }
  }
  return users.length;
}

async function regenerateOrders(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let count = 0;
  for (const u of users) {
    const n = 6 + Math.floor(Math.random() * 8);
    for (let i = 0; i < n; i++) {
      const symbol = rand(SYMBOLS);
      const base = REF[symbol];
      const price = +(base * (0.96 + Math.random() * 0.08)).toFixed(2);
      await prisma.order.create({
        data: {
          userId: u.id,
          mode: 'DEMO',
          symbol,
          side: rand(['BUY', 'SELL'] as const),
          type: 'MARKET',
          price,
          amount: +(Math.random() * 2 + 0.01).toFixed(4),
          filled: 1,
          status: 'FILLED',
        },
      });
      count++;
    }
  }
  return count;
}

async function regenerateTransactions(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  let count = 0;
  for (const u of users) {
    await prisma.transaction.createMany({
      data: [
        { userId: u.id, mode: 'DEMO', type: 'DEPOSIT', asset: 'USDT', amount: 5000, status: 'COMPLETED', reference: `DP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
        { userId: u.id, mode: 'DEMO', type: 'WITHDRAWAL', asset: 'BTC', amount: 0.05, fee: 0.00005, status: 'PENDING', reference: `WD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` },
      ],
    });
    count += 2;
  }
  return count;
}

async function regenerateNotifications(): Promise<number> {
  const users = await prisma.user.findMany({ select: { id: true } });
  const templates = [
    { title: 'Trade filled', body: 'Your BTC market order was executed.', type: 'TRADE' as const },
    { title: 'Deposit confirmed', body: '5,000 USDT credited to your demo wallet.', type: 'SUCCESS' as const },
    { title: 'Market alert', body: 'ETH is up 4.1% in the last hour.', type: 'INFO' as const },
  ];
  for (const u of users) {
    await prisma.notification.createMany({ data: templates.map((t) => ({ userId: u.id, ...t })) });
  }
  return users.length * templates.length;
}

// action -> handler returning a human summary
const ACTIONS: Record<string, () => Promise<string>> = {
  refill: async () => `Refilled demo wallets for ${await refillWallets()} accounts ($100k + crypto).`,
  reset_wallets: async () => `Reset ${await refillWallets()} demo wallets to their default balances.`,
  reset_trades: async () => `Cleared ${(await prisma.order.deleteMany({ where: { mode: 'DEMO' } })).count} demo orders.`,
  reset_transactions: async () =>
    `Cleared ${(await prisma.transaction.deleteMany({ where: { mode: 'DEMO' } })).count} demo transactions.`,
  reset_notifications: async () => `Cleared ${(await prisma.notification.deleteMany({})).count} notifications.`,
  regenerate_orders: async () => `Generated ${await regenerateOrders()} demo orders.`,
  regenerate_transactions: async () => `Generated ${await regenerateTransactions()} demo transactions.`,
  regenerate_notifications: async () => `Generated ${await regenerateNotifications()} notifications.`,
  reset_all: async () => {
    await prisma.order.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.transaction.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.notification.deleteMany({});
    await refillWallets();
    return 'Demo platform reset: wallets refilled, trades/transactions/notifications cleared.';
  },
  full_refresh: async () => {
    await prisma.order.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.transaction.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.notification.deleteMany({});
    await refillWallets();
    await regenerateOrders();
    await regenerateTransactions();
    await regenerateNotifications();
    return 'Demo platform refreshed to a polished, populated presentation state.';
  },
  // One-click "Start Client Presentation": reset + refill + populate DEMO data
  // and turn on Presentation Mode so the app shows a clean, on-brand surface.
  start_presentation: async () => {
    await prisma.order.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.transaction.deleteMany({ where: { mode: 'DEMO' } });
    await prisma.notification.deleteMany({});
    await refillWallets();
    await regenerateOrders();
    await regenerateTransactions();
    await regenerateNotifications();
    await prisma.featureFlag.upsert({
      where: { key: 'presentation_mode' },
      create: { key: 'presentation_mode', label: 'Presentation Mode', description: 'Client showcase mode is active.', enabled: true },
      update: { enabled: true },
    });
    return 'Presentation Mode ON — demo accounts refilled to $100k and dashboards populated. Ready to present.';
  },
  stop_presentation: async () => {
    await prisma.featureFlag.upsert({
      where: { key: 'presentation_mode' },
      create: { key: 'presentation_mode', label: 'Presentation Mode', description: 'Client showcase mode is active.', enabled: false },
      update: { enabled: false },
    });
    return 'Presentation Mode OFF — back to normal demo browsing.';
  },
};

// GET /api/admin/toolkit/status — presentation-mode state for the admin UI.
router.get('/status', async (_req, res) => {
  const flag = await prisma.featureFlag.findUnique({ where: { key: 'presentation_mode' } });
  res.json({ presentationMode: flag?.enabled ?? false });
});

// POST /api/admin/toolkit/:action
router.post('/:action', async (req, res) => {
  const handler = ACTIONS[req.params.action];
  if (!handler) return res.status(404).json({ error: 'Unknown action' });
  try {
    const message = await handler();
    await audit({ actorId: req.user!.id, action: `toolkit.${req.params.action}`, ip: req.ip });
    res.json({ ok: true, message });
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : 'Action failed' });
  }
});

export default router;

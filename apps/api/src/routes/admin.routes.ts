import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { publishBalance } from '../lib/events';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { audit } from '../lib/audit';
import { hashPassword } from '../lib/auth';
import { getPrice } from '../lib/marketPrice';
import { ACCOUNT_CURRENCY, floatingPnl, round8 } from '../lib/trading';

const router = Router();

// All admin routes require an authenticated admin.
router.use(authenticate, requireAdmin);

// ---------------------------------------------------------------------------
// Analytics overview
// ---------------------------------------------------------------------------
router.get('/overview', requirePermission('admin.access'), async (_req, res) => {
  const [users, pendingWithdrawals, pendingKyc, openTickets, totalOrders] = await Promise.all([
    prisma.user.count(),
    prisma.transaction.count({ where: { type: 'WITHDRAWAL', status: 'PENDING' } }),
    prisma.user.count({ where: { kycStatus: 'PENDING' } }),
    Promise.resolve(0),
    prisma.order.count(),
  ]);

  const depositsAgg = await prisma.transaction.aggregate({
    where: { type: 'DEPOSIT', status: { in: ['APPROVED', 'COMPLETED'] } },
    _sum: { amount: true },
  });

  res.json({
    users,
    pendingWithdrawals,
    pendingKyc,
    openTickets,
    totalOrders,
    totalDeposits: depositsAgg._sum.amount ?? 0,
  });
});

// Analytics time series (signups + revenue) for the last N days.
router.get('/analytics', requirePermission('admin.analytics.view'), async (req, res) => {
  const days = Math.min(parseInt((req.query.days as string) || '14', 10), 60);
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const [users, deposits] = await Promise.all([
    prisma.user.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    prisma.transaction.findMany({
      where: { type: 'DEPOSIT', status: { in: ['COMPLETED', 'APPROVED'] }, createdAt: { gte: since } },
      select: { createdAt: true, amount: true, asset: true },
    }),
  ]);

  const key = (d: Date) => d.toISOString().slice(0, 10);
  const buckets = new Map<string, { date: string; signups: number; revenue: number }>();
  for (let i = 0; i < days; i++) {
    const d = new Date(since);
    d.setDate(since.getDate() + i);
    buckets.set(key(d), { date: key(d), signups: 0, revenue: 0 });
  }
  users.forEach((u) => {
    const b = buckets.get(key(u.createdAt));
    if (b) b.signups += 1;
  });
  deposits.forEach((t) => {
    const b = buckets.get(key(t.createdAt));
    // Value USDT 1:1; other assets are ignored for this simple revenue proxy.
    if (b && t.asset === 'USDT') b.revenue += Number(t.amount);
  });

  res.json({ series: Array.from(buckets.values()) });
});

// ---------------------------------------------------------------------------
// Roles & permissions
// ---------------------------------------------------------------------------
router.get('/roles', requirePermission('users.view', 'roles.assign', 'roles.manage'), async (_req, res) => {
  const roles = await prisma.role.findMany({
    orderBy: { name: 'asc' },
    include: {
      permissions: { include: { permission: true } },
      _count: { select: { users: true } },
    },
  });
  res.json(
    roles.map((r) => ({
      id: r.id,
      key: r.key,
      name: r.name,
      description: r.description,
      isAdmin: r.isAdmin,
      isSystem: r.isSystem,
      userCount: r._count.users,
      permissions: r.permissions.map((p) => p.permission.key),
    })),
  );
});

router.get('/permissions', requirePermission('roles.assign', 'roles.manage'), async (_req, res) => {
  const perms = await prisma.permission.findMany({ orderBy: [{ group: 'asc' }, { name: 'asc' }] });
  res.json(perms);
});

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
router.get('/users', requirePermission('users.view'), async (req, res) => {
  const search = (req.query.search as string) || '';
  const users = await prisma.user.findMany({
    where: search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' } },
            { fullName: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined,
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { roles: { include: { role: true } } },
  });

  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      status: u.status,
      kycStatus: u.kycStatus,
      liveTradingEnabled: u.liveTradingEnabled,
      tradingStatus: u.tradingStatus,
      tradingPermission: u.tradingPermission,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name, isAdmin: r.role.isAdmin })),
    })),
  );
});

// PATCH /api/admin/users/:id/trading-access — Live Trading access control.
// Toggle live-trading access, trading status/permission and account status.
router.patch('/users/:id/trading-access', requirePermission('users.manage'), async (req, res) => {
  const parsed = z
    .object({
      liveTradingEnabled: z.boolean().optional(),
      tradingStatus: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
      tradingPermission: z.enum(['FULL', 'READ_ONLY']).optional(),
      accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']).optional(),
    })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid trading-access update' });

  const prev = await prisma.user.findUnique({
    where: { id: req.params.id },
    select: { liveTradingEnabled: true, tradingStatus: true, tradingPermission: true, status: true },
  });
  if (!prev) return res.status(404).json({ error: 'User not found' });

  const data: Prisma.UserUpdateInput = {};
  if (parsed.data.liveTradingEnabled !== undefined) data.liveTradingEnabled = parsed.data.liveTradingEnabled;
  if (parsed.data.tradingStatus) data.tradingStatus = parsed.data.tradingStatus;
  if (parsed.data.tradingPermission) data.tradingPermission = parsed.data.tradingPermission;
  if (parsed.data.accountStatus) data.status = parsed.data.accountStatus;

  const updated = await prisma.user.update({ where: { id: req.params.id }, data });
  await audit({
    actorId: req.user!.id,
    action: 'user.trading_access',
    target: req.params.id,
    meta: {
      prev: { liveTradingEnabled: prev.liveTradingEnabled, tradingStatus: prev.tradingStatus, tradingPermission: prev.tradingPermission, accountStatus: prev.status },
      next: { liveTradingEnabled: updated.liveTradingEnabled, tradingStatus: updated.tradingStatus, tradingPermission: updated.tradingPermission, accountStatus: updated.status },
    },
    ip: req.ip,
  });
  await prisma.notification
    .create({
      data: {
        userId: req.params.id,
        title: updated.liveTradingEnabled ? 'Live trading enabled' : 'Live trading access updated',
        body: updated.liveTradingEnabled
          ? 'An administrator has enabled Live Trading on your account. You can now open live positions.'
          : 'Your live trading access was updated by an administrator.',
        type: updated.liveTradingEnabled ? 'SUCCESS' : 'INFO',
      },
    })
    .catch(() => {});
  publishBalance(req.params.id, 'trading.access', 'LIVE');
  res.json({
    ok: true,
    user: {
      id: updated.id,
      liveTradingEnabled: updated.liveTradingEnabled,
      tradingStatus: updated.tradingStatus,
      tradingPermission: updated.tradingPermission,
      accountStatus: updated.status,
    },
  });
});

// POST /api/admin/users/:id/reset-password — set a new password without the old
// one. Invalidates all of the user's sessions and records an audit entry.
router.post('/users/:id/reset-password', requirePermission('users.manage'), async (req, res) => {
  const parsed = z.object({ newPassword: z.string().min(8, 'Password must be at least 8 characters') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, email: true, fullName: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  await prisma.user.update({
    where: { id: req.params.id },
    data: { passwordHash: await hashPassword(parsed.data.newPassword), tokenVersion: { increment: 1 } },
  });
  await prisma.notification
    .create({ data: { userId: req.params.id, title: 'Your password was reset', body: 'An administrator reset your password. Please sign in again with the new password.', type: 'WARNING' } })
    .catch(() => {});
  await audit({
    actorId: req.user!.id,
    action: 'user.password_reset',
    target: req.params.id,
    meta: { adminEmail: req.user!.email, clientEmail: target.email, clientName: target.fullName },
    ip: req.ip,
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Admin trading controls (item 20)
// ---------------------------------------------------------------------------

// GET /api/admin/users/:id/positions — a user's open positions + working orders.
router.get('/users/:id/positions', requirePermission('users.view'), async (req, res) => {
  const [positions, orders] = await Promise.all([
    prisma.order.findMany({ where: { userId: req.params.id, status: 'FILLED', closedAt: null }, orderBy: { createdAt: 'desc' } }),
    prisma.order.findMany({ where: { userId: req.params.id, status: 'OPEN' }, orderBy: { createdAt: 'desc' } }),
  ]);
  res.json({ positions, orders });
});

// POST /api/admin/positions/:orderId/force-close — close a user's open position.
router.post('/positions/:orderId/force-close', requirePermission('users.manage'), async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order) return res.status(404).json({ error: 'Position not found' });
  if (order.status !== 'FILLED' || order.closedAt) return res.status(409).json({ error: 'Position is not open' });

  const live = await getPrice(order.symbol).catch(() => null);
  const closePrice = live ?? parseFloat(order.price.toString());
  const pnl = round8(floatingPnl(order.side, order.price, order.amount, closePrice));
  await prisma.$transaction([
    prisma.order.update({ where: { id: order.id }, data: { status: 'CLOSED', closePrice, realizedPnl: pnl, closeReason: 'LIQUIDATION', closedAt: new Date() } }),
    prisma.wallet.upsert({
      where: { userId_asset_mode: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode } },
      create: { userId: order.userId, asset: ACCOUNT_CURRENCY, mode: order.mode, balance: pnl },
      update: { balance: { increment: pnl } },
    }),
  ]);
  await prisma.notification.create({ data: { userId: order.userId, title: 'Position force-closed', body: `An administrator closed your ${order.side} ${order.symbol} position at ${closePrice} (P/L ${pnl.toFixed(2)} ${ACCOUNT_CURRENCY}).`, type: 'WARNING' } }).catch(() => {});
  await audit({ actorId: req.user!.id, action: 'position.force_close', target: order.id, meta: { pnl, closePrice, userId: order.userId }, ip: req.ip });
  publishBalance(order.userId, 'position.force_close', order.mode);
  res.json({ ok: true, realizedPnl: pnl });
});

// PATCH /api/admin/positions/:orderId/leverage — adjust an open position's
// leverage (recomputes reserved margin).
router.patch('/positions/:orderId/leverage', requirePermission('users.manage'), async (req, res) => {
  const parsed = z.object({ leverage: z.number().int().min(1).max(125) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid leverage' });
  const order = await prisma.order.findUnique({ where: { id: req.params.orderId } });
  if (!order || order.status !== 'FILLED' || order.closedAt) return res.status(404).json({ error: 'Open position not found' });
  const notional = parseFloat(order.price.toString()) * parseFloat(order.amount.toString());
  const newMargin = round8(notional / parsed.data.leverage);
  const updated = await prisma.order.update({ where: { id: order.id }, data: { leverage: parsed.data.leverage, margin: newMargin } });
  await audit({ actorId: req.user!.id, action: 'position.adjust_leverage', target: order.id, meta: { from: order.leverage, to: parsed.data.leverage }, ip: req.ip });
  publishBalance(order.userId, 'position.adjust_leverage', order.mode);
  res.json({ ok: true, order: updated });
});

// POST /api/admin/users/:id/adjust-balance — signed balance adjustment
// (credit or debit) with an audited previous → new record.
router.post('/users/:id/adjust-balance', requirePermission('balances.manage'), async (req, res) => {
  const parsed = z.object({ asset: z.string().min(2).default('USDT'), amount: z.number(), mode: z.enum(['DEMO', 'LIVE']).default('LIVE'), reason: z.string().max(200).optional() }).safeParse(req.body);
  if (!parsed.success || parsed.data.amount === 0) return res.status(400).json({ error: 'Enter a non-zero amount' });
  const { asset, amount, mode, reason } = parsed.data;

  try {
    const wallet = await prisma.$transaction(async (tx) => {
      const existing = await tx.wallet.findUnique({ where: { userId_asset_mode: { userId: req.params.id, asset, mode } } });
      const prev = existing ? parseFloat(existing.balance.toString()) : 0;
      if (prev + amount < -1e-8) throw Object.assign(new Error('Adjustment would make the balance negative.'), { code: 'NEG' });
      const w = await tx.wallet.upsert({
        where: { userId_asset_mode: { userId: req.params.id, asset, mode } },
        create: { userId: req.params.id, asset, mode, balance: amount },
        update: { balance: { increment: amount } },
      });
      await tx.transaction.create({
        data: { userId: req.params.id, mode, type: amount >= 0 ? 'DEPOSIT' : 'WITHDRAWAL', asset, amount: Math.abs(amount), status: 'COMPLETED', reference: `ADJ-${Date.now()}`, note: `Admin adjustment by ${req.user!.email}: ${prev} → ${prev + amount} ${asset}${reason ? ` (${reason})` : ''}`, reviewedById: req.user!.id, reviewedAt: new Date() },
      });
      return w;
    });
    await audit({ actorId: req.user!.id, action: 'balance.adjust', target: req.params.id, meta: { asset, amount, mode }, ip: req.ip });
    publishBalance(req.params.id, 'balance.adjust', mode);
    res.json({ ok: true, wallet });
  } catch (e) {
    if (e && (e as { code?: string }).code === 'NEG') return res.status(400).json({ error: (e as Error).message });
    throw e;
  }
});

// POST /api/admin/transfer — move funds between two users' wallets.
router.post('/transfer', requirePermission('balances.manage'), async (req, res) => {
  const parsed = z.object({ fromId: z.string().min(1), toId: z.string().min(1), asset: z.string().min(2).default('USDT'), amount: z.number().positive(), mode: z.enum(['DEMO', 'LIVE']).default('LIVE') }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid transfer' });
  const { fromId, toId, asset, amount, mode } = parsed.data;
  if (fromId === toId) return res.status(400).json({ error: 'Cannot transfer to the same account' });

  try {
    await prisma.$transaction(async (tx) => {
      const from = await tx.wallet.findUnique({ where: { userId_asset_mode: { userId: fromId, asset, mode } } });
      if (!from || parseFloat(from.balance.toString()) < amount) throw Object.assign(new Error('Sender has insufficient balance.'), { code: 'FUNDS' });
      await tx.wallet.update({ where: { userId_asset_mode: { userId: fromId, asset, mode } }, data: { balance: { decrement: amount } } });
      await tx.wallet.upsert({ where: { userId_asset_mode: { userId: toId, asset, mode } }, create: { userId: toId, asset, mode, balance: amount }, update: { balance: { increment: amount } } });
      await tx.transaction.createMany({
        data: [
          { userId: fromId, mode, type: 'TRANSFER', asset, amount, status: 'COMPLETED', reference: `TRF-${Date.now()}`, note: `Admin transfer to ${toId}` },
          { userId: toId, mode, type: 'TRANSFER', asset, amount, status: 'COMPLETED', reference: `TRF-${Date.now()}`, note: `Admin transfer from ${fromId}` },
        ],
      });
    });
    await audit({ actorId: req.user!.id, action: 'balance.transfer', target: toId, meta: { fromId, toId, asset, amount, mode }, ip: req.ip });
    publishBalance(fromId, 'transfer', mode);
    publishBalance(toId, 'transfer', mode);
    res.json({ ok: true });
  } catch (e) {
    if (e && (e as { code?: string }).code === 'FUNDS') return res.status(400).json({ error: (e as Error).message });
    throw e;
  }
});

// GET /api/admin/monitoring — live platform tiles.
router.get('/monitoring', requirePermission('users.view'), async (_req, res) => {
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [activeUsers, openPositions, dayTrades, deposits, withdrawals] = await Promise.all([
    prisma.user.count({ where: { lastLoginAt: { gte: dayAgo } } }),
    prisma.order.count({ where: { status: 'FILLED', closedAt: null } }),
    prisma.order.findMany({ where: { status: 'CLOSED', closedAt: { gte: dayAgo } }, select: { price: true, amount: true, realizedPnl: true } }),
    prisma.transaction.aggregate({ where: { type: 'DEPOSIT', status: 'COMPLETED' }, _sum: { amount: true } }),
    prisma.transaction.aggregate({ where: { type: 'WITHDRAWAL', status: 'COMPLETED' }, _sum: { amount: true } }),
  ]);
  const dailyVolume = dayTrades.reduce((s, o) => s + parseFloat(o.price.toString()) * parseFloat(o.amount.toString()), 0);
  // "Revenue" proxy: notional volume × a nominal 0.04% taker fee.
  const revenue = dailyVolume * 0.0004;
  res.json({
    activeUsers,
    openPositions,
    dailyVolume,
    revenue,
    totalDeposits: deposits._sum.amount ? parseFloat(deposits._sum.amount.toString()) : 0,
    totalWithdrawals: withdrawals._sum.amount ? parseFloat(withdrawals._sum.amount.toString()) : 0,
  });
});

const assignSchema = z.object({ roleKey: z.string().min(1) });

// POST /api/admin/users/:id/roles  — assign an (admin) role to a registered user
router.post('/users/:id/roles', requirePermission('roles.assign'), async (req, res) => {
  const parsed = assignSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'roleKey is required' });

  const [user, role] = await Promise.all([
    prisma.user.findUnique({ where: { id: req.params.id } }),
    prisma.role.findUnique({ where: { key: parsed.data.roleKey } }),
  ]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!role) return res.status(404).json({ error: 'Role not found' });

  // Only a Super Admin may grant or revoke the Super Admin role.
  if (role.key === 'SUPER_ADMIN' && !req.user!.isSuperAdmin) {
    return res.status(403).json({ error: 'Only a Super Admin can assign Super Admin' });
  }

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId: user.id, roleId: role.id } },
    create: { userId: user.id, roleId: role.id, assignedById: req.user!.id },
    update: { assignedById: req.user!.id },
  });

  await audit({
    actorId: req.user!.id,
    action: 'role.assign',
    target: user.id,
    meta: { roleKey: role.key },
    ip: req.ip,
  });

  res.json({ ok: true, message: `${role.name} assigned to ${user.fullName}` });
});

// DELETE /api/admin/users/:id/roles/:roleKey — revoke a role
router.delete('/users/:id/roles/:roleKey', requirePermission('roles.assign'), async (req, res) => {
  const role = await prisma.role.findUnique({ where: { key: req.params.roleKey } });
  if (!role) return res.status(404).json({ error: 'Role not found' });
  if (role.key === 'SUPER_ADMIN' && !req.user!.isSuperAdmin) {
    return res.status(403).json({ error: 'Only a Super Admin can revoke Super Admin' });
  }

  await prisma.userRole.deleteMany({ where: { userId: req.params.id, roleId: role.id } });
  await audit({
    actorId: req.user!.id,
    action: 'role.revoke',
    target: req.params.id,
    meta: { roleKey: role.key },
    ip: req.ip,
  });
  res.json({ ok: true });
});

// PATCH /api/admin/users/:id/status — suspend / activate
const statusSchema = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED', 'PENDING']) });
router.patch('/users/:id/status', requirePermission('users.manage'), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: { status: parsed.data.status },
  });
  await audit({
    actorId: req.user!.id,
    action: 'user.status',
    target: user.id,
    meta: { status: parsed.data.status },
    ip: req.ip,
  });
  res.json({ ok: true });
});

// DELETE /api/admin/users/:id — permanently remove a user
router.delete('/users/:id', requirePermission('users.manage'), async (req, res) => {
  if (req.params.id === req.user!.id) return res.status(400).json({ error: 'You cannot delete your own account' });
  const target = await prisma.user.findUnique({
    where: { id: req.params.id },
    include: { roles: { include: { role: true } } },
  });
  if (!target) return res.status(404).json({ error: 'User not found' });
  const isSuper = target.roles.some((r) => r.role.key === 'SUPER_ADMIN');
  if (isSuper && !req.user!.isSuperAdmin) {
    return res.status(403).json({ error: 'Only a Super Admin can delete a Super Admin' });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await audit({ actorId: req.user!.id, action: 'user.delete', target: req.params.id, meta: { email: target.email }, ip: req.ip });
  res.json({ ok: true });
});

// POST /api/admin/users/:id/credit — add funds to a user's Demo OR Live wallet
router.post('/users/:id/credit', requirePermission('balances.manage'), async (req, res) => {
  const parsed = z
    .object({ asset: z.string().min(2).default('USDT'), amount: z.number().positive(), mode: z.enum(['DEMO', 'LIVE']).default('DEMO') })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid amount' });
  const { asset, amount, mode } = parsed.data;

  const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } });
  if (!target) return res.status(404).json({ error: 'User not found' });

  // Atomic credit: read the previous balance, apply the increment, and log a
  // completed deposit that records prev → new balance — a single source of
  // truth with a full audit trail, for both Demo and Live accounts.
  const { wallet } = await prisma.$transaction(async (tx) => {
    const existing = await tx.wallet.findUnique({
      where: { userId_asset_mode: { userId: req.params.id, asset, mode } },
    });
    const prevBalance = existing ? parseFloat(existing.balance.toString()) : 0;
    const wallet = await tx.wallet.upsert({
      where: { userId_asset_mode: { userId: req.params.id, asset, mode } },
      create: { userId: req.params.id, asset, mode, balance: amount },
      update: { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        userId: req.params.id,
        mode,
        type: 'DEPOSIT',
        asset,
        amount,
        status: 'COMPLETED',
        reference: `AD-${Date.now()}`,
        note: `Admin credit by ${req.user!.email} · balance ${prevBalance} → ${prevBalance + amount} ${asset}`,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
      },
    });
    return { wallet, prevBalance };
  });

  await prisma.notification.create({
    data: { userId: req.params.id, title: `${mode === 'LIVE' ? 'Live' : 'Demo'} balance credited`, body: `${amount} ${asset} was added to your ${mode.toLowerCase()} account by an administrator.`, type: 'SUCCESS' },
  });
  await audit({ actorId: req.user!.id, action: 'balance.credit', target: req.params.id, meta: { asset, amount, mode }, ip: req.ip });
  // Push the update so the client's dashboard, wallet and trading account
  // reflect the new balance instantly — no refresh required.
  publishBalance(req.params.id, 'admin.credit', mode);
  res.json({ ok: true, wallet });
});

// ---------------------------------------------------------------------------
// Withdrawals — the "Withdrawal Approval Admin" workflow
// ---------------------------------------------------------------------------
// When a withdrawal is created the amount is moved from the user's balance to
// `locked` (reserved). These helpers unwind that reservation:
//   • refund   — rejection/failure: locked → balance (funds returned).
//   • clear    — completion: locked -= amount (funds have left the account).
type WithdrawalTxn = { userId: string; asset: string; mode: 'DEMO' | 'LIVE'; amount: Prisma.Decimal };
function refundReservation(txn: WithdrawalTxn) {
  return prisma.wallet.update({
    where: { userId_asset_mode: { userId: txn.userId, asset: txn.asset, mode: txn.mode } },
    data: { balance: { increment: txn.amount }, locked: { decrement: txn.amount } },
  });
}
function clearReservation(txn: WithdrawalTxn) {
  return prisma.wallet.update({
    where: { userId_asset_mode: { userId: txn.userId, asset: txn.asset, mode: txn.mode } },
    data: { locked: { decrement: txn.amount } },
  });
}

router.get('/withdrawals', requirePermission('withdrawals.view'), async (req, res) => {
  const status = (req.query.status as string) || 'PENDING';
  const txns = await prisma.transaction.findMany({
    where: { type: 'WITHDRAWAL', ...(status === 'ALL' ? {} : { status: status as never }) },
    orderBy: { createdAt: 'desc' },
    take: 150,
    include: { user: { select: { email: true, fullName: true } } },
  });
  res.json(txns);
});

const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) });
router.post('/withdrawals/:id/review', requirePermission('withdrawals.approve'), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid decision' });

  const txn = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!txn || txn.type !== 'WITHDRAWAL') return res.status(404).json({ error: 'Withdrawal not found' });
  if (txn.status !== 'PENDING') return res.status(409).json({ error: 'Already reviewed' });

  // Rejecting returns the reserved funds to the user's available balance.
  // Approving keeps them reserved (they leave the account on completion).
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.transaction.update({
      where: { id: txn.id },
      data: { status: parsed.data.decision, reviewedById: req.user!.id, reviewedAt: new Date() },
    }),
  ];
  if (parsed.data.decision === 'REJECTED') {
    ops.push(refundReservation(txn));
  }
  const [updated] = await prisma.$transaction(ops);

  await audit({
    actorId: req.user!.id,
    action: `withdrawal.${parsed.data.decision.toLowerCase()}`,
    target: txn.id,
    meta: { amount: txn.amount.toString(), asset: txn.asset },
    ip: req.ip,
  });
  publishBalance(txn.userId, `withdrawal.${parsed.data.decision.toLowerCase()}`, txn.mode);

  res.json({ ok: true, transaction: updated });
});

// Full status-flow control: Pending → Under Review → Approved → Processing →
// Completed (or Rejected), with an optional internal note.
const statusFlowSchema = z.object({
  status: z.enum(['PENDING', 'UNDER_REVIEW', 'APPROVED', 'PROCESSING', 'COMPLETED', 'REJECTED']),
  note: z.string().max(500).optional(),
});
const USER_MSG: Record<string, { title: string; type: 'INFO' | 'SUCCESS' | 'WARNING' }> = {
  UNDER_REVIEW: { title: 'Withdrawal under review', type: 'INFO' },
  APPROVED: { title: 'Withdrawal approved', type: 'SUCCESS' },
  PROCESSING: { title: 'Withdrawal processing', type: 'INFO' },
  COMPLETED: { title: 'Withdrawal completed', type: 'SUCCESS' },
  REJECTED: { title: 'Withdrawal rejected', type: 'WARNING' },
};

router.post('/withdrawals/:id/status', requirePermission('withdrawals.approve'), async (req, res) => {
  const parsed = statusFlowSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid status' });

  const txn = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!txn || txn.type !== 'WITHDRAWAL') return res.status(404).json({ error: 'Withdrawal not found' });

  // Terminal states are final — once funds have been returned (REJECTED) or
  // have left the account (COMPLETED) the reservation accounting is settled and
  // must not be replayed by a further transition.
  const wasTerminal = txn.status === 'COMPLETED' || txn.status === 'REJECTED';
  if (wasTerminal && parsed.data.status !== txn.status) {
    return res.status(409).json({ error: `This withdrawal is already ${txn.status.toLowerCase()} and cannot be changed.` });
  }

  // On completion, generate a simulated (demo) transaction reference.
  const genRef = parsed.data.status === 'COMPLETED' && !txn.reference?.startsWith('0xDEMO');
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.transaction.update({
      where: { id: txn.id },
      data: {
        status: parsed.data.status,
        note: parsed.data.note ?? txn.note,
        reviewedById: req.user!.id,
        reviewedAt: new Date(),
        ...(genRef ? { reference: `0xDEMO${Math.random().toString(16).slice(2, 14)}` } : {}),
      },
    }),
  ];
  // Settle the reservation only on the first transition into a terminal state.
  if (!wasTerminal && parsed.data.status === 'REJECTED') ops.push(refundReservation(txn));
  if (!wasTerminal && parsed.data.status === 'COMPLETED') ops.push(clearReservation(txn));
  const [updated] = await prisma.$transaction(ops);

  const msg = USER_MSG[parsed.data.status];
  if (msg) {
    await prisma.notification.create({
      data: { userId: txn.userId, title: msg.title, body: `Your ${txn.amount} ${txn.asset} withdrawal is now ${parsed.data.status.replace('_', ' ').toLowerCase()}.`, type: msg.type },
    });
  }
  await audit({ actorId: req.user!.id, action: `withdrawal.${parsed.data.status.toLowerCase()}`, target: txn.id, meta: { status: parsed.data.status }, ip: req.ip });
  publishBalance(txn.userId, `withdrawal.${parsed.data.status.toLowerCase()}`, txn.mode);
  res.json({ ok: true, transaction: updated });
});

// ---------------------------------------------------------------------------
// Deposits (Finance Admin)
// ---------------------------------------------------------------------------
router.get('/deposits', requirePermission('deposits.view'), async (_req, res) => {
  const deposits = await prisma.transaction.findMany({
    where: { type: 'DEPOSIT' },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: { user: { select: { email: true, fullName: true } } },
  });
  res.json(deposits);
});

// POST /api/admin/deposits/:id/review — approve/reject a pending deposit request.
// Approving credits the user's wallet (in the deposit's mode).
router.post('/deposits/:id/review', requirePermission('deposits.manage'), async (req, res) => {
  const parsed = z.object({ decision: z.enum(['APPROVED', 'REJECTED']) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid decision' });

  const txn = await prisma.transaction.findUnique({ where: { id: req.params.id } });
  if (!txn || txn.type !== 'DEPOSIT') return res.status(404).json({ error: 'Deposit not found' });
  if (txn.status !== 'PENDING') return res.status(409).json({ error: 'Already reviewed' });

  if (parsed.data.decision === 'APPROVED') {
    await prisma.$transaction([
      prisma.transaction.update({ where: { id: txn.id }, data: { status: 'COMPLETED', reviewedById: req.user!.id, reviewedAt: new Date() } }),
      prisma.wallet.upsert({
        where: { userId_asset_mode: { userId: txn.userId, asset: txn.asset, mode: txn.mode } },
        create: { userId: txn.userId, asset: txn.asset, mode: txn.mode, balance: txn.amount },
        update: { balance: { increment: txn.amount } },
      }),
      prisma.notification.create({ data: { userId: txn.userId, title: 'Deposit approved', body: `Your ${txn.amount} ${txn.asset} deposit was approved and credited.`, type: 'SUCCESS' } }),
    ]);
  } else {
    await prisma.transaction.update({ where: { id: txn.id }, data: { status: 'REJECTED', reviewedById: req.user!.id, reviewedAt: new Date() } });
    await prisma.notification.create({ data: { userId: txn.userId, title: 'Deposit rejected', body: `Your ${txn.amount} ${txn.asset} deposit request was rejected.`, type: 'WARNING' } });
  }
  await audit({ actorId: req.user!.id, action: `deposit.${parsed.data.decision.toLowerCase()}`, target: txn.id, ip: req.ip });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Announcements / News CMS (Content Admin)
// ---------------------------------------------------------------------------
router.get('/announcements', requirePermission('content.manage'), async (_req, res) => {
  const items = await prisma.announcement.findMany({ orderBy: { createdAt: 'desc' } });
  res.json(items);
});

const announcementSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(3),
  category: z.enum(['UPDATE', 'MARKET', 'SECURITY', 'PROMOTION']).default('UPDATE'),
  published: z.boolean().default(true),
});

router.post('/announcements', requirePermission('content.manage'), async (req, res) => {
  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const item = await prisma.announcement.create({
    data: { ...parsed.data, authorId: req.user!.id },
  });
  await audit({ actorId: req.user!.id, action: 'announcement.create', target: item.id, ip: req.ip });
  res.status(201).json(item);
});

router.delete('/announcements/:id', requirePermission('content.manage'), async (req, res) => {
  await prisma.announcement.delete({ where: { id: req.params.id } }).catch(() => null);
  await audit({ actorId: req.user!.id, action: 'announcement.delete', target: req.params.id, ip: req.ip });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// KYC review
// ---------------------------------------------------------------------------
router.get('/kyc', requirePermission('kyc.view'), async (_req, res) => {
  const pending = await prisma.user.findMany({
    where: { kycStatus: 'PENDING' },
    select: {
      id: true, email: true, fullName: true, createdAt: true,
      kycSubmissions: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
  });
  res.json(
    pending.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      createdAt: u.createdAt,
      submission: u.kycSubmissions[0] ?? null,
    })),
  );
});

router.post('/kyc/:id/review', requirePermission('kyc.approve'), async (req, res) => {
  const parsed = reviewSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid decision' });
  await prisma.user.update({
    where: { id: req.params.id },
    data: { kycStatus: parsed.data.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' },
  });
  await audit({
    actorId: req.user!.id,
    action: `kyc.${parsed.data.decision.toLowerCase()}`,
    target: req.params.id,
    ip: req.ip,
  });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Deposit wallet-address management
// ---------------------------------------------------------------------------
router.get('/wallet-addresses', requirePermission('wallets.manage'), async (_req, res) => {
  const addrs = await prisma.walletAddress.findMany({ orderBy: [{ asset: 'asc' }, { network: 'asc' }] });
  res.json(addrs);
});

const walletAddrSchema = z.object({
  asset: z.string().min(2),
  network: z.string().min(2),
  address: z.string().min(6),
  minDeposit: z.string().optional(),
  confirmations: z.number().int().min(0).optional(),
  instructions: z.string().optional(),
  isDefault: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

router.post('/wallet-addresses', requirePermission('wallets.manage'), async (req, res) => {
  const parsed = walletAddrSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  try {
    const addr = await prisma.walletAddress.create({ data: parsed.data });
    await audit({ actorId: req.user!.id, action: 'walletaddr.create', target: addr.id, meta: { asset: addr.asset, network: addr.network }, ip: req.ip });
    res.status(201).json(addr);
  } catch {
    res.status(409).json({ error: 'An address for this asset + network already exists' });
  }
});

router.patch('/wallet-addresses/:id', requirePermission('wallets.manage'), async (req, res) => {
  const parsed = walletAddrSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid update' });
  const addr = await prisma.walletAddress.update({ where: { id: req.params.id }, data: parsed.data });
  await audit({ actorId: req.user!.id, action: 'walletaddr.update', target: addr.id, ip: req.ip });
  res.json(addr);
});

router.delete('/wallet-addresses/:id', requirePermission('wallets.manage'), async (req, res) => {
  await prisma.walletAddress.delete({ where: { id: req.params.id } }).catch(() => null);
  await audit({ actorId: req.user!.id, action: 'walletaddr.delete', target: req.params.id, ip: req.ip });
  res.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Manual balance management (credit / debit / freeze / unfreeze / reset)
// ---------------------------------------------------------------------------
router.get('/users/:id/wallets', requirePermission('balances.manage', 'users.view'), async (req, res) => {
  const wallets = await prisma.wallet.findMany({
    where: { userId: req.params.id },
    orderBy: [{ mode: 'asc' }, { asset: 'asc' }],
  });
  res.json(wallets);
});

const balanceSchema = z.object({
  asset: z.string().min(2),
  mode: z.enum(['DEMO', 'LIVE']),
  action: z.enum(['CREDIT', 'DEBIT', 'FREEZE', 'UNFREEZE', 'RESET']),
  amount: z.number().nonnegative().optional(),
});

router.post('/users/:id/balance', requirePermission('balances.manage'), async (req, res) => {
  const parsed = balanceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });
  const { asset, mode, action, amount } = parsed.data;

  const where = { userId_asset_mode: { userId: req.params.id, asset, mode } };
  let data: Record<string, unknown> = {};
  switch (action) {
    case 'CREDIT':
      data = { balance: { increment: amount ?? 0 } };
      break;
    case 'DEBIT':
      data = { balance: { decrement: amount ?? 0 } };
      break;
    case 'FREEZE':
      data = { frozen: true };
      break;
    case 'UNFREEZE':
      data = { frozen: false };
      break;
    case 'RESET':
      data = { balance: 0, locked: 0, frozen: false };
      break;
  }

  const wallet = await prisma.wallet.upsert({
    where,
    create: { userId: req.params.id, asset, mode, balance: action === 'CREDIT' ? amount ?? 0 : 0 },
    update: data,
  });

  await audit({
    actorId: req.user!.id,
    action: `balance.${action.toLowerCase()}`,
    target: req.params.id,
    meta: { asset, mode, amount },
    ip: req.ip,
  });
  res.json(wallet);
});

// ---------------------------------------------------------------------------
// Platform settings + feature flags
// ---------------------------------------------------------------------------
const DEFAULT_FLAGS = [
  { key: 'copy_trading', label: 'Copy Trading', description: 'Enable the copy-trading module.' },
  { key: 'ai_assistant', label: 'AI Assistant', description: 'Enable the AI trading assistant.' },
  { key: 'futures', label: 'Futures Trading', description: 'Allow leveraged futures trading.' },
  { key: 'live_trading', label: 'Live Trading (activation)', description: 'Activate order placement in Live mode for funded live accounts.' },
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform into maintenance.' },
  { key: 'new_signups', label: 'New Signups', description: 'Allow new user registrations.' },
];

router.get('/settings', requirePermission('system.settings'), async (_req, res) => {
  // Ensure default flags exist, then return current state.
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: { ...f, enabled: !['maintenance_mode', 'live_trading'].includes(f.key) },
      update: { label: f.label, description: f.description },
    });
  }
  const [flags, settings] = await Promise.all([
    prisma.featureFlag.findMany({ orderBy: { label: 'asc' } }),
    prisma.platformSetting.findMany(),
  ]);
  res.json({ flags, settings });
});

router.patch('/settings/flags/:key', requirePermission('system.settings'), async (req, res) => {
  const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'enabled is required' });
  const flag = await prisma.featureFlag.update({ where: { key: req.params.key }, data: { enabled: parsed.data.enabled } });
  await audit({ actorId: req.user!.id, action: 'flag.toggle', target: req.params.key, meta: { enabled: parsed.data.enabled }, ip: req.ip });
  res.json(flag);
});

router.put('/settings/:key', requirePermission('system.settings'), async (req, res) => {
  const parsed = z.object({ value: z.string() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'value is required' });
  const setting = await prisma.platformSetting.upsert({
    where: { key: req.params.key },
    create: { key: req.params.key, value: parsed.data.value },
    update: { value: parsed.data.value },
  });
  await audit({ actorId: req.user!.id, action: 'setting.update', target: req.params.key, ip: req.ip });
  res.json(setting);
});

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
router.get('/audit', requirePermission('system.audit'), async (_req, res) => {
  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: { actor: { select: { email: true, fullName: true } } },
  });
  res.json(logs);
});

export default router;

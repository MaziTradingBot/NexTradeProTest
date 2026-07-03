import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { audit } from '../lib/audit';

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
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      roles: u.roles.map((r) => ({ key: r.role.key, name: r.role.name, isAdmin: r.role.isAdmin })),
    })),
  );
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

// ---------------------------------------------------------------------------
// Withdrawals — the "Withdrawal Approval Admin" workflow
// ---------------------------------------------------------------------------
router.get('/withdrawals', requirePermission('withdrawals.view'), async (req, res) => {
  const status = (req.query.status as string) || 'PENDING';
  const txns = await prisma.transaction.findMany({
    where: { type: 'WITHDRAWAL', status: status as never },
    orderBy: { createdAt: 'desc' },
    take: 100,
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

  const updated = await prisma.transaction.update({
    where: { id: txn.id },
    data: {
      status: parsed.data.decision,
      reviewedById: req.user!.id,
      reviewedAt: new Date(),
    },
  });

  await audit({
    actorId: req.user!.id,
    action: `withdrawal.${parsed.data.decision.toLowerCase()}`,
    target: txn.id,
    meta: { amount: txn.amount.toString(), asset: txn.asset },
    ip: req.ip,
  });

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
    select: { id: true, email: true, fullName: true, createdAt: true },
  });
  res.json(pending);
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
  { key: 'maintenance_mode', label: 'Maintenance Mode', description: 'Put the platform into maintenance.' },
  { key: 'new_signups', label: 'New Signups', description: 'Allow new user registrations.' },
];

router.get('/settings', requirePermission('system.settings'), async (_req, res) => {
  // Ensure default flags exist, then return current state.
  for (const f of DEFAULT_FLAGS) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      create: { ...f, enabled: f.key !== 'maintenance_mode' },
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

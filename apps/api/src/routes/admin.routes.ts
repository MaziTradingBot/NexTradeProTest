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

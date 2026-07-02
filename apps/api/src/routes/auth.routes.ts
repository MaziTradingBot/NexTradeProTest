import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../lib/auth';
import { authenticate } from '../middleware/auth';
import { audit } from '../lib/audit';
import { env } from '../config/env';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  fullName: z.string().min(2),
  referral: z.string().optional(),
});

function genReferralCode(): string {
  return `NXP${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function setAuthCookies(res: import('express').Response, access: string, refresh: string) {
  const common = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? ('none' as const) : ('lax' as const),
    domain: env.cookieDomain,
  };
  res.cookie('nxp_access', access, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie('nxp_refresh', refresh, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.errors[0].message });
  }
  const { email, password, fullName, referral } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: 'Email already registered' });

  const userRole = await prisma.role.findUnique({ where: { key: 'USER' } });
  const referrer = referral
    ? await prisma.user.findUnique({ where: { referralCode: referral } })
    : null;

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await hashPassword(password),
      fullName,
      referralCode: genReferralCode(),
      referredById: referrer?.id,
      roles: userRole ? { create: { roleId: userRole.id } } : undefined,
      notifications: {
        create: [
          { title: 'Welcome to NexTradePro 🎉', body: 'Your demo account is ready. Explore the trading terminal and AI assistant.', type: 'SUCCESS' },
          { title: 'Complete your profile', body: 'Verify your identity (KYC) and enable 2FA to secure your account.', type: 'INFO' },
        ],
      },
      wallets: {
        create: [
          { asset: 'USDT', balance: 25000 },
          { asset: 'BTC', balance: 0.35 },
          { asset: 'ETH', balance: 4 },
        ],
      },
    },
  });

  await audit({ actorId: user.id, action: 'auth.register', target: user.id, ip: req.ip });

  const payload = { sub: user.id, email: user.email };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);

  return res.status(201).json({
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken: access,
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account suspended' });
  }

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: 'auth.login', target: user.id, ip: req.ip });

  const payload = { sub: user.id, email: user.email };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken: access,
  });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.nxp_refresh || req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const payload = verifyRefreshToken(token);
    const access = signAccessToken({ sub: payload.sub, email: payload.email });
    const refresh = signRefreshToken({ sub: payload.sub, email: payload.email });
    setAuthCookies(res, access, refresh);
    return res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('nxp_access');
  res.clearCookie('nxp_refresh');
  return res.json({ ok: true });
});

// GET /api/auth/me
router.get('/me', authenticate, async (req, res) => {
  const u = req.user!;
  const profile = await prisma.user.findUnique({
    where: { id: u.id },
    select: { kycStatus: true, twoFactor: true },
  });
  return res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    roles: u.roles,
    permissions: Array.from(u.permissions),
    isSuperAdmin: u.isSuperAdmin,
    isAdmin: u.isSuperAdmin || u.roles.some((r) => r.isAdmin),
    kycStatus: profile?.kycStatus ?? 'NONE',
    twoFactor: profile?.twoFactor ?? false,
  });
});

export default router;

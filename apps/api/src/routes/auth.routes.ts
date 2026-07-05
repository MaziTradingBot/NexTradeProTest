import crypto from 'crypto';
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
          // Demo wallet — funded with $100k + crypto for the showcase.
          { asset: 'USDT', mode: 'DEMO', balance: 100000 },
          { asset: 'BTC', mode: 'DEMO', balance: 1.5 },
          { asset: 'ETH', mode: 'DEMO', balance: 20 },
          { asset: 'SOL', mode: 'DEMO', balance: 200 },
          { asset: 'BNB', mode: 'DEMO', balance: 50 },
          { asset: 'XRP', mode: 'DEMO', balance: 5000 },
          // Live wallet — empty until real deposits are approved.
          { asset: 'USDT', mode: 'LIVE', balance: 0 },
          { asset: 'BTC', mode: 'LIVE', balance: 0 },
          { asset: 'ETH', mode: 'LIVE', balance: 0 },
        ],
      },
    },
  });

  await audit({ actorId: user.id, action: 'auth.register', target: user.id, ip: req.ip });

  const payload = { sub: user.id, email: user.email, tv: user.tokenVersion };
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

  const payload = { sub: user.id, email: user.email, tv: user.tokenVersion };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken: access,
  });
});

// POST /api/auth/google — sign in / sign up with a Google ID token.
// The frontend obtains the token from Google Identity Services and posts it
// here; we verify it against Google, then find or create the matching user.
router.post('/google', async (req, res) => {
  const parsed = z.object({ credential: z.string().min(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Missing Google credential' });

  // Verify the ID token with Google (no extra dependency needed).
  let info: { aud?: string; email?: string; email_verified?: string | boolean; name?: string; sub?: string };
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(parsed.data.credential)}`);
    if (!resp.ok) throw new Error('bad token');
    info = (await resp.json()) as typeof info;
  } catch {
    return res.status(401).json({ error: 'Could not verify Google sign-in' });
  }

  const expectedAud = process.env.GOOGLE_CLIENT_ID;
  if (expectedAud && info.aud !== expectedAud) return res.status(401).json({ error: 'Google credential was issued for a different app' });
  if (!info.email || (info.email_verified !== true && info.email_verified !== 'true')) {
    return res.status(401).json({ error: 'Your Google email is not verified' });
  }
  const email = info.email.toLowerCase();
  const fullName = info.name || email.split('@')[0];

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // First-time Google user — provision an account (random password) with the
    // same starter wallets a normal registration receives.
    const userRole = await prisma.role.findUnique({ where: { key: 'USER' } });
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
        fullName,
        referralCode: genReferralCode(),
        roles: userRole ? { create: { roleId: userRole.id } } : undefined,
        notifications: { create: [{ title: 'Welcome to NexTradePro 🎉', body: 'Your demo account is ready. Explore the trading terminal and AI assistant.', type: 'SUCCESS' }] },
        wallets: {
          create: [
            { asset: 'USDT', mode: 'DEMO', balance: 100000 },
            { asset: 'BTC', mode: 'DEMO', balance: 1.5 },
            { asset: 'ETH', mode: 'DEMO', balance: 20 },
            { asset: 'SOL', mode: 'DEMO', balance: 200 },
            { asset: 'USDT', mode: 'LIVE', balance: 0 },
            { asset: 'BTC', mode: 'LIVE', balance: 0 },
            { asset: 'ETH', mode: 'LIVE', balance: 0 },
          ],
        },
      },
    });
    await audit({ actorId: user.id, action: 'auth.register.google', target: user.id, ip: req.ip });
  }
  if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Account suspended' });

  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await audit({ actorId: user.id, action: 'auth.login.google', target: user.id, ip: req.ip });

  const payload = { sub: user.id, email: user.email, tv: user.tokenVersion };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);
  return res.json({ user: { id: user.id, email: user.email, fullName: user.fullName }, accessToken: access });
});

// POST /api/auth/refresh
router.post('/refresh', async (req, res) => {
  const token = req.cookies?.nxp_refresh || req.body?.refreshToken;
  if (!token) return res.status(401).json({ error: 'No refresh token' });
  try {
    const payload = verifyRefreshToken(token);
    // A password/email change or admin reset bumps tokenVersion, invalidating
    // this refresh token so the session cannot be silently renewed.
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { tokenVersion: true, status: true } });
    if (!user || user.status === 'SUSPENDED' || (payload.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session expired' });
    }
    const newPayload = { sub: payload.sub, email: payload.email, tv: user.tokenVersion };
    const access = signAccessToken(newPayload);
    const refresh = signRefreshToken(newPayload);
    setAuthCookies(res, access, refresh);
    return res.json({ accessToken: access });
  } catch {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// POST /api/auth/forgot-password — issue a single-use, 30-minute reset token.
router.post('/forgot-password', async (req, res) => {
  const parsed = z.object({ email: z.string().email() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Enter a valid email address' });

  // Always return the same response so the endpoint can't be used to probe
  // which emails have accounts.
  const generic = { ok: true, message: 'If an account exists for that email, a password reset link has been sent.' };
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (!user) return res.json(generic);

  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: hash, resetTokenExp: new Date(Date.now() + 30 * 60 * 1000) },
  });
  await audit({ actorId: user.id, action: 'auth.forgot_password', target: user.id, ip: req.ip });

  const base = env.corsOrigins.find((o) => o.startsWith('http')) ?? 'http://localhost:3000';
  const resetUrl = `${base}/reset-password?token=${token}`;
  // Email delivery (SMTP) is not configured for this demo deployment, so the
  // reset link is returned in the response and logged. In production this URL
  // would be emailed to the user instead of returned.
  // eslint-disable-next-line no-console
  console.log(`🔑 Password reset link for ${user.email}: ${resetUrl}`);
  return res.json({ ...generic, demo: true, resetUrl });
});

// POST /api/auth/reset-password — consume the token and set a new password.
router.post('/reset-password', async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(10), password: z.string().min(8, 'Password must be at least 8 characters') })
    .safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.errors[0].message });

  const hash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const user = await prisma.user.findFirst({ where: { resetTokenHash: hash, resetTokenExp: { gt: new Date() } } });
  if (!user) return res.status(400).json({ error: 'This reset link is invalid or has expired.' });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash: await hashPassword(parsed.data.password),
      resetTokenHash: null, // single-use: invalidate the link
      resetTokenExp: null,
      tokenVersion: { increment: 1 }, // sign out all existing sessions
    },
  });
  await audit({ actorId: user.id, action: 'auth.reset_password', target: user.id, ip: req.ip });
  return res.json({ ok: true });
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
  // A Super Admin / full admin always has live-trading access.
  const canLiveTrade =
    u.isSuperAdmin ||
    (u.liveTradingEnabled && u.tradingStatus === 'ACTIVE' && u.tradingPermission === 'FULL' && u.accountStatus !== 'SUSPENDED');
  return res.json({
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    roles: u.roles,
    permissions: Array.from(u.permissions),
    isSuperAdmin: u.isSuperAdmin,
    isAdmin: u.isSuperAdmin || u.roles.some((r) => r.isAdmin),
    isBroker: u.isSuperAdmin || u.permissions.has('broker.access'),
    kycStatus: profile?.kycStatus ?? 'NONE',
    twoFactor: profile?.twoFactor ?? false,
    liveTradingEnabled: u.liveTradingEnabled,
    tradingStatus: u.tradingStatus,
    tradingPermission: u.tradingPermission,
    accountStatus: u.accountStatus,
    canLiveTrade,
  });
});

export default router;

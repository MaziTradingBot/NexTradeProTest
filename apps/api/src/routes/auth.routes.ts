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
import { strongPassword } from '../lib/password';
import { sendEmail, appBaseUrl } from '../lib/mailer';
import { parseDevice } from '../lib/device';

const router = Router();

// Brute-force protection tuning.
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

// Issue (or re-issue) an email-verification token and "send" the link. Returns
// the verification URL so demo deployments without SMTP can still complete it.
async function issueEmailVerification(userId: string, email: string): Promise<string> {
  const token = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyTokenHash: hash, emailVerifyExp: new Date(Date.now() + 24 * 60 * 60 * 1000) },
  });
  const url = `${appBaseUrl()}/verify-email?token=${token}`;
  await sendEmail(email, 'Verify your NexTradePro email', `Confirm your email address to secure your account:\n${url}\n\nThis link expires in 24 hours.`);
  return url;
}

// Record a sign-in attempt for history / new-device detection / lockout.
async function recordLogin(userId: string, req: import('express').Request, success: boolean, device?: string) {
  await prisma.loginEvent
    .create({
      data: {
        userId,
        ip: req.ip ?? null,
        userAgent: (req.get('user-agent') ?? '').slice(0, 300) || null,
        device: device ?? parseDevice(req.get('user-agent')),
        success,
      },
    })
    .catch(() => {});
}

const registerSchema = z.object({
  email: z.string().email(),
  password: strongPassword,
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
  const verifyUrl = await issueEmailVerification(user.id, user.email);
  await recordLogin(user.id, req, true);

  const payload = { sub: user.id, email: user.email, tv: user.tokenVersion };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);

  return res.status(201).json({
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken: access,
    // Only surface the verification link outside production. In production the
    // token is emailed and never returned in the response (avoids leaking it in
    // the network tab / dev tools).
    ...(env.isProd ? {} : { demoVerifyUrl: verifyUrl }),
  });
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const { email, password } = parsed.data;

  const user = await prisma.user.findUnique({ where: { email } });
  // Uniform response for unknown emails (no lockout state to track).
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });

  // Temporary lock in effect?
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const mins = Math.max(1, Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000));
    return res.status(423).json({ error: `Account temporarily locked after multiple failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}, or reset your password.` });
  }

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) {
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      // Reset the counter when we lock so it starts fresh after the window.
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCK_MINUTES * 60000) : null },
    });
    await recordLogin(user.id, req, false);
    if (lock) {
      await prisma.notification.create({ data: { userId: user.id, title: 'Account temporarily locked', body: `Your account was locked for ${LOCK_MINUTES} minutes after ${MAX_FAILED_LOGINS} failed sign-in attempts.`, type: 'WARNING' } }).catch(() => {});
      return res.status(423).json({ error: `Too many failed attempts — your account is locked for ${LOCK_MINUTES} minutes. You can reset your password to regain access.` });
    }
    const remaining = MAX_FAILED_LOGINS - failed;
    return res.status(401).json({ error: `Invalid email or password.${remaining <= 2 ? ` ${remaining} attempt${remaining === 1 ? '' : 's'} left before a temporary lock.` : ''}` });
  }

  if (user.status === 'SUSPENDED') {
    return res.status(403).json({ error: 'Account suspended' });
  }

  // Success — clear failure state and record the sign-in.
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null } });
  await audit({ actorId: user.id, action: 'auth.login', target: user.id, ip: req.ip });

  const device = parseDevice(req.get('user-agent'));
  const seenBefore = await prisma.loginEvent.findFirst({ where: { userId: user.id, success: true, device } });
  await recordLogin(user.id, req, true, device);
  if (!seenBefore) {
    // New device / browser — notify in-app and by email.
    await prisma.notification.create({ data: { userId: user.id, title: 'New sign-in to your account', body: `A new sign-in was detected from ${device}${req.ip ? ` (${req.ip})` : ''}. If this wasn't you, change your password immediately.`, type: 'WARNING' } }).catch(() => {});
    await sendEmail(user.email, 'New sign-in to your NexTradePro account', `We noticed a sign-in from ${device}${req.ip ? ` (IP ${req.ip})` : ''} at ${new Date().toUTCString()}.\n\nIf this was you, no action is needed. If not, reset your password immediately.`);
  }

  const payload = { sub: user.id, email: user.email, tv: user.tokenVersion };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);

  return res.json({
    user: { id: user.id, email: user.email, fullName: user.fullName },
    accessToken: access,
  });
});

// POST /api/auth/verify-email — consume the emailed token.
router.post('/verify-email', async (req, res) => {
  const parsed = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid verification link' });
  const hash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const user = await prisma.user.findFirst({ where: { emailVerifyTokenHash: hash, emailVerifyExp: { gt: new Date() } } });
  if (!user) return res.status(400).json({ error: 'This verification link is invalid or has expired.' });
  await prisma.user.update({ where: { id: user.id }, data: { emailVerified: true, emailVerifyTokenHash: null, emailVerifyExp: null } });
  await audit({ actorId: user.id, action: 'auth.email_verified', target: user.id, ip: req.ip });
  return res.json({ ok: true });
});

// POST /api/auth/resend-verification — re-issue the link for the signed-in user.
router.post('/resend-verification', authenticate, async (req, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
  if (!user) return res.status(404).json({ error: 'Not found' });
  if (user.emailVerified) return res.json({ ok: true, alreadyVerified: true });
  const url = await issueEmailVerification(user.id, user.email);
  return res.json({ ok: true, ...(env.isProd ? {} : { demoVerifyUrl: url }) });
});

// POST /api/auth/google — sign in / sign up with a Google ID token.
// The frontend obtains the token from Google Identity Services and posts it
// here; we verify it against Google, then find or create the matching user.
router.post('/google', async (req, res) => {
  const parsed = z.object({ credential: z.string().min(20) }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Missing Google credential' });

  // Verify the ID token with Google (no extra dependency needed).
  let info: { aud?: string; email?: string; email_verified?: string | boolean; name?: string; sub?: string; picture?: string };
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
  const googleId = info.sub;

  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    // First-time Google user — provision an account (random password) with the
    // same starter wallets a normal registration receives. hasPassword=false
    // marks it as a Google-only login until the user sets a password.
    const userRole = await prisma.role.findUnique({ where: { key: 'USER' } });
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await hashPassword(crypto.randomBytes(24).toString('hex')),
        fullName,
        avatarUrl: info.picture ?? null,
        googleId,
        googleLinkedAt: new Date(),
        hasPassword: false,
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
    await audit({ actorId: user.id, action: 'auth.register.google', target: user.id, meta: { email }, ip: req.ip });
  } else if (!user.googleId && googleId) {
    // Existing email/password user signing in with Google for the first time —
    // auto-link the Google identity to the existing account (no duplicate).
    user = await prisma.user.update({
      where: { id: user.id },
      data: { googleId, googleLinkedAt: new Date(), avatarUrl: user.avatarUrl ?? info.picture ?? null },
    });
    await audit({ actorId: user.id, action: 'auth.google.linked', target: user.id, meta: { email }, ip: req.ip });
  }
  if (user.status === 'SUSPENDED') return res.status(403).json({ error: 'Account suspended' });

  // Google verifies the email, so a Google sign-in confirms it here too.
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginCount: 0, lockedUntil: null, emailVerified: true } });
  await audit({ actorId: user.id, action: 'auth.login.google', target: user.id, ip: req.ip });

  const gDevice = parseDevice(req.get('user-agent'));
  const gSeen = await prisma.loginEvent.findFirst({ where: { userId: user.id, success: true, device: gDevice } });
  await recordLogin(user.id, req, true, gDevice);
  if (!gSeen) {
    await prisma.notification.create({ data: { userId: user.id, title: 'New sign-in to your account', body: `A new sign-in (via Google) was detected from ${gDevice}${req.ip ? ` (${req.ip})` : ''}. If this wasn't you, secure your account.`, type: 'WARNING' } }).catch(() => {});
    await sendEmail(user.email, 'New sign-in to your NexTradePro account', `We noticed a Google sign-in from ${gDevice}${req.ip ? ` (IP ${req.ip})` : ''}. If this wasn't you, secure your account.`);
  }

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
  await sendEmail(user.email, 'Reset your NexTradePro password', `Reset your password using this link (valid for 30 minutes):\n${resetUrl}`);
  // Never return the reset token/URL in production — it would be visible in the
  // network tab. Outside production it's surfaced so demos work without SMTP.
  return res.json({ ...generic, ...(env.isProd ? {} : { demo: true, resetUrl }) });
});

// POST /api/auth/reset-password — consume the token and set a new password.
router.post('/reset-password', async (req, res) => {
  const parsed = z
    .object({ token: z.string().min(10), password: strongPassword })
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
    select: { kycStatus: true, twoFactor: true, googleId: true, googleLinkedAt: true, hasPassword: true, avatarUrl: true, emailVerified: true },
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
    avatarUrl: profile?.avatarUrl ?? null,
    googleLinked: !!profile?.googleId,
    hasPassword: profile?.hasPassword ?? true,
    emailVerified: profile?.emailVerified ?? false,
    liveTradingEnabled: u.liveTradingEnabled,
    tradingStatus: u.tradingStatus,
    tradingPermission: u.tradingPermission,
    accountStatus: u.accountStatus,
    canLiveTrade,
  });
});

export default router;

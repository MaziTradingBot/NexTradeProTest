import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  tv?: number; // token version — bumped to invalidate all outstanding tokens
  rm?: boolean; // "remember me" — refresh token carries an extended lifetime
}

// Refresh-token lifetimes. "Remember me" extends the window from the default
// (a normal session) to 30 days so the user stays signed in across restarts.
export const REMEMBER_REFRESH_TTL = process.env.JWT_REFRESH_TTL_REMEMBER ?? '30d';
export const REFRESH_MAXAGE_MS = 7 * 24 * 60 * 60 * 1000;
export const REMEMBER_REFRESH_MAXAGE_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_MAXAGE_MS = 15 * 60 * 1000;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwt.accessTtl as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.accessSecret, options);
}

export function signRefreshToken(payload: JwtPayload, remember = false): string {
  const ttl = remember ? REMEMBER_REFRESH_TTL : env.jwt.refreshTtl;
  const options: jwt.SignOptions = { expiresIn: ttl as jwt.SignOptions['expiresIn'] };
  return jwt.sign({ ...payload, rm: remember || undefined }, env.jwt.refreshSecret, options);
}

// Shared cookie options + auth-cookie setter. `remember` extends the refresh
// cookie lifetime to match the extended token TTL.
export function authCookieCommon() {
  return {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? ('none' as const) : ('lax' as const),
    domain: env.cookieDomain,
  };
}

export function setAuthCookies(
  res: import('express').Response,
  access: string,
  refresh: string,
  remember = false,
): void {
  const common = authCookieCommon();
  res.cookie('nxp_access', access, { ...common, maxAge: ACCESS_MAXAGE_MS });
  res.cookie('nxp_refresh', refresh, {
    ...common,
    maxAge: remember ? REMEMBER_REFRESH_MAXAGE_MS : REFRESH_MAXAGE_MS,
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.accessSecret) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwt.refreshSecret) as JwtPayload;
}

// Issue a fresh access+refresh pair for the current session and set the auth
// cookies. Used after a self-service password/email change so bumping
// tokenVersion invalidates *other* sessions without logging the user out here.
export function issueSession(
  res: import('express').Response,
  user: { id: string; email: string; tokenVersion: number },
): string {
  const payload: JwtPayload = { sub: user.id, email: user.email, tv: user.tokenVersion };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);
  setAuthCookies(res, access, refresh);
  return access;
}

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  sub: string; // user id
  email: string;
  tv?: number; // token version — bumped to invalidate all outstanding tokens
}

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

export function signRefreshToken(payload: JwtPayload): string {
  const options: jwt.SignOptions = { expiresIn: env.jwt.refreshTtl as jwt.SignOptions['expiresIn'] };
  return jwt.sign(payload, env.jwt.refreshSecret, options);
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
  const common = {
    httpOnly: true,
    secure: env.isProd,
    sameSite: env.isProd ? ('none' as const) : ('lax' as const),
    domain: env.cookieDomain,
  };
  res.cookie('nxp_access', access, { ...common, maxAge: 15 * 60 * 1000 });
  res.cookie('nxp_refresh', refresh, { ...common, maxAge: 7 * 24 * 60 * 60 * 1000 });
  return access;
}

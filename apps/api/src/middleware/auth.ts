import { NextFunction, Request, Response } from 'express';
import { prisma } from '../lib/prisma';
import { verifyAccessToken } from '../lib/auth';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  permissions: Set<string>;
  roles: { key: string; name: string; isAdmin: boolean }[];
  isSuperAdmin: boolean;
  liveTradingEnabled: boolean;
  tradingStatus: 'ACTIVE' | 'SUSPENDED';
  tradingPermission: 'FULL' | 'READ_ONLY';
  accountStatus: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  if (req.cookies?.nxp_access) return req.cookies.nxp_access as string;
  // Fallback for EventSource (SSE), which cannot set an Authorization header.
  if (typeof req.query?.token === 'string') return req.query.token;
  return null;
}

/** Loads the user + flattened permission set onto req.user. */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  try {
    const payload = verifyAccessToken(token);
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      include: {
        roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } },
      },
    });

    if (!user || user.status === 'SUSPENDED') {
      return res.status(401).json({ error: 'Account unavailable' });
    }
    // Reject tokens issued before the current version (password/email change,
    // admin password reset) — forces a fresh login.
    if ((payload.tv ?? 0) !== user.tokenVersion) {
      return res.status(401).json({ error: 'Session expired, please sign in again' });
    }

    const permissions = new Set<string>();
    let isSuperAdmin = false;
    const roles = user.roles.map((ur) => {
      if (ur.role.key === 'SUPER_ADMIN') isSuperAdmin = true;
      ur.role.permissions.forEach((rp) => permissions.add(rp.permission.key));
      return { key: ur.role.key, name: ur.role.name, isAdmin: ur.role.isAdmin };
    });

    req.user = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      permissions,
      roles,
      isSuperAdmin,
      liveTradingEnabled: user.liveTradingEnabled,
      tradingStatus: user.tradingStatus,
      tradingPermission: user.tradingPermission,
      accountStatus: user.status,
    };
    return next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Requires the authenticated user to hold one of the given permissions. */
export function requirePermission(...required: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: 'Authentication required' });
    if (req.user.isSuperAdmin) return next();
    const ok = required.some((p) => req.user!.permissions.has(p));
    if (!ok) return res.status(403).json({ error: 'Insufficient permissions', required });
    return next();
  };
}

/** Requires any admin role (access to the admin panel). */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });
  const isAdmin = req.user.isSuperAdmin || req.user.roles.some((r) => r.isAdmin);
  if (!isAdmin) return res.status(403).json({ error: 'Admin access required' });
  return next();
}

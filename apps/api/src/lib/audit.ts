import { prisma } from './prisma';

export async function audit(params: {
  actorId?: string | null;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
  ip?: string | null;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: params.actorId ?? null,
        action: params.action,
        target: params.target ?? null,
        meta: params.meta as object | undefined,
        ip: params.ip ?? null,
      },
    });
  } catch {
    // Auditing must never break the main request path.
  }
}

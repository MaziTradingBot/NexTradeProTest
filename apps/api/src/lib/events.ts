// Tiny in-process pub/sub used to push real-time account updates to connected
// clients over Server-Sent Events. Each user can have several open tabs; every
// tab holds one SSE response registered here. Balance-changing operations
// (admin funding, deposits, withdrawals, opening/closing positions) publish an
// event so every page refetches from the single source of truth immediately —
// no polling, no stale cache, no manual refresh.

import type { Response } from 'express';

type Client = { id: number; res: Response };
const clients = new Map<string, Set<Client>>();
let seq = 0;

export function subscribe(userId: string, res: Response): () => void {
  const client: Client = { id: ++seq, res };
  const set = clients.get(userId) ?? clients.set(userId, new Set()).get(userId)!;
  set.add(client);
  return () => {
    set.delete(client);
    if (set.size === 0) clients.delete(userId);
  };
}

// Send a named event with a JSON payload to all of a user's open connections.
export function publish(userId: string, event: string, data: Record<string, unknown> = {}) {
  const set = clients.get(userId);
  if (!set || set.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify({ ...data, at: Date.now() })}\n\n`;
  for (const c of set) {
    try {
      c.res.write(payload);
    } catch {
      set.delete(c);
    }
  }
}

// Convenience: signal that a user's balances/positions changed so clients
// refetch wallets, the account summary and transaction history.
export function publishBalance(userId: string, reason: string, mode?: 'DEMO' | 'LIVE') {
  publish(userId, 'balance', { reason, mode: mode ?? null });
}

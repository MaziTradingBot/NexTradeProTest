'use client';

import { useEffect } from 'react';
import { API_BASE, getAccessToken } from './api';

// Single shared SSE connection to the account event stream, fanned out to any
// number of subscribing components. Balance-changing events on the server
// (admin funding, deposits, withdrawals, trades) arrive here and trigger an
// immediate refetch on every page — no polling, no manual refresh.

type Listener = (event: string) => void;

let source: EventSource | null = null;
let currentToken: string | null = null;
const listeners = new Set<Listener>();

function ensureConnection() {
  if (typeof window === 'undefined') return;
  const token = getAccessToken();
  if (!token) return;
  // Reconnect if the token changed (e.g. after re-login).
  if (source && currentToken === token) return;
  if (source) source.close();
  currentToken = token;

  const es = new EventSource(`${API_BASE}/api/account/stream?token=${encodeURIComponent(token)}`, {
    withCredentials: true,
  });
  const fanout = (event: string) => listeners.forEach((l) => l(event));
  es.addEventListener('balance', () => fanout('balance'));
  es.onerror = () => {
    // The browser auto-reconnects EventSource; if the token is gone, drop it.
    if (!getAccessToken()) {
      es.close();
      source = null;
      currentToken = null;
    }
  };
  source = es;
}

/**
 * Subscribe to real-time account events. `onEvent` fires on every balance
 * change; typically you pass a function that refetches the page's data.
 */
export function useLiveSync(onEvent: () => void) {
  useEffect(() => {
    ensureConnection();
    const listener: Listener = () => onEvent();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, [onEvent]);
}

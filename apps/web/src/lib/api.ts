// Lightweight API client for the NXP backend.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export interface ApiError {
  error: string;
}

// The access token lives in memory only — never in localStorage/sessionStorage.
// This keeps it out of dev tools / disk and shrinks the XSS blast radius. On a
// full page reload the in-memory token is lost, but the httpOnly refresh cookie
// survives, so the first API call 401s and is transparently retried after a
// silent /refresh (see apiFetch below).
let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function getMode(): 'DEMO' | 'LIVE' {
  if (typeof window === 'undefined') return 'DEMO';
  return localStorage.getItem('nxp-mode') === 'LIVE' ? 'LIVE' : 'DEMO';
}

// Endpoints that must never trigger a refresh-retry: the refresh call itself,
// and the credential flows whose 401 is a real "bad credentials" signal.
const NO_REFRESH = ['/api/auth/refresh', '/api/auth/login', '/api/auth/register'];

// Coalesce concurrent refreshes so a burst of 401s issues a single /refresh.
let refreshInFlight: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
        });
        if (!res.ok) return false;
        const data = (await res.json().catch(() => ({}))) as { accessToken?: string };
        if (data.accessToken) {
          accessToken = data.accessToken;
          return true;
        }
        return false;
      } catch {
        return false;
      } finally {
        // Release the coalescing slot on the next microtask.
        setTimeout(() => {
          refreshInFlight = null;
        }, 0);
      }
    })();
  }
  return refreshInFlight;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
  retried = false,
): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-nxp-mode', getMode());
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

  // Access token expired or missing (e.g. after a page reload) — refresh once
  // using the httpOnly refresh cookie and replay the original request.
  if (res.status === 401 && !retried && !NO_REFRESH.some((p) => path.startsWith(p))) {
    if (await tryRefresh()) return apiFetch<T>(path, options, true);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error((data as ApiError).error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

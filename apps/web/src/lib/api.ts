// Lightweight API client for the NXP backend.
export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') || 'http://localhost:4000';

export interface ApiError {
  error: string;
}

let accessToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
  if (typeof window !== 'undefined') {
    if (token) localStorage.setItem('nxp_token', token);
    else localStorage.removeItem('nxp_token');
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;
  if (typeof window !== 'undefined') {
    accessToken = localStorage.getItem('nxp_token');
  }
  return accessToken;
}

export function getMode(): 'DEMO' | 'LIVE' {
  if (typeof window === 'undefined') return 'DEMO';
  return localStorage.getItem('nxp-mode') === 'LIVE' ? 'LIVE' : 'DEMO';
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  headers.set('x-nxp-mode', getMode());
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: 'include',
  });

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
  del: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

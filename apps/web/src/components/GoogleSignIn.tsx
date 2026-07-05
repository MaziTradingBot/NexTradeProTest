'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/store';

// Loads Google Identity Services and renders the official "Sign in with Google"
// button. Only appears when NEXT_PUBLIC_GOOGLE_CLIENT_ID is configured, so the
// app works with or without Google auth set up.

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const GIS_SRC = 'https://accounts.google.com/gsi/client';

// Minimal typing for the parts of the GIS SDK we use.
interface GoogleId {
  initialize: (cfg: { client_id: string; callback: (r: { credential: string }) => void }) => void;
  renderButton: (el: HTMLElement, opts: Record<string, unknown>) => void;
}
declare global {
  interface Window {
    google?: { accounts: { id: GoogleId } };
  }
}

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject());
      return;
    }
    const s = document.createElement('script');
    s.src = GIS_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject();
    document.head.appendChild(s);
  });
}

export function GoogleSignIn({ label = 'signin_with' }: { label?: 'signin_with' | 'signup_with' }) {
  const router = useRouter();
  const { loadMe } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    const onCredential = async (resp: { credential: string }) => {
      setError(null);
      try {
        const res = await api.post<{ accessToken: string }>('/api/auth/google', { credential: resp.credential });
        setAccessToken(res.accessToken);
        await loadMe();
        router.push('/dashboard');
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google sign-in failed');
      }
    };

    loadScript()
      .then(() => {
        if (cancelled || !window.google || !ref.current) return;
        window.google.accounts.id.initialize({ client_id: CLIENT_ID, callback: onCredential });
        window.google.accounts.id.renderButton(ref.current, {
          theme: 'filled_black',
          size: 'large',
          width: 360,
          text: label,
          shape: 'pill',
          logo_alignment: 'center',
        });
      })
      .catch(() => setError('Could not load Google sign-in.'));

    return () => {
      cancelled = true;
    };
  }, [label, loadMe, router]);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3 text-xs text-ink-muted">
        <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
      </div>
      <div ref={ref} className="flex justify-center" />
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

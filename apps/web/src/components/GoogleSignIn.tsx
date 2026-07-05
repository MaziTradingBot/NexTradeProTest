'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/store';
import { cn } from '@/lib/utils';

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

export function GoogleSignIn({
  label = 'continue_with',
  mode = 'auth',
  onLinked,
}: {
  label?: 'signin_with' | 'signup_with' | 'continue_with';
  mode?: 'auth' | 'link';
  onLinked?: () => void;
}) {
  const router = useRouter();
  const { loadMe } = useAuth();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!CLIENT_ID || !ref.current) return;
    let cancelled = false;

    const onCredential = async (resp: { credential: string }) => {
      setError(null);
      setBusy(true);
      try {
        if (mode === 'link') {
          await api.post('/api/account/link-google', { credential: resp.credential });
          await loadMe();
          onLinked?.();
          setBusy(false);
        } else {
          const res = await api.post<{ accessToken: string }>('/api/auth/google', { credential: resp.credential });
          setAccessToken(res.accessToken);
          await loadMe();
          router.push('/dashboard');
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Google sign-in failed. Please try again.');
        setBusy(false);
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
      .catch(() => setError('Could not load Google sign-in. Check your connection and try again.'));

    return () => {
      cancelled = true;
    };
  }, [label, loadMe, router, mode, onLinked]);

  if (!CLIENT_ID) return null;

  return (
    <div className={mode === 'link' ? '' : 'mt-4'}>
      {mode === 'auth' && (
        <div className="mb-4 flex items-center gap-3 text-xs uppercase tracking-wide text-ink-muted">
          <span className="h-px flex-1 bg-white/10" /> or <span className="h-px flex-1 bg-white/10" />
        </div>
      )}
      <div className="relative flex justify-center">
        <div ref={ref} className={cn('transition', busy && 'pointer-events-none opacity-40')} />
        {busy && (
          <div className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-ink-soft">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
            Signing you in…
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-center text-sm text-red-400">{error}</p>}
    </div>
  );
}

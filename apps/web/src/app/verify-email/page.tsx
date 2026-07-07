'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

function VerifyInner() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [state, setState] = useState<'loading' | 'ok' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    if (!token) { setState('error'); setMessage('This verification link is missing or malformed.'); return; }
    api.post('/api/auth/verify-email', { token })
      .then(() => setState('ok'))
      .catch((e) => { setState('error'); setMessage(e instanceof Error ? e.message : 'Verification failed'); });
  }, [token]);

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="mb-8 flex justify-center"><Logo /></Link>
      <div className="card text-center">
        {state === 'loading' && (
          <>
            <Loader2 size={40} className="mx-auto animate-spin text-brand-blue" />
            <h1 className="mt-3 text-xl font-bold text-ink">Verifying your email…</h1>
          </>
        )}
        {state === 'ok' && (
          <>
            <CheckCircle2 size={40} className="mx-auto text-brand-emerald" />
            <h1 className="mt-3 text-xl font-bold text-ink">Email verified</h1>
            <p className="mt-1 text-sm text-ink-soft">Your email address is confirmed. Your account is fully secured.</p>
            <Link href="/dashboard" className="btn-primary mt-5 w-full">Go to dashboard</Link>
          </>
        )}
        {state === 'error' && (
          <>
            <XCircle size={40} className="mx-auto text-red-400" />
            <h1 className="mt-3 text-xl font-bold text-ink">Verification failed</h1>
            <p className="mt-1 text-sm text-ink-soft">{message}</p>
            <Link href="/settings" className="btn-primary mt-5 w-full">Resend from settings</Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Link href="/dashboard" className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white/10 hover:text-ink sm:left-6 sm:top-6">
        <ArrowLeft size={16} /> Dashboard
      </Link>
      <Suspense fallback={<div className="text-ink-muted">Loading…</div>}>
        <VerifyInner />
      </Suspense>
    </main>
  );
}

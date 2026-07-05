'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

function ResetInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const [pw, setPw] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) return setError('Password must be at least 8 characters.');
    if (pw !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', { token, password: pw });
      setDone(true);
      setTimeout(() => router.push('/login'), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <Link href="/" className="mb-8 flex justify-center">
        <Logo />
      </Link>
      <div className="card">
        {done ? (
          <div className="text-center">
            <CheckCircle2 size={40} className="mx-auto text-brand-emerald" />
            <h1 className="mt-3 text-xl font-bold text-ink">Password updated</h1>
            <p className="mt-1 text-sm text-ink-soft">You can now sign in with your new password. Redirecting…</p>
            <Link href="/login" className="btn-primary mt-5 w-full">Go to sign in</Link>
          </div>
        ) : !token ? (
          <div className="text-center">
            <h1 className="text-xl font-bold text-ink">Invalid link</h1>
            <p className="mt-1 text-sm text-ink-soft">This password reset link is missing or malformed.</p>
            <Link href="/forgot-password" className="btn-primary mt-5 w-full">Request a new link</Link>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-ink">Set a new password</h1>
            <p className="mt-1 text-sm text-ink-soft">Choose a strong password for your account.</p>
            <form onSubmit={submit} className="mt-6 space-y-4">
              <div>
                <label className="label">New password</label>
                <input value={pw} onChange={(e) => setPw(e.target.value)} type="password" required className="input" placeholder="At least 8 characters" />
              </div>
              <div>
                <label className="label">Confirm new password</label>
                <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required className="input" />
              </div>
              {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Link
        href="/login"
        className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white/10 hover:text-ink sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} /> Back to sign in
      </Link>
      <Suspense fallback={<div className="text-ink-muted">Loading…</div>}>
        <ResetInner />
      </Suspense>
    </main>
  );
}

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { PasswordInput } from '@/components/PasswordInput';
import { useAuth } from '@/lib/store';

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const timedOut = params.get('timeout') === '1';
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Link
        href="/"
        className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-white/10 hover:text-white sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} /> Back to home
      </Link>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="card">
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="mt-1 text-sm text-slate-400">Sign in to your NexTradePro account.</p>

          {timedOut && (
            <p className="mt-4 flex items-center gap-2 rounded-lg bg-brand-gold/10 px-3 py-2 text-sm text-brand-gold">
              <Clock size={15} /> You were signed out due to inactivity. Please sign in again.
            </p>
          )}

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" placeholder="you@example.com" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label">Password</label>
                <Link href="/forgot-password" className="mb-1.5 text-xs font-medium text-brand-blue hover:underline">
                  Forgot password?
                </Link>
              </div>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" placeholder="Enter your password" />
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <GoogleSignIn label="signin_with" />

          <p className="mt-5 text-center text-sm text-slate-400">
            No account?{' '}
            <Link href="/register" className="font-medium text-brand-blue hover:underline">
              Create one
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-slate-500">Loading…</div>}>
      <LoginInner />
    </Suspense>
  );
}

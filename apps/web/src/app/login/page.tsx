'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { useAuth } from '@/lib/store';

const DEMO_ACCOUNTS = [['Super Admin', 'super@nextradepro.com']];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('Password123!');
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
              <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="input" />
            </div>
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-slate-400">
            No account?{' '}
            <Link href="/register" className="font-medium text-brand-blue hover:underline">
              Create one
            </Link>
          </p>
        </div>

        <div className="card mt-4">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Demo accounts (password: Password123!)</p>
          <div className="grid grid-cols-2 gap-2">
            {DEMO_ACCOUNTS.map(([label, mail]) => (
              <button
                key={mail}
                onClick={() => setEmail(mail)}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-left text-xs text-slate-300 transition hover:bg-white/10"
              >
                <div className="font-medium text-white">{label}</div>
                <div className="truncate text-slate-500">{mail}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

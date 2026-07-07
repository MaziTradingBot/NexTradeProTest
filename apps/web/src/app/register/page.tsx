'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { PasswordInput } from '@/components/PasswordInput';
import { evaluatePassword } from '@/lib/password';
import { useAuth } from '@/lib/store';

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [referral, setReferral] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) setReferral(ref);
  }, []);

  const passwordValid = evaluatePassword(password).valid;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordValid) return setError('Please choose a password that meets all the requirements.');
    setError(null);
    setLoading(true);
    try {
      await register(email, password, fullName, referral || undefined);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed');
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
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="mt-1 text-sm text-slate-400">Start trading in demo mode — no card required.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <div>
              <label className="label">Full name</label>
              <input value={fullName} onChange={(e) => setFullName(e.target.value)} required className="input" placeholder="Jane Trader" />
            </div>
            <div>
              <label className="label">Email</label>
              <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" placeholder="you@example.com" />
            </div>
            <div>
              <label className="label">Password</label>
              <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} required showStrength autoComplete="new-password" placeholder="At least 8 characters" />
            </div>
            {referral && (
              <p className="rounded-lg bg-brand-emerald/10 px-3 py-2 text-sm text-brand-emerald">
                🎉 Referred by code <span className="font-mono font-semibold">{referral}</span>
              </p>
            )}
            {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <GoogleSignIn label="signup_with" />

          <p className="mt-5 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-brand-blue hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}

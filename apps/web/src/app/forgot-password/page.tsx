'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, MailCheck } from 'lucide-react';
import { Logo } from '@/components/Logo';
import { api } from '@/lib/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [resetUrl, setResetUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // The API returns a demo reset link because email delivery (SMTP) is not
      // configured on this deployment; in production the link is emailed.
      const res = await api.post<{ ok: boolean; resetUrl?: string; demo?: boolean }>('/api/auth/forgot-password', { email });
      setSent(true);
      if (res.demo && res.resetUrl) setResetUrl(res.resetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <Link
        href="/login"
        className="fixed left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-ink-soft transition hover:bg-white/10 hover:text-ink sm:left-6 sm:top-6"
      >
        <ArrowLeft size={16} /> Back to sign in
      </Link>
      <div className="w-full max-w-md">
        <Link href="/" className="mb-8 flex justify-center">
          <Logo />
        </Link>
        <div className="card">
          {sent ? (
            <>
              <div className="flex items-center gap-2 text-brand-emerald">
                <MailCheck size={20} />
                <h1 className="text-xl font-bold text-ink">Check your email</h1>
              </div>
              <p className="mt-3 text-sm text-ink-soft">
                If an account exists for <span className="font-medium text-ink">{email}</span>, a password reset link has been sent.
                The link expires in 30 minutes.
              </p>
              {resetUrl && (
                <div className="mt-4 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3 text-xs">
                  <div className="mb-1 font-semibold text-brand-gold">Demo mode — email delivery isn’t configured</div>
                  <p className="text-ink-soft">Use this reset link directly:</p>
                  <Link href={resetUrl.replace(/^https?:\/\/[^/]+/, '')} className="mt-1 block break-all font-mono text-brand-blue hover:underline">
                    {resetUrl}
                  </Link>
                </div>
              )}
              <Link href="/login" className="btn-primary mt-5 w-full">Return to sign in</Link>
            </>
          ) : (
            <>
              <h1 className="text-2xl font-bold text-ink">Forgot password</h1>
              <p className="mt-1 text-sm text-ink-soft">Enter your email and we’ll send you a reset link.</p>
              <form onSubmit={submit} className="mt-6 space-y-4">
                <div>
                  <label className="label">Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" required className="input" placeholder="you@example.com" />
                </div>
                {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">{error}</p>}
                <button type="submit" disabled={loading} className="btn-primary w-full">
                  {loading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

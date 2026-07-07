'use client';

import { useEffect, useState } from 'react';
import { AtSign, Copy, Link as LinkIcon, Lock, ShieldCheck, User, MailCheck, Clock, Monitor, CheckCircle2, XCircle } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { GoogleSignIn } from '@/components/GoogleSignIn';
import { QrCode } from '@/components/QrCode';
import { PasswordInput } from '@/components/PasswordInput';
import { evaluatePassword } from '@/lib/password';
import { api, setAccessToken } from '@/lib/api';
import { useAuth } from '@/lib/store';

function SettingsInner() {
  const { user, loadMe } = useAuth();
  const [twoFactor, setTwoFactor] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwError, setPwError] = useState<string | null>(null);
  const [em, setEm] = useState({ newEmail: '', confirmEmail: '', password: '' });
  const [emError, setEmError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [logins, setLogins] = useState<{ id: string; device: string | null; ip: string | null; location: string | null; success: boolean; createdAt: string }[]>([]);
  const [demoVerify, setDemoVerify] = useState<string | null>(null);

  useEffect(() => {
    api.get<typeof logins>('/api/account/login-history').then(setLogins).catch(() => {});
  }, []);

  const resendVerification = async () => {
    try {
      const res = await api.post<{ demoVerifyUrl?: string; alreadyVerified?: boolean }>('/api/auth/resend-verification');
      if (res.alreadyVerified) { flash('Your email is already verified'); loadMe(); return; }
      setDemoVerify(res.demoVerifyUrl ?? null);
      flash('Verification email sent');
    } catch (e) {
      flash(e instanceof Error ? e.message : 'Failed');
    }
  };

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    setTwoFactor(!!user?.twoFactor);
  }, [user]);

  const changePassword = async () => {
    setPwError(null);
    if (!evaluatePassword(pw.next).valid) return setPwError('Please choose a new password that meets all the requirements.');
    if (pw.next !== pw.confirm) return setPwError('New passwords do not match.');
    try {
      const res = await api.post<{ accessToken?: string }>('/api/account/change-password', { currentPassword: pw.current, newPassword: pw.next });
      // Keep the current session alive with the freshly re-issued token.
      if (res.accessToken) setAccessToken(res.accessToken);
      setPw({ current: '', next: '', confirm: '' });
      flash('Password changed — other sessions were signed out');
    } catch (e) {
      setPwError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const changeEmail = async () => {
    setEmError(null);
    if (em.newEmail !== em.confirmEmail) return setEmError('The email addresses do not match.');
    try {
      const res = await api.post<{ accessToken?: string }>('/api/account/change-email', {
        newEmail: em.newEmail,
        confirmEmail: em.confirmEmail,
        currentPassword: em.password,
      });
      if (res.accessToken) setAccessToken(res.accessToken);
      setEm({ newEmail: '', confirmEmail: '', password: '' });
      await loadMe();
      flash('Email address updated');
    } catch (e) {
      setEmError(e instanceof Error ? e.message : 'Failed');
    }
  };

  const startSetup = async () => {
    setTwoFaError(null);
    const res = await api.post<{ secret: string; otpauth: string }>('/api/account/2fa/setup');
    setSetup(res);
  };

  const verify2fa = async () => {
    setTwoFaError(null);
    try {
      await api.post('/api/account/2fa/verify', { code });
      setTwoFactor(true);
      setSetup(null);
      setCode('');
      await loadMe();
      flash('Two-factor authentication enabled');
    } catch (e) {
      setTwoFaError(e instanceof Error ? e.message : 'Invalid code');
    }
  };

  const disable2fa = async () => {
    await api.post('/api/account/2fa/disable');
    setTwoFactor(false);
    await loadMe();
    flash('Two-factor authentication disabled');
  };

  // Format the base32 secret in groups of 4 for easy manual entry.
  const groupedSecret = setup ? setup.secret.replace(/(.{4})/g, '$1 ').trim() : '';

  return (
    <section className="mx-auto max-w-4xl px-4 pt-24 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>
      <p className="mt-1 text-slate-400">Manage your profile, security and API access.</p>

      {/* Profile */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <User size={18} className="text-brand-blue" />
          <h2 className="font-semibold text-white">Profile</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <span className="label flex items-center gap-1.5">Full name <Lock size={11} className="text-slate-500" /></span>
            <input value={user?.fullName ?? ''} disabled readOnly className="input cursor-not-allowed opacity-60" />
          </div>
          <div>
            <span className="label flex items-center gap-1.5">Email <Lock size={11} className="text-slate-500" /></span>
            <input value={user?.email ?? ''} disabled readOnly className="input cursor-not-allowed opacity-60" />
          </div>
        </div>
        <p className="mt-3 flex items-start gap-2 text-xs text-slate-500">
          <Lock size={13} className="mt-0.5 shrink-0" />
          Your legal name is protected and can’t be changed here. To update it, contact support — a legal name change requires identity verification and administrator approval. Email changes use the secure flow below.
        </p>
      </div>

      {/* Change password */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock size={18} className="text-brand-gold" />
          <h2 className="font-semibold text-white">Change password</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <span className="label">Current password</span>
            <PasswordInput value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoComplete="current-password" />
          </div>
          <div>
            <span className="label">New password</span>
            <PasswordInput value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} showStrength autoComplete="new-password" placeholder="At least 8 characters" />
          </div>
          <div>
            <span className="label">Confirm new password</span>
            <PasswordInput value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} autoComplete="new-password" />
            {pw.confirm && pw.confirm !== pw.next && <p className="mt-1 text-xs text-red-400">Passwords do not match.</p>}
          </div>
        </div>
        {pwError && <p className="mt-3 text-sm text-red-400">{pwError}</p>}
        <button onClick={changePassword} disabled={!pw.current || !pw.next} className="btn-primary mt-4">
          Update password
        </button>
      </div>

      {/* Change email */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <AtSign size={18} className="text-brand-cyan" />
          <h2 className="font-semibold text-white">Change email address</h2>
        </div>
        <p className="mb-4 text-sm text-ink-muted">
          Current email: <span className="font-medium text-ink">{user?.email}</span>
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="label">New email</span>
            <input type="email" value={em.newEmail} onChange={(e) => setEm({ ...em, newEmail: e.target.value })} className="input" placeholder="you@example.com" />
          </label>
          <label className="block">
            <span className="label">Confirm new email</span>
            <input type="email" value={em.confirmEmail} onChange={(e) => setEm({ ...em, confirmEmail: e.target.value })} className="input" />
          </label>
          <div>
            <span className="label">Current password</span>
            <PasswordInput value={em.password} onChange={(e) => setEm({ ...em, password: e.target.value })} autoComplete="current-password" />
          </div>
        </div>
        {emError && <p className="mt-3 text-sm text-red-400">{emError}</p>}
        <button onClick={changeEmail} disabled={!em.newEmail || !em.password} className="btn-primary mt-4">
          Update email
        </button>
      </div>

      {/* Security */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck size={18} className="text-brand-emerald" />
          <h2 className="font-semibold text-white">Two-Factor Authentication</h2>
          {twoFactor && <span className="badge ml-auto bg-brand-emerald/15 text-brand-emerald">Enabled</span>}
        </div>

        {twoFactor ? (
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <div className="text-sm text-slate-300">Your account is protected with an authenticator app.</div>
            <button onClick={disable2fa} className="btn-ghost px-3 py-1.5 text-xs">
              Disable
            </button>
          </div>
        ) : setup ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-400">
              Scan the QR code with Google Authenticator, Authy or 1Password — or add the key manually — then enter the 6-digit code to confirm.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <QrCode text={setup.otpauth} />
              <div className="flex-1">
                <div className="text-xs text-slate-500">Manual entry key</div>
                <div className="mt-1 flex items-center gap-2">
                  <code className="rounded-lg bg-black/30 px-3 py-2 font-mono text-sm tracking-wider text-white">{groupedSecret}</code>
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(setup.secret);
                      flash('Key copied');
                    }}
                    className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
                    aria-label="Copy key"
                  >
                    <Copy size={14} />
                  </button>
                </div>
                <div className="mt-4">
                  <label className="label">Verification code</label>
                  <div className="flex gap-2">
                    <input
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      inputMode="numeric"
                      placeholder="123456"
                      className="input font-mono tracking-[0.3em]"
                    />
                    <button onClick={verify2fa} disabled={code.length !== 6} className="btn-primary whitespace-nowrap">
                      Verify
                    </button>
                  </div>
                  {twoFaError && <p className="mt-2 text-sm text-red-400">{twoFaError}</p>}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
            <div>
              <div className="text-sm font-medium text-white">Authenticator app (TOTP)</div>
              <div className="text-xs text-slate-400">Protect your account with time-based one-time codes.</div>
            </div>
            <button onClick={startSetup} className="btn-primary px-4 py-2 text-sm">
              Enable
            </button>
          </div>
        )}
      </div>

      {/* Connected accounts (Google) */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <LinkIcon size={18} className="text-brand-cyan" />
          <h2 className="font-semibold text-white">Connected accounts</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-sm font-bold text-[#4285F4]">G</span>
            <div>
              <div className="text-sm font-medium text-white">Google</div>
              <div className="text-xs text-slate-400">
                {user?.googleLinked ? 'Sign in with your Google account' : 'Not connected'}
              </div>
            </div>
          </div>
          {user?.googleLinked ? (
            <button
              onClick={async () => {
                try {
                  await api.post('/api/account/unlink-google');
                  await loadMe();
                  flash('Google account unlinked');
                } catch (e) {
                  flash(e instanceof Error ? e.message : 'Failed');
                }
              }}
              className="btn-ghost px-3 py-1.5 text-xs"
            >
              Unlink
            </button>
          ) : (
            <GoogleSignIn mode="link" label="continue_with" onLinked={() => flash('Google account linked')} />
          )}
        </div>
        {user?.googleLinked && user?.hasPassword === false && (
          <p className="mt-2 text-xs text-brand-gold">Set a password (above) to be able to unlink Google.</p>
        )}
      </div>

      {/* Email verification */}
      <div className="card mt-6">
        <div className="mb-1 flex items-center gap-2">
          <MailCheck size={18} className="text-brand-blue" />
          <h2 className="font-semibold text-white">Email verification</h2>
        </div>
        {user?.emailVerified ? (
          <p className="flex items-center gap-2 text-sm text-brand-emerald"><CheckCircle2 size={15} /> Your email <span className="font-medium text-white">{user.email}</span> is verified.</p>
        ) : (
          <>
            <p className="text-sm text-slate-400">Verify <span className="font-medium text-white">{user?.email}</span> to fully secure your account and enable recovery.</p>
            <button onClick={resendVerification} className="btn-primary mt-3">Send verification email</button>
            {demoVerify && (
              <p className="mt-3 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-300">
                Demo (no SMTP configured):{' '}
                <a href={demoVerify} className="font-medium text-brand-blue hover:underline">open your verification link</a>.
              </p>
            )}
          </>
        )}
      </div>

      {/* Recent sign-in activity */}
      <div className="card mt-6 p-0">
        <div className="flex items-center gap-2 border-b border-white/10 px-5 py-3">
          <Clock size={18} className="text-brand-blue" />
          <h2 className="font-semibold text-white">Recent sign-in activity</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-5 py-2">Device</th>
                <th className="hidden px-5 py-2 md:table-cell">Location</th>
                <th className="hidden px-5 py-2 sm:table-cell">IP</th>
                <th className="px-5 py-2 text-right">Result</th>
                <th className="px-5 py-2 text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {logins.map((l) => (
                <tr key={l.id}>
                  <td className="px-5 py-3"><span className="inline-flex items-center gap-2 text-white"><Monitor size={14} className="text-slate-400" /> {l.device ?? 'Unknown device'}</span></td>
                  <td className="hidden px-5 py-3 text-slate-300 md:table-cell">{l.location ?? '—'}</td>
                  <td className="hidden px-5 py-3 font-mono text-slate-400 sm:table-cell">{l.ip ?? '—'}</td>
                  <td className="px-5 py-3 text-right">
                    {l.success
                      ? <span className="inline-flex items-center gap-1 text-brand-emerald"><CheckCircle2 size={13} /> Success</span>
                      : <span className="inline-flex items-center gap-1 text-red-400"><XCircle size={13} /> Failed</span>}
                  </td>
                  <td className="px-5 py-3 text-right text-slate-400">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {logins.length === 0 && <tr><td colSpan={5} className="px-5 py-8 text-center text-slate-500">No sign-in activity yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">
          {toast}
        </div>
      )}
      <div className="h-16" />
    </section>
  );
}

export default function SettingsPage() {
  return (
    <main>
      <Navbar />
      <AuthGuard>
        <SettingsInner />
      </AuthGuard>
    </main>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, ShieldCheck, Trash2, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
import { QrCode } from '@/components/QrCode';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/store';

interface ApiKeyRow {
  id: string;
  label: string;
  prefix: string;
  lastFour: string;
  createdAt: string;
}

function SettingsInner() {
  const { user, loadMe } = useAuth();
  const [fullName, setFullName] = useState(user?.fullName ?? '');
  const [twoFactor, setTwoFactor] = useState(false);
  const [setup, setSetup] = useState<{ secret: string; otpauth: string } | null>(null);
  const [code, setCode] = useState('');
  const [twoFaError, setTwoFaError] = useState<string | null>(null);
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newSecret, setNewSecret] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const flash = (m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 2500);
  };

  useEffect(() => {
    setFullName(user?.fullName ?? '');
    setTwoFactor(!!user?.twoFactor);
    api.get<ApiKeyRow[]>('/api/account/apikeys').then(setKeys).catch(() => {});
  }, [user]);

  const saveProfile = async () => {
    await api.patch('/api/account/profile', { fullName });
    await loadMe();
    flash('Profile updated');
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

  const createKey = async () => {
    if (!newLabel.trim()) return;
    const res = await api.post<{ secret: string }>('/api/account/apikeys', { label: newLabel });
    setNewSecret(res.secret);
    setNewLabel('');
    api.get<ApiKeyRow[]>('/api/account/apikeys').then(setKeys).catch(() => {});
  };

  const revokeKey = async (id: string) => {
    await api.del(`/api/account/apikeys/${id}`);
    setKeys((k) => k.filter((x) => x.id !== id));
    flash('API key revoked');
  };

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
          <label className="block">
            <span className="label">Full name</span>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="input" />
          </label>
          <label className="block">
            <span className="label">Email</span>
            <input value={user?.email ?? ''} disabled className="input opacity-60" />
          </label>
        </div>
        <button onClick={saveProfile} className="btn-primary mt-4">
          Save changes
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

      {/* API keys */}
      <div className="card mt-6">
        <div className="mb-4 flex items-center gap-2">
          <KeyRound size={18} className="text-brand-gold" />
          <h2 className="font-semibold text-white">API Keys</h2>
        </div>

        <div className="flex gap-2">
          <input
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Key label, e.g. Trading bot"
            className="input"
          />
          <button onClick={createKey} className="btn-primary whitespace-nowrap">
            Generate
          </button>
        </div>

        {newSecret && (
          <div className="mt-3 rounded-xl border border-brand-gold/30 bg-brand-gold/10 p-3">
            <div className="text-xs text-brand-gold">Copy this secret now — it won’t be shown again.</div>
            <div className="mt-1 flex items-center justify-between gap-2">
              <code className="truncate font-mono text-sm text-white">{newSecret}</code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(newSecret);
                  flash('Copied');
                }}
                className="rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <Copy size={14} />
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 space-y-2">
          {keys.map((k) => (
            <div key={k.id} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
              <div>
                <div className="text-sm font-medium text-white">{k.label}</div>
                <div className="font-mono text-xs text-slate-500">
                  {k.prefix}…{k.lastFour}
                </div>
              </div>
              <button onClick={() => revokeKey(k.id)} className="rounded-lg p-2 text-red-400 hover:bg-red-500/10">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
          {keys.length === 0 && <p className="text-sm text-slate-500">No API keys yet.</p>}
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

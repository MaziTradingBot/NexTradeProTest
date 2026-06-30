'use client';

import { useEffect, useState } from 'react';
import { Copy, KeyRound, ShieldCheck, Trash2, User } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { AuthGuard } from '@/components/AuthGuard';
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
    api.get<ApiKeyRow[]>('/api/account/apikeys').then(setKeys).catch(() => {});
  }, [user]);

  const saveProfile = async () => {
    await api.patch('/api/account/profile', { fullName });
    await loadMe();
    flash('Profile updated');
  };

  const toggle2fa = async () => {
    const next = !twoFactor;
    setTwoFactor(next);
    await api.post('/api/account/2fa', { enabled: next });
    flash(next ? '2FA enabled' : '2FA disabled');
  };

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
          <h2 className="font-semibold text-white">Security</h2>
        </div>
        <div className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3">
          <div>
            <div className="text-sm font-medium text-white">Two-factor authentication</div>
            <div className="text-xs text-slate-400">Add an extra layer of security (demo toggle).</div>
          </div>
          <button
            onClick={toggle2fa}
            className={`relative h-6 w-11 rounded-full transition ${twoFactor ? 'bg-brand-emerald' : 'bg-white/15'}`}
            aria-pressed={twoFactor}
          >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${twoFactor ? 'left-[22px]' : 'left-0.5'}`} />
          </button>
        </div>
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

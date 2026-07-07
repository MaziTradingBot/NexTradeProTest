'use client';

import { useCallback, useEffect, useState } from 'react';
import { LineChart, Search, Save, RotateCcw, Info } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface UserRow { id: string; email: string; fullName: string }
type Mode = 'DEMO' | 'LIVE';
const FIELDS: { key: string; label: string; suffix?: string }[] = [
  { key: 'realizedPnl', label: 'Realized P&L', suffix: '$' },
  { key: 'unrealizedPnl', label: 'Unrealized P&L', suffix: '$' },
  { key: 'dailyPnl', label: 'Daily P&L', suffix: '$' },
  { key: 'weeklyPnl', label: 'Weekly P&L', suffix: '$' },
  { key: 'monthlyPnl', label: 'Monthly P&L', suffix: '$' },
  { key: 'lifetimePnl', label: 'Lifetime P&L', suffix: '$' },
  { key: 'roi', label: 'ROI', suffix: '%' },
  { key: 'tradingVolume', label: 'Trading Volume', suffix: '$' },
  { key: 'winRate', label: 'Win Rate', suffix: '%' },
  { key: 'lossRate', label: 'Loss Rate', suffix: '%' },
];

export default function AdminPnlPage() {
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [sel, setSel] = useState<UserRow | null>(null);
  const [mode, setMode] = useState<Mode>('DEMO');
  const [vals, setVals] = useState<Record<string, string>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 2500); };

  const search = useCallback(() => {
    api.get<UserRow[]>(`/api/admin/users?search=${encodeURIComponent(q)}`).then((u) => setUsers(u.slice(0, 20))).catch(() => setUsers([]));
  }, [q]);
  useEffect(() => { const t = setTimeout(search, 300); return () => clearTimeout(t); }, [search]);

  const loadOverride = useCallback((userId: string, m: Mode) => {
    api.get<Record<string, number | null>>(`/api/admin/users/${userId}/pnl?mode=${m}`).then((ov) => {
      const next: Record<string, string> = {};
      FIELDS.forEach((f) => { next[f.key] = ov[f.key] == null ? '' : String(ov[f.key]); });
      setVals(next);
    }).catch(() => {});
  }, []);
  useEffect(() => { if (sel) loadOverride(sel.id, mode); }, [sel, mode, loadOverride]);

  const save = async () => {
    if (!sel) return;
    setSaving(true);
    const body: Record<string, unknown> = { mode };
    FIELDS.forEach((f) => { body[f.key] = vals[f.key] === '' ? null : Number(vals[f.key]); });
    try {
      await api.put(`/api/admin/users/${sel.id}/pnl`, body);
      flash('Overrides saved — propagated to the user’s dashboard & analytics.');
    } catch (e) { flash(e instanceof Error ? e.message : 'Failed'); } finally { setSaving(false); }
  };
  const clearAll = async () => {
    if (!sel || !confirm('Clear all overrides and revert to the user’s real stats?')) return;
    try { await api.del(`/api/admin/users/${sel.id}/pnl?mode=${mode}`); setVals(Object.fromEntries(FIELDS.map((f) => [f.key, '']))); flash('Reverted to real stats.'); }
    catch (e) { flash(e instanceof Error ? e.message : 'Failed'); }
  };

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white"><LineChart size={22} /></div>
        <div>
          <h1 className="text-2xl font-bold text-white">Profit &amp; Loss Manager</h1>
          <p className="text-slate-400">Adjust a client’s stats. Any value you set overrides the computed figure and propagates to their dashboard, analytics and portfolio.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* User picker */}
        <div className="card h-fit">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search users…" className="input pl-9" />
          </div>
          <div className="mt-3 max-h-[420px] space-y-1 overflow-y-auto">
            {users.map((u) => (
              <button key={u.id} onClick={() => setSel(u)} className={cn('block w-full rounded-xl px-3 py-2 text-left transition', sel?.id === u.id ? 'bg-white/10' : 'hover:bg-white/5')}>
                <div className="truncate text-sm font-medium text-white">{u.fullName}</div>
                <div className="truncate text-xs text-slate-500">{u.email}</div>
              </button>
            ))}
            {users.length === 0 && <p className="px-3 py-6 text-center text-sm text-slate-500">No users found.</p>}
          </div>
        </div>

        {/* Editor */}
        <div className="card">
          {sel ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">{sel.fullName}</h2>
                  <p className="text-xs text-slate-500">{sel.email}</p>
                </div>
                <div className="flex rounded-xl bg-black/20 p-1">
                  {(['DEMO', 'LIVE'] as const).map((m) => (
                    <button key={m} onClick={() => setMode(m)} className={cn('rounded-lg px-3 py-1.5 text-xs font-semibold transition', mode === m ? 'bg-white/10 text-white' : 'text-slate-400')}>{m}</button>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-start gap-2 rounded-lg bg-white/5 px-3 py-2 text-xs text-slate-400">
                <Info size={14} className="mt-0.5 shrink-0" /> Leave a field empty to use the real computed value. Filled fields override it.
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <label className="label">{f.label}{f.suffix ? ` (${f.suffix})` : ''}</label>
                    <input value={vals[f.key] ?? ''} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} type="number" placeholder="real" className="input" />
                  </div>
                ))}
              </div>

              <div className="mt-5 flex gap-2">
                <button onClick={save} disabled={saving} className="btn-primary disabled:opacity-60"><Save size={16} /> {saving ? 'Saving…' : 'Save overrides'}</button>
                <button onClick={clearAll} className="btn-ghost"><RotateCcw size={16} /> Revert to real</button>
              </div>
            </>
          ) : (
            <p className="py-16 text-center text-slate-500">Select a user to manage their P&amp;L.</p>
          )}
        </div>
      </div>

      {toast && <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">{toast}</div>}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Sparkles, RefreshCw, Trash2, Wallet, Receipt, Bell, Loader2, Zap, Play, Square, Presentation } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Action {
  key: string;
  label: string;
  desc: string;
  icon: typeof Sparkles;
  tone: 'primary' | 'danger' | 'default';
}

const HERO: Action[] = [
  { key: 'full_refresh', label: 'Refresh Demo Platform', desc: 'Reset + regenerate a polished, populated demo state for a presentation.', icon: Sparkles, tone: 'primary' },
  { key: 'reset_all', label: 'Reset Demo Platform', desc: 'Refill wallets and clear all demo trades, transactions and notifications.', icon: RefreshCw, tone: 'danger' },
];

const RESET: Action[] = [
  { key: 'refill', label: 'Refill $100k', desc: 'Top up every demo account to $100k + crypto.', icon: Wallet, tone: 'default' },
  { key: 'reset_wallets', label: 'Reset Wallets', desc: 'Restore default demo balances.', icon: Wallet, tone: 'default' },
  { key: 'reset_trades', label: 'Reset Trades', desc: 'Delete all demo orders.', icon: Trash2, tone: 'danger' },
  { key: 'reset_transactions', label: 'Reset Transactions', desc: 'Delete demo deposits & withdrawals.', icon: Trash2, tone: 'danger' },
  { key: 'reset_notifications', label: 'Reset Notifications', desc: 'Clear all notifications.', icon: Trash2, tone: 'danger' },
];

const REGEN: Action[] = [
  { key: 'regenerate_orders', label: 'Regenerate Orders', desc: 'Create realistic demo trades.', icon: Receipt, tone: 'default' },
  { key: 'regenerate_transactions', label: 'Regenerate Transactions', desc: 'Create demo deposits & withdrawals.', icon: Receipt, tone: 'default' },
  { key: 'regenerate_notifications', label: 'Regenerate Notifications', desc: 'Populate notification feeds.', icon: Bell, tone: 'default' },
];

export default function ToolkitPage() {
  const [running, setRunning] = useState<string | null>(null);
  const [log, setLog] = useState<{ msg: string; ok: boolean }[]>([]);
  const [presentation, setPresentation] = useState(false);

  useEffect(() => {
    api.get<{ presentationMode: boolean }>('/api/admin/toolkit/status').then((s) => setPresentation(s.presentationMode)).catch(() => {});
  }, []);

  const runKey = async (key: string, confirmMsg?: string) => {
    if (running) return;
    if (confirmMsg && !confirm(confirmMsg)) return;
    setRunning(key);
    try {
      const res = await api.post<{ message: string }>(`/api/admin/toolkit/${key}`);
      setLog((l) => [{ msg: res.message, ok: true }, ...l].slice(0, 8));
      if (key === 'start_presentation') setPresentation(true);
      if (key === 'stop_presentation') setPresentation(false);
    } catch (e) {
      setLog((l) => [{ msg: e instanceof Error ? e.message : 'Failed', ok: false }, ...l].slice(0, 8));
    } finally {
      setRunning(null);
    }
  };

  const run = (action: Action) =>
    runKey(action.key, action.tone === 'danger' ? `${action.label}\n\n${action.desc}\n\nContinue?` : undefined);

  const Btn = ({ a, big = false }: { a: Action; big?: boolean }) => (
    <button
      onClick={() => run(a)}
      disabled={!!running}
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4 text-left transition disabled:opacity-60',
        a.tone === 'primary'
          ? 'border-brand-blue/40 bg-brand-blue/10 hover:border-brand-blue/60'
          : a.tone === 'danger'
            ? 'border-red-500/25 bg-red-500/5 hover:border-red-500/40'
            : 'border-white/10 bg-white/5 hover:border-white/20',
        big && 'sm:p-5',
      )}
    >
      <div
        className={cn(
          'inline-flex shrink-0 rounded-xl p-2.5 text-white',
          a.tone === 'primary' ? 'bg-brand-gradient' : a.tone === 'danger' ? 'bg-red-500/80' : 'bg-white/10',
        )}
      >
        {running === a.key ? <Loader2 size={big ? 22 : 18} className="animate-spin" /> : <a.icon size={big ? 22 : 18} />}
      </div>
      <div>
        <div className={cn('font-semibold text-white', big && 'text-lg')}>{a.label}</div>
        <div className="mt-0.5 text-xs text-slate-400">{a.desc}</div>
      </div>
    </button>
  );

  return (
    <div>
      <div className="flex items-center gap-3">
        <div className="inline-flex rounded-2xl bg-brand-gradient p-3 text-white">
          <Zap size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-white">Presentation Toolkit</h1>
          <p className="text-slate-400">One-click reset and regeneration of the demo platform for client demos.</p>
        </div>
      </div>

      {/* Client Showcase Mode */}
      <div className={cn('mt-6 rounded-2xl border p-5 sm:p-6 transition', presentation ? 'border-brand-emerald/40 bg-brand-emerald/5' : 'border-brand-blue/30 bg-brand-blue/5')}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="inline-flex shrink-0 rounded-xl bg-brand-gradient p-3 text-white"><Presentation size={22} /></div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-white">Client Showcase Mode</h2>
                <span className={cn('badge', presentation ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-white/10 text-slate-400')}>{presentation ? 'ACTIVE' : 'Off'}</span>
              </div>
              <p className="mt-1 max-w-xl text-sm text-slate-400">One click resets every demo account, refills to $100k, generates realistic trades, transactions and notifications, and turns on Presentation Mode — a clean, polished environment for your next demo.</p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => runKey('start_presentation')} disabled={!!running} className="btn-primary whitespace-nowrap disabled:opacity-60">
              {running === 'start_presentation' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Start Client Presentation
            </button>
            {presentation && (
              <button onClick={() => runKey('stop_presentation')} disabled={!!running} className="btn-ghost whitespace-nowrap">
                {running === 'stop_presentation' ? <Loader2 size={16} className="animate-spin" /> : <Square size={16} />} Stop
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Hero actions */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {HERO.map((a) => (
          <Btn key={a.key} a={a} big />
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Reset</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RESET.map((a) => (
          <Btn key={a.key} a={a} />
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">Regenerate</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {REGEN.map((a) => (
          <Btn key={a.key} a={a} />
        ))}
      </div>

      {/* Activity log */}
      {log.length > 0 && (
        <div className="card mt-8">
          <h2 className="mb-3 font-semibold text-white">Recent actions</h2>
          <div className="space-y-2">
            {log.map((l, i) => (
              <div key={i} className={cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', l.ok ? 'bg-brand-emerald/10 text-slate-200' : 'bg-red-500/10 text-red-300')}>
                <span className={cn('h-1.5 w-1.5 rounded-full', l.ok ? 'bg-brand-emerald' : 'bg-red-400')} />
                {l.msg}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        These actions affect Demo Mode data only and are recorded in the audit log. Live data is never touched.
      </p>
    </div>
  );
}

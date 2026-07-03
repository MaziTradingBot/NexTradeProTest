'use client';

import { useState } from 'react';
import { Sparkles, RefreshCw, Trash2, Wallet, Receipt, Bell, Loader2, Zap } from 'lucide-react';
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

  const run = async (action: Action) => {
    if (running) return;
    if (action.tone === 'danger' && !confirm(`${action.label}\n\n${action.desc}\n\nContinue?`)) return;
    setRunning(action.key);
    try {
      const res = await api.post<{ message: string }>(`/api/admin/toolkit/${action.key}`);
      setLog((l) => [{ msg: res.message, ok: true }, ...l].slice(0, 8));
    } catch (e) {
      setLog((l) => [{ msg: e instanceof Error ? e.message : 'Failed', ok: false }, ...l].slice(0, 8));
    } finally {
      setRunning(null);
    }
  };

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

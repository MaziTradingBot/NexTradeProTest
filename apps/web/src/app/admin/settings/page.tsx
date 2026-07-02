'use client';

import { useEffect, useState, useCallback } from 'react';
import { AlertTriangle } from 'lucide-react';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';

interface Flag {
  id: string;
  key: string;
  label: string;
  description: string | null;
  enabled: boolean;
}

export default function AdminSettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(() => {
    api.get<{ flags: Flag[] }>('/api/admin/settings').then((d) => setFlags(d.flags)).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const toggle = async (flag: Flag) => {
    const next = !flag.enabled;
    setFlags((fs) => fs.map((f) => (f.id === flag.id ? { ...f, enabled: next } : f)));
    try {
      await api.patch(`/api/admin/settings/flags/${flag.key}`, { enabled: next });
      setToast(`${flag.label} ${next ? 'enabled' : 'disabled'}`);
      setTimeout(() => setToast(null), 2000);
    } catch {
      load();
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">Platform Settings</h1>
      <p className="mt-1 text-slate-400">Toggle platform features and operational modes.</p>

      <div className="card mt-6">
        <h2 className="mb-4 font-semibold text-white">Feature flags</h2>
        <div className="space-y-2">
          {flags.map((flag) => {
            const danger = flag.key === 'maintenance_mode';
            return (
              <div
                key={flag.id}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-4 py-3',
                  danger && flag.enabled ? 'border-red-500/30 bg-red-500/10' : 'border-white/10 bg-white/5',
                )}
              >
                <div className="pr-4">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    {danger && <AlertTriangle size={14} className="text-red-400" />}
                    {flag.label}
                  </div>
                  {flag.description && <div className="mt-0.5 text-xs text-slate-400">{flag.description}</div>}
                </div>
                <button
                  onClick={() => toggle(flag)}
                  className={cn('relative h-6 w-11 shrink-0 rounded-full transition', flag.enabled ? (danger ? 'bg-red-500' : 'bg-brand-emerald') : 'bg-white/15')}
                  aria-pressed={flag.enabled}
                  aria-label={`Toggle ${flag.label}`}
                >
                  <span className={cn('absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all', flag.enabled ? 'left-[22px]' : 'left-0.5')} />
                </button>
              </div>
            );
          })}
          {flags.length === 0 && <p className="text-sm text-slate-500">Loading settings…</p>}
        </div>
      </div>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-xl border border-white/10 bg-bg-elevated px-4 py-2.5 text-sm text-white shadow-card">
          {toast}
        </div>
      )}
    </div>
  );
}

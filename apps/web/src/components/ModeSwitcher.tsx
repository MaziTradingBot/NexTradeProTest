'use client';

import { useEffect } from 'react';
import { useMode } from '@/lib/useMode';
import { cn } from '@/lib/utils';

// Toggles between Demo and Live account modes. A full reload is triggered so
// every data view re-fetches under the newly selected mode (fully separated).
export function ModeSwitcher({ compact = false }: { compact?: boolean }) {
  const { mode, hydrated, init, setMode } = useMode();

  useEffect(() => {
    if (!hydrated) init();
  }, [hydrated, init]);

  const switchTo = (m: 'DEMO' | 'LIVE') => {
    if (m === mode) return;
    setMode(m);
    // Reload so all queries refetch cleanly under the new mode.
    if (typeof window !== 'undefined') window.location.reload();
  };

  return (
    <div className={cn('inline-flex items-center rounded-xl border border-white/10 bg-black/20 p-0.5', compact ? 'text-xs' : 'text-sm')}>
      <button
        onClick={() => switchTo('DEMO')}
        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition', mode === 'DEMO' ? 'bg-brand-emerald text-white' : 'text-slate-400 hover:text-white')}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', mode === 'DEMO' ? 'bg-white' : 'bg-brand-emerald')} />
        Demo
      </button>
      <button
        onClick={() => switchTo('LIVE')}
        className={cn('flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-semibold transition', mode === 'LIVE' ? 'bg-brand-blue text-white' : 'text-slate-400 hover:text-white')}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full', mode === 'LIVE' ? 'bg-white' : 'bg-brand-blue')} />
        Live
      </button>
    </div>
  );
}

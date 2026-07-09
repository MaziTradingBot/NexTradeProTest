'use client';

import { useEffect } from 'react';
import { useMode } from '@/lib/useMode';
import { cn } from '@/lib/utils';

// Floating pill that always shows the active mode (Demo/Live), fulfilling the
// "visible mode indicator" transparency requirement.
export function ModeBadge() {
  const { mode, hydrated, init } = useMode();
  useEffect(() => {
    if (!hydrated) init();
  }, [hydrated, init]);

  return (
    <div
      className={cn(
        // Sits above the mobile bottom nav on tablets; drops to the corner on desktop where the nav is gone.
        'fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-[60] hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold backdrop-blur-md sm:flex lg:bottom-4',
        mode === 'DEMO' ? 'border-brand-emerald/30 bg-brand-emerald/10 text-brand-emerald' : 'border-brand-blue/30 bg-brand-blue/10 text-brand-blue',
      )}
    >
      <span className={cn('h-2 w-2 animate-pulse-glow rounded-full', mode === 'DEMO' ? 'bg-brand-emerald' : 'bg-brand-blue')} />
      {mode === 'DEMO' ? 'Demo Mode' : 'Live Mode'}
    </div>
  );
}

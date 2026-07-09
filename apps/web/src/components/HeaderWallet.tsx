'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { api } from '@/lib/api';
import { useMode } from '@/lib/useMode';
import { useLiveSync } from '@/lib/useLiveSync';
import { formatCurrency } from '@/lib/utils';

// Compact live trading-account balance + Deposit/Withdraw quick actions for the
// app header. Mode-aware and refreshed in real time via the SSE live-sync bus.
// Desktop only (lg+); on smaller screens the same actions live in the mobile
// drawer + the bottom-nav Assets tab.
export function HeaderWallet() {
  const { mode, hydrated, init } = useMode();
  const [equity, setEquity] = useState<number | null>(null);

  useEffect(() => {
    if (!hydrated) init();
  }, [hydrated, init]);

  const load = useCallback(() => {
    api.get<{ equity: number }>('/api/account/summary').then((d) => setEquity(d.equity)).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load, mode]);
  useLiveSync(load);

  return (
    <div className="hidden items-center gap-2 lg:flex">
      <Link
        href="/wallet"
        className="flex flex-col rounded-lg border border-white/10 bg-white/5 px-3 py-1 leading-tight transition-colors hover:border-brand-blue/40"
        aria-label="Wallet balance"
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">Balance</span>
        <span className="font-mono text-sm font-semibold text-white">{equity == null ? '—' : formatCurrency(equity)}</span>
      </Link>
      <Link href="/wallet?tab=DEPOSIT" className="btn-primary px-3 py-2 text-xs">
        <ArrowDownToLine size={14} /> Deposit
      </Link>
      <Link href="/wallet?tab=WITHDRAW" className="btn-ghost px-3 py-2 text-xs">
        <ArrowUpFromLine size={14} /> Withdraw
      </Link>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, TrendingUp, FileText, X } from 'lucide-react';
import { useTickers, assetName } from '@/lib/useTickers';
import { cn } from '@/lib/utils';

const PAGES = [
  { label: 'Markets', href: '/markets' },
  { label: 'Trading Terminal', href: '/trading' },
  { label: 'Copy Trading', href: '/copy-trading' },
  { label: 'AI Assistant', href: '/ai' },
  { label: 'Portfolio', href: '/portfolio' },
  { label: 'Wallet', href: '/wallet' },
  { label: 'Calculators', href: '/tools' },
  { label: 'News', href: '/news' },
  { label: 'Academy', href: '/academy' },
  { label: 'Economic Calendar', href: '/calendar' },
  { label: 'Referral', href: '/referral' },
  { label: 'Settings', href: '/settings' },
  { label: 'KYC Verification', href: '/kyc' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Admin Panel', href: '/admin' },
];

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const router = useRouter();
  const { tickers } = useTickers(15000);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    const pages = PAGES.filter((p) => p.label.toLowerCase().includes(term)).map((p) => ({
      kind: 'page' as const,
      label: p.label,
      href: p.href,
    }));
    const assets = tickers
      .filter((t) => assetName(t.symbol).toLowerCase().includes(term) || t.symbol.toLowerCase().includes(term))
      .slice(0, 6)
      .map((t) => ({ kind: 'asset' as const, label: `${assetName(t.symbol)}/USDT`, href: `/trading?symbol=${t.symbol}`, price: t.price }));
    return term ? [...assets, ...pages].slice(0, 10) : PAGES.slice(0, 6).map((p) => ({ kind: 'page' as const, label: p.label, href: p.href }));
  }, [q, tickers]);

  useEffect(() => setActive(0), [q]);

  const go = (href: string) => {
    setOpen(false);
    setQ('');
    router.push(href);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-400 transition hover:bg-white/10 lg:flex"
        aria-label="Search"
      >
        <Search size={15} />
        <span>Search</span>
        <kbd className="rounded bg-white/10 px-1.5 text-[10px] text-slate-300">⌘K</kbd>
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center bg-black/60 p-4 pt-[12vh] backdrop-blur-sm" onClick={() => setOpen(false)}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-bg-surface shadow-card" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-white/10 px-4">
          <Search size={18} className="text-slate-500" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') setActive((a) => Math.min(a + 1, results.length - 1));
              if (e.key === 'ArrowUp') setActive((a) => Math.max(a - 1, 0));
              if (e.key === 'Enter' && results[active]) go(results[active].href);
            }}
            placeholder="Search assets and pages…"
            className="flex-1 bg-transparent py-4 text-sm text-white placeholder:text-slate-500 focus:outline-none"
          />
          <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-500 hover:text-white">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-slate-500">No results</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.kind}-${r.label}`}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(r.href)}
                className={cn('flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left', i === active ? 'bg-white/10' : 'hover:bg-white/5')}
              >
                <span className="flex items-center gap-3">
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg', r.kind === 'asset' ? 'bg-brand-emerald/15 text-brand-emerald' : 'bg-brand-blue/15 text-brand-blue')}>
                    {r.kind === 'asset' ? <TrendingUp size={14} /> : <FileText size={14} />}
                  </span>
                  <span className="text-sm text-white">{r.label}</span>
                </span>
                {r.kind === 'asset' && 'price' in r && (
                  <span className="font-mono text-xs text-slate-400">${r.price.toLocaleString()}</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

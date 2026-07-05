'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Search, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { MarketingNav } from '@/components/marketing/MarketingNav';
import { MarketingFooter } from '@/components/marketing/MarketingFooter';
import { api } from '@/lib/api';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatCompact, cn } from '@/lib/utils';

export default function MarketsPage() {
  const { tickers, loading, live } = useTickers(6000);
  const [q, setQ] = useState('');
  const [fng, setFng] = useState<{ value: number; label: string } | null>(null);

  useEffect(() => {
    api.get<{ value: number; label: string }>('/api/market/fear-greed').then(setFng).catch(() => {});
  }, []);

  const filtered = tickers.filter((t) => assetName(t.symbol).toLowerCase().includes(q.toLowerCase()));
  const gainers = [...tickers].sort((a, b) => b.change - a.change)[0];
  const avg = tickers.length ? tickers.reduce((s, t) => s + t.change, 0) / tickers.length : 0;

  return (
    <div className="min-h-screen bg-bg text-[#E8F1FF]" style={{ fontFamily: "'Figtree', system-ui, sans-serif" }}>
      <MarketingNav />

      <section className="bg-gradient-to-b from-[#0F1D35] to-bg">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-4xl font-extrabold tracking-tight text-[#E8F1FF]">Markets</h1>
              <p className="mt-2 flex items-center gap-2 text-[#A0BDD8]">
                Live cryptocurrency prices
                <span className={cn('inline-flex items-center gap-1 text-xs font-semibold', live ? 'text-[#34D399]' : 'text-[#5E7A96]')}>
                  <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'bg-[#34D399]' : 'bg-[#5E7A96]')} />{live ? 'LIVE' : 'DELAYED'}
                </span>
              </p>
            </div>
            <div className="relative w-full sm:w-72">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#5E7A96]" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search assets…" className="w-full rounded-full border border-[#12233a] bg-bg-surface py-2.5 pl-10 pr-4 text-sm text-[#E8F1FF] placeholder:text-[#5E7A96] focus:border-[#0EA5E9] focus:outline-none" />
            </div>
          </div>

          {/* Sentiment stats */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              { label: 'Market bias (24h avg)', value: `${avg >= 0 ? '+' : ''}${avg.toFixed(2)}%`, tone: avg >= 0 ? 'up' : 'down' as const },
              { label: 'Top mover', value: gainers ? `${assetName(gainers.symbol)} ${gainers.change >= 0 ? '+' : ''}${gainers.change.toFixed(1)}%` : '—', tone: 'up' as const },
              { label: 'Fear & Greed', value: fng ? `${fng.value} · ${fng.label}` : '—', tone: 'neutral' as const },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl border border-[#12233a] bg-bg-surface p-5">
                <div className="flex items-center gap-2 text-sm text-[#A0BDD8]"><Activity size={15} /> {s.label}</div>
                <div className={cn('mt-1.5 text-xl font-bold', s.tone === 'up' ? 'text-[#34D399]' : s.tone === 'down' ? 'text-[#F87171]' : 'text-[#E8F1FF]')}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="overflow-hidden rounded-2xl border border-[#12233a] bg-bg-surface">
          <div className="grid grid-cols-12 gap-4 border-b border-[#0F1D35] px-6 py-3 text-xs font-semibold uppercase tracking-wide text-[#5E7A96]">
            <div className="col-span-5">Asset</div>
            <div className="col-span-3 text-right">Price</div>
            <div className="col-span-2 text-right">24h</div>
            <div className="col-span-2 text-right">Volume</div>
          </div>
          {loading && tickers.length === 0 ? (
            <div className="space-y-2 p-6">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-[#0F1D35]" />)}</div>
          ) : (
            <div className="divide-y divide-[#0F1D35]">
              {filtered.map((t) => (
                <Link key={t.symbol} href={`/trading?symbol=${t.symbol}`} className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition hover:bg-[#080F1C]">
                  <div className="col-span-5 flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F1D35] text-xs font-bold text-[#0EA5E9]">{assetName(t.symbol).slice(0, 3)}</div>
                    <div>
                      <div className="font-medium text-[#E8F1FF]">{assetName(t.symbol)}</div>
                      <div className="text-xs text-[#5E7A96]">{t.symbol}</div>
                    </div>
                  </div>
                  <div className="col-span-3 text-right font-medium text-[#E8F1FF]">${t.price.toLocaleString()}</div>
                  <div className={cn('col-span-2 flex items-center justify-end gap-1 text-sm font-semibold', t.change >= 0 ? 'text-[#34D399]' : 'text-[#F87171]')}>
                    {t.change >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}{Math.abs(t.change).toFixed(2)}%
                  </div>
                  <div className="col-span-2 text-right text-sm text-[#5E7A96]">${formatCompact(t.volume)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      <MarketingFooter />
    </div>
  );
}

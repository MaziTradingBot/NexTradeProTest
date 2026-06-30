'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Search, Star } from 'lucide-react';
import { Navbar } from '@/components/Navbar';
import { Footer } from '@/components/Footer';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, formatCompact, cn } from '@/lib/utils';

export default function MarketsPage() {
  const { tickers, loading } = useTickers(6000);
  const [q, setQ] = useState('');

  const filtered = tickers.filter((t) => assetName(t.symbol).toLowerCase().includes(q.toLowerCase()));

  return (
    <main>
      <Navbar />
      <section className="mx-auto max-w-7xl px-4 pt-28 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white sm:text-4xl">Markets</h1>
            <p className="mt-2 text-slate-400">Live cryptocurrency prices and 24h statistics.</p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search assets..."
              className="input pl-10"
            />
          </div>
        </div>

        <div className="card mt-8 overflow-hidden p-0">
          <div className="grid grid-cols-12 gap-4 border-b border-white/10 px-6 py-3 text-xs font-medium uppercase tracking-wide text-slate-500">
            <div className="col-span-4">Asset</div>
            <div className="col-span-3 text-right">Price</div>
            <div className="col-span-2 text-right">24h</div>
            <div className="col-span-3 text-right">Volume</div>
          </div>

          {loading && tickers.length === 0 ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 animate-pulse rounded bg-white/5" />
              ))}
            </div>
          ) : (
            <div className="divide-y divide-white/5">
              {filtered.map((t) => (
                <Link
                  key={t.symbol}
                  href={`/trading?symbol=${t.symbol}`}
                  className="grid grid-cols-12 items-center gap-4 px-6 py-4 transition-colors hover:bg-white/5"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <Star size={15} className="text-slate-600" />
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
                      {assetName(t.symbol).slice(0, 3)}
                    </div>
                    <div>
                      <div className="font-medium text-white">{assetName(t.symbol)}</div>
                      <div className="text-xs text-slate-500">{t.symbol}</div>
                    </div>
                  </div>
                  <div className="col-span-3 text-right font-mono text-white">
                    ${t.price.toLocaleString()}
                  </div>
                  <div
                    className={cn(
                      'col-span-2 text-right font-medium',
                      t.change >= 0 ? 'text-brand-emerald' : 'text-red-400',
                    )}
                  >
                    {formatPercent(t.change)}
                  </div>
                  <div className="col-span-3 text-right font-mono text-slate-400">
                    ${formatCompact(t.volume)}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <div className="h-20" />
      <Footer />
    </main>
  );
}

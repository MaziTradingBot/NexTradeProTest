'use client';

import Link from 'next/link';
import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, cn } from '@/lib/utils';

// Color intensity scales with the magnitude of the 24h move.
function bg(change: number) {
  const mag = Math.min(Math.abs(change) / 6, 1); // clamp at ±6%
  const alpha = 0.12 + mag * 0.4;
  return change >= 0 ? `rgba(0,200,150,${alpha})` : `rgba(255,107,107,${alpha})`;
}

export function Heatmap() {
  const { tickers } = useTickers(8000);

  return (
    <div className="card">
      <h3 className="mb-3 text-sm font-semibold text-white">Market Heatmap</h3>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
        {(tickers.length ? tickers : Array.from({ length: 12 })).map((t, i) => {
          const ticker = t as ReturnType<typeof useTickers>['tickers'][number] | undefined;
          if (!ticker) return <div key={i} className="h-16 animate-pulse rounded-xl bg-white/5" />;
          return (
            <Link
              key={ticker.symbol}
              href={`/trading?symbol=${ticker.symbol}`}
              className="flex h-16 flex-col items-center justify-center rounded-xl border border-white/5 transition hover:scale-[1.03]"
              style={{ background: bg(ticker.change) }}
            >
              <span className="text-sm font-semibold text-white">{assetName(ticker.symbol)}</span>
              <span className={cn('text-xs font-medium', ticker.change >= 0 ? 'text-brand-emerald' : 'text-red-300')}>
                {formatPercent(ticker.change)}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

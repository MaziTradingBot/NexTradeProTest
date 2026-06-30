'use client';

import { useTickers, assetName } from '@/lib/useTickers';
import { formatPercent, cn } from '@/lib/utils';

export function TickerTape() {
  const { tickers } = useTickers(8000);
  if (tickers.length === 0) {
    return <div className="h-10 border-y border-white/10 bg-bg-surface/50" />;
  }
  const row = [...tickers, ...tickers];

  return (
    <div className="relative overflow-hidden border-y border-white/10 bg-bg-surface/50 py-2.5">
      <div className="flex w-max gap-8 whitespace-nowrap" style={{ animation: 'nxp-marquee 45s linear infinite' }}>
        {row.map((t, i) => (
          <span key={`${t.symbol}-${i}`} className="inline-flex items-center gap-2 text-sm">
            <span className="font-semibold text-white">{assetName(t.symbol)}</span>
            <span className="font-mono text-slate-300">${t.price.toLocaleString()}</span>
            <span className={cn('font-mono', t.change >= 0 ? 'text-brand-emerald' : 'text-red-400')}>
              {formatPercent(t.change)}
            </span>
          </span>
        ))}
      </div>
      <style>{`@keyframes nxp-marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
    </div>
  );
}

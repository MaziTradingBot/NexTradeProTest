'use client';

import { useEffect, useMemo, useState } from 'react';
import { useOrderBook, type DepthLevel } from '@/lib/useOrderBook';
import { cn } from '@/lib/utils';

// Simulated fallback derived from the mid price when the live socket is down.
function useSimBook(price: number, live: boolean) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    if (live) return;
    const id = setInterval(() => setSeed((s) => s + 1), 1500);
    return () => clearInterval(id);
  }, [live]);

  return useMemo(() => {
    if (!price) return { asks: [] as DepthLevel[], bids: [] as DepthLevel[] };
    const rng = (n: number) => (Math.sin(seed * 13.7 + n * 7.3) + 1) / 2;
    const step = price * 0.0004;
    const rows = (dir: 1 | -1) =>
      Array.from({ length: 10 }).map((_, i) => ({
        price: price + dir * step * (i + 1),
        size: +(0.05 + rng(i + (dir === 1 ? 0 : 50)) * 2.4).toFixed(3),
      }));
    return { asks: rows(1), bids: rows(-1) };
  }, [price, seed]);
}

// A depth level enriched with the running cumulative size out from the mid.
type CumLevel = DepthLevel & { cum: number };

// Accumulate size from the best price (index 0, nearest the mid) outward so the
// depth bars visualise resting liquidity like a professional ladder.
function withCum(levels: DepthLevel[]): CumLevel[] {
  let run = 0;
  return levels.map((l) => ({ ...l, cum: (run += l.size) }));
}

export function OrderBook({ price, symbol }: { price: number; symbol: string }) {
  const { bids: liveBids, asks: liveAsks, live } = useOrderBook(symbol);
  const sim = useSimBook(price, live);

  // Best-first slices, then cumulative depth for the heatmap.
  const rawAsks = (live && liveAsks.length ? liveAsks : sim.asks).slice(0, 10); // ascending from best ask
  const rawBids = (live && liveBids.length ? liveBids : sim.bids).slice(0, 10); // descending from best bid
  const asksC = withCum(rawAsks);
  const bidsC = withCum(rawBids);
  const maxCum = Math.max(asksC.at(-1)?.cum ?? 1, bidsC.at(-1)?.cum ?? 1, 1);
  const asks = [...asksC].reverse(); // farthest ask on top, best ask just above the mid
  const bids = bidsC; // best bid just below the mid
  const spread = rawAsks.length && rawBids.length ? rawAsks[0].price - rawBids[0].price : 0;
  const spreadPct = price ? (spread / price) * 100 : 0;
  const dp = price && price < 2 ? 4 : 2;

  const Row = ({ r, side }: { r: CumLevel; side: 'ask' | 'bid' }) => (
    <div className="relative grid grid-cols-3 px-3 py-0.5 font-mono text-xs">
      {/* Cumulative-depth heatmap bar */}
      <div
        className={cn('absolute inset-y-0 right-0 transition-[width] duration-300', side === 'ask' ? 'bg-red-500/10' : 'bg-brand-emerald/10')}
        style={{ width: `${(r.cum / maxCum) * 100}%` }}
      />
      <span className={cn('relative z-10', side === 'ask' ? 'text-red-400' : 'text-brand-emerald')}>{r.price.toFixed(dp)}</span>
      <span className="relative z-10 text-right text-slate-300">{r.size.toFixed(3)}</span>
      <span className="relative z-10 text-right text-slate-500">{r.cum.toFixed(3)}</span>
    </div>
  );

  return (
    <div className="card p-0">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-white">Order Book</span>
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          <span className={cn('h-1.5 w-1.5 rounded-full', live ? 'animate-pulse-glow bg-brand-emerald' : 'bg-slate-500')} />
          <span className={live ? 'text-brand-emerald' : 'text-slate-500'}>{live ? 'LIVE' : 'SIM'}</span>
        </span>
      </div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Total</span>
      </div>
      <div>{asks.map((r, i) => <Row key={`a${i}`} r={r} side="ask" />)}</div>
      {/* Sticky current price / spread band between the two sides */}
      <div className="sticky top-0 z-20 my-1 flex items-center justify-center gap-2 border-y border-white/5 bg-bg-surface/95 px-3 py-1.5 backdrop-blur">
        <span className="font-mono text-sm font-semibold text-white">${price ? price.toLocaleString(undefined, { maximumFractionDigits: dp }) : '—'}</span>
        <span className="text-[10px] font-normal text-slate-500">spread {spread.toFixed(dp)} ({spreadPct.toFixed(3)}%)</span>
      </div>
      <div className="pb-2">{bids.map((r, i) => <Row key={`b${i}`} r={r} side="bid" />)}</div>
    </div>
  );
}

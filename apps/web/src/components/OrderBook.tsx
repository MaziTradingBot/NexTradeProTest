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

export function OrderBook({ price, symbol }: { price: number; symbol: string }) {
  const { bids: liveBids, asks: liveAsks, live } = useOrderBook(symbol);
  const sim = useSimBook(price, live);

  const asks = (live && liveAsks.length ? [...liveAsks] : sim.asks).slice(0, 10).reverse();
  const bids = (live && liveBids.length ? liveBids : sim.bids).slice(0, 10);
  const spread = asks.length && bids.length ? asks[asks.length - 1].price - bids[0].price : 0;
  const max = Math.max(...[...asks, ...bids].map((r) => r.size), 1);

  const Row = ({ r, side }: { r: DepthLevel; side: 'ask' | 'bid' }) => (
    <div className="relative grid grid-cols-3 px-3 py-0.5 font-mono text-xs">
      <div
        className={cn('absolute inset-y-0 right-0', side === 'ask' ? 'bg-red-500/10' : 'bg-brand-emerald/10')}
        style={{ width: `${(r.size / max) * 100}%` }}
      />
      <span className={cn('relative z-10', side === 'ask' ? 'text-red-400' : 'text-brand-emerald')}>{r.price.toFixed(2)}</span>
      <span className="relative z-10 text-right text-slate-300">{r.size.toFixed(3)}</span>
      <span className="relative z-10 text-right text-slate-500">{(r.price * r.size).toFixed(0)}</span>
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
      <div className="my-1 px-3 py-1 text-center font-mono text-sm font-semibold text-white">
        ${price ? price.toLocaleString() : '—'}
        <span className="ml-2 text-xs font-normal text-slate-500">spread {spread.toFixed(2)}</span>
      </div>
      <div className="pb-2">{bids.map((r, i) => <Row key={`b${i}`} r={r} side="bid" />)}</div>
    </div>
  );
}

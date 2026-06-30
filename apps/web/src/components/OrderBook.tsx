'use client';

import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/lib/utils';

// A lightweight simulated order book derived from the live mid price.
// (Real depth would come from a WebSocket feed; this keeps the demo self-contained.)
export function OrderBook({ price }: { price: number }) {
  const [seed, setSeed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeed((s) => s + 1), 1500);
    return () => clearInterval(id);
  }, []);

  const { asks, bids, spread } = useMemo(() => {
    if (!price) return { asks: [], bids: [], spread: 0 };
    const rng = (n: number) => ((Math.sin(seed * 13.7 + n * 7.3) + 1) / 2);
    const step = price * 0.0004;
    const rows = (dir: 1 | -1) =>
      Array.from({ length: 9 }).map((_, i) => {
        const p = price + dir * step * (i + 1);
        const size = +(0.05 + rng(i + (dir === 1 ? 0 : 50)) * 2.4).toFixed(3);
        return { price: p, size, total: +(p * size).toFixed(0) };
      });
    const a = rows(1).reverse();
    const b = rows(-1);
    return { asks: a, bids: b, spread: a.length ? a[a.length - 1].price - b[0].price : 0 };
  }, [price, seed]);

  const max = Math.max(...[...asks, ...bids].map((r) => r.size), 1);
  const Row = ({ r, side }: { r: { price: number; size: number }; side: 'ask' | 'bid' }) => (
    <div className="relative grid grid-cols-3 px-3 py-0.5 font-mono text-xs">
      <div
        className={cn('absolute inset-y-0 right-0', side === 'ask' ? 'bg-red-500/10' : 'bg-brand-emerald/10')}
        style={{ width: `${(r.size / max) * 100}%` }}
      />
      <span className={cn('relative z-10', side === 'ask' ? 'text-red-400' : 'text-brand-emerald')}>
        {r.price.toFixed(2)}
      </span>
      <span className="relative z-10 text-right text-slate-300">{r.size.toFixed(3)}</span>
      <span className="relative z-10 text-right text-slate-500">{(r.price * r.size).toFixed(0)}</span>
    </div>
  );

  return (
    <div className="card p-0">
      <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Order Book</div>
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

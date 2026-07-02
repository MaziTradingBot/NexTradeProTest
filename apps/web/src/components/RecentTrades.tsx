'use client';

import { useEffect, useRef, useState } from 'react';
import { useOrderBook, type Trade } from '@/lib/useOrderBook';
import { cn } from '@/lib/utils';

// Simulated trade prints when the live socket is unavailable.
function useSimTrades(price: number, live: boolean) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const ref = useRef<Trade[]>([]);
  useEffect(() => {
    if (live || !price) return;
    const id = setInterval(() => {
      const jitter = price * (Math.random() * 0.0008 - 0.0004);
      const t: Trade = {
        price: price + jitter,
        size: +(Math.random() * 1.5 + 0.01).toFixed(4),
        time: Date.now(),
        buyerMaker: Math.random() > 0.5,
      };
      ref.current = [t, ...ref.current].slice(0, 24);
      setTrades([...ref.current]);
    }, 1200);
    return () => clearInterval(id);
  }, [price, live]);
  return trades;
}

export function RecentTrades({ price, symbol }: { price: number; symbol: string }) {
  const { trades: liveTrades, live } = useOrderBook(symbol);
  const simTrades = useSimTrades(price, live);
  const trades = (live && liveTrades.length ? liveTrades : simTrades).slice(0, 20);

  return (
    <div className="card p-0">
      <div className="border-b border-white/10 px-4 py-3 text-sm font-semibold text-white">Recent Trades</div>
      <div className="grid grid-cols-3 px-3 py-1.5 text-[10px] uppercase tracking-wide text-slate-500">
        <span>Price</span>
        <span className="text-right">Size</span>
        <span className="text-right">Time</span>
      </div>
      <div className="max-h-[280px] overflow-y-auto pb-2">
        {trades.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-slate-500">Waiting for trades…</div>
        ) : (
          trades.map((t, i) => (
            <div key={i} className="grid grid-cols-3 px-3 py-0.5 font-mono text-xs">
              <span className={cn(t.buyerMaker ? 'text-red-400' : 'text-brand-emerald')}>{t.price.toFixed(2)}</span>
              <span className="text-right text-slate-300">{t.size.toFixed(4)}</span>
              <span className="text-right text-slate-500">{new Date(t.time).toLocaleTimeString([], { hour12: false })}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

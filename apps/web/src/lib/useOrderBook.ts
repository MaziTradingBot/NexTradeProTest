'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export interface DepthLevel {
  price: number;
  size: number;
}
export interface Trade {
  price: number;
  size: number;
  time: number;
  buyerMaker: boolean;
}

/**
 * Live order book (partial depth) + recent trades. Polls the NexTradePro
 * backend, which proxies the exchange (see docs/07-Market-Data-Service.md) —
 * the frontend never connects to Binance/Bybit directly. `live` reflects
 * whether the backend returned data; callers fall back to a simulated book.
 */
export function useOrderBook(symbol: string) {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [live, setLive] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;
    const s = symbol.toUpperCase();

    setBids([]);
    setAsks([]);
    setTrades([]);
    setLive(false);

    const load = async () => {
      try {
        const [book, tr] = await Promise.all([
          api.get<{ bids: DepthLevel[]; asks: DepthLevel[] }>(`/api/market/orderbook?symbol=${s}`),
          api.get<Trade[]>(`/api/market/trades?symbol=${s}`),
        ]);
        if (!activeRef.current) return;
        const hasBook = (book.bids?.length ?? 0) > 0 || (book.asks?.length ?? 0) > 0;
        setBids(book.bids ?? []);
        setAsks(book.asks ?? []);
        setTrades(tr ?? []);
        setLive(hasBook);
      } catch {
        if (activeRef.current) setLive(false);
      }
    };

    load();
    const id = setInterval(load, 1500);
    return () => {
      activeRef.current = false;
      clearInterval(id);
    };
  }, [symbol]);

  return { bids, asks, trades, live };
}

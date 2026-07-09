'use client';

import { useEffect, useRef, useState } from 'react';
import { api, API_BASE } from './api';

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
 * Live order book (streaming L2 depth) + recent trades. Depth arrives over a
 * Server-Sent-Events stream that the backend relays from an exchange websocket
 * (see lib/orderbookStream) — the frontend never connects to Binance/Bybit
 * directly. When the stream is quiet (unsupported / unreachable) it falls back
 * to the REST depth snapshot, and the component to a simulated book. Trades are
 * polled over REST. `live` reflects whether real depth is flowing.
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

    let lastStreamAt = 0;

    // Primary: live depth via SSE (backend relays the exchange websocket).
    let es: EventSource | null = null;
    try {
      es = new EventSource(`${API_BASE}/api/market/orderbook/stream?symbol=${s}`);
      es.addEventListener('depth', (ev) => {
        if (!activeRef.current) return;
        try {
          const book = JSON.parse((ev as MessageEvent).data) as { bids?: DepthLevel[]; asks?: DepthLevel[] };
          if ((book.bids?.length ?? 0) || (book.asks?.length ?? 0)) {
            lastStreamAt = Date.now();
            setBids(book.bids ?? []);
            setAsks(book.asks ?? []);
            setLive(true);
          }
        } catch {
          /* ignore */
        }
      });
    } catch {
      /* EventSource unavailable — REST fallback below covers it */
    }

    // Trades poll + REST depth fallback (only used while the stream is quiet).
    const load = async () => {
      try {
        const tr = await api.get<Trade[]>(`/api/market/trades?symbol=${s}`);
        if (activeRef.current) setTrades(tr ?? []);
      } catch {
        /* keep last trades */
      }
      if (Date.now() - lastStreamAt < 4000) return; // stream is healthy
      try {
        const book = await api.get<{ bids: DepthLevel[]; asks: DepthLevel[] }>(`/api/market/orderbook?symbol=${s}`);
        if (!activeRef.current) return;
        const hasBook = (book.bids?.length ?? 0) > 0 || (book.asks?.length ?? 0) > 0;
        if (hasBook) {
          setBids(book.bids ?? []);
          setAsks(book.asks ?? []);
          setLive(true);
        } else if (Date.now() - lastStreamAt >= 4000) {
          setLive(false);
        }
      } catch {
        if (activeRef.current && Date.now() - lastStreamAt >= 4000) setLive(false);
      }
    };

    load();
    const id = setInterval(load, 2000);
    return () => {
      activeRef.current = false;
      clearInterval(id);
      es?.close();
    };
  }, [symbol]);

  return { bids, asks, trades, live };
}

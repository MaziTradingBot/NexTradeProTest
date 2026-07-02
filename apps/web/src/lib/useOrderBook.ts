'use client';

import { useEffect, useRef, useState } from 'react';

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
 * Live order book (partial depth) + recent trades from Binance public
 * WebSocket streams. Exposes `live` so callers can fall back to a simulated
 * book when the socket is unavailable (restricted networks).
 */
export function useOrderBook(symbol: string) {
  const [bids, setBids] = useState<DepthLevel[]>([]);
  const [asks, setAsks] = useState<DepthLevel[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [live, setLive] = useState(false);
  const tradesRef = useRef<Trade[]>([]);

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    const s = symbol.toLowerCase();

    setBids([]);
    setAsks([]);
    setTrades([]);
    tradesRef.current = [];
    setLive(false);

    try {
      ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${s}@depth20@100ms/${s}@aggTrade`);

      const failTimer = setTimeout(() => {
        if (ws && ws.readyState !== WebSocket.OPEN) ws.close();
      }, 4000);

      ws.onopen = () => {
        clearTimeout(failTimer);
        if (active) setLive(true);
      };

      ws.onmessage = (ev) => {
        if (!active) return;
        try {
          const { stream, data } = JSON.parse(ev.data as string);
          if (stream?.includes('@depth')) {
            setAsks((data.asks as string[][]).map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 12));
            setBids((data.bids as string[][]).map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 12));
          } else if (stream?.includes('@aggTrade')) {
            const t: Trade = { price: +data.p, size: +data.q, time: data.T, buyerMaker: data.m };
            tradesRef.current = [t, ...tradesRef.current].slice(0, 30);
            setTrades(tradesRef.current);
          }
        } catch {
          /* ignore malformed frame */
        }
      };

      ws.onerror = () => active && setLive(false);
      ws.onclose = () => active && setLive(false);
    } catch {
      setLive(false);
    }

    return () => {
      active = false;
      if (ws) ws.close();
    };
  }, [symbol]);

  return { bids, asks, trades, live };
}

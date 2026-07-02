'use client';

import { useEffect, useRef, useState } from 'react';
import { api } from './api';

export interface Ticker {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

const SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT',
];

/**
 * Live ticker feed. Seeds from the REST endpoint for instant data, then
 * upgrades to a Binance public WebSocket stream for real-time ticks. Falls
 * back to REST polling if the socket can't connect (restricted networks).
 */
export function useTickers(pollMs = 6000) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const mapRef = useRef<Map<string, Ticker>>(new Map());

  useEffect(() => {
    let active = true;
    let ws: WebSocket | null = null;
    let pollId: ReturnType<typeof setInterval> | null = null;

    const commit = () => {
      if (!active) return;
      setTickers(SYMBOLS.map((s) => mapRef.current.get(s)).filter(Boolean) as Ticker[]);
    };

    const seed = async () => {
      try {
        const data = await api.get<Ticker[]>('/api/market/tickers');
        if (!active) return;
        data.forEach((t) => mapRef.current.set(t.symbol, t));
        commit();
        setLoading(false);
      } catch {
        if (active) setLoading(false);
      }
    };

    const startPolling = () => {
      if (pollId) return;
      pollId = setInterval(seed, pollMs);
    };

    const connectWs = () => {
      try {
        const streams = SYMBOLS.map((s) => `${s.toLowerCase()}@miniTicker`).join('/');
        ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);

        const failTimer = setTimeout(() => {
          if (ws && ws.readyState !== WebSocket.OPEN) {
            ws.close();
            startPolling();
          }
        }, 4000);

        ws.onopen = () => {
          clearTimeout(failTimer);
          if (active) setLive(true);
          if (pollId) {
            clearInterval(pollId);
            pollId = null;
          }
        };

        ws.onmessage = (ev) => {
          try {
            const { data } = JSON.parse(ev.data as string);
            if (!data?.s) return;
            const open = parseFloat(data.o);
            const close = parseFloat(data.c);
            mapRef.current.set(data.s, {
              symbol: data.s,
              price: close,
              change: open ? ((close - open) / open) * 100 : 0,
              high: parseFloat(data.h),
              low: parseFloat(data.l),
              volume: parseFloat(data.q),
            });
            commit();
          } catch {
            /* ignore malformed frame */
          }
        };

        ws.onerror = () => {
          if (active) setLive(false);
          startPolling();
        };
        ws.onclose = () => {
          if (active) setLive(false);
          startPolling();
        };
      } catch {
        startPolling();
      }
    };

    seed();
    connectWs();

    return () => {
      active = false;
      if (ws) ws.close();
      if (pollId) clearInterval(pollId);
    };
  }, [pollMs]);

  return { tickers, loading, live };
}

export function assetName(symbol: string): string {
  return symbol.replace('USDT', '');
}

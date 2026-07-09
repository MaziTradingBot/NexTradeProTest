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
  fundingRate?: number | null; // decimal per 8h (0.0001 = 0.01%); null if no perp
  openInterest?: number | null; // base units; null if no perp
}

/**
 * Live ticker feed. Polls the NexTradePro backend (`/api/market/tickers`),
 * which is kept fresh by the server-side Market Data Service. The frontend
 * never talks to an exchange directly (see docs/07-Market-Data-Service.md).
 */
export function useTickers(pollMs = 5000) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const load = async () => {
      try {
        const data = await api.get<Ticker[]>('/api/market/tickers?limit=60');
        if (!activeRef.current) return;
        setTickers(data);
        setLive(true);
        setLoading(false);
      } catch {
        if (activeRef.current) {
          setLive(false);
          setLoading(false);
        }
      }
    };

    load();
    const id = setInterval(load, pollMs);
    return () => {
      activeRef.current = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { tickers, loading, live };
}

export function assetName(symbol: string): string {
  return symbol.replace('USDT', '');
}

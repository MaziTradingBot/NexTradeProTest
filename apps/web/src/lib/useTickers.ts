'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export interface Ticker {
  symbol: string;
  price: number;
  change: number;
  high: number;
  low: number;
  volume: number;
}

export function useTickers(pollMs = 6000) {
  const [tickers, setTickers] = useState<Ticker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const data = await api.get<Ticker[]>('/api/market/tickers');
        if (active) {
          setTickers(data);
          setLoading(false);
        }
      } catch {
        if (active) setLoading(false);
      }
    };
    load();
    const id = setInterval(load, pollMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [pollMs]);

  return { tickers, loading };
}

export function assetName(symbol: string): string {
  return symbol.replace('USDT', '');
}

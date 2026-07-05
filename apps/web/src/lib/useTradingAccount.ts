'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import { useMode } from './useMode';

export interface Position {
  id: string;
  symbol: string;
  side: 'BUY' | 'SELL';
  leverage: number;
  entryPrice: number;
  amount: number;
  margin: number;
  markPrice: number;
  stopLoss: number | null;
  takeProfit: number | null;
  createdAt: string;
}

export interface AccountSummary {
  currency: string;
  mode: 'DEMO' | 'LIVE';
  balance: number;
  locked: number;
  equity: number;
  usedMargin: number;
  freeMargin: number;
  marginLevel: number | null;
  floatingPnl: number;
  exposure: number;
  openPositions: number;
  marginCallLevel: number;
  stopOutLevel: number;
  maxLeverage: number;
  positions: Position[];
}

// Fetches the trading-account snapshot and keeps it fresh with light polling so
// server-side events (SL/TP fills, stop-outs) surface without a page refresh.
export function useTradingAccount(pollMs = 4000) {
  const { mode } = useMode();
  const [summary, setSummary] = useState<AccountSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.get<AccountSummary>('/api/account/summary');
      setSummary(s);
    } catch {
      /* ignore transient errors */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    refresh();
    const id = setInterval(refresh, pollMs);
    return () => clearInterval(id);
    // Re-fetch when the account mode switches (Demo ↔ Live).
  }, [refresh, pollMs, mode]);

  return { summary, loading, refresh };
}

// Direction factor: long profits on a rising price, short on a falling one.
export const dir = (side: string) => (side === 'BUY' ? 1 : -1);

export function positionPnl(p: Position, price: number): number {
  return dir(p.side) * (price - p.entryPrice) * p.amount;
}

// Recompute live account metrics from the latest prices (called every tick).
export function liveMetrics(summary: AccountSummary, priceOf: (symbol: string) => number) {
  let floating = 0;
  let exposure = 0;
  let usedMargin = 0;
  for (const p of summary.positions) {
    const px = priceOf(p.symbol) || p.markPrice || p.entryPrice;
    floating += positionPnl(p, px);
    exposure += px * p.amount;
    usedMargin += p.margin;
  }
  const equity = summary.balance + floating;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null;
  return {
    balance: summary.balance,
    equity,
    usedMargin,
    freeMargin,
    marginLevel,
    floatingPnl: floating,
    exposure,
    availableMargin: Math.max(0, freeMargin),
    openPositions: summary.positions.length,
  };
}

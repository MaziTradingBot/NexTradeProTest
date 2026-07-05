// Core trading-engine math shared between the account routes and the
// background engine. USDT-margined: the account currency is USDT, margin and
// realized/floating P/L are all denominated in USDT.

import { Prisma } from '@prisma/client';

export const ACCOUNT_CURRENCY = 'USDT';

// Margin thresholds, expressed as a margin level percentage.
// Margin Level (%) = Equity / Used Margin * 100.
export const MARGIN_CALL_LEVEL = 100; // warn the user below this
export const STOP_OUT_LEVEL = 20; // force-liquidate below this
export const MAX_LEVERAGE = 125;

export type Num = Prisma.Decimal | number | string;

const n = (v: Num): number => (typeof v === 'number' ? v : parseFloat(v.toString()));

// Direction factor: long profits when price rises, short when it falls.
export function directionFactor(side: string): number {
  return side === 'BUY' ? 1 : -1;
}

// Margin required to open a position: notional / leverage (in USDT).
export function requiredMargin(price: Num, amount: Num, leverage: Num): number {
  const lev = Math.max(1, n(leverage));
  return (n(price) * n(amount)) / lev;
}

// Unrealized P/L for an open position at the given market price (USDT).
export function floatingPnl(side: string, entryPrice: Num, amount: Num, marketPrice: Num): number {
  return directionFactor(side) * (n(marketPrice) - n(entryPrice)) * n(amount);
}

export interface PositionLike {
  side: string;
  price: Num; // entry
  amount: Num;
  margin: Num;
  symbol: string;
}

// Aggregate account metrics given open positions + a price map.
export function accountMetrics(balance: Num, positions: PositionLike[], prices: Record<string, number>) {
  let usedMargin = 0;
  let floating = 0;
  let exposure = 0;
  for (const p of positions) {
    const px = prices[p.symbol.toUpperCase()] ?? n(p.price);
    usedMargin += n(p.margin);
    floating += floatingPnl(p.side, p.price, p.amount, px);
    exposure += px * n(p.amount);
  }
  const bal = n(balance);
  const equity = bal + floating;
  const freeMargin = equity - usedMargin;
  const marginLevel = usedMargin > 0 ? (equity / usedMargin) * 100 : null;
  return {
    balance: bal,
    equity,
    usedMargin,
    freeMargin,
    marginLevel,
    floatingPnl: floating,
    exposure,
    openPositions: positions.length,
  };
}

export const round8 = (v: number): number => Math.round(v * 1e8) / 1e8;

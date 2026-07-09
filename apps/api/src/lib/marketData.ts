// NexTradePro — Market Data Service
// ---------------------------------------------------------------------------
// Owns the coin universe and keeps it fresh. The DB (`Coin`) is the runtime
// source of truth; this module seeds it and runs two background loops:
//   • metadata sync  (CoinGecko free) — market cap, rank, supply, logo, 7d change
//   • price sync     (Binance → Bybit) — fast price / 24h change / high-low / volume
// Both degrade gracefully: on any upstream failure we keep the last-known DB
// snapshot so the app never shows an empty market.
//
// The frontend NEVER calls these upstreams — it only reads our /api/market/*.
// ---------------------------------------------------------------------------

import { PrismaClient } from '@prisma/client';
import { COIN_UNIVERSE } from './coinUniverse';

const prisma = new PrismaClient();

const BINANCE = 'https://api.binance.com/api/v3';
const BINANCE_FUT = 'https://fapi.binance.com/fapi/v1';
const BYBIT = 'https://api.bybit.com/v5/market';
const COINGECKO = 'https://api.coingecko.com/api/v3';

const pairOf = (symbol: string) => `${symbol.toUpperCase()}USDT`;

// Rough fallback prices for the majors so an offline/restricted network still
// shows a populated market on first run. Real values overwrite these on sync.
const FALLBACK_PRICE: Record<string, number> = {
  BTC: 67000, ETH: 3500, BNB: 600, SOL: 150, XRP: 0.6, ADA: 0.45, DOGE: 0.16,
  AVAX: 38, TRX: 0.12, LINK: 18, DOT: 7.2, MATIC: 0.9, TON: 7, SHIB: 0.000024,
  LTC: 85, BCH: 480, UNI: 11, ATOM: 9, XLM: 0.11, USDC: 1, USDT: 1, DAI: 1,
};

let seeded = false;

// ---------------------------------------------------------------------------
// Seeding
// ---------------------------------------------------------------------------

export async function seedCoins(): Promise<number> {
  let count = 0;
  for (let i = 0; i < COIN_UNIVERSE.length; i++) {
    const c = COIN_UNIVERSE[i];
    const symbol = c.symbol.toUpperCase();
    const existing = await prisma.coin.findUnique({ where: { symbol } });
    const base = {
      name: c.name,
      pair: c.pair ?? pairOf(symbol),
      website: c.website ?? null,
      explorer: c.explorer ?? null,
      whitepaper: c.whitepaper ?? null,
      categoryKeys: c.categories.join(','),
    };
    const coin = await prisma.coin.upsert({
      where: { symbol },
      update: base, // refresh metadata, keep live snapshot fields
      create: {
        symbol,
        ...base,
        // Seed a plausible starting price so the UI is never blank pre-sync.
        price: FALLBACK_PRICE[symbol] ?? 0,
        rank: i + 1,
      },
    });
    // Sync category tags.
    await prisma.coinCategory.deleteMany({ where: { coinId: coin.id } });
    for (const cat of c.categories) {
      await prisma.coinCategory.create({ data: { coinId: coin.id, category: cat } }).catch(() => {});
    }
    count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Upstream fetchers
// ---------------------------------------------------------------------------

interface GeckoMarket {
  symbol: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  circulating_supply: number;
  max_supply: number | null;
  price_change_percentage_24h_in_currency?: number;
  price_change_percentage_7d_in_currency?: number;
}

// Top coins by market cap (2 pages = up to 500) matched by symbol.
async function fetchGeckoMarkets(): Promise<Map<string, GeckoMarket>> {
  const out = new Map<string, GeckoMarket>();
  for (const page of [1, 2]) {
    const url = `${COINGECKO}/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}&sparkline=false&price_change_percentage=24h,7d`;
    const resp = await fetch(url, { headers: { accept: 'application/json' } });
    if (!resp.ok) throw new Error(`CoinGecko ${resp.status}`);
    const json = (await resp.json()) as GeckoMarket[];
    for (const m of json) {
      const sym = (m.symbol || '').toUpperCase();
      if (sym && !out.has(sym)) out.set(sym, m); // first (highest cap) wins
    }
  }
  return out;
}

interface FastPrice { price: number; change: number; high: number; low: number; volume: number }

async function fetchBinancePrices(pairs: string[]): Promise<Map<string, FastPrice>> {
  const param = encodeURIComponent(JSON.stringify(pairs));
  const resp = await fetch(`${BINANCE}/ticker/24hr?symbols=${param}`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const json = (await resp.json()) as Array<Record<string, string>>;
  const out = new Map<string, FastPrice>();
  for (const t of json) {
    out.set(t.symbol, {
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.priceChangePercent),
      high: parseFloat(t.highPrice),
      low: parseFloat(t.lowPrice),
      volume: parseFloat(t.quoteVolume),
    });
  }
  return out;
}

async function fetchBybitPrices(pairs: string[]): Promise<Map<string, FastPrice>> {
  const resp = await fetch(`${BYBIT}/tickers?category=spot`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const json = (await resp.json()) as { result?: { list?: Array<Record<string, string>> } };
  const wanted = new Set(pairs);
  const out = new Map<string, FastPrice>();
  for (const t of json.result?.list ?? []) {
    if (!wanted.has(t.symbol)) continue;
    out.set(t.symbol, {
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.price24hPcnt) * 100,
      high: parseFloat(t.highPrice24h),
      low: parseFloat(t.lowPrice24h),
      volume: parseFloat(t.turnover24h),
    });
  }
  return out;
}

// Binance USDⓈ-M futures: funding rate + mark/index in one call (premiumIndex),
// open interest per symbol. Pairs without a perp market are simply skipped.
interface FundingData { fundingRate: number }

async function fetchBinanceFunding(): Promise<Map<string, FundingData>> {
  const resp = await fetch(`${BINANCE_FUT}/premiumIndex`);
  if (!resp.ok) throw new Error(`Binance funding ${resp.status}`);
  const json = (await resp.json()) as Array<Record<string, string>>;
  const out = new Map<string, FundingData>();
  for (const t of json) out.set(t.symbol, { fundingRate: parseFloat(t.lastFundingRate) });
  return out;
}

async function fetchBinanceOI(pair: string): Promise<number | null> {
  try {
    const r = await fetch(`${BINANCE_FUT}/openInterest?symbol=${pair}`);
    if (!r.ok) return null;
    const j = (await r.json()) as { openInterest?: string };
    return j.openInterest ? parseFloat(j.openInterest) : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Sync jobs
// ---------------------------------------------------------------------------

let lastMetaSync = 0;
let lastPriceSync = 0;
let lastFuturesSync = 0;

export async function syncMetadata(): Promise<void> {
  let markets: Map<string, GeckoMarket>;
  try {
    markets = await fetchGeckoMarkets();
  } catch {
    return; // keep last-known snapshot
  }
  const coins = await prisma.coin.findMany({ select: { id: true, symbol: true } });
  for (const coin of coins) {
    const m = markets.get(coin.symbol);
    if (!m) continue;
    await prisma.coin.update({
      where: { id: coin.id },
      data: {
        logoUrl: m.image ?? undefined,
        price: m.current_price ?? undefined,
        marketCap: m.market_cap ?? undefined,
        rank: m.market_cap_rank ?? undefined,
        volume24h: m.total_volume ?? undefined,
        high24h: m.high_24h ?? undefined,
        low24h: m.low_24h ?? undefined,
        circulating: m.circulating_supply ?? undefined,
        maxSupply: m.max_supply ?? undefined,
        change24h: m.price_change_percentage_24h_in_currency ?? undefined,
        change7d: m.price_change_percentage_7d_in_currency ?? undefined,
      },
    }).catch(() => {});
  }
  lastMetaSync = Date.now();
}

export async function syncPrices(): Promise<void> {
  const coins = await prisma.coin.findMany({ select: { id: true, pair: true, circulating: true } });
  const pairs = coins.map((c) => c.pair).filter(Boolean) as string[];
  if (pairs.length === 0) return;
  let prices: Map<string, FastPrice>;
  try {
    prices = await fetchBinancePrices(pairs);
    if (prices.size === 0) throw new Error('empty');
  } catch {
    try {
      prices = await fetchBybitPrices(pairs);
    } catch {
      return; // keep last-known snapshot
    }
  }
  for (const coin of coins) {
    const p = coin.pair ? prices.get(coin.pair) : undefined;
    if (!p || !p.price) continue;
    // Refresh market cap from the new price if we know circulating supply.
    const marketCap = coin.circulating ? coin.circulating * p.price : undefined;
    await prisma.coin.update({
      where: { id: coin.id },
      data: {
        price: p.price,
        change24h: p.change,
        high24h: p.high,
        low24h: p.low,
        volume24h: p.volume,
        ...(marketCap ? { marketCap } : {}),
      },
    }).catch(() => {});
  }
  lastPriceSync = Date.now();
}

// Refresh perp funding rate + open interest for the top coins from Binance
// Futures. Funding comes in one batched call; OI is per-symbol so we bound it to
// the top ~50 by rank. Pairs without a perp market are left null.
export async function syncFutures(): Promise<void> {
  let funding: Map<string, FundingData>;
  try {
    funding = await fetchBinanceFunding();
    if (funding.size === 0) return;
  } catch {
    return; // keep last-known snapshot
  }
  const coins = await prisma.coin.findMany({
    where: { pair: { not: null } },
    select: { id: true, pair: true },
    orderBy: { rank: { sort: 'asc', nulls: 'last' } },
    take: 50,
  });
  await Promise.all(
    coins.map(async (coin) => {
      const pair = coin.pair!;
      const f = funding.get(pair);
      const oi = await fetchBinanceOI(pair);
      if (!f && oi == null) return;
      await prisma.coin
        .update({
          where: { id: coin.id },
          data: { ...(f ? { fundingRate: f.fundingRate } : {}), ...(oi != null ? { openInterest: oi } : {}) },
        })
        .catch(() => {});
    }),
  );
  lastFuturesSync = Date.now();
}

export function marketDataStatus() {
  return { seeded, lastMetaSync, lastPriceSync, lastFuturesSync };
}

// ---------------------------------------------------------------------------
// Startup — seed once, then run the two loops.
// ---------------------------------------------------------------------------

export async function startMarketData(): Promise<void> {
  try {
    const existing = await prisma.coin.count();
    if (existing === 0) {
      const n = await seedCoins();
      // eslint-disable-next-line no-console
      console.log(`🪙 Seeded ${n} coins into the universe`);
    }
    seeded = true;
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Coin seed failed:', e);
  }

  // Initial sync (don't block startup).
  syncMetadata().catch(() => {});
  syncPrices().catch(() => {});
  syncFutures().catch(() => {});

  // Metadata: every 5 minutes. Price: every 12 seconds. Futures: every 90s.
  setInterval(() => { syncMetadata().catch(() => {}); }, 5 * 60 * 1000);
  setInterval(() => { syncPrices().catch(() => {}); }, 12 * 1000);
  setInterval(() => { syncFutures().catch(() => {}); }, 90 * 1000);
}

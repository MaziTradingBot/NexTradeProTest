import { Router } from 'express';

const router = Router();

const BINANCE = 'https://api.binance.com/api/v3';
const DEFAULT_SYMBOLS = [
  'BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT',
  'ADAUSDT', 'DOGEUSDT', 'AVAXUSDT', 'LINKUSDT', 'DOTUSDT',
  'MATICUSDT', 'LTCUSDT',
];

// Tiny in-memory cache so we never hammer Binance (keeps the API fast).
const cache = new Map<string, { at: number; data: unknown }>();
const TTL = 5000;

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

const BYBIT = 'https://api.bybit.com/v5/market';

async function fetchBinanceTickers() {
  const symbolsParam = encodeURIComponent(JSON.stringify(DEFAULT_SYMBOLS));
  const resp = await fetch(`${BINANCE}/ticker/24hr?symbols=${symbolsParam}`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const json = (await resp.json()) as Array<Record<string, string>>;
  return json.map((t) => ({
    symbol: t.symbol,
    price: parseFloat(t.lastPrice),
    change: parseFloat(t.priceChangePercent),
    high: parseFloat(t.highPrice),
    low: parseFloat(t.lowPrice),
    volume: parseFloat(t.quoteVolume),
  }));
}

// Bybit public API is the secondary source when Binance is unreachable.
async function fetchBybitTickers() {
  const resp = await fetch(`${BYBIT}/tickers?category=spot`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const json = (await resp.json()) as { result?: { list?: Array<Record<string, string>> } };
  const list = json.result?.list ?? [];
  const wanted = new Set(DEFAULT_SYMBOLS);
  return list
    .filter((t) => wanted.has(t.symbol))
    .map((t) => ({
      symbol: t.symbol,
      price: parseFloat(t.lastPrice),
      change: parseFloat(t.price24hPcnt) * 100, // Bybit returns a fraction
      high: parseFloat(t.highPrice24h),
      low: parseFloat(t.lowPrice24h),
      volume: parseFloat(t.turnover24h),
    }))
    .sort((a, b) => DEFAULT_SYMBOLS.indexOf(a.symbol) - DEFAULT_SYMBOLS.indexOf(b.symbol));
}

// GET /api/market/tickers — 24h stats. Source chain: Binance → Bybit → static.
router.get('/tickers', async (_req, res) => {
  try {
    const data = await cached('tickers', async () => {
      try {
        return await fetchBinanceTickers();
      } catch {
        return await fetchBybitTickers();
      }
    });
    res.json(data);
  } catch {
    res.json(fallbackTickers());
  }
});

interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchBinanceKlines(symbol: string, interval: string): Promise<Candle[]> {
  const resp = await fetch(`${BINANCE}/klines?symbol=${symbol}&interval=${interval}&limit=100`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const json = (await resp.json()) as unknown[][];
  return json.map((k) => ({
    time: k[0] as number,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
    volume: parseFloat(k[5] as string),
  }));
}

// Map Binance-style intervals to Bybit's (minutes / D / W / M).
const BYBIT_INTERVAL: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720',
  '1d': 'D', '1w': 'W', '1M': 'M',
};

async function fetchBybitKlines(symbol: string, interval: string): Promise<Candle[]> {
  const bi = BYBIT_INTERVAL[interval] ?? '60';
  const resp = await fetch(`${BYBIT}/kline?category=spot&symbol=${symbol}&interval=${bi}&limit=100`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const json = (await resp.json()) as { result?: { list?: string[][] } };
  const list = json.result?.list ?? [];
  // Bybit returns newest-first; reverse to chronological order.
  return list
    .map((k) => ({
      time: parseInt(k[0], 10),
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))
    .reverse();
}

// GET /api/market/klines?symbol=BTCUSDT&interval=1h — Binance → Bybit fallback.
router.get('/klines', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  const interval = (req.query.interval as string) || '1h';
  try {
    const data = await cached(`klines:${symbol}:${interval}`, async () => {
      try {
        return await fetchBinanceKlines(symbol, interval);
      } catch {
        return await fetchBybitKlines(symbol, interval);
      }
    });
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Market data unavailable' });
  }
});

// GET /api/market/fear-greed — crypto Fear & Greed index (alternative.me, cached)
router.get('/fear-greed', async (_req, res) => {
  try {
    const data = await cached('fng', async () => {
      const resp = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!resp.ok) throw new Error(`FNG ${resp.status}`);
      const json = (await resp.json()) as { data: { value: string; value_classification: string }[] };
      const point = json.data?.[0];
      return {
        value: parseInt(point?.value ?? '50', 10),
        label: point?.value_classification ?? 'Neutral',
      };
    });
    res.json(data);
  } catch {
    res.json({ value: 54, label: 'Neutral' });
  }
});

// Static fallback so the UI always has something to show in restricted networks.
function fallbackTickers() {
  const base: Record<string, number> = {
    BTCUSDT: 67000, ETHUSDT: 3500, BNBUSDT: 600, SOLUSDT: 150, XRPUSDT: 0.6,
    ADAUSDT: 0.45, DOGEUSDT: 0.16, AVAXUSDT: 38, LINKUSDT: 18, DOTUSDT: 7.2,
    MATICUSDT: 0.9, LTCUSDT: 85,
  };
  return Object.entries(base).map(([symbol, price]) => ({
    symbol,
    price,
    change: +(Math.random() * 8 - 4).toFixed(2),
    high: price * 1.03,
    low: price * 0.97,
    volume: Math.round(Math.random() * 1e9),
  }));
}

export default router;

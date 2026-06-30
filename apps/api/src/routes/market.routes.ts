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

// GET /api/market/tickers — 24h stats for the default watchlist
router.get('/tickers', async (_req, res) => {
  try {
    const data = await cached('tickers', async () => {
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
    });
    res.json(data);
  } catch {
    res.json(fallbackTickers());
  }
});

// GET /api/market/klines?symbol=BTCUSDT&interval=1h
router.get('/klines', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  const interval = (req.query.interval as string) || '1h';
  try {
    const data = await cached(`klines:${symbol}:${interval}`, async () => {
      const resp = await fetch(`${BINANCE}/klines?symbol=${symbol}&interval=${interval}&limit=100`);
      if (!resp.ok) throw new Error(`Binance ${resp.status}`);
      const json = (await resp.json()) as unknown[][];
      return json.map((k) => ({
        time: k[0],
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
      }));
    });
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Market data unavailable' });
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

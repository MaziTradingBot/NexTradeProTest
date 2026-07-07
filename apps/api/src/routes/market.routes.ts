import { Router } from 'express';
import { PrismaClient, Prisma } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

const BINANCE = 'https://api.binance.com/api/v3';
const BYBIT = 'https://api.bybit.com/v5/market';

// Tiny in-memory cache so we never hammer upstreams (keeps the API fast).
const cache = new Map<string, { at: number; data: unknown }>();
async function cached<T>(key: string, ttl: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttl) return hit.data as T;
  const data = await fn();
  cache.set(key, { at: Date.now(), data });
  return data;
}

// ---------------------------------------------------------------------------
// Categories — static tags plus dynamic (computed) sets.
// ---------------------------------------------------------------------------

const STATIC_CATEGORIES: { key: string; label: string }[] = [
  { key: 'LAYER1', label: 'Layer 1' },
  { key: 'LAYER2', label: 'Layer 2' },
  { key: 'DEFI', label: 'DeFi' },
  { key: 'MEME', label: 'Meme Coins' },
  { key: 'AI', label: 'AI' },
  { key: 'GAMING', label: 'Gaming' },
  { key: 'METAVERSE', label: 'Metaverse' },
  { key: 'STABLECOIN', label: 'Stablecoins' },
  { key: 'INFRA', label: 'Infrastructure' },
  { key: 'EXCHANGE', label: 'Exchange Tokens' },
  { key: 'PRIVACY', label: 'Privacy' },
  { key: 'RWA', label: 'Real World Assets' },
];
const DYNAMIC_CATEGORIES = [
  { key: 'ALL', label: 'All Coins' },
  { key: 'TRENDING', label: 'Trending' },
  { key: 'GAINERS', label: 'Top Gainers' },
  { key: 'LOSERS', label: 'Top Losers' },
];

type CoinRow = {
  symbol: string; pair: string | null; name: string; logoUrl: string | null;
  price: number; change24h: number; change7d: number; high24h: number; low24h: number;
  marketCap: number; volume24h: number; rank: number | null; circulating: number | null;
  maxSupply: number | null; website: string | null; explorer: string | null;
  whitepaper: string | null; categoryKeys: string; tradingEnabled: boolean; demoEnabled: boolean;
};

const shape = (c: CoinRow) => ({
  symbol: c.symbol,
  pair: c.pair ?? `${c.symbol}USDT`,
  name: c.name,
  logoUrl: c.logoUrl,
  price: c.price,
  change24h: c.change24h,
  change7d: c.change7d,
  high24h: c.high24h,
  low24h: c.low24h,
  marketCap: c.marketCap,
  volume24h: c.volume24h,
  rank: c.rank,
  circulating: c.circulating,
  maxSupply: c.maxSupply,
  website: c.website,
  explorer: c.explorer,
  whitepaper: c.whitepaper,
  categories: c.categoryKeys ? c.categoryKeys.split(',').filter(Boolean) : [],
  tradingEnabled: c.tradingEnabled,
  demoEnabled: c.demoEnabled,
});

const SORT_FIELDS = new Set(['rank', 'price', 'change24h', 'change7d', 'marketCap', 'volume24h', 'name']);

// GET /api/market/coins — paginated, filterable coin list (the screener core).
// Query: category, search, sort, order, page, limit, symbols (csv), min/max price/cap/vol
router.get('/coins', async (req, res) => {
  try {
    const q = req.query;
    const category = ((q.category as string) || 'ALL').toUpperCase();
    const search = (q.search as string) || '';
    const sort = SORT_FIELDS.has(q.sort as string) ? (q.sort as string) : 'rank';
    const order: 'asc' | 'desc' = (q.order as string) === 'asc' ? 'asc' : 'desc';
    const page = Math.max(1, parseInt((q.page as string) || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt((q.limit as string) || '50', 10)));
    const symbols = (q.symbols as string)?.split(',').map((s) => s.toUpperCase()).filter(Boolean);

    const where: Prisma.CoinWhereInput = { visible: true };
    if (search) {
      where.OR = [
        { symbol: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (symbols && symbols.length) where.symbol = { in: symbols };
    if (STATIC_CATEGORIES.some((c) => c.key === category)) {
      where.categories = { some: { category } };
    }
    if (q.minPrice) where.price = { ...(where.price as object), gte: parseFloat(q.minPrice as string) };
    if (q.maxPrice) where.price = { ...(where.price as object), lte: parseFloat(q.maxPrice as string) };

    // Dynamic categories override the sort.
    let orderBy: Prisma.CoinOrderByWithRelationInput = { [sort]: sort === 'rank' ? { sort: 'asc', nulls: 'last' } as never : order };
    if (sort === 'rank') orderBy = { rank: { sort: 'asc', nulls: 'last' } };
    if (category === 'GAINERS') orderBy = { change24h: 'desc' };
    if (category === 'LOSERS') orderBy = { change24h: 'asc' };
    if (category === 'TRENDING') orderBy = { volume24h: 'desc' };

    const [total, coins] = await Promise.all([
      prisma.coin.count({ where }),
      prisma.coin.findMany({ where, orderBy, skip: (page - 1) * limit, take: limit }),
    ]);
    res.json({ coins: coins.map((c) => shape(c as CoinRow)), total, page, limit, pages: Math.ceil(total / limit) });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('coins error', e);
    res.status(500).json({ error: 'Failed to load coins' });
  }
});

// GET /api/market/categories — list with live counts.
router.get('/categories', async (_req, res) => {
  try {
    const counts = await prisma.coinCategory.groupBy({ by: ['category'], _count: { category: true } });
    const countMap = new Map(counts.map((c) => [c.category, c._count.category]));
    const total = await prisma.coin.count({ where: { visible: true } });
    const cats = [
      ...DYNAMIC_CATEGORIES.map((c) => ({ ...c, count: c.key === 'ALL' ? total : null })),
      ...STATIC_CATEGORIES.map((c) => ({ ...c, count: countMap.get(c.key) ?? 0 })),
    ];
    res.json(cats);
  } catch {
    res.status(500).json({ error: 'Failed to load categories' });
  }
});

// GET /api/market/trending — trending / gainers / losers snapshots.
router.get('/trending', async (_req, res) => {
  try {
    const [trending, gainers, losers] = await Promise.all([
      prisma.coin.findMany({ where: { visible: true, marketCap: { gt: 0 } }, orderBy: { volume24h: 'desc' }, take: 10 }),
      prisma.coin.findMany({ where: { visible: true }, orderBy: { change24h: 'desc' }, take: 10 }),
      prisma.coin.findMany({ where: { visible: true }, orderBy: { change24h: 'asc' }, take: 10 }),
    ]);
    res.json({
      trending: trending.map((c) => shape(c as CoinRow)),
      gainers: gainers.map((c) => shape(c as CoinRow)),
      losers: losers.map((c) => shape(c as CoinRow)),
    });
  } catch {
    res.status(500).json({ error: 'Failed to load trending' });
  }
});

// GET /api/market/coins/:symbol — single coin detail.
router.get('/coins/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.toUpperCase().replace('USDT', '');
    const coin = await prisma.coin.findUnique({ where: { symbol } });
    if (!coin || !coin.visible) return res.status(404).json({ error: 'Coin not found' });
    res.json(shape(coin as CoinRow));
  } catch {
    res.status(500).json({ error: 'Failed to load coin' });
  }
});

// ---------------------------------------------------------------------------
// Legacy/compat + chart data (backend proxies the exchange; frontend never does).
// ---------------------------------------------------------------------------

// GET /api/market/tickers — top coins as {symbol=pair, price, change, ...} from DB.
router.get('/tickers', async (req, res) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '30', 10)));
    const coins = await prisma.coin.findMany({
      where: { visible: true, price: { gt: 0 } },
      orderBy: { rank: { sort: 'asc', nulls: 'last' } },
      take: limit,
    });
    res.json(coins.map((c) => ({
      symbol: c.pair ?? `${c.symbol}USDT`,
      price: c.price,
      change: c.change24h,
      high: c.high24h,
      low: c.low24h,
      volume: c.volume24h,
    })));
  } catch {
    res.status(500).json({ error: 'Failed to load tickers' });
  }
});

// GET /api/market/orderbook?symbol=BTCUSDT — L2 depth (backend proxies exchange).
async function fetchBinanceDepth(symbol: string) {
  const resp = await fetch(`${BINANCE}/depth?symbol=${symbol}&limit=20`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const j = (await resp.json()) as { bids: string[][]; asks: string[][] };
  return {
    bids: j.bids.map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 14),
    asks: j.asks.map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 14),
  };
}
async function fetchBybitDepth(symbol: string) {
  const resp = await fetch(`${BYBIT}/orderbook?category=spot&symbol=${symbol}&limit=25`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const j = (await resp.json()) as { result?: { b?: string[][]; a?: string[][] } };
  return {
    bids: (j.result?.b ?? []).map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 14),
    asks: (j.result?.a ?? []).map(([p, q]) => ({ price: +p, size: +q })).filter((l) => l.size > 0).slice(0, 14),
  };
}
router.get('/orderbook', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  try {
    const data = await cached(`depth:${symbol}`, 1200, async () => {
      try { return await fetchBinanceDepth(symbol); }
      catch { return await fetchBybitDepth(symbol); }
    });
    res.json(data);
  } catch {
    res.json({ bids: [], asks: [] }); // client shows a simulated book
  }
});

// GET /api/market/trades?symbol=BTCUSDT — recent trades (backend proxies exchange).
router.get('/trades', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  try {
    const data = await cached(`trades:${symbol}`, 1200, async () => {
      const resp = await fetch(`${BINANCE}/trades?symbol=${symbol}&limit=30`);
      if (!resp.ok) throw new Error(`Binance ${resp.status}`);
      const j = (await resp.json()) as Array<{ price: string; qty: string; time: number; isBuyerMaker: boolean }>;
      return j.map((t) => ({ price: +t.price, size: +t.qty, time: t.time, buyerMaker: t.isBuyerMaker })).reverse();
    });
    res.json(data);
  } catch {
    res.json([]);
  }
});

interface Candle { time: number; open: number; high: number; low: number; close: number; volume: number }

async function fetchBinanceKlines(symbol: string, interval: string): Promise<Candle[]> {
  const resp = await fetch(`${BINANCE}/klines?symbol=${symbol}&interval=${interval}&limit=100`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const json = (await resp.json()) as unknown[][];
  return json.map((k) => ({
    time: k[0] as number, open: parseFloat(k[1] as string), high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string), close: parseFloat(k[4] as string), volume: parseFloat(k[5] as string),
  }));
}

const BYBIT_INTERVAL: Record<string, string> = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360', '12h': '720', '1d': 'D', '1w': 'W', '1M': 'M',
};

async function fetchBybitKlines(symbol: string, interval: string): Promise<Candle[]> {
  const bi = BYBIT_INTERVAL[interval] ?? '60';
  const resp = await fetch(`${BYBIT}/kline?category=spot&symbol=${symbol}&interval=${bi}&limit=100`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const json = (await resp.json()) as { result?: { list?: string[][] } };
  return (json.result?.list ?? [])
    .map((k) => ({
      time: parseInt(k[0], 10), open: parseFloat(k[1]), high: parseFloat(k[2]),
      low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
    }))
    .reverse();
}

// GET /api/market/klines?symbol=BTCUSDT&interval=1h — Binance → Bybit fallback.
router.get('/klines', async (req, res) => {
  const symbol = ((req.query.symbol as string) || 'BTCUSDT').toUpperCase();
  const interval = (req.query.interval as string) || '1h';
  try {
    const data = await cached(`klines:${symbol}:${interval}`, 5000, async () => {
      try { return await fetchBinanceKlines(symbol, interval); }
      catch { return await fetchBybitKlines(symbol, interval); }
    });
    res.json(data);
  } catch {
    res.status(502).json({ error: 'Market data unavailable' });
  }
});

// GET /api/market/fear-greed — crypto Fear & Greed index (alternative.me, cached)
router.get('/fear-greed', async (_req, res) => {
  try {
    const data = await cached('fng', 60_000, async () => {
      const resp = await fetch('https://api.alternative.me/fng/?limit=1');
      if (!resp.ok) throw new Error(`FNG ${resp.status}`);
      const json = (await resp.json()) as { data: { value: string; value_classification: string }[] };
      const point = json.data?.[0];
      return { value: parseInt(point?.value ?? '50', 10), label: point?.value_classification ?? 'Neutral' };
    });
    res.json(data);
  } catch {
    res.json({ value: 54, label: 'Neutral' });
  }
});

export default router;

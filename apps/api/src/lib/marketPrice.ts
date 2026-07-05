// Server-side live price helper used by the trading engine (opening/closing
// positions, SL/TP and stop-out evaluation). Binance → Bybit → last-known
// fallback, with a short in-memory cache so a burst of engine ticks and order
// closes never hammer the upstream exchanges.

const BINANCE = 'https://api.binance.com/api/v3';
const BYBIT = 'https://api.bybit.com/v5/market';

const cache = new Map<string, { at: number; price: number }>();
const TTL = 3000;

async function fetchBinance(symbols: string[]): Promise<Record<string, number>> {
  const param = encodeURIComponent(JSON.stringify(symbols));
  const resp = await fetch(`${BINANCE}/ticker/price?symbols=${param}`);
  if (!resp.ok) throw new Error(`Binance ${resp.status}`);
  const json = (await resp.json()) as Array<{ symbol: string; price: string }>;
  const out: Record<string, number> = {};
  for (const t of json) out[t.symbol] = parseFloat(t.price);
  return out;
}

async function fetchBybit(symbols: string[]): Promise<Record<string, number>> {
  const resp = await fetch(`${BYBIT}/tickers?category=spot`);
  if (!resp.ok) throw new Error(`Bybit ${resp.status}`);
  const json = (await resp.json()) as { result?: { list?: Array<{ symbol: string; lastPrice: string }> } };
  const wanted = new Set(symbols);
  const out: Record<string, number> = {};
  for (const t of json.result?.list ?? []) {
    if (wanted.has(t.symbol)) out[t.symbol] = parseFloat(t.lastPrice);
  }
  return out;
}

/**
 * Return a { symbol: price } map for the requested symbols. Symbols still
 * fresh in the cache are served from memory; the rest are fetched in one call.
 * On total upstream failure the last-known cached price is used so the engine
 * degrades gracefully instead of throwing.
 */
export async function getPrices(symbols: string[]): Promise<Record<string, number>> {
  const uniq = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const now = Date.now();
  const result: Record<string, number> = {};
  const stale: string[] = [];

  for (const s of uniq) {
    const hit = cache.get(s);
    if (hit && now - hit.at < TTL) result[s] = hit.price;
    else stale.push(s);
  }
  if (stale.length === 0) return result;

  let fresh: Record<string, number> = {};
  try {
    fresh = await fetchBinance(stale);
  } catch {
    try {
      fresh = await fetchBybit(stale);
    } catch {
      fresh = {};
    }
  }

  for (const s of stale) {
    if (fresh[s] != null && Number.isFinite(fresh[s])) {
      cache.set(s, { at: now, price: fresh[s] });
      result[s] = fresh[s];
    } else {
      const hit = cache.get(s);
      if (hit) result[s] = hit.price; // last-known fallback
    }
  }
  return result;
}

export async function getPrice(symbol: string): Promise<number | null> {
  const prices = await getPrices([symbol]);
  return prices[symbol.toUpperCase()] ?? null;
}

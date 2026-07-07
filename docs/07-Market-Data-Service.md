# 07 — Market Data Service

A centralized backend service that owns all cryptocurrency market data. **The
frontend never talks to Binance/Bybit/news providers directly.**

```
Frontend → Backend API → Market Data Service → Binance Public API
                                             → Bybit Public API
                                             → Coin Metadata Provider (CoinGecko)
                                             → News Providers (CryptoPanic/NewsAPI)
```

## 1. Current state (baseline)

- `market.routes.ts` proxies Binance→Bybit 24h tickers/klines with a 5s in-memory
  cache, for a **hardcoded 12-symbol list**.
- `lib/marketPrice.ts` provides server-side prices to the trading engine.
- **No persistent coin database, categories, screener, or sync job yet.**

## 2. Target design

A service module (e.g. `lib/marketData.ts` + a sync job) that:

1. Maintains a **Coin database** (see `docs/11` §Coin) — the source of truth for
   the coin list, metadata, categories, and latest snapshot values.
2. Runs **scheduled sync** jobs to refresh:
   - **Prices / 24h change / high-low / volume** — frequent (seconds), Binance→Bybit.
   - **Market cap / rank / circulating & max supply / logo / links / categories**
     — infrequent (minutes/hours), from the metadata provider (CoinGecko free).
   - **Trending / gainers / losers / meme / AI / DeFi** — derived or provider-tagged.
3. Serves normalized, cached data to API routes; the frontend only ever hits NXP
   endpoints.
4. **Degrades gracefully**: on upstream failure, serve last-known DB snapshot.

Support **150+ cryptocurrencies**. Coins are seeded/synced, **never hardcoded**.

## 3. Sync cadence & caching

| Data                          | Source            | Cadence      | Store        |
|-------------------------------|-------------------|--------------|--------------|
| Price, 24h%, high/low, volume | Binance→Bybit     | ~5–15s cache | Coin.price…  |
| Market cap, rank, supply      | CoinGecko         | ~5–15 min    | Coin.*       |
| Logo, links, categories       | CoinGecko         | ~24 h        | Coin.*       |
| Trending / gainers / losers   | derived/provider  | ~1–5 min     | computed     |
| News                          | CryptoPanic/NewsAPI| ~2–5 min    | News cache   |

Never hammer upstreams: single batched calls + cache + backoff. Respect rate
limits and provider terms.

## 4. Categories

Stored on each coin (many-to-one or tags). Supported categories:

`All Coins, Trending, Top Gainers, Top Losers, Meme Coins, AI, DeFi, Layer 1,
Layer 2, Gaming, Metaverse, Stablecoins, Infrastructure, Exchange Tokens,
Privacy, Real World Assets`.

Some categories are **dynamic** (Trending/Gainers/Losers — computed from live
snapshot), the rest are **static tags** on the coin.

## 5. Market Screener

Professional screener endpoint + UI supporting:

- Search (name/symbol), Price, Market Cap, Volume, 24h change, 7d change,
  Category filter, Favorites, and Watchlists (`docs/11`).
- Server-side filtering/sorting/pagination for 150+ coins; debounce client input.

## 6. News Center

- Endpoint aggregates approved providers: **CryptoPanic (free)**, **CoinGecko
  (free)**, **NewsAPI (free tier)**. No scraping, no unauthorized providers.
- Sections: Breaking, Bitcoin, Ethereum, Altcoins, DeFi, AI, Regulation, Markets,
  Analysis.
- Auto-refresh on an interval; cache server-side; store provider attribution.
- Frontend `/news` renders from the NXP endpoint only.

## 7. Endpoints (target — see `docs/10`)

```
GET /api/market/coins            list + filters (category, search, sort, page)
GET /api/market/coins/:symbol    single coin detail + metadata
GET /api/market/categories       category list + counts
GET /api/market/trending         trending / gainers / losers
GET /api/market/screener         screener query
GET /api/market/tickers          live tickers (existing, extended)
GET /api/market/klines           candles (existing)
GET /api/news                    aggregated news (sectioned, paginated)
```

## 8. Build plan (when approved)

1. Add `Coin` model + `CoinCategory` tagging to schema; migrate (`docs/11`).
2. Seed the initial 150+ coin universe (symbol→metadata) from CoinGecko once.
3. Implement `lib/marketData.ts` sync job (price loop + metadata loop) with cache
   and graceful fallback; wire into `server.ts` startup.
4. Build the `/api/market/*` and `/api/news` endpoints from the DB/cache.
5. Rebuild `/markets`, screener, and `/news` UIs to consume the new endpoints
   (remove all hardcoded coin lists).
6. Verify: 150+ coins load, categories filter, screener sorts, news refreshes,
   frontend makes zero direct external calls.

## 9. Constraints

- All secrets/API keys via env (`docs/12`). Never commit keys.
- Provider outages must not take down the app — always fall back to DB snapshot.
- Keep responses paginated and cached; the market pages must stay fast (`docs/04`).

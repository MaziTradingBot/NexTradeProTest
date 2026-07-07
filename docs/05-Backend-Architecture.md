# 05 — Backend Architecture

`apps/api` — Express + Prisma + PostgreSQL. Deployed on Render.

## 1. Layout

```
apps/api/src/
  server.ts            app bootstrap, CORS, middleware, route mounting
  routes/              HTTP endpoints (one module per domain)
    auth.routes.ts     register/login/refresh/google/2fa/password
    account.routes.ts  balances, deposit, withdraw, kyc, watchlist, alerts, SSE
    admin.routes.ts    back office (funding, approvals, trading controls, audit)
    broker.routes.ts   broker portal (assigned clients)
    market.routes.ts   market data proxy (tickers, klines) — → Market Data Service
    content.routes.ts  CMS content (announcements, etc.)
    toolkit.routes.ts  presentation / demo generators
  lib/                 domain logic
    prisma.ts          Prisma client singleton
    auth.ts            JWT issue/verify, cookie helpers
    rbac.ts            role/permission resolution + guards
    trading.ts         margin/equity math (balance, equity, margin, P&L)
    tradingEngine.ts   background tick: fills, SL/TP, stop-out, alerts
    marketPrice.ts     server-side price helper (Binance→Bybit→cache)
    events.ts          in-process event bus (SSE publish)
    google.ts          Google ID-token verification
    totp.ts            2FA TOTP secret/verify
    audit.ts           audit log writer
  prisma/schema.prisma database schema
```

## 2. Request lifecycle

```
request
  → CORS (env.corsOrigins allow-list, credentials: true)
  → cookie/body parsing
  → auth middleware (verify nxp_access; attach req.user; check tokenVersion)
  → mode resolution (x-nxp-mode header → DEMO | LIVE)
  → rbac guard (route-level required permission)
  → handler (validate input → prisma tx → audit if admin → respond typed JSON)
```

## 3. Authentication & sessions

- **JWT** access + refresh in **httpOnly cookies** (`nxp_access`, `nxp_refresh`);
  `secure` + `sameSite: 'none'` in production (cross-site Vercel↔Render).
- **`tokenVersion`** on the user invalidates all sessions when bumped (admin
  password reset, "log out everywhere").
- **Google OAuth** via GIS ID token verified server-side (`lib/google.ts`).
- **2FA** TOTP (`lib/totp.ts`) — optional per user.
- See `docs/10` §Auth for endpoint contracts.

## 4. Authorization (RBAC) — see `docs/09`/`08`

- Models: `Role`, `Permission`, `RolePermission`, `UserRole`.
- `lib/rbac.ts` resolves a user's effective permissions; route guards require a
  named permission (e.g. `kyc.approve`, `wallet.credit`).
- **Backend is authoritative.** UI gating is cosmetic.
- `isSuperAdmin` bypasses to full access.

## 5. Account modes

- `x-nxp-mode` header selects DEMO or LIVE for the request.
- Mode-scoped models (`Wallet`, `Order`, `Transaction`, etc.) always carry an
  `AccountMode` and are queried with it. DEMO and LIVE never mix.

## 6. User data isolation (CRITICAL)

Every handler returning user-owned data MUST filter by `req.user.id`:

```ts
// GOOD
prisma.wallet.findMany({ where: { userId: req.user.id, mode } });
// NEVER
prisma.wallet.findMany({ where: { mode } }); // leaks across users
```

Applies to: portfolio, wallets, bank accounts, saved crypto wallets, deposits,
withdrawals, trades/orders, watchlists, AI insights, notifications, support
tickets, profile. Admin/broker read of other users' data goes through
**dedicated admin/broker routes** that check permissions and write audit logs —
never through the user-facing routes.

## 7. Trading engine

- `lib/trading.ts` — pure math: balance, equity, used/free margin, margin level,
  floating P&L, exposure, liquidation price.
- `lib/tradingEngine.ts` — background interval that pulls live prices, fills
  working orders (Limit/Stop/Stop-Limit/OCO/Trailing), evaluates SL/TP and
  stop-out, and triggers price alerts. Emits events via `lib/events.ts`.
- See `docs/06-Trading-Engine.md`.

## 8. Market data

`market.routes.ts` + `lib/marketPrice.ts` proxy Binance→Bybit with a short cache.
This is being formalized into the **Market Data Service** with a persistent Coin
database and sync jobs — see `docs/07`.

## 9. Real-time (SSE)

`events.ts` is an in-process pub/sub. `/api/account/stream` streams balance/equity
and other user-scoped events to the browser (`useLiveSync`). Keep payloads small
and user-scoped; never broadcast another user's data on a shared channel.

## 10. Validation & errors

- Validate all input server-side (zod/manual) and clamp numeric ranges.
- Return typed JSON errors `{ error: string }` with correct HTTP status.
- Wrap multi-write operations in `prisma.$transaction` for atomicity (funding,
  withdrawal reserve/refund, order open/close).

## 11. Audit logging

Every admin/broker mutation calls `lib/audit.ts` to record actor, target user,
mode, previous→new value, reason, timestamp, and IP if available. See `docs/08`.

## 12. Background jobs

- Trading engine tick (interval).
- Market Data Service sync (planned: coin list, prices, metadata — `docs/07`).
- News refresh (planned — `docs/07` §News).
Jobs must be idempotent, log failures, and degrade gracefully (serve last-known).

# 10 — API Documentation

Base URL: `NEXT_PUBLIC_API_URL` (e.g. `https://<service>.onrender.com`). All app
requests go through `apps/web/src/lib/api.ts`.

## Conventions

- **Auth:** access JWT in `nxp_access` httpOnly cookie (also Bearer). Refresh via
  `nxp_refresh`. `credentials: 'include'` on every request.
- **Mode:** `x-nxp-mode: DEMO | LIVE` header scopes the request.
- **Errors:** JSON `{ "error": string }` with proper HTTP status
  (400 invalid, 401 unauth, 403 forbidden, 404 not found, 409 conflict, 429 rate).
- **Money:** amounts as numbers in the account currency; validate/clamp server-side.

---

## Auth — `/api/auth/*` (`auth.routes.ts`)

| Method | Path                | Body / notes                              |
|--------|---------------------|-------------------------------------------|
| POST   | `/register`         | email, password, name → sets cookies      |
| POST   | `/login`            | email, password → sets cookies            |
| POST   | `/refresh`          | uses `nxp_refresh`; checks `tokenVersion` |
| POST   | `/logout`           | clears cookies                            |
| POST   | `/google`           | GIS credential → verify, find/create user |
| GET    | `/me`               | current user (roles, flags, googleLinked, hasPassword, canLiveTrade) |
| POST   | `/forgot-password`  | email → reset token (email in prod)       |
| POST   | `/reset-password`   | token, newPassword                        |
| POST   | `/2fa/setup`        | returns TOTP secret/QR                     |
| POST   | `/2fa/verify`       | code → enable 2FA                         |

## Account — `/api/account/*` (`account.routes.ts`)

| Method | Path                  | Purpose                                  |
|--------|-----------------------|------------------------------------------|
| GET    | `/summary`            | balances, equity, margin (mode-scoped)   |
| GET    | `/stream`             | **SSE** real-time balance/equity events  |
| GET    | `/wallets`            | user wallets (mode-scoped)               |
| POST   | `/deposit`            | crypto deposit intent                    |
| POST   | `/deposit/card`       | card deposit (demo/sim)                   |
| POST   | `/withdraw`           | request withdrawal (reserve balance)     |
| GET    | `/transactions`       | tx history (filters)                     |
| GET    | `/kyc`                | KYC + POA status                         |
| POST   | `/kyc`                | submit identity KYC                      |
| POST   | `/poa`                | submit Proof-of-Address                  |
| GET/POST | `/watchlist`        | watchlist items                          |
| GET/POST | `/alerts`           | price alerts                             |
| GET    | `/stats`              | trading statistics                       |
| POST   | `/link-google`        | link Google to current account          |
| POST   | `/unlink-google`      | unlink Google                           |

**Planned (this spec):** `/bank-accounts` CRUD + default, `/payout-wallets`
(saved crypto) CRUD + default, `/watchlists` (named lists) CRUD, profile-security
edits (phone/address/timezone/language/notifications), email-change verification.

## Trading — orders (in account/trading routes)

| Method | Path            | Purpose                                    |
|--------|-----------------|--------------------------------------------|
| POST   | `/orders`       | place order (Market/Limit/Stop/…/OCO/Trailing) |
| GET    | `/orders`       | open + working orders                      |
| POST   | `/orders/:id/close` | close position                         |
| DELETE | `/orders/:id`   | cancel working order                       |

(See `docs/06` for engine semantics.)

## Market — `/api/market/*` (`market.routes.ts`)

| Method | Path          | Purpose                                       |
|--------|---------------|-----------------------------------------------|
| GET    | `/tickers`    | 24h tickers (proxied Binance→Bybit, cached)   |
| GET    | `/klines`     | candlesticks                                  |

**Planned (Market Data Service, `docs/07`):** `/coins`, `/coins/:symbol`,
`/categories`, `/trending`, `/screener`, and `/api/news`.

## Admin — `/api/admin/*` (`admin.routes.ts`) — permissioned + audited

Users, wallet funding, deposit/withdrawal approvals, KYC + POA review, trading
controls (freeze/force-close/adjust-leverage/adjust-balance/transfer/monitoring),
audit logs. **Planned:** P&L Manager, Portfolio Editor, Trading History Manager,
Client Profile Manager, audit search/export.

## Broker — `/api/broker/*` (`broker.routes.ts`)

Assigned clients (base). **Planned:** notes, scoped KYC review, dep/wd
recommendations, commissions. See `docs/09`.

## Toolkit — `/api/toolkit/*` (`toolkit.routes.ts`)

Presentation/demo generators and resets. **Planned:** full Client Showcase Mode
(`docs/15`).

## Content — `/api/content/*` (`content.routes.ts`)

Announcements / CMS content.

---

> Keep this file in sync when adding endpoints. Every new route: state method,
> path, auth, required permission, mode-scoping, request, and response shape.

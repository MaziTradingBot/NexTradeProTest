# 01 — Project Overview

## What NexTradePro is

**NexTradePro (NXP)** is a production-quality, enterprise crypto trading platform.
It presents a premium exchange-grade experience (spot + margin/futures-style
trading, portfolio, wallets, deposits/withdrawals, market data, news, copy trading)
with a full **admin back office** and a **broker portal**, and a first-class
**Demo Mode** used for live client presentations.

It is **not** a real exchange: it does not custody real crypto or execute on real
order books. Prices are real (sourced from public Binance/Bybit data via the
backend), but fills, balances, and settlement are simulated by NXP's own trading
engine. This makes it safe for demos and paper trading while feeling real.

## Audience / use cases

1. **End users** — trade (demo or live-simulated), manage a portfolio, deposit and
   withdraw, build watchlists, read market news.
2. **Brokers** — manage assigned clients, review KYC, track commissions.
3. **Administrators** — run the platform: fund accounts, approve deposits/
   withdrawals, verify KYC, manage content, adjust P&L, and run client demos.
4. **Presenter (sales)** — one-click "Client Showcase Mode" that resets and
   populates a polished demo environment.

## Architecture at a glance

```
                    ┌─────────────────────────────┐
   Browser  ───────▶│  apps/web  (Next.js 15)      │   Vercel
                    │  React 19 · Tailwind · TS    │
                    └──────────────┬──────────────┘
                                   │  HTTPS (credentials: include)
                                   ▼
                    ┌─────────────────────────────┐
                    │  apps/api  (Express + Prisma)│   Render
                    │  JWT · RBAC · Trading Engine │
                    │  Market Data Service         │
                    └──────────────┬──────────────┘
             ┌─────────────────────┼───────────────────────┐
             ▼                     ▼                       ▼
      ┌────────────┐      ┌─────────────────┐     ┌────────────────┐
      │ PostgreSQL │      │ Binance / Bybit │     │ News providers │
      │  (Neon)    │      │  public APIs    │     │ (CryptoPanic…) │
      └────────────┘      └─────────────────┘     └────────────────┘
```

The frontend never calls exchanges or news providers directly — all external data
is proxied and normalized by the backend (`docs/07`).

## Repositories & environments

- Monorepo: `apps/web` (frontend) + `apps/api` (backend) + `docs/`.
- **Frontend** deploys to **Vercel**.
- **Backend** deploys to **Render** (`render.yaml`).
- **Database** is **Neon** Postgres (use the UNPOOLED URL for `prisma db push`).
- See `docs/12-Deployment.md` for env vars and the connection matrix.

## Account modes

Every user has two independent contexts, switched via the Mode switcher and sent
to the API as the `x-nxp-mode` header:

- **DEMO** — play money, resettable, used for presentations and practice.
- **LIVE** — real (simulated-settlement) balances funded by admins; gated by KYC
  and per-user live-trading permission.

Wallets, orders, and transactions are **mode-scoped** — DEMO and LIVE never mix.

## Current status (summary)

Working & deployed: auth (email + Google + 2FA), demo/live modes, trading terminal
with a margin/equity engine (SL/TP, auto-liquidation), working order types
(Limit/Stop/Stop-Limit/OCO/Trailing), portfolio & stats, wallets, deposits
(crypto + card), withdrawals with reservation/refund, KYC + Proof-of-Address,
watchlist + price alerts, unified history + receipts, real-time balance sync (SSE),
admin back office (funding, approvals, trading controls, audit logs), broker
portal (base), presentation toolkit (base), news & markets pages (base).

Target additions in this spec (not yet built to spec): a **Coin database**
+ full **Market Data Service** (150+ coins, categories, screener), **named
watchlists**, **saved withdrawal methods** (bank + crypto), **P&L manager**,
**portfolio/trade editors**, **Client Showcase Mode**, and a **cross-platform
responsive pass**. See `docs/14-Roadmap.md`.

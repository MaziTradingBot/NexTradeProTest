# 14 — Roadmap & Live Status

Authoritative build tracker. Update the status column as work lands. Legend:
✅ done & deployed · 🟡 partial/baseline exists · ⬜ not started (spec'd in docs).

## Master checklist

| # | Module                        | Status | Notes                                             |
|---|-------------------------------|:------:|---------------------------------------------------|
| 1 | Repository setup              | ✅ | Monorepo, Vercel/Render/Neon wired                 |
| 2 | Design system                 | ✅ | Tokens, component classes, marketing chrome        |
| 3 | Landing page                  | ✅ | Figma dark theme                                   |
| 4 | Authentication                | ✅ | Email + Google + 2FA + reset + session invalidation|
| 5 | Dashboard                     | ✅ | KPIs, live sync                                    |
| 6 | Trading terminal              | ✅ | Margin engine, all order types, SL/TP, liquidation |
| 7 | Wallets                       | ✅ | Balances/asset pages + saved payout methods        |
| 8 | Deposits                      | ✅ | Crypto + card                                      |
| 9 | Withdrawals                   | ✅ | Reserve/refund + saved bank & crypto destinations  |
|10 | Demo mode                     | ✅ | Mode-scoped accounts, admin demo controls          |
|11 | Live mode                     | ✅ | KYC/permission gating, admin funding + approvals   |
|12 | Broker portal                 | 🟡 | Assigned clients base; notes/KYC/recs/commissions ⬜|
|13 | Admin portal                  | 🟡 | Funding/approvals/KYC/trading controls/audit + P&L Manager ✅; Portfolio/Trade editors, Client Profile Mgr, audit search/export ⬜ |
|14 | CMS                           | 🟡 | Announcements base; blog/testimonials/news mgmt ⬜  |
|15 | AI assistant                  | 🟡 | `/ai` page exists; insights generation ⬜          |
|16 | Market Data Service           | ✅ | Coin DB (169 coins) + sync (prices+metadata) + categories + screener + coin detail; frontend calls only the backend |
|17 | News center                   | ✅ | `/api/news` aggregates CryptoPanic/NewsAPI + announcements; sectioned, auto-refresh, graceful fallback |
|18 | Watchlists (named)            | ✅ | Multi-list per user (create/rename/delete, add/remove); default backfill; `/watchlists` UI |
|19 | Presentation toolkit          | ✅ | Generators + one-click Client Showcase Mode (Start/Stop presentation, refill+populate) |
|20 | Profile security              | 🟡 | Password/2FA/email ✅; phone/address/tz/lang/notif ⬜|
|20a| Password & Auth UX            | ✅ | Reusable PasswordInput (show/hide, caps-lock, strength, a11y) everywhere + server-side password policy (docs/16) |
|20b| Account security features     | ✅ | Email verification, idle-timeout auto-logout, new-device notifications, login history, account lockout (docs/16 §6) |
|21 | Support tickets               | ⬜ | Support role + ticket model + UI                   |
|22 | Cross-platform responsive pass| ✅ | 320–2560 audit passed on all public/authed/admin pages; mobile admin nav added; marketing nav breakpoint fixed |
|23 | Testing (automated)           | ⬜ | Supertest API + Playwright responsive              |
|24 | Deployment hardening          | 🟡 | Deployed; health/rollback/monitoring docs ✅        |

## Recommended build sequence (next up)

Following the "one feature at a time" workflow (`docs/00` §3). Suggested order for
the new spec, each gated on approval:

1. **Cross-platform responsive pass** (`docs/03`) — highest-leverage polish across
   the existing app; no new data model.
2. **Market Data Service + Coin database** (`docs/07`, `docs/11`) — unblocks
   markets, screener, categories, and removes hardcoded coin lists.
3. **News Center** (`docs/07` §6) — builds on the Market Data Service.
4. **Named Watchlists** (`docs/11`) — depends on Coin DB.
5. **Withdrawal Methods** (bank + saved crypto wallets) (`docs/11`).
6. **Admin P&L Manager + Portfolio/Trade editors + Client Profile Manager**
   (`docs/08`).
7. **Client Showcase / Presentation Mode** (`docs/15`).
8. **Broker portal** completion (`docs/09`).
9. **Support tickets** (`docs/11`, `docs/08`).
10. **Automated testing** (`docs/13`).

## Known follow-ups / tech debt

- Remove remaining hardcoded symbol lists once Coin DB lands (`market.routes.ts`,
  `markets` page, copy-trading traders can stay illustrative but labeled).
- Introduce `Decimal`/minor-units for new financial fields (`docs/11` §5).
- Real SMTP for password-reset/verification emails in production.
- Enforce single-default constraint for bank accounts / payout wallets in a tx.

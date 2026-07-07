# 04 — Frontend Architecture

`apps/web` — Next.js 15 (App Router), React 19, TypeScript, Tailwind.

## 1. Routing (App Router)

Pages live under `apps/web/src/app/<route>/page.tsx`. Current routes:

```
/                landing (marketing)      /markets       market list
/login /register /forgot-password /reset-password
/dashboard       user home                /trading       trading terminal
/portfolio       holdings & analytics     /wallet        balances + asset detail
/deposit         crypto + card deposit    /transaction   tx detail / receipt
/history         unified tx + trades      /kyc           KYC + Proof-of-Address
/settings        profile/security         /copy-trading  copy pros (simulated)
/news            news center              /ai            AI assistant
/academy /calendar /tools /referral /pricing /about
/admin/*         admin back office        /broker/*      broker portal
```

## 2. Directory layout

```
apps/web/src/
  app/            route segments (pages, layouts)
  components/     shared UI (see docs/03 §2)
    marketing/    landing + public chrome
  lib/            client logic & hooks
```

### Key `lib/` modules

| File                 | Responsibility                                              |
|----------------------|------------------------------------------------------------|
| `api.ts`             | `apiFetch`/`api` client; `API_BASE`, auth headers, mode    |
| `store.ts`           | Auth store (`useAuth`), permissions helper                 |
| `useMode.ts`         | DEMO/LIVE mode state → `x-nxp-mode` header                 |
| `useLiveSync.ts`     | SSE subscription for real-time balance/equity updates      |
| `useTickers.ts`      | Live ticker stream (via backend market endpoints)          |
| `useOrderBook.ts`    | Order book data                                            |
| `useTradingAccount.ts`| Margin/equity account summary                             |
| `useFlags.ts`        | Feature flags                                              |
| `receipt.ts`         | Client-side PDF receipt generation                         |
| `utils.ts`           | `cn()` and helpers                                         |

## 3. Data fetching contract

- All API calls go through `lib/api.ts`. It sets `credentials: 'include'`, the
  `x-nxp-mode` header, and the Bearer token; base URL is
  `NEXT_PUBLIC_API_URL` (see `docs/12`). **Never** `fetch()` an exchange or a news
  provider from the browser.
- Network-level failures surface as `"Failed to fetch"` — usually a
  deployment/CORS/URL misconfiguration, not a code bug (see `docs/12` §Troubleshooting).
- Real-time updates use **SSE** (`/api/account/stream`) via `useLiveSync`.

## 4. State management

- **Auth/session:** `useAuth` store (token in memory + refresh cookie).
- **Mode:** `useMode` (persisted; drives every request's scope).
- **Server data:** fetched per-page with hooks; keep it local unless shared.
- Avoid global mutable state beyond auth/mode/flags.

## 5. Rendering strategy

- Marketing/landing: static where possible (fast first paint, SEO —
  `sitemap.ts`, `robots.ts`, `manifest.ts` exist).
- App pages: client components guarded by `AuthGuard`; data loaded after mount.
- Use React Server Components for static shells; keep interactive islands client.

## 6. Performance

Targets: **Lighthouse 95+**, fast transitions, low memory.

- **Code splitting** per route (App Router default) + `next/dynamic` for heavy
  widgets (`TradingViewChart`, `Heatmap`).
- **Lazy load** below-the-fold and modal content.
- **Images** via `next/image` where possible; SVG icons inline.
- Memoize expensive lists (market/screener rows); virtualize very long tables.
- Debounce search/screener inputs; cancel in-flight requests on change.
- Avoid layout thrash from live prices: batch updates, use `requestAnimationFrame`
  or throttle to a sane cadence (e.g. ≤ 2–4 Hz UI updates).

## 7. Error & empty handling

Wrap route content with error boundaries and the four states from `docs/03` §6.
`not-found.tsx` handles 404. Show actionable messages, never raw stack traces.

## 8. Conventions

- One page = one responsibility; extract shared pieces to `components/`.
- Co-locate small page-only components inside the route folder.
- Keep components < ~300 lines; split when they grow.
- Types shared with the API should mirror the API's response shape (documented in
  `docs/10-API-Documentation.md`).

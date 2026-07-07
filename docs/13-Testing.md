# 13 — Testing & QA

Quality gates for every change. A feature is not done until it passes these
(`docs/00` §2).

## 1. Static gates (must pass before commit)

- `npm run typecheck` — both `apps/web` and `apps/api`, zero errors.
- `npm run lint` — no new lint errors; fix unused imports / undeclared usage.
- `npm run build` (web) — production build succeeds. Clear `.next` if a stale
  cache produces phantom errors (e.g. `<Html> imported outside pages/_document`).

## 2. Runtime smoke (headless click-through)

After a build, drive the affected pages headless and assert **zero console errors
and no 500s**:

- Public: `/`, `/login`, `/register`, `/pricing`, `/about`, `/news`, `/markets`.
- App (authed): `/dashboard`, `/trading`, `/portfolio`, `/wallet`, `/deposit`,
  `/history`, `/settings`, `/kyc`, `/copy-trading`.
- Admin: `/admin/*` with an admin session.

Use a fresh login token after any DB reseed / `tokenVersion` bump.

## 3. Responsive QA (MANDATORY — `docs/03` §3)

For every changed page, verify at **320, 375, 768, 1024, 1440, 1920, 2560 px**:

- No horizontal scroll on the page body.
- Tables scroll within their own container or collapse to cards.
- Charts resize to their container.
- Nav collapses to a usable mobile drawer/bottom-tab; touch targets ≥ 44px.
- Forms and modals fit and are operable.

## 4. Cross-browser

Spot-check Chrome, Edge, Firefox, Safari, Opera. Watch Safari for flex `gap`,
sticky headers, date inputs, and 100vh quirks.

## 5. Functional test checklists

**Auth:** register, login, logout, refresh, Google sign-in, 2FA, forgot/reset
password, session invalidation after admin reset, change email verification.

**Trading:** market order fill, working orders (Limit/Stop/Stop-Limit/OCO/
Trailing) trigger correctly, SL/TP, stop-out/liquidation, LIVE gating (KYC +
permission + freeze), DEMO always available. Margin math invariants (`docs/06` §9).

**Money:** deposit (crypto + card), withdraw reserves balance, admin approve
settles / reject refunds, real-time SSE balance update reflects admin funding.

**Isolation:** user A cannot read user B's wallets/orders/tx/watchlists/payout
methods/tickets (attempt cross-id fetch → 403/empty). Broker sees only assigned
clients.

**Admin:** funding atomic + audited, approvals, KYC/POA review, trading controls,
P&L manager propagation, audit log written + searchable/exportable.

**Market Data (when built):** 150+ coins load, category filters, screener sort/
search/pagination, news refresh; frontend makes **zero** direct external calls.

## 6. Data isolation test (explicit)

For each user-owned resource, add a negative test: authenticated as user B,
request user A's resource id → expect 403/404/empty, never A's data.

## 7. Performance

- Lighthouse (mobile) target **95+** on landing and key app pages.
- Watch bundle size on heavy routes; lazy-load charts/heatmaps.
- No runaway re-render from live prices (throttle UI updates).

## 8. Regression discipline

When fixing a bug, note the root cause in the commit and, where practical, add a
guard/test so it can't silently return. Known past traps: stale `.next` cache,
orphaned dev servers holding ports 3000/4000, nested-quote shell scripts — prefer
writing JSON to a file and `require()` in smoke scripts.

## 9. Tooling note

No formal automated test suite is wired yet. Near-term: introduce API integration
tests (supertest) for auth, isolation, and money flows, and a small Playwright
responsive/click-through pass. Track in `docs/14-Roadmap.md`.

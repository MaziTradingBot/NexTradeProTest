# 00 — AI Development Rules

Operating rules for any AI (or human) contributor working on **NexTradePro (NXP)**.
Read this file first, every session, before touching code.

---

## 1. Golden Rules

1. **One task at a time.** Build exactly what the current instruction asks for and
   nothing else. Do not "helpfully" scaffold adjacent features. When a task is
   finished, **stop and wait** for approval.
2. **Documentation before code.** If a feature is not described in `docs/`, write
   or update the doc first, get alignment, then implement.
3. **Never hardcode domain data.** Coins, categories, prices, fees, limits,
   leverage caps, and copy come from the database or config — never inline arrays
   in components. (Legacy hardcoded symbol lists are being migrated out; do not
   add new ones.)
4. **User data isolation is non-negotiable.** Every query that returns user-owned
   data MUST be filtered by the authenticated user's ID. See `docs/05` §Isolation.
5. **Permissions are enforced on the backend.** The frontend hides controls for UX;
   the API is the source of truth. Never trust a client role claim.
6. **Preserve the design system.** Use existing tokens and component classes
   (`docs/03`). Do not introduce new colors, fonts, or ad-hoc spacing.
7. **No horizontal scroll, ever.** Every screen must pass the responsive matrix in
   `docs/03` §Responsive from 320px to 2560px.

---

## 2. Definition of Done (per feature)

A feature is "done" only when all of these hold:

- [ ] Behaviour matches its doc in `docs/`.
- [ ] Backend enforces auth, ownership, and role permissions.
- [ ] Inputs validated server-side (zod or equivalent); errors return typed JSON.
- [ ] Every admin action writes an **audit log** entry (`docs/08` §Audit).
- [ ] UI works and looks correct at 320 / 375 / 768 / 1024 / 1440 / 1920 / 2560 px.
- [ ] `npm run typecheck` passes in both apps; `npm run build` passes in web.
- [ ] No new console errors on a headless click-through of the affected pages.
- [ ] Demo Mode and Live Mode are both respected where relevant.

---

## 3. Build Order (do not skip ahead)

Work strictly top-to-bottom. Each item waits for explicit approval.

```
☑ Repository Setup            ☐ Live Mode
☑ Design System               ☐ Broker Portal
☑ Landing Page                ☐ Admin Portal
☑ Authentication              ☐ CMS
☑ Dashboard                   ☐ AI Assistant
☑ Trading Terminal            ☐ Market Data Service   ← next major build
☑ Wallets (base)              ☐ News Center
☑ Demo Mode (base)            ☐ Presentation Toolkit
                              ☐ Testing
                              ☐ Deployment
```

`☑` = a working baseline exists and is deployed. `☐` = spec'd in docs, not yet
built to the new spec. See `docs/14-Roadmap.md` for the authoritative live status.

---

## 4. Conventions

- **Language/stack:** TypeScript everywhere. Web = Next.js 15 App Router + React 19
  + Tailwind. API = Express + Prisma + PostgreSQL.
- **Money:** never use floats for stored balances in new code paths; use integer
  minor units or `Decimal`. Existing balances use `Float` — do not widen that use.
- **Naming:** camelCase in TS, snake-free DB via Prisma mapping, kebab-case routes.
- **Commits:** imperative, scoped, one logical change. Trailers as configured for
  the session. Do not include internal model identifiers in any pushed artifact.
- **Branches:** develop on the designated feature branch; never push elsewhere
  without explicit permission.
- **Secrets:** never commit secrets. All secrets come from environment variables
  (`docs/12-Deployment.md`).

---

## 5. Guardrails for External Data

- The frontend must **never** call Binance/Bybit/news providers directly. All
  external market and news data flows through the backend Market Data Service
  (`docs/07`).
- Respect provider terms. Use only approved, documented providers. No scraping.
- Treat all third-party responses as untrusted input: validate and clamp before
  storing or rendering.

---

## 6. When Unsure

Ask. A one-line clarifying question is cheaper than a wrong feature. Prefer the
smallest change that satisfies the doc. Leave a `// TODO(nxp):` with context if you
must defer something, and record it in `docs/14-Roadmap.md`.

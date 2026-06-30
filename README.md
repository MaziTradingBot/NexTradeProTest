# NexTradePro (NXP) — Enterprise Cryptocurrency Trading Platform

A production-quality, full-stack crypto trading platform showcase. Live market data,
professional trading UI, copy trading, and a **granular role-based admin system** —
built as a multi-page web app deployable to **Vercel** (frontend) and **Render** (backend).

> ⚠️ Demo platform. Prices are live (public market data); all order execution is **simulated**.

---

## ✨ Highlights

- **Multi-page Next.js 15 / React 19 app** — landing, markets, trading terminal, copy trading,
  pricing, about, auth, user dashboard, and a full admin panel.
- **Granular admin role assignment** — a Super Admin can assign roles such as
  *Withdrawal Approval Admin*, *KYC Admin*, *Finance Admin*, *Support Admin*, *General Admin*,
  *Content Admin* and *User Management Admin* to any registered user. Each role bundles a curated
  set of permissions, and the admin UI only reveals the modules a user is permitted to see.
- **RBAC backend** — Express + Prisma with permission-checked routes, audit logging on every
  admin action, JWT auth with refresh tokens, rate limiting and Helmet.
- **Live market data** — Binance public API proxied & cached by the backend (with a graceful
  fallback so the UI always renders).
- **Fast & responsive** — statically rendered marketing pages, ~103 kB shared JS, mobile-first
  Tailwind UI, reduced-motion support, SEO metadata, sitemap & robots.

---

## 🏗️ Architecture

```
NexTrade/
├── apps/
│   ├── web/          # Next.js 15 + React 19 + Tailwind frontend  → Vercel
│   └── api/          # Express + TypeScript + Prisma backend       → Render
│       └── prisma/   # schema + seed (roles, permissions, demo data)
├── docs/             # deployment & architecture docs
├── render.yaml       # Render blueprint for the API
└── .github/workflows # CI (typecheck + build)
```

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, Framer Motion, Recharts, Zustand ·
Node/Express, Prisma, PostgreSQL (Neon), JWT · deploy Vercel + Render.

---

## 🚀 Quick start (local)

Requires Node 20+ and a PostgreSQL database (local or a free [Neon](https://neon.tech) instance).

```bash
# 1. Install everything
npm install

# 2. Configure the API
cp apps/api/.env.example apps/api/.env      # set DATABASE_URL + JWT secrets

# 3. Create the schema and seed roles + demo users
cd apps/api
npm run prisma:push      # or: npm run prisma:migrate
npm run seed
cd ../..

# 4. Configure the web app
cp apps/web/.env.example apps/web/.env       # NEXT_PUBLIC_API_URL=http://localhost:4000

# 5. Run both apps
npm run dev              # web → http://localhost:3000 , api → http://localhost:4000
```

### Demo accounts (password: `Password123!`)

| Role                     | Email                          |
| ------------------------ | ------------------------------ |
| Super Admin              | super@nextradepro.com          |
| General Admin            | general@nextradepro.com        |
| Withdrawal Approval Admin| withdrawals@nextradepro.com    |
| KYC Admin                | kyc@nextradepro.com            |
| Support Admin            | support@nextradepro.com        |
| Standard Trader          | trader@nextradepro.com         |

Log in as the **Super Admin** → open **Admin → Users & Roles** → assign any admin role to a user.
Log in as the **Withdrawal Admin** to see a panel scoped to only the withdrawals module.

---

## 🔐 The admin role system

Roles and permissions are defined in [`apps/api/src/lib/rbac.ts`](apps/api/src/lib/rbac.ts).

| Admin role               | Key permissions                                            |
| ------------------------ | ---------------------------------------------------------- |
| Super Admin              | everything                                                 |
| General Admin            | dashboard, analytics, users (view), support (view)         |
| Withdrawal Approval Admin| withdrawals view + approve/reject                          |
| Finance Admin            | deposits + withdrawals + analytics                         |
| KYC Admin                | KYC view + approve/reject                                  |
| Support Admin            | support tickets                                            |
| Content Admin            | blog / news / CMS                                          |
| User Management Admin    | users + role assignment                                    |

- Backend enforces access with `requirePermission(...)` middleware on every admin route.
- Frontend reveals admin modules based on the live permission set returned by `/api/auth/me`.
- Every assignment, approval and status change is written to the **audit log**.

See [`docs/ADMIN.md`](docs/ADMIN.md) for the full model.

---

## ☁️ Deployment

Full instructions in [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). In short:

- **Backend → Render:** the included `render.yaml` blueprint (root `apps/api`). Set `DATABASE_URL`
  (Neon) and `CORS_ORIGINS` (your Vercel URL). JWT secrets are auto-generated.
- **Frontend → Vercel:** set the project **Root Directory** to `apps/web` and the env var
  `NEXT_PUBLIC_API_URL` to your Render API URL.
- **Database → Neon**, **Redis (optional) → Upstash**.

---

## 📜 Scripts

| Command                | Description                          |
| ---------------------- | ------------------------------------ |
| `npm run dev`          | Run web + api together               |
| `npm run build`        | Build api then web                   |
| `npm run seed` (api)   | Seed roles, permissions & demo data  |
| `npm run prisma:push`  | Sync schema to the database          |

---

## 📄 License

Demonstration project for portfolio / client showcase purposes.

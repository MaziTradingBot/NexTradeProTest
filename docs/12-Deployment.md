# 12 — Deployment

Frontend on **Vercel**, backend on **Render** (`render.yaml`), database on **Neon**.

## 1. Topology

```
Vercel (apps/web)  ──HTTPS──▶  Render (apps/api)  ──▶  Neon Postgres
   NEXT_PUBLIC_API_URL            CORS_ORIGINS            DATABASE_URL
```

## 2. Environment variables

### Backend (Render) — `apps/api`

| Var                    | Example / notes                                        |
|------------------------|--------------------------------------------------------|
| `DATABASE_URL`         | Neon **pooled** URL for runtime                        |
| `DIRECT_URL`           | Neon **UNPOOLED** URL for `prisma db push`/migrations   |
| `JWT_SECRET`           | strong random secret (access token)                    |
| `JWT_REFRESH_SECRET`   | strong random secret (refresh token)                   |
| `CORS_ORIGINS`         | comma-sep exact origins, e.g. `https://<app>.vercel.app` |
| `GOOGLE_CLIENT_ID`     | must match web's `NEXT_PUBLIC_GOOGLE_CLIENT_ID`        |
| `NODE_ENV`             | `production` (enables secure cross-site cookies)       |
| `PORT`                 | provided by Render                                     |
| News/metadata keys     | `CRYPTOPANIC_TOKEN`, `NEWSAPI_KEY` (Market Data Svc)   |

### Frontend (Vercel) — `apps/web`

| Var                          | Notes                                             |
|------------------------------|---------------------------------------------------|
| `NEXT_PUBLIC_API_URL`        | Render base URL, `https://`, **no** `/api`, no `/`|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`| Google OAuth client id (matches backend)         |

`NEXT_PUBLIC_*` are baked at build time → **redeploy after changing them**.

## 3. Google OAuth setup

- In Google Cloud Console → Credentials → OAuth client:
  - **Authorized JavaScript origins** = the exact Vercel origin(s) (`https://…`,
    no path, no trailing slash). Preview URLs change per deploy — use the stable
    production domain.
- `GOOGLE_CLIENT_ID` (Render) and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (Vercel) must be
  identical.

## 4. Database (Neon)

- Runtime uses the pooled connection; `prisma db push`/migrations need the
  **UNPOOLED** (`DIRECT_URL`) connection.
- Rotate the DB password if it was ever exposed; update both Render vars.

## 5. Health & readiness

- `GET /health` → `{ "status": "ok" }`. Render free tier cold-starts after
  inactivity (~30–60s first request).

## 6. Deploy steps

1. Push to the deploy branch.
2. Render builds `apps/api` (installs, `prisma generate`, build, start); run
   `prisma db push` when schema changed.
3. Vercel builds `apps/web`.
4. Verify `/health`, then a full login → dashboard → trade smoke test.

## 7. Troubleshooting (common production issues)

| Symptom                        | Likely cause / fix                                   |
|--------------------------------|------------------------------------------------------|
| `Failed to fetch` on login     | Backend asleep/down (check `/health`); `NEXT_PUBLIC_API_URL` unset/wrong on Vercel (redeploy after set); Vercel origin missing from `CORS_ORIGINS`; API URL not `https://` (mixed content) |
| Google `Error 400: origin_mismatch` | Vercel origin not in Google "Authorized JavaScript origins" (exact, no slash) |
| Logged out immediately / cookie not set | `NODE_ENV` not `production` on Render → secure cross-site cookies not sent |
| 401 loops                      | `tokenVersion` mismatch after admin reset — re-login  |
| CORS blocked                   | Origin not in `CORS_ORIGINS` (exact, comma-sep)       |
| `prisma db push` fails         | Using pooled URL — use `DIRECT_URL` (UNPOOLED)        |

## 8. Rollback

Vercel and Render keep prior deployments — promote/redeploy a known-good build.
For schema, keep migrations forward-only with backfills; never drop live columns
without a documented plan.

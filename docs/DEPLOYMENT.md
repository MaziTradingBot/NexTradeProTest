# Deployment Guide

NexTradePro deploys as two services: the **Next.js frontend on Vercel** and the
**Express API on Render**, backed by a **Neon PostgreSQL** database.

```
[ Vercel: apps/web ]  ──HTTPS──▶  [ Render: apps/api ]  ──▶  [ Neon Postgres ]
   NEXT_PUBLIC_API_URL              CORS_ORIGINS, DATABASE_URL
```

---

## 1. Database — Neon

1. Create a project at https://neon.tech and copy the **pooled** connection string.
2. It will look like:
   `postgresql://USER:PASSWORD@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

---

## 2. Backend — Render

### Option A — Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint**, pick the repo. Render reads `render.yaml`.
3. Set the secret env vars when prompted:
   - `DATABASE_URL` — your Neon pooled string
   - `CORS_ORIGINS` — your Vercel URL, e.g. `https://nextradepro.vercel.app`
   - (`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` are generated automatically)
4. Deploy. The start command runs migrations then boots the server.

### Option B — Manual Web Service
- **Root Directory:** `apps/api`
- **Build Command:** `npm install && npm run build`
- **Start Command:** `npm run prisma:migrate && npm run start`
- **Health Check Path:** `/health`
- Add the env vars listed above plus `NODE_ENV=production`.

### Seeding production (one-time)
From the Render shell (or locally pointed at the prod DB):
```bash
cd apps/api && npm run seed
```

---

## 3. Frontend — Vercel

1. In Vercel: **Add New → Project**, import the repo.
2. **Root Directory:** `apps/web`
3. Framework preset: **Next.js** (auto-detected).
4. Environment variable:
   - `NEXT_PUBLIC_API_URL` = your Render API URL (e.g. `https://nextradepro-api.onrender.com`)
5. Deploy.

---

## 4. Wire them together

- Make sure the API's `CORS_ORIGINS` contains the exact Vercel domain.
- Auth cookies are `SameSite=None; Secure` in production — both apps must be served over HTTPS
  (Vercel and Render both provide this automatically).
- For a custom domain on both, set `COOKIE_DOMAIN=.yourdomain.com` on the API.

---

## 5. Docker (optional)

The API ships a `Dockerfile`:
```bash
docker build -t nxp-api apps/api
docker run -p 4000:4000 --env-file apps/api/.env nxp-api
```

---

## Environment variables reference

### API (`apps/api/.env`)
| Var | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | ✅ | Neon Postgres connection string |
| `JWT_ACCESS_SECRET` | ✅ | `openssl rand -hex 32` |
| `JWT_REFRESH_SECRET` | ✅ | `openssl rand -hex 32` |
| `CORS_ORIGINS` | ✅ | Comma-separated allowed frontend origins |
| `PORT` | – | Defaults to 4000 (Render sets its own) |
| `COOKIE_DOMAIN` | – | For cross-subdomain cookies |

### Web (`apps/web/.env`)
| Var | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_API_URL` | ✅ | URL of the Render API |

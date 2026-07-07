# 15 — Client Demo & Showcase Mode

How to present NexTradePro flawlessly, and the spec for the one-click **Client
Showcase Mode**. Backend: `toolkit.routes.ts`; DEMO mode only — never touches LIVE.

## 1. Goal

A single admin action — **"Start Client Presentation"** — that resets the demo
environment to a clean, polished, realistic state so every demo looks impressive
and identical.

## 2. What "Start Client Presentation" does

When an authorized admin clicks it, the toolkit (atomically, DEMO scope only):

1. **Switches the platform into Presentation Mode** (a flag/state that the app can
   read to show a clean, demo-optimized surface).
2. **Resets all demo accounts** to their initial state.
3. **Refills demo accounts** to a standard balance (e.g. **$100,000**).
4. **Populates dashboards** with realistic activity.
5. **Generates fresh demo trades** (mix of open/closed, wins/losses) and
   **notifications**.
6. **Ensures all charts are active** and rendering (recent data present).
7. Presents a clean, consistent environment ready to demo.

Every action is **audited** and strictly scoped to **DEMO**. A confirmation step
prevents accidental resets.

## 3. Presentation Toolkit — one-click actions (`docs/08`)

- Reset Entire Demo Platform
- Refill Demo Accounts to $100,000
- Reset Charts
- Reset Portfolio Performance
- Generate Demo Trades
- Generate Demo Deposits
- Generate Demo Withdrawals
- Generate Notifications
- Generate AI Reports
- Generate Market Activity
- Generate Support Chats
- Generate Leaderboards
- Generate Testimonials
- Generate Blog Posts
- Generate News
- Generate Analytics

Each is idempotent, DEMO-scoped, audited, and safe to re-run.

## 4. Presentation Mode semantics

- A `PlatformSetting`/`FeatureFlag` (e.g. `presentationMode`) marks the state.
- While on: prefer polished demo data, hide half-finished surfaces, keep all
  widgets populated. It must **never** alter LIVE data or expose real user data.
- "Stop Presentation" returns the platform to normal demo browsing.

## 5. Data realism guidelines

Generated demo data should look plausible, not random noise:

- **Trades:** realistic symbols, sizes, leverage; a believable win/loss ratio;
  timestamps spread across recent days; some open, some closed.
- **P&L / stats:** coherent with the trades (win rate matches, ROI matches
  balance changes). Use the P&L Manager propagation (`docs/08` §4).
- **Notifications / news / activity:** recent, varied, on-brand copy.
- **Leaderboards / testimonials:** consistent names and numbers across refreshes
  within a session.

## 6. Presenter checklist (manual)

Before a live demo:

1. Confirm backend `/health` is up (wake Render if cold — `docs/12` §5).
2. Click **Start Client Presentation**; wait for confirmation toast.
3. Verify: dashboard populated, charts live, a few open positions, notifications
   present, wallet at $100k.
4. Confirm you are in **DEMO** mode (mode badge) — never demo on LIVE.
5. Do a 30-second walk: Landing → Login → Dashboard → Trading (place a demo
   order) → Portfolio → Wallet → Admin (funding + audit) → News/Markets.
6. Check the device you'll present on renders correctly (`docs/03` responsive).

## 7. Safety rails

- Presentation actions require admin permission and are audited.
- Hard DEMO-only guard: the toolkit must refuse to run against LIVE data.
- Refill/reset is confirmed via an explicit modal to avoid accidental wipes.
- No real user PII is ever generated or exposed.

## 8. Current vs target

Baseline `toolkit.routes.ts` provides some demo generators. To build to spec:
the unified **"Start Client Presentation"** action, the **Presentation Mode**
flag + app awareness, and the full one-click action list in §3 with realistic,
coherent data generation and audit coverage.

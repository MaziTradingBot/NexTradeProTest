# 06 — Trading Engine

Simulated but realistic margin/futures-style trading. Real prices, simulated
fills and settlement. Code: `apps/api/src/lib/trading.ts` (math) and
`apps/api/src/lib/tradingEngine.ts` (background processing).

## 1. Account model (per user, per mode)

| Metric            | Definition                                                    |
|-------------------|---------------------------------------------------------------|
| **Balance**       | Realized cash in the wallet (deposits ± closed P&L)           |
| **Equity**        | Balance + floating (unrealized) P&L of open positions          |
| **Used margin**   | Σ (position notional / leverage) for open positions            |
| **Free margin**   | Equity − Used margin                                           |
| **Margin level**  | Equity / Used margin × 100%                                     |
| **Floating P&L**  | Σ mark-to-market P&L of open positions                         |
| **Exposure**      | Σ position notional (size × price)                             |

## 2. Positions & orders

- **Sides:** BUY (long), SELL (short). **Leverage:** capped per config (do not
  hardcode a cap in components; read from config/settings).
- **Order types:** Market, Limit, Stop, Stop-Limit, OCO, Trailing-Stop — all
  execute via the engine.
- **Per-position risk:** optional Stop Loss (SL) and Take Profit (TP).
- Orders/positions are mode-scoped and user-scoped (`docs/05` §6).

## 3. Lifecycle

```
place order
  → validate (symbol, size, leverage, free margin, permission, mode)
  → MARKET: fill now at live price
  → WORKING (Limit/Stop/Stop-Limit/OCO/Trailing): store as pending
open position
  → reserve used margin; compute liquidation price
engine tick (interval):
  → pull live prices (marketPrice.ts)
  → fill working orders whose trigger/limit is crossed (respect OCO cancel-other,
     trailing-stop ratchet)
  → update floating P&L; evaluate SL / TP
  → if margin level ≤ stop-out threshold → auto-liquidate (worst first)
  → fire price alerts
  → emit events (SSE) for balance/equity/position changes
close position
  → realize P&L into balance; release margin; write Transaction + audit(if admin)
```

## 4. Fill & pricing rules

- Prices come from `marketPrice.ts` (Binance→Bybit→last-known cache). The engine
  degrades gracefully to last-known price rather than throwing.
- Simulated fills use the current mark price (no synthetic slippage unless a doc
  later specifies it). Document any fee model here before adding fees.

## 5. Liquidation / stop-out

- Each position has a computed liquidation price from entry, leverage, and side.
- When **margin level ≤ stop-out %**, the engine liquidates positions (most
  unfavorable first) until the account is back above the threshold or flat.
- Liquidations are recorded as transactions and surfaced to the user.

## 6. Gating

- **LIVE** trading requires: verified KYC + per-user `liveTradingEnabled` +
  account not frozen (`tradingStatus`) + sufficient free margin.
- **DEMO** trading is always available with play money.
- Admin can freeze/unfreeze, force-close, and adjust leverage/balance
  (`docs/08` §Trading controls) — every such action is audited.

## 7. Statistics (derived)

Win rate, loss rate, realized/unrealized P&L, daily/weekly/monthly/lifetime P&L,
ROI, trading volume, average win/loss, drawdown. These power the dashboard,
portfolio analytics, and leaderboards. Admin P&L Manager (`docs/08`) can override
these for demo/presentation; overrides propagate to dashboard, charts, analytics,
portfolio, and leaderboards.

## 8. Copy trading

Copy = a **pre-filled order ticket** the user reviews and confirms. Nothing
executes automatically. Clearly labeled as simulated. Source: `copy-trading` page
→ `/trading` with query params (symbol/side/leverage/copyFrom).

## 9. Invariants (must always hold)

- Balance never goes negative from normal trading (liquidation caps loss).
- Used margin ≤ equity except transiently before stop-out fires.
- Closing a position exactly reverses its reserved margin.
- DEMO and LIVE accounting never cross.
- Every state-changing admin action is audited.

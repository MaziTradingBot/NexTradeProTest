# 08 — Admin Portal (Back Office)

Advanced administration. Routes: `apps/api/src/routes/admin.routes.ts` +
`toolkit.routes.ts`; UI under `apps/web/src/app/admin/*` with `AdminSidebar`.
**All access is permission-checked on the backend; all mutations are audited.**

## 1. Sections

| Section              | Purpose                                                  |
|----------------------|----------------------------------------------------------|
| Dashboard            | Platform KPIs, recent activity                           |
| Users                | List/search users, status, login method, live-trade flag |
| Client Profile Mgr   | Edit name/email/phone/address/country/status/notes       |
| Wallet Manager       | Credit/debit/freeze/unfreeze/reset/edit balances         |
| Deposits             | Approve / reject                                         |
| Withdrawals          | Approve / reject (reservation → settle or refund)        |
| KYC                  | Review identity + Proof-of-Address (approve/reject/resubmit)|
| Trading Controls     | Freeze, force-close, adjust leverage/balance, transfer, monitor |
| P&L Manager          | Adjust realized/unrealized/period P&L, ROI, volume, win% |
| Portfolio Editor     | Add/remove asset, adjust holdings, entry/current price   |
| Trading History Mgr  | Add/edit/remove/close/reopen trades; generate demo trades |
| Presentation Toolkit | One-click demo population & resets (`docs/15`)           |
| Audit Logs           | Searchable, exportable action history                    |
| CMS                  | Announcements/news/blog content (`content.routes.ts`)    |

## 2. Demo Mode controls

Credit/Debit/Reset demo wallet, Reset demo portfolio, Generate demo
profit/loss/trades/deposits/withdrawals/notifications/AI insights, Reset demo
leaderboards, Reset analytics. All scoped to **DEMO** only.

## 3. Live Mode controls (authorized admins)

Credit/Debit/Adjust user balance, Approve/Reject deposits & withdrawals, Freeze/
Unfreeze account, Verify KYC, Edit portfolio holdings, Adjust account statistics.
LIVE actions require elevated permission and always write audit entries.

## 4. Profit & Loss Manager

Admin can set: Realized P&L, Unrealized P&L, Daily/Weekly/Monthly/Lifetime P&L,
ROI, Trading Volume, Win Rate, Loss Rate. Changes **propagate** to Dashboard,
Charts, Analytics, Portfolio, and Leaderboards. (Primarily a demo/presentation
tool; on LIVE use with care and full audit.)

## 5. Portfolio Editor

Add asset, Remove asset, Increase/Decrease holdings, Edit entry price, Edit
current value, Reset portfolio. Mode-aware.

## 6. Trading History Manager

Add, Edit, Remove, Close, Reopen trades; Generate demo trades. Edits are audited
with previous→new snapshots.

## 7. Wallet Manager

Credit, Debit, Freeze, Unfreeze, Reset, Edit balances. Funding uses atomic
transactions and emits SSE so the client balance updates in real time.

## 8. Client Profile Manager

Admin may edit: Name, Email, Phone, Address, Country, Verification status,
Account status, Notes. **Users cannot self-edit protected identity fields**
(First/Last name, DOB, Customer ID, Account number) — only admins can, after
verification. Legal name changes require admin approval post-KYC.

## 9. Audit Logs (MANDATORY)

Model: `AuditLog`. Every admin/broker mutation records:

`administrator, targetUser, mode (DEMO/LIVE), previousValue, newValue, reason,
timestamp, ipAddress (if available)`.

Logs are **searchable** (by admin, user, action, mode, date range) and
**exportable** (CSV). Never delete audit logs from the app.

## 10. Role-based access (enforced on backend)

| Role          | Scope                                                            |
|---------------|-----------------------------------------------------------------|
| Super Admin   | Full platform access                                            |
| Administrator | Users, wallets, deposits, withdrawals, analytics, CMS          |
| Broker        | Assigned clients, notes, KYC review, dep/wd recommendations, commissions (`docs/09`) |
| Support       | Support tickets, live chat, user assistance                    |

Permissions (`docs/09` §Matrix) are checked in `lib/rbac.ts` guards per route.

## 11. Current vs target

Working: users list (with login method + live-trade flag), wallet/funding, deposit
& withdrawal approvals, KYC + POA review, trading controls (freeze/force-close/
adjust-balance/transfer/monitoring), audit logging, base toolkit.

To build to spec: full **P&L Manager**, **Portfolio Editor**, **Trading History
Manager**, **Client Profile Manager** protected-field rules, audit **search +
export UI**, and the full **Presentation Toolkit / Client Showcase Mode**
(`docs/15`).

# 09 — Broker Portal

A scoped workspace for brokers to manage **only their assigned clients**. Routes:
`apps/api/src/routes/broker.routes.ts`; UI under `apps/web/src/app/broker/*`.

## 1. Purpose

Brokers are client-facing operators. They see and act on the subset of users
assigned to them — never the whole user base. All actions are permission-checked
and audited like any admin action (`docs/08` §9).

## 2. Capabilities

- **Assigned Clients** — list/search only clients assigned to this broker.
- **Client Notes** — private operational notes per client.
- **KYC Review** — review identity + Proof-of-Address for assigned clients.
- **Deposit & Withdrawal Recommendations** — brokers can recommend approve/reject;
  final approval follows the role matrix (may require an Administrator).
- **Commission Tracking** — track commissions attributable to the broker.

## 3. Assignment model

Clients are linked to a broker (e.g. `User.brokerId` or an assignment table).
Every broker query MUST filter by "assigned to `req.user.id`" in addition to the
normal per-user isolation rules. A broker must never read a non-assigned user's
data.

## 4. Permission matrix (enforced in `lib/rbac.ts`)

| Capability                         | Super Admin | Administrator | Broker | Support |
|------------------------------------|:-----------:|:-------------:|:------:|:-------:|
| Full platform access               | ✅          | —             | —      | —       |
| User management                    | ✅          | ✅            | assigned only | — |
| Wallet management                  | ✅          | ✅            | —      | —       |
| Approve/reject deposits            | ✅          | ✅            | recommend | —    |
| Approve/reject withdrawals         | ✅          | ✅            | recommend | —    |
| KYC review                         | ✅          | ✅            | assigned only | — |
| Client notes                       | ✅          | ✅            | assigned only | ✅ (view) |
| Commission tracking                | ✅          | ✅            | own    | —       |
| Analytics / CMS                    | ✅          | ✅            | —      | —       |
| Support tickets / live chat        | ✅          | ✅            | —      | ✅      |

`✅` = allowed; `recommend` = can suggest, cannot finalize; `assigned only` =
limited to assigned clients; `—` = denied. Named permissions back each cell.

## 5. Isolation guarantees

- A broker's queries are double-scoped: assigned-client filter **and** the target
  data's `userId`.
- Recommendations create records/audit entries but do not move money; only an
  authorized approver settles.
- Commissions are computed from the broker's assigned clients' activity only.

## 6. Current vs target

Baseline `broker.routes.ts` exists (assigned clients). To build to spec:
notes CRUD, KYC review scoped to assigned clients, deposit/withdrawal
recommendation workflow, and commission tracking + reporting.

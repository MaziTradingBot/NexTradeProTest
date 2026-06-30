# Admin & Role-Based Access Control (RBAC)

NexTradePro implements **granular admin roles** so that registered users can be granted
specific administrative capabilities — exactly as a real exchange operates.

## Concepts

- **Permission** — a single capability, e.g. `withdrawals.approve`, `kyc.view`, `roles.assign`.
- **Role** — a named bundle of permissions, e.g. *Withdrawal Approval Admin*.
- **UserRole** — assignment of a role to a user (records *who* assigned it and *when*).

A user can hold multiple roles; their effective permission set is the union of all role
permissions. `SUPER_ADMIN` implicitly has every permission.

```
User ──< UserRole >── Role ──< RolePermission >── Permission
```

## Built-in roles

Defined in [`apps/api/src/lib/rbac.ts`](../apps/api/src/lib/rbac.ts) and created by the seed.

| Role | `isAdmin` | Purpose |
| --- | --- | --- |
| `USER` | no | Standard trader |
| `SUPER_ADMIN` | yes | Unrestricted access |
| `GENERAL_ADMIN` | yes | Day-to-day administration & analytics |
| `WITHDRAWAL_ADMIN` | yes | Approve / reject withdrawals |
| `FINANCE_ADMIN` | yes | Deposits + withdrawals + analytics |
| `KYC_ADMIN` | yes | Approve / reject KYC |
| `SUPPORT_ADMIN` | yes | Support tickets |
| `CONTENT_ADMIN` | yes | Blog / news / CMS |
| `USER_ADMIN` | yes | Manage users & assign roles |

## Assigning a role

1. Sign in as a user with `roles.assign` (Super Admin or User Management Admin).
2. Go to **Admin → Users & Roles**.
3. Click **Manage roles** on any user.
4. Pick a role from the list and click **Assign** (or the **✕** to revoke).

Only a Super Admin may grant or revoke the `SUPER_ADMIN` role.

### API
```
GET    /api/admin/users                      # list users (perm: users.view)
GET    /api/admin/roles                       # list roles + permissions
POST   /api/admin/users/:id/roles             # body { roleKey }  (perm: roles.assign)
DELETE /api/admin/users/:id/roles/:roleKey    # revoke           (perm: roles.assign)
PATCH  /api/admin/users/:id/status            # suspend/activate (perm: users.manage)
```

## Enforcement

**Backend** — `authenticate` loads the user's flattened permission set; `requirePermission(...)`
and `requireAdmin` guard each route. See
[`apps/api/src/middleware/auth.ts`](../apps/api/src/middleware/auth.ts).

**Frontend** — the sidebar and action buttons render conditionally from the permission list
returned by `/api/auth/me`, so each admin only sees the modules they can use. See
[`apps/web/src/components/AdminSidebar.tsx`](../apps/web/src/components/AdminSidebar.tsx).

## Audit logging

Every sensitive action (`role.assign`, `role.revoke`, `withdrawal.approved`, `kyc.rejected`,
`user.status`, …) is written to the `AuditLog` table and visible under **Admin → Audit Log**
(permission `system.audit`).

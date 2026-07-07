# 16 — Password & Authentication UX

Specification for password entry and authentication conveniences across
NexTradePro (Client, Broker and Admin portals).

---

## 1. Reusable Password Input (single source of truth)

Every password field in the app uses one component:
`apps/web/src/components/PasswordInput.tsx`. Do not build ad-hoc password
inputs. Policy/strength logic lives in `apps/web/src/lib/password.ts` (client)
and `apps/api/src/lib/password.ts` (server — authoritative).

### Show / hide toggle
- An eye / crossed-eye button sits **inside** the field on the right.
- Toggles between hidden (`••••••••`) and visible (`text`) — a **local display
  change only**; it never clears, modifies, or transmits the value differently.
- Focus and caret position are preserved on toggle (`onMouseDown → preventDefault`).
- Clickable on desktop, ≥44px touch target on mobile, keyboard-operable, with a
  dynamic `aria-label` ("Show password" / "Hide password") and `aria-pressed`.

### Caps Lock warning
- While typing, if Caps Lock is on, a "Caps Lock is on" alert appears
  (`getModifierState('CapsLock')`, `role="alert"`).

### Strength meter (new-password fields only, `showStrength`)
- 4-segment bar + label, live as the user types.

| Level    | Colour  |
|----------|---------|
| 🔴 Weak   | red     |
| 🟠 Fair   | gold    |
| 🟡 Good   | yellow  |
| 🟢 Strong | emerald |

- A live requirement checklist (✓/✗): 8+ chars, uppercase, lowercase, number,
  special character.

---

## 2. Password policy (enforced client AND server)

| Rule                    | Value            |
|-------------------------|------------------|
| Minimum length          | 8                |
| Maximum length          | 128              |
| Uppercase letter        | required         |
| Lowercase letter        | required         |
| Number                  | required         |
| Special character        | required         |
| Common-password blocklist | rejected (e.g. `password`, `qwerty`, `admin123`) |

The **server is authoritative** (`strongPassword` zod schema). It is applied to:
register, reset-password, change-password, and admin reset-user-password. Login
is intentionally **not** policy-checked so pre-existing accounts can still sign in.

---

## 3. Where the component is used

- **Authentication:** Login, Register, Reset Password. (Forgot Password collects
  an email only — no password field.)
- **Security Settings:** Change Password (current / new / confirm), Change Email
  (confirm current password).
- **Admin Portal:** Reset User Password. (New admin/broker/support accounts are
  provisioned by registration + role assignment, so they flow through the same
  Register component.)

New-password fields show the strength meter; current-password / confirm fields
do not. "Confirm" fields show an inline "Passwords do not match" hint.

---

## 4. Accessibility (WCAG 2.1 AA)

- Semantic `<input>` with associated label; toggle is a real `<button>`.
- Visible focus ring on the toggle (`focus-visible:ring-brand-blue`).
- `aria-describedby` wires the caps-lock alert and strength summary to the field.
- Screen-reader friendly labels; keyboard navigable; works in high-contrast/dark.

---

## 5. Security

Password visibility only changes local display. Passwords are never:
logged to the console, stored in `localStorage`/`sessionStorage`, put in URL
params, or shown after submission. They are sent only over HTTPS and hashed
(bcrypt) on the backend. Session invalidation (`tokenVersion`) fires on password
change / admin reset.

---

## 6. Authentication conveniences

Implemented:
- 👁 Show / hide password (this component)
- 🔒 Caps Lock warning
- 🌐 Sign in with Google (`docs/05`)
- 📱 2FA (TOTP authenticator) — Settings → Security
- 🔑 Session invalidation on password/email change & admin reset
- 📧 **Email verification after registration** — token emailed (logged + returned
  in demo), `/verify-email` page, resend from Settings, `emailVerified` on `/me`,
  dashboard prompt banner. Google sign-in marks the email verified.
- ⏳ **Idle session timeout** — `SessionSentinel` auto-signs-out after 30 min of
  inactivity, with a 60-second warning modal + "Stay signed in"; redirects to
  `/login?timeout=1`.
- 🔔 **New-device login notifications** — first sign-in from an unseen device
  raises an in-app notification + email (email + Google paths).
- 📜 **Recent login history** — every attempt is stored (`LoginEvent`: device,
  IP, success, time); shown in Settings → Security.
- 🚨 **Account lockout** — 5 failed attempts locks the account for 15 minutes
  (`failedLoginCount` / `lockedUntil`); the login response warns as the limit
  nears, and password reset restores access.

Backlog (future-ready — not yet built):
- ✅ Remember Me (longer refresh window) on login
- 🌍 Approximate geo-location in login history (needs an IP-geo provider)

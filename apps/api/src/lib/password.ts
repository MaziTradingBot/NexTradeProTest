// Server-side password policy — the source of truth. Mirrors the client-side
// UX in apps/web/src/lib/password.ts. Applied to registration, password reset,
// admin reset and password change. Login is intentionally NOT policy-checked so
// pre-existing accounts can still sign in.

import { z } from 'zod';

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

const COMMON = ['password', '12345678', 'qwerty', 'letmein', 'admin123', 'welcome', 'iloveyou', 'trustno1', 'password1', 'abc12345'];

/** Returns a human-readable problem, or null if the password satisfies policy. */
export function passwordIssue(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `Password must be at least ${PASSWORD_MIN} characters`;
  if (pw.length > PASSWORD_MAX) return `Password must be at most ${PASSWORD_MAX} characters`;
  if (!/[A-Z]/.test(pw)) return 'Password must include an uppercase letter';
  if (!/[a-z]/.test(pw)) return 'Password must include a lowercase letter';
  if (!/[0-9]/.test(pw)) return 'Password must include a number';
  if (!/[^A-Za-z0-9]/.test(pw)) return 'Password must include a special character';
  if (COMMON.some((c) => pw.toLowerCase().includes(c))) return 'Password is too common — please choose a stronger one';
  return null;
}

/** Zod schema enforcing the full password policy. */
export const strongPassword = z.string().superRefine((pw, ctx) => {
  const issue = passwordIssue(pw);
  if (issue) ctx.addIssue({ code: z.ZodIssueCode.custom, message: issue });
});

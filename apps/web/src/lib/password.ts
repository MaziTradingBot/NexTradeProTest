// Shared password policy + strength evaluation. Used by the reusable
// PasswordInput and every auth/security form. The backend enforces the same
// rules (apps/api/src/lib/password.ts) — this is UX, not the source of truth.

export const PASSWORD_MIN = 8;
export const PASSWORD_MAX = 128;

export interface PasswordChecks {
  length: boolean; // >= PASSWORD_MIN
  maxOk: boolean; // <= PASSWORD_MAX
  upper: boolean;
  lower: boolean;
  number: boolean;
  special: boolean;
  notCommon: boolean;
}

export interface PasswordStrength {
  score: 0 | 1 | 2 | 3; // Weak, Fair, Good, Strong
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  checks: PasswordChecks;
  valid: boolean;
}

// A small blocklist of obviously weak passwords (case-insensitive substrings).
const COMMON = ['password', '12345678', 'qwerty', 'letmein', 'admin123', 'welcome', 'iloveyou', 'trustno1', 'password1', 'abc12345'];

export function checkPassword(pw: string): PasswordChecks {
  const lower = pw.toLowerCase();
  return {
    length: pw.length >= PASSWORD_MIN,
    maxOk: pw.length <= PASSWORD_MAX,
    upper: /[A-Z]/.test(pw),
    lower: /[a-z]/.test(pw),
    number: /[0-9]/.test(pw),
    special: /[^A-Za-z0-9]/.test(pw),
    notCommon: pw.length > 0 && !COMMON.some((c) => lower.includes(c)),
  };
}

export function evaluatePassword(pw: string): PasswordStrength {
  const checks = checkPassword(pw);
  const met = [checks.length, checks.upper, checks.lower, checks.number, checks.special].filter(Boolean).length;
  const valid = checks.length && checks.maxOk && checks.upper && checks.lower && checks.number && checks.special && checks.notCommon;

  let score: PasswordStrength['score'] = 0;
  if (!pw || !checks.notCommon || met <= 2) score = 0;
  else if (met === 3) score = 1;
  else if (met === 4) score = 2;
  else score = pw.length >= 12 ? 3 : 2; // all five met → Strong if long enough

  const label = (['Weak', 'Fair', 'Good', 'Strong'] as const)[score];
  return { score, label, checks, valid };
}

// The requirement checklist shown under a new-password field.
export const PASSWORD_REQUIREMENTS: { key: keyof PasswordChecks; label: string }[] = [
  { key: 'length', label: `At least ${PASSWORD_MIN} characters` },
  { key: 'upper', label: 'One uppercase letter' },
  { key: 'lower', label: 'One lowercase letter' },
  { key: 'number', label: 'One number' },
  { key: 'special', label: 'One special character' },
];

// Minimal email delivery. SMTP is not configured in this demo deployment, so
// emails are logged to the server (and, for user-initiated flows, the link is
// also returned in the response so demos work without a mail server). Swap the
// body of sendEmail() for a real transport (nodemailer / Resend / SES) and set
// SMTP_* env vars to enable real delivery in production.

export async function sendEmail(to: string, subject: string, body: string): Promise<void> {
  // eslint-disable-next-line no-console
  console.log(`✉️  [email] to=${to} · ${subject}\n${body}\n`);
}

export function appBaseUrl(): string {
  const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  return origins.find((o) => o.startsWith('http')) ?? 'http://localhost:3000';
}

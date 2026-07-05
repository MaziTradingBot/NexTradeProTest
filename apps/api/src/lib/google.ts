// Verify a Google Identity Services ID token against Google's tokeninfo
// endpoint (no external dependency). Returns the verified profile, or null if
// the token is invalid, unverified, or issued for a different app.

export interface GoogleProfile {
  sub: string;
  email: string;
  name?: string;
  picture?: string;
}

export async function verifyGoogleIdToken(credential: string): Promise<GoogleProfile | null> {
  try {
    const resp = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
    if (!resp.ok) return null;
    const info = (await resp.json()) as {
      aud?: string; email?: string; email_verified?: string | boolean; name?: string; sub?: string; picture?: string;
    };
    const expectedAud = process.env.GOOGLE_CLIENT_ID;
    if (expectedAud && info.aud !== expectedAud) return null;
    if (!info.sub || !info.email || (info.email_verified !== true && info.email_verified !== 'true')) return null;
    return { sub: info.sub, email: info.email.toLowerCase(), name: info.name, picture: info.picture };
  } catch {
    return null;
  }
}

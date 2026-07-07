// Best-effort approximate geo-location for an IP address, used only to give the
// user a human-readable "where" in their login history ("Lagos, Nigeria").
//
// Design constraints:
//  - Never block or fail a sign-in on account of geo — always resolves, and
//    returns null on any error, timeout, or private/unknown IP.
//  - No API key required (uses a free, key-less provider) so it works out of the
//    box; in locked-down/offline environments the outbound call simply fails and
//    we degrade gracefully to null.

const PRIVATE_IP =
  /^(::1$|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|fc00:|fe80:)/i;

/** Resolve an IP to a coarse "City, Region, Country" string, or null. */
export async function lookupLocation(ip?: string | null): Promise<string | null> {
  if (!ip) return null;
  // Strip IPv4-mapped IPv6 prefix (e.g. "::ffff:203.0.113.5").
  const clean = ip.replace(/^::ffff:/i, '').trim();
  if (!clean || PRIVATE_IP.test(clean)) return null;

  try {
    const r = await fetch(
      `http://ip-api.com/json/${encodeURIComponent(clean)}?fields=status,city,regionName,country`,
      { signal: AbortSignal.timeout(2500) },
    );
    if (!r.ok) return null;
    const d = (await r.json()) as {
      status?: string;
      city?: string;
      regionName?: string;
      country?: string;
    };
    if (d.status !== 'success') return null;
    const parts = [d.city, d.regionName, d.country].filter((p): p is string => !!p);
    // De-dupe when city and region are identical (e.g. city-states).
    const label = parts.filter((p, i) => parts.indexOf(p) === i).join(', ');
    return label || null;
  } catch {
    return null;
  }
}

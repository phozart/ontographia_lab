// lib/sameOrigin.js
// CSRF defense in depth for session-cookie routes that change state (on top of SameSite cookies and the JSON
// content-type requirement). A request whose Origin header is present must come from this app's own origin:
// the NEXTAUTH_URL origin, or the origin whose host matches the request's Host header (dev servers, previews).
// A missing Origin (non-browser clients, same-origin GETs in older browsers) is allowed: cookies are not ambient there.

export function isSameOriginRequest(req) {
  const origin = req.headers?.origin;
  if (origin === undefined) return true;
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false; // includes the literal "null" origin of sandboxed / cross-site contexts
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  try {
    if (process.env.NEXTAUTH_URL && new URL(process.env.NEXTAUTH_URL).origin === parsed.origin) return true;
  } catch {
    // ignore a malformed NEXTAUTH_URL
  }
  const host = req.headers?.host;
  return typeof host === 'string' && host !== '' && parsed.host === host;
}

/** Sends 403 and returns false when the request is cross-origin. */
export function requireSameOrigin(req, res) {
  if (isSameOriginRequest(req)) return true;
  res.status(403).json({ error: 'Cross-origin request rejected' });
  return false;
}

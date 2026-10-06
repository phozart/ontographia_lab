// components/diagram-studio/export/safeUrl.js
// Allow-list for URL-valued element data (imported files must not make viewers fetch arbitrary schemes).

export function isSafeUrl(value) {
  if (typeof value !== 'string' || value.length === 0 || value.length > 2000000) return false;
  const v = value.trim();
  if (/^https?:\/\//i.test(v)) return true;
  return /^data:image\/[a-z0-9.+-]+[;,]/i.test(v);
}

/** Safe CSS `url("...")` value, or undefined when the URL is not allowed. */
export function cssUrl(value) {
  if (!isSafeUrl(value)) return undefined;
  const escaped = value.trim().replace(/[\\"()\s]/g, (c) => (c === '(' ? '%28' : c === ')' ? '%29' : encodeURIComponent(c)));
  return `url("${escaped}")`;
}

// imageUrl, url, href, src, link (case-insensitive suffix match)
const URL_KEY_RE = /(url|href|src)$|^link$/i;
export const isUrlKey = (key) => URL_KEY_RE.test(key);

// Blocked schemes for string values under ANY key. `data:image/` stays allowed (isSafeUrl handles URL keys).
const SCHEME_RE = /^([a-z][a-z0-9+.-]*):/;
const BLOCKED_SCHEMES = new Set(['javascript', 'vbscript', 'data']);

/**
 * True when the value, normalized the way browsers do (control chars dropped, trimmed, lowercased), starts with
 * a blocked scheme. Prose such as "javascript: the good parts" (whitespace right after the colon) is not a URL
 * and is left alone, as is any other scheme-looking text ("http: nothing").
 */
export function hasBlockedScheme(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  // eslint-disable-next-line no-control-regex
  const v = value.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim().toLowerCase();
  const m = SCHEME_RE.exec(v);
  if (!m || !BLOCKED_SCHEMES.has(m[1])) return false;
  if (m[1] === 'data' && v.startsWith('data:image/')) return false;
  const next = v.charAt(m[0].length);
  return next !== '' && !/\s/.test(next);
}

/** True when a string value must be stripped: unsafe under a URL key, or a blocked scheme under any key. */
export function isUnsafeUrlValue(key, value) {
  if (typeof value !== 'string' || value === '') return false;
  return (isUrlKey(key) && !isSafeUrl(value)) || hasBlockedScheme(value);
}

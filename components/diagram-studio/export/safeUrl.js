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

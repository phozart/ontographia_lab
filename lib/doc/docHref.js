// lib/doc/docHref.js
// The ONE allow-list for links inside a doc (AI-5). Used by the renderer, the editor, the server validator and the
// MCP projections, so a link is either safe everywhere or inert everywhere. Pure.
//
// Allowed:
//   https?://...        external page (opens in a new tab, rel=noopener noreferrer)
//   mailto:a@b.co       mail address
//   #el=<elementId>     element link: selects and zooms to that element on the board
//   /diagram/<LAB-n|uuid>[?focus=ids | ?region=x,y,w,h]   another diagram (optionally focused)
// Everything else (javascript:, data:, vbscript:, file:, protocol-relative //host, relative paths, ...) is not a link.

export const MAX_HREF_LENGTH = 2000;
const EL_ID_RE = /^[A-Za-z0-9_.:@+~-]{1,128}$/;
const DIAGRAM_RE = /^\/diagram\/[A-Za-z0-9-]{1,64}(?:\?(?:focus|region)=[A-Za-z0-9_.:@+~,%-]{1,2000})?$/;
const MAILTO_RE = /^mailto:[^\s<>"'`\\]{1,254}$/i;
const FORBIDDEN_CHARS_RE = new RegExp('[\\u0000-\\u0020\\u007f-\\u00a0\\u2028\\u2029\\u200b-\\u200f\\u202a-\\u202e\\u2066-\\u2069\\ufeff]');

/**
 * @param {unknown} raw link destination exactly as written (already unescaped by the markdown parser)
 * @returns {{kind: 'external'|'mailto'|'element'|'diagram', href: string, elementId?: string} | null}
 */
export function docHref(raw) {
  if (typeof raw !== 'string') return null;
  const v = raw.trim();
  if (v.length === 0 || v.length > MAX_HREF_LENGTH) return null;
  // No whitespace or control character anywhere: this also defeats "java\tscript:" style smuggling.
  if (FORBIDDEN_CHARS_RE.test(v)) return null;

  if (/^https?:\/\//i.test(v)) {
    if (!/^https?:\/\/[^/?#\\]/i.test(v)) return null; // "https:///x" is not a host
    try {
      const u = new URL(v);
      if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.hostname) return null;
      return { kind: 'external', href: u.href };
    } catch {
      return null;
    }
  }
  if (/^mailto:/i.test(v)) {
    return MAILTO_RE.test(v) && v.includes('@') ? { kind: 'mailto', href: v } : null;
  }
  if (v.startsWith('#el=')) {
    const id = v.slice(4);
    return EL_ID_RE.test(id) ? { kind: 'element', href: v, elementId: id } : null;
  }
  if (DIAGRAM_RE.test(v)) return { kind: 'diagram', href: v };
  return null;
}

/** True when the destination is acceptable to keep in stored markdown. */
export const isAllowedDocHref = (raw) => docHref(raw) !== null;

/** `#el=<id>` for an element id (null when the id cannot be addressed). */
export function elementLink(id) {
  return typeof id === 'string' && EL_ID_RE.test(id) ? `#el=${id}` : null;
}

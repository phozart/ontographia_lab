// lib/doc/docLinks.js
// Turns a parsed doc link into an ABSOLUTE, allow-listed URL for use OUTSIDE the lab (clipboard, .docx, .pdf), where
// `#el=<id>` and `/diagram/...` would be dead. Every result passes `docHref` again plus a scheme check, so a
// hostile or malformed link is never emitted: it returns null and the caller writes the link text as plain text. Pure.

import { docHref } from './docHref';
import { buildFocusLink } from '../focusLink';

const OUT_RE = /^(https?:\/\/|mailto:)/i;

/** Absolute lab link to one board element, or null. The origin must be http(s) (a `javascript:` origin is refused). */
export function labElementLink({ origin, diagramRef, elementId } = {}) {
  if (!/^https?:\/\/[^/?#\\\s]/i.test(String(origin || '')) || !diagramRef || !elementId) return null;
  try {
    const out = buildFocusLink({ origin: String(origin).replace(/\/+$/, ''), diagramRef, ids: [elementId] });
    return OUT_RE.test(out) && docHref(out) ? out : null;
  } catch {
    return null;
  }
}

/**
 * @param {{kind: string, href: string, elementId?: string}} link a link node from parseMarkdown
 * @param {{origin?: string, diagramRef?: string}} ctx lab origin (https://host) and diagram reference (LAB-n | uuid)
 * @returns {string | null}
 */
export function absoluteDocLink(link, { origin = '', diagramRef = '' } = {}) {
  const checked = link && typeof link.href === 'string' ? docHref(link.href) : null;
  if (!checked) return null;
  const base = String(origin || '').replace(/\/+$/, '');
  let out = null;
  try {
    if (checked.kind === 'external' || checked.kind === 'mailto') out = checked.href;
    else if (checked.kind === 'element') {
      if (!base || !diagramRef) return null;
      out = buildFocusLink({ origin: base, diagramRef, ids: [checked.elementId] });
    } else if (checked.kind === 'diagram') out = base ? `${base}${checked.href}` : null;
  } catch {
    return null;
  }
  if (!out || !OUT_RE.test(out)) return null;
  // Re-validate the absolute form: a lab URL is an ordinary https link, mailto stays mailto.
  return docHref(out) ? out : null;
}

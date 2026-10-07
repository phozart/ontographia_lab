// lib/comments/legacyImport.js
// One-time import of the pre-slice-4 browser-only comments (localStorage key `comments-<diagramId>`), Q-C1.
// Pure planning + storage helpers; the posting itself goes through the normal create endpoints so the importing
// user is the author and original timestamps are not preserved.

import { MAX_BODY_LENGTH } from './validate';

export const legacyKey = (diagramId) => `comments-${diagramId}`;

const text = (v) => (typeof v === 'string' && v.trim() ? v.slice(0, MAX_BODY_LENGTH).replace(/\u0000/g, '') : null);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= 1e7 ? v : null);

/** @returns {object[]} raw legacy comments (never throws; storage may be unavailable or corrupt) */
export function readLegacyComments(storage, diagramId) {
  try {
    const raw = storage && storage.getItem(legacyKey(diagramId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

export function clearLegacyComments(storage, diagramId) {
  try { storage.removeItem(legacyKey(diagramId)); } catch (_) { /* ignore */ }
}

export function writeLegacyComments(storage, diagramId, comments) {
  try {
    if (comments.length) storage.setItem(legacyKey(diagramId), JSON.stringify(comments));
    else storage.removeItem(legacyKey(diagramId));
  } catch (_) { /* ignore */ }
}

/**
 * @param {object[]} legacy
 * @param {{id:string,x:number,y:number}[]} elements current diagram elements (to keep element anchors that still exist)
 * @returns {{anchor:object, body:string, replies:string[], resolved:boolean, threadId:string|null, source:object}[]} comments without usable text/position are dropped
 */
export function planImport(legacy, elements = []) {
  const plan = [];
  for (const c of legacy || []) {
    const body = text(c && c.text);
    const x = num(c && c.x);
    const y = num(c && c.y);
    if (!body || x === null || y === null) continue;
    const el = c.elementId && elements.find((e) => e && e.id === c.elementId && Number.isFinite(Number(e.x)) && Number.isFinite(Number(e.y)));
    const anchor = el
      ? { type: 'element', targetId: el.id, x: x - Number(el.x), y: y - Number(el.y), fallbackX: x, fallbackY: y }
      : { type: 'canvas', x, y };
    const replies = (Array.isArray(c.replies) ? c.replies : []).map((r) => text(r && r.text)).filter(Boolean);
    // threadId is set when an earlier attempt created the thread but stopped before finishing its replies / resolve.
    const threadId = typeof c._importedThreadId === 'string' ? c._importedThreadId : null;
    plan.push({ anchor, body, replies, resolved: c.resolved === true, threadId, source: c });
  }
  return plan;
}

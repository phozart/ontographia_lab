// lib/doc/docElement.js
// The doc element's data model and its server validation (AI-5; design 3.2 / 3.4).
//
//   element = { id, type: 'doc', packId: 'core', x, y, size: {width, height},
//               data: { doc: { title, markdown, collapsed?, restoreHeight?, excerptLines? } } }
//
// `validateDocElements` is called by `validateDiagramContent` after the structural checks. It enforces the caps,
// drops unknown keys, and rewrites the markdown through `sanitizeDocMarkdown` so the STORED text is clean for every
// consumer. Pure.

import { MAX_DOC_BYTES, utf8Length } from './markdown';
import { sanitizeDocMarkdown } from './sanitize';
import { appendMarkdown, replaceSection } from './docText';

export const MAX_DOCS_PER_DIAGRAM = 200;
export const MAX_DOC_TITLE = 200;
export const DOC_STENCIL = 'doc';
export const DOC_PACK = 'core';
export const DEFAULT_EXCERPT_LINES = 6;
const DOC_KEYS = new Set(['title', 'markdown', 'collapsed', 'excerptLines', 'restoreHeight']);
 
const TITLE_STRIP_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u202a-\\u202e\\u2066-\\u2069\\u2028\\u2029\\ufeff]', 'g');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export const isDocElement = (el) => isObj(el) && el.type === DOC_STENCIL && (el.packId === DOC_PACK || el.packId === undefined);

/** The doc payload of an element, or null. */
export const docOf = (el) => (isObj(el) && isObj(el.data) && isObj(el.data.doc) ? el.data.doc : null);

export const cleanTitle = (t) => String(t ?? '').replace(TITLE_STRIP_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_DOC_TITLE);

const utf8Bytes = utf8Length;

/**
 * Validate and clean one doc payload.
 * @returns {{ok: true, doc: object, stats: {links, html, images, droppedKeys}} | {ok: false, status: number, code: string, error: string}}
 */
export function cleanDoc(doc, path = 'doc') {
  if (!isObj(doc)) return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path} must be an object` };
  const out = {};
  let droppedKeys = 0;
  for (const key of Object.keys(doc)) {
    if (!DOC_KEYS.has(key)) droppedKeys += 1;
  }
  if (doc.title !== undefined) {
    if (typeof doc.title !== 'string') return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path}.title must be a string` };
    out.title = cleanTitle(doc.title);
  }
  const stats = { links: 0, html: 0, images: 0, droppedKeys };
  if (doc.markdown !== undefined) {
    if (typeof doc.markdown !== 'string') return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path}.markdown must be a string` };
    const bytes = utf8Bytes(doc.markdown);
    if (bytes > MAX_DOC_BYTES) {
      return { ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE', error: `${path}.markdown is too large (${bytes} bytes); the limit is ${MAX_DOC_BYTES} bytes` };
    }
    const s = sanitizeDocMarkdown(doc.markdown);
    out.markdown = s.markdown;
    stats.links = s.links;
    stats.html = s.html;
    stats.images = s.images;
  }
  if (doc.collapsed !== undefined) {
    if (typeof doc.collapsed !== 'boolean') return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path}.collapsed must be true or false` };
    out.collapsed = doc.collapsed;
  }
  if (doc.excerptLines !== undefined) {
    const n = doc.excerptLines;
    if (!Number.isInteger(n) || n < 1 || n > 30) return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path}.excerptLines must be a whole number from 1 to 30` };
    out.excerptLines = n;
  }
  if (doc.restoreHeight !== undefined) {
    const h = doc.restoreHeight;
    if (!Number.isInteger(h) || h < 40 || h > 5000) return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `${path}.restoreHeight must be a whole number from 40 to 5000` };
    out.restoreHeight = h;
  }
  return { ok: true, doc: out, stats };
}

/**
 * @param {object} content diagram content (not mutated)
 * @returns {{ok: true, content: object, warnings: string[]} | {ok: false, status: number, code: string, error: string}}
 */
export function validateDocElements(content) {
  const list = Array.isArray(content?.elements) ? content.elements : [];
  let docs = 0;
  let changed = false;
  const totals = { links: 0, html: 0, images: 0, droppedKeys: 0 };
  const elements = list.map((el, idx) => {
    const has = isObj(el) && isObj(el.data) && el.data.doc !== undefined;
    if (!has) return el;
    docs += 1;
    const r = cleanDoc(el.data.doc, `content.elements[${idx}].data.doc`);
    if (!r.ok) {
      totals.error = r;
      return el;
    }
    for (const k of Object.keys(totals)) if (typeof r.stats[k] === 'number') totals[k] += r.stats[k];
    changed = true;
    return { ...el, data: { ...el.data, doc: r.doc } };
  });
  if (totals.error) return totals.error;
  if (docs > MAX_DOCS_PER_DIAGRAM) {
    return { ok: false, status: 400, code: 'VALIDATION_FAILED', error: `content has too many docs (${docs}); the limit is ${MAX_DOCS_PER_DIAGRAM} per diagram` };
  }
  const warnings = [];
  if (totals.links > 0) warnings.push(`${totals.links} unsafe link${totals.links === 1 ? '' : 's'} removed from doc text (docs allow http, https, mailto, #el= element links and /diagram/ links)`);
  if (totals.html > 0) warnings.push(`${totals.html} HTML tag${totals.html === 1 ? '' : 's'} in doc text escaped (docs are Markdown; raw HTML is shown as text)`);
  if (totals.images > 0) warnings.push(`${totals.images} image${totals.images === 1 ? '' : 's'} in doc text turned into links (put images on the canvas instead)`);
  if (totals.droppedKeys > 0) warnings.push(`${totals.droppedKeys} unknown doc field${totals.droppedKeys === 1 ? '' : 's'} dropped`);
  return { ok: true, content: changed ? { ...content, elements } : content, warnings };
}

/** A new doc element with defaults (client toolbar, MCP doc_create, drop import). */
export function newDocElement({ id, x, y, title = 'Untitled doc', markdown = '', width = 320, height = 220 }) {
  return {
    id,
    type: DOC_STENCIL,
    packId: DOC_PACK,
    name: 'Doc',
    label: title,
    layerId: 'default',
    x,
    y,
    size: { width, height },
    properties: {},
    data: { doc: { title: cleanTitle(title) || 'Untitled doc', markdown } },
  };
}

/** Extra fields for a freshly created element of this stencil (the canvas creation paths spread this in). */
export function docDefaults(stencil) {
  return stencil && stencil.id === DOC_STENCIL && stencil.defaultData?.doc
    ? { data: { doc: { ...stencil.defaultData.doc } } }
    : {};
}

const PATCH_KEYS = new Set(['title', 'markdown', 'append', 'replaceSection']);

/**
 * Apply an agent patch to a doc payload (MCP doc_create / doc_update, compiled into the ops applier).
 *   {title?, markdown?}                 replace
 *   {append: '...'}                     add a block at the end
 *   {replaceSection: {heading, markdown}} replace the body under one heading
 * `markdown`, `append` and `replaceSection` are mutually exclusive. The result is NOT yet sanitized: the applier's final
 * validateDiagramContent pass rewrites it. @returns {{ok: true, doc: object} | {ok: false, error: string}}
 */
export function applyDocPatch(current, patch) {
  if (!isObj(patch)) return { ok: false, error: 'doc must be an object' };
  for (const k of Object.keys(patch)) if (!PATCH_KEYS.has(k)) return { ok: false, error: `Unknown doc field "${String(k).slice(0, 40)}"; allowed: ${[...PATCH_KEYS].join(', ')}` };
  const modes = ['markdown', 'append', 'replaceSection'].filter((k) => patch[k] !== undefined);
  if (modes.length > 1) return { ok: false, error: `Give only one of ${modes.join(', ')}` };
  const doc = { ...(isObj(current) ? current : {}) };
  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string') return { ok: false, error: 'doc.title must be a string' };
    doc.title = cleanTitle(patch.title) || 'Untitled doc';
  }
  const base = typeof doc.markdown === 'string' ? doc.markdown : '';
  if (patch.markdown !== undefined) {
    if (typeof patch.markdown !== 'string') return { ok: false, error: 'doc.markdown must be a string' };
    doc.markdown = patch.markdown;
  } else if (patch.append !== undefined) {
    if (typeof patch.append !== 'string') return { ok: false, error: 'doc.append must be a string' };
    doc.markdown = appendMarkdown(base, patch.append);
  } else if (patch.replaceSection !== undefined) {
    const rs = patch.replaceSection;
    if (!isObj(rs) || typeof rs.heading !== 'string' || typeof rs.markdown !== 'string') return { ok: false, error: 'doc.replaceSection must be {heading: string, markdown: string}' };
    const r = replaceSection(base, rs.heading, rs.markdown);
    if (!r.ok) return { ok: false, error: `${r.error}. Headings: ${r.headings.join(' | ') || '(none)'}` };
    doc.markdown = r.markdown;
  }
  if (doc.markdown === undefined) doc.markdown = '';
  if (doc.title === undefined) doc.title = 'Untitled doc';
  const bytes = utf8Bytes(doc.markdown);
  if (bytes > MAX_DOC_BYTES) return { ok: false, error: `The doc would be ${bytes} bytes; the limit is ${MAX_DOC_BYTES} bytes. Split it into two docs.` };
  return { ok: true, doc };
}

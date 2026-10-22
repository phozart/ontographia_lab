// lib/diagramContent.js
// Server-side validation of diagram `content` on create / update (POST /api/diagrams, PUT /api/diagrams/[id]).
// The client import sanitizer is not a trust boundary; this is. Pure: no I/O, no framework imports.
//
// Rules
//  - content is a plain object whose top-level keys are a subset of {elements, connections, layers, groups, presentations, viewport}
//  - elements/connections/layers/groups are arrays of plain objects within the shared caps; viewport is a plain object
//  - ids are unique within each of elements, connections, layers, groups (merge and save key on them)
//  - ids are at most 128 characters (writes only; stored legacy content still loads)
//  - no __proto__ / constructor / prototype keys at any depth
//  - nesting depth <= MAX_DEPTH, serialized size <= MAX_CONTENT_BYTES (413)
//  - table elements (type 'table', pack core) must carry a valid data.table (lib/table/tableSchema.js)
//  - presentations (ADR-0007): closed schema, caps, unique ids <= 128, notes are plain text (lib/present/presentationSchema.js);
//    a slide may reference a frame that does not exist (rendered as a missing slide), so that never fails a save
//  - doc elements (data.doc): title/markdown caps (413 over 100 KB), markdown rewritten by lib/doc/sanitize.js
//  - URL-valued fields (isUrlKey) must be http(s) or data:image, and no value under any key may start with
//    javascript:/vbscript:/non-image data:; unsafe values are STRIPPED and reported as warnings
//    (rejecting would make an autosave fail and lose the user's work)

import { isUnsafeUrlValue } from './safeUrl';
import { findDuplicateId } from './dedupeIds';
import { validateTableElements } from './table/tableSchema';
import { isTableElement } from './table/tableModel';
import { validateDocElements } from './doc/docElement';
import { validatePresentations } from './present/presentationSchema';
import {
  MAX_CONTENT_BYTES, MAX_ELEMENTS, MAX_CONNECTIONS, MAX_COLLECTION, MAX_DEPTH, FORBIDDEN_KEYS, CONTENT_KEYS,
} from './diagramLimits';

const FORBIDDEN = new Set(FORBIDDEN_KEYS);
const LIST_CAPS = { elements: MAX_ELEMENTS, connections: MAX_CONNECTIONS, layers: MAX_COLLECTION, groups: MAX_COLLECTION };

const MAX_ID_LENGTH = 128;
const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function bad(error, status = 400, code = 'VALIDATION_FAILED') {
  return { ok: false, status, code, error };
}

/**
 * Iterative walk (cannot overflow the stack on hostile input): enforces depth and forbidden keys.
 * @returns {string|null} error message, or null when fine
 */
function checkStructure(root) {
  const stack = [[root, 1, 'content']];
  while (stack.length) {
    const [node, depth, path] = stack.pop();
    if (depth > MAX_DEPTH) return `content is nested too deeply (limit ${MAX_DEPTH} levels) at ${path}`;
    if (Array.isArray(node)) {
      for (let i = 0; i < node.length; i++) {
        const child = node[i];
        if (child !== null && typeof child === 'object') stack.push([child, depth + 1, `${path}[${i}]`]);
      }
    } else {
      for (const key of Object.keys(node)) {
        if (FORBIDDEN.has(key)) return `content contains the forbidden key "${key}" at ${path}`;
        const child = node[key];
        if (child !== null && typeof child === 'object') stack.push([child, depth + 1, `${path}.${key}`]);
      }
    }
  }
  return null;
}

/** Deep copy dropping unsafe URL values. Depth is already bounded by checkStructure. */
function stripUnsafeUrls(value, stats) {
  if (Array.isArray(value)) return value.map((v) => stripUnsafeUrls(v, stats));
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value)) {
      const v = value[key];
      if (isUnsafeUrlValue(key, v)) {
        stats.urls += 1;
        continue;
      }
      out[key] = stripUnsafeUrls(v, stats);
    }
    return out;
  }
  return value;
}

/** A shallow copy whose table elements carry no data.table (so URL stripping neither counts nor changes table text). */
function withoutTables(content) {
  if (!Array.isArray(content.elements)) return content;
  return {
    ...content,
    elements: content.elements.map((el) => (isTableElement(el) && isPlainObject(el.data) && el.data.table !== undefined ? { ...el, data: { ...el.data, table: null } } : el)),
  };
}

/** Table text (names, options, cells) is plain text, never a URL: put the original tables back after URL stripping. */
function restoreTables(original, clean) {
  const src = Array.isArray(original.elements) ? original.elements : [];
  const dst = Array.isArray(clean.elements) ? clean.elements : [];
  src.forEach((el, i) => {
    if (isTableElement(el) && isPlainObject(el.data) && el.data.table !== undefined && isPlainObject(dst[i]?.data)) dst[i].data.table = el.data.table;
  });
}

/**
 * @param {unknown} content
 * @returns {{ok: true, content: object, warnings: string[]} | {ok: false, status: number, code: string, error: string}}
 */
export function validateDiagramContent(content) {
  if (!isPlainObject(content)) return bad('content must be an object');

  for (const key of Object.keys(content)) {
    if (FORBIDDEN.has(key)) return bad(`content contains the forbidden key "${key}"`);
    if (!CONTENT_KEYS.includes(key)) {
      return bad(`content has an unsupported top-level key "${key}"; allowed keys: ${CONTENT_KEYS.join(', ')}`);
    }
  }

  for (const [key, cap] of Object.entries(LIST_CAPS)) {
    if (content[key] === undefined) continue;
    const list = content[key];
    if (!Array.isArray(list)) return bad(`content.${key} must be an array`);
    if (list.length > cap) return bad(`content.${key} has too many items (${list.length}); the limit is ${cap}`);
    if (!list.every(isPlainObject)) return bad(`content.${key} must contain only objects`);
    // Ids reach URLs, model-facing text and merge keys; editor ids are `prefix-uuid` (about 40 characters).
    if (list.some((item) => typeof item.id === 'string' && item.id.length > MAX_ID_LENGTH)) {
      return bad(`content.${key} has an id longer than ${MAX_ID_LENGTH} characters`);
    }
  }
  if (content.viewport !== undefined && !isPlainObject(content.viewport)) {
    return bad('content.viewport must be an object');
  }

  const dup = findDuplicateId(content);
  if (dup) {
    const [list, id] = dup.split(/:(.*)/s);
    return bad(`content.${list} has more than one item with the id "${id}"; ids must be unique`);
  }

  const structureError = checkStructure(content);
  if (structureError) return bad(structureError);

  // Safe to serialize now: depth is bounded.
  const bytes = Buffer.byteLength(JSON.stringify(content), 'utf8');
  if (bytes > MAX_CONTENT_BYTES) {
    return bad(
      `content is too large (${bytes} bytes); the limit is ${MAX_CONTENT_BYTES} bytes`,
      413,
      'PAYLOAD_TOO_LARGE'
    );
  }

  // Doc cards (AI-5): caps, unknown keys dropped, markdown rewritten so the stored text is safe for every consumer.
  const docs = validateDocElements(content);
  if (!docs.ok) return bad(docs.error, docs.status, docs.code);

  // Presentations: plain text (notes may start with "javascript:" and that is fine), validated and normalized apart from URL stripping.
  const pres = validatePresentations(content.presentations);
  if (!pres.ok) return bad(pres.error, pres.status, pres.code);

  const stats = { urls: 0 };
  const { presentations: _presentations, ...withoutPresentations } = docs.content;
  const clean = stripUnsafeUrls(withoutTables(withoutPresentations), stats);
  if (pres.presentations !== undefined) clean.presentations = pres.presentations;
  restoreTables(docs.content, clean);
  const warnings = [...docs.warnings];
  // Tables (AI-4) are validated on the original content: table text is plain text, never a URL, so the URL stripping must not touch it.
  const tableError = validateTableElements(docs.content.elements);
  if (tableError) return bad(tableError.error, tableError.status, tableError.code);
  if (stats.urls > 0) {
    warnings.push(
      `${stats.urls} unsafe URL${stats.urls === 1 ? '' : 's'} removed (only http, https and image data URLs are allowed)`
    );
  }
  return { ok: true, content: clean, warnings };
}

// lib/diagramContent.js
// Server-side validation of diagram `content` on create / update (POST /api/diagrams, PUT /api/diagrams/[id]).
// The client import sanitizer is not a trust boundary; this is. Pure: no I/O, no framework imports.
//
// Rules
//  - content is a plain object whose top-level keys are a subset of {elements, connections, layers, groups, viewport}
//  - elements/connections/layers/groups are arrays of plain objects within the shared caps; viewport is a plain object
//  - no __proto__ / constructor / prototype keys at any depth
//  - nesting depth <= MAX_DEPTH, serialized size <= MAX_CONTENT_BYTES (413)
//  - URL-valued fields (isUrlKey) must be http(s) or data:image; unsafe values are STRIPPED and reported as warnings
//    (rejecting would make an autosave fail and lose the user's work)

import { isSafeUrl, isUrlKey } from './safeUrl';
import {
  MAX_CONTENT_BYTES, MAX_ELEMENTS, MAX_CONNECTIONS, MAX_COLLECTION, MAX_DEPTH, FORBIDDEN_KEYS, CONTENT_KEYS,
} from './diagramLimits';

const FORBIDDEN = new Set(FORBIDDEN_KEYS);
const LIST_CAPS = { elements: MAX_ELEMENTS, connections: MAX_CONNECTIONS, layers: MAX_COLLECTION, groups: MAX_COLLECTION };

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
      if (typeof v === 'string' && v !== '' && isUrlKey(key) && !isSafeUrl(v)) {
        stats.urls += 1;
        continue;
      }
      out[key] = stripUnsafeUrls(v, stats);
    }
    return out;
  }
  return value;
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
  }
  if (content.viewport !== undefined && !isPlainObject(content.viewport)) {
    return bad('content.viewport must be an object');
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

  const stats = { urls: 0 };
  const clean = stripUnsafeUrls(content, stats);
  const warnings = [];
  if (stats.urls > 0) {
    warnings.push(
      `${stats.urls} unsafe URL${stats.urls === 1 ? '' : 's'} removed (only http, https and image data URLs are allowed)`
    );
  }
  return { ok: true, content: clean, warnings };
}

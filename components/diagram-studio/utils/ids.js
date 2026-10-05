// components/diagram-studio/utils/ids.js
// Stable, globally unique ids for elements, connections, layers, groups and frames
// (ADR-0004 prerequisite P1). Ids are `<prefix>-<uuid v4>`:
//  - the uuid comes from crypto.randomUUID(); where that is unavailable (non-secure
//    context such as plain http on a LAN host) it is built from crypto.getRandomValues
//  - the prefix keeps ids readable in the DOM/JSON and guarantees they never start with a digit,
//    so they stay valid in CSS selectors and SVG url(#...) references
//  - ids are never rewritten on save/load; legacy ids (el-<ms>-<rand>, el_<ms>_<idx>, ...) stay valid

function uuidV4() {
  const c = typeof globalThis !== 'undefined' ? globalThis.crypto : undefined;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = new Uint8Array(16);
    c.getRandomValues(b);
    b[6] = (b[6] & 0x0f) | 0x40; // version 4
    b[8] = (b[8] & 0x3f) | 0x80; // variant 10xx
    const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }
  throw new Error('No secure random source available (crypto.randomUUID / getRandomValues)');
}

/**
 * @param {string} prefix e.g. 'el', 'conn', 'layer', 'group', 'frame'
 * @returns {string} `${prefix}-${uuid}`
 */
export function generateId(prefix = 'id') {
  return `${prefix}-${uuidV4()}`;
}

export default generateId;

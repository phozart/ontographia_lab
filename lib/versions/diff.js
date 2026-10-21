// lib/versions/diff.js
// Pure structural diff between two diagram contents (ADR-0001 decision D). Framework-free: the API route, the
// History panel and a future MCP server share this one definition of "what changed".
//
// Matching is by stable `id`, per collection (elements, connections, layers, groups). Rules:
//  - `viewport` (and any other top-level key) is ignored; only the four collections are compared.
//  - Entities without a string/number id cannot be matched and are skipped; with duplicate ids the first wins.
//  - Noise: numbers inside geometric keys (x, y, size/width/height, waypoints, points, ...) that differ by
//    less than POSITION_TOLERANCE (0.5 px) are equal (drag/snap float jitter). All other numbers compare exactly.
//  - `null` and a missing key are equal (e.g. parentFrameId: null vs absent); key order never matters.
//  - Changed fields are reported as sorted logical names: x/y -> "position", width/height/size -> "size",
//    label/text/name -> "label", colour and stroke keys -> "style"; any other key keeps its own top-level name
//    (data, ports, waypoints, parentFrameId, sourceId, ...). Layers and groups report raw key names.
//  - A table element (data.table) reports the field `table` (not `data`) when only the table changed, plus a `table`
//    summary on the change: column / row counts and the changed cell ids (lib/table/tableDiff.js).
//  - Output is stable: ordered by kind (element, connection, layer, group), then by id (code-unit order).

import { diffTables } from '../table/tableDiff';

export const POSITION_TOLERANCE = 0.5;

const KINDS = [
  ['elements', 'element'],
  ['connections', 'connection'],
  ['layers', 'layer'],
  ['groups', 'group'],
];

const GEOMETRIC_KEYS = new Set(['x', 'y', 'width', 'height', 'size', 'position', 'waypoints', 'points', 'controlPoints', 'bendPoints']);

const FIELD_GROUP = {
  x: 'position', y: 'position',
  width: 'size', height: 'size', size: 'size',
  label: 'label', text: 'label', name: 'label',
  style: 'style', color: 'style', fill: 'style', fillColor: 'style', stroke: 'style', strokeColor: 'style',
  strokeWidth: 'style', strokeStyle: 'style', opacity: 'style', fontSize: 'style', fontFamily: 'style', textColor: 'style',
};

const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNil = (v) => v === null || v === undefined;

/** Deep equality used by diff and the three-way merge (nil == missing, optional 0.5 px tolerance on numbers). */
export function valuesEqual(a, b, tolerant) {
  return equal(a, b, tolerant);
}

function equal(a, b, tolerant) {
  if (typeof a === 'number' && typeof b === 'number') {
    return a === b || (tolerant && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < POSITION_TOLERANCE);
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => equal(v, b[i], tolerant));
  }
  if (isObject(a) && isObject(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const k of keys) {
      if (isNil(a[k]) && isNil(b[k])) continue;
      if (!equal(a[k], b[k], tolerant)) return false;
    }
    return true;
  }
  return a === b;
}

function changedFields(a, b, kind) {
  const fields = new Set();
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (k === 'id' || (isNil(a[k]) && isNil(b[k]))) continue;
    if (kind === 'element' && k === 'data' && isObject(a.data) && isObject(b.data) && (a.data.table !== undefined || b.data.table !== undefined)) {
      const { table: ta, ...ra } = a.data;
      const { table: tb, ...rb } = b.data;
      if (!equal(ra, rb, false)) fields.add('data');
      if (!equal(ta, tb, false)) fields.add('table');
      continue;
    }
    // Elements and connections store geometry inline; layers/groups never get tolerance.
    const tolerant = kind !== 'layer' && kind !== 'group' && GEOMETRIC_KEYS.has(k);
    if (!equal(a[k], b[k], tolerant)) fields.add(kind === 'layer' || kind === 'group' ? k : FIELD_GROUP[k] || k);
  }
  return [...fields].sort();
}

function indexById(list) {
  const map = new Map();
  if (!Array.isArray(list)) return map;
  for (const item of list) {
    if (!isObject(item)) continue;
    const id = item.id;
    if (typeof id !== 'string' && typeof id !== 'number') continue;
    const key = String(id);
    if (!map.has(key)) map.set(key, item);
  }
  return map;
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

function boundsOf(e) {
  return { x: num(e.x, 0), y: num(e.y, 0), width: num(e.size?.width ?? e.width, 100), height: num(e.size?.height ?? e.height, 60) };
}

function displayLabel(e) {
  const v = e.label ?? e.text ?? e.name;
  return typeof v === 'string' ? v.slice(0, 200) : '';
}

const byCodeUnit = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * @returns {{changes: Array<{id: string, kind: string, change: 'added'|'removed'|'changed', fields?: string[], label: string, bounds?: object}>,
 *            summary: {added: number, removed: number, changed: number}}}
 * `label` is a display name; `bounds` ({x, y, width, height}, elements only) is the entity's box on the `to` side,
 * or on the `from` side for removed ones.
 */
export function diffContent(from, to) {
  const changes = [];
  const summary = { added: 0, removed: 0, changed: 0 };
  const a = isObject(from) ? from : {};
  const b = isObject(to) ? to : {};

  for (const [collection, kind] of KINDS) {
    const before = indexById(a[collection]);
    const after = indexById(b[collection]);
    const entry = (id, change, entity, fields) => {
      const c = { id, kind, change };
      if (fields) c.fields = fields;
      c.label = displayLabel(entity);
      if (kind === 'element') c.bounds = boundsOf(entity);
      changes.push(c);
      summary[change] += 1;
    };
    for (const id of [...new Set([...before.keys(), ...after.keys()])].sort(byCodeUnit)) {
      const was = before.get(id);
      const now = after.get(id);
      if (!was) entry(id, 'added', now);
      else if (!now) entry(id, 'removed', was);
      else {
        const fields = changedFields(was, now, kind);
        if (fields.length) {
          entry(id, 'changed', now, fields);
          if (fields.includes('table')) {
            const t = diffTables(was.data?.table, now.data?.table);
            if (t) changes[changes.length - 1].table = t;
          }
        }
      }
    }
  }
  return { changes, summary };
}

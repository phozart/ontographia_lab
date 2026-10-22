// lib/merge/threeWay.js
// Pure three-way merge of diagram content by stable id (AI-2 live pickup; ai-canvas-via-mcp.md section 6).
//   base   = the content the editor loaded or last saved (what the server head was when we last agreed with it)
//   ours   = local editor state
//   theirs = the new server head written by someone else (an MCP agent, another editor)
// Framework-free and deterministic, so the transport (polling today, real-time later) can change freely.
//
// Rules (documented in the design doc, "AI-2 as built"):
//  - Each of elements, connections, layers, groups is merged id by id. Entities without an id cannot be matched:
//    ours are kept, theirs are ignored.
//  - Present in all three: merged field by field. A field changed on one side only takes that side. Changed on
//    both sides to different values: LOCAL WINS and the field is reported. Position (x, y) and size (width,
//    height, size) are atomic units, so a double move never produces a diagonal mix. Plain nested objects (data,
//    style, ...) merge per key; id lists in groups (elementIds, ...) merge as sets.
//  - A presentation (ADR-0007) merges its fields (title, aspect) like any entity and its slide list by slide id:
//    slides added on one side are kept, a slide deleted on one side and untouched on the other is deleted, per-slide
//    fields (notes, hidden, frameId) merge like fields (both changed: local wins, reported as slides.<id>.<field>),
//    a remote delete of a slide the user edited keeps it, and a local delete wins over a remote edit. Order: if only
//    one side reordered, that order is adopted; if both reordered differently, LOCAL order wins and the conflict is
//    reported as slides.order. A slide whose frame vanished is not repaired: it renders as a missing slide.
//  - A table (element.data.table) merges by column, row and cell id (lib/table/tableMerge.js).
//  - Added on one side: kept. Added on both with the same id: merged field by field against an empty base.
//  - Deleted on one side and untouched on the other: deleted. Remote delete vs local edit: the edited entity is
//    kept (kept-local-edit). Local delete vs remote edit: the delete wins (kept-local-delete). Both reported.
//  - After the merge, references are repaired: a connection whose endpoint vanished is dropped, a member whose
//    frame/group/layer vanished is released (parentFrameId null, groupId removed, layerId default), group id lists
//    lose removed elements. Only references to entities that existed in some input and are now gone are touched.
//  - Array order is z-order: if the user did not reorder, the remote order is adopted; otherwise the local order
//    is kept and remote additions are inserted after their predecessor.
//  - group.elementIds is re-derived from element.groupId (the element is the source of truth) so they never disagree.
//  - Duplicate ids inside one collection of any input: not mergeable (ok: false); the caller falls back.
//  - `viewport` is always ours. Other top-level keys merge like fields.
// Inputs are never mutated.

import { valuesEqual } from '../versions/diff';
import { findDuplicateId } from '../dedupeIds';
import { mergeOrder } from './order';
import { isTableShape, mergeTables } from '../table/tableMerge';

const COLLECTIONS = [
  ['elements', 'element'],
  ['connections', 'connection'],
  ['layers', 'layer'],
  ['groups', 'group'],
  ['presentations', 'presentation'],
];
const COLLECTION_KEYS = new Set(COLLECTIONS.map(([k]) => k));
const GEOMETRIC = new Set(['x', 'y', 'width', 'height', 'size', 'waypoints', 'points', 'controlPoints', 'bendPoints']);
const SET_KEYS = new Set(['elementIds', 'memberIds', 'childIds', 'nodeIds']);
const POSITION = ['x', 'y'];
const SIZE = ['width', 'height', 'size'];
const MAX_DEPTH = 4;
// LA-1: ids the remote side touched, for the change highlight. Elements and connections only (layers and groups
// have nothing to draw a ring around); each list is capped so a bulk import cannot flood the client.
export const MAX_REMOTE_IDS = 500;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNil = (v) => v === null || v === undefined;
const hasId = (v) => isObj(v) && (typeof v.id === 'string' || typeof v.id === 'number');

function indexById(list) {
  const map = new Map();
  for (const item of list) if (hasId(item) && !map.has(String(item.id))) map.set(String(item.id), item);
  return map;
}

function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (!isNil(obj[k])) out[k] = obj[k];
  return out;
}

/** True when every key of a and b is equal (nil == missing); geometry keys use the diff's 0.5 px tolerance. */
function fieldsEqual(a, b, skipId = true) {
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
    if (skipId && k === 'id') continue;
    if (isNil(a[k]) && isNil(b[k])) continue;
    if (!valuesEqual(a[k], b[k], GEOMETRIC.has(k))) return false;
  }
  return true;
}

function unitsOf(keys, grouped) {
  if (!grouped) return keys.map((k) => [k, [k]]);
  const units = [];
  const pos = keys.filter((k) => POSITION.includes(k));
  const size = keys.filter((k) => SIZE.includes(k));
  if (pos.length) units.push(['position', POSITION]);
  if (size.length) units.push(['size', SIZE]);
  for (const k of keys) if (!POSITION.includes(k) && !SIZE.includes(k)) units.push([k, [k]]);
  return units;
}

function setMerge(b, o, t) {
  const base = new Set(b || []);
  const ours = new Set(o);
  const theirs = new Set(t);
  const out = o.filter((v) => !(base.has(v) && !theirs.has(v)));
  for (const v of t) if (!base.has(v) && !ours.has(v)) out.push(v);
  return out;
}

const primitiveArray = (v) => Array.isArray(v) && v.every((x) => typeof x === 'string' || typeof x === 'number');

/**
 * Field-level merge of three plain objects. `grouped` (top level of an element/connection) treats position and
 * size as atomic units. Returns the merged object and the names of fields where both sides changed differently.
 */
function mergeObjects(b, o, t, { grouped = false, depth = 0 } = {}) {
  const keys = [...new Set([...Object.keys(o), ...Object.keys(t), ...Object.keys(b)])].filter((k) => !(grouped && k === 'id'));
  const out = {};
  const fields = [];
  for (const [name, ks] of unitsOf(keys, grouped)) {
    const tol = grouped && ks.some((k) => GEOMETRIC.has(k));
    const pb = pick(b, ks);
    const po = pick(o, ks);
    const pt = pick(t, ks);
    // Output copies the winning side verbatim, explicit nulls included (parentFrameId: null opts out of frames).
    const from = (side) => Object.fromEntries(ks.filter((k) => side[k] !== undefined).map((k) => [k, side[k]]));
    let chosen;
    if (valuesEqual(po, pt, tol)) chosen = from(o);
    else if (valuesEqual(pb, po, tol)) chosen = from(t);
    else if (valuesEqual(pb, pt, tol)) chosen = from(o);
    else {
      const k = ks[0];
      chosen = from(o);
      if (ks.length === 1 && k === 'table' && depth > 0 && isTableShape(o[k]) && isTableShape(t[k])) {
        // A table (element.data.table) merges by column, row and cell id (lib/table/tableMerge.js)
        const sub = mergeTables(b[k], o[k], t[k]);
        chosen = { [k]: sub.value };
        for (const f of sub.fields) fields.push(`${name}.${f}`);
      } else if (ks.length === 1 && isObj(o[k]) && isObj(t[k]) && depth < MAX_DEPTH) {
        const sub = mergeObjects(isObj(b[k]) ? b[k] : {}, o[k], t[k], { depth: depth + 1 });
        chosen = { [k]: sub.value };
        for (const f of sub.fields) fields.push(`${name}.${f}`);
      } else if (ks.length === 1 && SET_KEYS.has(k) && primitiveArray(o[k]) && primitiveArray(t[k])) {
        chosen = { [k]: setMerge(primitiveArray(b[k]) ? b[k] : [], o[k], t[k]) };
      } else {
        fields.push(name);
      }
    }
    Object.assign(out, chosen);
  }
  if (grouped && !isNil(o.id)) return { value: { id: o.id, ...out }, fields };
  if (grouped && !isNil(t.id)) return { value: { id: t.id, ...out }, fields };
  return { value: out, fields };
}

const sameSeq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Slide list of a presentation, merged by slide id (rules in the header). */
function mergeSlides(bList, oList, tList) {
  const b = indexById(bList);
  const o = indexById(oList);
  const t = indexById(tList);
  const fields = [];
  const result = new Map();
  for (const id of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const bv = b.get(id);
    const ov = o.get(id);
    const tv = t.get(id);
    if (!bv) {
      if (ov && tv) {
        const m = mergeObjects({}, ov, tv, { grouped: true });
        result.set(id, m.value);
        for (const f of m.fields) fields.push(`slides.${id}.${f}`);
      } else result.set(id, ov || tv);
    } else if (ov && tv) {
      const m = mergeObjects(bv, ov, tv, { grouped: true });
      result.set(id, m.value);
      for (const f of m.fields) fields.push(`slides.${id}.${f}`);
    } else if (ov && !tv) {
      // removed remotely: gone unless the user edited it meanwhile
      if (!fieldsEqual(bv, ov)) { result.set(id, ov); fields.push(`slides.${id}`); }
    } else if (tv && !ov) {
      // removed locally: stays removed; a remote edit of it is dropped and reported
      if (!fieldsEqual(bv, tv)) fields.push(`slides.${id}`);
    }
  }
  const ids = (list) => list.filter(hasId).map((x) => String(x.id));
  const bi = ids(bList);
  const oi = ids(oList);
  const ti = ids(tList);
  const common = (x, y) => { const ys = new Set(y); return x.filter((v) => ys.has(v)); };
  const bothMoved = !sameSeq(common(bi, oi), common(oi, bi)) && !sameSeq(common(bi, ti), common(ti, bi))
    && !sameSeq(common(oi, ti), common(ti, oi));
  if (bothMoved) fields.push('slides.order');
  const order = mergeOrder(bi, oi, ti, new Set(result.keys()));
  return { value: order.map((id) => result.get(id)), fields };
}

/** Field-level merge of one entity; a presentation's slide list gets its own id-keyed merge. */
function mergeEntity(kind, bv, ov, tv) {
  if (kind !== 'presentation') return mergeObjects(bv, ov, tv, { grouped: true });
  const rest = (x) => { const { slides, ...r } = x; return r; };
  const m = mergeObjects(rest(bv), rest(ov), rest(tv), { grouped: true });
  const sl = mergeSlides(Array.isArray(bv.slides) ? bv.slides : [], Array.isArray(ov.slides) ? ov.slides : [], Array.isArray(tv.slides) ? tv.slides : []);
  return { value: { ...m.value, slides: sl.value }, fields: [...m.fields, ...sl.fields] };
}

function mergeCollection(kind, bList, oList, tList, acc) {
  const b = indexById(bList);
  const o = indexById(oList);
  const t = indexById(tList);
  const result = new Map();
  const track = kind === 'element' || kind === 'connection';
  const mark = (list, id) => { if (track) acc.ids[list].push(id); };
  const note = (id, fields, resolution) => acc.conflicts.push({ kind, id, ...(fields ? { fields } : {}), resolution });

  for (const id of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const bv = b.get(id);
    const ov = o.get(id);
    const tv = t.get(id);
    if (!bv) {
      if (ov && tv) {
        const m = mergeEntity(kind, {}, ov, tv);
        result.set(id, m.value);
        if (m.fields.length) note(id, m.fields, 'local-wins');
      } else if (ov) result.set(id, ov);
      else if (tv) { result.set(id, tv); acc.remote.added += 1; mark('added', id); }
    } else if (ov && tv) {
      if (fieldsEqual(ov, tv)) { result.set(id, ov); continue; }
      const remoteChanged = !fieldsEqual(bv, tv);
      const m = mergeEntity(kind, bv, ov, tv);
      result.set(id, m.value);
      if (remoteChanged) { acc.remote.changed += 1; mark('changed', id); }
      if (m.fields.length) note(id, m.fields, 'local-wins');
    } else if (!ov && tv) {
      // deleted locally
      if (!fieldsEqual(bv, tv)) note(id, null, 'kept-local-delete');
    } else if (ov && !tv) {
      // deleted remotely
      // A connection removed together with an endpoint the user's edit kept alive is restored with that endpoint.
      const orphanedByKeep = kind === 'connection' && acc.keptElements
        && (acc.keptElements.has(String(ov.sourceId)) || acc.keptElements.has(String(ov.targetId)));
      if (fieldsEqual(bv, ov) && !orphanedByKeep) { acc.remote.removed += 1; mark('removed', id); }
      else { result.set(id, ov); if (!orphanedByKeep) note(id, null, 'kept-local-edit'); }
    }
  }

  const ids = (list) => list.filter(hasId).map((x) => String(x.id));
  const order = mergeOrder(ids(bList), ids(oList), ids(tList), new Set(result.keys()));
  const merged = order.map((id) => result.get(id));
  for (const item of oList) if (!hasId(item)) merged.push(item);
  return merged;
}

function unionIds(...lists) {
  const s = new Set();
  for (const l of lists) for (const x of l) if (hasId(x)) s.add(String(x.id));
  return s;
}

const refAlive = (ref, seen, alive) => isNil(ref) || !seen.has(String(ref)) || alive.has(String(ref));

/** Repair references to entities that existed in an input but are gone after the merge. */
function repairReferences(out, inputs, acc) {
  const seenEl = unionIds(...inputs.map((c) => c.elements));
  const seenGr = unionIds(...inputs.map((c) => c.groups));
  const seenLa = unionIds(...inputs.map((c) => c.layers));
  const aliveEl = unionIds(out.elements);
  const aliveGr = unionIds(out.groups);
  const aliveLa = unionIds(out.layers);

  out.connections = out.connections.filter((c) => {
    if (refAlive(c.sourceId, seenEl, aliveEl) && refAlive(c.targetId, seenEl, aliveEl)) return true;
    acc.conflicts.push({ kind: 'connection', id: String(c.id), resolution: 'dropped-dangling' });
    return false;
  });

  out.elements = out.elements.map((e) => {
    if (!isObj(e)) return e;
    let next = e;
    if (!refAlive(e.parentFrameId, seenEl, aliveEl)) next = { ...next, parentFrameId: null };
    if (!refAlive(e.groupId, seenGr, aliveGr)) { const { groupId, ...rest } = next; next = rest; }
    if (!refAlive(e.layerId, seenLa, aliveLa)) next = { ...next, layerId: 'default' };
    return next;
  });

  out.groups = out.groups.map((g) => {
    if (!isObj(g)) return g;
    let next = g;
    for (const k of SET_KEYS) {
      if (primitiveArray(g[k])) {
        const kept = g[k].filter((id) => refAlive(id, seenEl, aliveEl));
        if (kept.length !== g[k].length) next = { ...next, [k]: kept };
      }
    }
    return next;
  });

  // element.groupId is what the editor reads (selection, ungroup); the group's id list must agree with it.
  const members = new Map();
  for (const e of out.elements) {
    if (isObj(e) && !isNil(e.groupId)) {
      const k = String(e.groupId);
      if (!members.has(k)) members.set(k, []);
      members.get(k).push(e.id);
    }
  }
  out.groups = out.groups.map((g) => {
    // Only groups some element still points at are derived; older content that lists members only in the group is kept.
    if (!isObj(g) || !Array.isArray(g.elementIds) || !members.has(String(g.id))) return g;
    const want = members.get(String(g.id));
    const wantSet = new Set(want.map(String));
    const kept = g.elementIds.filter((id) => wantSet.has(String(id)));
    const keptSet = new Set(kept.map(String));
    const next = [...kept, ...want.filter((id) => !keptSet.has(String(id)))];
    const same = next.length === g.elementIds.length && next.every((v, i) => v === g.elementIds[i]);
    return same ? g : { ...g, elementIds: next };
  });
}

function checkSide(side) {
  if (!isObj(side)) return false;
  return COLLECTIONS.every(([k]) => isNil(side[k]) || Array.isArray(side[k]));
}

/**
 * @param {object} base   content at the last agreement with the server
 * @param {object} ours   local content
 * @param {object} theirs new server head content
 * @returns {{ok: true, content: object,
 *            conflicts: Array<{kind: string, id: string, fields?: string[], resolution: 'local-wins'|'kept-local-edit'|'kept-local-delete'|'dropped-dangling'}>,
 *            summary: {remote: {added: number, removed: number, changed: number,
 *                       ids: {added: string[], changed: string[], removed: string[], truncated: boolean}}, conflicts: number}}
 *          | {ok: false, reason: string}}
 */
export function mergeContent(base, ours, theirs) {
  if (!checkSide(base) || !checkSide(ours) || !checkSide(theirs)) {
    return { ok: false, reason: 'content is not mergeable (not an object, or a collection is not an array)' };
  }
  for (const [label, side] of [['base', base], ['ours', ours], ['theirs', theirs]]) {
    const dup = findDuplicateId(side);
    if (dup) return { ok: false, reason: `duplicate id in ${label} (${dup}); merge keys on ids` };
  }
  const acc = { conflicts: [], remote: { added: 0, removed: 0, changed: 0 }, ids: { added: [], changed: [], removed: [] } };
  const list = (side, k) => (Array.isArray(side[k]) ? side[k] : []);

  const out = {};
  for (const [k, kind] of COLLECTIONS) {
    out[k] = mergeCollection(kind, list(base, k), list(ours, k), list(theirs, k), acc);
    if (k === 'elements') {
      acc.keptElements = new Set(acc.conflicts.filter((c) => c.kind === 'element' && c.resolution === 'kept-local-edit').map((c) => String(c.id)));
    }
  }

  // Content that never had decks keeps its exact shape (no empty presentations array appears out of nowhere)
  if (out.presentations.length === 0 && [base, ours, theirs].every((side) => side.presentations === undefined)) delete out.presentations;

  // viewport is always local; every other top-level key merges like an element field
  const rest = (side) => Object.fromEntries(Object.entries(side).filter(([k]) => !COLLECTION_KEYS.has(k) && k !== 'viewport'));
  const others = mergeObjects(rest(base), rest(ours), rest(theirs));
  Object.assign(out, others.value);
  // the board theme merges per palette token / font; the same token changed on both sides: local wins and it is reported
  if (others.fields.length) acc.conflicts.push({ kind: 'theme', id: 'theme', fields: others.fields.map((f) => f.replace(/^theme\./, '')), resolution: 'local-wins' });
  if (!isNil(ours.viewport)) out.viewport = ours.viewport;
  else if (!isNil(theirs.viewport)) out.viewport = theirs.viewport;

  repairReferences(out, [
    { elements: list(base, 'elements'), groups: list(base, 'groups'), layers: list(base, 'layers') },
    { elements: list(ours, 'elements'), groups: list(ours, 'groups'), layers: list(ours, 'layers') },
    { elements: list(theirs, 'elements'), groups: list(theirs, 'groups'), layers: list(theirs, 'layers') },
  ], acc);

  const truncated = Object.values(acc.ids).some((l) => l.length > MAX_REMOTE_IDS);
  const ids = {
    added: acc.ids.added.slice(0, MAX_REMOTE_IDS),
    changed: acc.ids.changed.slice(0, MAX_REMOTE_IDS),
    removed: acc.ids.removed.slice(0, MAX_REMOTE_IDS),
    truncated,
    // true totals (elements and connections), so a capped list can still be counted honestly
    totals: { added: acc.ids.added.length, changed: acc.ids.changed.length, removed: acc.ids.removed.length },
  };
  return { ok: true, content: out, conflicts: acc.conflicts, summary: { remote: { ...acc.remote, ids }, conflicts: acc.conflicts.length } };
}

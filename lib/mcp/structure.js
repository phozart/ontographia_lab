// lib/mcp/structure.js
// map_structure and layout_apply (docs/architecture/investigations/ai-canvas-via-mcp.md 4.1), as pure compilers.
// Claude decides the structure; this module only builds it: validate -> deterministic layout -> free-space placement
// -> M2 ops -> the SAME atomic applier as diagram_apply_ops (validateDiagramContent, caps, closed schemas). There is no
// second write path: the result has the shape of applyOps' result, so it is passed to applyContentChange as `compute`.

import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { applyOps, suggestStencils, isLockedElement, MAX_STRUCTURE_OPS } from './ops';
import { computeFrameMembershipChanges, isFrame } from '../../components/diagram-studio/utils/frameMembership';
import { layoutStructure, structureDepths, LAYOUTS, GRID } from '../layout/structureLayout';
import { boxOf, occupiedSpace, placeBlock, placeInFrame, CONTENT_GAP } from '../layout/freeSpace';

export const MAX_NODES = 200;
export const MAX_EDGES = 400;
export const MAX_GROUPS = 40;
export const MAX_LAYOUT_UNITS = 300;

const KEY_RE = /^[A-Za-z0-9_-]{1,38}$/;
const FRAME_TYPE = 'core/frame';
const COORD_LIMIT = 99000;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const clip = (s, n = 60) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : String(s).slice(0, n));
const FORBIDDEN = new Set(['__proto__', 'constructor', 'prototype']);
/** The editor's drop rule (computeFrameMembershipChanges), leaving notes held by non-frame containers alone. */
function membershipChanges(elements, finals) {
  const changes = computeFrameMembershipChanges(elements, finals);
  const byId = new Map(elements.filter((e) => isObj(e)).map((e) => [e.id, e]));
  for (const id of Object.keys(changes)) {
    const parent = byId.get(byId.get(id)?.parentFrameId);
    if (parent && !isFrame(parent)) delete changes[id];
  }
  return changes;
}
const snap = (v) => Math.round(v / GRID) * GRID;

const fail = (errors, code = 'INVALID_STRUCTURE') => ({ ok: false, code, errors: errors.slice(0, 20).map((message) => ({ index: -1, message })) });

/** Stencils used when a node names none: the shape that reads best for that layout (see the guide resource). */
export function defaultStencil(layout, depth) {
  if (layout === 'mindmap' || layout === 'radial') return depth === 0 ? 'mind-map/central-topic' : depth === 1 ? 'mind-map/main-topic' : 'mind-map/sub-topic';
  if (layout === 'flow') return 'process-flow/task';
  if (layout === 'tree') return 'core/rectangle';
  return 'sticky-notes/sticky-medium'; // grid, cluster
}
const EDGE_STYLE = { tree: 'step', flow: 'step', mindmap: 'curved', radial: 'curved', grid: 'straight', cluster: 'straight' };

const isContainer = (el) => el.type === 'frame' || el.isFrame === true || Boolean(findStencilMeta(el.type, el.packId)?.stencil?.isContainer);

function ancestors(byId, id) {
  const out = new Set();
  for (let cur = byId.get(id), hops = 0; cur && cur.parentFrameId && hops < 100; hops++) {
    out.add(cur.parentFrameId);
    cur = byId.get(cur.parentFrameId);
  }
  return out;
}

/** Every element below `id` through explicit parentFrameId links (cycle safe). */
function descendantsOf(children, id) {
  const out = [];
  const seen = new Set([id]);
  const stack = [id];
  while (stack.length) {
    for (const c of children.get(stack.pop()) || []) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
      stack.push(c.id);
    }
  }
  return out;
}

function childrenIndex(elements) {
  const m = new Map();
  for (const e of elements) {
    if (!e || !e.parentFrameId) continue;
    if (!m.has(e.parentFrameId)) m.set(e.parentFrameId, []);
    m.get(e.parentFrameId).push(e);
  }
  return m;
}

/** Warning text when a frame that had to grow now covers other, unrelated elements (growing never moves anything). */
function growthWarning(elements, kids, frame, grow, ignore) {
  const inside = new Set([frame.id, ...ancestors(new Map(elements.map((e) => [e.id, e])), frame.id), ...descendantsOf(kids, frame.id).map((e) => e.id), ...ignore]);
  const fb = { x: frame.x, y: frame.y, w: grow.width, h: grow.height };
  let n = 0;
  for (const e of elements) {
    if (!e || inside.has(e.id) || !finite(e.x) || !finite(e.y)) continue;
    const b = boxOf(e);
    if (fb.x < b.x + b.width && fb.x + fb.w > b.x && fb.y < b.y + b.height && fb.y + fb.h > b.y) n += 1;
  }
  return n ? [`Frame "${clip(frame.label, 40)}" grew to fit and now overlaps ${n} other element${n === 1 ? '' : 's'}; nothing was moved. Move them, or use a roomier frame or another anchor.`] : [];
}

export function checkAnchor(anchor, byId, errors,{ allowInFrame = true } = {}) {
  if (anchor === undefined) return null;
  if (!isObj(anchor)) {
    errors.push('anchor must be an object: {near: elementId} | {at: {x, y}} | {inFrame: frameId}');
    return null;
  }
  const keys = Object.keys(anchor);
  if (keys.length !== 1 || !['near', 'at', 'inFrame'].includes(keys[0])) {
    errors.push('anchor needs exactly one of near, at, inFrame');
    return null;
  }
  const [kind] = keys;
  const v = anchor[kind];
  if (kind === 'at') {
    if (!isObj(v) || !finite(v.x) || !finite(v.y) || Math.abs(v.x) > COORD_LIMIT || Math.abs(v.y) > COORD_LIMIT) {
      errors.push(`anchor.at must be {x, y} with numbers between -${COORD_LIMIT} and ${COORD_LIMIT}`);
      return null;
    }
    return { kind, x: v.x, y: v.y };
  }
  if (kind === 'inFrame' && !allowInFrame) {
    errors.push('anchor.inFrame is not available here');
    return null;
  }
  const el = typeof v === 'string' ? byId.get(v) : null;
  if (!el) {
    errors.push(`anchor.${kind}: element "${clip(v)}" does not exist`);
    return null;
  }
  if (!finite(el.x) || !finite(el.y)) {
    errors.push(`anchor.${kind}: element "${clip(v)}" has no position`);
    return null;
  }
  if (kind === 'inFrame' && !isContainer(el)) {
    errors.push(`anchor.inFrame: "${clip(v)}" is not a frame or container`);
    return null;
  }
  return { kind, el };
}

function validateStructure(content, input) {
  const errors = [];
  const warnings = [];
  const elements = Array.isArray(content?.elements) ? content.elements : [];
  const byId = new Map(elements.filter((e) => isObj(e) && typeof e.id === 'string').map((e) => [e.id, e]));
  if (!isObj(input)) return { errors: ['structure input must be an object'] };
  const { structure, layout } = input;
  if (!LAYOUTS.includes(layout)) errors.push(`layout must be one of ${LAYOUTS.join(', ')}`);
  if (!isObj(structure)) return { errors: [...errors, 'structure must be an object {nodes, edges?, groups?}'] };
  const allowed = ['nodes', 'edges', 'groups'];
  for (const k of Object.keys(structure)) if (!allowed.includes(k)) errors.push(`Unknown field "${clip(k, 40)}" in structure; allowed: ${allowed.join(', ')}`);
  const notArray = allowed.filter((k) => structure[k] !== undefined && !Array.isArray(structure[k]));
  if (notArray.length) return { errors: [...errors, ...notArray.map((k) => `structure.${k} must be an array`)] };
  const nodes = Array.isArray(structure.nodes) ? structure.nodes : [];
  const edges = Array.isArray(structure.edges) ? structure.edges : [];
  const groups = Array.isArray(structure.groups) ? structure.groups : [];
  if (nodes.length === 0) errors.push('structure.nodes needs at least one node');
  if (nodes.length > MAX_NODES) errors.push(`Too many nodes (${nodes.length}); the limit is ${MAX_NODES} per call`);
  if (edges.length > MAX_EDGES) errors.push(`Too many edges (${edges.length}); the limit is ${MAX_EDGES} per call`);
  if (groups.length > MAX_GROUPS) errors.push(`Too many groups (${groups.length}); the limit is ${MAX_GROUPS} per call`);
  if (errors.length && (nodes.length > MAX_NODES || edges.length > MAX_EDGES || groups.length > MAX_GROUPS)) return { errors };

  const groupKeys = new Set();
  groups.forEach((g, i) => {
    const at = `groups[${i}]`;
    if (!isObj(g) || typeof g.key !== 'string' || !KEY_RE.test(g.key)) return errors.push(`${at}: key must be 1-38 letters, digits, - or _`);
    if (FORBIDDEN.has(g.key)) return errors.push(`${at}: key "${g.key}" is reserved`);
    for (const k of Object.keys(g)) if (!['key', 'label'].includes(k)) errors.push(`${at}: unknown field "${clip(k, 40)}"; allowed: key, label`);
    if (typeof g.label !== 'string' || !g.label.trim()) errors.push(`${at} ("${g.key}"): label is required (it titles the frame)`);
    if (groupKeys.has(g.key)) errors.push(`${at}: duplicate group key "${g.key}"`);
    groupKeys.add(g.key);
  });

  const nodeKeys = new Set();
  const existingSeen = new Set();
  const lockedIds = [];
  nodes.forEach((n, i) => {
    const at = `nodes[${i}]`;
    if (!isObj(n) || typeof n.key !== 'string' || !KEY_RE.test(n.key)) return errors.push(`${at}: key must be 1-38 letters, digits, - or _`);
    if (FORBIDDEN.has(n.key)) return errors.push(`${at}: key "${n.key}" is reserved`);
    for (const k of Object.keys(n)) {
      if (!['key', 'label', 'stencil', 'data', 'group', 'existingId'].includes(k)) errors.push(`${at} ("${n.key}"): unknown field "${clip(k, 40)}"; allowed: key, label, stencil, data, group, existingId`);
    }
    if (nodeKeys.has(n.key)) errors.push(`${at}: duplicate node key "${n.key}"`);
    nodeKeys.add(n.key);
    if (n.group !== undefined && !groupKeys.has(n.group)) errors.push(`${at} ("${n.key}"): unknown group "${clip(n.group)}" (declare it in structure.groups)`);
    if (n.existingId !== undefined) {
      const el = typeof n.existingId === 'string' ? byId.get(n.existingId) : null;
      if (!el) errors.push(`${at} ("${n.key}"): existingId "${clip(n.existingId)}" is not an element of this diagram`);
      else if (isContainer(el)) errors.push(`${at} ("${n.key}"): existingId "${clip(n.existingId)}" is a frame; use layout_apply to arrange frames`);
      else if (existingSeen.has(n.existingId)) errors.push(`${at} ("${n.key}"): existingId "${clip(n.existingId)}" is used twice`);
      else if (isLockedElement(el, content?.layers)) lockedIds.push(n.existingId);
      existingSeen.add(n.existingId);
      if (n.stencil !== undefined) errors.push(`${at} ("${n.key}"): stencil cannot be set together with existingId`);
      if (n.data !== undefined) errors.push(`${at} ("${n.key}"): data cannot be set together with existingId`);
    } else if (n.stencil !== undefined) {
      if (typeof n.stencil !== 'string' || !n.stencil.includes('/') || !findStencilMeta(n.stencil)) {
        errors.push(`${at} ("${n.key}"): unknown stencil "${clip(n.stencil)}". Closest: ${suggestStencils(n.stencil).join(', ')}`);
      }
    }
  });

  if (lockedIds.length) errors.push(`Locked elements cannot be moved by an agent (the owner locked them, or their layer): ${lockedIds.slice(0, 10).map((id) => clip(id)).join(', ')}. Unlock them or leave them out`);

  const seenEdge = new Set();
  const cleanEdges = [];
  edges.forEach((e, i) => {
    const at = `edges[${i}]`;
    if (!isObj(e)) return errors.push(`${at}: must be an object {from, to, label?}`);
    for (const k of Object.keys(e)) if (!['from', 'to', 'label'].includes(k)) errors.push(`${at}: unknown field "${clip(k, 40)}"; allowed: from, to, label`);
    for (const end of ['from', 'to']) if (!nodeKeys.has(e[end])) errors.push(`${at}: ${end} "${clip(e[end])}" is not a node key`);
    if (e.from === e.to && nodeKeys.has(e.from)) errors.push(`${at}: from and to must differ ("${e.from}")`);
    const k = `${e.from}\u0000${e.to}`;
    if (seenEdge.has(k)) return warnings.push(`edges[${i}]: duplicate edge ${clip(e.from)} -> ${clip(e.to)} ignored`);
    seenEdge.add(k);
    cleanEdges.push(e);
  });

  const anchor = checkAnchor(input.anchor, byId, errors);
  return { errors, warnings, lockedIds, byId, nodes, edges: cleanEdges, groups, anchor, elements };
}

/**
 * @param {object} content stored diagram content (not mutated)
 * @param {{structure: {nodes: object[], edges?: object[], groups?: object[]}, layout: string, anchor?: object}} input
 * @param {{newId?: Function}} [opts]
 * @returns the applyOps result plus {created: key -> id, groups: key -> id, summary}, or {ok: false, code, errors}
 */
export function compileMapStructure(content, input, opts = {}) {
  const v = validateStructure(content, input);
  if (v.errors.length) return fail(v.errors, v.lockedIds?.length ? 'INVALID_OPS' : 'INVALID_STRUCTURE');
  const { nodes, edges, groups, anchor, byId, elements } = v;
  const layout = input.layout;
  const inFrame = anchor?.kind === 'inFrame' ? anchor.el : null;

  // Sizes: existing elements keep theirs, new ones take the stencil default (what the applier will give them too).
  const depths = layout === 'mindmap' || layout === 'radial' ? structureDepths(nodes.map((n) => ({ key: n.key })), edges) : null;
  const plan = nodes.map((n) => {
    if (n.existingId !== undefined) {
      const b = boxOf(byId.get(n.existingId));
      return { n, w: b.width, h: b.height, existing: byId.get(n.existingId) };
    }
    const type = n.stencil || defaultStencil(layout, depths ? depths.get(n.key) ?? 1 : 0);
    const def = findStencilMeta(type)?.stencil?.defaultSize || { width: 120, height: 80 };
    return { n, w: def.width, h: def.height, type };
  });

  const laid = layoutStructure({
    nodes: plan.map((p) => ({ key: p.n.key, w: p.w, h: p.h, group: p.n.group })),
    edges: edges.map((e) => ({ from: e.from, to: e.to })),
    groups: groups.map((g) => ({ key: g.key })),
    layout,
  });

  // Block extent from the actual boxes (frames included).
  let maxX = 0;
  let maxY = 0;
  for (const p of plan) {
    const pos = laid.nodes.get(p.n.key);
    maxX = Math.max(maxX, pos.x + p.w);
    maxY = Math.max(maxY, pos.y + p.h);
  }
  for (const f of laid.frames.values()) {
    maxX = Math.max(maxX, f.x + f.w);
    maxY = Math.max(maxY, f.y + f.h);
  }
  const size = { w: maxX, h: maxY };

  const moving = new Set(plan.filter((p) => p.existing).map((p) => p.existing.id));
  let origin;
  let mode;
  let growFrame = null;
  if (inFrame) {
    const skip = new Set([...moving, inFrame.id, ...ancestors(byId, inFrame.id)]);
    const space = occupiedSpace(elements, skip);
    const kids = childrenIndex(elements);
    const members = descendantsOf(kids, inFrame.id).filter((e) => !moving.has(e.id));
    const spot = placeInFrame({ space, frame: inFrame, size, members });
    origin = { x: spot.x, y: spot.y };
    growFrame = spot.grow;
    if (growFrame) v.warnings.push(...growthWarning(elements, kids, inFrame, growFrame, moving));
    mode = 'in-frame';
  } else {
    const space = occupiedSpace(elements, moving);
    let preferred;
    if (anchor?.kind === 'at') preferred = { x: anchor.x, y: anchor.y };
    else if (anchor?.kind === 'near') {
      const b = boxOf(anchor.el);
      preferred = { x: b.x + b.width + CONTENT_GAP / 2, y: b.y };
    }
    const spot = placeBlock({ space, size, preferred });
    origin = { x: spot.x, y: spot.y };
    mode = spot.mode;
  }
  if (origin.x + size.w > COORD_LIMIT || origin.y + size.h > COORD_LIMIT) return fail(['The result would fall outside the canvas; use anchor.at with smaller coordinates or a different anchor']);

  // ---- compile to ops (frames, nodes, edges): the batch the M2 applier validates and applies atomically ----
  const ops = [];
  const parentOf = inFrame ? inFrame.id : undefined;
  // Existing notes with no group and no target frame follow the editor's drop rule: the frame holding their new centre
  // adopts them, and one that lands outside every frame is released from its old one (else it keeps a stale parent).
  const finals = {};
  for (const p of plan) {
    if (!p.existing || p.n.group || parentOf) continue;
    const pos = laid.nodes.get(p.n.key);
    finals[p.existing.id] = { x: origin.x + pos.x, y: origin.y + pos.y };
  }
  const membership = membershipChanges(elements, finals);
  if (growFrame) ops.push({ op: 'update_element', id: inFrame.id, w: growFrame.width, h: growFrame.height });
  for (const g of groups) {
    const f = laid.frames.get(g.key);
    ops.push({
      op: 'add_element', ref: `@g_${g.key}`, type: FRAME_TYPE, label: g.label,
      x: origin.x + f.x, y: origin.y + f.y, w: f.w, h: f.h, ...(parentOf ? { parent: parentOf } : {}),
    });
  }
  for (const p of plan) {
    const pos = laid.nodes.get(p.n.key);
    const x = origin.x + pos.x;
    const y = origin.y + pos.y;
    const parent = p.n.group ? `@g_${p.n.group}` : parentOf;
    if (p.existing) {
      const moveParent = parent || (Object.hasOwn(membership, p.existing.id) ? membership[p.existing.id] : undefined); // null releases
      ops.push({ op: 'update_element', id: p.existing.id, x, y, ...(p.n.label !== undefined ? { label: p.n.label } : {}), ...(moveParent !== undefined ? { parent: moveParent } : {}) });
    } else {
      ops.push({
        op: 'add_element', ref: `@n_${p.n.key}`, type: p.type, x, y, ...(p.n.label !== undefined ? { label: p.n.label } : {}),
        ...(p.n.data !== undefined ? { data: p.n.data } : {}), ...(parent ? { parent } : {}),
      });
    }
  }
  const idOf = (key) => {
    const p = plan.find((q) => q.n.key === key);
    return p.existing ? p.existing.id : `@n_${key}`;
  };
  for (const e of edges) {
    ops.push({ op: 'connect', from: idOf(e.from), to: idOf(e.to), ...(e.label !== undefined ? { label: e.label } : {}), style: EDGE_STYLE[layout] });
  }

  const result = applyOps(content, ops, { newId: opts.newId, maxOps: MAX_STRUCTURE_OPS });
  if (!result.ok) return { ...result, code: 'INVALID_STRUCTURE', errors: result.errors.map((e) => ({ index: -1, message: e.index >= 0 ? `compiled op ${e.index} (${ops[e.index]?.op} ${ops[e.index]?.ref || ops[e.index]?.id || ''}): ${e.message}` : e.message })) };

  const created = Object.create(null);
  const createdGroups = Object.create(null);
  for (const [ref, id] of Object.entries(result.created)) {
    if (ref.startsWith('@n_')) created[ref.slice(3)] = id;
    else if (ref.startsWith('@g_')) createdGroups[ref.slice(3)] = id;
  }
  const newNodes = plan.filter((p) => !p.existing).length;
  return {
    ...result,
    created,
    groups: createdGroups,
    warnings: [...result.warnings, ...v.warnings],
    summary: {
      layout, nodes: newNodes, existingMoved: plan.length - newNodes, edges: edges.length, frames: groups.length,
      placement: mode, bounds: { x: origin.x, y: origin.y, w: snap(size.w), h: snap(size.h) },
    },
  };
}

// ---------------------------------------------------------------------------------------------------------------------

/**
 * Re-layout existing elements: positions only (update_element x/y). Units are non-frame elements and whole frames
 * (a frame moves rigidly with everything inside it). Selection is by `frameId` (its direct members) or `elementIds`.
 * @param {object} content
 * @param {{target: {frameId?: string, elementIds?: string[]}, layout: string, anchor?: object}} input
 */
export function compileLayoutApply(content, input, opts = {}) {
  const errors = [];
  const elements = Array.isArray(content?.elements) ? content.elements : [];
  const byId = new Map(elements.filter((e) => isObj(e) && typeof e.id === 'string').map((e) => [e.id, e]));
  if (!isObj(input)) return fail(['input must be an object']);
  const { target, layout } = input;
  if (!LAYOUTS.includes(layout)) errors.push(`layout must be one of ${LAYOUTS.join(', ')}`);
  const kids = childrenIndex(elements);
  let selected = [];
  let frame = null;
  const warnings = [];
  if (!isObj(target) || [target.frameId, target.elementIds].filter((x) => x !== undefined).length !== 1) {
    errors.push('target needs exactly one of frameId or elementIds');
  } else if (target.frameId !== undefined) {
    frame = typeof target.frameId === 'string' ? byId.get(target.frameId) : null;
    if (!frame) errors.push(`target.frameId "${clip(target.frameId)}" is not an element of this diagram`);
    else if (!isContainer(frame)) errors.push(`target.frameId "${clip(target.frameId)}" is not a frame or container`);
    else if (!finite(frame.x) || !finite(frame.y)) errors.push('the frame has no position');
    else if (isLockedElement(frame, content?.layers)) return fail([`target.frameId "${clip(target.frameId)}" is locked (or on a locked layer); unlock it before an agent can arrange it`], 'INVALID_OPS');
    else selected = (kids.get(frame.id) || []).slice();
    if (input.anchor !== undefined) errors.push('anchor applies to elementIds targets; a frame is laid out inside itself');
  } else {
    const ids = target.elementIds;
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_LAYOUT_UNITS) errors.push(`target.elementIds needs 1-${MAX_LAYOUT_UNITS} ids`);
    else {
      const missing = ids.filter((id) => typeof id !== 'string' || !byId.has(id));
      if (missing.length) errors.push(`Unknown element ids: ${missing.slice(0, 5).map((m) => clip(m)).join(', ')}`);
      else selected = [...new Set(ids)].map((id) => byId.get(id));
    }
  }
  const anchor = checkAnchor(input.anchor, byId, errors, { allowInFrame: false });
  if (errors.length) return fail(errors);

  const selectedIds = new Set(selected.map((e) => e.id));
  // Units: selected elements without a selected ancestor, positioned only.
  const lockedBlocks = (e) => isLockedElement(e, content?.layers) || (isContainer(e) && descendantsOf(kids, e.id).some((d) => isLockedElement(d, content?.layers)));
  const units = selected.filter((e) => {
    if (lockedBlocks(e)) {
      warnings.push(`"${clip(e.id)}" is locked (or on a locked layer, or holds a locked element) and was left in place`);
      return false;
    }
    if (!finite(e.x) || !finite(e.y)) {
      warnings.push(`"${clip(e.id)}" has no position and was skipped`);
      return false;
    }
    for (const a of ancestors(byId, e.id)) if (selectedIds.has(a)) return false;
    return true;
  });
  if (units.length === 0) {
    if (frame && selected.length === 0) return fail(['Nothing to lay out: the frame has no members']);
    return fail([`Nothing to lay out: no movable positioned elements in the selection${warnings.length ? ` (${warnings.slice(0, 3).join('; ')})` : ''}`]);
  }
  if (units.length > MAX_LAYOUT_UNITS) return fail([`Too many elements (${units.length}); the limit is ${MAX_LAYOUT_UNITS} per call`]);

  const bundle = new Map(); // unit id -> descendants that move with it
  const unitOf = new Map();
  for (const u of units) {
    const d = isContainer(u) ? descendantsOf(kids, u.id) : [];
    bundle.set(u.id, d);
    unitOf.set(u.id, u.id);
    for (const x of d) unitOf.set(x.id, u.id);
  }
  const edgeList = [];
  const seen = new Set();
  for (const c of Array.isArray(content?.connections) ? content.connections : []) {
    const a = unitOf.get(c?.sourceId);
    const b = unitOf.get(c?.targetId);
    if (!a || !b || a === b || seen.has(`${a}\u0000${b}`)) continue;
    seen.add(`${a}\u0000${b}`);
    edgeList.push({ from: a, to: b });
  }
  const sizes = new Map(units.map((u) => [u.id, boxOf(u)]));
  const laid = layoutStructure({
    nodes: units.map((u) => ({ key: u.id, w: sizes.get(u.id).width, h: sizes.get(u.id).height })),
    edges: edgeList,
    layout,
  });
  let maxX = 0;
  let maxY = 0;
  for (const u of units) {
    const p = laid.nodes.get(u.id);
    maxX = Math.max(maxX, p.x + sizes.get(u.id).width);
    maxY = Math.max(maxY, p.y + sizes.get(u.id).height);
  }
  const size = { w: maxX, h: maxY };

  const movingIds = new Set();
  for (const u of units) {
    movingIds.add(u.id);
    for (const d of bundle.get(u.id)) movingIds.add(d.id);
  }
  const parents = new Set(units.map((u) => u.parentFrameId || ''));
  const commonParent = frame ? frame : !anchor && parents.size === 1 && [...parents][0] ? byId.get([...parents][0]) : null;
  let origin;
  let growFrame = null;
  let mode;
  if (commonParent && finite(commonParent.x) && finite(commonParent.y)) {
    const skip = new Set([...movingIds, commonParent.id, ...ancestors(byId, commonParent.id)]);
    const space = occupiedSpace(elements, skip);
    const members = descendantsOf(kids, commonParent.id).filter((e) => !movingIds.has(e.id));
    const spot = placeInFrame({ space, frame: commonParent, size, members });
    origin = spot;
    growFrame = spot.grow;
    if (growFrame) warnings.push(...growthWarning(elements, kids, commonParent, growFrame, movingIds));
    mode = 'in-frame';
  } else {
    const space = occupiedSpace(elements, movingIds);
    let preferred;
    if (anchor?.kind === 'at') preferred = { x: anchor.x, y: anchor.y };
    else if (anchor?.kind === 'near') {
      const b = boxOf(anchor.el);
      preferred = { x: b.x + b.width + CONTENT_GAP / 2, y: b.y };
    } else {
      preferred = { x: Math.min(...units.map((u) => u.x)), y: Math.min(...units.map((u) => u.y)) };
    }
    const spot = placeBlock({ space, size, preferred });
    origin = spot;
    mode = spot.mode;
    if (parents.size > 1) warnings.push('Elements from different frames were arranged together; each keeps its frame membership');
  }
  if (origin.x + size.w > COORD_LIMIT || origin.y + size.h > COORD_LIMIT) return fail(['The result would fall outside the canvas']);

  const ops = [];
  if (growFrame) ops.push({ op: 'update_element', id: commonParent.id, w: growFrame.width, h: growFrame.height });
  let moved = 0;
  const finals = {};
  for (const u of units) {
    const p = laid.nodes.get(u.id);
    const nx = origin.x + p.x;
    const ny = origin.y + p.y;
    const dx = nx - u.x;
    const dy = ny - u.y;
    if (dx === 0 && dy === 0) continue;
    ops.push({ op: 'update_element', id: u.id, x: nx, y: ny });
    finals[u.id] = { x: nx, y: ny };
    moved += 1;
    for (const d of bundle.get(u.id)) {
      if (!finite(d.x) || !finite(d.y)) continue;
      ops.push({ op: 'update_element', id: d.id, x: d.x + dx, y: d.y + dy });
      finals[d.id] = { x: d.x + dx, y: d.y + dy };
    }
  }
  // Same drop rule as map_structure: non-frame units are adopted by the frame holding their new centre, or released
  // from a frame they no longer sit in. Members that travel with their own frame keep their membership.
  const movedElements = growFrame ? elements.map((e) => (e.id === commonParent.id ? { ...e, size: { ...(e.size || {}), width: growFrame.width, height: growFrame.height } } : e)) : elements;
  const membership = membershipChanges(movedElements, finals);
  for (const u of units) {
    if (isContainer(u) || !Object.hasOwn(membership, u.id)) continue;
    const op = ops.find((o) => o.id === u.id && o.op === 'update_element' && o.x !== undefined);
    if (op) op.parent = membership[u.id];
  }
  if (ops.length === 0 || (moved === 0 && !growFrame)) return fail(['Nothing to change: the elements already have this layout']);

  const result = applyOps(content, ops, { newId: opts.newId, maxOps: MAX_STRUCTURE_OPS });
  if (!result.ok) return { ...result, code: 'INVALID_STRUCTURE' };
  return {
    ...result,
    moved,
    warnings: [...result.warnings, ...warnings],
    summary: { layout, moved, units: units.length, placement: mode, grewFrame: Boolean(growFrame), bounds: { x: origin.x, y: origin.y, w: snap(size.w), h: snap(size.h) } },
  };
}

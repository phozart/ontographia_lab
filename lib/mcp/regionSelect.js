// lib/mcp/regionSelect.js
// Pure region selection for the MCP tool `board_read_region` (slice AI-1). No I/O.
//   frame      the frame and its transitive EXPLICIT members (parentFrameId); never recomputed from geometry
//   elements   those ids (a frame id in the list expands to its members)
//   region     every element whose rectangle strictly overlaps the bbox (touching edges do not count)
//   around     an element's rectangle grown by a radius, then as `region`
// Results are in reading order: depth-first by frame, then top-to-bottom, left-to-right.

import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { validateBbox, FocusLinkError } from '../focusLink';

export class RegionInputError extends Error {}

const DEFAULT_SIZE = { width: 120, height: 60 };
const DEFAULT_FRAME_SIZE = { width: 600, height: 400 };
export const DEFAULT_AROUND_RADIUS = 300;
export const MAX_AROUND_RADIUS = 5000;
const MAX_NEIGHBOUR_FRAMES = 20;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const finite = (v) => typeof v === 'number' && Number.isFinite(v);

function packTypeOf(el) {
  const type = typeof el.type === 'string' ? el.type : '';
  const packId = typeof el.packId === 'string' ? el.packId : '';
  return packId && type && !type.includes('/') ? `${packId}/${type}` : type;
}

/** A frame is an element of type "frame", flagged isFrame, or whose stencil is a frame. */
export function isFrameElement(el) {
  if (!isObj(el)) return false;
  if (el.type === 'frame' || el.isFrame === true) return true;
  const found = findStencilMeta(packTypeOf(el), el.packId);
  return Boolean(found?.stencil?.isFrame) || found?.stencil?.shape === 'frame';
}

function rectOf(el) {
  if (!finite(el.x) || !finite(el.y)) return null;
  const def = isFrameElement(el) ? DEFAULT_FRAME_SIZE : DEFAULT_SIZE;
  const w = finite(el.size?.width) ? el.size.width : finite(el.width) ? el.width : def.width;
  const h = finite(el.size?.height) ? el.size.height : finite(el.height) ? el.height : def.height;
  return { x: el.x, y: el.y, width: Math.max(0, w), height: Math.max(0, h) };
}

const overlaps = (a, b) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

const byPosition = (a, b) =>
  (finite(a.y) ? a.y : Infinity) - (finite(b.y) ? b.y : Infinity) ||
  (finite(a.x) ? a.x : Infinity) - (finite(b.x) ? b.x : Infinity) ||
  String(a.id).localeCompare(String(b.id));

/** Depth-first by frame, then y, then x. Cycle-safe; elements whose parent is outside the set are roots. */
export function orderForReading(elements) {
  const present = new Set(elements.map((e) => e.id));
  const children = new Map();
  for (const e of elements) {
    const parent = typeof e.parentFrameId === 'string' && present.has(e.parentFrameId) && e.parentFrameId !== e.id ? e.parentFrameId : null;
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push(e);
  }
  const out = [];
  const seen = new Set();
  const visit = (parent) => {
    for (const e of (children.get(parent) || []).sort(byPosition)) {
      if (seen.has(e.id)) continue;
      seen.add(e.id);
      out.push(e);
      visit(e.id);
    }
  };
  visit(null);
  // Members of a parent cycle are unreachable from the roots: append them in position order.
  for (const e of [...elements].sort(byPosition)) {
    if (!seen.has(e.id)) {
      seen.add(e.id);
      out.push(e);
      visit(e.id);
    }
  }
  return out;
}

/** The frame and everything beneath it through explicit parentFrameId links. */
function withDescendants(rootId, byId, all) {
  const members = new Set([rootId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of all) {
      if (!members.has(e.id) && typeof e.parentFrameId === 'string' && members.has(e.parentFrameId)) {
        members.add(e.id);
        grew = true;
      }
    }
  }
  return members;
}

function bboxFocus(raw) {
  try {
    return validateBbox(raw);
  } catch (err) {
    if (err instanceof FocusLinkError) throw new RegionInputError(err.message);
    throw err;
  }
}

function neighbourhoodOf(all, focusIds, focusRects) {
  if (!focusRects.length) return { frames: [] };
  const box = focusRects.reduce(
    (b, r) => ({
      x1: Math.min(b.x1, r.x),
      y1: Math.min(b.y1, r.y),
      x2: Math.max(b.x2, r.x + r.width),
      y2: Math.max(b.y2, r.y + r.height),
    }),
    { x1: Infinity, y1: Infinity, x2: -Infinity, y2: -Infinity }
  );
  const counts = new Map();
  for (const e of all) if (typeof e.parentFrameId === 'string') counts.set(e.parentFrameId, (counts.get(e.parentFrameId) || 0) + 1);
  const frames = [];
  for (const e of all) {
    if (focusIds.has(e.id) || !isFrameElement(e)) continue;
    const r = rectOf(e);
    if (!r) continue;
    const dx = Math.max(box.x1 - (r.x + r.width), r.x - box.x2, 0);
    const dy = Math.max(box.y1 - (r.y + r.height), r.y - box.y2, 0);
    frames.push({ e, d: Math.hypot(dx, dy) });
  }
  frames.sort((a, b) => a.d - b.d || String(a.e.id).localeCompare(String(b.e.id)));
  return {
    frames: frames.slice(0, MAX_NEIGHBOUR_FRAMES).map(({ e }) => ({
      id: e.id,
      label: String(e.label ?? e.text ?? '').slice(0, 200),
      count: counts.get(e.id) || 0,
    })),
  };
}

/**
 * @param {object[]} elements raw stored elements (objects with a string id)
 * @param {{frameId?: string, elementIds?: string[], bbox?: object, around?: {elementId: string, radius?: number}}} focus exactly one key
 * @param {{neighbourhood?: 'none'|'summary'}} [opts]
 * @returns {{kind: 'frame'|'elements'|'region'|'around', elements: object[], notFound: string[], neighbourhood?: {frames: object[]}}}
 */
export function selectRegion(elements, focus, opts = {}) {
  const keys = isObj(focus) ? ['frameId', 'elementIds', 'bbox', 'around'].filter((k) => focus[k] !== undefined && focus[k] !== null) : [];
  if (keys.length !== 1) throw new RegionInputError('Give exactly one focus: link, frameId, elementIds, bbox or around.');
  const all = elements.filter((e) => isObj(e) && typeof e.id === 'string' && e.id);
  const byId = new Map(all.map((e) => [e.id, e]));
  let kind;
  let picked;
  const notFound = [];

  if (keys[0] === 'frameId') {
    const f = byId.get(focus.frameId);
    if (!f) throw new RegionInputError(`Frame "${String(focus.frameId).slice(0, 80)}" was not found in this diagram.`);
    if (!isFrameElement(f)) throw new RegionInputError(`"${String(focus.frameId).slice(0, 80)}" is not a frame; use elementIds or around instead.`);
    kind = 'frame';
    const members = withDescendants(f.id, byId, all);
    picked = all.filter((e) => members.has(e.id));
  } else if (keys[0] === 'elementIds') {
    kind = 'elements';
    const wanted = new Set();
    for (const id of focus.elementIds) {
      const e = byId.get(id);
      if (!e) {
        notFound.push(id);
        continue;
      }
      if (isFrameElement(e)) for (const m of withDescendants(id, byId, all)) wanted.add(m);
      else wanted.add(id);
    }
    if (!wanted.size) throw new RegionInputError('None of the requested element ids exist in this diagram (they may have been deleted since the link was copied).');
    picked = all.filter((e) => wanted.has(e.id));
  } else {
    let box;
    if (keys[0] === 'bbox') {
      kind = 'region';
      box = bboxFocus(focus.bbox);
    } else {
      kind = 'around';
      const target = byId.get(focus.around?.elementId);
      const r = target && rectOf(target);
      if (!r) throw new RegionInputError('The element to read around was not found (or has no position).');
      const raw = Number(focus.around.radius);
      const radius = Math.min(MAX_AROUND_RADIUS, Math.max(0, Number.isFinite(raw) ? raw : DEFAULT_AROUND_RADIUS));
      box = { x: r.x - radius, y: r.y - radius, width: r.width + 2 * radius, height: r.height + 2 * radius };
    }
    picked = all.filter((e) => {
      const r = rectOf(e);
      return r && overlaps(r, box);
    });
  }

  const ordered = orderForReading(picked);
  const result = { kind, elements: ordered, notFound };
  if (opts.neighbourhood === 'summary') {
    const rects = ordered.map(rectOf).filter(Boolean);
    result.neighbourhood = neighbourhoodOf(all, new Set(ordered.map((e) => e.id)), rects);
  }
  return result;
}

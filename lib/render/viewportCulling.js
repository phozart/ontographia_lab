// lib/render/viewportCulling.js
// Pure viewport culling for the canvas (board-load performance, docs/architecture/investigations/board-load-performance.md).
// The editor mounts only the elements whose box intersects the visible world rectangle plus a margin; everything else
// is rendered from CONTENT when needed (exports, thumbnails) or with culling suspended (present mode, Copy as image).
//
// World coordinates: a screen point (sx, sy) in a container maps to world (sx / scale - viewport.x, sy / scale - viewport.y).

/** World units around an element's box that can still draw (external label under the shape, handles, shadow, rotation handle). */
export const CULL_PAD = 120;
/** Below this many elements nothing is culled: the saving is nil and small boards keep the exact historical DOM. */
export const CULL_MIN_ELEMENTS = 120;
/** The mounted band around the visible rectangle, in viewports on each side; the band snaps in steps of CULL_SNAP viewports. */
export const CULL_MARGIN = 1;
export const CULL_SNAP = 0.5;

const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** The world rectangle currently visible in a container of `size` (px). Null when the size is unknown. */
export function visibleWorldRect(viewport, size) {
  const scale = num(viewport?.scale, 1) || 1;
  const w = num(size?.width);
  const h = num(size?.height);
  if (!(w > 0) || !(h > 0)) return null;
  return { x: -num(viewport?.x), y: -num(viewport?.y), width: w / scale, height: h / scale };
}

/**
 * The rectangle whose elements stay mounted: the visible rectangle grown by `margin` viewports on every side and
 * snapped OUTWARD to a grid of `snap` viewports, so small pans return the identical rectangle (stable memo keys,
 * no remount churn) and the visible rectangle is always inside it.
 */
export function cullWorldRect(visible, { margin = CULL_MARGIN, snap = CULL_SNAP } = {}) {
  if (!visible) return null;
  const sx = visible.width * snap;
  const sy = visible.height * snap;
  const x0 = Math.floor((visible.x - visible.width * margin) / sx) * sx;
  const y0 = Math.floor((visible.y - visible.height * margin) / sy) * sy;
  const x1 = Math.ceil((visible.x + visible.width * (1 + margin)) / sx) * sx;
  const y1 = Math.ceil((visible.y + visible.height * (1 + margin)) / sy) * sy;
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

export function rectsIntersect(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

const boxCache = new WeakMap(); // element object -> box (elements are immutable in state; a changed element is a new object)

/** An element's world box, grown to cover rotation. `sizeOf(el)` supplies the stencil default size when el.size is missing. */
export function elementBox(el, sizeOf) {
  const hit = boxCache.get(el);
  if (hit && hit.sizeOf === sizeOf) return hit.box;
  const size = el.size || (sizeOf ? sizeOf(el) : null) || { width: 120, height: 60 };
  const x = num(el.x);
  const y = num(el.y);
  const w = num(size.width, 120);
  const h = num(size.height, 60);
  let box = { x, y, width: w, height: h };
  const rot = num(el.rotation);
  if (rot % 180 !== 0) {
    // the rotated box lies inside the circle through the corners
    const r = Math.hypot(w, h) / 2;
    box = { x: x + w / 2 - r, y: y + h / 2 - r, width: 2 * r, height: 2 * r };
  }
  boxCache.set(el, { sizeOf, box });
  return box;
}

const hits = (rects, box) => rects.some((r) => rectsIntersect(box, r));
const grow = (b, p) => ({ x: b.x - p, y: b.y - p, width: b.width + 2 * p, height: b.height + 2 * p });

/**
 * Elements to mount, in the input order (z-order is preserved).
 * @param {object[]} elements
 * @param {{x,y,width,height}|Array<{x,y,width,height}>|null} rect the cull rectangle, or several (null = keep everything)
 * @param {{sizeOf?: Function, pad?: number, keepIds?: Set<string>|null, min?: number}} [opts]
 *   keepIds: always mounted (selected, being dragged or edited, connection source ...)
 */
export function cullElements(elements, rect, { sizeOf, pad = CULL_PAD, keepIds = null, min = CULL_MIN_ELEMENTS } = {}) {
  if (!rect || elements.length < min) return elements;
  const rs = (Array.isArray(rect) ? rect : [rect]).map((r) => grow(r, pad));
  const out = [];
  for (const el of elements) {
    if ((keepIds && keepIds.has(el.id)) || hits(rs, elementBox(el, sizeOf))) out.push(el);
  }
  return out;
}

/** The box a connection can draw in: both endpoint boxes, its waypoints, and `pad` for stubs, arrowheads, labels and curves. */
export function connectionBox(conn, boxById, pad = CULL_PAD) {
  const a = boxById.get(conn.sourceId);
  const b = boxById.get(conn.targetId);
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const add = (x, y, w = 0, h = 0) => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + w); y1 = Math.max(y1, y + h); };
  if (a) add(a.x, a.y, a.width, a.height);
  if (b) add(b.x, b.y, b.width, b.height);
  if (Array.isArray(conn.waypoints)) for (const p of conn.waypoints) if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) add(p.x, p.y);
  if (!Number.isFinite(x0)) return null; // dangling connection: unknown box
  return grow({ x: x0, y: y0, width: x1 - x0, height: y1 - y0 }, pad);
}

/**
 * Connections to draw: those whose endpoint/waypoint bounding box intersects the cull rectangle, so a line whose two
 * endpoints are both off-screen but which crosses the viewport still renders. Input order preserved.
 * @param {object[]} connections
 * @param {Map<string, {x,y,width,height}>} boxById element boxes for ALL elements (not just the mounted ones)
 */
export function cullConnections(connections, boxById, rect, { pad = CULL_PAD, keepIds = null, min = CULL_MIN_ELEMENTS, total = connections.length } = {}) {
  if (!rect || total < min) return connections;
  const rs = Array.isArray(rect) ? rect : [rect];
  const out = [];
  for (const c of connections) {
    if (keepIds && (keepIds.has(c.id) || keepIds.has(c.sourceId) || keepIds.has(c.targetId))) { out.push(c); continue; }
    const box = connectionBox(c, boxById, pad);
    if (!box || hits(rs, box)) out.push(c); // a connection with unknown geometry is kept (and draws nothing, as before)
  }
  return out;
}

/** Map of id -> box for every element (the input of cullConnections). */
export function boxIndex(elements, sizeOf) {
  const m = new Map();
  for (const el of elements) m.set(el.id, elementBox(el, sizeOf));
  return m;
}

/** Zoom below which (or mounted-node count above which) the canvas draws one static overview layer instead of mounting nodes. */
export const OVERVIEW_MAX_SCALE = 0.15;
export const OVERVIEW_MAX_NODES = 800;

export function shouldUseOverview(scale, mountedCount) {
  return scale < OVERVIEW_MAX_SCALE || mountedCount > OVERVIEW_MAX_NODES;
}

/**
 * The topmost element under a world point (array order is z-order, last = top). A frame is only returned when nothing
 * else is under the point. Used by the overview layer, where there are no mounted nodes to receive the click.
 */
export function hitTestElements(elements, x, y, sizeOf) {
  let frame = null;
  for (let i = elements.length - 1; i >= 0; i -= 1) {
    const el = elements[i];
    const b = elementBox(el, sizeOf);
    if (x < b.x || x > b.x + b.width || y < b.y || y > b.y + b.height) continue;
    if (el.type === 'frame' || el.isFrame) { if (!frame) frame = el; continue; }
    return el;
  }
  return frame;
}

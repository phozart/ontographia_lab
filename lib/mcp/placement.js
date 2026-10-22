// lib/mcp/placement.js
// Server-side placement for elements an agent adds WITHOUT coordinates (docs/architecture/investigations/mcp-and-embedding.md 4.5).
// Pure: no I/O. LLMs place coordinates badly, so:
//   1. elements that are children of a frame are placed inside it, at the nearest free spot (findFreePlacement);
//   2. the remaining new elements are laid out as their own subgraph (hierarchicalLayout on uniform cells, so mixed
//      sizes cannot overlap; unconnected elements go into a grid below it);
//   3. that block is put in empty space to the right of all existing content (computeTemplatePlacement), so it can
//      never overlap what is already there. Existing elements never move.
// Elements that already carry both x and y are kept as they are and count as occupied space.

import { hierarchicalLayout } from '../../components/diagram-studio/LayoutEngine';
import { placeAtPoint } from '../../components/diagram-studio/hooks/interaction/placement';
import { computeTemplatePlacement, getContentBounds } from '../../components/diagram-studio/utils/templatePlacement';
import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { externalFootprint } from '../text/fit';

const GRID = 20;
const LAYER_GAP = 80;
const NODE_GAP = 40;
const ORIGIN = 80;
const CANVAS_MAX = 99000;
const DEFAULT_W = 120;
const DEFAULT_H = 80;
const MAX_GRID_COLS = 8;
const MAX_RING = 60; // candidate search radius in grid steps (same bound as the editor's findFreePlacement)
const INDEX_CELL = 200;

const snap = (v) => Math.round(v / GRID) * GRID;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const sizeOf = (e) => ({
  width: finite(e.size?.width) && e.size.width > 0 ? e.size.width : DEFAULT_W,
  height: finite(e.size?.height) && e.size.height > 0 ? e.size.height : DEFAULT_H,
});
/**
 * The layout cell of an element: its box plus the room its external label needs (ADR-0008 5: events, markers and data
 * stores keep a small glyph and hang the label below or beside it, so the label belongs to the footprint).
 */
function cellOf(e) {
  const s = sizeOf(e);
  const meta = findStencilMeta(e.type, e.packId);
  const foot = meta && typeof e.label === 'string' && e.label ? externalFootprint(meta.packId, meta.stencil, e.label, { ...e, size: s }) : null;
  if (!foot) return { ...s, external: false };
  if (foot.side === 'below') return { width: Math.max(s.width, foot.width), height: s.height + foot.gap + foot.height, external: true };
  return { width: s.width + foot.gap + foot.width, height: Math.max(s.height, foot.height), external: true };
}
const isFrameEl = (e) => e.type === 'frame' || e.isFrame === true;
const hasPosition = (e) => finite(e.x) && finite(e.y);

/**
 * Uniform-grid spatial index over boxes {x, y, width, height}: overlap tests look at the few buckets a rectangle
 * touches instead of every element, and boxes can be added as children are placed (one index per call).
 */
export function createBoxIndex(boxes) {
  const buckets = new Map();
  const key = (cx, cy) => cx * 1048576 + cy; // cell coords stay far below 2^20 (canvas is capped at 99000)
  const range = (b) => [Math.floor(b.x / INDEX_CELL), Math.floor((b.x + b.width) / INDEX_CELL), Math.floor(b.y / INDEX_CELL), Math.floor((b.y + b.height) / INDEX_CELL)];
  const add = (b) => {
    const [x0, x1, y0, y1] = range(b);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const k = key(cx, cy);
        const list = buckets.get(k);
        if (list) list.push(b);
        else buckets.set(k, [b]);
      }
    }
  };
  boxes.forEach(add);
  const overlaps = (r, gap) => {
    const [x0, x1, y0, y1] = range({ x: r.x - gap, y: r.y - gap, width: r.width + 2 * gap, height: r.height + 2 * gap });
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const list = buckets.get(key(cx, cy));
        if (!list) continue;
        for (const b of list) {
          if (r.x < b.x + b.width + gap && r.x + r.width + gap > b.x && r.y < b.y + b.height + gap && r.y + r.height + gap > b.y) return true;
        }
      }
    }
    return false;
  };
  return { add, overlaps };
}

/**
 * Nearest free top-left for `size` inside `bounds`, searching square rings outward from the bounds' center over a
 * prebuilt index (only spots fully inside the bounds are tested, within MAX_RING steps). `state` is per frame: once a
 * size found no spot, equal or larger sizes skip the search (free space only shrinks), and children that do not fit go
 * into rows below the frame (grid-fill) instead of being searched for again.
 */
function findSlot({ index, bounds, size, state }) {
  if (!(state.failedW <= size.width && state.failedH <= size.height)) {
    const origin = placeAtPoint({ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }, size, GRID);
    const inside = (p) => p.x >= bounds.x && p.y >= bounds.y && p.x + size.width <= bounds.x + bounds.width && p.y + size.height <= bounds.y + bounds.height;
    for (let r = 0; r <= MAX_RING; r++) {
      let best = null;
      let bestD = Infinity;
      for (let i = -r; i <= r; i++) {
        const step = Math.abs(i) === r ? 1 : 2 * r || 1; // full rows at the ring's top and bottom, only the two ends between
        for (let j = -r; j <= r; j += step) {
          const d = i * i + j * j;
          if (d >= bestD) continue;
          const p = { x: origin.x + i * GRID, y: origin.y + j * GRID };
          if (!inside(p) || index.overlaps({ x: p.x, y: p.y, width: size.width, height: size.height }, GRID)) continue;
          best = p;
          bestD = d;
        }
      }
      if (best) return best;
    }
    state.failedW = Math.min(state.failedW, size.width);
    state.failedH = Math.min(state.failedH, size.height);
  }
  // Overflow: rows below the frame, left to right, wrapping at the frame's width.
  const left = snap(bounds.x);
  const right = bounds.x + bounds.width;
  if (state.x === undefined) {
    state.x = left;
    state.y = snap(bounds.y + bounds.height + GRID);
    state.rowH = 0;
  }
  for (let guard = 0; guard < 100000; guard++) {
    if (state.x > left && state.x + size.width > right) {
      state.x = left;
      state.y += state.rowH + GRID;
      state.rowH = 0;
    }
    const rect = { x: state.x, y: state.y, width: size.width, height: size.height };
    if (!index.overlaps(rect, GRID)) {
      state.x = snap(state.x + size.width + GRID);
      state.rowH = Math.max(state.rowH, size.height);
      return { x: rect.x, y: rect.y };
    }
    state.x += GRID;
  }
  return { x: left, y: state.y };
}

/** A star: every link goes out of one hub, every other node is a leaf of it. @returns {{hub, leaves}|null} */
function findStar(nodes, links) {
  const hubId = links[0].sourceId;
  if (!links.every((l) => l.sourceId === hubId)) return null;
  const hub = nodes.find((n) => n.id === hubId);
  const order = [];
  for (const l of links) {
    const other = l.targetId;
    if (!order.includes(other)) order.push(other);
  }
  if (order.length !== nodes.length - 1) return null;
  const leaves = order.map((id) => nodes.find((n) => n.id === id));
  return hub && leaves.every(Boolean) ? { hub, leaves } : null;
}

/**
 * @param {{elements: object[], connections: object[], newIds: string[], direction?: 'LR'|'TB'}} input
 * @returns {object[]} a new elements array (input objects are not mutated); only unplaced new elements change
 */
export function placeNewElements({ elements, connections, newIds, direction = 'LR' }) {
  const fresh = new Set(newIds);
  const out = elements.map((e) => ({ ...e }));
  const byId = new Map(out.map((e) => [e.id, e]));
  const todo = out.filter((e) => fresh.has(e.id) && !hasPosition(e));
  if (todo.length === 0) return out;

  const todoIds = new Set(todo.map((e) => e.id));
  // Everything that already has a position (including explicitly placed new elements) is occupied space.
  const occupied = out.filter((e) => !todoIds.has(e.id) && hasPosition(e));
  const placedNow = [];
  // Built once; boxes of children placed below are added incrementally. Frames and size-less elements do not block (as in the editor).
  const index = createBoxIndex(
    occupied.filter((e) => !isFrameEl(e) && e.type !== 'frame' && e.size?.width > 0 && e.size?.height > 0).map((e) => ({ x: e.x, y: e.y, width: e.size.width, height: e.size.height }))
  );

  // 1. Children of a frame that has a box: inside the frame, nearest free spot.
  const loose = [];
  const frameState = new Map();
  for (const e of todo) {
    const frame = e.parentFrameId ? byId.get(e.parentFrameId) : null;
    if (frame && hasPosition(frame) && frame.size?.width > 0) {
      const size = sizeOf(e);
      const bounds = { x: frame.x, y: frame.y, width: sizeOf(frame).width, height: sizeOf(frame).height };
      if (!frameState.has(frame.id)) frameState.set(frame.id, { failedW: Infinity, failedH: Infinity });
      const spot = findSlot({ index, bounds, size, state: frameState.get(frame.id) });
      e.x = spot.x;
      e.y = spot.y;
      e.size = size;
      placedNow.push(e);
      if (!isFrameEl(e)) index.add({ x: e.x, y: e.y, width: size.width, height: size.height });
    } else {
      loose.push(e);
    }
  }
  if (loose.length === 0) return out;

  // 2. Layout of the remaining subgraph on uniform cells.
  // A new frame that gets new children is not a layout node: it is sized around its children afterwards.
  const wrapping = loose.filter((f) => isFrameEl(f) && loose.some((c) => c.parentFrameId === f.id));
  const wrappingIds = new Set(wrapping.map((f) => f.id));
  const laidOut = loose.filter((e) => !wrappingIds.has(e.id));
  if (laidOut.length === 0) return out;
  const looseIds = new Set(laidOut.map((e) => e.id));
  const links = connections.filter((c) => looseIds.has(c.sourceId) && looseIds.has(c.targetId) && c.sourceId !== c.targetId);
  const linked = new Set();
  for (const c of links) {
    linked.add(c.sourceId);
    linked.add(c.targetId);
  }
  const connected = laidOut.filter((e) => linked.has(e.id));
  const isolated = laidOut.filter((e) => !linked.has(e.id));

  const sizes = laidOut.map((e) => cellOf(e));
  // an element with an external label sits at the top of its cell (the label hangs below); others are centered
  const vOff = (e, s) => (cellOf(e).external ? 0 : (cellH - s.height) / 2);
  const cellW = Math.max(...sizes.map((s) => s.width));
  const cellH = Math.max(...sizes.map((s) => s.height));
  const horizontal = direction !== 'TB';
  const rel = new Map(); // id -> {x, y} (top-left of the real element, relative to the block origin)
  let blockW = 0;
  let blockH = 0;

  const star = connected.length >= 3 ? findStar(connected, links) : null;
  if (star) {
    // Hub-and-spoke: one parent with only leaf children. A tree layout would put the hub at the top of a single column;
    // instead the hub is centered on the span of its leaves, and mind-map leaves are split to both sides of it.
    const { hub, leaves } = star;
    const mindMap = hub.packId === 'mind-map';
    const stepX = cellW + LAYER_GAP;
    const column = (items, x, total) => {
      const h = items.length * cellH + (items.length - 1) * NODE_GAP;
      items.forEach((e, i) => rel.set(e.id, { x, y: (total - h) / 2 + i * (cellH + NODE_GAP) }));
    };
    if (mindMap) {
      const right = leaves.filter((_, i) => i % 2 === 0);
      const left = leaves.filter((_, i) => i % 2 === 1);
      const total = right.length * cellH + (right.length - 1) * NODE_GAP;
      column(left, 0, total);
      rel.set(hub.id, { x: stepX, y: (total - cellH) / 2 });
      column(right, 2 * stepX, total);
      blockW = 2 * stepX + cellW;
      blockH = total;
    } else if (horizontal) {
      const total = leaves.length * cellH + (leaves.length - 1) * NODE_GAP;
      rel.set(hub.id, { x: 0, y: (total - cellH) / 2 });
      column(leaves, stepX, total);
      blockW = stepX + cellW;
      blockH = total;
    } else {
      const total = leaves.length * cellW + (leaves.length - 1) * NODE_GAP;
      const stepY = cellH + LAYER_GAP;
      rel.set(hub.id, { x: (total - cellW) / 2, y: 0 });
      leaves.forEach((e, i) => rel.set(e.id, { x: i * (cellW + NODE_GAP), y: stepY }));
      blockW = total;
      blockH = stepY + cellH;
    }
    // center each real element in its cell
    for (const e of connected) {
      const s = sizeOf(e);
      const r = rel.get(e.id);
      rel.set(e.id, { x: r.x + (cellW - s.width) / 2, y: r.y + vOff(e, s) });
    }
  } else if (connected.length) {
    const cells = connected.map((e) => ({ id: e.id, x: 0, y: 0, size: { width: cellW, height: cellH } }));
    const laid = hierarchicalLayout(cells, links, {
      direction: horizontal ? 'left-right' : 'top-down',
      layerSpacing: (horizontal ? cellW : cellH) + LAYER_GAP,
      nodeSpacing: NODE_GAP,
      startX: 0,
      startY: 0,
    });
    for (const cell of laid) {
      const e = byId.get(cell.id);
      const s = sizeOf(e);
      rel.set(e.id, { x: cell.x + (cellW - s.width) / 2, y: cell.y + vOff(e, s) });
      blockW = Math.max(blockW, cell.x + cellW);
      blockH = Math.max(blockH, cell.y + cellH);
    }
  }

  if (isolated.length) {
    const cols = Math.min(MAX_GRID_COLS, Math.max(1, Math.ceil(Math.sqrt(isolated.length))));
    const top = connected.length ? blockH + LAYER_GAP : 0;
    isolated.forEach((e, i) => {
      const s = sizeOf(e);
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = col * (cellW + NODE_GAP);
      const y = top + row * (cellH + NODE_GAP);
      rel.set(e.id, { x: x + (cellW - s.width) / 2, y: y + vOff(e, s) });
      blockW = Math.max(blockW, x + cellW);
      blockH = Math.max(blockH, y + cellH);
    });
  }

  // 3. Put the block in empty space beside everything that is already on the canvas.
  const contentBounds = getContentBounds(
    [...occupied, ...placedNow].filter(hasPosition).map((e) => ({ x: e.x, y: e.y, size: sizeOf(e) }))
  );
  let dx = ORIGIN;
  let dy = ORIGIN;
  if (contentBounds) {
    const p = computeTemplatePlacement({
      bounds: { x: 0, y: 0, width: blockW, height: blockH },
      contentBounds,
      gap: LAYER_GAP,
      canvasMax: CANVAS_MAX,
    });
    dx = p.dx;
    dy = p.dy;
  }
  dx = Math.max(0, snap(dx));
  dy = Math.max(0, snap(dy));

  for (const e of laidOut) {
    const r = rel.get(e.id);
    e.x = snap(r.x + dx);
    e.y = snap(r.y + dy);
    e.size = sizeOf(e);
  }
  for (const f of wrapping) {
    const kids = laidOut.filter((c) => c.parentFrameId === f.id);
    if (kids.length === 0) continue;
    const pad = 40;
    const minX = Math.min(...kids.map((k) => k.x));
    const minY = Math.min(...kids.map((k) => k.y));
    const maxX = Math.max(...kids.map((k) => k.x + sizeOf(k).width));
    const maxY = Math.max(...kids.map((k) => k.y + sizeOf(k).height));
    f.x = Math.max(0, snap(minX - pad));
    f.y = Math.max(0, snap(minY - pad - 20));
    f.size = {
      width: finite(f.size?.width) && f.size.width > 0 ? Math.max(f.size.width, maxX + pad - f.x) : maxX + pad - f.x,
      height: finite(f.size?.height) && f.size.height > 0 ? Math.max(f.size.height, maxY + pad - f.y) : maxY + pad - f.y,
    };
  }
  return out;
}

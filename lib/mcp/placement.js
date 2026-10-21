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
import { findFreePlacement } from '../../components/diagram-studio/hooks/interaction/placement';
import { computeTemplatePlacement, getContentBounds } from '../../components/diagram-studio/utils/templatePlacement';

const GRID = 20;
const LAYER_GAP = 80;
const NODE_GAP = 40;
const ORIGIN = 80;
const CANVAS_MAX = 99000;
const DEFAULT_W = 120;
const DEFAULT_H = 80;
const MAX_GRID_COLS = 8;

const snap = (v) => Math.round(v / GRID) * GRID;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const sizeOf = (e) => ({
  width: finite(e.size?.width) && e.size.width > 0 ? e.size.width : DEFAULT_W,
  height: finite(e.size?.height) && e.size.height > 0 ? e.size.height : DEFAULT_H,
});
const isFrameEl = (e) => e.type === 'frame' || e.isFrame === true;
const hasPosition = (e) => finite(e.x) && finite(e.y);

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
  const occupied = () => out.filter((e) => !todoIds.has(e.id) && hasPosition(e));
  const placedNow = [];

  // 1. Children of a frame that has a box: inside the frame, nearest free spot.
  const loose = [];
  for (const e of todo) {
    const frame = e.parentFrameId ? byId.get(e.parentFrameId) : null;
    if (frame && hasPosition(frame) && frame.size?.width > 0) {
      const size = sizeOf(e);
      const bounds = { x: frame.x, y: frame.y, width: sizeOf(frame).width, height: sizeOf(frame).height };
      const spot = findFreePlacement({
        center: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
        size,
        elements: [...occupied(), ...placedNow],
        bounds,
        grid: GRID,
        gap: GRID,
      });
      e.x = spot.x;
      e.y = spot.y;
      e.size = size;
      placedNow.push(e);
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

  const sizes = laidOut.map(sizeOf);
  const cellW = Math.max(...sizes.map((s) => s.width));
  const cellH = Math.max(...sizes.map((s) => s.height));
  const horizontal = direction !== 'TB';
  const rel = new Map(); // id -> {x, y} (top-left of the real element, relative to the block origin)
  let blockW = 0;
  let blockH = 0;

  if (connected.length) {
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
      rel.set(e.id, { x: cell.x + (cellW - s.width) / 2, y: cell.y + (cellH - s.height) / 2 });
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
      rel.set(e.id, { x: x + (cellW - s.width) / 2, y: y + (cellH - s.height) / 2 });
      blockW = Math.max(blockW, x + cellW);
      blockH = Math.max(blockH, y + cellH);
    });
  }

  // 3. Put the block in empty space beside everything that is already on the canvas.
  const contentBounds = getContentBounds(
    [...occupied(), ...placedNow].filter(hasPosition).map((e) => ({ x: e.x, y: e.y, size: sizeOf(e) }))
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

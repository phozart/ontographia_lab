// lib/layout/freeSpace.js
// Where does a laid-out block go? Pure and deterministic. A block is a rectangle {w, h}; the answer is a grid-snapped
// top-left that overlaps no existing element or frame (the elements being moved are excluded by the caller).
//   - no preference: right of all existing content, top aligned with it (always free);
//   - preferred point: that point if free, else the nearest free spot searched in rings, else right of content;
//   - inside a frame: first free spot in the frame's content area (row-major), else below its members with the frame
//     grown to fit.
// Uses the same spatial index as the M2 placement, so 5000 existing elements cost one pass to index.

import { createBoxIndex } from '../mcp/placement';
import { FRAME_PAD, FRAME_TITLE, GRID } from './structureLayout';

export const CONTENT_GAP = 120;
const ORIGIN = 80;
const STEP = 40;
const MAX_RING = 40;
const CANVAS_MAX = 99000;
const DEFAULT = { w: 120, h: 80 };

const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const snap = (v) => Math.round(v / GRID) * GRID;

export function boxOf(el) {
  const w = finite(el.size?.width) && el.size.width > 0 ? el.size.width : DEFAULT.w;
  const h = finite(el.size?.height) && el.size.height > 0 ? el.size.height : DEFAULT.h;
  return { x: el.x, y: el.y, width: w, height: h };
}

/** Boxes of every positioned element not in `exclude`. @returns {{index, bounds: {minX,minY,maxX,maxY}|null}} */
export function occupiedSpace(elements, exclude = new Set()) {
  const boxes = [];
  let bounds = null;
  for (const e of elements) {
    if (!e || exclude.has(e.id) || !finite(e.x) || !finite(e.y)) continue;
    const b = boxOf(e);
    boxes.push(b);
    if (!bounds) bounds = { minX: b.x, minY: b.y, maxX: b.x + b.width, maxY: b.y + b.height };
    else {
      bounds.minX = Math.min(bounds.minX, b.x);
      bounds.minY = Math.min(bounds.minY, b.y);
      bounds.maxX = Math.max(bounds.maxX, b.x + b.width);
      bounds.maxY = Math.max(bounds.maxY, b.y + b.height);
    }
  }
  return { index: createBoxIndex(boxes), bounds };
}

const rightOfContent = (bounds, h) => {
  if (!bounds) return { x: ORIGIN, y: ORIGIN };
  const x = snap(bounds.maxX + CONTENT_GAP);
  const y = Math.max(0, snap(bounds.minY));
  return { x: Math.min(x, CANVAS_MAX - 1), y: Math.min(y, Math.max(0, CANVAS_MAX - h)) };
};

/**
 * @param {{space: {index, bounds}, size: {w: number, h: number}, preferred?: {x: number, y: number}}} p
 * @returns {{x: number, y: number, mode: 'exact'|'nearby'|'right-of-content'}}
 */
export function placeBlock({ space, size, preferred }) {
  const { index, bounds } = space;
  const free = (x, y) => !index.overlaps({ x, y, width: size.w, height: size.h }, GRID);
  if (preferred) {
    const px = Math.max(0, snap(preferred.x));
    const py = Math.max(0, snap(preferred.y));
    if (free(px, py)) return { x: px, y: py, mode: 'exact' };
    for (let r = 1; r <= MAX_RING; r++) {
      let best = null;
      let bestD = Infinity;
      for (let i = -r; i <= r; i++) {
        const stepJ = Math.abs(i) === r ? 1 : 2 * r;
        for (let j = -r; j <= r; j += stepJ) {
          const x = px + i * STEP;
          const y = py + j * STEP;
          const d = i * i + j * j;
          if (x < 0 || y < 0 || d >= bestD || !free(x, y)) continue;
          best = { x, y };
          bestD = d;
        }
      }
      if (best) return { ...best, mode: 'nearby' };
    }
  }
  return { ...rightOfContent(bounds, size.h), mode: 'right-of-content' };
}

/**
 * A block for the inside of `frame`. @returns {{x, y, grow: null | {width: number, height: number}}}
 * `space` must not contain the frame itself or its ancestors (they contain everything); `members` are the elements
 * already inside the frame (any depth).
 */
export function placeInFrame({ space, frame, size, members = [] }) {
  const fb = boxOf(frame);
  const region = { x: fb.x + FRAME_PAD, y: fb.y + FRAME_TITLE, w: fb.width - 2 * FRAME_PAD, h: fb.height - FRAME_TITLE - FRAME_PAD };
  const { index } = space;
  const free = (x, y) => !index.overlaps({ x, y, width: size.w, height: size.h }, GRID);
  if (size.w <= region.w && size.h <= region.h) {
    for (let y = region.y; y + size.h <= region.y + region.h; y += STEP) {
      for (let x = region.x; x + size.w <= region.x + region.w; x += STEP) {
        if (free(x, y)) return { x, y, grow: null };
      }
    }
  }
  // Below everything inside the frame (or at its content origin when it is empty), growing the frame to fit.
  const bottom = members.reduce((m, e) => (finite(e.y) ? Math.max(m, boxOf(e).y + boxOf(e).height) : m), -Infinity);
  const y = Number.isFinite(bottom) ? snap(bottom + GRID * 2) : region.y;
  const x = region.x;
  const need = { width: Math.max(fb.width, size.w + 2 * FRAME_PAD), height: Math.max(fb.height, y + size.h + FRAME_PAD - fb.y) };
  const grow = need.width > fb.width || need.height > fb.height ? { width: Math.ceil(need.width / GRID) * GRID, height: Math.ceil(need.height / GRID) * GRID } : null;
  return { x, y, grow };
}

// components/diagram-studio/canvasCulling.js
// Shared switch for viewport culling (lib/render/viewportCulling). The canvas mounts only the elements near the viewport;
// anything that clones the LIVE canvas DOM (export, Copy as image, frame/slide capture, present mode) must see what it
// captures, so it holds culling off for the duration of its work:
//
//   const release = await suspendCulling();            // the whole board
//   const release = await suspendCulling(worldRect);   // only that world rectangle (a frame / the slides) is added to what is mounted
//   try { ...clone the DOM... } finally { release(); }
//
// The promise resolves once the canvas has committed (or after a timeout). Holds are counted and composable.

import { useSyncExternalStore } from 'react';

const entries = []; // { rect: {x,y,width,height} | null }  (null = the whole board)
const listeners = new Set();
const waiters = new Set();
const SUSPEND_TIMEOUT_MS = 8000;
const IDLE = Object.freeze({ full: false, rect: null });
let snapshot = IDLE;

function unionRects(rects) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const r of rects) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height); }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

function recompute() {
  if (entries.length === 0) snapshot = IDLE;
  else if (entries.some((e) => !e.rect)) snapshot = Object.freeze({ full: true, rect: null });
  else snapshot = Object.freeze({ full: false, rect: unionRects(entries.map((e) => e.rect)) });
  listeners.forEach((l) => l());
}

/** { full: boolean, rect: world rectangle to additionally keep mounted | null }. Same object until something changes. */
export const getCullingHold = () => snapshot;
export const isCullingSuspended = () => snapshot !== IDLE;
/** True while a canvas is mounted (and so may be culling); false in tests and headless callers. */
export const isCanvasMounted = () => listeners.size > 0;
export const subscribeCulling = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

/** The canvas calls this from an effect after it rendered while a hold was active: the held content is in the DOM now. */
export function notifyCullingCommitted() {
  if (snapshot === IDLE) return;
  waiters.forEach((w) => w());
  waiters.clear();
}

const afterPaint = () => new Promise((resolve) => {
  if (typeof requestAnimationFrame !== 'function') { resolve(); return; }
  requestAnimationFrame(() => requestAnimationFrame(resolve));
});

/** @returns {Promise<() => void>} a release function (idempotent) */
export async function suspendCulling(rect = null) {
  const entry = { rect: rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.width >= 0 && rect.height >= 0 ? rect : null };
  entries.push(entry);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    const i = entries.indexOf(entry);
    if (i >= 0) entries.splice(i, 1);
    recompute();
  };
  recompute();
  // With no canvas mounted (tests, headless callers) there is nothing to wait for
  if (listeners.size > 0) {
    await new Promise((resolve) => {
      const done = () => { clearTimeout(t); waiters.delete(done); resolve(); };
      const t = setTimeout(done, SUSPEND_TIMEOUT_MS);
      waiters.add(done);
    });
    await afterPaint();
  }
  return release;
}

/** Runs `fn` with culling held off (whole board, or just `rect`). */
export async function withFullCanvas(fn, rect = null) {
  const release = await suspendCulling(rect);
  try { return await fn(); } finally { release(); }
}

/** World rectangle of an element/frame ({x, y, size}). */
export const rectOfFrame = (f) => ({ x: f.x || 0, y: f.y || 0, width: f.size?.width || 400, height: f.size?.height || 300 });

export function useCullingHold() {
  return useSyncExternalStore(subscribeCulling, getCullingHold, () => IDLE);
}

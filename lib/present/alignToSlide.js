// lib/present/alignToSlide.js
// "Align to slide" and "Centre in slide" (ADR-0007 P2 acceptance): the slide frame is the reference, so a single element can
// be aligned (the normal align tools need two or more). Left, right, top and bottom use the slide margin (96 units at a
// 1080-unit slide, scaled with the frame); the centre modes use the middle of the slide. Pure: returns position updates.

import { MARGIN } from './layouts';

export const ALIGN_MODES = Object.freeze(['left', 'center-h', 'right', 'top', 'center-v', 'bottom', 'center']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

const isLocked = (el, layers) => {
  if (el.locked === true) return true;
  const layer = Array.isArray(layers) && el.layerId !== undefined ? layers.find((l) => isObj(l) && l.id === el.layerId) : null;
  return Boolean(layer && layer.locked === true);
};

/**
 * @param {object[]} elements the elements to align (a frame in the list is ignored)
 * @param {object} frame the slide frame
 * @param {string} mode one of ALIGN_MODES
 * @param {{layers?: object[]}} [opts]
 * @returns {Array<{id: string, x?: number, y?: number}>}
 */
export function alignToSlide(elements, frame, mode, { layers } = {}) {
  if (!ALIGN_MODES.includes(mode) || !isObj(frame)) return [];
  const fx = num(frame.x, 0);
  const fy = num(frame.y, 0);
  const fw = num(frame.size?.width, 1920);
  const fh = num(frame.size?.height, 1080);
  const m = Math.round((MARGIN * fh) / 1080);
  const out = [];
  for (const el of elements) {
    if (!isObj(el) || el.id === frame.id || el.type === 'frame' || el.isFrame === true || isLocked(el, layers)) continue;
    const w = num(el.size?.width, 100);
    const h = num(el.size?.height, 60);
    const u = { id: el.id };
    if (mode === 'left') u.x = fx + m;
    else if (mode === 'right') u.x = fx + fw - m - w;
    else if (mode === 'top') u.y = fy + m;
    else if (mode === 'bottom') u.y = fy + fh - m - h;
    if (mode === 'center-h' || mode === 'center') u.x = Math.round(fx + fw / 2 - w / 2);
    if (mode === 'center-v' || mode === 'center') u.y = Math.round(fy + fh / 2 - h / 2);
    out.push(u);
  }
  return out;
}

/** The slide frame that holds every one of `ids` (explicit membership), or null (mixed frames, no frame, or a frame selected). */
export function slideFrameOf(elements, ids) {
  if (!Array.isArray(ids) || ids.length === 0) return null;
  const byId = new Map(elements.filter(isObj).map((e) => [e.id, e]));
  let parent = null;
  for (const id of ids) {
    const el = byId.get(id);
    if (!el || el.type === 'frame' || el.isFrame === true || !el.parentFrameId) return null;
    if (parent === null) parent = el.parentFrameId;
    else if (parent !== el.parentFrameId) return null;
  }
  const f = byId.get(parent);
  return f && (f.type === 'frame' || f.isFrame === true) ? f : null;
}

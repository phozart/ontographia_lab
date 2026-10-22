// lib/present/presentationModel.js
// Pure helpers over content.presentations and slide frames (ADR-0007 sections 5.1 and 5.2). Shared by the editor
// (panel, present mode, export), the MCP deck tools and the tests. No React, no I/O.

import { ASPECTS, DEFAULT_ASPECT } from './presentationSchema';

/** Canonical slide sizes in board units (decision D2 / Q-P13). */
export const SLIDE_SIZES = Object.freeze({
  '16:9': Object.freeze({ width: 1920, height: 1080 }),
  '4:3': Object.freeze({ width: 1440, height: 1080 }),
  '1:1': Object.freeze({ width: 1080, height: 1080 }),
});
export const SLIDE_GAP = 160; // space between slide frames placed side by side

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export const isFrameElement = (el) => isObj(el) && (el.type === 'frame' || el.isFrame === true);

/** The aspect stored on a frame ('16:9' | '4:3' | '1:1' | 'free'), or null for an ordinary frame. */
export const frameAspectOf = (el) => {
  const a = isObj(el) && isObj(el.data) ? el.data.aspect : null;
  return a === 'free' || ASPECTS.includes(a) ? a : null;
};

/** width / height for a fixed aspect, or null for 'free' / unknown. */
export function aspectRatio(aspect) {
  const s = SLIDE_SIZES[aspect];
  return s ? s.width / s.height : null;
}

export function frameSize(el) {
  return { width: num(el?.size?.width, 600), height: num(el?.size?.height, 400) };
}

/**
 * Ratio-locked resize: given the size the user is dragging to, return the size that keeps the aspect. The dominant
 * axis wins (the one that changed more relative to the previous size), so a corner drag feels natural.
 * @param {string} aspect
 * @param {{width: number, height: number}} proposed
 * @param {{width: number, height: number}} [previous]
 */
export function lockedSize(aspect, proposed, previous) {
  const r = aspectRatio(aspect);
  if (!r) return { width: proposed.width, height: proposed.height };
  const prev = previous || proposed;
  const dw = Math.abs(proposed.width - prev.width) / Math.max(1, prev.width);
  const dh = Math.abs(proposed.height - prev.height) / Math.max(1, prev.height);
  const byWidth = dw >= dh;
  const width = byWidth ? proposed.width : proposed.height * r;
  const height = byWidth ? proposed.width / r : proposed.height;
  return { width: Math.round(width), height: Math.round(height) };
}

/**
 * Ratio-locked resize of a slide frame while a handle is dragged. `direction` is the handle (n, ne, e, se, s, sw, w, nw);
 * the edge opposite the handle stays put. `start` and `proposed` are {x, y, width, height}. A 'free' or missing aspect
 * returns `proposed` unchanged.
 */
export function resizeWithAspect(aspect, direction, start, proposed) {
  if (!aspectRatio(aspect)) return proposed;
  const size = lockedSize(aspect, { width: proposed.width, height: proposed.height }, { width: start.width, height: start.height });
  return {
    x: direction.includes('w') ? start.x + start.width - size.width : start.x,
    y: direction.includes('n') ? start.y + start.height - size.height : start.y,
    width: size.width,
    height: size.height,
  };
}

/** The smallest size with the aspect that still contains `size` (grows, never shrinks), for fitAspect. */
export function coverSize(aspect, size) {
  const r = aspectRatio(aspect);
  if (!r) return { width: size.width, height: size.height };
  const width = Math.max(size.width, size.height * r);
  return { width: Math.round(width), height: Math.round(width / r) };
}

export function findPresentation(content, presentationId) {
  const list = Array.isArray(content?.presentations) ? content.presentations : [];
  return list.find((p) => isObj(p) && p.id === presentationId) || null;
}

/** A frame's display title: its label (the editor shows it above the frame), else a numbered fallback. */
export function frameTitleOf(el, fallback = 'Untitled frame') {
  const v = el?.label ?? el?.name ?? el?.data?.frameTitle ?? el?.properties?.frameTitle;
  const flat = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';
  return flat || fallback;
}

/**
 * Resolve a presentation against the board: every slide with its frame (or `missing`), 1-based number among ALL
 * slides, title and notes. `playable` are the slides present mode and export use: not hidden, frame exists.
 * @returns {{presentation: object, slides: Array<{n: number, slideId: string, frameId: string, frame: object|null, missing: boolean, hidden: boolean, notes: string, title: string}>, playable: Array}|null}
 */
export function resolveDeck(content, presentationId) {
  const presentation = findPresentation(content, presentationId);
  if (!presentation) return null;
  const byId = new Map((Array.isArray(content.elements) ? content.elements : []).filter(isObj).map((e) => [e.id, e]));
  const slides = (Array.isArray(presentation.slides) ? presentation.slides : []).map((s, i) => {
    const el = byId.get(s.frameId);
    const frame = el && isFrameElement(el) ? el : null;
    return {
      n: i + 1,
      slideId: s.id,
      frameId: s.frameId,
      frame,
      missing: !frame,
      hidden: s.hidden === true,
      notes: typeof s.notes === 'string' ? s.notes : '',
      title: frame ? frameTitleOf(frame, `Slide ${i + 1}`) : 'Missing slide',
    };
  });
  return { presentation, slides, playable: slides.filter((s) => !s.missing && !s.hidden) };
}

/**
 * Where a new slide frame goes: right of the deck's last existing slide frame (same top edge), else right of all
 * content, else the origin. Does not look for collisions with other content beyond that: a deck row is a row.
 * @returns {{x: number, y: number}}
 */
export function nextSlidePosition(content, presentation) {
  const elements = Array.isArray(content?.elements) ? content.elements.filter(isObj) : [];
  const byId = new Map(elements.map((e) => [e.id, e]));
  const frames = (presentation?.slides || []).map((s) => byId.get(s.frameId)).filter((e) => e && isFrameElement(e) && Number.isFinite(e.x) && Number.isFinite(e.y));
  if (frames.length) {
    const last = frames.reduce((a, b) => (b.x + frameSize(b).width > a.x + frameSize(a).width ? b : a));
    return { x: Math.round(last.x + frameSize(last).width + SLIDE_GAP), y: Math.round(last.y) };
  }
  let right = null;
  let top = 0;
  for (const e of elements) {
    if (!Number.isFinite(e.x) || !Number.isFinite(e.y)) continue;
    const r = e.x + frameSize(e).width;
    if (right === null || r > right) { right = r; top = e.y; }
  }
  return right === null ? { x: 0, y: 0 } : { x: Math.round(right + SLIDE_GAP), y: Math.round(top) };
}

export const DEFAULT_SLIDE_ASPECT = DEFAULT_ASPECT;

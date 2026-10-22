// lib/present/layouts.js
// Slide layouts (ADR-0007 section 5.2, slice P2): deterministic PLACEMENT GRIDS, not content templates. A layout names the
// slots of a slide and where they go; it never decides what the content is. Pure.
//
// Units: the grid is defined for a frame 1080 units high (the canonical 1920 x 1080 board units) with 96-unit margins
// and 48-unit gutters, and every distance scales by `frame.height / 1080`, so a 960 x 540 frame has 48 / 24 and the
// proportions (and the materialized font sizes) stay consistent.

import { MAX_BLOCKS_PER_SLIDE } from '../diagramLimits';

export const LAYOUT_NAMES = Object.freeze(['title', 'title-body', 'two-column', 'three-column', 'title-visual', 'visual-caption', 'big-number', 'blank']);
export const SLOT_NAMES = Object.freeze({
  title: ['title', 'subtitle'],
  'title-body': ['title', 'body'],
  'two-column': ['title', 'left', 'right'],
  'three-column': ['title', 'c1', 'c2', 'c3'],
  'title-visual': ['title', 'visual'],
  'visual-caption': ['visual', 'caption'],
  'big-number': ['number', 'label', 'body'],
  blank: ['full'],
});
export const LAYOUT_LABELS = Object.freeze({
  title: 'Title', 'title-body': 'Title and body', 'two-column': 'Two columns', 'three-column': 'Three columns',
  'title-visual': 'Title and visual', 'visual-caption': 'Visual and caption', 'big-number': 'Big number', blank: 'Blank',
});
export const MARGIN = 96;
export const GUTTER = 48;

const TITLE_H = 120; // a content slide's title band (two lines of the 48-unit heading preset)
const BODY_TOP = MARGIN + TITLE_H + GUTTER; // 264

/**
 * @param {string} layout one of LAYOUT_NAMES
 * @param {{width: number, height: number}} size the slide frame size in board units
 * @param {{x: number, y: number}} [at] the frame's top-left on the board; slots are returned in board coordinates
 * @returns {{slots: Array<{name: string, kind: 'title'|'content'|'visual', preset?: string, x: number, y: number, w: number, h: number, vAlign: string}>}
 *          | {ok: false, error: string}}
 */
export function layoutSlots(layout, size, at = { x: 0, y: 0 }) {
  if (!SLOT_NAMES[layout]) return { ok: false, error: `Unknown layout "${String(layout).slice(0, 40)}"; use one of ${LAYOUT_NAMES.join(', ')}` };
  const H = size.height;
  const W = size.width;
  const u = H / 1080;
  const r = (v) => Math.round(v);
  const M = r(MARGIN * u);
  const G = r(GUTTER * u);
  const cw = W - 2 * M; // content width
  const ch = H - 2 * M; // content height
  const ox = at?.x || 0;
  const oy = at?.y || 0;
  const slot = (name, kind, x, y, w, h, extra = {}) => ({ name, kind, x: r(ox + x), y: r(oy + y), w: r(w), h: r(h), vAlign: 'top', ...extra });
  const titleSlot = () => slot('title', 'title', M, M, cw, TITLE_H * u, { preset: 'heading' });
  const bodyTop = r(BODY_TOP * u);
  const bodyH = H - M - bodyTop;
  let slots;
  switch (layout) {
    case 'title':
      slots = [
        slot('title', 'title', M, 300 * u, cw, 200 * u, { preset: 'title', vAlign: 'bottom' }),
        slot('subtitle', 'content', M, 524 * u, cw, 160 * u, { preset: 'subtitle' }),
      ];
      break;
    case 'title-body':
      slots = [titleSlot(), slot('body', 'content', M, bodyTop, cw, bodyH, { preset: 'body' })];
      break;
    case 'two-column': {
      const w = Math.floor((cw - G) / 2);
      slots = [titleSlot(), slot('left', 'content', M, bodyTop, w, bodyH, { preset: 'body' }), slot('right', 'content', M + w + G, bodyTop, w, bodyH, { preset: 'body' })];
      break;
    }
    case 'three-column': {
      const w = Math.floor((cw - 2 * G) / 3);
      slots = [
        titleSlot(),
        slot('c1', 'content', M, bodyTop, w, bodyH, { preset: 'body' }),
        slot('c2', 'content', M + w + G, bodyTop, w, bodyH, { preset: 'body' }),
        slot('c3', 'content', M + 2 * (w + G), bodyTop, w, bodyH, { preset: 'body' }),
      ];
      break;
    }
    case 'title-visual':
      slots = [titleSlot(), slot('visual', 'visual', M, bodyTop, cw, bodyH, { vAlign: 'middle' })];
      break;
    case 'visual-caption': {
      const capH = r(56 * u);
      slots = [
        slot('visual', 'visual', M, M, cw, ch - capH - G, { vAlign: 'middle' }),
        slot('caption', 'content', M, H - M - capH, cw, capH, { preset: 'caption' }),
      ];
      break;
    }
    case 'big-number': {
      const bodyY = r(420 * u);
      slots = [
        slot('number', 'content', M, 150 * u, cw, 150 * u, { preset: 'number', vAlign: 'middle' }),
        slot('label', 'content', M, 308 * u, cw, 64 * u, { preset: 'subtitle' }),
        slot('body', 'content', M, bodyY, cw, H - M - bodyY, { preset: 'body' }),
      ];
      break;
    }
    default:
      slots = [slot('full', 'visual', M, M, cw, ch, { vAlign: 'middle' })];
  }
  return { slots };
}

/** The ground token of a slide on this layout: the cover sits on @surface, everything else on @bg. */
export const layoutBackground = (layout) => (layout === 'title' ? '@surface' : '@bg');

/**
 * Decor shapes of a layout (accent bar above the title; a full-height accent strip on the cover), in board coordinates.
 * @returns {Array<{x: number, y: number, w: number, h: number, radius: number}>}
 */
export function layoutDecor(layout, size, at = { x: 0, y: 0 }) {
  const lay = layoutSlots(layout, size, at);
  if (lay.ok === false) return [];
  const u = size.height / 1080;
  const title = lay.slots.find((s) => s.name === 'title');
  if (!title) return [];
  if (layout === 'title') return [{ x: at.x || 0, y: at.y || 0, w: Math.round(28 * u), h: size.height, radius: 0 }];
  return [{ x: title.x, y: title.y - Math.round(36 * u), w: Math.round(120 * u), h: Math.max(4, Math.round(8 * u)), radius: Math.max(2, Math.round(4 * u)) }];
}

/** Name of the first free slot of a layout that blocks may fill by default (the title slot belongs to the slide title). */
const fillable = (layout) => SLOT_NAMES[layout].filter((n) => n !== 'title');

/**
 * Give every block a slot. Blocks that name a slot keep it; the rest fill the remaining slots in layout order (the title
 * slot is reserved for the slide title unless a block names it).
 * @param {string} layout
 * @param {Array<{slot?: string}>} blocks
 * @returns {{ok: true, assigned: Array<object>} | {ok: false, error: string}}
 */
export function assignBlocksToSlots(layout, blocks) {
  if (!SLOT_NAMES[layout]) return { ok: false, error: `Unknown layout "${String(layout).slice(0, 40)}"; use one of ${LAYOUT_NAMES.join(', ')}` };
  if (!Array.isArray(blocks)) return { ok: false, error: 'blocks must be an array' };
  if (blocks.length > MAX_BLOCKS_PER_SLIDE) return { ok: false, error: `A slide holds at most ${MAX_BLOCKS_PER_SLIDE} blocks (got ${blocks.length})` };
  const names = SLOT_NAMES[layout];
  const used = new Set();
  for (const b of blocks) {
    if (b.slot === undefined) continue;
    if (!names.includes(b.slot)) return { ok: false, error: `Layout "${layout}" has no slot "${String(b.slot).slice(0, 40)}"; its slots are ${names.join(', ')}` };
    if (used.has(b.slot)) return { ok: false, error: `Two blocks use the slot "${b.slot}"; one block per slot` };
    used.add(b.slot);
  }
  const free = fillable(layout).filter((n) => !used.has(n));
  const assigned = [];
  for (const b of blocks) {
    if (b.slot !== undefined) {
      assigned.push(b);
      continue;
    }
    const next = free.shift();
    if (!next) return { ok: false, error: `Layout "${layout}" has no free slot left for another block (slots: ${names.join(', ')}); pick a layout with more slots or split the slide` };
    assigned.push({ ...b, slot: next });
  }
  return { ok: true, assigned };
}

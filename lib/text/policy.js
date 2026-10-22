// lib/text/policy.js
// Per-stencil text policy (ADR-0008 3.1, 4, 5): which text-fit mode, role and insets a stencil uses, and where its
// label goes (inside the shape, in a header, or outside below / to the right). Pure data plus small geometry helpers;
// shared by the canvas renderers and the server (MCP sizing), so both agree on the text area of every shape.
//
// Every stencil has an explicit policy (T1 below, T2 in lib/text/policies/*.js). Only stencils of unknown packs (a user
// pack, a future stencil) fall back to the generic policy of their `shape`.

import { MAX_WIDTH_CENTRAL, MAX_WIDTH_FACTOR, MAX_WIDTH_NARROW } from './tokens';
import { s, m, l, inset, sym, BASE, EXTERNAL, TITLE, NONE } from './policyKit';
import togaf from './policies/togaf';
import itil from './policies/itil';
import capabilityMap from './policies/capability-map';
import productDesign from './policies/product-design';
import erd from './policies/erd';
import umlClass from './policies/uml-class';
import cld from './policies/cld';

/**
 * @typedef {object} TextPolicy
 * @property {'inside'|'title'|'external'|'none'} slot  where the label is drawn
 * @property {'rect'|'ellipse'|'circle'|'ring'|'diamond'|'pill'|'sticky'} shape  decides the text-area inset
 * @property {'auto'|'auto-height'|'shrink'|'fixed'} mode  default text-fit mode
 * @property {'label'|'title'|'caption'|'meta'|'emphasis'} role
 * @property {{t:number,r:number,b:number,l:number}} inset  padding inside the shape (rect-like shapes) or around the inscribed box
 * @property {number} maxLines
 * @property {'start'|'center'|'end'} align
 * @property {'top'|'middle'|'bottom'} valign
 * @property {number} [maxWidth]   node width limit when growing (auto)
 * @property {object} [external]   {side: 'below'|'right', maxLines, minWidth, gap}
 * @property {object} [title]      {kind: 'header'|'above'|'notch'|'inner'|'lane'}
 */

// Overrides keyed `pack/stencil`. Only what differs from the generic policy of the stencil's shape.
const SPECIAL = {
  // core
  'core/rectangle': { ...BASE },
  'core/circle': { ...BASE, shape: 'circle', inset: sym(3) },
  'core/diamond': { ...BASE, shape: 'diamond', inset: sym(2) },
  'core/text-block': { ...BASE, mode: 'auto-height', maxLines: 20 },
  'core/frame': TITLE('above'),
  'core/section': TITLE('notch', 'meta'),
  'core/divider': EXTERNAL(),
  'core/table': NONE,
  'core/doc': NONE,
  // process-flow
  'process-flow/start-event': EXTERNAL(),
  'process-flow/end-event': EXTERNAL(),
  'process-flow/intermediate-event': EXTERNAL(),
  'process-flow/task': { ...BASE, inset: inset(m, m, m, m) },
  'process-flow/subprocess': { ...BASE, inset: inset(m, 12, 22, 16), align: 'start' },
  'process-flow/exclusive-gateway': { ...BASE, shape: 'diamond', inset: sym(2) },
  'process-flow/parallel-gateway': EXTERNAL(),
  'process-flow/inclusive-gateway': EXTERNAL(),
  'process-flow/merge': EXTERNAL(),
  'process-flow/pool': TITLE('lane', 'title'),
  'process-flow/lane': TITLE('lane', 'title'),
  'process-flow/data-object': EXTERNAL(),
  'process-flow/data-store': EXTERNAL(),
  'process-flow/annotation': { ...BASE, role: 'caption', align: 'start', inset: inset(s, s, s, 16), mode: 'auto-height' },
  // sticky notes
  'sticky-notes/group-box': TITLE('header'),
  'sticky-notes/section': TITLE('header'),
  'sticky-notes/circle-marker': EXTERNAL(),
  'sticky-notes/arrow-marker': EXTERNAL(),
  'sticky-notes/image-placeholder': { ...BASE, role: 'caption', mode: 'fixed', maxLines: 2, valign: 'bottom', inset: inset(s, s, s, s) },
  'sticky-notes/link-card': { ...BASE, role: 'title', mode: 'fixed', maxLines: 2, align: 'start', valign: 'top', inset: inset(m, m, 24, 32) },
  'sticky-notes/text-block': { ...BASE, mode: 'auto-height', maxLines: 20, inset: sym(s) },
  // mind map
  'mind-map/central-topic': { ...BASE, shape: 'pill', role: 'emphasis', inset: inset(s, 16, s, 16), maxWidth: MAX_WIDTH_CENTRAL },
  'mind-map/main-topic': { ...BASE, shape: 'pill', role: 'title', inset: inset(s, 16, s, 16) },
  'mind-map/callout': { ...BASE, inset: inset(m, m, m, 10 + m) },
  'mind-map/boundary': TITLE('inner', 'caption'),
  'mind-map/summary': { ...EXTERNAL('right'), align: 'start', valign: 'middle', external: { side: 'right', maxLines: 3, minWidth: 120, gap: 15 } },
};

// T2 packs: one file per pack (lib/text/policies/), merged under the `pack/` prefix
const prefixed = (pack, table) => Object.fromEntries(Object.entries(table).map(([id, p]) => [`${pack}/${id}`, p]));
Object.assign(
  SPECIAL,
  prefixed('togaf', togaf),
  prefixed('itil', itil),
  prefixed('capability-map', capabilityMap),
  prefixed('product-design', productDesign),
  prefixed('erd', erd),
  prefixed('uml-class', umlClass),
  prefixed('cld', cld),
);

/** The `pack/stencil` keys that have an explicit policy (a test asserts every migrated stencil is listed). */
export const explicitPolicyKeys = () => new Set(Object.keys(SPECIAL));

const STICKY_RE =/^sticky-/;
const PILL_RE = /^(sub-topic|floating-topic|topic-)/;

/**
 * @param {string} packId
 * @param {{id: string, shape?: string, defaultSize?: {width: number, height: number}, isContainer?: boolean}} stencil
 * @returns {TextPolicy & {minW: number, minH: number, maxW: number}}
 */
const policyCache = new Map();
export function policyFor(packId, stencil) {
  const ck = `${packId}/${stencil?.id}|${stencil?.shape}|${stencil?.defaultSize?.width}x${stencil?.defaultSize?.height}|${stencil?.isContainer ? 1 : 0}`;
  let hit = policyCache.get(ck);
  if (!hit) {
    hit = Object.freeze(computePolicy(packId, stencil));
    policyCache.set(ck, hit);
  }
  return hit;
}

function computePolicy(packId, stencil) {
  const id = stencil?.id || '';
  const key = `${packId}/${id}`;
  const def = stencil?.defaultSize || { width: 120, height: 80 };
  let p = SPECIAL[key];
  if (!p && packId === 'sticky-notes' && STICKY_RE.test(id)) p = { ...BASE, shape: 'sticky', mode: 'shrink', inset: sym(l, l), maxLines: 12 };
  if (!p && packId === 'mind-map' && PILL_RE.test(id)) p = { ...BASE, shape: 'pill', inset: inset(s, 16, s, 16) };
  if (!p) {
    // generic policy of the shape (stencils of packs not yet migrated)
    const shape = stencil?.shape;
    if (stencil?.isContainer) p = TITLE('header');
    else if (shape === 'circle' || shape === 'ellipse') p = { ...BASE, shape: shape === 'circle' ? 'circle' : 'ellipse', inset: sym(3) };
    else if (shape === 'diamond') p = { ...BASE, shape: 'diamond', inset: sym(2) };
    else if (shape === 'line' || shape === 'table' || shape === 'doc' || shape === 'frame' || shape === 'section') p = NONE;
    else p = BASE;
  }
  const maxW = p.maxWidth || (def.width <= 140 ? MAX_WIDTH_NARROW : Math.round(def.width * MAX_WIDTH_FACTOR));
  return { ...p, minW: def.width, minH: def.height, maxW: Math.max(maxW, def.width) };
}

/** Is this stencil one whose box follows its text (auto / auto-height) or one that keeps its size (everything else)? */
export const growsWithText = (policy) => policy.slot === 'inside' && (policy.mode === 'auto' || policy.mode === 'auto-height' || policy.mode === 'shrink');

// Text rectangle as a fraction of the shape: [width, height]. An ellipse holds a 0.78 x 0.58 rectangle (the corner sits on the
// outline: 0.39^2/0.25 + 0.29^2/0.25 = 0.99), which is wider than the inscribed square so short words stay whole (M1).
// ring marker: inner radius = r - RING_MARGIN, the text square inscribed in it
const RING_MARGIN = 8;
const ringSide = (d) => Math.max(1, Math.SQRT2 * (d / 2 - RING_MARGIN));

const INSCRIBE = { rect: [1, 1], pill: [1, 1], sticky: [1, 1], ellipse: [0.78, 0.58], circle: [0.78, 0.58], diamond: [0.5, 0.5] };

/** The text rectangle (node coordinates) of an inside-slot label for a node of `size`. */
export function textBoxOf(policy, size) {
  const W = size.width;
  const H = size.height;
  if (policy.shape === 'ring') {
    // a ring marker (CLD loops) is a CIRCLE of the shorter side whatever the stored box: the text is the square inscribed in
    // the ring's inner edge (circle radius minus the arrow, its stroke and a margin), centered in the box
    const side = ringSide(Math.min(W, H));
    const i = policy.inset;
    return { x: (W - side) / 2 + i.l, y: (H - side) / 2 + i.t, width: Math.max(1, side - i.l - i.r), height: Math.max(1, side - i.t - i.b) };
  }
  const [fw, fh] = INSCRIBE[policy.shape] || [1, 1];
  const iw = W * fw;
  const ih = H * fh;
  const ix = (W - iw) / 2;
  const iy = (H - ih) / 2;
  const i = policy.inset;
  const x = ix + i.l;
  const y = iy + i.t;
  return { x, y, width: Math.max(1, iw - i.l - i.r), height: Math.max(1, ih - i.t - i.b) };
}

/** The exact inverse of textBoxOf: the node size whose text rectangle is `text` (width, height). */
export function boxForText(policy, text) {
  if (policy.shape === 'ring') {
    const i0 = policy.inset;
    const need = Math.max(text.width + i0.l + i0.r, text.height + i0.t + i0.b);
    const d = 2 * (need / Math.SQRT2 + RING_MARGIN);
    return { width: d, height: d };
  }
  const [fw, fh] = INSCRIBE[policy.shape] || [1, 1];
  const i = policy.inset;
  return { width: (text.width + i.l + i.r) / fw, height: (text.height + i.t + i.b) / fh };
}

/** The label rectangle of an external label, in node coordinates (can lie outside [0,W]x[0,H]). */
export function externalBoxOf(policy, size) {
  const e = policy.external;
  const width = Math.min(Math.max(size.width * 2, e.minWidth), e.maxWidth || Infinity); // maxWidth: wide thin shapes (a fork bar)
  if (e.side === 'right') return { x: size.width + e.gap, y: -size.height / 2, width, height: size.height * 2 };
  return { x: (size.width - width) / 2, y: size.height + e.gap, width, height: 0 };
}

/**
 * The one-line title rectangle of a container-like stencil (node coordinates; `rotate` degrees about the box center).
 * header: strip across the top; above: chip above the frame; notch: sits on the top border; inner: top-left inside;
 * lane: rotated -90 inside the 30 px swimlane header.
 */
export function titleBoxOf(policy, size, fontSize = 14) {
  const W = size.width;
  const H = size.height;
  switch (policy.title?.kind) {
    case 'above': {
      const h = Math.ceil(fontSize * 1.25) + 4;
      return { x: 8, y: -(h + 4), width: Math.max(20, W - 16), height: h };
    }
    case 'notch':
      return { x: 20, y: -9, width: Math.max(20, W - 40), height: 16 };
    case 'inner':
      return { x: 12, y: 6, width: Math.max(20, W - 24), height: 18 };
    case 'lane': {
      const w = Math.max(20, H - 16);
      return { x: (30 - w) / 2, y: (H - 30) / 2, width: w, height: 30, rotate: -90, cx: 15, cy: H / 2 };
    }
    default: {
      // `title.indent`: px reserved at the left of the strip for an icon drawn before the title
      const indent = policy.title?.indent || 0;
      return { x: 12 + indent, y: 0, width: Math.max(20, W - 24 - indent), height: 32 };
    }
  }
}

/** An external-below policy for any stencil: used when a label that normally sits inside cannot fit (small legacy sizes). */
export function externalPolicy(stencil) {
  const def = stencil?.defaultSize || { width: 120, height: 80 };
  return Object.freeze({ ...EXTERNAL('below'), minW: def.width, minH: def.height, maxW: def.width });
}

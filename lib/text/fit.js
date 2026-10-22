// lib/text/fit.js
// Element-level text fitting (ADR-0008 3.3, 4, 5): what size a node needs for its label, and how a stored element's
// label is laid out inside its stored box. Pure and isomorphic: the canvas renderers, the editor, the MCP sizing
// (add_element, update_element, map_structure) and the fit_to_text op all call these, so they agree to the pixel.
// Rendering never writes data: layoutForElement only reads the stored box.

import { layoutText } from './layout';
import { policyFor, growsWithText, textBoxOf, boxForText, externalBoxOf, titleBoxOf } from './policy';
import { MIN_SIZE, ROLES, TEXT_FIT_MODES, roleOf } from './tokens';

export const labelOf = (element) => (element && (element.label || element.name)) || '';

const num = (v) => {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : null;
};

/** The font setting of an element's label: the stencil's role unless the element overrides size, weight or family. */
export function fontOf(element, policy) {
  const role = roleOf(policy.role);
  const size = num(element?.fontSize);
  const weight = element?.fontWeight;
  return {
    family: element?.fontFamily || null,
    size: Math.max(MIN_SIZE, size ?? role.size),
    weight: weight === undefined || weight === null || weight === '' ? role.weight : weight === 'normal' ? 400 : weight === 'bold' ? 700 : weight,
    lineHeight: role.lineHeight,
  };
}

const ALIGN = { left: 'start', start: 'start', center: 'center', right: 'end', end: 'end' };
const VALIGN = { top: 'top', 'flex-start': 'top', center: 'middle', middle: 'middle', bottom: 'bottom', 'flex-end': 'bottom' };
export const alignOf = (element, policy) => ALIGN[element?.textAlign] || policy.align;
export const valignOf = (element, policy) => VALIGN[element?.verticalAlign] || policy.valign;

/** The text-fit mode of an element: its own `textFit`, else the stencil default. */
export function modeOf(element, policy) {
  return TEXT_FIT_MODES.includes(element?.textFit) ? element.textFit : policy.mode;
}

const sizeOf = (element, policy) => ({
  width: Number.isFinite(element?.size?.width) ? element.size.width : policy.minW,
  height: Number.isFinite(element?.size?.height) ? element.size.height : policy.minH,
});

/**
 * Render-time layout of an element's label in its stored box (inside slot). `fixed` keeps the font; everything else
 * wraps, shrinks down to 11 px and then clamps with the overflow indicator. Returns { layout, box } where `box` is the
 * text rectangle in node coordinates.
 */
export function layoutForElement(element, policy, text = labelOf(element)) {
  const size = sizeOf(element, policy);
  const box = textBoxOf(policy, size);
  const mode = modeOf(element, policy) === 'fixed' ? 'fixed' : 'shrink';
  const layout = layoutText({
    text,
    font: fontOf(element, policy),
    box: { width: box.width, height: box.height },
    mode,
    limits: { maxLines: policy.maxLines },
    align: alignOf(element, policy),
    valign: valignOf(element, policy),
  });
  return { layout, box };
}

/** Layout of an external label (below or beside a small marker shape). `box` is in node coordinates. */
export function layoutForExternal(element, policy, text = labelOf(element)) {
  const size = sizeOf(element, policy);
  const e = externalBoxOf(policy, size);
  const font = fontOf(element, policy);
  const lh = font.size * font.lineHeight;
  const maxLines = policy.external.maxLines;
  const height = maxLines * lh;
  const layout = layoutText({
    text,
    font,
    box: { width: e.width, height },
    mode: 'fixed',
    limits: { maxLines },
    align: policy.align === 'start' ? 'start' : alignOf(element, policy),
    valign: policy.valign,
  });
  const box = { x: e.x, y: policy.external.side === 'right' ? size.height / 2 - height / 2 : e.y, width: e.width, height };
  return { layout, box };
}

/** Layout of a one-line title (frame, section, lane, group header): ellipsis + indicator when it does not fit. */
export function layoutForTitle(element, policy, text = labelOf(element)) {
  const size = sizeOf(element, policy);
  const box = titleBoxOf(policy, size);
  const font = fontOf(element, policy);
  const layout = layoutText({
    text,
    font,
    box: { width: box.width, height: box.height },
    mode: 'fixed',
    limits: { maxLines: 1 },
    align: 'start',
    valign: 'middle',
  });
  return { layout, box };
}

const ceil10 = (v, floor) => (v <= floor ? floor : Math.ceil(v / 10) * 10);

/**
 * The size a node needs for `text`, never smaller than the stencil's default size. Modes:
 *   auto        width grows from the default width up to maxWidth, then wraps; height grows
 *   auto-height width stays the default; height grows
 *   shrink      the default size when the text fits at 11 px or more, else grows like auto (the paper only grows at creation)
 *   fixed       the default size
 * @param {string} packId
 * @param {object} stencil catalog stencil ({id, shape, defaultSize, ...})
 * @param {string} text
 * @param {{mode?: string, fontSize?: number, fontWeight?: *, fontFamily?: string}} [element] style overrides
 * @returns {{width: number, height: number, mode: string, grew: boolean}}
 */
export function sizeForText(packId, stencil, text, element = {}) {
  const policy = policyFor(packId, stencil);
  const def = { width: policy.minW, height: policy.minH };
  if (!growsWithText(policy) || !text || !String(text).trim()) return { ...def, mode: policy.mode, grew: false };
  const mode = modeOf(element, policy);
  if (mode === 'fixed') return { ...def, mode, grew: false };
  const font = fontOf(element, policy);
  const area0 = textBoxOf(policy, def);
  const base = { text: String(text), font, align: policy.align, valign: policy.valign };
  const limits = { maxLines: policy.maxLines };
  let out = null;
  if (mode === 'shrink') {
    const fit = layoutText({ ...base, box: { width: area0.width, height: area0.height }, mode: 'shrink', limits });
    if (!fit.overflow && fit.breaks.emergency === 0) return { ...def, mode, grew: false };
  }
  if (mode === 'auto-height') {
    const l = layoutText({ ...base, box: { width: area0.width, height: area0.height }, mode: 'auto-height', limits });
    out = boxForText(policy, { width: area0.width, height: l.box.height });
  } else {
    const maxText = Math.max(1, policy.maxW - policy.inset.l - policy.inset.r); // the text may be as wide as for a plain rect; inscribed shapes grow around it
    const l = layoutText({ ...base, box: { width: area0.width, height: area0.height }, mode: 'auto', limits: { ...limits, minWidth: area0.width, maxWidth: Math.max(maxText, area0.width) } });
    out = boxForText(policy, l.box);
  }
  let width = ceil10(out.width, def.width);
  let height = ceil10(out.height, def.height);
  if (policy.shape === 'circle') {
    const d = Math.max(width, height);
    width = d;
    height = d;
  }
  return { width, height, mode, grew: width > def.width || height > def.height };
}

/** Does this element's label have a layout footprint outside its box (external label)? Returns the extra size or null. */
export function externalFootprint(packId, stencil, text, element = {}) {
  const policy = policyFor(packId, stencil);
  if (policy.slot !== 'external' || !text) return null;
  const el = { ...element, size: element.size || { width: policy.minW, height: policy.minH } };
  const { layout, box } = layoutForExternal(el, policy, text);
  const lines = layout.lines.length;
  const labelH = lines * layout.lineHeight;
  const labelW = Math.min(box.width, Math.ceil(layout.width));
  return { side: policy.external.side, gap: policy.external.gap, width: labelW, height: labelH };
}

export { policyFor, growsWithText, textBoxOf, boxForText, ROLES };

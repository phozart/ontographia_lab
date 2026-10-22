// lib/text/fit.js
// Element-level text fitting (ADR-0008 3.3, 4, 5): what size a node needs for its label, and how a stored element's
// label is laid out inside its stored box. Pure and isomorphic: the canvas renderers, the editor, the MCP sizing
// (add_element, update_element, map_structure) and the fit_to_text op all call these, so they agree to the pixel.
// Rendering never writes data: layoutForElement only reads the stored box.

import { layoutText } from './layout';
import { resolveFace, measureText } from './fonts';
import { graphemes } from './segment';
import { policyFor, growsWithText, textBoxOf, boxForText, externalBoxOf, titleBoxOf } from './policy';
import { MIN_SIZE, MONO_FAMILY, ROLES, SLACK_PX, SLACK_RATIO, TEXT_FIT_MODES, roleOf } from './tokens';

const EXTERNAL_MAX_WIDTH = 240;

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
    size: Math.min(512, Math.max(MIN_SIZE, size ?? role.size)),
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
  const font = fontOf(element, policy);
  const mode = modeOf(element, policy) === 'fixed' ? 'fixed' : 'shrink';
  const base = { text, font, mode, align: alignOf(element, policy), valign: valignOf(element, policy) };
  const run = (b, maxLines) => layoutText({ ...base, box: { width: b.width, height: b.height }, limits: { maxLines } });
  const box = textBoxOf(policy, size);
  // Ring markers (CLD loops, review round 3): shrink to the 11 px minimum BEFORE hyphenating, and never hyphenate a word that
  // fits on a line of the ring. The square inscribed in the ring is tried first; when its text would break a word, a wide
  // two-line chord (the middle of the circle is wider than the inscribed square) is tried, still with the overflow badge.
  if (policy.ring && policy.shape === 'ring') {
    const sq = run(box, policy.maxLines);
    const hyphenated = (l) => l.lines.some((x) => x.hyphen);
    if (!hyphenated(sq)) return { layout: sq, box };
    const R = Math.min(size.width, size.height) / 2 - 6.5; // inner edge of the arrow ring
    const lh2 = MIN_SIZE * roleOf(policy.role).lineHeight;
    const h2 = Math.ceil(2 * lh2);
    const w2 = Math.floor(2 * Math.sqrt(Math.max(1, R * R - (h2 / 2) * (h2 / 2))));
    if (w2 > box.width) {
      const wide = { x: (size.width - w2) / 2, y: (size.height - h2) / 2, width: w2, height: h2 };
      const wl = run(wide, 2);
      if (!hyphenated(wl)) return { layout: wl, box: wide };
    }
    return { layout: sq, box };
  }
  // Circles and ellipses (ADR-0008, M1): a single line may use about 0.85 of the width (the chord at the middle line is much
  // wider than the inscribed square), so a short word stays whole instead of hyphenating in a 44 px square.
  if ((policy.shape === 'circle' || policy.shape === 'ellipse') && !policy.ring && !/[\r\n]/.test(text)) { // `ring`: a ring or arrow runs along the outline (CLD loop markers), so the wide chord is not free
    const wideW = size.width * 0.85;
    const wide = { x: (size.width - wideW) / 2, y: size.height * 0.25, width: wideW, height: size.height * 0.5 };
    const lw = run(wide, 1);
    const wideOk = (l, minFont) => !l.overflow && l.lines.length <= 1 && l.breaks.emergency === 0 && l.fontSize >= minFont;
    if (wideOk(lw, Math.min(font.size, 12))) return { layout: lw, box: wide };
    const li = run(box, policy.maxLines);
    if (!li.overflow && li.breaks.emergency === 0) return { layout: li, box };
    // a lone word that only fits shrunk beats a hyphenated word (prefer shrink, then the overflow badge)
    if (wideOk(lw, 0)) return { layout: lw, box: wide };
    return { layout: li, box };
  }
  return { layout: run(box, policy.maxLines), box };
}

/**
 * Layout of an external label (below or beside a small marker shape). `box` is in node coordinates. The label wraps at
 * max(2w, 120) and at most 3 lines; a single word wider than that widens the label (up to 240 px) instead of being
 * broken, so Latin words stay whole (ADR-0008 6.3). Only a word beyond 240 px is broken with a hyphen.
 */
export function layoutForExternal(element, policy, text = labelOf(element)) {
  const size = sizeOf(element, policy);
  const e = externalBoxOf(policy, size);
  const font = fontOf(element, policy);
  const lh = font.size * font.lineHeight;
  const maxLines = policy.external.maxLines;
  const height = maxLines * lh;
  const run = (width) => layoutText({
    text,
    font,
    box: { width, height },
    mode: 'fixed',
    limits: { maxLines },
    align: policy.align === 'start' ? 'start' : alignOf(element, policy),
    valign: policy.valign,
  });
  let width = e.width;
  let layout = run(width);
  while (layout.breaks.emergency > 0 && width < EXTERNAL_MAX_WIDTH) {
    width = Math.min(EXTERNAL_MAX_WIDTH, width + 10);
    layout = run(width);
  }
  const x = policy.external.side === 'right' ? e.x : size.width / 2 - width / 2;
  const box = { x, y: policy.external.side === 'right' ? size.height / 2 - height / 2 : e.y, width, height };
  return { layout, box };
}

/** Layout of a one-line title (frame, section, lane, group header): ellipsis + indicator when it does not fit. */
export function layoutForTitle(element, policy, text = labelOf(element)) {
  const size = sizeOf(element, policy);
  const font = fontOf(element, policy);
  // frames on slide-sized boards scale their title with the frame: max(14, frameHeight / 1080 x 28) (ADR-0008 7)
  if (policy.title?.kind === 'above' && !Number.isFinite(num(element?.fontSize))) font.size = Math.max(font.size, Math.round((size.height / 1080) * 28));
  const box = titleBoxOf(policy, size, font.size);
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

/**
 * Layout of one named text slot of a node (a compartment, a header strip, a stereotype line, a badge text): the pack gives
 * the slot rectangle (node coordinates) and a role; the shared layout does the rest. `fixed` keeps the role size and clamps
 * with the overflow indicator, `shrink` steps down to 11 px first. `own: true` takes the element's font overrides (the main
 * label of the node); other slots never follow them. Returns { layout, box } like the other layoutFor* functions.
 * @param {object} element
 * @param {{text: string, box: {x: number, y: number, width: number, height: number}, role?: string, mode?: 'fixed'|'shrink',
 *          maxLines?: number, align?: 'start'|'center'|'end', valign?: 'top'|'middle'|'bottom', own?: boolean, mono?: boolean,
 *          rotate?: number, size?: number, weight?: number}} spec
 */
export function layoutForSlot(element, spec) {
  const role = roleOf(spec.role);
  const base = spec.own ? fontOf(element, { role: spec.role || 'label' }) : { family: null, size: role.size, weight: role.weight, lineHeight: role.lineHeight };
  const font = { ...base, lineHeight: role.lineHeight };
  if (Number.isFinite(spec.size)) font.size = Math.max(MIN_SIZE, spec.size);
  if (spec.weight !== undefined) font.weight = spec.weight;
  if (spec.mono) font.family = MONO_FAMILY;
  const layout = layoutText({
    text: spec.text === undefined || spec.text === null ? '' : String(spec.text),
    font,
    box: { width: spec.box.width, height: spec.box.height },
    mode: spec.mode === 'shrink' ? 'shrink' : 'fixed',
    limits: { maxLines: spec.maxLines || Math.max(1, Math.floor(spec.box.height / (font.size * font.lineHeight) + 0.01)) },
    align: spec.align || 'center',
    valign: spec.valign || 'middle',
  });
  const box = spec.rotate ? { ...spec.box, rotate: spec.rotate } : spec.box;
  return { layout, box };
}

/**
 * Layout of a member list (UML attributes and operations, enum values, ERD fields): one line per item, a long item is cut
 * with an ellipsis (a member never continues on a second line, so two members cannot be confused), and items beyond the
 * box height are hidden with the overflow indicator; the last visible line then ends in an ellipsis. The result has the
 * shape of a TextLayout (TextBlock draws it): `text` is every item, one per line, for the badge title.
 * @param {object} element
 * @param {{items: string[], box: {x: number, y: number, width: number, height: number}, role?: string, mono?: boolean,
 *          align?: 'start'|'center'|'end'}} spec
 */
export function layoutForList(element, spec) {
  const role = roleOf(spec.role || 'meta');
  const mono = spec.mono !== false;
  const font = { family: mono ? MONO_FAMILY : null, size: role.size, weight: role.weight, lineHeight: role.lineHeight };
  const lh = role.size * role.lineHeight;
  const align = spec.align || 'start';
  const items = (spec.items || []).map((t) => (t === undefined || t === null ? '' : String(t).replace(/[\r\n]+/g, ' ')));
  const rows = Math.max(1, Math.floor(spec.box.height / lh + 0.01));
  const face = resolveFace(font.family, font.weight);
  const fitsW = (t) => measureText(t, face, font.size) * (1 + SLACK_RATIO) + SLACK_PX <= spec.box.width;
  // a member is cut by characters (not at a space), so `- name: String` keeps as much of its name as fits
  const cut = (t) => {
    if (fitsW(t)) return t;
    const gs = graphemes(t);
    let n = gs.length - 1;
    while (n > 0 && !fitsW(`${gs.slice(0, n).join('').trimEnd()}…`)) n -= 1;
    return `${gs.slice(0, n).join('').trimEnd()}…`;
  };
  const one = (text) => layoutText({ text, font, box: { width: spec.box.width, height: lh }, mode: 'fixed', limits: { maxLines: 1 }, align, valign: 'top' });
  const shown = items.slice(0, rows);
  const hiddenItems = items.length - shown.length;
  let hiddenChars = 0;
  let clipped = false;
  const lines = [];
  let widest = 0;
  shown.forEach((text, i) => {
    const last = i === shown.length - 1 && hiddenItems > 0;
    const whole = last ? `${text}…` : text;
    const shownText = cut(whole);
    const l = one(shownText);
    if (shownText !== whole) {
      clipped = true;
      hiddenChars += Math.max(1, graphemes(whole).length - graphemes(shownText).length + 1);
    }
    if (last) {
      clipped = true;
      hiddenChars += items.slice(rows).join('').length;
    }
    const first = l.lines[0];
    const top = i * lh;
    const base = first ? first.y - first.top : lh * 0.8;
    const width = first ? first.width : 0;
    widest = Math.max(widest, width);
    lines.push({ text: first ? first.text : '', x: first ? first.x : 0, y: top + base, top, width, dir: 'ltr', hyphen: false });
  });
  const overflow = hiddenItems > 0 || clipped ? { hiddenLines: hiddenItems, hiddenChars } : false;
  return {
    layout: {
      lines,
      width: Math.ceil(widest),
      height: lines.length * lh,
      box: { width: spec.box.width, height: spec.box.height },
      fontSize: role.size,
      lineHeight: lh,
      overflow,
      breaks: { emergency: 0 },
      mode: 'fixed',
      align,
      valign: 'top',
      text: items.join('\n'),
      weight: role.weight,
    },
    box: spec.box,
  };
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
  const mode0 = modeOf(element, policy);
  // an explicit width (op.w, or the width a person dragged) is kept: the height then follows the text
  const givenW = Number.isFinite(element?.size?.width) ? element.size.width : null;
  if (givenW !== null && mode0 === 'auto-height') def.width = givenW;
  if (!growsWithText(policy) || !text || !String(text).trim()) return { ...def, mode: policy.mode, grew: false };
  const mode = mode0;
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
  } else if (policy.shape === 'circle' || policy.shape === 'ellipse' || policy.shape === 'diamond' || policy.shape === 'ring') {
    // inscribed shapes grow PROPORTIONALLY (a diamond stays a diamond, a circle a circle): the smallest scale of the
    // default size whose text rectangle holds the text at full size, with no broken word
    out = null;
    for (let k = 1; k <= 8; k += 0.1) {
      const w = Math.round(def.width * k);
      const h = Math.round(def.height * k);
      const { layout: l } = layoutForElement({ ...element, textFit: 'auto', size: { width: w, height: h } }, policy, String(text));
      if (!l.overflow && l.breaks.emergency === 0 && l.fontSize >= font.size - 1) {
        out = { width: w, height: h };
        break;
      }
    }
    if (!out) out = { width: Math.round(def.width * 8), height: Math.round(def.height * 8) };
  } else {
    const maxText = Math.max(1, policy.maxW - policy.inset.l - policy.inset.r); // the text may be as wide as for a plain rect
    const l = layoutText({ ...base, box: { width: area0.width, height: area0.height }, mode: 'auto', limits: { ...limits, minWidth: area0.width, maxWidth: Math.max(maxText, area0.width) } });
    out = boxForText(policy, l.box);
  }
  let width = mode === 'auto-height' ? def.width : ceil10(out.width, def.width);
  let height = ceil10(out.height, def.height);
  return { width, height, mode, grew: width > def.width || height > def.height };
}

/**
 * The size of a NEW element (MCP add_element, map_structure): explicit w/h win; otherwise the text decides.
 * Only `w` given means the width is kept and the height follows the text.
 */
export function sizeForNewElement(packId, stencil, label, { w, h, textFit } = {}) {
  if (w !== undefined && h !== undefined) return { width: w, height: h };
  const policy = policyFor(packId, stencil);
  const mode = TEXT_FIT_MODES.includes(textFit) ? textFit : policy.mode;
  const el = { textFit: mode };
  if (w !== undefined) {
    if (mode === 'auto') el.textFit = 'auto-height';
    el.size = { width: w };
  }
  const fit = sizeForText(packId, stencil, label, el);
  return { width: w !== undefined ? w : fit.width, height: h !== undefined ? h : fit.height };
}

/** Editor creation: the stencil's default label decides the size (never below the default size). */
export function sizeForStencilLabel(packId, stencil, label, fallback = { width: 120, height: 60 }) {
  if (!stencil) return { ...fallback };
  const def = stencil.defaultSize || fallback;
  if (!label) return { width: def.width, height: def.height };
  const r = sizeForNewElement(packId, { ...stencil, defaultSize: def }, label, {});
  return { width: r.width, height: r.height };
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

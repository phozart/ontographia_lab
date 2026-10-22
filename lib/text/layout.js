// lib/text/layout.js
// layoutText(input) -> TextLayout (ADR-0008 3.1). Pure and deterministic: the result depends only on the input and the
// committed font tables, so Node (MCP sizing) and the browser (canvas) produce deep-equal output. Renderers draw the
// returned lines and never re-wrap. Results are memoized in an LRU keyed by the normalized input.

import { MAX_LINES, MIN_SIZE, SHRINK_STEP, SLACK_PX, SLACK_RATIO, ROLES } from './tokens';
import { resolveFace, graphemeAdvance } from './fonts';
import { detectDir, toAtoms } from './segment';

const MAX_TEXT = 5000; // hard ceiling on laid-out text (labels are capped at 500 by the ops applier)
const CACHE_MAX = 10000;
const ELLIPSIS = '\u{2026}';

const cache = new Map();
const stats = { calls: 0, hits: 0 };
export const layoutCacheStats = () => ({ ...stats, size: cache.size });
export const clearLayoutCache = () => {
  cache.clear();
  stats.calls = 0;
  stats.hits = 0;
};

const need = (w) => w * (1 + SLACK_RATIO) + SLACK_PX; // width a line really needs, with the glyph-drift slack
const round2 = (n) => Math.round(n * 100) / 100;

function normalize(input) {
  const font = input.font || {};
  const box = input.box || {};
  const limits = input.limits || {};
  const mode = input.mode || 'fixed';
  return {
    text: typeof input.text === 'string' ? input.text.slice(0, MAX_TEXT) : '',
    family: font.family || null,
    size: Number.isFinite(font.size) ? font.size : ROLES.label.size,
    weight: font.weight ?? ROLES.label.weight,
    lh: Number.isFinite(font.lineHeight) ? font.lineHeight : ROLES.label.lineHeight,
    w: Number.isFinite(box.width) ? box.width : 0,
    h: Number.isFinite(box.height) ? box.height : 0,
    mode,
    minWidth: Number.isFinite(limits.minWidth) ? limits.minWidth : 0,
    maxWidth: Number.isFinite(limits.maxWidth) ? limits.maxWidth : 0,
    maxLines: Number.isFinite(limits.maxLines) ? limits.maxLines : MAX_LINES,
    minSize: Number.isFinite(limits.minSize) ? limits.minSize : MIN_SIZE,
    align: input.align || 'center',
    valign: input.valign || 'middle',
    dir: input.dir || 'auto',
  };
}

const keyOf = (n) => `${n.size}|${n.weight}|${n.lh}|${n.w}|${n.h}|${n.mode}|${n.minWidth}|${n.maxWidth}|${n.maxLines}|${n.minSize}|${n.align}|${n.valign}|${n.dir}|${n.family || ''}|${n.text}`;

/** Atoms of every paragraph with widths in 1/1000 em, computed once per call. */
function prepare(text, face) {
  const paragraphs = text.split(/\r\n|\r|\n/);
  const hyphenU = graphemeAdvance('-', face);
  const spaceU = graphemeAdvance(' ', face);
  const paras = paragraphs.map((p) => {
    const atoms = toAtoms(p).map((a) => {
      let u = 0;
      for (const g of a.gs) u += graphemeAdvance(g, face);
      return { gs: a.gs, space: a.space, shy: a.shy, u };
    });
    return { atoms, dir: detectDir(p) };
  });
  return { paras, hyphenU, spaceU, face };
}

/** Greedy line filling of one paragraph at `size` into `availW`. Returns lines [{gs, u, hyphen}] and the emergency count. */
function breakParagraph(para, prep, size, availW) {
  const unit = size / 1000;
  const fits = (u) => need(u * unit) <= availW;
  const lines = [];
  let emergency = 0;
  let cur = null; // {gs: [], u, lastSpace: bool, lastShy: bool}
  const closeLine = (withHyphen) => {
    if (!cur) return;
    const gs = cur.gs.slice();
    let u = cur.u;
    if (withHyphen) {
      gs.push('-');
      u += prep.hyphenU;
    }
    lines.push({ gs, u, hyphen: !!withHyphen });
    cur = null;
  };
  const pushAtomWhole = (a) => {
    // append to cur (cur may be null: start a line)
    if (!cur) cur = { gs: [], u: 0, lastSpace: false, lastShy: false };
    else if (cur.lastSpace) {
      cur.gs.push(' ');
      cur.u += prep.spaceU;
    }
    for (const g of a.gs) cur.gs.push(g);
    cur.u += a.u;
    cur.lastSpace = a.space;
    cur.lastShy = a.shy;
  };
  for (const atom of para.atoms) {
    if (atom.gs.length === 0) {
      // a bare space atom (leading space): ignore
      continue;
    }
    if (cur) {
      const joinU = cur.u + (cur.lastSpace ? prep.spaceU : 0) + atom.u + (atom.shy ? prep.hyphenU : 0);
      if (fits(joinU)) {
        pushAtomWhole(atom);
        continue;
      }
      closeLine(cur.lastShy);
    }
    // start a new line with this atom
    if (fits(atom.u + (atom.shy ? prep.hyphenU : 0))) {
      pushAtomWhole(atom);
      continue;
    }
    // emergency: the atom alone is wider than the line. Break at the last grapheme that fits, add a hyphen (Latin).
    let rest = atom.gs.slice();
    for (;;) {
      let total = 0;
      for (const g of rest) total += graphemeAdvance(g, prep.face);
      if (fits(total + (atom.shy ? prep.hyphenU : 0))) {
        cur = { gs: rest, u: total, lastSpace: atom.space, lastShy: atom.shy }; // the remainder fits as the start of a line
        break;
      }
      let take = 0;
      let u = 0;
      while (take < rest.length) {
        const nu = u + graphemeAdvance(rest[take], prep.face);
        if (take > 0 && !fits(nu + prep.hyphenU)) break;
        u = nu;
        take++;
      }
      emergency++;
      const chunk = rest.slice(0, take);
      const last = chunk[chunk.length - 1] || '';
      const hyph = /[\p{L}\p{N}]$/u.test(last) && !isCjkGrapheme(last);
      lines.push({ gs: hyph ? [...chunk, '-'] : chunk, u: u + (hyph ? prep.hyphenU : 0), hyphen: hyph });
      rest = rest.slice(take);
    }
  }
  if (cur) closeLine(false);
  return { lines, emergency };
}

const isCjkGrapheme = (g) => {
  const cp = g.codePointAt(0);
  return (cp >= 0x2e80 && cp <= 0x9fff) || (cp >= 0xac00 && cp <= 0xd7af) || (cp >= 0xff00 && cp <= 0xffef) || cp > 0xffff;
};

/** Lay out all paragraphs at one size and width. */
function flow(prep, size, availW) {
  const out = [];
  let emergency = 0;
  for (const para of prep.paras) {
    if (para.atoms.length === 0 || para.atoms.every((a) => a.gs.length === 0)) {
      out.push({ gs: [], u: 0, hyphen: false, dir: para.dir, blank: true });
      continue;
    }
    const r = breakParagraph(para, prep, size, availW);
    emergency += r.emergency;
    for (const l of r.lines) out.push({ ...l, dir: para.dir });
  }
  // drop trailing blank lines (a trailing newline draws nothing)
  while (out.length && out[out.length - 1].blank) out.pop();
  return { lines: out, emergency };
}

function ellipsize(line, size, availW, face) {
  let gs = line.gs.slice();
  const unit = size / 1000;
  const ellU = graphemeAdvance(ELLIPSIS, face);
  let u = line.u - (line.hyphen ? graphemeAdvance('-', face) : 0);
  if (line.hyphen) gs = gs.slice(0, -1);
  let dropped = 0;
  while (gs.length > 1 && need((u + ellU) * unit) > availW) {
    const g = gs.pop();
    u -= graphemeAdvance(g, face);
    dropped += 1;
  }
  // trim trailing spaces before the ellipsis
  while (gs.length > 1 && gs[gs.length - 1] === ' ') {
    u -= graphemeAdvance(' ', face);
    gs.pop();
  }
  gs.push(ELLIPSIS);
  return { gs, u: u + ellU, hyphen: false, dir: line.dir, dropped };
}

function layoutCore(n) {
  const face = resolveFace(n.family, n.weight);
  const prep = prepare(n.text, face);
  const minSize = Math.min(n.minSize, n.size);
  let size = n.size;
  let availW = n.w;
  let boxW = n.w;
  let boxH = n.h;
  let result;

  const cap = (lh) => {
    if (n.mode === 'auto' || n.mode === 'auto-height') return n.maxLines;
    return n.h > 0 ? Math.max(1, Math.min(n.maxLines, Math.floor(n.h / lh + 1e-6))) : n.maxLines;
  };

  if (n.mode === 'auto') {
    const maxW = Math.max(n.maxWidth || n.w, n.minWidth || n.w, 1);
    availW = maxW;
    result = flow(prep, size, availW);
    const widest = result.lines.reduce((m, l) => Math.max(m, need((l.u * size) / 1000)), 0);
    boxW = Math.min(maxW, Math.max(n.minWidth || n.w, Math.ceil(widest)));
  } else if (n.mode === 'auto-height') {
    result = flow(prep, size, availW);
  } else if (n.mode === 'shrink') {
    for (;;) {
      result = flow(prep, size, availW);
      const lhPx = size * n.lh;
      const hNeeded = result.lines.length * lhPx;
      if ((result.emergency === 0 && (n.h <= 0 || hNeeded <= n.h + 1e-6)) || size <= minSize) break;
      size = Math.max(minSize, size - SHRINK_STEP);
    }
  } else {
    result = flow(prep, size, availW);
  }

  const lhPx = round2(size * n.lh);
  let lines = result.lines;
  const maxVisible = cap(lhPx);
  let overflow = false;
  if (lines.length > maxVisible) {
    const hiddenLines = lines.length - maxVisible;
    const hiddenText = lines.slice(maxVisible).reduce((c, l) => c + l.gs.length, 0);
    const visible = lines.slice(0, maxVisible);
    const last = ellipsize(visible[visible.length - 1], size, availW, face);
    visible[visible.length - 1] = last;
    lines = visible;
    overflow = { hiddenLines, hiddenChars: hiddenText + last.dropped };
  }

  const widest = lines.reduce((m, l) => Math.max(m, need((l.u * size) / 1000)), 0);
  const textH = round2(lines.length * lhPx);
  if (n.mode === 'auto') boxH = Math.max(n.h, textH);
  else if (n.mode === 'auto-height') boxH = Math.max(n.h, textH);
  else boxH = n.h > 0 ? n.h : textH;
  if (n.mode === 'auto-height' || n.mode === 'shrink' || n.mode === 'fixed') boxW = n.w > 0 ? n.w : Math.ceil(widest);

  const asc = (face.ascender * size) / 1000;
  const desc = (face.descender * size) / 1000;
  const offset = n.valign === 'top' ? 0 : n.valign === 'bottom' ? boxH - textH : (boxH - textH) / 2;
  const out = lines.map((l, i) => {
    const dir = n.dir === 'auto' ? l.dir : n.dir;
    const w = round2((l.u * size) / 1000);
    let x;
    if (n.align === 'center') x = (boxW - w) / 2;
    else if ((n.align === 'start') === (dir === 'ltr')) x = 0;
    else x = boxW - w;
    const top = round2(offset + i * lhPx);
    return { text: l.gs.join(''), x: round2(x), y: round2(top + (lhPx - (asc + desc)) / 2 + asc), top, width: w, dir, hyphen: l.hyphen };
  });

  return {
    lines: out,
    width: Math.ceil(widest),
    height: textH,
    box: { width: round2(boxW), height: round2(boxH) },
    fontSize: size,
    lineHeight: lhPx,
    overflow,
    breaks: { emergency: result.emergency },
    mode: n.mode,
    align: n.align,
    valign: n.valign,
    text: n.text,
    weight: face.weight,
  };
}

/**
 * @param {{text: string,
 *          font?: {family?: string|null, size?: number, weight?: number|string, lineHeight?: number},
 *          box?: {width?: number, height?: number},
 *          mode?: 'auto'|'auto-height'|'shrink'|'fixed',
 *          limits?: {minWidth?: number, maxWidth?: number, maxLines?: number, minSize?: number},
 *          align?: 'start'|'center'|'end', valign?: 'top'|'middle'|'bottom', dir?: 'auto'|'ltr'|'rtl'}} input
 * `box` is the text area (after padding and shape inset). In `auto` it is the minimum; `limits.maxWidth` caps the growth.
 * @returns {{lines: {text: string, x: number, y: number, top: number, width: number, dir: 'ltr'|'rtl', hyphen: boolean}[],
 *            width: number, height: number, box: {width: number, height: number}, fontSize: number, lineHeight: number,
 *            overflow: false | {hiddenLines: number, hiddenChars: number}, breaks: {emergency: number}}}
 */
export function layoutText(input) {
  const n = normalize(input || {});
  const key = keyOf(n);
  stats.calls++;
  const hit = cache.get(key);
  if (hit) {
    stats.hits++;
    cache.delete(key); // refresh recency
    cache.set(key, hit);
    return hit;
  }
  const res = layoutCore(n);
  res.lines.forEach((l) => Object.freeze(l));
  Object.freeze(res.lines);
  Object.freeze(res.box);
  Object.freeze(res.breaks);
  if (res.overflow) Object.freeze(res.overflow);
  Object.freeze(res);
  cache.set(key, res);
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
  return res;
}

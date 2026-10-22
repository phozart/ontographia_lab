// lib/text/fonts.js
// Per-glyph advance tables and width classes (ADR-0008 3.2). The tables are generated from the self-hosted Inter
// woff2 files by scripts/build-font-metrics.js and committed; this module only reads them, so Node and the browser
// measure text identically.

import metrics from './metrics/inter.json';
import { graphemes, isEmojiCluster, scriptClass } from './segment';

export const TABLE_WEIGHTS = [400, 500, 600, 700];

/** Snap any CSS weight (number, 'normal', 'bold') to a table weight. */
export function snapWeight(weight) {
  let n = weight;
  if (n === 'normal' || n === undefined || n === null || n === '') n = 400;
  else if (n === 'bold') n = 700;
  else if (n === 'medium') n = 500;
  n = Number(n);
  if (!Number.isFinite(n)) return 500;
  if (n <= 450) return 400;
  if (n <= 550) return 500;
  if (n <= 650) return 600;
  return 700;
}

const tableCache = new Map();
function tableFor(weight) {
  let t = tableCache.get(weight);
  if (!t) {
    const face = metrics.faces[weight];
    const adv = new Map();
    for (const [start, list] of face.ranges) for (let i = 0; i < list.length; i++) adv.set(start + i, list[i]);
    t = { adv, ascender: face.ascender, descender: face.descender, capHeight: face.capHeight };
    tableCache.set(weight, t);
  }
  return t;
}

const MONO_RE = /mono|consolas|courier|menlo|monaco|source code|fira code|jetbrains/i;
const SERIF_RE = /(^|[^-])serif|georgia|times|garamond|merriweather|playfair|lora|palatino|cambria|baskerville|libre/i;

/** Which metric class a CSS font-family list belongs to: the closed list member itself, or the nearest class. */
export function familyClass(family) {
  const f = typeof family === 'string' ? family : '';
  if (!f || /inter\b/i.test(f.split(',')[0]) || /^\s*['"]?(-apple-system|system-ui|blinkmacsystemfont|segoe ui)/i.test(f)) return 'inter';
  const first = f.split(',')[0];
  if (MONO_RE.test(first)) return 'mono';
  if (SERIF_RE.test(first) && !/sans/i.test(first)) return 'serif';
  return 'sans';
}

// Legacy families outside the closed list use Inter's table plus 4% slack (ADR-0008 3.2); monospace is 0.6 em.
const CLASS_SCALE = { inter: 1, sans: 1.04, serif: 1.04, mono: 1 };
const MONO_EM = 600;

/**
 * A resolved face: everything layout needs to measure one font setting.
 * @param {string|null|undefined} family CSS font-family
 * @param {number|string} weight
 */
export function resolveFace(family, weight) {
  const w = snapWeight(weight);
  const cls = familyClass(family);
  const t = tableFor(w);
  return { key: `${cls}:${w}`, cls, weight: w, scale: CLASS_SCALE[cls], table: t, ascender: t.ascender, descender: t.descender, capHeight: t.capHeight };
}

/** Advance of one grapheme in 1/1000 em. */
export function graphemeAdvance(g, face) {
  const cp = g.codePointAt(0);
  if (face.cls === 'mono') {
    const cls = scriptClass(cp);
    if (cls === 'zero') return 0;
    if (g.length > 1 && isEmojiCluster(g)) return metrics.fallback.emoji;
    return cls === 'cjk' || cls === 'hangul' ? metrics.fallback[cls] : MONO_EM;
  }
  const a = face.table.adv.get(cp);
  if (g.length === 1 && a !== undefined) return a * face.scale; // the common case: one BMP glyph in the table
  if (g.length > 1 && isEmojiCluster(g)) return metrics.fallback.emoji;
  if (g.length === 2 && cp > 0xffff && isEmojiCluster(g)) return metrics.fallback.emoji;
  if (a !== undefined) return a * face.scale; // base letter + combining marks: the marks add nothing
  const cls = scriptClass(cp);
  if (cls === 'zero') return 0;
  if (cp > 0xff && isEmojiCluster(g)) return metrics.fallback.emoji;
  return metrics.fallback[cls] ?? metrics.fallback.other;
}

/** Width of a list of graphemes in px. */
export function widthOfGraphemes(gs, face, size) {
  let u = 0;
  for (let i = 0; i < gs.length; i++) u += graphemeAdvance(gs[i], face);
  return (u * size) / 1000;
}

/** Width of a text in px (no wrapping, no slack). */
export function measureText(text, face, size) {
  return widthOfGraphemes(graphemes(text), face, size);
}

export const FALLBACK_CLASSES = metrics.fallback;
export const METRICS_INFO = { family: metrics.family, unitsPerEm: metrics.unitsPerEm, chrome: metrics.chrome, platform: metrics.platform, faces: Object.fromEntries(TABLE_WEIGHTS.map((w) => [w, metrics.faces[w].sha1])) };

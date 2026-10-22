// lib/present/textLayout.js
// THE single boundary for preset text layout (measurement, wrapping, sizing, padding, alignment, overflow) in P2.
// Callers (textPreset.estimateTextHeight, the SVG renderer, the MCP compile step, the editor node) must not do their own
// text math. Since ADR-0008 T1 the measuring and wrapping delegate to lib/text (one engine for the canvas, exports and agents).
//
//   layoutText({text, preset, theme, box, fontSize?, minFontSize?})
//     text:   markdown string (the sanitized data.text.markdown)
//     preset: a TEXT_PRESETS name;  theme: resolved/stored theme (its font id picks the metric class)
//     box:    {width, height?}  height omitted = auto-size
//   -> { fontSize, lineHeight, lines: [{text, x, y, bold?, bullet?}], height, autoHeight, overflow, minReadable }
//   height     = the height the text needs (the box should grow to this: auto-size)
//   overflow   = true when box.height was given and the text needs more (never clip silently: show an indicator)
//   minReadable= the preset's minimum readable font size (board units at 1080 slide height)
//
// ADR-0008: the measuring and wrapping are delegated to lib/text (shared per-glyph metric tables, the same in Node and in the
// browser). This file keeps the markdown walk (blocks, bullets, indents) and its public shape.

import { parseMarkdown, inlineText } from '../doc/markdown';
import { layoutText as flowText } from '../text/layout';

const LIST_INDENT = 1.4; // em
const PARA_GAP = 0.45; // em between blocks
export const LINE_HEIGHTS = Object.freeze({ title: 1.1, subtitle: 1.25, heading: 1.15, body: 1.4, caption: 1.35, quote: 1.3, number: 1.0 });
export const BASE_SIZES = Object.freeze({ title: 72, subtitle: 40, heading: 48, body: 32, caption: 22, quote: 40, number: 120 });
export const MIN_READABLE = Object.freeze({ title: 40, subtitle: 24, heading: 32, body: 22, caption: 16, quote: 24, number: 64 });
const WEIGHTS = Object.freeze({ title: 700, subtitle: 500, heading: 600, body: 400, caption: 400, quote: 400, number: 700 });
const HEADING_PRESETS = new Set(['title', 'subtitle', 'heading', 'number']);

/** Lines of `text` wrapped to `width` px at `size` by the shared engine (hard newlines kept, no line cap). */
function wrap(text, width, font) {
  const r = flowText({ text, font, box: { width: Math.max(1, width) }, mode: 'auto-height', limits: { maxLines: 100000 }, align: 'start', valign: 'top' });
  return r.lines.length ? r.lines.map((l) => l.text) : [''];
}

export function layoutText({ text, preset = 'body', theme, box, fontSize, minFontSize }) {
  const size = fontSize || BASE_SIZES[preset] || BASE_SIZES.body;
  const lh = LINE_HEIGHTS[preset] || LINE_HEIGHTS.body;
  const lineH = size * lh;
  // the theme's font id picks the metric class (Inter table, or the nearest class plus slack for the other families)
  const family = theme?.fonts?.[HEADING_PRESETS.has(preset) ? 'heading' : 'body'] || null;
  const font = { family, size, weight: WEIGHTS[preset] || 400, lineHeight: lh };
  const boldFont = { ...font, weight: 700 };
  const width = Math.max(size * 2, box?.width || 800);
  const lines = [];
  let y = 0;
  let blocks = 0;
  const push = (t, x, w, extra) => {
    for (const l of wrap(t, w - x, extra?.bold ? boldFont : font)) {
      lines.push({ text: l, x, y, ...extra });
      y += lineH;
    }
  };
  const walk = (list, x) => {
    for (const b of list) {
      if (b.t === 'p' || b.t === 'heading') {
        if (blocks > 0) y += PARA_GAP * size;
        blocks += 1;
        push(inlineText(b.c), x, width, b.t === 'heading' ? { bold: true } : undefined);
      } else if (b.t === 'ul' || b.t === 'ol') {
        b.items.forEach((it, i) => {
          const first = it.c.find((c) => c.t === 'p');
          if (blocks > 0) y += PARA_GAP * size * 0.5;
          blocks += 1;
          if (first) push(inlineText(first.c), x + LIST_INDENT * size, width, { bullet: b.t === 'ul' ? '•' : `${(b.start || 1) + i}.` });
          walk(it.c.filter((c) => c !== first), x + LIST_INDENT * size);
        });
      } else if (b.t === 'quote') walk(b.c, x + size);
      else if (b.t === 'code') {
        if (blocks > 0) y += PARA_GAP * size;
        blocks += 1;
        for (const l of b.v.split('\n')) push(l, x, width);
      } else if (b.t === 'table') {
        if (blocks > 0) y += PARA_GAP * size;
        blocks += 1;
        push(b.head.map(inlineText).join(' | '), x, width, { bold: true });
        for (const r of b.rows) push(r.map(inlineText).join(' | '), x, width);
      }
    }
  };
  walk(parseMarkdown(text), 0);
  if (lines.length === 0) { lines.push({ text: '', x: 0, y: 0 }); y = lineH; }
  const height = Math.ceil(y);
  const minReadable = minFontSize || MIN_READABLE[preset] || 12;
  const given = typeof box?.height === 'number' ? box.height : null;
  return { fontSize: size, lineHeight: lineH, lines, height, autoHeight: given === null, overflow: given !== null && height > given + 1, minReadable };
}

// lib/present/textLayout.js
// THE single boundary for preset text layout (measurement, wrapping, sizing, padding, alignment, overflow) in P2.
// Callers (textPreset.estimateTextHeight, the SVG renderer, the MCP compile step, the editor node) must not do their own
// text math; when the shared text-layout engine (ADR-0008) lands, replace the body of `layoutText` and nothing else.
//
//   layoutText({text, preset, theme, box, fontSize?, minFontSize?})
//     text:   markdown string (the sanitized data.text.markdown)
//     preset: a TEXT_PRESETS name;  theme: resolved/stored theme (reserved for font metrics; the estimate is font-agnostic)
//     box:    {width, height?}  height omitted = auto-size
//   -> { fontSize, lineHeight, lines: [{text, x, y, bold?, bullet?}], height, autoHeight, overflow, minReadable }
//   height     = the height the text needs (the box should grow to this: auto-size)
//   overflow   = true when box.height was given and the text needs more (never clip silently: show an indicator)
//   minReadable= the preset's minimum readable font size (board units at 1080 slide height)
//
// Deterministic estimate (the server has no font metrics): average glyph width 0.52 em.

import { parseMarkdown, inlineText } from '../doc/markdown';

const CHAR_WIDTH = 0.52;
const LIST_INDENT = 1.4; // em
const PARA_GAP = 0.45; // em between blocks
export const LINE_HEIGHTS = Object.freeze({ title: 1.1, subtitle: 1.25, heading: 1.15, body: 1.4, caption: 1.35, quote: 1.3, number: 1.0 });
export const BASE_SIZES = Object.freeze({ title: 72, subtitle: 40, heading: 48, body: 32, caption: 22, quote: 40, number: 120 });
export const MIN_READABLE = Object.freeze({ title: 40, subtitle: 24, heading: 32, body: 22, caption: 16, quote: 24, number: 64 });

function wrap(text, perLine) {
  const out = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    let w = word;
    while (w.length > perLine) {
      if (line) { out.push(line); line = ''; }
      out.push(w.slice(0, perLine));
      w = w.slice(perLine);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= perLine) line += ` ${w}`;
    else { out.push(line); line = w; }
  }
  if (line) out.push(line);
  return out.length ? out : [''];
}

export function layoutText({ text, preset = 'body', box, fontSize, minFontSize }) {
  const size = fontSize || BASE_SIZES[preset] || BASE_SIZES.body;
  const lh = LINE_HEIGHTS[preset] || LINE_HEIGHTS.body;
  const lineH = size * lh;
  const charW = size * CHAR_WIDTH;
  const width = Math.max(charW * 4, box?.width || 800);
  const lines = [];
  let y = 0;
  let blocks = 0;
  const push = (t, x, w, extra) => {
    for (const l of wrap(t, Math.max(1, Math.floor((w - x) / charW)))) {
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

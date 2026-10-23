// lib/present/pptx/textRuns.js
// Markdown (the AI-5 dialect, already sanitized) -> PPTX paragraphs with styled runs (bold, italic, strike, code, links)
// and, for preset text boxes, the line breaks the shared engine computed (ADR-0008 section 8: "PPTX: each text box gets
// explicit line breaks, fit none, so PowerPoint cannot re-wrap differently").
//
// The walk mirrors lib/present/textLayout.js (the canvas): same blocks, indents, paragraph gaps, bold headings and the same
// wrap call into lib/text, so a line here is a line on the canvas. lib/text is consumed read-only; `breakLines` below is the
// addition this slice needs (a wrap that also returns the hyphen flags). Pure: no React, no DOM, no pptxgenjs.
//
//   buildParagraphs({markdown, fontSize, width, ...}) ->
//     { paragraphs: [{runs: [{text, bold?, italic?, strike?, code?, link?, breakBefore?}], bullet, indent, spaceBefore, lines}],
//       height, truncated, unmatched }
//   units are board units of the slide frame; the writer converts to inches and points.

import { parseMarkdown } from '../../doc/markdown';
import { layoutText as flowText } from '../../text/layout';
import { safeLink } from './mapping';

export const LIST_INDENT = 1.4; // em, as textLayout.js
export const PARA_GAP = 0.45; // em between blocks, as textLayout.js
const DOC_HEADING_SCALE = Object.freeze({ 1: 1.6, 2: 1.35, 3: 1.15, 4: 1.05, 5: 1, 6: 1 });
const MAX_PARAGRAPHS = 2000; // a hostile document cannot make the export build an unbounded slide

/** Lines of `text` wrapped to `width` at `font` by the shared engine (hard newlines kept, no line cap), with hyphen flags. */
export function breakLines(text, width, font) {
  const r = flowText({ text, font, box: { width: Math.max(1, width) }, mode: 'auto-height', limits: { maxLines: 100000 }, align: 'start', valign: 'top' });
  return r.lines.length ? r.lines.map((l) => ({ text: l.text, hyphen: !!l.hyphen })) : [{ text: '', hyphen: false }];
}

/** Inline AST -> {text, style[]} with the same text as inlineText (br adds nothing, whitespace runs collapse to one space). */
function flattenInline(nodes, ctx, base = {}, out = { chars: [], last: '' }) {
  const push = (s, st) => {
    const str = String(s);
    for (let i = 0; i < str.length; i += 1) { // per UTF-16 unit, so offsets equal the string offsets the wrapper reports
      const ch = str[i];
      const c = /\s/.test(ch) ? ' ' : ch;
      if (c === ' ' && out.last === ' ') continue;
      out.chars.push({ c, st });
      out.last = c;
    }
  };
  for (const n of nodes || []) {
    if (n.t === 'text') push(n.v, base);
    else if (n.t === 'code') push(n.v, { ...base, code: true });
    else if (n.t === 'strong') flattenInline(n.c, ctx, { ...base, bold: true }, out);
    else if (n.t === 'em') flattenInline(n.c, ctx, { ...base, italic: true }, out);
    else if (n.t === 'del') flattenInline(n.c, ctx, { ...base, strike: true }, out);
    else if (n.t === 'link') {
      const href = n.link ? safeLink(n.link.href, ctx) : null;
      flattenInline(n.c, ctx, href ? { ...base, link: href } : base, out);
    } else if (n.c) flattenInline(n.c, ctx, base, out);
  }
  return out;
}

const sameStyle = (a, b) => !!a.bold === !!b.bold && !!a.italic === !!b.italic && !!a.strike === !!b.strike && !!a.code === !!b.code && (a.link || null) === (b.link || null);

function toRuns(chars, from, to, breakFirst) {
  const runs = [];
  for (let i = from; i < to; i += 1) {
    const { c, st } = chars[i];
    const last = runs[runs.length - 1];
    if (last && sameStyle(last.style, st)) last.text += c;
    else runs.push({ text: c, style: st });
  }
  return runs.map((r, i) => {
    const run = { text: r.text };
    if (r.style.bold) run.bold = true;
    if (r.style.italic) run.italic = true;
    if (r.style.strike) run.strike = true;
    if (r.style.code) run.code = true;
    if (r.style.link) run.link = r.style.link;
    if (i === 0 && breakFirst) run.breakBefore = true;
    return run;
  });
}

/**
 * Split flattened chars into the wrapped lines. Returns the runs (with `breakBefore` on the first run of every line after the
 * first) or null when the wrap does not line up with the characters (then the caller lets PowerPoint wrap).
 */
function runsForLines(chars, lines) {
  const flat = chars.map((x) => x.c).join('');
  const runs = [];
  let pos = 0;
  let first = true;
  for (const line of lines) {
    const t = line.hyphen && line.text.endsWith('-') ? line.text.slice(0, -1) : line.text;
    while (pos < flat.length && flat[pos] === ' ' && !t.startsWith(' ')) pos += 1;
    if (t === '' && pos >= flat.length) continue;
    if (!flat.startsWith(t, pos)) return null;
    runs.push(...toRuns(chars, pos, pos + t.length, !first));
    first = false;
    pos += t.length;
  }
  return pos >= flat.replace(/\s+$/, '').length ? runs : null;
}

/**
 * @param {{markdown: string, fontSize: number, width: number, weight?: number, lineHeight?: number, family?: string|null,
 *          explicitBreaks?: boolean, headingScales?: boolean, maxHeight?: number, ctx?: {boardUrl?: string}}} o
 *   family: the THEME font id (it picks the metric class, exactly as textLayout.js passes it).
 *   explicitBreaks: put the engine's line breaks into the runs (preset text); false lets PowerPoint wrap (docs).
 *   maxHeight: stop before the paragraph that would not fit and mark the cut (docs, section 8.3).
 */
export function buildParagraphs(o) {
  const size = o.fontSize;
  const lh = o.lineHeight || 1.4;
  const lineH = size * lh;
  const width = Math.max(size * 2, o.width || 800);
  const baseFont = { family: o.family || null, size, weight: o.weight || 400, lineHeight: lh };
  const ctx = o.ctx || {};
  const paragraphs = [];
  let y = 0;
  let blocks = 0;
  let truncated = false;
  let unmatched = 0;

  const room = (h) => o.maxHeight === undefined || y + h <= o.maxHeight + 0.5;

  // one block of inline content -> one paragraph
  const addParagraph = (inline, { indent = 0, bold = false, bullet = null, scale = 1, gap = PARA_GAP, prefix = '', plain = null, code = false, quote = false }) => {
    if (truncated || paragraphs.length >= MAX_PARAGRAPHS) { truncated = true; return; }
    const psize = size * scale;
    const gapUnits = blocks > 0 ? gap * size : 0;
    const flat = plain !== null
      ? { chars: String(plain).split('').map((c) => ({ c: /\s/.test(c) && c !== '\n' ? ' ' : c, st: code ? { code: true } : {} })), last: '' }
      : flattenInline(inline, ctx, bold ? { bold: true } : {});
    if (prefix) flat.chars.unshift(...prefix.split('').map((c) => ({ c, st: {} })));
    const font = { ...baseFont, size: psize, weight: bold ? 700 : baseFont.weight };
    // code keeps its source lines (a monospace face has its own widths); table rows and prose wrap through the shared engine
    const lines = plain !== null && code
      ? String(plain).split('\n').map((t) => ({ text: t, hyphen: false }))
      : breakLines(flat.chars.map((x) => x.c).join(''), width - indent, font);
    const h = lines.length * psize * lh;
    if (!room(gapUnits + h)) {
      truncated = true;
      // keep as many lines as still fit, then the ellipsis
      const fit = Math.floor(((o.maxHeight ?? 0) - y - gapUnits + 0.5) / (psize * lh));
      if (fit <= 0 || paragraphs.length === 0 && fit <= 0) return;
      const kept = lines.slice(0, fit);
      kept[kept.length - 1] = { ...kept[kept.length - 1], text: `${kept[kept.length - 1].text.replace(/\s+$/, '')}…` };
      const text = kept.map((l) => l.text).join(' ');
      paragraphs.push({ runs: [{ text, ...(bold ? { bold: true } : {}) }], bullet, indent, spaceBefore: gapUnits, lines: kept.length, scale, quote, code });
      y += gapUnits + kept.length * psize * lh;
      return;
    }
    let runs = null;
    if (o.explicitBreaks && plain === null) {
      runs = runsForLines(flat.chars, lines);
      if (!runs) unmatched += 1;
    }
    if (plain !== null && (o.explicitBreaks || code)) {
      runs = lines.map((l, i) => ({ text: l.text, ...(code ? { code: true } : {}), ...(bold ? { bold: true } : {}), ...(i > 0 ? { breakBefore: true } : {}) }));
    } else if (plain !== null) {
      runs = [{ text: lines.map((l) => l.text).join(' '), ...(code ? { code: true } : {}), ...(bold ? { bold: true } : {}) }];
    }
    if (!runs) runs = toRuns(flat.chars, 0, flat.chars.length, false);
    if (!runs.length) runs = [{ text: '' }];
    paragraphs.push({ runs, bullet, indent, spaceBefore: gapUnits, lines: lines.length, scale, quote, code });
    y += gapUnits + h;
    blocks += 1;
  };

  const walk = (list, x) => {
    for (const b of list) {
      if (truncated) return;
      if (b.t === 'p') addParagraph(b.c, { indent: x });
      else if (b.t === 'heading') addParagraph(b.c, { indent: x, bold: true, scale: o.headingScales ? DOC_HEADING_SCALE[b.level] || 1 : 1 });
      else if (b.t === 'ul' || b.t === 'ol') {
        b.items.forEach((it, i) => {
          if (truncated) return;
          const first = it.c.find((c) => c.t === 'p');
          const bullet = b.t === 'ul' ? { kind: 'bullet' } : { kind: 'number', start: i === 0 ? b.start || 1 : undefined };
          const prefix = it.checked === undefined ? '' : it.checked ? '[x] ' : '[ ] ';
          if (first) addParagraph(first.c, { indent: x + LIST_INDENT * size, bullet, gap: PARA_GAP * 0.5, prefix });
          walk(it.c.filter((c) => c !== first), x + LIST_INDENT * size);
        });
      } else if (b.t === 'quote') walk(b.c, x + size);
      else if (b.t === 'code') addParagraph(null, { indent: x, plain: b.v, code: true });
      else if (b.t === 'table') {
        const row = (cells) => cells.map((c) => flattenInline(c, ctx).chars.map((k) => k.c).join('')).join(' | ');
        addParagraph(null, { indent: x, plain: row(b.head), bold: true });
        for (const r of b.rows) addParagraph(null, { indent: x, plain: row(r) });
      }
    }
  };
  walk(parseMarkdown(o.markdown), 0);
  if (paragraphs.length === 0) { paragraphs.push({ runs: [{ text: '' }], bullet: null, indent: 0, spaceBefore: 0, lines: 1, scale: 1 }); y = lineH; }
  return { paragraphs, height: Math.ceil(y), truncated, unmatched };
}

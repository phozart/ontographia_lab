// lib/render/diagramSvg.js
// Pure, server-side SVG rendering of stored diagram content (spike: MCP App `diagram_show`, slice AI-9).
// No React, no DOM, no network: content in -> one self-contained SVG string out.
//
// Fidelity: shapes come from the stencil catalog (`shape`, `color`, `defaultSize`) and the element's own colour
// fields, with the same fill / stroke / label-contrast rules as the pack renderers. Connection paths reuse the
// editor's pure geometry (auto ports, straight / curved / arc / orthogonal path builders), so lines take the same
// route as on the canvas. Pack-specific decorations (UML compartments, ERD fields, icons) are NOT drawn: an element
// is its shape plus its label. Design: docs/architecture/investigations/ai-canvas-via-mcp.md section 10.
//
// Security: the output is meant to be shown as an <img src="data:image/svg+xml,..."> (no script, no external loads
// even if this file had a bug). On top of that, every user-authored string is XML-escaped, every colour is parsed
// and re-emitted as #rrggbb (a stored "url(https://...)" can never reach a fill), and every number is finite.

import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { parseColor, pickLabelColor } from '../../components/diagram-studio/packs/colorUtils';
import { resolveConnectionPorts } from '../../components/diagram-studio/connections/geometry/autoPorts';
import {
  buildStraightPath,
  buildStraightPathThroughPoints,
  buildCurvedPath,
  buildCurvedPathThroughPoints,
  buildArcPath,
} from '../../components/diagram-studio/connections/geometry/pathBuilders';
import { buildOrthogonalPath } from '../../components/diagram-studio/connections/geometry/orthogonalRouting';
import { renderTableSvg } from '../table/tableSvg';
import { tableOf } from '../table/tableModel';
import { docOf } from '../doc/docElement';
import { docExcerptLines, utf8Length } from '../doc/markdown';
import { resolveTheme, resolveElementTokens } from '../present/themes';
import { isPresetText, presetStyle, textOf } from '../present/textPreset';
import { layoutText } from '../present/textLayout';
import { layoutText as flowText } from '../text/layout';
import { policyFor, externalPolicy, forcesExternalLabel } from '../text/policy';
import { layoutForElement, layoutForExternal, layoutForTitle, layoutForSlot, flowLines, labelOf as storedLabelOf } from '../text/fit';
import { textLayoutToSvg, escapeXml, FONT_STACK } from '../text/svg';
import { connectionLabelLayout } from '../text/connectionLabel';
import { labelSlotFor } from '../../components/diagram-studio/packs/labelSlots';
import { resolveFace, measureText } from '../text/fonts';

export const DEFAULT_MAX_ELEMENTS = 600;
export const DEFAULT_MAX_CONNECTIONS = 1200;
export const DEFAULT_MAX_SVG_BYTES = 96 * 1024;
const PADDING = 40;
const FONT = FONT_STACK;

/** Same colours as the slice-8 compare overlay (components/diagram-studio/ui/CompareOverlay.js COMPARE_COLORS). */
export const HIGHLIGHT_COLORS = Object.freeze({ added: '#2e9e5b', changed: '#e0a30b', removed: '#d64545' });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
// Stored coordinates beyond this are corrupt, not content: drawing them would yield exponent notation or Infinity.
const COORD_MAX = 1e6;
const SIZE_MAX = 1e5;
const coord = (v) => fin(v) && Math.abs(v) <= COORD_MAX;
const r1 = (n) => Math.round(n * 10) / 10;

export { escapeXml };

/** Any stored colour -> '#rrggbb', or the fallback. Only #hex and rgb()/rgba() are accepted (see colorUtils). */
export function safeColor(value, fallback) {
  // "var(--x, #abc)" is the editor's theme form; use its fallback colour.
  if (typeof value === 'string') {
    const v = /^\s*var\(\s*--[\w-]+\s*,\s*([^()]+|rgba?\([^()]*\))\s*\)\s*$/i.exec(value);
    if (v) return safeColor(v[1], fallback);
  }
  const rgb = parseColor(value);
  if (!rgb) return fallback;
  return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

function darken(hex, f = 0.72) {
  const rgb = parseColor(hex) || [100, 116, 139];
  return `#${rgb.map((c) => Math.round(c * f).toString(16).padStart(2, '0')).join('')}`;
}

// The label as the canvas has it (line breaks kept: the shared layout breaks lines, not this function).
function labelOf(el) {
  const v = storedLabelOf(el) || el.text || el.properties?.frameTitle || el.data?.frameTitle;
  return typeof v === 'string' ? v : '';
}

/** Element box with the editor defaults for missing sizes; null when the element has no coordinates. */
export function boundsOf(el, stencil) {
  if (!coord(el.x) || !coord(el.y)) return null;
  const w = el.size?.width ?? el.width ?? stencil?.defaultSize?.width ?? 100;
  const h = el.size?.height ?? el.height ?? stencil?.defaultSize?.height ?? 60;
  return {
    x: el.x,
    y: el.y,
    width: fin(w) && w > 0 ? Math.min(w, SIZE_MAX) : 100,
    height: fin(h) && h > 0 ? Math.min(h, SIZE_MAX) : 60,
  };
}

function shapePath(shape, b, radius) {
  const { x, y, width: w, height: h } = b;
  switch (shape) {
    case 'circle':
    case 'ellipse':
      return `<ellipse cx="${r1(x + w / 2)}" cy="${r1(y + h / 2)}" rx="${r1(w / 2)}" ry="${r1(h / 2)}"`;
    case 'diamond':
      return `<polygon points="${r1(x + w / 2)},${r1(y)} ${r1(x + w)},${r1(y + h / 2)} ${r1(x + w / 2)},${r1(y + h)} ${r1(x)},${r1(y + h / 2)}"`;
    case 'chevron': {
      const n = Math.min(w * 0.25, h * 0.5);
      return `<polygon points="${r1(x)},${r1(y)} ${r1(x + w - n)},${r1(y)} ${r1(x + w)},${r1(y + h / 2)} ${r1(x + w - n)},${r1(y + h)} ${r1(x)},${r1(y + h)} ${r1(x + n)},${r1(y + h / 2)}"`;
    }
    case 'sticky':
      return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="2"`;
    default: {
      // corner radius (ADR-0007 P2): 0..999 where 999 means fully round (half the short side)
      const rx = fin(radius) ? Math.min(radius >= 999 ? Math.min(w, h) / 2 : radius, Math.min(w, h) / 2) : 8;
      return `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(rx)}"`;
    }
  }
}

// Text. Every line below comes from lib/text (the layout the canvas draws): this file only places and styles it. A "pseudo
// layout" wraps lines that were flowed by the shared engine outside a node box (doc excerpts, preset paragraphs) so they are drawn
// by the same textLayoutToSvg as the node labels.
function pseudo(texts, { size, weight = 400, lh, family = null }) {
  const face = resolveFace(family, weight);
  const asc = (face.ascender * size) / 1000;
  const desc = (face.descender * size) / 1000;
  return {
    lines: texts.map((t, i) => {
      const top = i * lh;
      return { text: t, x: 0, y: top + (lh - (asc + desc)) / 2 + asc, top, width: measureText(t, face, size), dir: 'ltr', hyphen: false };
    }),
    fontSize: size,
    weight,
    overflow: false,
    text: texts.join('\n'),
  };
}

// One drawn text block: `kind` (data-text-block) only when the caller asked for ids (parity tests); lines are pinned unless pin: false.
const drawText = (layout, origin, ctx, o) => textLayoutToSvg(layout, origin, { pin: ctx?.pin !== false, ...o, kind: ctx?.ids ? o.kind : undefined });

// Doc card (AI-5): title bar plus the first lines of the document as PLAIN TEXT. Markdown is parsed by the safe parser and
// only its text is drawn: no links, no images, nothing but escaped <text>. The card has the same box as on the canvas, the
// excerpt is flowed by the shared layout at the canvas's 13 px / 1.5 (the card itself is rich HTML in the editor and scrolls, so
// its breaks can differ from these by the width slack).
const DOC_FONT = 13;
const DOC_LH = 1.5;
function docLines(markdown, width, size, maxVisible) {
  const raw = markdown ? docExcerptLines(markdown, 400, 1e9) : [];
  const out = [];
  for (const l of raw) {
    const font = { size, weight: l.bold ? 650 : 400, lineHeight: DOC_LH };
    for (const t of flowLines(l.text, width, font)) {
      out.push({ text: t, bold: !!l.bold });
      if (out.length > maxVisible + 1) return out;
    }
  }
  return out;
}

function renderDocFull(el, doc, b, theme, ctx) {
  const fs = fin(el.fontSize) ? Math.max(8, Math.min(120, el.fontSize)) : 20;
  const lh = fs * DOC_LH;
  const maxLines = Math.max(1, Math.floor(b.height / lh));
  const markdown = typeof doc.markdown === 'string' ? doc.markdown.slice(0, 6000) : '';
  const lines = docLines(markdown, b.width, fs, maxLines).slice(0, maxLines);
  const ink = safeColor(theme?.palette?.text, '#1e293b');
  return `<g>${lines.map((l, i) => drawText(pseudo([l.text], { size: fs, weight: l.bold ? 650 : 400, lh }), { x: b.x, y: b.y + i * lh }, ctx, { fill: ink, kind: 'doc' })).join('')}</g>`;
}

function renderDocCard(el, label, b, theme, ctx) {
  const doc = docOf(el) || {};
  if (doc.display === 'full') return renderDocFull(el, doc, b, theme, ctx);
  const title = (typeof doc.title === 'string' && doc.title.trim() ? doc.title : label || 'Untitled doc').replace(/\s+/g, ' ').trim();
  const bar = 40;
  const x = r1(b.x);
  const y = r1(b.y);
  const w = r1(b.width);
  const h = r1(b.height);
  const parts = [
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>`,
    `<path d="M${r1(b.x + 12)} ${r1(b.y + 11)}h8l4 4v12h-12z" fill="none" stroke="#4FB3CE" stroke-width="1.4" stroke-linejoin="round"/>`,
  ];
  const tl = layoutForSlot(el, { text: title, box: { x: 36, y: 0, width: Math.max(20, b.width - 36 - 56), height: bar }, role: 'title', mode: 'fixed', maxLines: 1, align: 'start', valign: 'middle', weight: 650 });
  parts.push(drawText(tl.layout, { x: b.x + tl.box.x, y: b.y + tl.box.y }, ctx, { fill: '#0f172a', kind: 'doc-title', box: tl.box }));
  if (doc.collapsed !== true && b.height > bar + 20) {
    const lh = DOC_FONT * DOC_LH;
    const maxLines = Math.max(0, Math.floor((b.height - bar - 8 - 4) / lh));
    const textW = Math.max(20, b.width - 2 - 24);
    const markdown = typeof doc.markdown === 'string' ? doc.markdown.slice(0, 4000) : '';
    const all = docLines(markdown, textW, DOC_FONT, maxLines);
    const shown = all.slice(0, maxLines);
    parts.push(`<line x1="${x}" y1="${r1(b.y + bar)}" x2="${r1(b.x + b.width)}" y2="${r1(b.y + bar)}" stroke="#e2e8f0" stroke-width="1"/>`);
    shown.forEach((l, i) => {
      let t = l.text;
      const weight = l.bold ? 650 : 400;
      if (i === shown.length - 1 && all.length > shown.length) {
        // more text follows: the last visible line ends in an ellipsis that the shared layout places (never cut mid-glyph)
        t = flowText({ text: `${l.text} ${all[shown.length].text}`, font: { size: DOC_FONT, weight, lineHeight: DOC_LH }, box: { width: textW, height: lh }, mode: 'fixed', limits: { maxLines: 1 }, align: 'start', valign: 'top' }).lines[0]?.text || l.text;
      }
      parts.push(drawText(pseudo([t], { size: DOC_FONT, weight, lh }), { x: b.x + 13, y: b.y + bar + 8 + i * lh }, ctx, { fill: l.bold ? '#0f172a' : '#334155', kind: 'doc-line' }));
    });
    if (shown.length === 0 && maxLines > 0) {
      parts.push(drawText(pseudo(['Empty doc'], { size: DOC_FONT, weight: 400, lh }), { x: b.x + 13, y: b.y + bar + 8 }, ctx, { fill: '#94a3b8', kind: 'doc-line', fontStyle: 'italic' }));
    }
  }
  return `<g>${parts.join('')}</g>`;
}

// ADR-0007 P2: a text preset drawn as plain <text> (escaped), wrapped by the single text-layout boundary, in the theme's colour
// and font. No card, no fill. Lines past the byte budget cap are dropped (the editor shows everything; this is a preview).
// The editor flows the same text in the browser (rich: bold, links), so a break can differ by the width slack.
const MAX_PRESET_LINES = 80;
function renderPresetText(el, b, theme, ctx) {
  const st = presetStyle(el, theme);
  const text = textOf(el) || { markdown: '', preset: 'body' };
  const lay = layoutText({ text: text.markdown, preset: text.preset, theme, box: { width: b.width }, fontSize: st.fontSize });
  const free = b.height - lay.height;
  const off = st.verticalAlign === 'middle' ? Math.max(0, free / 2) : st.verticalAlign === 'bottom' ? Math.max(0, free) : 0;
  const family = st.fontFamily;
  const fill = safeColor(st.color, '#1e293b');
  const out = [];
  for (const l of lay.lines.slice(0, MAX_PRESET_LINES)) {
    const weight = l.bold ? 700 : st.fontWeight;
    const p = pseudo([l.text], { size: st.fontSize, weight, lh: lay.lineHeight, family });
    const w = p.lines[0].width;
    const x0 = st.textAlign === 'center' ? b.x + (b.width - w) / 2 : st.textAlign === 'right' ? b.x + b.width - w : b.x + (l.x || 0);
    const origin = { x: x0, y: b.y + off + l.y };
    const common = { fill, family, fontStyle: st.fontStyle, kind: 'preset' };
    if (l.bullet) out.push(drawText(pseudo([l.bullet], { size: st.fontSize, weight, lh: lay.lineHeight, family }), { x: b.x + (l.x || 0) - st.fontSize * 1.0, y: origin.y }, ctx, common));
    out.push(drawText(p, origin, ctx, common));
  }
  return `<g>${out.join('')}</g>`;
}

// The element as the editor sees its geometry: the stored box (boundsOf supplies the stencil default for a missing size).
const sized = (el, b) => ({ ...el, size: { width: b.width, height: b.height } });

function renderElement(el0, meta, b, ctx) {
  const el = resolveElementTokens(el0, ctx?.theme);
  if (isPresetText(el)) return renderPresetText(el, b, ctx?.theme, ctx);
  const stencil = meta?.stencil;
  const shape = stencil?.shape || 'rect';
  const label = labelOf(el);
  const props = isObj(el.properties) ? el.properties : isObj(el.data) ? el.data : {};
  const policy = forcesExternalLabel(el.packId, el.type) ? externalPolicy(stencil || { id: el.type }) : policyFor(el.packId, stencil || { id: el.type });
  const sel = sized(el, b);
  const at = (box) => ({ x: b.x + box.x, y: b.y + box.y });

  if (shape === 'frame' || shape === 'section') {
    const accent = safeColor(el.color, safeColor(stencil?.color, '#64748b'));
    const bg = safeColor(el.backgroundColor ?? el.data?.backgroundColor ?? props.backgroundColor, shape === 'frame' ? '#ffffff' : 'none');
    const fill = bg === 'none' ? 'none' : bg;
    // the title is the one-line `title` slot of the stencil policy: ellipsis + badge when it does not fit, never over-printing
    const tl = label ? layoutForTitle(sel, policy, label) : null;
    const title = tl ? drawText(tl.layout, at(tl.box), ctx, { fill: accent, kind: 'title', box: tl.box }) : '';
    // a frame with a slide shape (ADR-0007) reads as a slide: square corners and a solid hairline instead of the dashed outline
    const slide = shape === 'frame' && isObj(el.data) && ['16:9', '4:3', '1:1'].includes(el.data.aspect);
    return slide
      ? `<g><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.width)}" height="${r1(b.height)}" fill="${fill}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>${title}</g>`
      : `<g><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.width)}" height="${r1(b.height)}" rx="6" fill="${fill}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 4"/>${title}</g>`;
  }
  if (shape === 'doc') return renderDocCard(el, label, b, ctx?.theme, ctx);
  const table = tableOf(el);
  if (table && shape === 'table') {
    // Columns, rows and cells (not just a box): same metrics as the canvas. Rows whose linked element is gone are drawn hollow.
    const drawn = renderTableSvg(table, b, { esc: escapeXml, r1, safeColor, linked: (id) => !ctx?.elementIds || ctx.elementIds.has(id) });
    const tl = label ? layoutForSlot(sel, { text: label, box: { x: 2, y: -26, width: Math.max(20, b.width - 4), height: 22 }, role: 'title', mode: 'fixed', maxLines: 1, align: 'start', valign: 'middle' }) : null;
    const title = tl ? drawText(tl.layout, at(tl.box), ctx, { fill: '#334155', kind: 'title', box: tl.box }) : '';
    return `<g>${title}${drawn.svg}</g>`;
  }
  if (shape === 'line') {
    const stroke = safeColor(el.color ?? el.borderColor, safeColor(stencil?.color, '#64748b'));
    const dl = label && policy.slot === 'external' ? layoutForExternal(sel, policy, label) : null;
    const text = dl ? drawText(dl.layout, at(dl.box), ctx, { fill: safeColor(el.textColor, '#334155'), kind: 'external', box: dl.box }) : '';
    return `<g><line x1="${r1(b.x)}" y1="${r1(b.y + b.height / 2)}" x2="${r1(b.x + b.width)}" y2="${r1(b.y + b.height / 2)}" stroke="${stroke}" stroke-width="2"/>${text}</g>`;
  }

  const base = safeColor(el.color, safeColor(stencil?.color, '#e2e8f0'));
  // Small round shapes (BPMN-style events) are drawn as a tinted ring like the pack renderers.
  const ring = (shape === 'circle' || shape === 'ellipse') && Math.min(b.width, b.height) <= 64 && !el.backgroundColor;
  const fill = ring ? '#ffffff' : safeColor(el.backgroundColor ?? el.fillColor, base);
  const stroke = safeColor(el.borderColor ?? el.strokeColor, ring ? base : shape === 'sticky' ? darken(fill, 0.85) : darken(base));
  const opacity = fin(el.opacity) ? Math.max(0.05, Math.min(1, el.opacity)) : 1;
  const shapeSvg = `${shapePath(shape, b, el.borderRadius)} fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} stroke="${stroke}" stroke-width="${shape === 'sticky' ? 1 : ring ? 2.5 : 2}"/>`;
  if (!label || policy.slot === 'none' || el.showLabel === false) return `<g>${shapeSvg}</g>`;
  const fam = typeof el.fontFamily === 'string' ? el.fontFamily : '';
  const style = { family: fam, fontStyle: el.fontStyle, decoration: el.textDecoration };
  // stencils whose canvas renderer draws the name in its own compartment, tab or header strip (labelSlots.js, shared with the packs)
  const bespoke = labelSlotFor(el.packId, sel, stencil, policy);
  if (bespoke) {
    const { layout, box } = layoutForSlot(sel, { text: label, ...bespoke.spec });
    const origin = { x: b.x + bespoke.origin.x + box.x - bespoke.delta, y: b.y + bespoke.origin.y + box.y - bespoke.delta };
    return `<g>${shapeSvg}${drawText(layout, origin, ctx, { ...style, fill: safeColor(el.textColor, pickLabelColor(fill)), kind: 'inside', box })}</g>`;
  }
  if (policy.slot === 'external') {
    const { layout, box } = layoutForExternal(sel, policy, label);
    return `<g>${shapeSvg}${drawText(layout, at(box), ctx, { ...style, fill: safeColor(el.textColor, '#334155'), kind: 'external', box })}</g>`;
  }
  if (policy.slot === 'title') {
    const { layout, box } = layoutForTitle(sel, policy, label);
    const rotate = box.rotate ? { deg: box.rotate, cx: b.x + (box.cx ?? box.x + box.width / 2), cy: b.y + (box.cy ?? box.y + box.height / 2) } : undefined;
    return `<g>${shapeSvg}${drawText(layout, at(box), ctx, { ...style, fill: safeColor(el.textColor, '#334155'), kind: 'title', box, rotate })}</g>`;
  }
  const { layout, box } = layoutForElement(sel, policy, label);
  return `<g>${shapeSvg}${drawText(layout, at(box), ctx, { ...style, fill: safeColor(el.textColor, pickLabelColor(fill)), kind: 'inside', box })}</g>`;
}

function portPoint(b, port) {
  switch (port) {
    case 'top': return { x: b.x + b.width / 2, y: b.y };
    case 'bottom': return { x: b.x + b.width / 2, y: b.y + b.height };
    case 'left': return { x: b.x, y: b.y + b.height / 2 };
    default: return { x: b.x + b.width, y: b.y + b.height / 2 };
  }
}

const SIDES = new Set(['top', 'bottom', 'left', 'right']);

function connectionPath(c, sb, tb) {
  const ports = resolveConnectionPorts(c, sb, tb);
  const sp = SIDES.has(ports.sourcePort) ? ports.sourcePort : 'right';
  const tp = SIDES.has(ports.targetPort) ? ports.targetPort : 'left';
  const s = portPoint(sb, sp);
  const t = portPoint(tb, tp);
  const waypoints = Array.isArray(c.waypoints) ? c.waypoints.filter((p) => isObj(p) && coord(p.x) && coord(p.y)).slice(0, 50) : [];
  const style = typeof c.lineStyle === 'string' ? c.lineStyle : 'curved';
  let d = '';
  try {
    if (style === 'straight') d = waypoints.length ? buildStraightPathThroughPoints([s, ...waypoints, t]) : buildStraightPath(s, t);
    else if (style === 'step' || style === 'step-sharp' || style === 'smart') {
      d = buildOrthogonalPath(s, t, sp, tp, { sharp: style === 'step-sharp', waypoints, sourceBounds: sb, targetBounds: tb }).path;
    } else if (style === 'arc') d = buildArcPath(s, t, sp, tp, fin(c.curveAmount) ? Math.max(-1e4, Math.min(1e4, c.curveAmount)) : null);
    else d = waypoints.length ? buildCurvedPathThroughPoints([s, ...waypoints, t]) : buildCurvedPath(s, t, sp, tp, fin(c.curveAmount) ? Math.max(-1e4, Math.min(1e4, c.curveAmount)) : null);
  } catch {
    d = '';
  }
  if (!d) d = `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
  // Path builders only emit commands and numbers; keep it that way before it lands in an attribute.
  if (!/^[MLCQAZHVSTmlcqazhvst0-9eE\s,.+-]*$/.test(d)) d = `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
  const mid = { x: (s.x + t.x) / 2, y: (s.y + t.y) / 2 };
  return { d, mid, gap: Math.hypot(t.x - s.x, t.y - s.y) };
}

function renderConnection(c, sb, tb, highlight, ctx) {
  const { d, mid, gap } = connectionPath(c, sb, tb);
  const stroke = highlight ? HIGHLIGHT_COLORS[highlight] : safeColor(c.color ?? c.strokeColor ?? c.style?.stroke, '#64748b');
  const width = highlight ? 3 : fin(c.strokeWidth) ? Math.max(1, Math.min(8, c.strokeWidth)) : 2;
  const dash = c.strokePattern === 'dashed' || c.dashed === true ? ' stroke-dasharray="6 4"' : c.strokePattern === 'dotted' ? ' stroke-dasharray="2 4"' : '';
  const label = typeof c.label === 'string' ? c.label : '';
  let lbl = '';
  if (label.trim()) {
    // the label rectangle is the measured lines plus padding (lib/text/connectionLabel), centered on the midpoint like the canvas
    const m = connectionLabelLayout(label, gap - 8); // the room between the two nodes: a label in a tight gap wraps instead of reaching a node
    const rx = mid.x - m.width / 2;
    const ry = mid.y - m.height / 2;
    lbl = `<rect x="${r1(rx)}" y="${r1(ry)}" width="${r1(m.width)}" height="${r1(m.height)}" rx="4" fill="#ffffff" fill-opacity="0.92"/>` +
      drawText(m.layout, { x: rx + m.textBox.x, y: ry + m.textBox.y }, ctx, { fill: '#334155', kind: 'connection', box: m.textBox });
  }
  const marker = c.endMarker === 'none' || c.arrow === false ? '' : ` marker-end="url(#${highlight ? `arrow-${highlight}` : 'arrow'})"`;
  return `<g><path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${dash}${marker}/>${lbl}</g>`;
}

function highlightBox(b, change) {
  const color = HIGHLIGHT_COLORS[change];
  const pad = 4;
  const fillOpacity = change === 'removed' ? 0.08 : 0.12;
  return `<rect x="${r1(b.x - pad)}" y="${r1(b.y - pad)}" width="${r1(b.width + pad * 2)}" height="${r1(b.height + pad * 2)}" rx="8" fill="${color}" fill-opacity="${fillOpacity}" stroke="${color}" stroke-width="3"${change === 'removed' ? ' stroke-dasharray="7 5"' : ''}/>`;
}

function unionBounds(boxes) {
  if (!boxes.length) return { x: 0, y: 0, width: 400, height: 240 };
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  for (const b of boxes) {
    x1 = Math.min(x1, b.x); y1 = Math.min(y1, b.y);
    x2 = Math.max(x2, b.x + b.width); y2 = Math.max(y2, b.y + b.height);
  }
  return { x: x1, y: y1, width: Math.max(1, x2 - x1), height: Math.max(1, y2 - y1) };
}

/**
 * @param {unknown} content stored diagram content ({elements, connections, ...})
 * @param {{elementIds?: Iterable<string>|null, highlight?: {added?: string[], changed?: string[], removed?: Array<{id: string, bounds: object}>,
 *          connections?: {added?: string[], changed?: string[]}}|null, maxElements?: number, maxConnections?: number, maxBytes?: number,
 *          labels?: boolean}} [opts]
 *   elementIds restricts the render to those elements (and the connections between them); null renders everything.
 * @returns {{svg: string|null, viewBox: {x,y,width,height}, counts: {elements: number, connections: number, highlighted: number},
 *            truncated: boolean, omitted: {elements: number, connections: number}, tooLarge?: boolean}}
 */
export function renderDiagramSvg(content, opts = {}) {
  const {
    elementIds = null,
    highlight = null,
    maxElements = DEFAULT_MAX_ELEMENTS,
    maxConnections = DEFAULT_MAX_CONNECTIONS,
    maxBytes = DEFAULT_MAX_SVG_BYTES,
  } = opts;
  const all = isObj(content) && Array.isArray(content.elements) ? content.elements.filter((e) => isObj(e) && typeof e.id === 'string' && e.id) : [];
  const conns = isObj(content) && Array.isArray(content.connections) ? content.connections.filter((c) => isObj(c) && typeof c.id === 'string') : [];
  const wanted = elementIds ? new Set(elementIds) : null;

  // Array order is z-order (frames are usually first); keep it.
  const candidates = [];
  for (const el of all) {
    if (wanted && !wanted.has(el.id)) continue;
    const meta = findStencilMeta(el.type, el.packId);
    const b = boundsOf(el, meta?.stencil);
    if (b) candidates.push({ el, meta, b });
  }
  const shown = candidates.slice(0, maxElements);
  const boxById = new Map(shown.map((s) => [s.el.id, s.b]));
  const shownConns = conns.filter((c) => boxById.has(c.sourceId) && boxById.has(c.targetId));
  const drawnConns = shownConns.slice(0, maxConnections);

  const added = new Set(highlight?.added || []);
  const changed = new Set(highlight?.changed || []);
  const connAdded = new Set(highlight?.connections?.added || []);
  const connChanged = new Set(highlight?.connections?.changed || []);
  const removed = (highlight?.removed || []).filter((r) => r && isObj(r.bounds) && coord(r.bounds.x) && coord(r.bounds.y) && fin(r.bounds.width) && r.bounds.width >= 0 && r.bounds.width <= SIZE_MAX && fin(r.bounds.height) && r.bounds.height >= 0 && r.bounds.height <= SIZE_MAX);
  // Removed elements are drawn as ghosts only when they were inside what is shown (or the whole board is shown).
  const removedShown = wanted ? removed.filter((r) => wanted.has(r.id)) : removed;

  const view = unionBounds([...shown.map((s) => s.b), ...removedShown.map((r) => r.bounds)]);
  const vb = { x: r1(view.x - PADDING), y: r1(view.y - PADDING - 16), width: r1(view.width + PADDING * 2), height: r1(view.height + PADDING * 2 + 16) };

  const defs =
    '<defs>' +
    ['arrow', ...Object.keys(HIGHLIGHT_COLORS).map((k) => `arrow-${k}`)]
      .map((idv) => {
        const color = idv === 'arrow' ? '#64748b' : HIGHLIGHT_COLORS[idv.slice(6)];
        return `<marker id="${idv}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${color}"/></marker>`;
      })
      .join('') +
    '</defs>';

  let highlighted = 0;
  const body = [];
  const ctx = { elementIds: new Set(all.map((e) => e.id)), theme: resolveTheme(isObj(content) ? content.theme : undefined), ids: opts.ids === true, pin: opts.pin !== false };
  for (const { el, meta, b } of shown) {
    const g = renderElement(el, meta, b, ctx);
    body.push(opts.ids ? g.replace(/^<g>/, `<g data-id="${escapeXml(el.id)}">`) : g);
  }
  for (const c of drawnConns) {
    const h = connAdded.has(c.id) ? 'added' : connChanged.has(c.id) ? 'changed' : null;
    if (h) highlighted += 1;
    body.push(renderConnection(c, boxById.get(c.sourceId), boxById.get(c.targetId), h, ctx));
  }
  const overlay = [];
  for (const { el, b } of shown) {
    const h = added.has(el.id) ? 'added' : changed.has(el.id) ? 'changed' : null;
    if (h) { overlay.push(highlightBox(b, h)); highlighted += 1; }
  }
  for (const r of removedShown) { overlay.push(highlightBox(r.bounds, 'removed')); highlighted += 1; }

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}" font-family="${escapeXml(FONT)}">` +
    `${defs}<rect x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="#f8fafc"/>` +
    `<g>${body.join('')}</g><g>${overlay.join('')}</g></svg>`;

  const result = {
    svg,
    viewBox: vb,
    counts: { elements: shown.length, connections: drawnConns.length, highlighted },
    truncated: candidates.length > shown.length || shownConns.length > drawnConns.length,
    omitted: { elements: candidates.length - shown.length, connections: shownConns.length - drawnConns.length },
  };
  if (Number.isFinite(maxBytes) && utf8Length(svg) > maxBytes) { // (no Buffer: this also runs in the browser, for dashboard thumbnails)
    result.svg = null;
    result.tooLarge = true;
  }
  return result;
}

// Building blocks shared with the compact, stencil-faithful renderer of diagram_show (lib/render/showSvg.js, ADR-0009).
export const internals = Object.freeze({ renderElement, shapePath, pseudo, drawText, highlightBox, unionBounds, labelOf, sized, darken, PADDING, SIZE_MAX, coord, fin, isObj, r1 });

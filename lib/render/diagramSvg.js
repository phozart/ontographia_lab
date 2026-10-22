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
import { docExcerptLines } from '../doc/markdown';
import { resolveTheme, resolveElementTokens } from '../present/themes';
import { isPresetText, presetStyle, textOf } from '../present/textPreset';
import { layoutText } from '../present/textLayout';

export const DEFAULT_MAX_ELEMENTS = 600;
export const DEFAULT_MAX_CONNECTIONS = 1200;
export const DEFAULT_MAX_SVG_BYTES = 96 * 1024;
const MAX_LABEL_CHARS = 160;
const PADDING = 40;
const FONT = "-apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Same colours as the slice-8 compare overlay (components/diagram-studio/ui/CompareOverlay.js COMPARE_COLORS). */
export const HIGHLIGHT_COLORS = Object.freeze({ added: '#2e9e5b', changed: '#e0a30b', removed: '#d64545' });

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
// Stored coordinates beyond this are corrupt, not content: drawing them would yield exponent notation or Infinity.
const COORD_MAX = 1e6;
const SIZE_MAX = 1e5;
const coord = (v) => fin(v) && Math.abs(v) <= COORD_MAX;
const r1 = (n) => Math.round(n * 10) / 10;

/** XML-escape text and attribute values (also strips control characters that are invalid in XML 1.0). */
export function escapeXml(value) {
  return String(value ?? '')
     
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

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

function labelOf(el) {
  const v = el.label ?? el.text ?? el.name ?? el.properties?.frameTitle ?? el.data?.frameTitle;
  if (typeof v !== 'string') return '';
  const flat = v.replace(/\s+/g, ' ').trim();
  return flat.length > MAX_LABEL_CHARS ? `${flat.slice(0, MAX_LABEL_CHARS - 1)}…` : flat;
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

/** Greedy word wrap with an average-glyph-width estimate (no font metrics on the server). */
export function wrapLabel(text, width, height, fontSize) {
  if (!text) return [];
  const perLine = Math.max(3, Math.floor((width - 12) / (fontSize * 0.56)));
  const maxLines = Math.max(1, Math.floor((height - 6) / (fontSize * 1.25)));
  const lines = [];
  let line = '';
  for (const word of text.split(' ')) {
    let w = word;
    while (w.length > perLine) {
      // hard-break words longer than a line
      if (line) { lines.push(line); line = ''; }
      lines.push(w.slice(0, perLine));
      w = w.slice(perLine);
    }
    if (!line) line = w;
    else if (line.length + 1 + w.length <= perLine) line += ` ${w}`;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    const last = kept[maxLines - 1];
    kept[maxLines - 1] = `${last.slice(0, Math.max(1, perLine - 1))}…`;
    return kept;
  }
  return lines;
}

function textBlock(lines, cx, cy, fontSize, color, weight = 400) {
  if (!lines.length) return '';
  const lh = fontSize * 1.25;
  const top = cy - ((lines.length - 1) * lh) / 2;
  const spans = lines
    .map((l, i) => `<tspan x="${r1(cx)}" y="${r1(top + i * lh)}">${escapeXml(l)}</tspan>`)
    .join('');
  return `<text font-size="${fontSize}" font-weight="${weight}" fill="${color}" text-anchor="middle" dominant-baseline="central">${spans}</text>`;
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

// Doc card (AI-5): title bar plus the first lines of the document as PLAIN TEXT. Markdown is parsed by the safe parser and
// only its text is drawn: no links, no images, nothing but escaped <text>. The card has the same box as on the canvas.
// ADR-0007 P2 `display: full`: the text alone (no card, no title), at the element's font size, in the theme's text colour.
function renderDocFull(el, doc, b, theme) {
  const fs = fin(el.fontSize) ? Math.max(8, Math.min(120, el.fontSize)) : 20;
  const lh = fs * 1.4;
  const maxLines = Math.max(1, Math.floor(b.height / lh));
  const chars = Math.max(8, Math.floor(b.width / (fs * 0.54)));
  const markdown = typeof doc.markdown === 'string' ? doc.markdown.slice(0, 6000) : '';
  const lines = docExcerptLines(markdown, maxLines, chars).slice(0, maxLines);
  const ink = safeColor(theme?.palette?.text, '#1e293b');
  return `<g>${lines.map((l, i) => `<text x="${r1(b.x)}" y="${r1(b.y + i * lh + fs)}" font-size="${fs}" font-weight="${l.bold ? 650 : 400}" fill="${ink}">${escapeXml(l.text)}</text>`).join('')}</g>`;
}

function renderDocCard(el, label, b, theme) {
  const doc = docOf(el) || {};
  if (doc.display === 'full') return renderDocFull(el, doc, b, theme);
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
  const titleChars = Math.max(4, Math.floor((b.width - 56) / 7.8));
  const shownTitle = title.length > titleChars ? `${title.slice(0, titleChars - 1)}\u2026` : title;
  parts.push(`<text x="${r1(b.x + 32)}" y="${r1(b.y + bar / 2)}" font-size="14" font-weight="650" fill="#0f172a" dominant-baseline="central">${escapeXml(shownTitle)}</text>`);
  if (doc.collapsed !== true && b.height > bar + 20) {
    const fs = 12;
    const lh = fs * 1.5;
    const maxLines = Math.max(0, Math.floor((b.height - bar - 14) / lh));
    const chars = Math.max(8, Math.floor((b.width - 28) / (fs * 0.56)));
    const markdown = typeof doc.markdown === 'string' ? doc.markdown.slice(0, 4000) : '';
    const lines = markdown ? docExcerptLines(markdown, maxLines + 1, chars) : [];
    const shown = lines.slice(0, maxLines);
    parts.push(`<line x1="${x}" y1="${r1(b.y + bar)}" x2="${r1(b.x + b.width)}" y2="${r1(b.y + bar)}" stroke="#e2e8f0" stroke-width="1"/>`);
    shown.forEach((l, i) => {
      const last = i === shown.length - 1 && lines.length > shown.length;
      const t = last ? `${l.text.slice(0, Math.max(1, chars - 1))}\u2026` : l.text;
      parts.push(`<text x="${r1(b.x + 14)}" y="${r1(b.y + bar + 10 + i * lh + lh / 2)}" font-size="${fs}" font-weight="${l.bold ? 650 : 400}" fill="${l.bold ? '#0f172a' : '#334155'}" dominant-baseline="central">${escapeXml(t)}</text>`);
    });
    if (shown.length === 0) parts.push(`<text x="${r1(b.x + 14)}" y="${r1(b.y + bar + 10 + lh / 2)}" font-size="${fs}" font-style="italic" fill="#94a3b8" dominant-baseline="central">Empty doc</text>`);
  }
  return `<g>${parts.join('')}</g>`;
}

// ADR-0007 P2: a text preset drawn as plain <text> (escaped), wrapped by the single text-layout boundary, in the theme's colour
// and font. No card, no fill. Lines past the byte budget cap are dropped (the editor shows everything; this is a preview).
const MAX_PRESET_LINES = 80;
function renderPresetText(el, b, theme) {
  const st = presetStyle(el, theme);
  const text = textOf(el) || { markdown: '', preset: 'body' };
  const lay = layoutText({ text: text.markdown, preset: text.preset, theme, box: { width: b.width }, fontSize: st.fontSize });
  const free = b.height - lay.height;
  const off = st.verticalAlign === 'middle' ? Math.max(0, free / 2) : st.verticalAlign === 'bottom' ? Math.max(0, free) : 0;
  const anchor = st.textAlign === 'center' ? 'middle' : st.textAlign === 'right' ? 'end' : 'start';
  const x0 = st.textAlign === 'center' ? b.x + b.width / 2 : st.textAlign === 'right' ? b.x + b.width : b.x;
  const common = `font-size="${r1(st.fontSize)}" font-style="${st.fontStyle}" fill="${safeColor(st.color, '#1e293b')}" font-family="${escapeXml(st.fontFamily)}"`;
  const out = [];
  for (const l of lay.lines.slice(0, MAX_PRESET_LINES)) {
    const y = r1(b.y + off + l.y + st.fontSize * st.lineHeight * 0.78);
    const weight = l.bold ? 700 : st.fontWeight;
    if (l.bullet) out.push(`<text x="${r1(b.x + (l.x || 0) - st.fontSize * 1.0)}" y="${y}" ${common} font-weight="${weight}">${escapeXml(l.bullet)}</text>`);
    out.push(`<text x="${r1(anchor === 'start' ? x0 + (l.x || 0) : x0)}" y="${y}" ${common} font-weight="${weight}" text-anchor="${anchor}">${escapeXml(l.text)}</text>`);
  }
  return `<g>${out.join('')}</g>`;
}

function renderElement(el0, meta, b, ctx) {
  const el = resolveElementTokens(el0, ctx?.theme);
  if (isPresetText(el)) return renderPresetText(el, b, ctx?.theme);
  const stencil = meta?.stencil;
  const shape = stencil?.shape || 'rect';
  const label = labelOf(el);
  const props = isObj(el.properties) ? el.properties : isObj(el.data) ? el.data : {};

  if (shape === 'frame' || shape === 'section') {
    const accent = safeColor(el.color, safeColor(stencil?.color, '#64748b'));
    const bg = safeColor(el.backgroundColor ?? el.data?.backgroundColor ?? props.backgroundColor, shape === 'frame' ? '#ffffff' : 'none');
    const fill = bg === 'none' ? 'none' : bg;
    const title = label ? `<text x="${r1(b.x + 4)}" y="${r1(b.y - 10)}" font-size="16" font-weight="600" fill="${accent}">${escapeXml(label)}</text>` : '';
    // a frame with a slide shape (ADR-0007) reads as a slide: square corners and a solid hairline instead of the dashed outline
    const slide = shape === 'frame' && isObj(el.data) && ['16:9', '4:3', '1:1'].includes(el.data.aspect);
    return slide
      ? `<g><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.width)}" height="${r1(b.height)}" fill="${fill}" stroke="${accent}" stroke-width="2" stroke-opacity="0.6"/>${title}</g>`
      : `<g><rect x="${r1(b.x)}" y="${r1(b.y)}" width="${r1(b.width)}" height="${r1(b.height)}" rx="6" fill="${fill}" stroke="${accent}" stroke-width="2" stroke-dasharray="8 4"/>${title}</g>`;
  }
  if (shape === 'doc') return renderDocCard(el, label, b, ctx?.theme);
  const table = tableOf(el);
  if (table && shape === 'table') {
    // Columns, rows and cells (not just a box): same metrics as the canvas. Rows whose linked element is gone are drawn hollow.
    const drawn = renderTableSvg(table, b, { esc: escapeXml, r1, safeColor, linked: (id) => !ctx?.elementIds || ctx.elementIds.has(id) });
    const title = label ? `<text x="${r1(b.x + 2)}" y="${r1(b.y - 8)}" font-size="15" font-weight="600" fill="#334155">${escapeXml(label)}</text>` : '';
    return `<g>${title}${drawn.svg}</g>`;
  }
  if (shape === 'line') {
    const stroke = safeColor(el.color ?? el.borderColor, safeColor(stencil?.color, '#64748b'));
    return `<g><line x1="${r1(b.x)}" y1="${r1(b.y + b.height / 2)}" x2="${r1(b.x + b.width)}" y2="${r1(b.y + b.height / 2)}" stroke="${stroke}" stroke-width="2"/></g>`;
  }

  const base = safeColor(el.color, safeColor(stencil?.color, '#e2e8f0'));
  // Small round shapes (BPMN-style events) are drawn as a tinted ring like the pack renderers, label below.
  const ring = (shape === 'circle' || shape === 'ellipse') && Math.min(b.width, b.height) <= 64 && !el.backgroundColor;
  const fill = ring ? '#ffffff' : safeColor(el.backgroundColor ?? el.fillColor, base);
  const stroke = safeColor(el.borderColor ?? el.strokeColor, ring ? base : shape === 'sticky' ? darken(fill, 0.85) : darken(base));
  const opacity = fin(el.opacity) ? Math.max(0.05, Math.min(1, el.opacity)) : 1;
  const fontSize = fin(el.fontSize) ? Math.max(8, Math.min(48, el.fontSize)) : shape === 'sticky' ? 14 : 13;
  const inset = shape === 'diamond' ? 0.72 : shape === 'circle' || shape === 'ellipse' ? 0.72 : 1;
  const inside = wrapLabel(label, b.width * inset, b.height * (shape === 'diamond' ? 0.7 : 1), fontSize);
  // A label that would be hard-broken or cut inside the shape goes below it instead (as the editor does for small shapes).
  const longestWord = label.split(' ').reduce((m, w) => Math.max(m, w.length), 0);
  const perLine = Math.floor((b.width * inset - 12) / (fontSize * 0.56));
  const below = ring || (label && (longestWord > perLine || inside.some((l) => l.endsWith('…'))) && shape !== 'rect' && shape !== 'sticky');
  const shapeSvg = `${shapePath(shape, b, el.borderRadius)} fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} stroke="${stroke}" stroke-width="${shape === 'sticky' ? 1 : ring ? 2.5 : 2}"/>`;
  if (below) {
    const lines = wrapLabel(label, Math.max(140, b.width * 2), fontSize * 1.25 * 3 + 6, fontSize);
    const top = b.y + b.height + 6 + (fontSize * 1.25) / 2;
    const textColor = safeColor(el.textColor, '#334155');
    return `<g>${shapeSvg}${textBlock(lines, b.x + b.width / 2, top + ((lines.length - 1) * fontSize * 1.25) / 2, fontSize, textColor)}</g>`;
  }
  const textColor = safeColor(el.textColor, pickLabelColor(fill));
  return `<g>${shapeSvg}${textBlock(inside, b.x + b.width / 2, b.y + b.height / 2, fontSize, textColor)}</g>`;
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
  return { d, mid };
}

function renderConnection(c, sb, tb, highlight) {
  const { d, mid } = connectionPath(c, sb, tb);
  const stroke = highlight ? HIGHLIGHT_COLORS[highlight] : safeColor(c.color ?? c.strokeColor ?? c.style?.stroke, '#64748b');
  const width = highlight ? 3 : fin(c.strokeWidth) ? Math.max(1, Math.min(8, c.strokeWidth)) : 2;
  const dash = c.strokePattern === 'dashed' || c.dashed === true ? ' stroke-dasharray="6 4"' : c.strokePattern === 'dotted' ? ' stroke-dasharray="2 4"' : '';
  const label = typeof c.label === 'string' ? c.label.replace(/\s+/g, ' ').trim().slice(0, 60) : '';
  let lbl = '';
  if (label) {
    const w = Math.min(360, label.length * 6.6 + 12);
    lbl = `<rect x="${r1(mid.x - w / 2)}" y="${r1(mid.y - 10)}" width="${r1(w)}" height="20" rx="4" fill="#ffffff" fill-opacity="0.92"/>` +
      `<text x="${r1(mid.x)}" y="${r1(mid.y)}" font-size="12" fill="#334155" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`;
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
  const ctx = { elementIds: new Set(all.map((e) => e.id)), theme: resolveTheme(isObj(content) ? content.theme : undefined) };
  for (const { el, meta, b } of shown) body.push(renderElement(el, meta, b, ctx));
  for (const c of drawnConns) {
    const h = connAdded.has(c.id) ? 'added' : connChanged.has(c.id) ? 'changed' : null;
    if (h) highlighted += 1;
    body.push(renderConnection(c, boxById.get(c.sourceId), boxById.get(c.targetId), h));
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
  if (Buffer.byteLength(svg, 'utf8') > maxBytes) {
    result.svg = null;
    result.tooLarge = true;
  }
  return result;
}

// lib/render/showSvg.js
// Compact, stencil-faithful SVG for diagram_show (spike, ADR-0009). Browser-safe itself (pure); the pack drawing comes in through
// `art` (lib/render/packArt.js, server-only), so this module can also serve a browser caller with a different art source later.
//
//  - every element is drawn in its own coordinates inside <g transform="translate(x y)"> and the picture is shifted so that numbers
//    stay short; attributes are single-quoted (no JSON escaping in the tool result) and lengthAdjust="spacing" (the default) is
//    left out;
//  - `art.draw` draws each element with its pack's own renderer; identical drawings (same stencil, size, colours and data) are
//    defined once and reused with <use>; elements the packs do not draw (frames, tables, docs, presets, generic shapes) use the
//    shared building blocks of diagramSvg.js;
//  - connections take the canvas's colours, arrow, label box and label placement (labelPositioning.js: the routed path's midpoint,
//    clear of the nodes, a leader tick when moved, endpoint labels);
//  - lod 'overview' draws a large board as frames with titles readable at the fit scale and simplified shapes (no text below a
//    readable size), and returns `regions` the view can zoom into (diagram_show with focus.frameId or focus.bbox).

import { findStencilMeta } from '../../components/diagram-studio/packs/catalog';
import { parseColor } from '../../components/diagram-studio/packs/colorUtils';
import { resolveConnectionPorts } from '../../components/diagram-studio/connections/geometry/autoPorts';
import {
  buildStraightPath,
  buildStraightPathThroughPoints,
  buildCurvedPath,
  buildCurvedPathThroughPoints,
  buildArcPath,
} from '../../components/diagram-studio/connections/geometry/pathBuilders';
import { buildOrthogonalPath } from '../../components/diagram-studio/connections/geometry/orthogonalRouting';
import { calculateMidLabelPosition, placeMidLabel, placeEndpointLabel } from '../../components/diagram-studio/connections/geometry/labelPositioning';
import { connectionLabelLayout, endpointLabelLayout } from '../text/connectionLabel';
import { layoutText as flowText } from '../text/layout';
import { escapeXml, FONT_STACK } from '../text/svg';
import { resolveTheme, resolveElementTokens } from '../present/themes';
import { isPresetText } from '../present/textPreset';
import { utf8Length } from '../doc/markdown';
import { internals, boundsOf, safeColor, HIGHLIGHT_COLORS } from './diagramSvg';

const { renderElement, shapePath, pseudo, drawText, highlightBox, unionBounds, labelOf, sized, PADDING, SIZE_MAX, coord, fin, isObj, r1 } = internals;

const CANVAS = Object.freeze({ line: '#475569', labelBg: '#f8fafc', labelBorder: '#e2e8f0', labelText: '#0f172a', bg: '#ffffff' });
const SYMBOL_MIN = 48; // drawings shorter than this are cheaper inline than as a <use>
export const OVERVIEW_VIEW_PX = 760; // the inline card's width: decides what is readable in the overview
const OVERVIEW_VIEW_PX_H = 600; // ...and a generous height (the full-screen view is taller than the inline card)
const SIDES = new Set(['top', 'bottom', 'left', 'right']);

function tint(hex, f = 0.86) {
  const rgb = parseColor(hex);
  if (!rgb) return '#f1f5f9';
  return `#${rgb.map((c) => Math.round(c + (255 - c) * f).toString(16).padStart(2, '0')).join('')}`;
}
const luminance = (hex) => {
  const rgb = parseColor(hex) || [255, 255, 255];
  return (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
};

function portPointAt(b, port, ratio = 0.5) {
  const r = fin(ratio) ? Math.max(0, Math.min(1, ratio)) : 0.5;
  switch (port) {
    case 'top': return { x: b.x + b.width * r, y: b.y };
    case 'bottom': return { x: b.x + b.width * r, y: b.y + b.height };
    case 'left': return { x: b.x, y: b.y + b.height * r };
    default: return { x: b.x + b.width, y: b.y + b.height * r };
  }
}

/** The canvas's label anchor (Connection.js): the orthogonal path's midpoint by length, else calculateMidLabelPosition; 15 px above. */
function canvasLabelAnchor(style, s, t, sp, tp, waypoints, sb, tb) {
  if (style === 'step' || style === 'step-sharp') {
    const r = buildOrthogonalPath(s, t, sp, tp, { sharp: style === 'step-sharp', waypoints, sourceBounds: sb, targetBounds: tb });
    const pts = r.points || [];
    if (pts.length >= 2) {
      const segs = [];
      let total = 0;
      for (let i = 0; i < pts.length - 1; i += 1) {
        const l = Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
        segs.push(l);
        total += l;
      }
      let acc = 0;
      for (let i = 0; i < segs.length; i += 1) {
        if (acc + segs[i] >= total / 2) {
          const k = segs[i] ? (total / 2 - acc) / segs[i] : 0;
          return { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k - 15 };
        }
        acc += segs[i];
      }
    }
  }
  return calculateMidLabelPosition(s, t, waypoints);
}

const grow = (b, m) => ({ x: b.x - m, y: b.y - m, width: b.width + 2 * m, height: b.height + 2 * m });
const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const shortNums = (d) => d.replace(/-?\d*\.?\d+(e-?\d+)?/gi, (n) => String(Math.round(parseFloat(n) * 10) / 10)).replace(/\s+/g, ' ').replace(/ ?([MLCQAZHVST]) ?/gi, '$1');

function connectionSvg(c, sb, tb, highlight, ctx, nodesNear) {
  const ports = resolveConnectionPorts(c, sb, tb);
  const sp = SIDES.has(ports.sourcePort) ? ports.sourcePort : 'right';
  const tp = SIDES.has(ports.targetPort) ? ports.targetPort : 'left';
  const s = portPointAt(sb, sp, c.sourceRatio);
  const t = portPointAt(tb, tp, c.targetRatio);
  const waypoints = Array.isArray(c.waypoints) ? c.waypoints.filter((p) => isObj(p) && coord(p.x) && coord(p.y)).map((p) => ({ x: p.x - ctx.ox, y: p.y - ctx.oy })).slice(0, 50) : [];
  const style = typeof c.lineStyle === 'string' ? c.lineStyle : 'curved';
  const curve = fin(c.curveAmount) ? Math.max(-1e4, Math.min(1e4, c.curveAmount)) : null;
  let d = '';
  try {
    if (style === 'straight') d = waypoints.length ? buildStraightPathThroughPoints([s, ...waypoints, t]) : buildStraightPath(s, t);
    else if (style === 'step' || style === 'step-sharp' || style === 'smart') d = buildOrthogonalPath(s, t, sp, tp, { sharp: style === 'step-sharp', waypoints, sourceBounds: sb, targetBounds: tb }).path;
    else if (style === 'arc') d = buildArcPath(s, t, sp, tp, curve);
    else d = waypoints.length ? buildCurvedPathThroughPoints([s, ...waypoints, t]) : buildCurvedPath(s, t, sp, tp, curve);
  } catch {
    d = '';
  }
  if (!d || !/^[MLCQAZHVSTmlcqazhvst0-9eE\s,.+-]*$/.test(d)) d = `M ${s.x} ${s.y} L ${t.x} ${t.y}`;
  d = shortNums(d);
  const stroke = highlight ? HIGHLIGHT_COLORS[highlight] : safeColor(c.stroke ?? c.color ?? c.strokeColor ?? c.style?.stroke, CANVAS.line);
  const width = highlight ? 3 : fin(c.strokeWidth) ? Math.max(1, Math.min(8, c.strokeWidth)) : 2;
  const dashed = c.strokePattern === 'dashed' || c.dashed === true || c.dashPattern === 'dashed';
  const dotted = c.strokePattern === 'dotted' || c.dashPattern === 'dotted';
  const dash = dashed ? ' stroke-dasharray="6 4"' : dotted ? ' stroke-dasharray="2 4"' : '';
  const marker = c.endMarker === 'none' || c.targetMarker === 'none' || c.arrow === false ? '' : ` marker-end="url(#${ctx.marker(stroke)})"`;
  let out = `<path d="${d}" stroke="${stroke}"${width !== 2 ? ` stroke-width="${width}"` : ''}${dash}${marker}/>`;
  if (ctx.lod === 'overview') return out;
  const gap = Math.round(Math.hypot(t.x - s.x, t.y - s.y));
  // endpoint (cardinality) labels first: the mid label keeps clear of them (Connection.js)
  const endRects = [];
  const endpointNodes = [sb, tb, ...nodesNear];
  const endLabel = (value, end, other) => {
    if (typeof value !== 'string' || !value.trim()) return;
    const box = endpointLabelLayout(value, Math.max(40, gap - 8));
    const center = placeEndpointLabel(end, other, { width: box.width, height: box.height }, [...endpointNodes, ...endRects]);
    endRects.push({ x: center.x - box.width / 2 - 2, y: center.y - box.height / 2 - 2, width: box.width + 4, height: box.height + 4 });
    out += drawText(box.layout, { x: center.x - box.width / 2 + box.textBox.x, y: center.y - box.height / 2 + box.textBox.y }, ctx, { fill: CANVAS.line, kind: 'endpoint', box: box.textBox });
  };
  endLabel(c.sourceLabel, s, t);
  endLabel(c.targetLabel, t, s);
  const label = typeof c.label === 'string' ? c.label : '';
  if (label.trim()) {
    const m = connectionLabelLayout(label, gap - 8);
    const anchor = canvasLabelAnchor(style, s, t, sp, tp, waypoints, sb, tb);
    const linePoint = { x: anchor.x, y: anchor.y + 15 };
    const size = { width: m.width, height: m.height };
    const clearOf = (pos, list) => !list.some((n) => pos.x - size.width / 2 < n.x + n.width && pos.x + size.width / 2 > n.x && pos.y - size.height / 2 < n.y + n.height && pos.y + size.height / 2 > n.y);
    let placed = null;
    for (const [mEnd, mOther] of [[14, 6], [0, 0]]) {
      const nodes = [grow(sb, mEnd), grow(tb, mEnd), ...nodesNear.map((o) => grow(o, mOther)), ...endRects];
      placed = placeMidLabel(anchor, linePoint, nodes, size);
      if (clearOf(placed.position, nodes)) break;
    }
    const p = placed.position;
    const x0 = p.x - m.width / 2;
    const y0 = p.y - m.height / 2;
    if (placed.leader) out += `<line x1="${r1(p.x)}" y1="${r1(p.y)}" x2="${r1(placed.leader.x)}" y2="${r1(placed.leader.y)}" stroke="${CANVAS.line}" stroke-dasharray="2 2"/>`;
    out += `<rect x="${r1(x0)}" y="${r1(y0)}" width="${r1(m.width)}" height="${r1(m.height)}" rx="4" fill="${CANVAS.labelBg}" stroke="${CANVAS.labelBorder}"/>` +
      drawText(m.layout, { x: x0 + m.textBox.x, y: y0 + m.textBox.y }, ctx, { fill: CANVAS.labelText, kind: 'connection', box: m.textBox });
  }
  return out;
}

const oneLine = (text, size, weight, width) => flowText({ text: text.replace(/\s+/g, ' '), font: { size, weight, lineHeight: 1.25 }, box: { width: Math.max(size, width), height: size * 1.3 }, mode: 'fixed', limits: { maxLines: 1 }, align: 'start', valign: 'top' }).lines[0]?.text || '';

/** Overview LOD: the shape in the canvas colours, no decorations; a one-line label only where it is readable at the fit scale. */
function overviewElement(el0, meta, b, ctx) {
  const el = resolveElementTokens(el0, ctx.theme);
  const stencil = meta?.stencil;
  const shape = stencil?.shape || 'rect';
  const label = labelOf(el);
  const base = safeColor(el.color, safeColor(stencil?.color, '#94a3b8'));
  const k = Math.max(ctx.scale, 0.02);
  if (shape === 'frame' || shape === 'section') {
    // a title readable on screen whatever the zoom, but never taller than a tenth of its frame (it must not cover the neighbours)
    const fs = Math.max(14, Math.min(600, 13 / k, b.height * 0.1));
    const t = label ? oneLine(label, fs, 600, b.width) : '';
    const title = t ? drawText(pseudo([t], { size: fs, weight: 600, lh: fs * 1.25 }), { x: 0, y: -fs * 1.35 }, ctx, { fill: base, kind: 'title' }) : '';
    const bg = safeColor(el.backgroundColor ?? el.data?.backgroundColor, shape === 'frame' ? '#ffffff' : 'none');
    return `<rect width="${r1(b.width)}" height="${r1(b.height)}" rx="6" fill="${bg}" stroke="${base}" stroke-width="${r1(Math.max(2, 1.5 / k))}" stroke-dasharray="${r1(8 / k)} ${r1(4 / k)}"/>${title}`;
  }
  const customDrawn = !(el.packId === 'core' && ['rect', 'circle', 'diamond'].includes(shape));
  const fill = safeColor(el.backgroundColor, customDrawn && luminance(base) < 0.8 ? tint(base) : base);
  const stroke = safeColor(el.borderColor, base);
  const shapeSvg = `${shapePath(shape === 'table' || shape === 'doc' || shape === 'line' ? 'rect' : shape, b, el.borderRadius)} fill="${fill}" stroke="${stroke}" stroke-width="${r1(Math.max(1.5, 1 / k))}"/>`;
  if (!label || 13 * k < 6 || b.width * k < 24) return shapeSvg;
  const fs = 13;
  const text = oneLine(label, fs, 500, b.width - 8);
  if (!text) return shapeSvg;
  const lay = pseudo([text], { size: fs, weight: 500, lh: fs * 1.3 });
  lay.lines[0].x = (b.width - lay.lines[0].width) / 2;
  return shapeSvg + drawText(lay, { x: 0, y: (b.height - fs * 1.3) / 2 }, ctx, { fill: luminance(fill) < 0.55 ? '#ffffff' : '#1f2937', kind: 'inside' });
}

/** Regions the view can zoom into: the frames, or a grid of occupied tiles when the board has none. */
function regionsOf(shown, view) {
  const centerIn = (b, r) => {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return cx >= r.x && cx <= r.x + r.width && cy >= r.y && cy <= r.y + r.height;
  };
  const frames = shown.filter((s) => s.meta?.stencil?.shape === 'frame');
  if (frames.length) {
    return frames.slice(0, 60).map(({ el, b }) => ({
      kind: 'frame', frameId: el.id, title: (labelOf(el) || 'Frame').replace(/\s+/g, ' ').slice(0, 80),
      bbox: { x: r1(b.x), y: r1(b.y), width: r1(b.width), height: r1(b.height) },
      count: shown.filter((s) => s.el.id !== el.id && centerIn(s.b, b)).length,
    }));
  }
  const n = shown.length > 400 ? 4 : 3;
  const out = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = 0; j < n; j += 1) {
      const r = { x: view.x + (view.width * j) / n, y: view.y + (view.height * i) / n, width: view.width / n, height: view.height / n };
      const count = shown.filter((s) => centerIn(s.b, r)).length;
      if (count) out.push({ kind: 'tile', title: `Area ${i * n + j + 1}`, bbox: { x: r1(r.x), y: r1(r.y), width: r1(r.width), height: r1(r.height) }, count });
    }
  }
  return out;
}

/**
 * @param {unknown} content stored diagram content
 * @param {{elementIds?: Iterable<string>|null, highlight?: object|null, art?: {draw: Function, newShared: Function, defsSvg: Function}|null,
 *          lod?: 'full'|'overview', maxElements?: number, maxConnections?: number, maxBytes?: number, ids?: boolean, pin?: boolean}} [opts]
 * @returns {{svg: string|null, viewBox: object, counts: object, truncated: boolean, omitted: object, lod: string, stats: object,
 *            regions?: object[], tooLarge?: boolean}}
 */
export function renderShowSvg(content, opts = {}) {
  const { elementIds = null, highlight = null, maxElements = 20000, maxConnections = 40000, maxBytes = Infinity, art = null, lod = 'full' } = opts;
  const all = isObj(content) && Array.isArray(content.elements) ? content.elements.filter((e) => isObj(e) && typeof e.id === 'string' && e.id) : [];
  const conns = isObj(content) && Array.isArray(content.connections) ? content.connections.filter((c) => isObj(c) && typeof c.id === 'string') : [];
  const wanted = elementIds ? new Set(elementIds) : null;
  const candidates = [];
  for (const el of all) {
    if (wanted && !wanted.has(el.id)) continue;
    const meta = findStencilMeta(el.type, el.packId);
    const b = boundsOf(el, meta?.stencil);
    if (b) candidates.push({ el, meta, b });
  }
  const shown = candidates.slice(0, maxElements);
  const removed = (highlight?.removed || []).filter((r) => r && isObj(r.bounds) && coord(r.bounds.x) && coord(r.bounds.y) && fin(r.bounds.width) && r.bounds.width >= 0 && r.bounds.width <= SIZE_MAX && fin(r.bounds.height) && r.bounds.height >= 0 && r.bounds.height <= SIZE_MAX);
  const removedShown = wanted ? removed.filter((r) => wanted.has(r.id)) : removed;
  const view = unionBounds([...shown.map((s) => s.b), ...removedShown.map((r) => r.bounds)]);
  const fitScale = Math.min(1, OVERVIEW_VIEW_PX / (view.width + PADDING * 2), OVERVIEW_VIEW_PX_H / (view.height + PADDING * 2));
  const titlePad = lod === 'overview' ? Math.min(600, 13 / Math.max(fitScale, 0.02)) * 1.5 : 16;
  const vb = { x: r1(view.x - PADDING), y: r1(view.y - PADDING - titlePad), width: r1(view.width + PADDING * 2), height: r1(view.height + PADDING * 2 + titlePad) };
  const ox = Math.round(vb.x);
  const oy = Math.round(vb.y);
  const shift = (b) => ({ x: b.x - ox, y: b.y - oy, width: b.width, height: b.height });
  const theme = resolveTheme(isObj(content) ? content.theme : undefined);
  const markers = new Map();
  const ctx = {
    elementIds: new Set(all.map((e) => e.id)), theme, ids: opts.ids === true, pin: opts.pin !== false, ox, oy, lod, scale: fitScale,
    marker: (color) => {
      if (!markers.has(color)) markers.set(color, `m${markers.size}`);
      return markers.get(color);
    },
  };
  const shared = art ? art.newShared() : null;
  const stats = { art: 0, generic: 0, unhandled: [], symbols: 0, uses: 0 };

  // ---- elements (pass 1: draw; pass 2: reuse identical drawings)
  const items = shown.map(({ el, meta, b }) => {
    const local = { x: 0, y: 0, width: b.width, height: b.height };
    if (lod === 'overview') return { el, b, body: overviewElement(el, meta, local, ctx) };
    if (art && !isPresetText(el)) {
      const r = art.draw(sized(resolveElementTokens(el, theme), b), meta?.stencil, shared, { pin: ctx.pin });
      if (r) {
        stats.art += 1;
        for (const u of r.unhandled) if (stats.unhandled.length < 50) stats.unhandled.push(`${el.packId}/${el.type}: ${u}`);
        return { el, b, art: r.art, text: r.text };
      }
    }
    stats.generic += 1;
    return { el, b, body: renderElement(el, meta, local, ctx).replace(/^<g>/, '').replace(/<\/g>$/, '') };
  });
  const counts = new Map();
  for (const it of items) if (it.art && it.art.length >= SYMBOL_MIN) counts.set(it.art, (counts.get(it.art) || 0) + 1);
  const symbols = new Map();
  for (const [a, n] of counts) if (n > 1) symbols.set(a, `s${symbols.size}`);
  stats.symbols = symbols.size;

  const frameBody = [];
  const nodeBody = [];
  for (const it of items) {
    const tr = `translate(${r1(it.b.x - ox)} ${r1(it.b.y - oy)})`;
    const id = opts.ids ? ` data-id="${escapeXml(it.el.id)}"` : '';
    let g;
    if (it.art !== undefined) {
      const sym = symbols.get(it.art);
      if (sym) stats.uses += 1;
      g = `<g transform="${tr}"${id}>${sym ? `<use href="#${sym}"/>` : it.art}${it.text}</g>`;
    } else g = `<g transform="${tr}"${id}>${it.body}</g>`;
    // the canvas stacks frames (z 1) under connections (z 2) under nodes (z 5)
    (it.el.type === 'frame' || it.el.type === 'section' ? frameBody : nodeBody).push(g);
  }

  // ---- connections (on shifted boxes, so path numbers are short)
  const boxById = new Map(shown.map((s) => [s.el.id, shift(s.b)]));
  const shownConns = conns.filter((c) => boxById.has(c.sourceId) && boxById.has(c.targetId));
  const drawnConns = shownConns.slice(0, maxConnections);
  const obstacles = lod === 'overview' ? [] : shown.filter((s) => s.meta?.stencil?.shape !== 'frame' && s.el.type !== 'frame').map((s) => ({ id: s.el.id, ...shift(s.b) }));
  const connAdded = new Set(highlight?.connections?.added || []);
  const connChanged = new Set(highlight?.connections?.changed || []);
  let highlighted = 0;
  const lines = [];
  for (const c of drawnConns) {
    const h = connAdded.has(c.id) ? 'added' : connChanged.has(c.id) ? 'changed' : null;
    if (h) highlighted += 1;
    const sb = boxById.get(c.sourceId);
    const tb = boxById.get(c.targetId);
    let near = [];
    if ((c.label || c.sourceLabel || c.targetLabel) && obstacles.length) {
      const zone = grow(unionBounds([sb, tb]), 260);
      near = obstacles.filter((o) => o.id !== c.sourceId && o.id !== c.targetId && overlaps(o, zone));
    }
    lines.push(connectionSvg(c, sb, tb, h, ctx, near));
  }

  // ---- highlight overlay (the compare colours, as before)
  const added = new Set(highlight?.added || []);
  const changed = new Set(highlight?.changed || []);
  const overlay = [];
  for (const { el, b } of shown) {
    const h = added.has(el.id) ? 'added' : changed.has(el.id) ? 'changed' : null;
    if (h) {
      overlay.push(highlightBox(shift(b), h));
      highlighted += 1;
    }
  }
  for (const r of removedShown) {
    overlay.push(highlightBox(shift(r.bounds), 'removed'));
    highlighted += 1;
  }

  const markerDefs = [...markers].map(([color, idv]) => `<marker id="${idv}" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="${color}"/></marker>`).join('');
  const symbolDefs = [...symbols].map(([a, idv]) => `<g id="${idv}">${a}</g>`).join('');
  const defs = `<defs>${markerDefs}${shared ? art.defsSvg(shared) : ''}${symbolDefs}</defs>`;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.x} ${vb.y} ${vb.width} ${vb.height}" width="${vb.width}" height="${vb.height}" font-family="${escapeXml(FONT_STACK)}">` +
    `${defs}<rect x="${vb.x}" y="${vb.y}" width="${vb.width}" height="${vb.height}" fill="${CANVAS.bg}"/>` +
    `<g transform="translate(${ox} ${oy})">${frameBody.join('')}<g fill="none">${lines.join('')}</g>${nodeBody.join('')}<g>${overlay.join('')}</g></g></svg>`;
  // single quotes: every literal quote inside values is already &quot; / &#39; (escapeXml), so all remaining " are delimiters
  svg = svg.replace(/ lengthAdjust="spacing"/g, '').replace(/"/g, "'");
  const result = {
    svg,
    viewBox: vb,
    counts: { elements: shown.length, connections: drawnConns.length, highlighted },
    truncated: candidates.length > shown.length || shownConns.length > drawnConns.length,
    omitted: { elements: candidates.length - shown.length, connections: shownConns.length - drawnConns.length },
    lod,
    stats,
  };
  if (lod === 'overview') result.regions = regionsOf(shown, view);
  if (Number.isFinite(maxBytes) && utf8Length(svg) > maxBytes) {
    result.svg = null;
    result.tooLarge = true;
  }
  return result;
}

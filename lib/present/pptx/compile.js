// lib/present/pptx/compile.js
// The slide IR for the PPTX export (ADR-0007 section 8.1, slice P3). Pure: content in, a plain description of every slide out;
// no React, no DOM, no pptxgenjs. The writer (write.js) turns the IR into a .pptx and the browser part captures the
// `picture` items (connected groups and pack stencils) as 2x PNGs.
//
// Classification (ADR 8.1):
//   native   : text presets (and legacy text blocks), core rectangle / circle / diamond / divider, sticky notes, tables,
//              docs, nested frames and sections (as a plain box with its title)
//   picture  : every element of another pack, every connection, and every element a connection touches. One picture per
//              connected component: the union box of the cluster, captured at 2x.
// Everything is relative to the slide frame's top-left, in board units; the writer converts to inches and points.

import { findStencilMeta } from '../../../components/diagram-studio/packs/catalog';
import { parseColor, pickLabelColor } from '../../../components/diagram-studio/packs/colorUtils';
import { boundsOf } from '../../render/diagramSvg';
import { resolveDeck, frameSize, frameAspectOf, isFrameElement } from '../presentationModel';
import { resolveTheme, resolveElementTokens, frameBackground, FONT_IDS, FONT_STACKS } from '../themes';
import { isPresetText, presetStyle, textOf, PRESET_SPECS } from '../textPreset';
import { tableOf, tableMetrics, cellText } from '../../table/tableModel';
import { docOf } from '../../doc/docElement';
import { policyFor } from '../../text/policy';
import { layoutForElement } from '../../text/fit';
import { buildParagraphs } from './textRuns';
import { safeNotes, safeLink, hex6 } from './mapping';

export const MAX_TABLE_ROWS_ON_SLIDE = 25; // the dialog warns above this (ADR 8.3)
const PICTURE_PAD = 24; // board units of room around a cluster for arrowheads and curved connectors
const CLUSTER_NATIVE = new Set(['core', 'sticky-notes']);
// the weights lib/present/textLayout.js lays presets out with (not the CSS weights): the PPTX must break lines the same way
const LAYOUT_WEIGHTS = Object.freeze({ title: 700, subtitle: 500, heading: 600, body: 400, caption: 400, quote: 400, number: 700 });
const HEADING_PRESETS = new Set(['title', 'subtitle', 'heading', 'number']);

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const fin = (v) => typeof v === 'number' && Number.isFinite(v);
const clean = (s, max = 300) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');

const hexOf = (v, fallback = null) => {
  const h = hex6(v);
  return h ? `#${h.toLowerCase()}` : fallback;
};
function darken(hex, f = 0.72) {
  const rgb = parseColor(hex) || [100, 116, 139];
  return `#${rgb.map((c) => Math.round(c * f).toString(16).padStart(2, '0')).join('')}`;
}
/** Blend two colours: t = 0 gives a, t = 1 gives b. */
export function mix(a, b, t) {
  const ca = parseColor(a) || [255, 255, 255];
  const cb = parseColor(b) || [0, 0, 0];
  return `#${ca.map((c, i) => Math.round(c + (cb[i] - c) * t).toString(16).padStart(2, '0')).join('')}`;
}

function themeFontIdOf(el, theme, role = 'body') {
  const stack = typeof el?.fontFamily === 'string' ? el.fontFamily : null;
  if (stack) {
    const id = FONT_IDS.find((f) => FONT_STACKS[f] === stack || stack.replace(/["']/g, '').startsWith(FONT_STACKS[f].replace(/["']/g, '').split(',')[0]));
    if (id) return id;
  }
  return theme.fonts[role] || theme.fonts.body;
}

const plainStart = (md) => String(md || '').replace(/[#*_`>~\[\]()-]+/g, ' ');
const labelOf = (el) => (typeof el.label === 'string' ? el.label : typeof el.name === 'string' ? el.name : '');
const boldOf = (w) => w === 'bold' || (Number(w) >= 600);

/** What kind of PPTX item an element becomes, or 'picture'. */
export function classify(el, meta) {
  const packId = el.packId || meta?.packId;
  const stencil = meta?.stencil;
  if (!stencil || !CLUSTER_NATIVE.has(packId)) return 'picture';
  const shape = stencil.shape;
  if (packId === 'core') {
    if (el.type === 'text-block') return 'text';
    if (shape === 'table') return tableOf(el) ? 'table' : 'picture';
    if (shape === 'doc') return docOf(el) ? 'doc' : 'picture';
    if (shape === 'frame' || shape === 'section') return 'container';
    if (shape === 'line') return 'line';
    if (shape === 'rect' || shape === 'circle' || shape === 'ellipse' || shape === 'diamond') return 'shape';
    return 'picture';
  }
  if (shape === 'sticky') return 'shape';
  if (shape === 'section') return 'container';
  return 'picture';
}

/** Union-find over the elements that connections touch. Returns Map<elementId, clusterId>. */
function connectedClusters(ids, connections) {
  const parent = new Map(ids.map((id) => [id, id]));
  const find = (a) => {
    let r = a;
    while (parent.get(r) !== r) r = parent.get(r);
    let c = a;
    while (parent.get(c) !== r) { const n = parent.get(c); parent.set(c, r); c = n; }
    return r;
  };
  const touched = new Set();
  for (const c of connections) {
    const s = c.sourceId;
    const t = c.targetId;
    if (parent.has(s)) touched.add(s);
    if (parent.has(t)) touched.add(t);
    if (parent.has(s) && parent.has(t)) parent.set(find(s), find(t));
  }
  return { find, touched };
}

const rectsTouch = (a, b) => a.x <= b.x + b.width && a.x + a.width >= b.x && a.y <= b.y + b.height && a.y + a.height >= b.y;

function baseShapeStyle(el, meta, theme) {
  const stencil = meta?.stencil;
  const base = hexOf(el.color, hexOf(stencil?.color, '#e2e8f0'));
  const sticky = stencil?.shape === 'sticky';
  const fill = hexOf(el.backgroundColor ?? el.fillColor, base);
  const stroke = hexOf(el.borderColor ?? el.strokeColor, sticky ? darken(fill, 0.85) : darken(base));
  const opacity = fin(el.opacity) ? Math.max(0.05, Math.min(1, el.opacity)) : 1;
  return { fill, stroke, opacity, sticky, themeText: theme.palette.text };
}

function labelText(el, meta, box, theme, k0) {
  // the label as the canvas lays it out inside the stored box (ADR-0008): the lines are explicit soft breaks
  const label = clean(labelOf(el), 500);
  if (!label) return null;
  const packId = el.packId || meta?.packId;
  const policy = policyFor(packId, meta?.stencil);
  const { layout, box: tb } = layoutForElement({ ...el, size: { width: box.w, height: box.h } }, policy, labelOf(el));
  const lines = layout.lines.map((l) => l.text);
  return {
    lines,
    fontSize: layout.fontSize,
    align: layout.align === 'center' ? 'center' : layout.align === 'end' ? 'right' : 'left',
    valign: layout.valign === 'top' ? 'top' : layout.valign === 'bottom' ? 'bottom' : 'middle',
    inset: { l: Math.max(0, tb.x), t: Math.max(0, tb.y), r: Math.max(0, box.w - tb.x - tb.width), b: Math.max(0, box.h - tb.y - tb.height) },
    overflow: !!layout.overflow,
    bold: boldOf(el.fontWeight),
    italic: el.fontStyle === 'italic',
    fontId: themeFontIdOf(el, theme),
    k0,
  };
}

function shapeItem(el, meta, rel, theme, warnings) {
  const st = baseShapeStyle(el, meta, theme);
  const shape = meta.stencil.shape;
  const noFill = el.type === 'text-block';
  const kind = shape === 'circle' || shape === 'ellipse' ? 'ellipse' : shape === 'diamond' ? 'diamond' : 'rect';
  const radius = kind === 'rect' && !st.sticky ? (fin(el.borderRadius) ? el.borderRadius : noFill ? 0 : 8) : 0;
  const text = labelText(el, meta, rel, theme);
  const fill = noFill && !el.backgroundColor && !el.fillColor ? null : st.fill;
  const color = hexOf(el.textColor, noFill && !fill ? theme.palette.text : st.sticky ? '#1f2937' : pickLabelColor(st.fill, '#374151'));
  if (text?.overflow) warnings.push(`"${clean(labelOf(el), 40)}" does not fit its shape; the text may overflow in PowerPoint`);
  return {
    kind: 'shape',
    id: el.id,
    box: rel,
    shape: kind,
    radius: Math.min(radius >= 999 ? Math.min(rel.w, rel.h) / 2 : radius, Math.min(rel.w, rel.h) / 2),
    fill,
    transparency: fill ? Math.round((1 - st.opacity) * 100) : 0,
    line: noFill && !el.borderColor ? null : { color: st.stroke, width: fin(el.borderWidth) ? el.borderWidth : st.sticky ? 1 : 2 },
    text: text ? { ...text, color } : null,
    name: clean(meta.stencil.name, 60),
  };
}

function containerItem(el, rel, theme) {
  const bg = hexOf(el.data?.backgroundColor ?? el.backgroundColor, null);
  const accent = hexOf(el.color, '#64748b');
  const title = clean(el.data?.frameTitle ?? el.data?.sectionTitle ?? labelOf(el), 120);
  return {
    kind: 'shape', id: el.id, box: rel, shape: 'rect', radius: 0, fill: bg, transparency: el.type === 'section' && bg ? 40 : 0,
    line: { color: accent, width: 1.5 },
    text: title ? { lines: [title], fontSize: 16, align: 'left', valign: 'top', inset: { l: 10, t: 8, r: 10, b: 8 }, bold: true, italic: false, fontId: theme.fonts.body, color: accent, overflow: false } : null,
    name: 'Container',
  };
}

function textItem(el, rel, theme, ctx, frameHeight, warnings) {
  const t = textOf(el);
  const st = presetStyle(el, theme);
  const spec = PRESET_SPECS[t.preset] || PRESET_SPECS.body;
  const role = spec.role;
  const built = buildParagraphs({
    markdown: t.markdown, fontSize: st.fontSize, width: rel.w, weight: LAYOUT_WEIGHTS[t.preset] || 400, lineHeight: st.lineHeight,
    family: theme.fonts[HEADING_PRESETS.has(t.preset) ? 'heading' : 'body'] || null, explicitBreaks: true, ctx,
  });
  const bottom = rel.y + Math.max(rel.h, built.height);
  if (bottom > frameHeight + 1) warnings.push(`A ${t.preset} text ("${clean(plainStart(t.markdown), 30)}") runs past the bottom of the slide; it overflows on the board too`);
  return {
    kind: 'text',
    id: el.id,
    preset: t.preset,
    box: { x: rel.x, y: rel.y, w: rel.w, h: Math.max(rel.h, Math.ceil(built.height * 1.08)) },
    fontSize: st.fontSize,
    fontId: theme.fonts[role] || theme.fonts.body,
    bold: boldOf(st.fontWeight),
    italic: st.fontStyle === 'italic',
    color: hexOf(st.color, theme.palette.text),
    align: st.textAlign,
    valign: st.verticalAlign,
    lineHeight: st.lineHeight,
    paragraphs: built.paragraphs,
    unmatched: built.unmatched,
  };
}

function tableItem(el, rel, theme) {
  const table = tableOf(el);
  const scale = fin(table.scale) && table.scale > 0 ? table.scale : 1;
  const m = tableMetrics(table, rel.w / scale);
  const gutter = 40; // the row-link gutter of the canvas table has no PPTX counterpart
  const cols = table.columns.map((c, i) => ({ id: c.id, type: c.type, width: m.colWidths[i] * scale, options: c.options }));
  const bg = theme.palette.bg;
  const textColor = theme.palette.text;
  const headerFill = mix(theme.palette.accent, bg, 0.82);
  const border = mix(textColor, bg, 0.78);
  const rows = [];
  let used = m.headerHeight * scale;
  const budget = Infinity;
  if (table.headerRow !== false) {
    rows.push({ height: m.headerHeight * scale, cells: table.columns.map((c) => ({ text: clean(c.name, 200), bold: true, fill: headerFill, color: textColor, align: c.type === 'number' ? 'right' : 'left' })) });
  }
  const bodyRows = table.rows.slice(0, 400);
  bodyRows.forEach((row, ri) => {
    const h = m.rowHeights[ri] * scale;
    used += h;
    rows.push({
      height: h,
      cells: table.columns.map((c, ci) => {
        const v = row.cells?.[c.id];
        const col = cols[ci];
        const cell = { text: v === undefined ? '' : c.type === 'boolean' ? (v ? '✓' : '–') : cellText(v), color: textColor, fill: bg, align: c.type === 'number' ? 'right' : c.type === 'boolean' ? 'center' : 'left', bold: table.headerColumn === true && ci === 0 };
        if (c.type === 'select' && typeof v === 'string') {
          const opt = (col.options || []).find((o) => (isObj(o) ? o.value : o) === v);
          if (opt?.color) cell.fill = mix(opt.color, bg, 0.65);
        }
        return cell;
      }),
    });
  });
  return {
    kind: 'table', id: el.id, box: { x: rel.x + gutter * scale, y: rel.y, w: rel.w - gutter * scale, h: used },
    colWidths: cols.map((c) => c.width), rows, headerRows: table.headerRow === false ? 0 : 1, border, fontSize: 12 * scale,
    fontId: theme.fonts.body, totalRows: table.rows.length, budget,
  };
}

function docItem(el, rel, theme, ctx, notes, warnings) {
  const doc = docOf(el);
  const title = clean(doc.title || labelOf(el) || 'Untitled doc', 200);
  const markdown = typeof doc.markdown === 'string' ? doc.markdown : '';
  const full = doc.display === 'full';
  const docLink = ctx.boardUrl ? safeLink(`#el=${el.id}`, ctx) : null;
  if (full) {
    const fs = fin(el.fontSize) ? Math.max(8, Math.min(200, el.fontSize)) : 20;
    const built = buildParagraphs({ markdown, fontSize: fs, width: rel.w, weight: 400, lineHeight: 1.5, family: theme.fonts.body, explicitBreaks: false, headingScales: true, maxHeight: rel.h, ctx });
    if (built.truncated) {
      notes.push(`Doc "${title}" is longer than its slide area; the slide shows the first part.${docLink ? ` Full text: ${docLink}` : ''}`);
      warnings.push(`The doc "${title}" is cut to fit its box (the rest is in the speaker notes link)`);
    }
    return { kind: 'text', id: el.id, preset: 'doc', box: rel, fontSize: fs, fontId: theme.fonts.body, bold: false, italic: false, color: hexOf(theme.palette.text), align: 'left', valign: 'top', lineHeight: 1.5, paragraphs: built.paragraphs, unmatched: 0, doc: true };
  }
  const fs = 13;
  const pad = 14;
  const titleH = 40;
  const collapsed = doc.collapsed === true;
  const built = collapsed ? { paragraphs: [], truncated: false } : buildParagraphs({ markdown, fontSize: fs, width: rel.w - pad * 2, weight: 400, lineHeight: 1.5, family: theme.fonts.body, explicitBreaks: false, headingScales: true, maxHeight: Math.max(0, rel.h - titleH - pad), ctx });
  if (built.truncated) {
    notes.push(`Doc "${title}" is longer than its card; the slide shows the first part.${docLink ? ` Full text: ${docLink}` : ''}`);
    warnings.push(`The doc "${title}" is cut to fit its card (the link to the rest is in the speaker notes)`);
  }
  return {
    kind: 'doc', id: el.id, box: rel, title, fontId: theme.fonts.body, titleSize: 13.5, fontSize: fs, paragraphs: built.paragraphs,
    fill: '#ffffff', line: { color: '#cbd5e1', width: 1.5 }, color: '#334155', titleColor: '#0f172a', pad, titleH,
  };
}

function lineItem(el, rel) {
  return { kind: 'line', id: el.id, box: { x: rel.x, y: rel.y + rel.h / 2, w: rel.w, h: 0 }, color: hexOf(el.color ?? el.borderColor, '#64748b'), width: 2 };
}

/**
 * Compile one presentation to the IR.
 * @param {{elements: object[], connections: object[], presentations: object[], theme?: object}} content
 * @param {string} presentationId
 * @param {{boardUrl?: string}} [opts]
 * @returns {{title: string, slides: object[], skipped: {hidden: number, missing: number}, warnings: string[]}|null}
 */
export function compileDeck(content, presentationId, opts = {}) {
  const resolved = resolveDeck(content, presentationId);
  if (!resolved) return null;
  const theme = resolveTheme(content.theme);
  const elements = (Array.isArray(content.elements) ? content.elements : []).filter((e) => isObj(e) && typeof e.id === 'string');
  const connections = (Array.isArray(content.connections) ? content.connections : []).filter((c) => isObj(c) && typeof c.id === 'string');
  const ctx = { boardUrl: opts.boardUrl };
  const warnings = [];
  const slides = [];
  let pictures = 0;

  for (const s of resolved.playable) {
    const frame = s.frame;
    const fs = frameSize(frame);
    const slideWarn = [];
    const notes = [];
    const frameBox = { x: frame.x || 0, y: frame.y || 0, width: fs.width, height: fs.height };
    const inside = [];
    for (const el0 of elements) {
      if (el0.id === frame.id) continue;
      const meta = findStencilMeta(el0.type, el0.packId);
      const b = boundsOf(el0, meta?.stencil);
      if (!b || !rectsTouch(b, frameBox)) continue;
      inside.push({ el: resolveElementTokens(el0, theme), meta, b, z: fin(el0.zIndex) ? el0.zIndex : 0, order: inside.length });
    }
    inside.sort((a, b) => a.z - b.z || a.order - b.order);
    const byId = new Map(inside.map((x) => [x.el.id, x]));
    const slideConns = connections.filter((c) => byId.has(c.sourceId) || byId.has(c.targetId));
    const { find, touched } = connectedClusters(inside.map((x) => x.el.id), slideConns);

    // which elements are pictures: another pack, or touched by a connection; a cluster pulls its whole component along
    const pictureIds = new Set();
    for (const x of inside) {
      const kind = classify(x.el, x.meta);
      if (kind === 'picture' || touched.has(x.el.id)) pictureIds.add(x.el.id);
      x.kind = kind;
    }
    const clusterRoots = new Set([...pictureIds].map(find));
    for (const x of inside) if (clusterRoots.has(find(x.el.id))) pictureIds.add(x.el.id);

    const items = [];
    const done = new Set();
    for (const x of inside) {
      const { el, meta, b } = x;
      const rel = { x: b.x - frameBox.x, y: b.y - frameBox.y, w: b.width, h: b.height };
      if (pictureIds.has(el.id)) {
        const root = find(el.id);
        if (done.has(root)) continue;
        done.add(root);
        const members = inside.filter((y) => pictureIds.has(y.el.id) && find(y.el.id) === root);
        const memberIds = new Set(members.map((y) => y.el.id));
        let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
        for (const y of members) { x0 = Math.min(x0, y.b.x); y0 = Math.min(y0, y.b.y); x1 = Math.max(x1, y.b.x + y.b.width); y1 = Math.max(y1, y.b.y + y.b.height); }
        for (const c of slideConns) {
          if (!memberIds.has(c.sourceId) && !memberIds.has(c.targetId)) continue;
          for (const p of Array.isArray(c.waypoints) ? c.waypoints : []) if (isObj(p) && fin(p.x) && fin(p.y)) { x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
        }
        // the cluster box plus room for arrowheads, clipped to the slide
        const cx0 = Math.max(frameBox.x, x0 - PICTURE_PAD);
        const cy0 = Math.max(frameBox.y, y0 - PICTURE_PAD);
        const cx1 = Math.min(frameBox.x + frameBox.width, x1 + PICTURE_PAD);
        const cy1 = Math.min(frameBox.y + frameBox.height, y1 + PICTURE_PAD);
        if (cx1 <= cx0 || cy1 <= cy0) continue;
        const labels = members.map((y) => clean(labelOf(y.el), 40)).filter(Boolean).slice(0, 8);
        items.push({
          kind: 'picture',
          key: `${s.slideId}:${items.length}`,
          id: root,
          box: { x: cx0 - frameBox.x, y: cy0 - frameBox.y, w: cx1 - cx0, h: cy1 - cy0 },
          world: { x: cx0, y: cy0, width: cx1 - cx0, height: cy1 - cy0 },
          elementIds: [...memberIds],
          connectionIds: slideConns.filter((c) => memberIds.has(c.sourceId) || memberIds.has(c.targetId)).map((c) => c.id),
          alt: `Diagram${labels.length ? `: ${labels.join(', ')}` : ''}`,
        });
        pictures += 1;
        continue;
      }
      if (x.kind === 'text') {
        if (isPresetText(el)) items.push(textItem(el, rel, theme, ctx, fs.height, slideWarn));
        else items.push(shapeItem(el, meta, rel, theme, slideWarn));
      } else if (x.kind === 'shape') items.push(shapeItem(el, meta, rel, theme, slideWarn));
      else if (x.kind === 'container') items.push(containerItem(el, rel, theme));
      else if (x.kind === 'table') {
        const t = tableItem(el, rel, theme);
        // rows that do not fit the slide are left out (ADR 8.3); the last row says how many
        const room = fs.height - rel.y;
        let acc = 0;
        const keep = [];
        let dropped = 0;
        t.rows.forEach((r, i) => {
          if (acc + r.height <= room + 1 || i < t.headerRows + 1) { keep.push(r); acc += r.height; } else dropped += 1;
        });
        if (dropped > 0) {
          keep.push({ height: 28 * (t.fontSize / 12 || 1), cells: [{ text: `… ${dropped} more row${dropped === 1 ? '' : 's'} on the board`, color: theme.palette.muted, fill: theme.palette.bg, colSpan: t.colWidths.length, align: 'left' }] });
          slideWarn.push(`A table has ${t.totalRows} rows; ${dropped} do not fit the slide and are left out`);
        }
        if (t.totalRows > MAX_TABLE_ROWS_ON_SLIDE) slideWarn.push(`A table has ${t.totalRows} rows (more than ${MAX_TABLE_ROWS_ON_SLIDE}); wrapping in PowerPoint will differ from the board`);
        t.rows = keep;
        t.box = { ...t.box, h: keep.reduce((a, r) => a + r.height, 0) };
        items.push(t);
      } else if (x.kind === 'doc') items.push(docItem(el, rel, theme, ctx, notes, slideWarn));
      else if (x.kind === 'line') items.push(lineItem(el, rel));
    }

    for (const it of items) if (it.kind === 'text' && it.unmatched) slideWarn.push('One text box could not keep the board line breaks; PowerPoint will wrap it');
    const allNotes = [safeNotes(s.notes), ...notes].filter(Boolean).join('\n\n');
    for (const w of slideWarn) warnings.push(`Slide ${s.n}: ${w}`);
    slides.push({
      n: s.n,
      slideId: s.slideId,
      frameId: frame.id,
      title: clean(s.title, 200),
      aspect: frameAspectOf(frame),
      frame: { width: fs.width, height: fs.height },
      background: hexOf(frameBackground(frame, theme), theme.palette.bg),
      items,
      notes: safeNotes(allNotes),
    });
  }
  return {
    title: clean(resolved.presentation.title, 200) || 'Presentation',
    slides,
    skipped: { hidden: resolved.slides.filter((x) => !x.missing && x.hidden).length, missing: resolved.slides.filter((x) => x.missing).length },
    pictures,
    warnings,
    theme,
  };
}

export { isFrameElement };

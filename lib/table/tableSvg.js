// lib/table/tableSvg.js
// Pure SVG drawing of a table element for the server renderer (diagram_show, lib/render/diagramSvg.js) and any other
// non-DOM consumer. Uses the same deterministic metrics as the canvas (tableMetrics), so rows line up with what the
// editor draws. Output is plain <g> markup; every user string is XML-escaped by the caller-supplied `esc`.

import { tableMetrics, cellText, LAYOUT } from './tableModel';

const ACCENT = '#4FB3CE';
const HEADER_FILL = '#e8f4f8';
const GRID = '#cbd5e1';
const INK = '#1e293b';
const MUTED = '#94a3b8';
const FONT_SIZE = 12;

function wrapText(text, width, maxLines) {
  const per = Math.max(1, Math.floor((width - LAYOUT.cellPadX) / LAYOUT.charWidth));
  const lines = [];
  for (const part of String(text).split('\n')) {
    let rest = part;
    if (rest === '') lines.push('');
    while (rest.length) {
      if (rest.length <= per) { lines.push(rest); break; }
      let cut = rest.lastIndexOf(' ', per);
      if (cut <= 0) cut = per;
      lines.push(rest.slice(0, cut).trimEnd());
      rest = rest.slice(cut).trimStart();
    }
  }
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = `${kept[maxLines - 1].slice(0, Math.max(0, per - 1))}…`;
    return kept;
  }
  return lines;
}

/**
 * @param {object} table element.data.table
 * @param {{x: number, y: number, width: number}} box element position; width scales the columns like the canvas does
 * @param {{esc: (s: string) => string, r1: (n: number) => number, safeColor: (v: unknown, fallback: string) => string, linked?: (elementId: string) => boolean}} h helpers
 * @returns {{svg: string, width: number, height: number}}
 */
export function renderTableSvg(table, box, { esc, r1, safeColor, linked = () => true, maxRows = 40 }) {
  const full = tableMetrics(table, box.width);
  // A huge table is drawn up to maxRows (the SVG has a byte budget); the footer says how many rows were left out.
  const more = Math.max(0, table.rows.length - maxRows);
  const shownTable = more ? { ...table, rows: table.rows.slice(0, maxRows) } : table;
  const m = { ...tableMetrics(shownTable, box.width), colWidths: full.colWidths };
  if (more) m.height += 24;
  const parts = [];
  const rect = (x, y, w, hgt, fill, stroke) => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(hgt)}" fill="${fill}"${stroke ? ` stroke="${stroke}" stroke-width="1"` : ''}/>`;
  const text = (x, y, s, { weight = 400, fill = INK, anchor = 'start' } = {}) =>
    `<text x="${r1(x)}" y="${r1(y)}" font-size="${FONT_SIZE}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

  parts.push(rect(box.x, box.y, m.width, m.height, '#ffffff', GRID));
  let y = box.y + 1;
  const colX = [];
  let x = box.x + LAYOUT.gutter;
  for (const w of m.colWidths) { colX.push(x); x += w; }

  if (m.headerHeight) {
    parts.push(rect(box.x + 1, y, m.width - 2, m.headerHeight, HEADER_FILL));
    table.columns.forEach((c, i) => {
      const name = c.name.length * LAYOUT.charWidth > m.colWidths[i] - LAYOUT.cellPadX ? `${c.name.slice(0, Math.max(1, Math.floor((m.colWidths[i] - LAYOUT.cellPadX) / LAYOUT.charWidth) - 1))}…` : c.name;
      parts.push(text(colX[i] + 10, y + m.headerHeight / 2 + 4, name, { weight: 600 }));
    });
    y += m.headerHeight;
  }
  shownTable.rows.forEach((row, ri) => {
    const rh = m.rowHeights[ri];
    parts.push(`<line x1="${r1(box.x)}" y1="${r1(y)}" x2="${r1(box.x + m.width)}" y2="${r1(y)}" stroke="${GRID}" stroke-width="1"/>`);
    if (row.elementId) {
      const live = linked(row.elementId);
      parts.push(`<circle cx="${r1(box.x + LAYOUT.gutter / 2)}" cy="${r1(y + rh / 2)}" r="4" fill="${live ? ACCENT : 'none'}" stroke="${live ? ACCENT : MUTED}" stroke-width="1.5"/>`);
    }
    table.columns.forEach((c, i) => {
      const v = row.cells?.[c.id];
      if (v === undefined) return;
      if (c.type === 'boolean') {
        parts.push(text(colX[i] + 10, y + rh / 2 + 4, v ? '✓' : '–', { fill: v ? ACCENT : MUTED }));
        return;
      }
      const lines = wrapText(cellText(v), m.colWidths[i], LAYOUT.maxLines);
      const opt = c.type === 'select' && Array.isArray(c.options) ? c.options.find((o) => o.value === v) : null;
      const startY = y + (rh - lines.length * LAYOUT.lineHeight) / 2 + FONT_SIZE;
      if (opt?.color) parts.push(`<rect x="${r1(colX[i] + 4)}" y="${r1(y + 6)}" width="${r1(Math.min(m.colWidths[i] - 8, cellText(v).length * LAYOUT.charWidth + 12))}" height="${r1(rh - 12)}" rx="4" fill="${safeColor(opt.color, ACCENT)}" fill-opacity="0.35"/>`);
      lines.forEach((ln, li) => {
        const num = c.type === 'number';
        parts.push(text(num ? colX[i] + m.colWidths[i] - 10 : colX[i] + 10, startY + li * LAYOUT.lineHeight, ln, { anchor: num ? 'end' : 'start' }));
      });
    });
    y += rh;
  });
  if (more) parts.push(text(box.x + LAYOUT.gutter + 10, y + 16, `… ${more} more row${more === 1 ? '' : 's'} (read them with table_get)`, { fill: MUTED }));
  // column separators
  for (let i = 0; i <= table.columns.length; i++) {
    const cx = i === 0 ? box.x + LAYOUT.gutter : colX[i - 1] + m.colWidths[i - 1];
    parts.push(`<line x1="${r1(cx)}" y1="${r1(box.y)}" x2="${r1(cx)}" y2="${r1(box.y + m.height)}" stroke="${GRID}" stroke-width="1"/>`);
  }
  return { svg: `<g>${parts.join('')}</g>`, width: m.width, height: m.height };
}

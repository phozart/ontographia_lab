// lib/table/tableModel.js
// Pure model of the table element (core/table): `element.data.table` = { headerRow, headerColumn, columns, rows }.
// Shared by the editor (inline editing, paste), the server validator, the MCP tools, the exporters and the merge.
// No React, no I/O. Every mutation returns a NEW table and throws TableError (a user-readable message) when a cap
// or a reference would be violated, so callers never persist a half-valid table.
//
// Shape (ids are stable: diff, merge and agent upserts all key on them, positions are not stable):
//   column: { id: 'col-…', name, type: 'text'|'number'|'select'|'boolean', width?, options?: [{value, color?}] }
//   row:    { id: 'row-…', cells: { [columnId]: string|number|boolean }, elementId? }   (empty cell = key absent)
//   `elementId` links a row to a board element (a "source" on the canvas). The link is by id only: when the element
//   is deleted the row keeps the id and the renderer shows plain text instead of a link.

import { generateId } from '../../components/diagram-studio/utils/ids';
import { layoutText } from '../text/layout';
import {
  MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, MAX_TABLE_CELLS, MAX_TABLE_CELL_CHARS, MAX_TABLE_OPTIONS,
} from '../diagramLimits';

export const COLUMN_TYPES = Object.freeze(['text', 'number', 'select', 'boolean']);
export const DEFAULT_COLUMN_WIDTH = 160;
export const MIN_COLUMN_WIDTH = 60;
export const MAX_COLUMN_WIDTH = 800;
export const OPTION_COLORS = Object.freeze(['#4FB3CE', '#E8A99A', '#F0D98A', '#9A8AC8', '#6A9FC9', '#C490B0']);

// Fixed layout metrics (px). Row heights are computed from the text (not measured from the DOM) so that the element
// size, the SVG export, the thumbnail and connector ports all agree with what the canvas draws.
export const LAYOUT = Object.freeze({
  gutter: 40, headerHeight: 36, rowMinHeight: 32, lineHeight: 17, rowPadY: 14, cellPadX: 20, maxLines: 5,
});

export class TableError extends Error {}
const fail = (message) => {
  throw new TableError(message);
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

export const isTableElement = (el) => isObj(el) && el.type === 'table' && (el.packId === undefined || el.packId === 'core');
export const tableOf = (el) => (isTableElement(el) && isObj(el.data) && isObj(el.data.table) ? el.data.table : null);

// ---------------------------------------------------------------- cells

/** Display / export text of a cell value. */
export function cellText(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return String(value);
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', '✓', '✔', 'on']);
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', 'off']);

/**
 * Convert raw input (a typed string, a pasted cell, a JSON value) to the value stored for a column type.
 * @returns {{ok: true, value: string|number|boolean|undefined} | {ok: false, error: string}} value undefined = empty cell
 */
export function coerceCell(type, raw) {
  if (raw === undefined || raw === null) return { ok: true, value: undefined };
  if (typeof raw === 'string' && raw === '' ) return { ok: true, value: undefined };
  if (type === 'number') {
    if (typeof raw === 'number') return Number.isFinite(raw) ? { ok: true, value: raw } : { ok: false, error: 'not a finite number' };
    if (typeof raw !== 'string') return { ok: false, error: 'expected a number' };
    const s = raw.trim();
    if (s === '') return { ok: true, value: undefined };
    const n = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) ? Number(s.replace(/,/g, '')) : Number(s);
    return Number.isFinite(n) && /^[-+]?(\d|\.\d)/.test(s) ? { ok: true, value: n } : { ok: false, error: `"${s.slice(0, 40)}" is not a number` };
  }
  if (type === 'boolean') {
    if (typeof raw === 'boolean') return { ok: true, value: raw };
    const s = String(raw).trim().toLowerCase();
    if (s === '') return { ok: true, value: undefined };
    if (TRUE_WORDS.has(s)) return { ok: true, value: true };
    if (FALSE_WORDS.has(s)) return { ok: true, value: false };
    return { ok: false, error: `"${s.slice(0, 40)}" is not true or false` };
  }
  const text = cellText(raw);
  if (text.length > MAX_TABLE_CELL_CHARS) return { ok: false, error: `text is too long (${text.length}); the limit is ${MAX_TABLE_CELL_CHARS} characters` };
  return { ok: true, value: text };
}

// ---------------------------------------------------------------- construction

export function newColumn({ name = 'Column', type = 'text', width, options } = {}, newId = generateId) {
  if (!COLUMN_TYPES.includes(type)) fail(`column type must be one of ${COLUMN_TYPES.join(', ')}`);
  const col = { id: newId('col'), name: String(name).slice(0, 200), type };
  if (width !== undefined) col.width = clampWidth(width);
  if (type === 'select' && Array.isArray(options) && options.length) col.options = normalizeOptions(options);
  return col;
}

export function newRow({ cells = {}, elementId } = {}, newId = generateId) {
  const row = { id: newId('row'), cells: { ...cells } };
  if (elementId) row.elementId = elementId;
  return row;
}

/** A fresh editor table: header row, 3 text columns, 3 empty rows. */
export function createEmptyTable({ columns = 3, rows = 3, newId = generateId } = {}) {
  return {
    headerRow: true,
    headerColumn: false,
    columns: Array.from({ length: columns }, (_, i) => newColumn({ name: `Column ${i + 1}` }, newId)),
    rows: Array.from({ length: rows }, () => newRow({}, newId)),
  };
}

function clampWidth(w) {
  const n = Number(w);
  return Number.isFinite(n) ? Math.min(MAX_COLUMN_WIDTH, Math.max(MIN_COLUMN_WIDTH, Math.round(n))) : DEFAULT_COLUMN_WIDTH;
}

export function normalizeOptions(options) {
  const out = [];
  const seen = new Set();
  for (const o of options) {
    const value = isObj(o) ? o.value : o;
    if (typeof value !== 'string' || value === '' || seen.has(value)) continue;
    if (out.length >= MAX_TABLE_OPTIONS) break;
    seen.add(value);
    const color = isObj(o) && typeof o.color === 'string' ? o.color : OPTION_COLORS[out.length % OPTION_COLORS.length];
    out.push({ value: value.slice(0, 200), color });
  }
  return out;
}

/** Select options with every value used in a cell (the column keeps working when values arrive from paste or agents). */
function withUsedOptions(col, rows) {
  if (col.type !== 'select') return col;
  const wanted = [...(col.options || [])];
  const seen = new Set(wanted.map((o) => (isObj(o) ? o.value : o)));
  for (const r of rows) {
    const v = r.cells?.[col.id];
    if (typeof v === 'string' && v !== '' && !seen.has(v) && wanted.length < MAX_TABLE_OPTIONS) {
      seen.add(v);
      wanted.push({ value: v.slice(0, 200) });
    }
  }
  const options = normalizeOptions(wanted);
  return options.length ? { ...col, options } : col;
}

// ---------------------------------------------------------------- lookup helpers

export const findColumn = (table, columnId) => table.columns.find((c) => c.id === columnId) || null;
export const findRow = (table, rowId) => table.rows.find((r) => r.id === rowId) || null;
export const cellCount = (table) => table.rows.reduce((n, r) => n + Object.keys(r.cells || {}).length, 0);

function mustColumn(table, columnId) {
  const c = findColumn(table, columnId);
  if (!c) fail(`Column "${String(columnId).slice(0, 60)}" does not exist`);
  return c;
}
function mustRow(table, rowId) {
  const r = findRow(table, rowId);
  if (!r) fail(`Row "${String(rowId).slice(0, 60)}" does not exist`);
  return r;
}
const replaceRow = (table, rowId, fn) => ({ ...table, rows: table.rows.map((r) => (r.id === rowId ? fn(r) : r)) });
const clampIndex = (i, len) => (Number.isInteger(i) ? Math.min(len, Math.max(0, i)) : len);

// ---------------------------------------------------------------- mutations

export function setCell(table, rowId, columnId, raw) {
  const col = mustColumn(table, columnId);
  mustRow(table, rowId);
  const c = coerceCell(col.type, raw);
  if (!c.ok) fail(c.error);
  const next = replaceRow(table, rowId, (r) => {
    const cells = { ...r.cells };
    if (c.value === undefined) delete cells[columnId];
    else cells[columnId] = c.value;
    return { ...r, cells };
  });
  if (cellCount(next) > MAX_TABLE_CELLS) fail(`A table holds at most ${MAX_TABLE_CELLS} cells`);
  return col.type === 'select' && c.value !== undefined ? { ...next, columns: next.columns.map((x) => (x.id === columnId ? withUsedOptions(x, next.rows) : x)) } : next;
}

export function addRow(table, { index, afterRowId, cells = {}, elementId } = {}, newId = generateId) {
  if (table.rows.length >= MAX_TABLE_ROWS) fail(`A table holds at most ${MAX_TABLE_ROWS} rows`);
  const at = afterRowId ? table.rows.findIndex((r) => r.id === afterRowId) + 1 : clampIndex(index, table.rows.length);
  const row = newRow({ cells, elementId }, newId);
  const rows = [...table.rows.slice(0, at), row, ...table.rows.slice(at)];
  if (rows.reduce((n, r) => n + Object.keys(r.cells || {}).length, 0) > MAX_TABLE_CELLS) fail(`A table holds at most ${MAX_TABLE_CELLS} cells`);
  return { ...table, rows };
}

export function removeRow(table, rowId) {
  mustRow(table, rowId);
  return { ...table, rows: table.rows.filter((r) => r.id !== rowId) };
}

export function moveRow(table, rowId, delta) {
  const from = table.rows.findIndex((r) => r.id === rowId);
  if (from < 0) fail(`Row "${String(rowId).slice(0, 60)}" does not exist`);
  const to = Math.min(table.rows.length - 1, Math.max(0, from + delta));
  if (to === from) return table;
  const rows = table.rows.slice();
  const [r] = rows.splice(from, 1);
  rows.splice(to, 0, r);
  return { ...table, rows };
}

export function setRowLink(table, rowId, elementId) {
  mustRow(table, rowId);
  return replaceRow(table, rowId, (r) => {
    const { elementId: _drop, ...rest } = r;
    return elementId ? { ...rest, elementId } : rest;
  });
}

export function addColumn(table, { index, afterColumnId, name, type = 'text', width, options } = {}, newId = generateId) {
  if (table.columns.length >= MAX_TABLE_COLUMNS) fail(`A table holds at most ${MAX_TABLE_COLUMNS} columns`);
  const col = newColumn({ name: name ?? `Column ${table.columns.length + 1}`, type, width, options }, newId);
  const at = afterColumnId ? table.columns.findIndex((c) => c.id === afterColumnId) + 1 : clampIndex(index, table.columns.length);
  return { ...table, columns: [...table.columns.slice(0, at), col, ...table.columns.slice(at)] };
}

export function removeColumn(table, columnId) {
  mustColumn(table, columnId);
  if (table.columns.length <= 1) fail('A table needs at least one column');
  return {
    ...table,
    columns: table.columns.filter((c) => c.id !== columnId),
    rows: table.rows.map((r) => {
      if (!has(r.cells || {}, columnId)) return r;
      const cells = { ...r.cells };
      delete cells[columnId];
      return { ...r, cells };
    }),
  };
}

export function moveColumn(table, columnId, delta) {
  const from = table.columns.findIndex((c) => c.id === columnId);
  if (from < 0) fail(`Column "${String(columnId).slice(0, 60)}" does not exist`);
  const to = Math.min(table.columns.length - 1, Math.max(0, from + delta));
  if (to === from) return table;
  const columns = table.columns.slice();
  const [c] = columns.splice(from, 1);
  columns.splice(to, 0, c);
  return { ...table, columns };
}

export function renameColumn(table, columnId, name) {
  mustColumn(table, columnId);
  return { ...table, columns: table.columns.map((c) => (c.id === columnId ? { ...c, name: String(name).slice(0, 200) } : c)) };
}

export function setColumnWidth(table, columnId, width) {
  mustColumn(table, columnId);
  return { ...table, columns: table.columns.map((c) => (c.id === columnId ? { ...c, width: clampWidth(width) } : c)) };
}

/** Change a column's type; cells that cannot be converted are emptied (counted in `dropped`; undo restores them). */
export function setColumnType(table, columnId, type) {
  const col = mustColumn(table, columnId);
  if (!COLUMN_TYPES.includes(type)) fail(`column type must be one of ${COLUMN_TYPES.join(', ')}`);
  if (col.type === type) return { table, dropped: 0 };
  let dropped = 0;
  const rows = table.rows.map((r) => {
    if (!has(r.cells || {}, columnId)) return r;
    const c = coerceCell(type, r.cells[columnId]);
    const cells = { ...r.cells };
    if (c.ok && c.value !== undefined) cells[columnId] = c.value;
    else {
      delete cells[columnId];
      if (!c.ok) dropped += 1;
    }
    return { ...r, cells };
  });
  const { options: _o, ...rest } = col;
  const columns = table.columns.map((c) => (c.id === columnId ? withUsedOptions({ ...rest, type }, rows) : c));
  return { table: { ...table, columns, rows }, dropped };
}

/** Stable sort of the rows by one column (numbers numerically, text by locale, empty cells last). Done once, not live. */
export function sortByColumn(table, columnId, direction = 'asc') {
  const col = mustColumn(table, columnId);
  const dir = direction === 'desc' ? -1 : 1;
  const rows = table.rows
    .map((r, i) => ({ r, i, v: r.cells?.[columnId] }))
    .sort((a, b) => {
      const ae = a.v === undefined;
      const be = b.v === undefined;
      if (ae || be) return ae && be ? a.i - b.i : ae ? 1 : -1;
      let c;
      if (col.type === 'number') c = a.v - b.v;
      else if (col.type === 'boolean') c = Number(a.v) - Number(b.v);
      else c = cellText(a.v).localeCompare(cellText(b.v), undefined, { numeric: true, sensitivity: 'base' });
      return c * dir || a.i - b.i;
    })
    .map((x) => x.r);
  return { ...table, rows };
}

export function setHeaderRow(table, on) {
  return { ...table, headerRow: Boolean(on) };
}

/** A pasted value is a number column candidate only when it is a plain decimal that survives Number() unchanged (no 007, +1, 1.50, 1,000). */
function roundTripsAsNumber(v) {
  const t = String(v).trim();
  return /^-?\d+(\.\d+)?$/.test(t) && String(Number(t)) === t;
}

/** Table built from a grid of raw strings (paste, CSV import). First row is the header when `header` is true. */
export function tableFromGrid(grid, { header = true, newId = generateId } = {}) {
  const lines = grid.filter((r) => r.some((c) => String(c).trim() !== ''));
  if (!lines.length) fail('Nothing to paste');
  const width = Math.max(...lines.map((r) => r.length));
  if (width > MAX_TABLE_COLUMNS) fail(`That sheet has ${width} columns; a table holds at most ${MAX_TABLE_COLUMNS}`);
  const body = header ? lines.slice(1) : lines;
  if (body.length > MAX_TABLE_ROWS) fail(`That sheet has ${body.length} rows; a table holds at most ${MAX_TABLE_ROWS}`);
  const names = header ? lines[0] : [];
  const columns = Array.from({ length: width }, (_, i) => {
    const name = String(names[i] ?? '').trim() || `Column ${i + 1}`;
    // Infer a number column when every non-empty cell parses as a number, boolean the same way (never select).
    const values = body.map((r) => r[i]).filter((v) => String(v ?? '').trim() !== '');
    const asNumber = values.length > 0 && values.every(roundTripsAsNumber);
    const asBool = !asNumber && values.length > 0 && values.every((v) => /^(true|false)$/i.test(String(v).trim()));
    return newColumn({ name, type: asNumber ? 'number' : asBool ? 'boolean' : 'text' }, newId);
  });
  const rows = body.map((r) => {
    const cells = {};
    columns.forEach((col, i) => {
      const c = coerceCell(col.type, r[i]);
      if (c.ok && c.value !== undefined) cells[col.id] = c.value; // types were inferred from these very cells
    });
    return newRow({ cells }, newId);
  });
  const table = { headerRow: header, headerColumn: false, columns, rows };
  if (cellCount(table) > MAX_TABLE_CELLS) fail(`That sheet has more than ${MAX_TABLE_CELLS} cells`);
  return table;
}

/**
 * Paste a grid of raw strings into an existing table starting at a cell (spreadsheet behaviour): rows are added as
 * needed (up to the cap), columns beyond the last one are ignored, values that do not fit their column type are
 * skipped and counted.
 * @returns {{table, skipped: number, written: number}}
 */
export function pasteGrid(table, grid, { rowId, columnId }, newId = generateId) {
  let t = table;
  const r0 = Math.max(0, t.rows.findIndex((r) => r.id === rowId));
  const c0 = Math.max(0, t.columns.findIndex((c) => c.id === columnId));
  let skipped = 0;
  let written = 0;
  grid.forEach((line, i) => {
    if (r0 + i >= t.rows.length) {
      if (t.rows.length >= MAX_TABLE_ROWS) { skipped += line.length; return; }
      t = addRow(t, {}, newId);
    }
    const id = t.rows[r0 + i].id;
    line.forEach((raw, j) => {
      const col = t.columns[c0 + j];
      if (!col) { skipped += 1; return; }
      const c = coerceCell(col.type, raw);
      if (!c.ok) { skipped += 1; return; }
      try {
        t = setCell(t, id, col.id, c.value === undefined ? '' : c.value);
        written += 1;
      } catch {
        skipped += 1;
      }
    });
  });
  return { table: t, skipped, written };
}

// ---------------------------------------------------------------- layout (deterministic, shared with exporters)

/** Column widths scaled so that gutter + columns fill `targetWidth` (resize scales proportionally). */
export function columnWidths(table, targetWidth) {
  const base = table.columns.map((c) => c.width || DEFAULT_COLUMN_WIDTH);
  if (!Number.isFinite(targetWidth)) return base;
  const sum = base.reduce((a, b) => a + b, 0);
  const avail = targetWidth - LAYOUT.gutter;
  if (!(avail > 0) || sum <= 0 || Math.abs(avail - sum) < 1) return base;
  return base.map((w) => Math.max(MIN_COLUMN_WIDTH / 2, Math.round((w * avail) / sum)));
}

// Cell text goes through the shared text layout (ADR-0008 7): the lines are the REAL wrapped lines at 12 px on the 17 px
// row line, so row heights, the canvas, the SVG drawing and connector ports agree. A clamped cell (past maxLines) ends
// in an ellipsis and reports `overflow`; the canvas and the SVG carry the full text as a tooltip.
const CELL_SIZE = 12;

/** Layout of one cell's text inside a column of `width` (padding excluded here). opts: {weight, align, maxLines}. */
export function cellLayout(text, width, opts = {}) {
  const maxLines = opts.maxLines || LAYOUT.maxLines;
  return layoutText({
    text: cellText(text),
    font: { size: CELL_SIZE, weight: opts.weight || 400, lineHeight: LAYOUT.lineHeight / CELL_SIZE },
    box: { width: Math.max(1, width - LAYOUT.cellPadX), height: maxLines * LAYOUT.lineHeight },
    mode: 'fixed',
    limits: { maxLines },
    align: opts.align || 'start',
    valign: 'top',
  });
}

/** Layout of a header name: one line (semi-bold), an ellipsis and the overflow flag when it does not fit. */
export const headerLayout = (text, width) => cellLayout(text, width, { weight: 600, maxLines: 1 });

export function wrappedLines(text, width) {
  return Math.min(LAYOUT.maxLines, Math.max(1, cellLayout(text, width).lines.length));
}

export function rowHeight(row, table, widths) {
  let lines = 1;
  table.columns.forEach((col, i) => {
    const v = row.cells?.[col.id];
    if (v === undefined || col.type !== 'text') return; // a select chip is one line; numbers and booleans do not wrap
    lines = Math.max(lines, wrappedLines(cellText(v), widths[i]));
  });
  return Math.max(LAYOUT.rowMinHeight, lines * LAYOUT.lineHeight + LAYOUT.rowPadY);
}

/** {width, height, colWidths, rowHeights, headerHeight}: the exact box the canvas, exports and ports use. */
export function tableMetrics(table, targetWidth) {
  const colWidths = columnWidths(table, targetWidth);
  const headerHeight = table.headerRow === false ? 0 : LAYOUT.headerHeight;
  const rowHeights = table.rows.map((r) => rowHeight(r, table, colWidths));
  return {
    colWidths,
    rowHeights,
    headerHeight,
    width: LAYOUT.gutter + colWidths.reduce((a, b) => a + b, 0),
    height: headerHeight + rowHeights.reduce((a, b) => a + b, 0) + 2,
  };
}

/** The element `size` for a table (call whenever the table changes; scaled widths are written back by the editor). */
export function tableElementSize(table) {
  const m = tableMetrics(table);
  return { width: m.width, height: m.height };
}

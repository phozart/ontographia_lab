// lib/table/tableCsv.js
// Delimited text <-> table: an RFC 4180 parser (quotes, doubled quotes, CRLF, newlines inside quotes) for pasted
// spreadsheet ranges (tab separated) and CSV, and CSV / JSON writers for export. Pure.
//
// CSV-injection guard (OWASP "CSV Injection"): a cell that a spreadsheet would read as a formula (starts with
// = + - @ TAB or CR) is exported with a leading single quote. Negative numbers are real numbers and are safe, so
// only TEXT that starts with - is prefixed (a number cell is written as a number).

import { cellText, tableFromGrid } from './tableModel';

const FORMULA_START = /^[=+\-@\t\r]/;

/** Escape one cell for CSV export (formula guard, then RFC 4180 quoting). */
export function csvCell(value, { numeric = false } = {}) {
  let s = cellText(value);
  if (!numeric && FORMULA_START.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Table as CSV text (header row first when the table has one). Rows end with CRLF per RFC 4180. */
export function tableToCsv(table, { includeLinks = false } = {}) {
  const cols = table.columns;
  const lines = [];
  if (table.headerRow !== false) lines.push([...cols.map((c) => csvCell(c.name)), ...(includeLinks ? ['element'] : [])].join(','));
  for (const row of table.rows) {
    const cells = cols.map((c) => csvCell(row.cells?.[c.id], { numeric: c.type === 'number' && typeof row.cells?.[c.id] === 'number' }));
    if (includeLinks) cells.push(csvCell(row.elementId || ''));
    lines.push(cells.join(','));
  }
  return lines.join('\r\n') + (lines.length ? '\r\n' : '');
}

/** Table as JSON text: an array of {column name: value} objects (names made unique), plus the ids for round trips. */
export function tableToJson(table) {
  const used = new Map();
  const names = table.columns.map((c) => {
    const n = used.get(c.name) || 0;
    used.set(c.name, n + 1);
    return n ? `${c.name} (${n + 1})` : c.name;
  });
  return JSON.stringify(
    {
      columns: table.columns.map((c, i) => ({ id: c.id, name: names[i], type: c.type })),
      rows: table.rows.map((r) => ({
        id: r.id,
        ...(r.elementId ? { elementId: r.elementId } : {}),
        values: Object.fromEntries(table.columns.map((c, i) => [names[i], r.cells?.[c.id] ?? null])),
      })),
    },
    null,
    2
  );
}

/**
 * Parse delimited text into a grid of strings. The delimiter is detected (tab wins when the first line has one: that is
 * what Sheets and Excel put on the clipboard) unless given.
 * @returns {string[][]}
 */
export function parseDelimited(text, delimiter) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const firstLine = src.split(/\r?\n/, 1)[0] || '';
  const d = delimiter || (firstLine.includes('\t') ? '\t' : ',');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  let started = false; // a quote only opens a quoted field at the start of a field
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"' && !started) { quoted = true; started = true; continue; }
    if (ch === d) { row.push(field); field = ''; started = false; continue; }
    if (ch === '\r' || ch === '\n') {
      if (ch === '\r' && src[i + 1] === '\n') i += 1;
      row.push(field); rows.push(row); row = []; field = ''; started = false;
      continue;
    }
    field += ch;
    started = true;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** True when clipboard text looks like a spreadsheet range worth turning into a table (2+ cells in a grid). */
export function looksTabular(text) {
  const s = String(text ?? '');
  if (!s.includes('\t') && !/\n/.test(s.trim())) return false;
  const grid = parseDelimited(s).filter((r) => r.some((c) => c.trim() !== ''));
  if (grid.length === 0) return false;
  const width = Math.max(...grid.map((r) => r.length));
  return width > 1 || grid.length > 1;
}

/** Pasted/imported text to a table. First row is the header unless `header: false`. */
export function tableFromText(text, opts = {}) {
  return tableFromGrid(parseDelimited(text, opts.delimiter), opts);
}

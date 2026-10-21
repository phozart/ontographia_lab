// lib/table/tableSchema.js
// Server-side validation of a table element's `data.table` (called by validateDiagramContent on every save and agent
// write). Pure. Closed schema: unknown keys are rejected so a table never carries hidden payloads.
//
//   table   { headerRow?: bool, headerColumn?: bool, columns: Column[1..50], rows: Row[0..500] }
//   Column  { id: /^col-[A-Za-z0-9_.:@+~-]+$/ (<=128, unique), name: string<=200, type, width?: 20..2000, options?: [{value, color?}] }
//   Row     { id: /^row-…/ (<=128, unique), cells: { [known column id]: string | number | bool typed by the column }, elementId?: string<=128 }
//   caps    <= 20,000 cells, a cell <= 2,000 characters, the table <= 512 KB serialized.
//
// `elementId` is NOT checked against the diagram here: a link outlives its element (the renderer shows plain text for
// a dangling link), and an autosave must never fail because the user deleted a source. Agent tools check links on
// write (lib/table/tablePatch.js).

import {
  MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, MAX_TABLE_CELLS, MAX_TABLE_CELL_CHARS, MAX_TABLE_BYTES, MAX_TABLE_OPTIONS,
} from '../diagramLimits';
import { COLUMN_TYPES, isTableElement } from './tableModel';

const ID_MAX = 128;
const COLOR = /^#[0-9a-f]{3,8}$/i;
export const TABLE_TOO_LARGE = 'data.table is larger than';
const COL_ID = /^col-[A-Za-z0-9_.:@+~-]+$/;
const ROW_ID = /^row-[A-Za-z0-9_.:@+~-]+$/;
const REF_ID = /^[A-Za-z0-9_.:@+~-]{1,128}$/;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const only = (obj, allowed) => Object.keys(obj).find((k) => !allowed.includes(k));

/** @returns {string|null} the first problem, as "path: message", or null when the table is valid */
export function tableProblem(table) {
  if (!isObj(table)) return 'data.table must be an object';
  const stray = only(table, ['headerRow', 'headerColumn', 'columns', 'rows']);
  if (stray) return `data.table.${stray.slice(0, 40)} is not a table field`;
  for (const k of ['headerRow', 'headerColumn']) if (table[k] !== undefined && typeof table[k] !== 'boolean') return `data.table.${k} must be true or false`;
  if (!Array.isArray(table.columns) || table.columns.length < 1) return 'data.table.columns must be an array with at least one column';
  if (table.columns.length > MAX_TABLE_COLUMNS) return `data.table.columns has ${table.columns.length} columns; the limit is ${MAX_TABLE_COLUMNS}`;
  if (!Array.isArray(table.rows)) return 'data.table.rows must be an array';
  if (table.rows.length > MAX_TABLE_ROWS) return `data.table.rows has ${table.rows.length} rows; the limit is ${MAX_TABLE_ROWS}`;

  const types = new Map();
  for (let i = 0; i < table.columns.length; i++) {
    const c = table.columns[i];
    const at = `data.table.columns[${i}]`;
    if (!isObj(c)) return `${at} must be an object`;
    const bad = only(c, ['id', 'name', 'type', 'width', 'options']);
    if (bad) return `${at}.${bad.slice(0, 40)} is not a column field`;
    if (typeof c.id !== 'string' || c.id.length > ID_MAX || !COL_ID.test(c.id)) return `${at}.id must be a string starting with "col-" (at most ${ID_MAX} characters)`;
    if (types.has(c.id)) return `${at}.id "${c.id.slice(0, 60)}" is used twice; column ids must be unique`;
    if (typeof c.name !== 'string' || c.name.length > 200) return `${at}.name must be a string of at most 200 characters`;
    if (!COLUMN_TYPES.includes(c.type)) return `${at}.type must be one of ${COLUMN_TYPES.join(', ')}`;
    if (c.width !== undefined && !(typeof c.width === 'number' && Number.isFinite(c.width) && c.width >= 20 && c.width <= 2000)) return `${at}.width must be a number between 20 and 2000`;
    if (c.options !== undefined) {
      if (c.type !== 'select') return `${at}.options is only for select columns`;
      if (!Array.isArray(c.options) || c.options.length > MAX_TABLE_OPTIONS) return `${at}.options must be an array of at most ${MAX_TABLE_OPTIONS} options`;
      for (let j = 0; j < c.options.length; j++) {
        const o = c.options[j];
        if (!isObj(o) || only(o, ['value', 'color']) || typeof o.value !== 'string' || o.value.length > 200 || (o.color !== undefined && (typeof o.color !== 'string' || !COLOR.test(o.color)))) {
          return `${at}.options[${j}] must be {value: string, color?: #hex}`;
        }
      }
    }
    types.set(c.id, c.type);
  }

  const rowIds = new Set();
  let cells = 0;
  for (let i = 0; i < table.rows.length; i++) {
    const r = table.rows[i];
    const at = `data.table.rows[${i}]`;
    if (!isObj(r)) return `${at} must be an object`;
    const bad = only(r, ['id', 'cells', 'elementId']);
    if (bad) return `${at}.${bad.slice(0, 40)} is not a row field`;
    if (typeof r.id !== 'string' || r.id.length > ID_MAX || !ROW_ID.test(r.id)) return `${at}.id must be a string starting with "row-" (at most ${ID_MAX} characters)`;
    if (rowIds.has(r.id)) return `${at}.id "${r.id.slice(0, 60)}" is used twice; row ids must be unique`;
    rowIds.add(r.id);
    if (r.elementId !== undefined && (typeof r.elementId !== 'string' || !REF_ID.test(r.elementId))) return `${at}.elementId must be an element id (a string of at most ${ID_MAX} characters)`;
    if (!isObj(r.cells)) return `${at}.cells must be an object keyed by column id`;
    for (const [colId, v] of Object.entries(r.cells)) {
      cells += 1;
      const type = types.get(colId);
      const where = `${at}.cells["${colId.slice(0, 60)}"]`;
      if (!type) return `${where} refers to a column that does not exist`;
      if (type === 'number') {
        if (typeof v !== 'number' || !Number.isFinite(v)) return `${where} must be a finite number (column type number)`;
      } else if (type === 'boolean') {
        if (typeof v !== 'boolean') return `${where} must be true or false (column type boolean)`;
      } else if (typeof v !== 'string') return `${where} must be a string (column type ${type})`;
      else if (v.length > MAX_TABLE_CELL_CHARS) return `${where} is too long (${v.length}); the limit is ${MAX_TABLE_CELL_CHARS} characters`;
    }
  }
  if (cells > MAX_TABLE_CELLS) return `data.table holds ${cells} cells; the limit is ${MAX_TABLE_CELLS}`;
  // bounded by the caps above, so serializing is cheap; JSON import and merge reject before the server does
  const json = JSON.stringify(table);
  const bytes = typeof TextEncoder !== 'undefined' ? new TextEncoder().encode(json).length : Buffer.byteLength(json, 'utf8');
  if (bytes > MAX_TABLE_BYTES) return `${TABLE_TOO_LARGE} ${MAX_TABLE_BYTES} bytes`;
  return null;
}

/**
 * Validate every table element of a content object.
 * @returns {null | {status: number, code: string, error: string}}
 */
export function validateTableElements(elements) {
  if (!Array.isArray(elements)) return null;
  for (const el of elements) {
    if (!isTableElement(el)) continue;
    const where = `element "${String(el.id).slice(0, 60)}"`;
    if (!isObj(el.data) || el.data.table === undefined) return { status: 400, code: 'VALIDATION_FAILED', error: `${where} is a table but has no data.table` };
    const problem = tableProblem(el.data.table);
    if (problem && problem.startsWith(TABLE_TOO_LARGE)) return { status: 413, code: 'PAYLOAD_TOO_LARGE', error: `${where}: ${problem}` };
    if (problem) return { status: 400, code: 'VALIDATION_FAILED', error: `${where}: ${problem}` };
  }
  return null;
}

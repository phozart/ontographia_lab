// lib/table/tablePatch.js
// Pure builders the MCP tools compile to (lib/mcp/tableTools.js -> ops `add_element` with `table`, and `table_patch`).
// Claude describes a table by column NAMES and cell values; this module assigns the stable ids, coerces and checks
// every value, and applies key upserts. Deterministic: the same input on the same table gives the same result.
//
// Spec shapes
//   columns:  [ "Name" | {name, type?: text|number|select|boolean, options?: string[]|{value,color?}[], width?} ]
//   row:      [cell, cell, ...]  (aligned to the columns)  |  {cells: [..] | {<column name or id>: value}, elementId?}
//   elementId links the row to a board element (validated against the diagram by `resolveElementId`); it may be an
//   `@ref` to an element created earlier in the same op batch.
// Patch (all optional, applied in this order): removeColumns, addColumns, renameColumns, setColumnTypes,
//   removeRowIds, removeKeys, upsertRows (+ `key`: the column to match rows by; a row with `id` matches by row id).

import { generateId } from '../../components/diagram-studio/utils/ids';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../diagramLimits';
import {
  COLUMN_TYPES, TableError, newColumn, newRow, coerceCell, cellText, setColumnType, findColumn, normalizeOptions,
  tableElementSize,
} from './tableModel';
import { tableProblem } from './tableSchema';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clip = (s, n = 60) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n);
const MAX_ERRORS = 20;

function collector() {
  const errors = [];
  return {
    errors,
    run(fn) {
      if (errors.length >= MAX_ERRORS) return undefined;
      try {
        return fn();
      } catch (e) {
        if (!(e instanceof TableError)) throw e;
        errors.push(e.message);
        return undefined;
      }
    },
  };
}

const fail = (m) => {
  throw new TableError(m);
};

function columnSpec(spec, at) {
  if (typeof spec === 'string') return { name: spec };
  if (!isObj(spec)) fail(`${at} must be a column name or {name, type?, options?, width?}`);
  const stray = Object.keys(spec).find((k) => !['name', 'type', 'options', 'width'].includes(k));
  if (stray) fail(`${at}: unknown field "${clip(stray, 30)}" (allowed: name, type, options, width)`);
  if (typeof spec.name !== 'string' || !spec.name.trim()) fail(`${at}.name must be a non-empty string`);
  if (spec.name.length > 200) fail(`${at}.name is too long (limit 200 characters)`);
  if (spec.type !== undefined && !COLUMN_TYPES.includes(spec.type)) fail(`${at}.type must be one of ${COLUMN_TYPES.join(', ')}`);
  if (spec.width !== undefined && !(typeof spec.width === 'number' && Number.isFinite(spec.width))) fail(`${at}.width must be a number`);
  if (spec.options !== undefined && (!Array.isArray(spec.options) || spec.options.length > 50)) fail(`${at}.options must be an array of at most 50 values`);
  return spec;
}

/** Resolve a column by id or by exact (case-insensitive) name. */
export function resolveColumn(table, ref, at = 'column') {
  if (typeof ref !== 'string' || !ref) fail(`${at} must be a column name or id`);
  const byId = findColumn(table, ref);
  if (byId) return byId;
  const same = table.columns.filter((c) => c.name.trim().toLowerCase() === ref.trim().toLowerCase());
  if (same.length === 1) return same[0];
  if (same.length > 1) fail(`${at} "${clip(ref)}" matches ${same.length} columns; use the column id`);
  fail(`${at} "${clip(ref)}" is not a column (columns: ${table.columns.map((c) => `"${clip(c.name, 30)}"`).slice(0, 12).join(', ')})`);
  return null;
}

function cellsFromSpec(table, cells, at, { allowNull }) {
  const out = {};
  const clear = [];
  const set = (col, raw, label) => {
    if (raw === null && allowNull) { clear.push(col.id); return; }
    if (raw !== null && typeof raw === 'object') fail(`${label}: a cell holds a string, number or boolean`);
    const c = coerceCell(col.type, raw);
    if (!c.ok) fail(`${label} (column "${clip(col.name, 30)}", ${col.type}): ${c.error}`);
    if (c.value !== undefined) out[col.id] = c.value;
  };
  if (Array.isArray(cells)) {
    if (cells.length > table.columns.length) fail(`${at}.cells has ${cells.length} values but the table has ${table.columns.length} columns`);
    cells.forEach((raw, i) => set(table.columns[i], raw, `${at}.cells[${i}]`));
  } else if (isObj(cells)) {
    for (const [ref, raw] of Object.entries(cells)) set(resolveColumn(table, ref, `${at}.cells key`), raw, `${at}.cells["${clip(ref, 30)}"]`);
  } else fail(`${at}.cells must be an array (aligned to the columns) or an object keyed by column name`);
  return { cells: out, clear };
}

function rowSpec(spec, at) {
  if (Array.isArray(spec)) return { cells: spec };
  if (!isObj(spec)) fail(`${at} must be an array of cell values or {cells, elementId?}`);
  const stray = Object.keys(spec).find((k) => !['cells', 'elementId', 'id'].includes(k));
  if (stray) fail(`${at}: unknown field "${clip(stray, 30)}" (allowed: cells, elementId${at.includes('upsert') ? ', id' : ''})`);
  return spec;
}

function link(spec, at, resolveElementId) {
  if (spec.elementId === undefined) return undefined;
  if (typeof spec.elementId !== 'string' || !spec.elementId) fail(`${at}.elementId must be an element id`);
  return resolveElementId ? resolveElementId(spec.elementId, `${at}.elementId`) : spec.elementId;
}

/**
 * New table from {columns, rows}.
 * @returns {{ok: true, table, columnIds: string[], rowIds: string[]} | {ok: false, errors: string[]}}
 */
export function buildTableFromSpec(input, { newId = generateId, resolveElementId } = {}) {
  const { errors, run } = collector();
  if (!isObj(input)) return { ok: false, errors: ['table must be an object {columns, rows}'] };
  const stray = Object.keys(input).find((k) => !['columns', 'rows', 'headerRow'].includes(k));
  if (stray) return { ok: false, errors: [`table: unknown field "${clip(stray, 30)}" (allowed: columns, rows, headerRow)`] };
  if (!Array.isArray(input.columns) || input.columns.length < 1) return { ok: false, errors: ['columns must be a non-empty array'] };
  if (input.columns.length > MAX_TABLE_COLUMNS) return { ok: false, errors: [`Too many columns (${input.columns.length}); the limit is ${MAX_TABLE_COLUMNS}`] };
  const rowsIn = input.rows === undefined ? [] : input.rows;
  if (!Array.isArray(rowsIn)) return { ok: false, errors: ['rows must be an array'] };
  if (rowsIn.length > MAX_TABLE_ROWS) return { ok: false, errors: [`Too many rows (${rowsIn.length}); the limit is ${MAX_TABLE_ROWS}`] };
  if (input.headerRow !== undefined && typeof input.headerRow !== 'boolean') return { ok: false, errors: ['headerRow must be true or false'] };

  const columns = [];
  const seen = new Set();
  input.columns.forEach((c, i) =>
    run(() => {
      const s = columnSpec(c, `columns[${i}]`);
      const key = s.name.trim().toLowerCase();
      if (seen.has(key)) fail(`columns[${i}]: duplicate column name "${clip(s.name, 40)}"`);
      seen.add(key);
      columns.push(newColumn({ name: s.name.trim(), type: s.type || 'text', width: s.width, options: s.options }, newId));
    })
  );
  if (errors.length) return { ok: false, errors };

  let table = { headerRow: input.headerRow !== false, headerColumn: false, columns, rows: [] };
  const rows = [];
  rowsIn.forEach((r, i) =>
    run(() => {
      const at = `rows[${i}]`;
      const s = rowSpec(r, at);
      const { cells } = cellsFromSpec(table, s.cells ?? [], at, { allowNull: false });
      rows.push(newRow({ cells, elementId: link(s, at, resolveElementId) }, newId));
    })
  );
  if (errors.length) return { ok: false, errors };

  table = { ...table, rows };
  // select columns learn their options from the values that were given
  table = { ...table, columns: table.columns.map((c) => (c.type === 'select' ? withOptionsFromRows(c, rows) : c)) };
  const problem = tableProblem(table);
  if (problem) return { ok: false, errors: [problem] };
  return { ok: true, table, columnIds: table.columns.map((c) => c.id), rowIds: rows.map((r) => r.id) };
}

function withOptionsFromRows(col, rows) {
  const values = [...(col.options || [])];
  const seen = new Set(values.map((o) => o.value));
  for (const r of rows) {
    const v = r.cells[col.id];
    if (typeof v === 'string' && !seen.has(v)) { seen.add(v); values.push({ value: v }); }
  }
  const options = normalizeOptions(values);
  return options.length ? { ...col, options } : col;
}

const norm = (v) => (typeof v === 'number' || typeof v === 'boolean' ? String(v) : cellText(v).trim().toLowerCase());

const PATCH_FIELDS = ['key', 'addColumns', 'renameColumns', 'setColumnTypes', 'removeColumns', 'upsertRows', 'removeRowIds', 'removeKeys'];
export const PATCH_KEYS = PATCH_FIELDS;

/**
 * Apply a table_update patch.
 * @returns {{ok: true, table, inserted: number, updated: number, removed: number, columnIds: string[], rowIds: string[], warnings: string[]}
 *          | {ok: false, errors: string[]}}
 */
export function applyTablePatch(table, patch, { newId = generateId, resolveElementId } = {}) {
  const { errors, run } = collector();
  const warnings = [];
  if (!isObj(patch)) return { ok: false, errors: ['patch must be an object'] };
  const stray = Object.keys(patch).find((k) => !PATCH_FIELDS.includes(k));
  if (stray) return { ok: false, errors: [`Unknown field "${clip(stray, 30)}"; allowed: ${PATCH_FIELDS.join(', ')}`] };
  const arrays = PATCH_FIELDS.filter((k) => k !== 'key');
  for (const k of arrays) if (patch[k] !== undefined && !Array.isArray(patch[k])) return { ok: false, errors: [`${k} must be an array`] };
  if (patch.key !== undefined && typeof patch.key !== 'string') return { ok: false, errors: ['key must be a column name or id'] };
  if (!arrays.some((k) => patch[k] !== undefined && patch[k].length)) return { ok: false, errors: ['Nothing to do: give at least one of ' + arrays.join(', ')] };

  let t = table;
  const columnIds = [];
  const rowIds = [];
  let inserted = 0;
  let updated = 0;
  let removed = 0;

  (patch.removeColumns || []).forEach((ref, i) =>
    run(() => {
      const col = resolveColumn(t, ref, `removeColumns[${i}]`);
      if (t.columns.length <= 1) fail('A table needs at least one column');
      t = { ...t, columns: t.columns.filter((c) => c.id !== col.id), rows: t.rows.map((r) => { const cells = { ...r.cells }; delete cells[col.id]; return { ...r, cells }; }) };
    })
  );
  (patch.addColumns || []).forEach((c, i) =>
    run(() => {
      const s = columnSpec(c, `addColumns[${i}]`);
      if (t.columns.length >= MAX_TABLE_COLUMNS) fail(`A table holds at most ${MAX_TABLE_COLUMNS} columns`);
      if (t.columns.some((x) => x.name.trim().toLowerCase() === s.name.trim().toLowerCase())) fail(`addColumns[${i}]: a column named "${clip(s.name, 40)}" already exists`);
      const col = newColumn({ name: s.name.trim(), type: s.type || 'text', width: s.width, options: s.options }, newId);
      t = { ...t, columns: [...t.columns, col] };
      columnIds.push(col.id);
    })
  );
  (patch.renameColumns || []).forEach((r, i) =>
    run(() => {
      if (!isObj(r) || typeof r.name !== 'string' || !r.name.trim()) fail(`renameColumns[${i}] must be {column, name}`);
      const col = resolveColumn(t, r.column, `renameColumns[${i}].column`);
      if (t.columns.some((x) => x.id !== col.id && x.name.trim().toLowerCase() === r.name.trim().toLowerCase())) fail(`renameColumns[${i}]: a column named "${clip(r.name, 40)}" already exists`);
      t = { ...t, columns: t.columns.map((c) => (c.id === col.id ? { ...c, name: r.name.trim().slice(0, 200) } : c)) };
    })
  );
  (patch.setColumnTypes || []).forEach((r, i) =>
    run(() => {
      if (!isObj(r)) fail(`setColumnTypes[${i}] must be {column, type}`);
      const col = resolveColumn(t, r.column, `setColumnTypes[${i}].column`);
      const res = setColumnType(t, col.id, r.type);
      if (res.dropped) warnings.push(`setColumnTypes[${i}]: ${res.dropped} cell(s) in "${clip(col.name, 30)}" could not become ${r.type} and were emptied`);
      t = res.table;
    })
  );

  let keyCol = null;
  if (patch.key !== undefined) run(() => { keyCol = resolveColumn(t, patch.key, 'key'); });

  (patch.removeRowIds || []).forEach((id, i) =>
    run(() => {
      if (typeof id !== 'string' || !t.rows.some((r) => r.id === id)) fail(`removeRowIds[${i}]: row "${clip(id)}" does not exist`);
      t = { ...t, rows: t.rows.filter((r) => r.id !== id) };
      removed += 1;
    })
  );
  if (patch.removeKeys?.length) {
    run(() => {
      if (!keyCol) fail('removeKeys needs `key` (the column to match by)');
      for (const v of patch.removeKeys) {
        const k = norm(v);
        const before = t.rows.length;
        t = { ...t, rows: t.rows.filter((r) => norm(r.cells[keyCol.id]) !== k) };
        removed += before - t.rows.length;
      }
    });
  }

  (patch.upsertRows || []).forEach((r, i) =>
    run(() => {
      const at = `upsertRows[${i}]`;
      const s = rowSpec(r, at);
      const { cells, clear } = cellsFromSpec(t, s.cells ?? {}, at, { allowNull: true });
      const elementId = link(s, at, resolveElementId);
      let idx = -1;
      if (s.id !== undefined) {
        idx = t.rows.findIndex((x) => x.id === s.id);
        if (idx < 0) fail(`${at}.id: row "${clip(s.id)}" does not exist`);
      } else if (keyCol) {
        if (cells[keyCol.id] === undefined) fail(`${at}: the key column "${clip(keyCol.name, 30)}" needs a value to match by`);
        const k = norm(cells[keyCol.id]);
        const hits = t.rows.map((x, j) => (norm(x.cells[keyCol.id]) === k ? j : -1)).filter((j) => j >= 0);
        if (hits.length > 1) warnings.push(`${at}: ${hits.length} rows already have key "${clip(k, 40)}"; the first was updated`);
        idx = hits.length ? hits[0] : -1;
      }
      if (idx >= 0) {
        const cur = t.rows[idx];
        const merged = { ...cur.cells, ...cells };
        clear.forEach((id) => delete merged[id]);
        const next = { ...cur, cells: merged };
        if (elementId) next.elementId = elementId;
        t = { ...t, rows: t.rows.map((x, j) => (j === idx ? next : x)) };
        updated += 1;
      } else {
        if (t.rows.length >= MAX_TABLE_ROWS) fail(`A table holds at most ${MAX_TABLE_ROWS} rows`);
        const row = newRow({ cells, elementId }, newId);
        t = { ...t, rows: [...t.rows, row] };
        rowIds.push(row.id);
        inserted += 1;
      }
    })
  );
  if (errors.length) return { ok: false, errors };

  t = { ...t, columns: t.columns.map((c) => (c.type === 'select' ? withOptionsFromRows(c, t.rows) : c)) };
  const problem = tableProblem(t);
  if (problem) return { ok: false, errors: [problem] };
  return { ok: true, table: t, inserted, updated, removed, columnIds, rowIds, warnings };
}

/** Element box for a table (width = gutter + columns, height from the rows). */
export const sizeForTable = (table) => tableElementSize(table);

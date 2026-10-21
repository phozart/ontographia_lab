// lib/table/tableMerge.js
// Three-way merge of ONE table (element.data.table) at column / row / cell granularity, so that an agent that adds
// rows while the owner edits a cell, or two people editing different cells, never overwrite each other. Used by
// lib/merge/threeWay.js when both sides changed the same table. Pure; inputs are never mutated.
//
//   base = table at the last agreement with the server, ours = local, theirs = new head.
//   - Columns and rows merge by stable id. Added on a side: kept. Deleted on a side and untouched on the other:
//     deleted. Remote delete vs local edit: kept (kept-local-edit). Local delete vs remote edit: delete wins.
//   - A column's name / type / width / options, a row's elementId link and each cell are independent fields:
//     one side changed -> that side; both changed differently -> LOCAL WINS (reported).
//   - Order: the shared order merge (lib/merge/order.js).
//   - Cells of removed columns are dropped, and a cell whose value no longer fits its column type (one side changed
//     the type, the other typed a value) is converted or emptied, so the result always passes the server schema.
//   - If the merged table still breaks a cap (for example both sides added 300 rows), the local table is kept whole.
// Returns { value, fields } where fields name what was decided locally ("cell:<rowId>:<columnId>", "column:<id>.name",
// "row:<id>.elementId", "table").

import { valuesEqual } from '../versions/diff';
import { mergeOrder } from '../merge/order';
import { coerceCell } from './tableModel';
import { tableProblem } from './tableSchema';

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isNil = (v) => v === null || v === undefined;
const eq = (a, b) => valuesEqual(a, b, false);

export const isTableShape = (v) => isObj(v) && Array.isArray(v.columns) && Array.isArray(v.rows);

const byId = (list) => new Map(list.filter((x) => isObj(x) && typeof x.id === 'string').map((x) => [x.id, x]));

/** Field-level 3-way for a flat record (columns, scalar keys): returns merged record, local-won field names. */
function mergeFlat(b, o, t, skip = ['id']) {
  const out = {};
  const lost = [];
  for (const k of new Set([...Object.keys(b), ...Object.keys(o), ...Object.keys(t)])) {
    if (skip.includes(k)) continue;
    let pick;
    if (eq(o[k], t[k])) pick = o[k];
    else if (eq(b[k], o[k])) pick = t[k];
    else if (eq(b[k], t[k])) pick = o[k];
    else { pick = o[k]; lost.push(k); }
    if (!isNil(pick)) out[k] = pick;
  }
  return { value: out, lost };
}

function mergeEntities(kind, bList, oList, tList, mergeOne, fields) {
  const b = byId(bList);
  const o = byId(oList);
  const t = byId(tList);
  const result = new Map();
  for (const id of new Set([...b.keys(), ...o.keys(), ...t.keys()])) {
    const bv = b.get(id);
    const ov = o.get(id);
    const tv = t.get(id);
    if (!bv) {
      if (ov && tv) result.set(id, mergeOne(id, {}, ov, tv));
      else result.set(id, ov || tv);
    } else if (ov && tv) result.set(id, eq(ov, tv) ? ov : mergeOne(id, bv, ov, tv));
    else if (!ov && tv) {
      if (!eq(bv, tv)) fields.push(`${kind}:${id}.deleted`); // local delete wins over a remote edit
    } else if (ov && !tv) {
      if (!eq(bv, ov)) result.set(id, ov); // remote delete vs local edit: the edit survives
    }
  }
  const ids = (l) => l.filter((x) => isObj(x) && typeof x.id === 'string').map((x) => x.id);
  const order = mergeOrder(ids(bList), ids(oList), ids(tList), new Set(result.keys()));
  return order.map((id) => result.get(id));
}

export function mergeTables(base, ours, theirs) {
  const b = isTableShape(base) ? base : { columns: [], rows: [] };
  const fields = [];

  const head = mergeFlat(
    { headerRow: b.headerRow, headerColumn: b.headerColumn },
    { headerRow: ours.headerRow, headerColumn: ours.headerColumn },
    { headerRow: theirs.headerRow, headerColumn: theirs.headerColumn }
  );
  head.lost.forEach((k) => fields.push(k));

  const columns = mergeEntities('column', b.columns, ours.columns, theirs.columns, (id, bc, oc, tc) => {
    const m = mergeFlat(bc, oc, tc);
    m.lost.forEach((k) => fields.push(`column:${id}.${k}`));
    return { id, ...m.value };
  }, fields);
  const colType = new Map(columns.map((c) => [c.id, c.type]));

  const rows = mergeEntities('row', b.rows, ours.rows, theirs.rows, (id, br, or, tr) => {
    const cells = {};
    const bc = br.cells || {};
    const oc = or.cells || {};
    const tc = tr.cells || {};
    for (const k of new Set([...Object.keys(bc), ...Object.keys(oc), ...Object.keys(tc)])) {
      let pick;
      if (eq(oc[k], tc[k])) pick = oc[k];
      else if (eq(bc[k], oc[k])) pick = tc[k];
      else if (eq(bc[k], tc[k])) pick = oc[k];
      else { pick = oc[k]; fields.push(`cell:${id}:${k}`); }
      if (!isNil(pick)) cells[k] = pick;
    }
    const link = mergeFlat({ elementId: br.elementId }, { elementId: or.elementId }, { elementId: tr.elementId });
    link.lost.forEach(() => fields.push(`row:${id}.elementId`));
    return { id, cells, ...link.value };
  }, fields);

  // Drop cells of removed columns; make every cell fit its (possibly changed) column type.
  const cleaned = rows.map((r) => {
    const cells = {};
    for (const [k, v] of Object.entries(r.cells || {})) {
      const type = colType.get(k);
      if (!type) continue;
      const c = coerceCell(type, v);
      if (c.ok && c.value !== undefined) cells[k] = c.value;
    }
    return { ...r, cells };
  });

  const value = { ...head.value, columns, rows: cleaned };
  if (columns.length === 0 || tableProblem(value)) return { value: ours, fields: [...fields, 'table'] };
  return { value, fields };
}

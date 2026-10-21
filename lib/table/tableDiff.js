// lib/table/tableDiff.js
// What changed between two versions of one table, by stable column / row / cell id (slice 8 Compare and the
// "Review agent change" overlay). Pure. Counts plus the first MAX_CELLS changed cells.

const MAX_CELLS = 50;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const sameValue = (a, b) => (a === undefined || a === null ? b === undefined || b === null : a === b);
const keyed = (list) => new Map((Array.isArray(list) ? list : []).filter((x) => isObj(x) && typeof x.id === 'string').map((x) => [x.id, x]));
const sameColumn = (a, b) => a.name === b.name && a.type === b.type && (a.width ?? null) === (b.width ?? null) && JSON.stringify(a.options ?? null) === JSON.stringify(b.options ?? null);

/**
 * @returns {null | {columns: {added: number, removed: number, changed: number}, rows: {added: number, removed: number, changed: number, moved: boolean},
 *   cells: number, changedCells: Array<{rowId: string, columnId: string}>, header: boolean}} null when the tables are equal
 */
export function diffTables(a, b) {
  const A = isObj(a) ? a : { columns: [], rows: [] };
  const B = isObj(b) ? b : { columns: [], rows: [] };
  const ac = keyed(A.columns);
  const bc = keyed(B.columns);
  const ar = keyed(A.rows);
  const br = keyed(B.rows);
  const out = {
    columns: { added: 0, removed: 0, changed: 0 },
    rows: { added: 0, removed: 0, changed: 0, moved: false },
    cells: 0,
    changedCells: [],
    header: (A.headerRow !== false) !== (B.headerRow !== false) || Boolean(A.headerColumn) !== Boolean(B.headerColumn),
  };
  for (const [id, c] of bc) {
    if (!ac.has(id)) out.columns.added += 1;
    else if (!sameColumn(ac.get(id), c)) out.columns.changed += 1;
  }
  for (const id of ac.keys()) if (!bc.has(id)) out.columns.removed += 1;

  const note = (rowId, columnId) => {
    out.cells += 1;
    if (out.changedCells.length < MAX_CELLS) out.changedCells.push({ rowId, columnId });
  };
  for (const [id, r] of br) {
    const was = ar.get(id);
    if (!was) { out.rows.added += 1; continue; }
    let changed = (was.elementId ?? null) !== (r.elementId ?? null);
    const wc = isObj(was.cells) ? was.cells : {};
    const nc = isObj(r.cells) ? r.cells : {};
    for (const k of new Set([...Object.keys(wc), ...Object.keys(nc)])) {
      if (!sameValue(wc[k], nc[k])) { changed = true; note(id, k); }
    }
    if (changed) out.rows.changed += 1;
  }
  for (const id of ar.keys()) if (!br.has(id)) out.rows.removed += 1;

  const common = (m, other) => [...m.keys()].filter((id) => other.has(id));
  const order = (x, y) => common(x, y).join('\u0000');
  out.rows.moved = order(ar, br) !== order(br, ar);
  const colOrder = order(ac, bc) !== order(bc, ac);

  const nothing = !out.header && !colOrder && !out.rows.moved && out.cells === 0 &&
    !out.columns.added && !out.columns.removed && !out.columns.changed && !out.rows.added && !out.rows.removed && !out.rows.changed;
  return nothing ? null : out;
}

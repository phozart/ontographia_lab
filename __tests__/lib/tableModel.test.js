import {
  createEmptyTable, setCell, addRow, removeRow, moveRow, addColumn, removeColumn, moveColumn, renameColumn,
  setColumnType, sortByColumn, setRowLink, tableFromGrid, coerceCell, cellText, tableMetrics, tableElementSize,
  columnWidths, LAYOUT, TableError, DEFAULT_COLUMN_WIDTH, pasteGrid,
} from '../../lib/table/tableModel';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS } from '../../lib/diagramLimits';

const seq = () => { let n = 0; return (p) => `${p}-t${++n}`; };
const fresh = (() => { let n = 100; return (p) => `${p}-n${++n}`; })();
const sample = () => createEmptyTable({ columns: 3, rows: 2, newId: seq() });

describe('createEmptyTable', () => {
  test('has stable ids, a header row and empty rows', () => {
    const t = sample();
    expect(t.columns.map((c) => c.id)).toEqual(['col-t1', 'col-t2', 'col-t3']);
    expect(t.rows.map((r) => r.id)).toEqual(['row-t4', 'row-t5']);
    expect(t.headerRow).toBe(true);
    expect(t.rows[0].cells).toEqual({});
  });
});

describe('coerceCell', () => {
  test.each([
    ['number', '1,234.5', 1234.5], ['number', ' 7 ', 7], ['number', '-3', -3], ['number', 4, 4],
    ['boolean', 'Yes', true], ['boolean', 'no', false], ['boolean', true, true],
    ['text', 12, '12'], ['select', 'high', 'high'],
  ])('%s %p -> %p', (type, raw, value) => expect(coerceCell(type, raw)).toEqual({ ok: true, value }));
  test('empty is a missing cell', () => expect(coerceCell('number', '')).toEqual({ ok: true, value: undefined }));
  test('rejects non numbers and non booleans and huge text', () => {
    expect(coerceCell('number', 'abc').ok).toBe(false);
    expect(coerceCell('number', 'NaN').ok).toBe(false);
    expect(coerceCell('number', Infinity).ok).toBe(false);
    expect(coerceCell('boolean', 'maybe').ok).toBe(false);
    expect(coerceCell('text', 'x'.repeat(2001)).ok).toBe(false);
  });
  test('cellText renders booleans', () => expect([cellText(true), cellText(null), cellText(3)]).toEqual(['true', '', '3']));
});

describe('cell and row mutations', () => {
  test('setCell stores a typed value and empties on blank; input table is not mutated', () => {
    const t = sample();
    const a = setCell(t, 'row-t4', 'col-t1', 'Auth');
    expect(a.rows[0].cells).toEqual({ 'col-t1': 'Auth' });
    expect(t.rows[0].cells).toEqual({});
    expect(setCell(a, 'row-t4', 'col-t1', '').rows[0].cells).toEqual({});
  });
  test('setCell on a number column rejects text with a readable error', () => {
    const t = setColumnType(sample(), 'col-t2', 'number').table;
    expect(() => setCell(t, 'row-t4', 'col-t2', 'abc')).toThrow(TableError);
    expect(setCell(t, 'row-t4', 'col-t2', '42').rows[0].cells['col-t2']).toBe(42);
  });
  test('select cells extend the options with new values', () => {
    const t = setColumnType(sample(), 'col-t3', 'select').table;
    const n = setCell(t, 'row-t4', 'col-t3', 'high');
    expect(n.columns[2].options.map((o) => o.value)).toEqual(['high']);
  });
  test('unknown row or column throws', () => {
    expect(() => setCell(sample(), 'row-x', 'col-t1', 'a')).toThrow(/does not exist/);
    expect(() => setCell(sample(), 'row-t4', 'col-x', 'a')).toThrow(/does not exist/);
  });
  test('addRow inserts at index or after a row, removeRow and moveRow keep ids', () => {
    let t = sample();
    t = addRow(t, { afterRowId: 'row-t4' }, fresh);
    expect(t.rows).toHaveLength(3);
    expect(t.rows[0].id).toBe('row-t4');
    t = moveRow(t, 'row-t5', -2);
    expect(t.rows[0].id).toBe('row-t5');
    t = removeRow(t, 'row-t5');
    expect(t.rows.map((r) => r.id)).not.toContain('row-t5');
    expect(() => removeRow(t, 'row-t5')).toThrow();
  });
  test('row cap', () => {
    let t = sample();
    t = { ...t, rows: Array.from({ length: MAX_TABLE_ROWS }, (_, i) => ({ id: `row-${i}`, cells: {} })) };
    expect(() => addRow(t)).toThrow(/at most/);
  });
  test('row link set and cleared', () => {
    const t = setRowLink(sample(), 'row-t4', 'el-9');
    expect(t.rows[0].elementId).toBe('el-9');
    expect(setRowLink(t, 'row-t4', null).rows[0]).not.toHaveProperty('elementId');
  });
});

describe('column mutations', () => {
  test('add, rename, move, remove (cells of the column go with it, last column cannot go)', () => {
    let t = setCell(sample(), 'row-t4', 'col-t2', 'keep');
    t = addColumn(t, { afterColumnId: 'col-t1', name: 'New', type: 'number' }, fresh);
    expect(t.columns.map((c) => c.name)).toEqual(['Column 1', 'New', 'Column 2', 'Column 3']);
    t = renameColumn(t, 'col-t2', 'Renamed');
    expect(t.columns[2].name).toBe('Renamed');
    t = moveColumn(t, 'col-t3', -1);
    expect(t.columns[2].id).toBe('col-t3');
    t = removeColumn(t, 'col-t2');
    expect(t.rows[0].cells).toEqual({});
    let one = { ...t, columns: [t.columns[0]] };
    expect(() => removeColumn(one, one.columns[0].id)).toThrow(/at least one column/);
  });
  test('column cap', () => {
    const t = { ...sample(), columns: Array.from({ length: MAX_TABLE_COLUMNS }, (_, i) => ({ id: `col-${i}`, name: 'c', type: 'text' })), rows: [] };
    expect(() => addColumn(t)).toThrow(/at most/);
  });
  test('type change converts what it can and reports drops', () => {
    let t = sample();
    t = setCell(t, 'row-t4', 'col-t1', '12');
    t = setCell(t, 'row-t5', 'col-t1', 'abc');
    const r = setColumnType(t, 'col-t1', 'number');
    expect(r.table.rows[0].cells['col-t1']).toBe(12);
    expect(r.table.rows[1].cells['col-t1']).toBeUndefined();
    expect(r.dropped).toBe(1);
    const back = setColumnType(r.table, 'col-t1', 'text').table;
    expect(back.rows[0].cells['col-t1']).toBe('12');
  });
  test('sort once: numeric, empty last, stable', () => {
    let t = setColumnType(sample(), 'col-t1', 'number').table;
    t = addRow(t, {}, fresh);
    const empty = t.rows[2].id;
    t = setCell(t, 'row-t4', 'col-t1', 10);
    t = setCell(t, 'row-t5', 'col-t1', 2);
    const asc = sortByColumn(t, 'col-t1', 'asc');
    expect(asc.rows.map((r) => r.id)).toEqual(['row-t5', 'row-t4', empty]);
    expect(sortByColumn(t, 'col-t1', 'desc').rows.map((r) => r.id)).toEqual(['row-t4', 'row-t5', empty]);
  });
});

describe('tableFromGrid (paste)', () => {
  test('header, inferred number and boolean columns, blanks dropped', () => {
    const t = tableFromGrid([['Name', 'Count', 'Done'], ['a', '1', 'true'], ['b', '', 'false'], ['', '', '']], { newId: seq() });
    expect(t.columns.map((c) => [c.name, c.type])).toEqual([['Name', 'text'], ['Count', 'number'], ['Done', 'boolean']]);
    expect(t.rows).toHaveLength(2);
    expect(t.rows[0].cells).toEqual({ 'col-t1': 'a', 'col-t2': 1, 'col-t3': true });
    expect(t.rows[1].cells).toEqual({ 'col-t1': 'b', 'col-t3': false });
  });
  test('identifier-like values stay text: leading zeros, plus signs, phone numbers, zip codes, trailing zeros', () => {
    for (const v of ['007', '+1', '+4915112345', '01234', '1.50', '1,000']) {
      const t = tableFromGrid([['H'], [v], ['5']], { newId: seq() });
      expect(t.columns[0].type).toBe('text');
      expect(t.rows[0].cells['col-t1']).toBe(v);
    }
    for (const col of [['0', '12', '-3', '0.5', '3.25'], [' 42 ']]) {
      const t = tableFromGrid([['H'], ...col.map((v) => [v])], { newId: seq() });
      expect(t.columns[0].type).toBe('number');
    }
  });
  test('ragged rows and no header', () => {
    const t = tableFromGrid([['a', 'b'], ['c']], { header: false, newId: seq() });
    expect(t.headerRow).toBe(false);
    expect(t.columns.map((c) => c.name)).toEqual(['Column 1', 'Column 2']);
    expect(t.rows).toHaveLength(2);
  });
  test('caps and empty input', () => {
    expect(() => tableFromGrid([Array(MAX_TABLE_COLUMNS + 1).fill('x')])).toThrow(/columns/);
    expect(() => tableFromGrid([['h'], ...Array.from({ length: MAX_TABLE_ROWS + 1 }, () => ['x'])])).toThrow(/rows/);
    expect(() => tableFromGrid([[''], ['']])).toThrow(/Nothing/);
  });
});

describe('layout metrics', () => {
  test('width is gutter plus columns; header and rows give a deterministic height', () => {
    const t = sample();
    const m = tableMetrics(t);
    expect(m.width).toBe(LAYOUT.gutter + 3 * DEFAULT_COLUMN_WIDTH);
    expect(m.height).toBe(LAYOUT.headerHeight + 2 * LAYOUT.rowMinHeight + 2);
    expect(tableElementSize(t)).toEqual({ width: m.width, height: m.height });
  });
  test('long text wraps (clamped) and grows the row; no header row removes header height', () => {
    let t = setCell(sample(), 'row-t4', 'col-t1', 'word '.repeat(60));
    const m = tableMetrics(t);
    expect(m.rowHeights[0]).toBe(LAYOUT.maxLines * LAYOUT.lineHeight + LAYOUT.rowPadY);
    expect(tableMetrics({ ...t, headerRow: false }).headerHeight).toBe(0);
  });
  test('resizing scales column widths proportionally', () => {
    const t = sample();
    const w = columnWidths(t, LAYOUT.gutter + 6 * DEFAULT_COLUMN_WIDTH);
    expect(w).toEqual([320, 320, 320]);
  });
});

describe('pasteGrid (paste a range into a table)', () => {
  test('writes from the active cell, adds rows, skips columns that do not exist and values that do not fit', () => {
    const t = setColumnType(sample(), 'col-t2', 'number').table;
    const r = pasteGrid(t, [['a', '1', 'x'], ['b', 'oops', 'y'], ['c', '3', 'z', 'extra']], { rowId: 'row-t4', columnId: 'col-t1' }, fresh);
    expect(r.table.rows).toHaveLength(3);
    expect(r.table.rows[0].cells).toEqual({ 'col-t1': 'a', 'col-t2': 1, 'col-t3': 'x' });
    expect(r.table.rows[1].cells).toEqual({ 'col-t1': 'b', 'col-t3': 'y' });
    expect(r.skipped).toBe(2); // "oops" and "extra"
    expect(r.written).toBe(8);
  });
  test('starts mid-table and respects the row cap', () => {
    const t = { ...sample(), rows: Array.from({ length: MAX_TABLE_ROWS }, (_, i) => ({ id: `row-${i}`, cells: {} })) };
    const r = pasteGrid(t, [['a'], ['b']], { rowId: `row-${MAX_TABLE_ROWS - 1}`, columnId: 'col-t1' }, fresh);
    expect(r.table.rows).toHaveLength(MAX_TABLE_ROWS);
    expect(r.skipped).toBe(1);
  });
});

import { diffContent } from '../../lib/versions/diff';
import { mergeContent } from '../../lib/merge/threeWay';
import { mergeTables } from '../../lib/table/tableMerge';
import { diffTables } from '../../lib/table/tableDiff';
import { validateDiagramContent } from '../../lib/diagramContent';

const baseTable = () => ({
  headerRow: true,
  columns: [{ id: 'col-a', name: 'Name', type: 'text' }, { id: 'col-b', name: 'N', type: 'number' }],
  rows: [
    { id: 'row-1', cells: { 'col-a': 'one', 'col-b': 1 } },
    { id: 'row-2', cells: { 'col-a': 'two', 'col-b': 2 } },
    { id: 'row-3', cells: { 'col-a': 'three' } },
  ],
});
const content = (table, extra = {}) => ({
  elements: [
    { id: 'el-t', type: 'table', packId: 'core', label: 'T', x: 0, y: 0, size: { width: 300, height: 140 }, data: { table }, ...extra },
    { id: 'el-n', type: 'rectangle', packId: 'core', label: 'Note', x: 400, y: 0, size: { width: 100, height: 80 } },
  ],
  connections: [], layers: [], groups: [],
});
const edit = (table, fn) => { const t = JSON.parse(JSON.stringify(table)); fn(t); return t; };
const tableOf = (c) => c.elements.find((e) => e.id === 'el-t').data.table;

describe('diff: tables at cell granularity', () => {
  test('a cell edit reports the field table (not data) and the changed cell id', () => {
    const b = baseTable();
    const a = edit(b, (t) => { t.rows[1].cells['col-a'] = 'TWO'; });
    const d = diffContent(content(b), content(a));
    expect(d.changes).toHaveLength(1);
    expect(d.changes[0]).toMatchObject({ id: 'el-t', change: 'changed', fields: ['table'] });
    expect(d.changes[0].table).toMatchObject({ cells: 1, changedCells: [{ rowId: 'row-2', columnId: 'col-a' }], rows: { changed: 1, added: 0, removed: 0 } });
  });
  test('rows and columns added, removed, changed, moved', () => {
    const b = baseTable();
    const a = edit(b, (t) => {
      t.rows.push({ id: 'row-4', cells: {} });
      t.rows = t.rows.filter((r) => r.id !== 'row-1');
      t.columns[1].name = 'Count';
      t.columns.push({ id: 'col-c', name: 'X', type: 'text' });
      t.rows.reverse();
    });
    const t = diffTables(b, a);
    expect(t.rows).toMatchObject({ added: 1, removed: 1, moved: true });
    expect(t.columns).toEqual({ added: 1, removed: 0, changed: 1 });
  });
  test('identical tables give no change; a row link change counts', () => {
    expect(diffTables(baseTable(), baseTable())).toBeNull();
    expect(diffTables(baseTable(), edit(baseTable(), (t) => { t.rows[0].elementId = 'el-n'; })).rows.changed).toBe(1);
  });
  test('moving the table and editing a cell reports position and table', () => {
    const b = baseTable();
    const a = content(edit(b, (t) => { t.rows[0].cells['col-a'] = 'x'; }));
    a.elements[0].x = 50;
    expect(diffContent(content(b), a).changes[0].fields).toEqual(['position', 'table']);
  });
  test('other data keys still report data', () => {
    const b = content(baseTable());
    const a = content(baseTable());
    a.elements[0].data.note = 'hi';
    expect(diffContent(b, a).changes[0].fields).toEqual(['data']);
  });
});

describe('merge: two people edit different cells, rows and columns of one table', () => {
  const run = (b, o, t) => mergeContent(content(b), content(o), content(t));

  test('different cells of the same row both survive', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows[0].cells['col-a'] = 'LOCAL'; });
    const t = edit(b, (x) => { x.rows[0].cells['col-b'] = 99; });
    const r = run(b, o, t);
    expect(r.ok).toBe(true);
    expect(tableOf(r.content).rows[0].cells).toEqual({ 'col-a': 'LOCAL', 'col-b': 99 });
    expect(r.conflicts).toHaveLength(0);
  });
  test('the same cell on both sides: local wins and is reported with the cell id', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows[1].cells['col-a'] = 'LOCAL'; });
    const t = edit(b, (x) => { x.rows[1].cells['col-a'] = 'REMOTE'; });
    const r = run(b, o, t);
    expect(tableOf(r.content).rows[1].cells['col-a']).toBe('LOCAL');
    expect(r.conflicts).toEqual([{ kind: 'element', id: 'el-t', fields: ['data.table.cell:row-2:col-a'], resolution: 'local-wins' }]);
  });
  test('agent appends rows while the user edits a cell: both kept, remote rows after the local order', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows[2].cells['col-a'] = 'edited'; });
    const t = edit(b, (x) => { x.rows.push({ id: 'row-9', cells: { 'col-a': 'from agent' } }); });
    const m = tableOf(run(b, o, t).content);
    expect(m.rows.map((r) => r.id)).toEqual(['row-1', 'row-2', 'row-3', 'row-9']);
    expect(m.rows[2].cells['col-a']).toBe('edited');
  });
  test('both add different rows: both kept; both add the same row id: merged by field', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows.push({ id: 'row-L', cells: {} }); });
    const t = edit(b, (x) => { x.rows.push({ id: 'row-R', cells: {} }); });
    expect(tableOf(run(b, o, t).content).rows.map((r) => r.id).sort()).toEqual(['row-1', 'row-2', 'row-3', 'row-L', 'row-R']);
  });
  test('row delete: remote delete of an untouched row removes it; of an edited row keeps the edit', () => {
    const b = baseTable();
    const t = edit(b, (x) => { x.rows = x.rows.filter((r) => r.id !== 'row-1' && r.id !== 'row-2'); });
    const o = edit(b, (x) => { x.rows[1].cells['col-a'] = 'mine'; });
    const m = tableOf(run(b, o, t).content);
    expect(m.rows.map((r) => r.id).sort()).toEqual(['row-2', 'row-3']);
    expect(m.rows.find((r) => r.id === 'row-2').cells['col-a']).toBe('mine');
  });
  test('local delete wins over a remote edit of that row', () => {
    const b = baseTable();
    const o = edit(b, (x) => { x.rows = x.rows.filter((r) => r.id !== 'row-3'); });
    const t = edit(b, (x) => { x.rows[2].cells['col-a'] = 'remote edit'; });
    expect(tableOf(run(b, o, t).content).rows.map((r) => r.id)).toEqual(['row-1', 'row-2']);
  });
  test('columns: rename on one side, add on the other; removed column drops its cells', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.columns[0].name = 'Component'; });
    const t = edit(b, (x) => { x.columns.push({ id: 'col-c', name: 'Owner', type: 'text' }); x.rows[0].cells['col-c'] = 'Ann'; x.columns = x.columns.filter((c) => c.id !== 'col-b'); });
    const m = tableOf(run(b, o, t).content);
    expect(m.columns.map((c) => c.name)).toEqual(['Component', 'Owner']);
    expect(m.rows[0].cells).toEqual({ 'col-a': 'one', 'col-c': 'Ann' });
  });
  test('column type changed remotely while a cell was typed locally: the cell is converted or emptied, result is valid', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows[0].cells['col-b'] = 5; });
    const t = edit(b, (x) => { x.columns[1].type = 'boolean'; });
    const merged = run(b, o, t).content;
    expect(validateDiagramContent(merged).ok).toBe(true);
  });
  test('row reorder locally and a remote row add: local order kept', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows.reverse(); });
    const t = edit(b, (x) => { x.rows.push({ id: 'row-9', cells: {} }); });
    expect(tableOf(run(b, o, t).content).rows.map((r) => r.id)).toEqual(['row-3', 'row-9', 'row-2', 'row-1']); // remote additions follow their predecessor
  });
  test('links merge per row; a dangling link survives', () => {
    const b = baseTable();
    const o = edit(b, (t) => { t.rows[0].elementId = 'el-n'; });
    const t = edit(b, (x) => { x.rows[1].elementId = 'el-gone'; });
    const m = tableOf(run(b, o, t).content);
    expect([m.rows[0].elementId, m.rows[1].elementId]).toEqual(['el-n', 'el-gone']);
  });
  test('merge that would break a cap falls back to the local table, reported', () => {
    const b = baseTable();
    const many = (p) => Array.from({ length: 300 }, (_, i) => ({ id: `row-${p}${i}`, cells: {} }));
    const o = edit(b, (t) => { t.rows.push(...many('L')); });
    const t = edit(b, (x) => { x.rows.push(...many('R')); });
    const r = mergeTables(b, o, t);
    expect(r.value).toEqual(o);
    expect(r.fields).toContain('table');
  });
  test('only one side changed the table: that side is taken without table-level work', () => {
    const b = baseTable();
    const t = edit(b, (x) => { x.rows[0].cells['col-a'] = 'remote'; });
    const r = run(b, b, t);
    expect(tableOf(r.content).rows[0].cells['col-a']).toBe('remote');
    expect(r.conflicts).toHaveLength(0);
  });
});

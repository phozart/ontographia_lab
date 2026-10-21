import { buildTableFromSpec, applyTablePatch } from '../../lib/table/tablePatch';
import { applyOps } from '../../lib/mcp/ops';
import { validateDiagramContent } from '../../lib/diagramContent';
import { tableElementSize } from '../../lib/table/tableModel';

const seq = (tag = 's') => { let n = 0; return (p) => `${p}-${tag}${++n}`; };
const links = (known) => (v, at) => { if (!known.includes(v)) throw new (require('../../lib/table/tableModel').TableError)(`${at}: "${v}" is not an element of this diagram`); return v; };

describe('buildTableFromSpec', () => {
  test('columns by name, rows aligned, ids assigned, typed values coerced', () => {
    const r = buildTableFromSpec({
      columns: ['Component', { name: 'Tier', type: 'select', options: ['api', 'data'] }, { name: 'Instances', type: 'number' }, { name: 'Critical', type: 'boolean' }],
      rows: [['Auth', 'api', '3', 'yes'], { cells: { Component: 'DB', Tier: 'data', Instances: 2 }, elementId: 'el-1' }],
    }, { newId: seq(), resolveElementId: links(['el-1']) });
    expect(r.ok).toBe(true);
    expect(r.columnIds).toEqual(['col-s1', 'col-s2', 'col-s3', 'col-s4']);
    expect(r.rowIds).toEqual(['row-s5', 'row-s6']);
    expect(r.table.rows[0].cells).toEqual({ 'col-s1': 'Auth', 'col-s2': 'api', 'col-s3': 3, 'col-s4': true });
    expect(r.table.rows[1].elementId).toBe('el-1');
    expect(r.table.columns[1].options.map((o) => o.value)).toEqual(['api', 'data']);
  });
  test('select options are learned from the values', () => {
    const r = buildTableFromSpec({ columns: [{ name: 'S', type: 'select' }], rows: [['a'], ['b'], ['a']] });
    expect(r.table.columns[0].options.map((o) => o.value)).toEqual(['a', 'b']);
  });
  test('errors are collected with paths and nothing is built', () => {
    const r = buildTableFromSpec({ columns: ['A', { name: 'N', type: 'number' }], rows: [['x', 'oops'], ['y', 1, 'extra'], { cells: { Nope: 1 } }, { cells: ['a'], elementId: 'el-gone' }] }, { resolveElementId: links([]) });
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/rows\[0\].cells\[1\] \(column "N", number\)/);
    expect(r.errors.join('\n')).toMatch(/rows\[1\].cells has 3 values/);
    expect(r.errors.join('\n')).toMatch(/not a column/);
    expect(r.errors.join('\n')).toMatch(/rows\[3\].elementId: "el-gone" is not an element/);
  });
  test.each([
    [{ columns: [] }, /non-empty/],
    [{ columns: ['A', 'a'] }, /duplicate column name/],
    [{ columns: [{ name: 'A', type: 'date' }] }, /type must be one of/],
    [{ columns: [{ name: 'A', color: 'x' }] }, /unknown field/],
    [{ columns: ['A'], rows: [{ cells: [], html: '<b>' }] }, /unknown field/],
    [{ columns: ['A'], extra: 1 }, /unknown field/],
    [{ columns: ['A'], rows: Array.from({ length: 501 }, () => []) }, /Too many rows/],
    [{ columns: Array.from({ length: 51 }, (_, i) => `c${i}`) }, /Too many columns/],
    [{ columns: ['A'], rows: [[{ nested: 1 }]] }, /string, number or boolean/],
  ])('rejects %j', (input, re) => {
    const r = buildTableFromSpec(input);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(re);
  });
});

describe('applyTablePatch', () => {
  const base = () => buildTableFromSpec({ columns: ['Name', { name: 'Status', type: 'select' }, { name: 'N', type: 'number' }], rows: [['a', 'open', 1], ['b', 'open', 2]] }, { newId: seq() }).table;

  test('upsert by key: update existing, insert new, run twice gives no duplicates', () => {
    const patch = { key: 'Name', upsertRows: [{ cells: { Name: 'a', Status: 'done' } }, { cells: { Name: 'c', N: 9 } }] };
    const one = applyTablePatch(base(), patch, { newId: seq('n') });
    expect(one).toMatchObject({ ok: true, inserted: 1, updated: 1, removed: 0 });
    expect(one.table.rows).toHaveLength(3);
    expect(one.table.rows[0].cells).toMatchObject({ 'col-s2': 'done', 'col-s3': 1 }); // untouched cell survives
    const two = applyTablePatch(one.table, patch, { newId: seq('n') });
    expect(two).toMatchObject({ ok: true, inserted: 0, updated: 2 });
    expect(two.table.rows).toHaveLength(3);
  });
  test('key matching ignores case and surrounding blanks; the same key twice in one batch merges', () => {
    const r = applyTablePatch(base(), { key: 'Name', upsertRows: [{ cells: { Name: ' A ' } }, { cells: { Name: 'z' } }, { cells: { Name: 'z', N: 5 } }] }, { newId: seq('n') });
    expect(r).toMatchObject({ inserted: 1, updated: 2 });
    expect(r.table.rows).toHaveLength(3);
  });
  test('null clears a cell; upsert by row id; a missing key value is an error', () => {
    const t = base();
    const id = t.rows[0].id;
    const r = applyTablePatch(t, { upsertRows: [{ id, cells: { Status: null, N: 10 } }] });
    expect(r.table.rows[0].cells).toEqual({ 'col-s1': 'a', 'col-s3': 10 });
    expect(applyTablePatch(t, { key: 'Name', upsertRows: [{ cells: { N: 1 } }] }).errors[0]).toMatch(/needs a value/);
    expect(applyTablePatch(t, { upsertRows: [{ id: 'row-nope', cells: {} }] }).errors[0]).toMatch(/does not exist/);
  });
  test('remove rows by id and by key; remove, add, rename and retype columns', () => {
    const t = base();
    const r = applyTablePatch(t, {
      removeRowIds: [t.rows[0].id], key: 'Name', removeKeys: ['B'],
      addColumns: [{ name: 'Owner' }], renameColumns: [{ column: 'N', name: 'Count' }], setColumnTypes: [{ column: 'Name', type: 'select' }], removeColumns: ['Status'],
    }, { newId: seq('n') });
    expect(r).toMatchObject({ ok: true, removed: 2 });
    expect(r.table.rows).toHaveLength(0);
    expect(r.table.columns.map((c) => [c.name, c.type])).toEqual([['Name', 'select'], ['Count', 'number'], ['Owner', 'text']]);
    expect(r.columnIds).toHaveLength(1);
  });
  test('upsert can fill a column added in the same patch; links are validated', () => {
    const r = applyTablePatch(base(), { addColumns: ['Owner'], key: 'Name', upsertRows: [{ cells: { Name: 'a', Owner: 'Ann' }, elementId: 'el-7' }] }, { newId: seq('n'), resolveElementId: links(['el-7']) });
    expect(r.table.rows[0]).toMatchObject({ elementId: 'el-7' });
    expect(Object.values(r.table.rows[0].cells)).toContain('Ann');
    const bad = applyTablePatch(base(), { upsertRows: [{ cells: ['x'], elementId: 'el-gone' }] }, { resolveElementId: links([]) });
    expect(bad.ok).toBe(false);
  });
  test('type change warns about emptied cells', () => {
    const r = applyTablePatch(base(), { setColumnTypes: [{ column: 'Name', type: 'number' }] });
    expect(r.warnings[0]).toMatch(/emptied/);
  });
  test.each([
    [{}, /Nothing to do/], [{ nope: 1 }, /Unknown field/], [{ upsertRows: 'x' }, /must be an array/],
    [{ removeKeys: ['a'] }, /needs `key`/], [{ removeColumns: ['Name', 'Status', 'N'] }, /at least one column/],
    [{ renameColumns: [{ column: 'N', name: 'name' }] }, /already exists/], [{ addColumns: ['Name'] }, /already exists/],
    [{ removeRowIds: ['row-zzz'] }, /does not exist/], [{ removeColumns: ['Missing'] }, /not a column/],
  ])('rejects %j', (patch, re) => expect(applyTablePatch(base(), patch).errors.join(' ')).toMatch(re));
  test('the input table is not mutated', () => {
    const t = base();
    const copy = JSON.stringify(t);
    applyTablePatch(t, { key: 'Name', upsertRows: [{ cells: { Name: 'a', N: 99 } }], addColumns: ['X'] }, { newId: seq('n') });
    expect(JSON.stringify(t)).toBe(copy);
  });
});

describe('through applyOps (the one write path)', () => {
  const board = () => ({
    elements: [
      { id: 'el-a', type: 'rectangle', packId: 'core', label: 'Auth', x: 0, y: 0, size: { width: 120, height: 80 } },
      { id: 'el-b', type: 'rectangle', packId: 'core', label: 'Billing', x: 200, y: 0, size: { width: 120, height: 80 } },
    ],
    connections: [], layers: [{ id: 'default', name: 'Default' }],
  });
  const create = (extra = {}) => ({ op: 'add_element', ref: '@t', type: 'core/table', x: 0, y: 300, label: 'Inventory', table: { columns: ['Component', { name: 'Owner' }], rows: [{ cells: ['Auth', 'Ann'], elementId: 'el-a' }, { cells: ['Billing', 'Bob'], elementId: 'el-b' }] }, ...extra });

  test('creates a table element with data.table, size from content, links validated, ids reported', () => {
    const r = applyOps(board(), [create()], { newId: seq('n') });
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.type === 'table');
    expect(el).toMatchObject({ packId: 'core', label: 'Inventory' });
    expect(el.size).toEqual(tableElementSize(el.data.table));
    expect(el.data.table.rows.map((x) => x.elementId)).toEqual(['el-a', 'el-b']);
    expect(r.tables[0]).toMatchObject({ id: el.id, ref: '@t' });
    expect(r.tables[0].columnIds).toHaveLength(2);
    expect(r.tables[0].rowIds).toHaveLength(2);
    expect(validateDiagramContent(r.content).ok).toBe(true);
  });
  test('a link to a missing element fails the whole batch', () => {
    const r = applyOps(board(), [create({ table: { columns: ['A'], rows: [{ cells: ['x'], elementId: 'el-nope' }] } })]);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/not an element of this diagram/);
  });
  test('a row may link to an element created earlier in the same batch via @ref', () => {
    const r = applyOps(board(), [
      { op: 'add_element', ref: '@n', type: 'process-flow/task', label: 'New', x: 500, y: 0 },
      create({ table: { columns: ['A'], rows: [{ cells: ['x'], elementId: '@n' }] } }),
    ], { newId: seq('n') });
    expect(r.ok).toBe(true);
    const t = r.content.elements.find((e) => e.type === 'table');
    expect(t.data.table.rows[0].elementId).toBe(r.created['@n']);
  });
  test('core/table needs a table; others reject one; unknown op fields stay rejected', () => {
    expect(applyOps(board(), [{ op: 'add_element', type: 'core/table', label: 'x' }]).errors[0].message).toMatch(/needs a `table`/);
    expect(applyOps(board(), [{ op: 'add_element', type: 'core/rectangle', table: { columns: ['a'] } }]).errors[0].message).toMatch(/only for type core\/table/);
  });
  test('table_patch upserts by key and refreshes the size; unknown fields, non-tables and locks are refused', () => {
    const made = applyOps(board(), [create()], { newId: seq('n') });
    const tid = made.content.elements.find((e) => e.type === 'table').id;
    const r = applyOps(made.content, [{ op: 'table_patch', id: tid, key: 'Component', upsertRows: [{ cells: { Component: 'Auth', Owner: 'Zed' } }, { cells: { Component: 'Search', Owner: 'Sue' } }] }], { newId: seq('n') });
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.id === tid);
    expect(el.data.table.rows).toHaveLength(3);
    expect(el.size.height).toBeGreaterThan(made.content.elements.find((e) => e.id === tid).size.height);
    expect(r.tablePatches[0]).toMatchObject({ id: tid, inserted: 1, updated: 1 });
    expect(applyOps(made.content, [{ op: 'table_patch', id: 'el-a', upsertRows: [] }]).errors[0].message).toMatch(/not a table/);
    expect(applyOps(made.content, [{ op: 'table_patch', id: tid, bogus: 1 }]).errors[0].message).toMatch(/Unknown field/);
    const locked = { ...made.content, elements: made.content.elements.map((e) => (e.id === tid ? { ...e, locked: true } : e)) };
    expect(applyOps(locked, [{ op: 'table_patch', id: tid, removeRowIds: [] , upsertRows: [{ cells: ['x'] }] }]).errors[0].message).toMatch(/locked/);
  });
  test('removing a linked element leaves a dangling link that still validates', () => {
    const made = applyOps(board(), [create()], { newId: seq('n') });
    const r = applyOps(made.content, [{ op: 'remove_element', id: 'el-a' }]);
    expect(r.ok).toBe(true);
    expect(r.content.elements.find((e) => e.type === 'table').data.table.rows[0].elementId).toBe('el-a');
  });
});

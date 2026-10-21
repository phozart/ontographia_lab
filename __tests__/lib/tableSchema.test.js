import { validateDiagramContent } from '../../lib/diagramContent';
import { tableProblem } from '../../lib/table/tableSchema';
import { MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, MAX_TABLE_CELLS, MAX_TABLE_CELL_CHARS } from '../../lib/diagramLimits';

const table = (over = {}) => ({
  headerRow: true,
  columns: [
    { id: 'col-a', name: 'Name', type: 'text', width: 200 },
    { id: 'col-b', name: 'Sev', type: 'select', options: [{ value: 'high', color: '#E8A99A' }] },
    { id: 'col-c', name: 'Count', type: 'number' },
    { id: 'col-d', name: 'Done', type: 'boolean' },
  ],
  rows: [{ id: 'row-1', cells: { 'col-a': 'Auth', 'col-b': 'high', 'col-c': 7, 'col-d': true }, elementId: 'el-9' }],
  ...over,
});
const el = (t, extra = {}) => ({ id: 'el-t', type: 'table', packId: 'core', label: 'T', x: 0, y: 0, size: { width: 300, height: 100 }, data: { table: t }, ...extra });
const check = (t, extra) => validateDiagramContent({ elements: [el(t, extra)] });

describe('table validation through validateDiagramContent', () => {
  test('a well formed table passes untouched', () => {
    const r = check(table());
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].data.table.rows[0].cells['col-c']).toBe(7);
  });
  test('a dangling elementId is fine (the source may be deleted later)', () => expect(check(table()).ok).toBe(true));
  test('table without data.table is rejected', () => {
    const r = validateDiagramContent({ elements: [{ id: 'el-t', type: 'table', packId: 'core' }] });
    expect(r).toMatchObject({ ok: false, status: 400, code: 'VALIDATION_FAILED' });
    expect(r.error).toMatch(/no data\.table/);
  });
  test('another pack with a stencil called table is not touched', () => {
    expect(validateDiagramContent({ elements: [{ id: 'el-x', type: 'table', packId: 'erd', label: 'users' }] }).ok).toBe(true);
  });
  test.each([
    ['unknown table key', table({ extra: 1 }), /data\.table\.extra/],
    ['no columns', table({ columns: [] }), /at least one column/],
    ['bad column id', table({ columns: [{ id: 'x', name: 'a', type: 'text' }], rows: [] }), /col-/],
    ['column id too long', table({ columns: [{ id: `col-${'a'.repeat(130)}`, name: 'a', type: 'text' }], rows: [] }), /128/],
    ['duplicate column ids', table({ columns: [{ id: 'col-a', name: 'a', type: 'text' }, { id: 'col-a', name: 'b', type: 'text' }], rows: [] }), /used twice/],
    ['unknown column type', table({ columns: [{ id: 'col-a', name: 'a', type: 'date' }], rows: [] }), /type must be one of/],
    ['options on a text column', table({ columns: [{ id: 'col-a', name: 'a', type: 'text', options: [] }], rows: [] }), /only for select/],
    ['duplicate row ids', table({ rows: [{ id: 'row-1', cells: {} }, { id: 'row-1', cells: {} }] }), /row ids must be unique/],
    ['bad row id', table({ rows: [{ id: 'r1', cells: {} }] }), /row-/],
    ['row id too long', table({ rows: [{ id: `row-${'a'.repeat(130)}`, cells: {} }] }), /128/],
    ['cell for unknown column', table({ rows: [{ id: 'row-1', cells: { 'col-zzz': 'x' } }] }), /does not exist/],
    ['text in a number column', table({ rows: [{ id: 'row-1', cells: { 'col-c': '7' } }] }), /finite number/],
    ['number in a text column', table({ rows: [{ id: 'row-1', cells: { 'col-a': 7 } }] }), /must be a string/],
    ['string in a boolean column', table({ rows: [{ id: 'row-1', cells: { 'col-d': 'true' } }] }), /true or false/],
    ['object cell', table({ rows: [{ id: 'row-1', cells: { 'col-a': { html: '<b>' } } }] }), /must be a string/],
    ['null cell', table({ rows: [{ id: 'row-1', cells: { 'col-a': null } }] }), /must be a string/],
    ['row extra key', table({ rows: [{ id: 'row-1', cells: {}, html: 'x' }] }), /not a row field/],
    ['bad elementId', table({ rows: [{ id: 'row-1', cells: {}, elementId: 'a b' }] }), /elementId/],
  ])('rejects %s with 400 and the path', (_name, t, re) => {
    const r = check(t);
    expect(r).toMatchObject({ ok: false, status: 400, code: 'VALIDATION_FAILED' });
    expect(r.error).toMatch(/element "el-t"/);
    expect(r.error).toMatch(re);
  });

  test('caps: columns, rows, cells, cell length', () => {
    const cols = Array.from({ length: MAX_TABLE_COLUMNS + 1 }, (_, i) => ({ id: `col-${i}`, name: 'c', type: 'text' }));
    expect(tableProblem(table({ columns: cols, rows: [] }))).toMatch(/limit is 50/);
    const rows = Array.from({ length: MAX_TABLE_ROWS + 1 }, (_, i) => ({ id: `row-${i}`, cells: {} }));
    expect(tableProblem(table({ rows }))).toMatch(/limit is 500/);
    expect(tableProblem(table({ rows: [{ id: 'row-1', cells: { 'col-a': 'x'.repeat(MAX_TABLE_CELL_CHARS + 1) } }] }))).toMatch(/too long/);
    // 50 columns x 500 rows = 25,000 cells > 20,000
    const wide = Array.from({ length: 50 }, (_, i) => ({ id: `col-${i}`, name: 'c', type: 'text' }));
    const full = Array.from({ length: 500 }, (_, r) => ({ id: `row-${r}`, cells: Object.fromEntries(wide.map((c) => [c.id, 'x'])) }));
    expect(tableProblem(table({ columns: wide, rows: full }))).toMatch(new RegExp(`limit is ${MAX_TABLE_CELLS}`));
  });

  test('a table over 512 KB answers 413 (within the 5 MB content cap)', () => {
    const cols = Array.from({ length: 10 }, (_, i) => ({ id: `col-${i}`, name: 'c', type: 'text' }));
    const rows = Array.from({ length: 300 }, (_, r) => ({ id: `row-${r}`, cells: Object.fromEntries(cols.map((c) => [c.id, 'y'.repeat(300)])) }));
    const r = check(table({ columns: cols, rows }));
    expect(r).toMatchObject({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  test('a <script> cell is stored as plain text (never HTML)', () => {
    const r = check(table({ rows: [{ id: 'row-1', cells: { 'col-a': '<script>alert(1)</script>' } }] }));
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].data.table.rows[0].cells['col-a']).toBe('<script>alert(1)</script>');
  });

  test('table text is plain text, never a URL: javascript: in a cell, column name or select option is kept and the table stays valid', () => {
    const t = table({
      columns: [{ id: 'col-a', name: 'javascript:foo', type: 'text' }, { id: 'col-b', name: 'S', type: 'select', options: [{ value: 'javascript:bar' }, { value: 'data:text/html,x' }] }],
      rows: [{ id: 'row-1', cells: { 'col-a': 'javascript:alert(1)', 'col-b': 'javascript:bar' } }],
    });
    const r = check(t);
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].data.table.columns[0].name).toBe('javascript:foo');
    expect(r.content.elements[0].data.table.columns[1].options[0].value).toBe('javascript:bar');
    expect(r.content.elements[0].data.table.rows[0].cells['col-a']).toBe('javascript:alert(1)');
    expect(r.warnings.join(' ')).not.toMatch(/unsafe URL/);
  });

  test('other element data is still URL-stripped next to a table', () => {
    const r = validateDiagramContent({ elements: [el(table()), { id: 'el-x', type: 'rectangle', label: 'x', x: 0, y: 0, data: { href: 'javascript:alert(1)' } }] });
    expect(r.ok).toBe(true);
    expect(r.content.elements[1].data.href).toBeUndefined();
  });

  test('__proto__ keys in a table are refused by the shared structure check', () => {
    const t = JSON.parse('{"columns":[{"id":"col-a","name":"a","type":"text"}],"rows":[{"id":"row-1","cells":{"__proto__":"x"}}]}');
    expect(check(t).ok).toBe(false);
  });
});

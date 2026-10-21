import { ExportManager } from '../../../components/diagram-studio/export/ExportManager';
import { remapForMerge, sanitizeContent } from '../../../components/diagram-studio/export/diagramJson';
import { tableElementSize } from '../../../lib/table/tableModel';

const table = () => ({
  headerRow: true,
  columns: [{ id: 'col-a', name: 'Name', type: 'text' }, { id: 'col-b', name: 'N', type: 'number' }],
  rows: [{ id: 'row-1', cells: { 'col-a': 'Gateway <b>', 'col-b': 3 }, elementId: 'el-a' }, { id: 'row-2', cells: { 'col-a': 'x' }, elementId: 'el-outside' }],
});
const tableEl = () => ({ id: 'el-t', type: 'table', packId: 'core', label: 'Inventory', x: 10, y: 20, size: tableElementSize(table()), data: { table: table() } });
const box = (id) => ({ id, type: 'rectangle', packId: 'core', label: id, x: 0, y: 0, size: { width: 50, height: 50 } });

describe('SVG export without a live canvas draws table cells', () => {
  test('header, cells and title are in the output; markup in a cell is escaped', () => {
    const out = new ExportManager().exportSVG({ name: 'D', elements: [tableEl()], connections: [] });
    expect(out.content).toContain('>Inventory<');
    expect(out.content).toContain('>Name<');
    expect(out.content).toContain('>Gateway &lt;b&gt;<');
    expect(out.content).not.toMatch(/<b>/);
  });
});

describe('JSON import', () => {
  test('a valid table survives sanitizeContent; a broken table element is skipped with a warning', () => {
    const good = sanitizeContent({ elements: [tableEl()], connections: [] });
    expect(good.ok).toBe(true);
    expect(good.content.elements).toHaveLength(1);
    const bad = tableEl();
    bad.data.table.columns[0].type = 'date';
    const r = sanitizeContent({ elements: [bad], connections: [] });
    expect(r.content.elements).toHaveLength(0);
    expect(r.warnings.join(' ')).toMatch(/1 invalid element/);
  });
  test('merge/insert remaps row links to the new element ids and drops links to elements that are not inserted', () => {
    const out = remapForMerge({ elements: [tableEl(), box('el-a')], connections: [] }, { idGen: (() => { let n = 0; return () => `new-${++n}`; })() });
    const t = out.elements.find((e) => e.type === 'table');
    const a = out.elements.find((e) => e.label === 'el-a');
    expect(t.data.table.rows[0].elementId).toBe(a.id);
    expect(t.data.table.rows[1]).not.toHaveProperty('elementId');
  });
});

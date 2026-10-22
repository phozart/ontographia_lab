/**
 * @jest-environment node
 */
import { tableToHtml, tableToTsv } from '../../lib/table/tableClipboard';

const table = {
  headerRow: true,
  columns: [{ id: 'c1', name: 'Name', type: 'text' }, { id: 'c2', name: 'Qty', type: 'number' }, { id: 'c3', name: 'Done', type: 'boolean' }],
  rows: [
    { id: 'r1', cells: { c1: 'Alpha <b>x</b>', c2: 3, c3: true }, elementId: 'el-1' },
    { id: 'r2', cells: { c1: '=SUM(A1:A2)', c2: -5 } },
    { id: 'r3', cells: { c1: '-1+2', c2: '@cmd' } },
    { id: 'r4', cells: { c1: 'multi\nline\tcell' } },
  ],
};
const CTX = { origin: 'https://lab.example.com', diagramRef: 'LAB-9' };

describe('tableToTsv', () => {
  const lines = tableToTsv(table).split('\n');
  test('header and rows are tab separated', () => {
    expect(lines[0]).toBe('Name\tQty\tDone');
    expect(lines[1]).toBe('Alpha <b>x</b>\t3\ttrue');
  });
  test('formula-looking text is prefixed with a quote, numbers are not', () => {
    expect(lines[2]).toBe("'=SUM(A1:A2)\t-5\t");
    expect(lines[3]).toBe("'-1+2\t'@cmd\t");
  });
  test('tabs and newlines inside a cell are flattened', () => {
    expect(lines[4]).toBe('multi line cell\t\t');
    expect(lines).toHaveLength(5);
  });
  test('a header-less table has no header line', () => {
    expect(tableToTsv({ ...table, headerRow: false }).split('\n')).toHaveLength(4);
  });
});

describe('tableToHtml', () => {
  const html = tableToHtml(table, CTX);
  test('inline-styled table with bordered cells and shaded header', () => {
    expect(html).toMatch(/^<table [^>]*border="1"/);
    expect(html).toMatch(/<th style="[^"]*background-color/);
    expect(html).toMatch(/<td style="[^"]*border:1px solid/);
    expect(html).not.toMatch(/\sclass=/);
  });
  test('cells are escaped', () => {
    expect(html).toContain('Alpha &lt;b&gt;x&lt;/b&gt;');
    expect(html).not.toContain('<b>');
  });
  test('a row linked to an element gets an absolute lab link; unlinked rows and missing origin do not', () => {
    expect(html).toContain('href="https://lab.example.com/diagram/LAB-9?focus=el-1"');
    expect((html.match(/<a /g) || []).length).toBe(1);
    expect(tableToHtml(table)).not.toContain('<a ');
  });
  test('a forged element id never becomes a link', () => {
    const bad = { ...table, rows: [{ id: 'r', cells: { c1: 'x' }, elementId: '"><script>' }] };
    expect(tableToHtml(bad, CTX)).not.toMatch(/<a |<script/);
  });
});

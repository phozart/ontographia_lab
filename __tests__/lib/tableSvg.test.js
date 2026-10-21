/**
 * @jest-environment jsdom
 */
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { tableElementSize } from '../../lib/table/tableModel';

const table = (rows = [], over = {}) => ({
  headerRow: true,
  columns: [{ id: 'col-a', name: 'Component', type: 'text' }, { id: 'col-b', name: 'Tier', type: 'select', options: [{ value: 'edge', color: '#E8A99A' }] }, { id: 'col-c', name: 'N', type: 'number' }, { id: 'col-d', name: 'Ok', type: 'boolean' }],
  rows,
  ...over,
});
const content = (t, extra = []) => ({
  elements: [{ id: 'el-t', type: 'table', packId: 'core', label: 'Inventory', x: 100, y: 100, size: tableElementSize(t), data: { table: t } }, ...extra],
  connections: [],
});
const parse = (svg) => new DOMParser().parseFromString(svg, 'image/svg+xml');

describe('renderDiagramSvg draws tables', () => {
  const rows = [
    { id: 'row-1', cells: { 'col-a': 'Gateway', 'col-b': 'edge', 'col-c': 3, 'col-d': true }, elementId: 'el-live' },
    { id: 'row-2', cells: { 'col-a': 'Auth', 'col-d': false }, elementId: 'el-gone' },
  ];
  test('header, cells, title, boolean marks; the output is well formed XML', () => {
    const { svg } = renderDiagramSvg(content(table(rows), [{ id: 'el-live', type: 'rectangle', packId: 'core', label: 'x', x: 0, y: 0, size: { width: 50, height: 50 } }]));
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    const texts = [...doc.querySelectorAll('text')].map((t) => t.textContent);
    expect(texts).toEqual(expect.arrayContaining(['Inventory', 'Component', 'Tier', 'Gateway', 'edge', '3', 'Auth', '✓', '–']));
  });
  test('a row linked to a deleted element is drawn hollow, a live link filled', () => {
    const { svg } = renderDiagramSvg(content(table(rows), [{ id: 'el-live', type: 'rectangle', packId: 'core', label: 'x', x: 0, y: 0, size: { width: 50, height: 50 } }]));
    const circles = [...parse(svg).querySelectorAll('circle')];
    expect(circles.map((c) => c.getAttribute('fill'))).toEqual(['#4FB3CE', 'none']);
  });
  test('cell text is escaped: markup stays text, no script, no event attributes, no href', () => {
    const evil = [{ id: 'row-1', cells: { 'col-a': '<script>alert(1)</script><img src=x onerror=alert(2)>"&' } }];
    const { svg } = renderDiagramSvg(content(table(evil, { columns: table().columns.map((c) => (c.id === 'col-a' ? { ...c, name: '</text><script>x</script>' } : c)) })));
    const doc = parse(svg);
    expect(doc.querySelector('parsererror')).toBeNull();
    expect(doc.querySelector('script, img')).toBeNull();
    expect(svg).not.toMatch(/\son\w+=|href|<script/i);
  });
  test('a hostile select colour cannot become a url() fill', () => {
    const t = table([{ id: 'row-1', cells: { 'col-b': 'edge' } }], { columns: table().columns.map((c) => (c.type === 'select' ? { ...c, options: [{ value: 'edge', color: 'url(http://evil/x)' }] } : c)) });
    expect(renderDiagramSvg(content(t)).svg).not.toMatch(/url\(http/);
  });
  test('a 500 row table is drawn up to a row cap with a footer, within the byte budget', () => {
    const many = Array.from({ length: 500 }, (_, i) => ({ id: `row-${i}`, cells: { 'col-a': `Component ${i}`, 'col-c': i } }));
    const out = renderDiagramSvg(content(table(many)));
    expect(out.svg.length).toBeLessThan(96 * 1024);
    expect(out.svg).toMatch(/… 460 more rows/);
  });
});

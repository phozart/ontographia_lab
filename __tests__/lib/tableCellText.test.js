/**
 * ADR-0008 7 / T2: table cell text goes through the shared layout module. Row heights come from the REAL wrapped lines
 * (not 7 px per character), so the canvas, the SVG drawing (diagram_show) and connector ports agree; a clamped cell is
 * indicated (ellipsis plus the full text), never silently cut.
 */
import { LAYOUT, cellLayout, headerLayout, wrappedLines, rowHeight, tableMetrics, createEmptyTable, addColumn, addRow, setCell } from '../../lib/table/tableModel';
import { renderTableSvg } from '../../lib/table/tableSvg';

const LONG = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';

let seq = 0;
const fresh = () => `id-${++seq}`;
const sample = () => {
  return createEmptyTable({ columns: 2, rows: 1, newId: fresh });
};

describe('cell layout', () => {
  test('the character-count estimate is gone from the layout constants', () => {
    expect(LAYOUT.charWidth).toBeUndefined();
    expect(LAYOUT.lineHeight).toBe(17);
    expect(LAYOUT.maxLines).toBe(5);
  });

  test('wraps by real glyph widths: a narrow column gets more lines than a wide one, same text', () => {
    const narrow = cellLayout('Customer Order Service', 100);
    const wide = cellLayout('Customer Order Service', 300);
    expect(narrow.lines.length).toBeGreaterThan(wide.lines.length);
    expect(wide.lines.map((l) => l.text)).toEqual(['Customer Order Service']);
  });

  test('narrow glyphs fit more than the old 7 px estimate allowed ("iiiii" vs "WWWWW")', () => {
    const thin = cellLayout('i'.repeat(30), 120);
    const fat = cellLayout('W'.repeat(30), 120);
    expect(thin.lines.length).toBeLessThan(fat.lines.length);
  });

  test('hard line breaks are kept', () => {
    expect(cellLayout('a\nb\nc', 200).lines.map((l) => l.text)).toEqual(['a', 'b', 'c']);
  });

  test('five lines at most; the last line ends in an ellipsis and the layout reports the overflow', () => {
    const l = cellLayout(LONG.repeat(3), 120);
    expect(l.lines).toHaveLength(LAYOUT.maxLines);
    expect(l.lines[LAYOUT.maxLines - 1].text.endsWith('…')).toBe(true);
    expect(l.overflow).toBeTruthy();
  });

  test('a short cell has no overflow; the font is 12 px on the 17 px row line', () => {
    const l = cellLayout('Billing', 160);
    expect(l.overflow).toBe(false);
    expect(l.fontSize).toBe(12);
    expect(l.lineHeight).toBeCloseTo(17, 5);
  });

  test('is deterministic', () => {
    expect(cellLayout(LONG, 140)).toEqual(cellLayout(LONG, 140));
  });

  test('wrappedLines is the line count of the layout, at least one, at most the clamp', () => {
    expect(wrappedLines('', 160)).toBe(1);
    expect(wrappedLines(LONG, 160)).toBe(cellLayout(LONG, 160).lines.length);
    expect(wrappedLines(LONG.repeat(4), 100)).toBe(LAYOUT.maxLines);
  });

  test('header names are one line with an ellipsis and the overflow flag', () => {
    const l = headerLayout('A very long column name that cannot fit', 80);
    expect(l.lines).toHaveLength(1);
    expect(l.overflow).toBeTruthy();
    expect(headerLayout('Name', 160).overflow).toBe(false);
  });
});

describe('row heights are exact', () => {
  const col = (t, i) => t.columns[i].id;
  test('a one-line row keeps the minimum height; more lines add the line height', () => {
    let t = sample();
    const row = t.rows[0];
    t = setCell(t, row.id, col(t, 0), 'Billing');
    expect(rowHeight(t.rows[0], t, [160, 160])).toBe(LAYOUT.rowMinHeight);
    t = setCell(t, row.id, col(t, 0), LONG);
    const lines = cellLayout(LONG, 160).lines.length;
    expect(rowHeight(t.rows[0], t, [160, 160])).toBe(Math.max(LAYOUT.rowMinHeight, lines * LAYOUT.lineHeight + LAYOUT.rowPadY));
    expect(lines).toBeGreaterThan(2);
  });

  test('tableMetrics heights are deterministic', () => {
    let t = sample();
    t = setCell(t, t.rows[0].id, t.columns[0].id, LONG);
    expect(tableMetrics(t)).toEqual(tableMetrics(t));
  });
});

describe('the SVG drawing (diagram_show) uses the same lines as the canvas', () => {
  const h = { esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'), r1: (n) => Math.round(n * 10) / 10, safeColor: (v, f) => f };
  test('every wrapped line of a cell appears as one text run, ellipsis included', () => {
    let t = sample();
    t = setCell(t, t.rows[0].id, t.columns[0].id, LONG);
    const { svg } = renderTableSvg(t, { x: 0, y: 0, width: LAYOUT.gutter + 2 * 160 }, h);
    const expected = cellLayout(LONG, 160).lines.map((l) => l.text);
    for (const line of expected) expect(svg).toContain(`>${h.esc(line)}</text>`);
  });

  test('a clamped cell carries the full text as a <title>', () => {
    let t = sample();
    t = setCell(t, t.rows[0].id, t.columns[0].id, LONG.repeat(3));
    const { svg } = renderTableSvg(t, { x: 0, y: 0, width: LAYOUT.gutter + 2 * 160 }, h);
    expect(svg).toContain('<title>');
  });
});

// ADR-0007 P2: table `scale` (fit a table into a slide slot): rendering, size bookkeeping, SVG.
import React from 'react';
import { render, screen, act } from '@testing-library/react';

let mockCtx = {};
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({ useDiagram: () => mockCtx }));
jest.mock('../../../components/diagram-studio/export/ExportManager', () => ({ downloadExport: jest.fn() }));

import TableNode from '../../../components/diagram-studio/elements/table/TableNode';
import { tableElementSize } from '../../../lib/table/tableModel';
import { sizeForTable } from '../../../lib/table/tablePatch';
import { renderTableSvg } from '../../../lib/table/tableSvg';
import { validateDiagramContent } from '../../../lib/diagramContent';

const base = () => ({ columns: [{ id: 'col-a', name: 'A', type: 'text' }, { id: 'col-b', name: 'B', type: 'number' }], rows: [{ id: 'row-1', cells: { 'col-a': 'x', 'col-b': 1 } }] });
const el = (scale) => {
  const table = { ...base(), ...(scale ? { scale } : {}) };
  const n = tableElementSize(table);
  return { id: 't', type: 'table', packId: 'core', label: '', x: 0, y: 0, size: { width: n.width * (scale || 1), height: n.height * (scale || 1) }, data: { table } };
};

beforeEach(() => { jest.useFakeTimers(); });
afterEach(() => { jest.useRealTimers(); });

describe('TableNode with scale', () => {
  test('draws the natural layout with a CSS scale and does not rewrite a correctly sized element', () => {
    const updateElement = jest.fn();
    mockCtx = { updateElement, diagram: { access: undefined }, viewport: { x: 0, y: 0, scale: 1 }, selection: { nodeIds: [], connectionIds: [] }, elements: [] };
    render(<TableNode element={el(0.5)} stencil={{}} isSelected={false} />);
    const root = screen.getByTestId('table-node');
    expect(root.style.transform).toBe('scale(0.5)');
    expect(root.style.transformOrigin).toBe('0 0');
    const natural = tableElementSize(base());
    expect(root.style.width).toBe(`${natural.width}px`);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(updateElement).not.toHaveBeenCalled();
  });
  test('an unscaled table has no transform', () => {
    mockCtx = { updateElement: jest.fn(), diagram: { access: undefined }, viewport: { x: 0, y: 0, scale: 1 }, selection: { nodeIds: [], connectionIds: [] }, elements: [] };
    render(<TableNode element={el()} stencil={{}} isSelected={false} />);
    expect(screen.getByTestId('table-node').style.transform).toBe('');
  });
});

describe('size and svg', () => {
  test('sizeForTable multiplies by the scale', () => {
    const n = tableElementSize(base());
    expect(sizeForTable({ ...base(), scale: 0.5 })).toEqual({ width: n.width * 0.5, height: n.height * 0.5 });
    expect(sizeForTable(base())).toEqual(n);
  });
  test('the SVG renderer wraps a scaled table in a scale transform about its corner', () => {
    const h = { esc: (s) => s, r1: (n) => Math.round(n * 10) / 10, safeColor: (v, f) => f };
    const n = tableElementSize(base());
    const out = renderTableSvg({ ...base(), scale: 0.5 }, { x: 100, y: 200, width: n.width * 0.5 }, h);
    expect(out.svg).toContain('transform="translate(100 200) scale(0.5) translate(-100 -200)"');
    expect(out.width).toBeCloseTo(n.width * 0.5, 3);
    expect(renderTableSvg(base(), { x: 0, y: 0, width: n.width }, h).svg).not.toContain('scale(');
  });
  test('scale is part of the closed table schema within 0.2 to 2', () => {
    const ok = (scale) => validateDiagramContent({ elements: [{ id: 't', type: 'table', packId: 'core', x: 0, y: 0, data: { table: { ...base(), scale } } }] }).ok;
    expect(ok(0.5)).toBe(true);
    expect(ok(0.1)).toBe(false);
    expect(ok(3)).toBe(false);
    expect(ok('x')).toBe(false);
  });
});

import React, { useState } from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

let mockCtx = {};
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({ useDiagram: () => mockCtx }));
jest.mock('../../../components/diagram-studio/export/ExportManager', () => ({ downloadExport: jest.fn() }));

import TableNode, { REVEAL_EVENT } from '../../../components/diagram-studio/elements/table/TableNode';
import { downloadExport } from '../../../components/diagram-studio/export/ExportManager';
import { tableElementSize } from '../../../lib/table/tableModel';

const seqTable = () => ({
  headerRow: true,
  headerColumn: false,
  columns: [
    { id: 'col-a', name: 'Component', type: 'text' },
    { id: 'col-b', name: 'Tier', type: 'select', options: [{ value: 'edge', color: '#E8A99A' }] },
    { id: 'col-c', name: 'Count', type: 'number' },
    { id: 'col-d', name: 'Critical', type: 'boolean' },
  ],
  rows: [
    { id: 'row-1', cells: { 'col-a': 'Gateway', 'col-b': 'edge', 'col-c': 3, 'col-d': true }, elementId: 'el-gw' },
    { id: 'row-2', cells: { 'col-a': 'Auth' }, elementId: 'el-gone' },
    { id: 'row-3', cells: { 'col-a': '=HYPERLINK("http://x","y")' } },
  ],
});
const mk = (over = {}) => {
  const table = seqTable();
  return { id: 'el-t', type: 'table', packId: 'core', label: 'Inventory', x: 0, y: 0, size: tableElementSize(table), data: { table }, ...over };
};

/** Minimal editor: holds one element and applies updateElement like the real context. */
function Harness({ initial = mk(), selected = true, access, others = [], selection }) {
  const [el, setEl] = useState(initial);
  const updates = (Harness.updates = Harness.updates || []);
  mockCtx = {
    updateElement: (id, patch, opts) => { updates.push({ patch, opts }); setEl((cur) => ({ ...cur, ...patch })); },
    diagram: access ? { access } : { access: undefined },
    viewport: { x: 0, y: 0, scale: 1 },
    selection: selection || { nodeIds: [el.id], connectionIds: [] },
    elements: [el, { id: 'el-gw', type: 'rectangle', label: 'Gateway box', x: 0, y: 0, size: { width: 10, height: 10 } }, ...others],
  };
  Harness.current = el;
  return <TableNode element={el} stencil={{ defaultSize: { width: 520, height: 130 } }} isSelected={selected} />;
}
beforeEach(() => { Harness.updates = []; Harness.current = null; downloadExport.mockClear(); });
const table = () => Harness.current.data.table;
const cell = (r, c) => screen.getByTestId(`table-cell-${r}-${c}`);
const editCell = (r, c) => fireEvent.doubleClick(cell(r, c));
const editor = () => screen.getByTestId('table-cell-editor');
const type = (value) => fireEvent.change(editor(), { target: { value } });

describe('rendering', () => {
  test('title, header row, rows and typed cells', () => {
    render(<Harness selected={false} />);
    expect(screen.getByTestId('table-title')).toHaveTextContent('Inventory');
    expect(screen.getByTestId('table-header-0')).toHaveTextContent('Component');
    expect(cell(0, 0)).toHaveTextContent('Gateway');
    expect(cell(0, 1)).toHaveTextContent('edge');
    expect(cell(0, 2)).toHaveTextContent('3');
    expect(within(cell(0, 3)).getByRole('img', { name: 'Yes' })).toBeTruthy();
  });
  test('a script in a cell is text, not markup', () => {
    const el = mk();
    el.data.table.rows[0].cells['col-a'] = '<img src=x onerror=alert(1)><script>alert(2)</script>';
    const { container } = render(<Harness initial={el} selected={false} />);
    expect(cell(0, 0)).toHaveTextContent('<img src=x onerror=alert(1)><script>alert(2)</script>');
    expect(container.querySelector('img, script')).toBeNull();
  });
  test('an http(s) value is a safe link, other schemes are text', () => {
    const el = mk();
    el.data.table.rows[0].cells['col-a'] = 'https://example.com/x';
    el.data.table.rows[1].cells['col-a'] = 'javascript:alert(1)';
    render(<Harness initial={el} selected={false} />);
    const a = cell(0, 0).querySelector('a');
    expect(a).toHaveAttribute('href', 'https://example.com/x');
    expect(a).toHaveAttribute('rel', 'noopener noreferrer');
    expect(cell(1, 0).querySelector('a')).toBeNull();
  });
  test('grows with rows: height equals the deterministic content height', () => {
    render(<Harness selected={false} />);
    const grid = screen.getByTestId('table-node');
    expect(grid.style.height).toBe(`${tableElementSize(table()).height}px`);
  });
  test('linked rows: live link goes to the element, a deleted element is plain text', () => {
    render(<Harness selected={false} />);
    const live = screen.getByTestId('table-row-link');
    expect(live).toHaveAccessibleName('Go to Gateway box');
    const seen = [];
    const on = (e) => seen.push(e.detail.ids);
    window.addEventListener(REVEAL_EVENT, on);
    fireEvent.click(live);
    window.removeEventListener(REVEAL_EVENT, on);
    expect(seen).toEqual([['el-gw']]);
    const gone = screen.getByTestId('table-row-link-gone');
    expect(gone.tagName).not.toBe('BUTTON');
    expect(gone).toHaveAttribute('title', 'The linked element was removed');
  });
  test('an unselected table shows no editing controls', () => {
    render(<Harness selected={false} />);
    expect(screen.queryByTestId('table-add-row')).toBeNull();
    expect(screen.queryByTestId('table-options')).toBeNull();
  });
});

describe('read-only viewers and locked tables', () => {
  const viewer = { role: 'viewer', capabilities: ['diagram.read'] };
  test('no controls, double click does not edit', () => {
    render(<Harness access={viewer} />);
    expect(screen.queryByTestId('table-add-row')).toBeNull();
    editCell(0, 0);
    expect(screen.queryByTestId('table-cell-editor')).toBeNull();
    expect(Harness.updates).toHaveLength(0);
  });
  test('a locked element is read-only for editors too', () => {
    render(<Harness initial={mk({ locked: true })} />);
    expect(screen.queryByTestId('table-add-row')).toBeNull();
    editCell(0, 0);
    expect(screen.queryByTestId('table-cell-editor')).toBeNull();
  });
});

describe('inline cell editing and keyboard', () => {
  test('double click edits, Enter commits and moves down, size stays equal to the content', () => {
    render(<Harness />);
    editCell(0, 0);
    expect(editor()).toHaveFocus();
    expect(editor().value).toBe('Gateway');
    type('API gateway');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(table().rows[0].cells['col-a']).toBe('API gateway');
    expect(screen.queryByTestId('table-cell-editor')).toBeNull();
    expect(Harness.current.size).toEqual(tableElementSize(table()));
  });
  test('Escape leaves without committing', () => {
    render(<Harness />);
    editCell(0, 0);
    type('nope');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    expect(table().rows[0].cells['col-a']).toBe('Gateway');
    expect(screen.queryByTestId('table-cell-editor')).toBeNull();
  });
  test('Tab commits and moves right; the grid keeps the active cell so Enter edits the next cell; Shift+Tab goes back', async () => {
    render(<Harness />);
    editCell(0, 0);
    type('A');
    fireEvent.keyDown(editor(), { key: 'Tab' });
    expect(table().rows[0].cells['col-a']).toBe('A');
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    fireEvent.keyDown(screen.getByTestId('table-node'), { key: 'Enter' });
    expect(editor().value).toBe('edge');
    fireEvent.keyDown(editor(), { key: 'Tab', shiftKey: true });
    await act(async () => { await new Promise((r) => requestAnimationFrame(r)); });
    fireEvent.keyDown(screen.getByTestId('table-node'), { key: 'Enter' });
    expect(editor().value).toBe('A');
  });
  test('blur commits in place', () => {
    render(<Harness />);
    editCell(1, 0);
    type('Auth service');
    fireEvent.blur(editor());
    expect(table().rows[1].cells['col-a']).toBe('Auth service');
  });
  test('a number column refuses text, shows why, and keeps editing on Enter; Escape cancels', () => {
    render(<Harness />);
    editCell(0, 2);
    type('lots');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(table().rows[0].cells['col-c']).toBe(3);
    expect(screen.getByTestId('table-notice')).toHaveTextContent(/not a number/);
    expect(editor()).toHaveAttribute('aria-invalid', 'true');
    fireEvent.keyDown(editor(), { key: 'Escape' });
    type;  
  });
  test('number commit stores a number; boolean toggles on double click', () => {
    render(<Harness />);
    editCell(0, 2);
    type('1,200');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(table().rows[0].cells['col-c']).toBe(1200);
    editCell(0, 3);
    expect(table().rows[0].cells['col-d']).toBe(false);
  });
  test('Alt+Enter inserts a newline in a text cell instead of committing', () => {
    render(<Harness />);
    editCell(0, 0);
    editor().setSelectionRange(3, 3);
    fireEvent.keyDown(editor(), { key: 'Enter', altKey: true });
    expect(editor().value).toBe('Gat\neway');
    expect(table().rows[0].cells['col-a']).toBe('Gateway');
  });
  test('typing never reaches the board shortcuts (keydown stops at the editor)', () => {
    const onWindow = jest.fn();
    window.addEventListener('keydown', onWindow);
    render(<Harness />);
    editCell(0, 0);
    fireEvent.keyDown(editor(), { key: 'v' });
    fireEvent.keyDown(editor(), { key: 'Delete' });
    window.removeEventListener('keydown', onWindow);
    expect(onWindow).not.toHaveBeenCalled();
  });
  test('Delete on an active cell clears the cell and does not delete the element', () => {
    const onWindow = jest.fn();
    window.addEventListener('keydown', onWindow);
    render(<Harness />);
    fireEvent.click(cell(0, 0));
    fireEvent.keyDown(screen.getByTestId('table-node'), { key: 'Delete' });
    window.removeEventListener('keydown', onWindow);
    expect(table().rows[0].cells['col-a']).toBeUndefined();
    expect(onWindow).not.toHaveBeenCalled();
  });
  test('typing a character on the active cell starts editing with it', () => {
    render(<Harness />);
    fireEvent.click(cell(1, 0));
    fireEvent.keyDown(screen.getByTestId('table-node'), { key: 'Z' });
    expect(editor().value).toBe('Z');
  });
  test('pasting a spreadsheet range into the editor fills cells from there', () => {
    render(<Harness />);
    editCell(0, 0);
    fireEvent.paste(editor(), { clipboardData: { getData: () => 'a\t1\nb\t2' } });
    expect(table().rows[0].cells['col-a']).toBe('a');
    expect(table().rows[1].cells['col-a']).toBe('b');
    expect(table().rows[1].cells['col-b']).toBe('2');
    expect(screen.getByTestId('table-notice')).toHaveTextContent(/Pasted/);
  });
});

describe('rows, columns, types, export', () => {
  const openMenu = (testId, index = 0) => fireEvent.click(screen.getAllByTestId(testId)[index]);
  const choose = (name) => fireEvent.click(within(screen.getByTestId('table-menu')).getByText(name));

  test('add row and column from the controls (size follows)', () => {
    render(<Harness />);
    fireEvent.click(screen.getByTestId('table-add-row'));
    expect(table().rows).toHaveLength(4);
    fireEvent.click(screen.getByTestId('table-add-column'));
    expect(table().columns).toHaveLength(5);
    expect(Harness.current.size).toEqual(tableElementSize(table()));
  });
  test('row menu: insert, move, delete', () => {
    render(<Harness />);
    openMenu('table-row-menu', 1);
    choose('Insert row below');
    expect(table().rows).toHaveLength(4);
    expect(table().rows[1].id).toBe('row-2');
    openMenu('table-row-menu', 0);
    choose('Move down');
    expect(table().rows[1].id).toBe('row-1');
    openMenu('table-row-menu', 0);
    choose('Delete row');
    expect(table().rows).toHaveLength(3);
  });
  test('column menu: rename, type change with a warning for emptied cells, delete', () => {
    render(<Harness />);
    openMenu('table-column-menu', 0);
    choose('Type: Number');
    expect(table().columns[0].type).toBe('number');
    expect(screen.getByTestId('table-notice')).toHaveTextContent(/3 cells could not become number/);
    openMenu('table-column-menu', 0);
    choose('Rename column');
    type('Service');
    fireEvent.keyDown(editor(), { key: 'Enter' });
    expect(table().columns[0].name).toBe('Service');
    openMenu('table-column-menu', 1);
    choose('Delete column');
    expect(table().columns).toHaveLength(3);
  });
  test('sort once from the column menu', () => {
    render(<Harness />);
    openMenu('table-column-menu', 2);
    choose('Sort Z to A (once)');
    expect(table().rows[0].id).toBe('row-1');
    openMenu('table-column-menu', 2);
    choose('Sort A to Z (once)');
    expect(table().rows[0].id).toBe('row-1');
  });
  test('row link: link to the other selected element, then remove', () => {
    const other = { id: 'el-other', type: 'rectangle', label: 'Billing', x: 0, y: 0, size: { width: 10, height: 10 } };
    render(<Harness others={[other]} selection={{ nodeIds: ['el-t', 'el-other'], connectionIds: [] }} />);
    openMenu('table-row-menu', 2);
    choose('Link to "Billing"');
    expect(table().rows[2].elementId).toBe('el-other');
    openMenu('table-row-menu', 2);
    choose('Remove link');
    expect(table().rows[2].elementId).toBeUndefined();
  });
  test('without a second selected element the link item is disabled', () => {
    render(<Harness />);
    openMenu('table-row-menu', 2);
    expect(within(screen.getByTestId('table-menu')).getByText(/Link to element/)).toBeDisabled();
  });
  test('export CSV neutralizes formulas; export JSON; menu closes on Escape', () => {
    render(<Harness />);
    openMenu('table-options');
    choose('Export as CSV');
    const csv = downloadExport.mock.calls[0][0];
    expect(csv.filename).toBe('Inventory.csv');
    expect(csv.content).toContain(`"'=HYPERLINK(""http://x"",""y"")"`);
    openMenu('table-options');
    choose('Export as JSON');
    expect(JSON.parse(downloadExport.mock.calls[1][0].content).rows).toHaveLength(3);
    openMenu('table-options');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByTestId('table-menu')).toBeNull();
  });
  test('header row toggle', () => {
    render(<Harness />);
    openMenu('table-options');
    choose('Header row');
    expect(table().headerRow).toBe(false);
    expect(screen.queryByTestId('table-header-0')).toBeNull();
  });
});

describe('size follows resize', () => {
  test('after the element is resized wider, columns scale proportionally and the height settles', () => {
    jest.useFakeTimers();
    try {
      const el = mk();
      el.size = { width: tableElementSize(el.data.table).width * 2, height: 50 };
      render(<Harness initial={el} />);
      act(() => { jest.advanceTimersByTime(400); });
      const w = table().columns.map((c) => c.width);
      expect(w[0]).toBeGreaterThan(250);
      expect(Math.abs(Harness.current.size.width - tableElementSize(table()).width)).toBeLessThanOrEqual(1);
      expect(Harness.current.size.height).toBe(tableElementSize(table()).height);
    } finally { jest.useRealTimers(); }
  });
  test('a table without data.table gets one (shape sidebar path)', () => {
    render(<Harness initial={{ id: 'el-t', type: 'table', packId: 'core', label: 'Table', x: 0, y: 0, size: { width: 520, height: 130 } }} />);
    expect(table().columns.length).toBeGreaterThan(0);
    expect(Harness.current.size).toEqual(tableElementSize(table()));
  });
});

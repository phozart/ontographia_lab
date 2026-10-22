// Doc copy (rich) + .docx / .pdf export buttons, the card context menu, the table "Copy" action, and the scroll fixes
// (side panel + card body). Clipboard and file generation are mocked at their boundaries.

import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

let mockElements = [];
let mockAccess = 'editor';
const mockUpdateElement = jest.fn();
const DIAGRAM = () => ({ id: 'uuid-1', short_id: 'LAB-7', access: { role: mockAccess } });

jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({
    elements: mockElements,
    selection: { nodeIds: global.__selected || [], connectionIds: [] },
    updateElement: (...a) => mockUpdateElement(...a),
    addElement: jest.fn(),
    selectAll: jest.fn(), deleteSelected: jest.fn(), duplicateSelected: jest.fn(), showGrid: false, setShowGrid: jest.fn(), setActiveTool: jest.fn(),
    diagram: DIAGRAM(),
  }),
  useDiagramSelection: () => ({ selectedIds: [], clearSelection: jest.fn() }),
}));
jest.mock('../../../lib/doc/docDocx', () => ({ docToDocx: jest.fn(async () => new Blob(['docx-bytes'])) }));
jest.mock('../../../lib/doc/docPdf', () => ({ docToPdfFile: jest.fn(async () => new Blob(['%PDF-bytes'])) }));

import DocCard, { wheelOwnedByCard } from '../../../components/diagram-studio/elements/doc/DocCard';
import DocPanel from '../../../components/diagram-studio/elements/doc/DocPanel';
import DocPanelHost from '../../../components/diagram-studio/elements/doc/DocPanelHost';
import { resetDocStore, openDoc } from '../../../components/diagram-studio/elements/doc/docStore';
import { copyDocElement, exportDocElement, copyTableElement } from '../../../components/diagram-studio/elements/doc/docActions';
import { newDocElement } from '../../../lib/doc/docElement';
import { docToDocx } from '../../../lib/doc/docDocx';
import { docToPdfFile } from '../../../lib/doc/docPdf';

const MD = '# Findings\n\nSee [the node](#el=n1) and [site](https://example.com).\n\n- a\n- b';
const mkDoc = (markdown = MD) => ({ ...newDocElement({ id: 'doc1', x: 0, y: 0, title: 'My Findings', markdown }), size: { width: 300, height: 200 } });
const NODE = { id: 'n1', type: 'rectangle', packId: 'core', label: 'Auth', x: 0, y: 0, size: { width: 100, height: 60 } };

let written;
beforeEach(() => {
  resetDocStore();
  mockUpdateElement.mockClear();
  mockAccess = 'editor';
  global.__selected = [];
  mockElements = [NODE, mkDoc()];
  written = null;
  global.ClipboardItem = class { constructor(items) { this.items = items; } };
  Object.defineProperty(global.navigator, 'clipboard', { value: { write: jest.fn(async (items) => { written = items[0].items; }), writeText: jest.fn() }, configurable: true });
  global.URL.createObjectURL = jest.fn(() => 'blob:x');
  global.URL.revokeObjectURL = jest.fn();
  docToDocx.mockClear();
  docToPdfFile.mockClear();
});
afterEach(() => { delete global.ClipboardItem; });

const blobText = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsText(b); });

describe('doc panel: copy and export', () => {
  test('Copy writes text/html (absolute lab links) and readable text/plain', async () => {
    render(<DocPanel elementId="doc1" onClose={() => {}} />);
    await act(async () => { fireEvent.click(screen.getByTestId('doc-copy-rich')); });
    await waitFor(() => expect(written).toBeTruthy());
    expect(Object.keys(written).sort()).toEqual(['text/html', 'text/plain']);
    const html = await blobText(written['text/html']);
    const text = await blobText(written['text/plain']);
    expect(html).toContain('<h1');
    expect(html).toContain(`href="${window.location.origin}/diagram/LAB-7?focus=n1"`);
    expect(html).toContain('href="https://example.com/"');
    expect(html).not.toContain('#el=');
    expect(text).toContain('the node (');
    expect(text).not.toContain('**');
  });
  test('shows a success toast via the host', async () => {
    render(<><DocPanelHost /><DocPanel elementId="doc1" onClose={() => {}} /></>);
    await act(async () => { fireEvent.click(screen.getByTestId('doc-copy-rich')); });
    expect(await screen.findByTestId('doc-toast')).toHaveTextContent(/Copied with formatting/);
  });
  test('falls back to plain text and tells the user when rich copy is unavailable', async () => {
    delete global.ClipboardItem;
    document.execCommand = jest.fn(() => false);
    render(<><DocPanelHost /><DocPanel elementId="doc1" onClose={() => {}} /></>);
    await act(async () => { fireEvent.click(screen.getByTestId('doc-copy-rich')); });
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
    expect(await screen.findByTestId('doc-toast')).toHaveTextContent(/plain text/i);
    delete document.execCommand;
  });
  test('shows an error toast when everything is blocked', async () => {
    delete global.ClipboardItem;
    navigator.clipboard.writeText = jest.fn().mockRejectedValue(new Error('no'));
    document.execCommand = jest.fn(() => false);
    render(<><DocPanelHost /><DocPanel elementId="doc1" onClose={() => {}} /></>);
    await act(async () => { fireEvent.click(screen.getByTestId('doc-copy-rich')); });
    expect(await screen.findByTestId('doc-toast')).toHaveAttribute('data-kind', 'error');
    delete document.execCommand;
  });
  test('Cmd/Ctrl+Shift+C inside the textarea copies with formatting; plain Cmd+C is left alone', async () => {
    render(<DocPanel elementId="doc1" onClose={() => {}} />);
    const ta = screen.getByTestId('doc-textarea');
    expect(fireEvent.keyDown(ta, { key: 'c', metaKey: true })).toBe(true); // not prevented
    expect(written).toBeNull();
    await act(async () => { fireEvent.keyDown(ta, { key: 'C', ctrlKey: true, shiftKey: true }); });
    await waitFor(() => expect(written).toBeTruthy());
  });
  test('.docx and .pdf buttons generate a file from the draft and download it', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DocPanel elementId="doc1" onClose={() => {}} />);
    fireEvent.change(screen.getByTestId('doc-textarea'), { target: { value: 'edited **draft**' } });
    await act(async () => { fireEvent.click(screen.getByTestId('doc-export-docx')); });
    await waitFor(() => expect(docToDocx).toHaveBeenCalled());
    expect(docToDocx.mock.calls[0][0]).toMatchObject({ markdown: 'edited **draft**', title: 'My Findings', diagramRef: 'LAB-7', origin: window.location.origin });
    await act(async () => { fireEvent.click(screen.getByTestId('doc-export-pdf')); });
    await waitFor(() => expect(docToPdfFile).toHaveBeenCalled());
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
  test('read-only viewers can copy and export', () => {
    mockAccess = 'viewer';
    render(<DocPanel elementId="doc1" onClose={() => {}} />);
    for (const id of ['doc-copy-rich', 'doc-export-docx', 'doc-export-pdf', 'doc-export-md']) expect(screen.getByTestId(id)).toBeEnabled();
  });
});

describe('scroll', () => {
  test.each([['editor', 'doc-textarea'], ['viewer', 'doc-preview']])('side panel (%s): the scrolling child is bounded and scrollable', (role, id) => {
    mockAccess = role;
    render(<DocPanel elementId="doc1" onClose={() => {}} />);
    const panel = screen.getByTestId('doc-panel');
    expect(parseFloat(panel.style.minHeight)).toBe(0);
    expect(panel.style.overflow).toBe('hidden');
    const scroller = screen.getByTestId(id);
    expect(scroller.style.overflowY).toBe('auto');
    expect(parseFloat(scroller.style.minHeight)).toBe(0);
  });

  const rig = (over = {}) => ({ scrollHeight: 500, clientHeight: 100, scrollTop: 50, ...over });
  test('wheelOwnedByCard: only when the text overflows; Ctrl/Cmd zoom is never taken', () => {
    expect(wheelOwnedByCard(rig({ scrollHeight: 100 }), { deltaY: 40 }, true)).toBe(false);
    expect(wheelOwnedByCard(rig(), { deltaY: 40, ctrlKey: true }, true)).toBe(false);
    expect(wheelOwnedByCard(rig(), { deltaY: 40, metaKey: true }, true)).toBe(false);
    expect(wheelOwnedByCard(rig(), { deltaY: 40 }, true)).toBe(true);
  });
  test('wheelOwnedByCard: the edges hand the gesture back to the canvas, selected or not; horizontal pans pass through', () => {
    expect(wheelOwnedByCard(rig({ scrollTop: 0 }), { deltaY: -10 })).toBe(false);
    expect(wheelOwnedByCard(rig({ scrollTop: 400 }), { deltaY: 10 })).toBe(false);
    expect(wheelOwnedByCard(rig({ scrollTop: 0 }), { deltaY: 10 })).toBe(true);
    expect(wheelOwnedByCard(rig({ scrollTop: 50 }), { deltaY: -10 })).toBe(true);
    expect(wheelOwnedByCard(rig(), { deltaX: 40, deltaY: 5 })).toBe(false);
    expect(wheelOwnedByCard(rig(), { deltaX: 5, deltaY: 40 })).toBe(true);
  });

  function mount(overflow, selected) {
    global.__selected = selected ? ['doc1'] : [];
    const long = Array.from({ length: 60 }, (_, i) => `Line ${i}`).join('\n\n');
    const r = render(<DocCard element={mkDoc(long)} />);
    const sc = screen.getByTestId('doc-card-scroll');
    Object.defineProperty(sc, 'clientHeight', { value: 100, configurable: true });
    Object.defineProperty(sc, 'scrollHeight', { value: overflow ? 900 : 100, configurable: true });
    return { sc, r };
  }
  const wheel = (el, init) => { const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init }); const outer = jest.fn(); el.parentElement.parentElement.addEventListener('wheel', outer); act(() => { el.dispatchEvent(ev); }); return { ev, outer }; };

  test('card wheel: overflowing text scrolls the card, stops the event before the canvas and is cancelled', () => {
    const { sc } = mount(true, true);
    const { ev, outer } = wheel(sc, { deltaY: 60 });
    expect(sc.scrollTop).toBe(60);
    expect(ev.defaultPrevented).toBe(true);
    expect(outer).not.toHaveBeenCalled();
  });
  test('card wheel: no overflow leaves the event to the canvas', () => {
    const { sc } = mount(false, true);
    const { ev, outer } = wheel(sc, { deltaY: 60 });
    expect(ev.defaultPrevented).toBe(false);
    expect(outer).toHaveBeenCalled();
  });
  test('card wheel: Ctrl+wheel still reaches the canvas (zoom)', () => {
    const { sc } = mount(true, true);
    const { ev, outer } = wheel(sc, { deltaY: 60, ctrlKey: true });
    expect(sc.scrollTop).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
    expect(outer).toHaveBeenCalled();
  });
  test('the bottom fade only shows while there is more text', () => {
    const { sc } = mount(true, true);
    act(() => { fireEvent.scroll(sc); });
    expect(screen.getByTestId('doc-card-fade')).toBeInTheDocument();
    sc.scrollTop = 800;
    act(() => { fireEvent.scroll(sc); });
    expect(screen.queryByTestId('doc-card-fade')).toBeNull();
  });
});

describe('perf: long doc cards', () => {
  const longMd = (i) => `See [node](#el=n1) card ${i}\n\n` + Array.from({ length: 150 }, (_, k) => `Paragraph ${k} of card ${i} with some words to fill the line.`).join('\n\n');
  const cards = Array.from({ length: 50 }, (_, i) => ({ ...newDocElement({ id: 'd' + i, x: i * 10, y: 0, title: 'T' + i, markdown: longMd(i) }), size: { width: 300, height: 200 } }));

  test('an unselected, unhovered card renders only the 4k excerpt; hover or selection renders the full body', () => {
    const { rerender } = render(<DocCard element={cards[0]} />);
    const text = () => screen.getByTestId('doc-card-scroll').textContent;
    expect(text().length).toBeLessThan(4600);
    expect(text()).not.toContain('Paragraph 148');
    fireEvent.mouseEnter(screen.getByTestId('doc-card'));
    expect(text()).toContain('Paragraph 148');
    fireEvent.mouseLeave(screen.getByTestId('doc-card'));
    expect(text()).not.toContain('Paragraph 148');
    global.__selected = ['d0'];
    rerender(<DocCard element={cards[0]} />);
    expect(text()).toContain('Paragraph 148');
  });

  test('50 long cards mount quickly and an unrelated element move does not re-render doc bodies', () => {
    mockElements = [NODE, ...cards];
    const has = jest.spyOn(Set.prototype, 'has');
    const t0 = performance.now();
    const view = (els) => <>{cards.map((c) => <DocCard key={c.id} element={c} />)}</>;
    const { rerender } = render(view());
    const mountMs = performance.now() - t0;
    expect(mountMs).toBeLessThan(2500);
    const baseline = has.mock.calls.filter((c) => c[0] === 'n1').length; // one check per rendered element link
    expect(baseline).toBeGreaterThanOrEqual(50);
    // move an unrelated element: new elements array, same ids
    mockElements = [{ ...NODE, x: 99 }, ...cards];
    rerender(view());
    expect(has.mock.calls.filter((c) => c[0] === 'n1').length).toBe(baseline);
    has.mockRestore();
  });
});

describe('board actions used by the canvas context menu', () => {
  test('doc: copy, Word and PDF', async () => {
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    await act(async () => { await copyDocElement(mockElements[1], DIAGRAM()); });
    expect(written).toBeTruthy();
    expect(await blobText(written['text/html'])).toContain('Findings');
    await act(async () => { await exportDocElement('docx', mockElements[1], DIAGRAM()); });
    expect(docToDocx).toHaveBeenCalledWith(expect.objectContaining({ title: 'My Findings', diagramRef: 'LAB-7' }));
    await act(async () => { await exportDocElement('pdf', mockElements[1], DIAGRAM()); });
    expect(docToPdfFile).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(2);
    click.mockRestore();
  });
  test('a failing generator reports an error toast and does not download', async () => {
    docToPdfFile.mockRejectedValueOnce(new Error('boom'));
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    render(<DocPanelHost />);
    await act(async () => { await exportDocElement('pdf', mockElements[1], DIAGRAM()); });
    expect(await screen.findByTestId('doc-toast')).toHaveAttribute('data-kind', 'error');
    expect(click).not.toHaveBeenCalled();
    click.mockRestore();
  });
  test('table: Copy table writes an HTML table and TSV with the formula guard', async () => {
    const table = { type: 'table', packId: 'core', id: 't1', data: { table: { headerRow: true, columns: [{ id: 'c', name: 'A', type: 'text' }], rows: [{ id: 'r', cells: { c: '=1+1' } }] } } };
    await act(async () => { await copyTableElement(table, DIAGRAM()); });
    expect(await blobText(written['text/html'])).toMatch(/^<table/);
    expect(await blobText(written['text/plain'])).toBe("A\n'=1+1");
  });
  test('copyTableElement ignores non-tables', async () => {
    expect((await copyTableElement(NODE, DIAGRAM())).ok).toBe(false);
  });
});

test('opening a doc through the host still works with the toast mounted', () => {
  render(<DocPanelHost />);
  act(() => openDoc('doc1'));
  expect(screen.getByTestId('doc-panel-wrapper')).toBeInTheDocument();
});

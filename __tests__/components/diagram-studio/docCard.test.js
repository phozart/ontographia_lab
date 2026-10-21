// AI-5: the doc card, the safe renderer and the side-panel editor (component level).
// Security: nothing in hostile markdown may become a script, an image, an inline handler or an unsafe link in the DOM.

import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

let mockElements = [];
let mockSelection = { nodeIds: [], connectionIds: [] };
let mockAccess = 'editor';
const mockUpdateElement = jest.fn();

jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({
    elements: mockElements,
    selection: mockSelection,
    updateElement: (...a) => mockUpdateElement(...a),
    addElement: jest.fn(),
    diagram: { access: { role: mockAccess } },
  }),
}));

import DocMarkdown from '../../../components/diagram-studio/elements/doc/DocMarkdown';
import DocCard from '../../../components/diagram-studio/elements/doc/DocCard';
import DocPanel from '../../../components/diagram-studio/elements/doc/DocPanel';
import DocPanelHost from '../../../components/diagram-studio/elements/doc/DocPanelHost';
import { registerElementLinkHandler, resetDocStore, getOpenDocId, openDoc } from '../../../components/diagram-studio/elements/doc/docStore';
import { docElementFromMarkdownFile } from '../../../components/diagram-studio/elements/doc/useDocImport';
import { newDocElement } from '../../../lib/doc/docElement';
import { MAX_DOC_BYTES } from '../../../lib/doc/markdown';

const NODE = { id: 'n1', type: 'rectangle', packId: 'core', label: 'Auth service', x: 0, y: 0, size: { width: 100, height: 60 } };
const mkDoc = (markdown, over = {}) => ({ ...newDocElement({ id: 'doc1', x: 0, y: 0, title: 'Findings', markdown }), ...over });

beforeEach(() => {
  resetDocStore();
  mockUpdateElement.mockClear();
  mockAccess = 'editor';
  mockSelection = { nodeIds: [], connectionIds: [] };
  mockElements = [NODE];
});

const HOSTILE = [
  '<script>window.__pwned = 1</script>',
  '<img src=x onerror="window.__pwned=1">',
  '<a href="javascript:window.__pwned=1">x</a>',
  '[x](javascript:window.__pwned=1)',
  '[x](JaVaScRiPt:window.__pwned=1)',
  '[x](data:text/html,<script>window.__pwned=1</script>)',
  '[x](vbscript:msgbox(1))',
  '![x](https://tracker.example.com/pixel.png)',
  '![x](javascript:window.__pwned=1)',
  '<iframe src="https://evil.example.com"></iframe>',
  '<svg onload="window.__pwned=1"></svg>',
  '[ref]: javascript:window.__pwned=1\n\n[click][ref]',
  '&lt;script&gt;window.__pwned=1&lt;/script&gt; &#60;img src=x onerror=1&#62;',
  '<https://ok.example.com> <javascript:window.__pwned=1>',
  '- '.repeat(200) + 'deep',
  '> '.repeat(200) + 'deep',
];

function assertInert(container) {
  expect(container.querySelector('script, img, iframe, svg[onload], object, embed, style, link, form')).toBeNull();
  for (const el of container.querySelectorAll('*')) {
    for (const attr of el.getAttributeNames()) {
      expect(attr.toLowerCase().startsWith('on')).toBe(false);
    }
  }
  for (const a of container.querySelectorAll('a')) {
    const href = a.getAttribute('href');
    expect(href).toMatch(/^(https?:\/\/|mailto:|#el=|\/diagram\/)/i);
  }
  expect(window.__pwned).toBeUndefined();
}

describe('DocMarkdown: hostile markdown renders as inert text', () => {
  test.each(HOSTILE)('%j', (md) => {
    const { container } = render(<DocMarkdown markdown={md} />);
    assertInert(container);
  });

  test('the same input renders as inert text on the card', () => {
    for (const md of HOSTILE) {
      const { container, unmount } = render(<DocCard element={mkDoc(md)} />);
      assertInert(container);
      unmount();
    }
  });

  test('raw HTML is visible as text, not interpreted', () => {
    render(<DocMarkdown markdown={'<b>not bold</b>'} />);
    expect(screen.getByText('<b>not bold</b>')).toBeInTheDocument();
  });

  test('external links open in a new tab with noopener noreferrer', () => {
    const { container } = render(<DocMarkdown markdown="[site](https://example.com/a)" />);
    const a = container.querySelector('a');
    expect(a).toHaveAttribute('href', 'https://example.com/a');
    expect(a).toHaveAttribute('target', '_blank');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });
});

describe('element links (#el=)', () => {
  test('click selects/zooms through the registered handler and does not navigate', () => {
    const handler = jest.fn();
    registerElementLinkHandler(handler);
    const { container } = render(<DocMarkdown markdown="See [Auth](#el=n1)." knownIds={new Set(['n1'])} onElementLink={(id) => handler(id)} />);
    const a = container.querySelector('a[data-doc-link="element"]');
    const notPrevented = fireEvent.click(a);
    expect(handler).toHaveBeenCalledWith('n1');
    expect(notPrevented).toBe(false); // default prevented: the page does not navigate
  });

  test('a dangling link renders as struck-through plain text, not a link', () => {
    const { container } = render(<DocMarkdown markdown="See [Gone](#el=zzz)." knownIds={new Set(['n1'])} />);
    expect(container.querySelector('a')).toBeNull();
    const span = container.querySelector('[data-doc-link="dangling"]');
    expect(span).toHaveTextContent('Gone');
    expect(span.style.textDecoration).toBe('line-through');
  });

  test('on the card the link follows the studio handler and knows the board elements', () => {
    const handler = jest.fn();
    registerElementLinkHandler(handler);
    mockElements = [NODE, mkDoc('Auth: [Auth service](#el=n1), missing: [Old](#el=nope)')];
    const { container } = render(<DocCard element={mockElements[1]} />);
    fireEvent.click(container.querySelector('a[data-doc-link="element"]'));
    expect(handler).toHaveBeenCalledWith('n1');
    expect(container.querySelector('[data-doc-link="dangling"]')).toHaveTextContent('Old');
  });
});

describe('DocCard', () => {
  test('shows the title and rendered first lines; empty doc shows a hint', () => {
    const { rerender } = render(<DocCard element={mkDoc('## Summary\n\nA **bold** line.')} />);
    expect(screen.getByText('Findings')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    rerender(<DocCard element={mkDoc('')} />);
    expect(screen.getByText(/Empty doc/)).toBeInTheDocument();
  });

  test('collapse resizes to the title bar and remembers the height; expand restores it', () => {
    const el = mkDoc('text', { size: { width: 320, height: 300 } });
    const { rerender } = render(<DocCard element={el} />);
    fireEvent.click(screen.getByLabelText('Collapse doc'));
    const [, patch] = mockUpdateElement.mock.calls[0];
    expect(patch.size.height).toBe(40);
    expect(patch.data.doc).toMatchObject({ collapsed: true, restoreHeight: 300 });
    const collapsed = { ...el, ...patch };
    rerender(<DocCard element={collapsed} />);
    expect(screen.queryByText('text')).toBeNull();
    fireEvent.click(screen.getByLabelText('Expand doc'));
    const [, patch2] = mockUpdateElement.mock.calls[1];
    expect(patch2.size.height).toBe(300);
    expect(patch2.data.doc.collapsed).toBe(false);
    expect(patch2.data.doc.restoreHeight).toBeUndefined();
  });

  test('view-only access: no collapse control, the open button remains', () => {
    mockAccess = 'viewer';
    render(<DocCard element={mkDoc('x')} />);
    expect(screen.queryByLabelText('Collapse doc')).toBeNull();
    fireEvent.click(screen.getByLabelText('Open doc'));
    expect(getOpenDocId()).toBe('doc1');
  });
});

describe('DocPanel', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const open = (el = mkDoc('Hello')) => {
    mockElements = [NODE, el];
    return render(<DocPanel elementId={el.id} onClose={jest.fn()} />);
  };

  test('typing is flushed into the element after a pause, as one coalesced update', () => {
    open();
    const ta = screen.getByTestId('doc-textarea');
    fireEvent.change(ta, { target: { value: 'Hello world' } });
    fireEvent.change(ta, { target: { value: 'Hello world!' } });
    expect(mockUpdateElement).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(500); });
    expect(mockUpdateElement).toHaveBeenCalledTimes(1);
    const [id, patch, opts] = mockUpdateElement.mock.calls[0];
    expect(id).toBe('doc1');
    expect(patch.data.doc.markdown).toBe('Hello world!');
    expect(opts).toEqual({ coalesceKey: 'doc:doc1' });
  });

  test('title edits update the element label and the doc title', () => {
    open();
    fireEvent.change(screen.getByTestId('doc-title'), { target: { value: 'Summary' } });
    act(() => { jest.advanceTimersByTime(500); });
    const [, patch] = mockUpdateElement.mock.calls[0];
    expect(patch.label).toBe('Summary');
    expect(patch.data.doc.title).toBe('Summary');
  });

  test('closing flushes pending edits immediately', () => {
    const onClose = jest.fn();
    mockElements = [NODE, mkDoc('Hello')];
    render(<DocPanel elementId="doc1" onClose={onClose} />);
    fireEvent.change(screen.getByTestId('doc-textarea'), { target: { value: 'Draft' } });
    fireEvent.click(screen.getByTestId('doc-close'));
    expect(mockUpdateElement).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalled();
  });

  test('Link element inserts a #el= link at the cursor; Link selected inserts a list', () => {
    mockSelection = { nodeIds: ['n1'], connectionIds: [] };
    open();
    fireEvent.click(screen.getByTestId('doc-link-element'));
    fireEvent.click(screen.getByRole('option', { name: /Auth service/ }));
    expect(screen.getByTestId('doc-textarea').value).toContain('[Auth service](#el=n1)');
    fireEvent.click(screen.getByTestId('doc-link-selected'));
    expect(screen.getByTestId('doc-textarea').value).toContain('- [Auth service](#el=n1)');
  });

  test('toolbar formatting wraps the selection', () => {
    open(mkDoc('word'));
    const ta = screen.getByTestId('doc-textarea');
    ta.setSelectionRange(0, 4);
    fireEvent.click(screen.getByTitle('Bold'));
    expect(ta.value).toBe('**word**');
  });

  test('preview renders safely and hostile text stays inert', () => {
    open(mkDoc('<img src=x onerror=window.__pwned=1> [x](javascript:window.__pwned=1)'));
    fireEvent.click(screen.getByTestId('doc-tab-preview'));
    assertInert(screen.getByTestId('doc-preview'));
  });

  test('over the size cap the input is refused with a message', () => {
    open(mkDoc(''));
    fireEvent.change(screen.getByTestId('doc-textarea'), { target: { value: 'a'.repeat(MAX_DOC_BYTES + 1) } });
    expect(screen.getByTestId('doc-textarea').value).toBe('');
    expect(screen.getByTestId('doc-notice')).toHaveTextContent(/100 KB/);
  });

  test('a clean draft adopts a remote change; a dirty draft keeps the local text with a notice', () => {
    const el = mkDoc('Hello');
    mockElements = [NODE, el];
    const { rerender } = render(<DocPanel elementId="doc1" onClose={jest.fn()} />);
    const remote = { ...el, data: { doc: { ...el.data.doc, markdown: 'Remote text' } } };
    mockElements = [NODE, remote];
    rerender(<DocPanel elementId="doc1" onClose={jest.fn()} />);
    expect(screen.getByTestId('doc-textarea').value).toBe('Remote text');

    fireEvent.change(screen.getByTestId('doc-textarea'), { target: { value: 'Local edit' } });
    const remote2 = { ...el, data: { doc: { ...el.data.doc, markdown: 'Another remote' } } };
    mockElements = [NODE, remote2];
    rerender(<DocPanel elementId="doc1" onClose={jest.fn()} />);
    expect(screen.getByTestId('doc-textarea').value).toBe('Local edit');
    expect(screen.getByTestId('doc-notice')).toHaveTextContent(/also changed elsewhere/);
  });

  test('view-only access: preview and export only, no textarea or tools', () => {
    mockAccess = 'viewer';
    open(mkDoc('# Read me'));
    expect(screen.queryByTestId('doc-textarea')).toBeNull();
    expect(screen.queryByRole('toolbar')).toBeNull();
    expect(screen.getByTestId('doc-preview')).toHaveTextContent('Read me');
    expect(screen.getByTestId('doc-export-md')).toBeInTheDocument();
    expect(screen.getByTestId('doc-title')).toHaveAttribute('readonly');
  });

  test('export builds a .md file from the title and text', () => {
    const urls = [];
    global.URL.createObjectURL = jest.fn((blob) => { urls.push(blob); return 'blob:x'; });
    global.URL.revokeObjectURL = jest.fn();
    const click = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    open(mkDoc('Body text'));
    fireEvent.click(screen.getByTestId('doc-export-md'));
    expect(click).toHaveBeenCalled();
    expect(urls[0].type).toMatch(/text\/markdown/);
    click.mockRestore();
  });
});

describe('.md drop import (pure part)', () => {
  test('builds a doc element with title from the heading and sanitized text', () => {
    const r = docElementFromMarkdownFile('# Plan\n\n[x](javascript:alert(1)) <script>x</script>', 'plan.md', { x: 100.4, y: 50 }, 'el-1');
    expect(r.element.data.doc.title).toBe('Plan');
    expect(r.element.data.doc.markdown).not.toMatch(/\]\(javascript:/);
    expect(r.element).toMatchObject({ id: 'el-1', type: 'doc', x: 100, y: 50 });
    expect(r.cleaned.links).toBe(1);
  });

  test('a file over the cap is refused', () => {
    const r = docElementFromMarkdownFile('a'.repeat(MAX_DOC_BYTES + 1), 'big.md', { x: 0, y: 0 }, 'el-1');
    expect(r.error).toMatch(/100 KB/);
    expect(r.element).toBeUndefined();
  });
});

describe('DocPanelHost', () => {
  test('Enter on a selected doc card opens the editor in the side panel (lazy-loaded); Enter in a text field does not', async () => {
    mockElements = [NODE, mkDoc('Hello')];
    mockSelection = { nodeIds: ['doc1'], connectionIds: [] };
    render(<DocPanelHost />);
    expect(screen.queryByTestId('doc-panel-wrapper')).toBeNull();
    const input = document.createElement('input');
    document.body.appendChild(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(getOpenDocId()).toBeNull();
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(await screen.findByTestId('doc-panel')).toBeInTheDocument();
    expect(getOpenDocId()).toBe('doc1');
    input.remove();
  });

  test('Enter does nothing for a non-doc selection, and a deleted doc closes the panel', async () => {
    mockElements = [NODE, mkDoc('Hello')];
    mockSelection = { nodeIds: ['n1'], connectionIds: [] };
    const { rerender } = render(<DocPanelHost />);
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(getOpenDocId()).toBeNull();
    act(() => openDoc('doc1'));
    expect(await screen.findByTestId('doc-panel')).toBeInTheDocument();
    mockElements = [NODE];
    rerender(<DocPanelHost />);
    expect(getOpenDocId()).toBeNull();
  });
});

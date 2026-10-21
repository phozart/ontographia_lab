// Slice 8: compare versions - History panel summary + canvas overlay (read-only, dismissible).
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import VersionHistoryPanel from '../../../components/diagram-studio/ui/VersionHistoryPanel';
import CompareOverlay from '../../../components/diagram-studio/ui/CompareOverlay';
import { getCompare, setCompare, onReveal } from '../../../components/diagram-studio/versions/compareStore';

const click = (el) => act(async () => { fireEvent.click(el); });

const meta = (n, extra = {}) => ({
  id: `v${n}`, number: n, kind: 'named', label: `Rev ${n}`, description: null, createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: { id: 'u1', name: 'Alice' }, createdVia: 'web', sizeBytes: 100, elementCount: 3, connectionCount: 1, restoredFrom: null, ...extra,
});
const content = { elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 50 }, label: 'A' }], connections: [] };
const DIFF = {
  from: { id: 'v2', number: 2 }, to: 'head',
  changes: [
    { id: 'n1', kind: 'element', change: 'added', label: 'New box', bounds: { x: 10, y: 20, width: 100, height: 60 } },
    { id: 'm1', kind: 'element', change: 'changed', label: 'Moved', fields: ['position', 'style'], bounds: { x: 300, y: 20, width: 100, height: 60 } },
    { id: 'r1', kind: 'element', change: 'removed', label: 'Gone', bounds: { x: 500, y: 200, width: 80, height: 40 } },
    { id: 'c1', kind: 'connection', change: 'added', label: '' },
    { id: 'l1', kind: 'layer', change: 'changed', label: 'Layer', fields: ['visible'] },
  ],
  summary: { added: 2, removed: 1, changed: 2 },
};

function mockApi({ diff = DIFF, diffStatus = 200 } = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    if (/\/diff\?/.test(url)) return { ok: diffStatus === 200, status: diffStatus, json: async () => (diffStatus === 200 ? diff : { error: 'Version not found', code: 'NOT_FOUND' }) };
    if (/\/versions(\?|$)/.test(url)) return { ok: true, status: 200, json: async () => ({ items: [meta(3), meta(2), meta(1)], nextCursor: null }) };
    return { ok: true, status: 200, json: async () => ({ ...meta(Number(String(url).split('/').pop())), content }) };
  });
  return calls;
}

const renderPanel = (props = {}) => render(
  <VersionHistoryPanel open diagramId="d1" canWrite onClose={() => {}} onRestore={jest.fn()} {...props} />
);
const openVersion = async (title) => {
  await click(await screen.findByRole('button', { name: new RegExp(title) }));
  return screen.findByRole('button', { name: /compare with current/i });
};

afterEach(() => { act(() => setCompare(null)); jest.restoreAllMocks(); });

describe('History panel: compare', () => {
  test('"Compare with current" fetches the diff against head and shows counts and grouped items', async () => {
    const calls = mockApi();
    renderPanel();
    await click(await openVersion('Rev 2'));
    const summary = await screen.findByRole('region', { name: /changes/i });
    expect(calls.some((c) => /\/versions\/2\/diff\?against=head/.test(c.url))).toBe(true);
    expect(within(summary).getByText(/2 added/i)).toBeTruthy();
    expect(within(summary).getByText(/2 changed/i)).toBeTruthy();
    expect(within(summary).getByText(/1 removed/i)).toBeTruthy();
    expect(within(summary).getByText('New box')).toBeTruthy();
    expect(within(summary).getByText(/position, style/)).toBeTruthy();
  });

  test('works for read-only roles (no write controls needed) and never POSTs/PUTs/PATCHes', async () => {
    const calls = mockApi();
    renderPanel({ canWrite: false });
    await click(await openVersion('Rev 2'));
    await screen.findByRole('region', { name: /changes/i });
    expect(calls.filter((c) => (c.init.method || 'GET') !== 'GET')).toEqual([]);
  });

  test('publishes the diff to the canvas overlay store; Hide overlay dismisses it', async () => {
    mockApi();
    renderPanel();
    await click(await openVersion('Rev 2'));
    await screen.findByRole('region', { name: /changes/i });
    await waitFor(() => expect(getCompare()?.changes).toHaveLength(5));
    expect(getCompare().from.number).toBe(2);
    await click(screen.getByRole('button', { name: /hide overlay/i }));
    expect(getCompare()).toBeNull();
    await click(screen.getByRole('button', { name: /show on canvas/i }));
    expect(getCompare()?.changes).toHaveLength(5);
  });

  test('clicking an item asks the canvas to reveal it (changed/added/removed alike)', async () => {
    mockApi();
    const seen = [];
    const off = onReveal((c) => seen.push(c.id));
    renderPanel();
    await click(await openVersion('Rev 2'));
    const summary = await screen.findByRole('region', { name: /changes/i });
    await click(within(summary).getByRole('button', { name: /Moved/ }));
    await click(within(summary).getByRole('button', { name: /Gone/ }));
    off();
    expect(seen).toEqual(['m1', 'r1']);
  });

  test('compare with another version: summary only, no canvas overlay', async () => {
    const calls = mockApi({ diff: { ...DIFF, to: { id: 'v3', number: 3 } } });
    renderPanel();
    await openVersion('Rev 2');
    await act(async () => { fireEvent.change(screen.getByLabelText(/compare with another version/i), { target: { value: '3' } }); });
    await screen.findByRole('region', { name: /changes/i });
    expect(calls.some((c) => /\/versions\/2\/diff\?against=3/.test(c.url))).toBe(true);
    expect(getCompare()).toBeNull();
    expect(screen.queryByRole('button', { name: /hide overlay|show on canvas/i })).toBeNull();
  });

  test('identical content says so; API failure shows an alert', async () => {
    mockApi({ diff: { ...DIFF, changes: [], summary: { added: 0, removed: 0, changed: 0 } } });
    const { unmount } = renderPanel();
    await click(await openVersion('Rev 2'));
    expect(await screen.findByText(/no differences/i)).toBeTruthy();
    unmount();
    mockApi({ diffStatus: 404 });
    renderPanel();
    await click(await openVersion('Rev 2'));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not found/i);
  });
});

describe('CompareOverlay', () => {
  const viewport = { x: 100, y: 50, scale: 2 };
  const compare = { from: { number: 2, title: 'Rev 2' }, to: 'head', changes: DIFF.changes, summary: DIFF.summary };
  const elements = [
    { id: 'n1', x: 11, y: 21, size: { width: 110, height: 60 } },
    { id: 'm1', x: 300, y: 20, size: { width: 100, height: 60 } },
  ];

  test('draws added green / changed amber at the live element position, removed as a ghost at the old position', () => {
    render(<CompareOverlay compare={compare} elements={elements} connections={[]} viewport={viewport} onDismiss={() => {}} />);
    const added = document.querySelector('[data-compare-id="n1"]');
    expect(added.getAttribute('data-compare-change')).toBe('added');
    // screen = (canvas + viewport) * scale, using the live (edited) position
    expect(added.style.left).toBe('222px');
    expect(added.style.top).toBe('142px');
    expect(added.style.width).toBe('220px');
    expect(document.querySelector('[data-compare-id="m1"]').getAttribute('data-compare-change')).toBe('changed');
    const ghost = document.querySelector('[data-compare-id="r1"]');
    expect(ghost.getAttribute('data-compare-change')).toBe('removed');
    expect(ghost.style.left).toBe('1200px'); // (500 + 100) * 2, from the diff bounds
  });

  test('is read-only: the layers do not intercept pointer events; only the legend is interactive', () => {
    render(<CompareOverlay compare={compare} elements={elements} connections={[]} viewport={viewport} onDismiss={() => {}} />);
    expect(document.querySelector('[data-compare-overlay]').style.pointerEvents).toBe('none');
    expect(screen.getByRole('status')).toHaveTextContent(/Rev 2/);
    expect(screen.getByRole('status')).toHaveTextContent(/2 added/);
  });

  test('Dismiss calls onDismiss; renders nothing without a compare', () => {
    const onDismiss = jest.fn();
    const { rerender } = render(<CompareOverlay compare={compare} elements={elements} connections={[]} viewport={viewport} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalled();
    rerender(<CompareOverlay compare={null} elements={elements} connections={[]} viewport={viewport} onDismiss={onDismiss} />);
    expect(document.querySelector('[data-compare-overlay]')).toBeNull();
  });

  test('added/changed connections are drawn between their live endpoints', () => {
    const c = { ...compare, changes: [{ id: 'c1', kind: 'connection', change: 'added', label: '' }] };
    render(<CompareOverlay compare={c} elements={elements} connections={[{ id: 'c1', sourceId: 'n1', targetId: 'm1' }]} viewport={viewport} onDismiss={() => {}} />);
    expect(document.querySelector('[data-compare-id="c1"]')).toBeTruthy();
  });
});

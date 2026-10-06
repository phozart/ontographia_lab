// Slice 2: History panel (list / name current version / preview / restore with confirm) and the static preview.
import { render, screen, waitFor, within, act, fireEvent } from '@testing-library/react';
import VersionHistoryPanel, { VersionHistory, OPEN_VERSION_HISTORY_EVENT } from '../../../components/diagram-studio/ui/VersionHistoryPanel';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { buildVersionPreview, versionTitle, formatKind } from '../../../components/diagram-studio/versions/versionUtils';

const click = (el) => act(async () => { fireEvent.click(el); });
const type = (el, value) => act(async () => { fireEvent.change(el, { target: { value } }); });

const meta = (n, extra = {}) => ({
  id: `v${n}`, number: n, kind: 'named', label: `Rev ${n}`, description: null, createdAt: '2026-10-01T10:00:00.000Z',
  createdBy: { id: 'u1', name: 'Alice' }, createdVia: 'web', sizeBytes: 100, elementCount: 3, connectionCount: 1, restoredFrom: null, ...extra,
});
const content = { elements: [{ id: 'a', type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 50 }, label: 'Hello <b>' }], connections: [] };

function mockApi({ items = [meta(3), meta(2, { kind: 'auto', label: null }), meta(1)], nextCursor = null, getContent = content, post } = {}) {
  const calls = [];
  global.fetch = jest.fn(async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const method = init.method || 'GET';
    if (method === 'GET' && /\/versions(\?|$)/.test(url)) return { ok: true, status: 200, json: async () => ({ items, nextCursor }) };
    if (method === 'GET') return { ok: true, status: 200, json: async () => ({ ...meta(Number(String(url).split('/').pop())), content: getContent }) };
    if (method === 'POST') return post ? post(url, init) : { ok: true, status: 201, json: async () => meta(4) };
    if (method === 'PATCH') return { ok: true, status: 200, json: async () => ({ ...meta(1), label: JSON.parse(init.body).label }) };
    return { ok: false, status: 500, json: async () => ({}) };
  });
  return calls;
}

const renderPanel = (props = {}) => render(
  <VersionHistoryPanel open diagramId="d1" canWrite onClose={() => {}} onRestore={jest.fn(async () => ({ ok: true, preRestoreVersion: { number: 5 } }))} {...props} />
);

describe('versionUtils', () => {
  test('titles: label wins; else kind-specific fallback', () => {
    expect(versionTitle(meta(1))).toBe('Rev 1');
    expect(versionTitle(meta(2, { kind: 'auto', label: null }))).toBe('Autosave');
    expect(versionTitle(meta(3, { kind: 'pre_restore', label: null }))).toBe('Before restore');
    expect(versionTitle(meta(4, { kind: 'restore', label: null, restoredFrom: { id: 'v1', number: 1 } }))).toBe('Restored from #1');
    expect(formatKind('pre_restore')).toBe('Before restore');
  });
  test('buildVersionPreview returns a static SVG data URL; hostile labels are escaped, never executable markup', () => {
    const p = buildVersionPreview(content);
    expect(p.url).toMatch(/^data:image\/svg\+xml/);
    const svg = decodeURIComponent(p.url.split(',')[1]);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('<b>');
  });
  test('empty or junk content gives a preview or null, never throws', () => {
    expect(() => buildVersionPreview({})).not.toThrow();
    expect(() => buildVersionPreview(null)).not.toThrow();
    expect(() => buildVersionPreview({ elements: [{}, null, { x: 'NaN' }] })).not.toThrow();
  });
});

describe('VersionHistoryPanel', () => {
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  test('renders nothing when closed', () => {
    mockApi();
    render(<VersionHistoryPanel open={false} diagramId="d1" onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('lists versions newest first with name, author, time and kind', async () => {
    mockApi();
    renderPanel();
    const list = await screen.findByRole('list', { name: /versions/i });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Rev 3');
    expect(items[0]).toHaveTextContent('Alice');
    expect(items[0]).toHaveTextContent(/named/i);
    expect(items[1]).toHaveTextContent('Autosave');
    expect(items[0].querySelector('time')).toBeTruthy();
  });

  test('empty state explains what a version is', async () => {
    mockApi({ items: [] });
    renderPanel();
    expect(await screen.findByText(/no versions yet/i)).toBeInTheDocument();
  });

  test('load error shows an alert with retry', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500, json: async () => ({ error: 'boom' }) }));
    renderPanel();
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  test('"Load more" follows nextCursor and appends', async () => {
    const calls = mockApi({ items: [meta(2)], nextCursor: 'CUR' });
    renderPanel();
    await screen.findByText('Rev 2');
    global.fetch.mockImplementationOnce(async (url) => { calls.push({ url: String(url), init: {} }); return { ok: true, status: 200, json: async () => ({ items: [meta(1)], nextCursor: null }) }; });
    await click(screen.getByRole('button', { name: /load more/i }));
    await screen.findByText('Rev 1');
    expect(calls.some((c) => c.url.includes('cursor=CUR'))).toBe(true);
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
  });

  test('"Name current version" POSTs label + description then refreshes the list', async () => {
    const calls = mockApi();
    renderPanel();
    await screen.findByText('Rev 3');
    await type(screen.getByLabelText(/version name/i), 'Before the big refactor');
    await type(screen.getByLabelText(/description/i), 'baseline');
    await click(screen.getByRole('button', { name: /^save version$/i }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.init.method === 'POST');
    expect(post.url).toBe('/api/diagrams/d1/versions');
    expect(JSON.parse(post.init.body)).toEqual({ kind: 'named', label: 'Before the big refactor', description: 'baseline' });
    await waitFor(() => expect(calls.filter((c) => !c.init.method && /versions(\?|$)/.test(c.url)).length).toBeGreaterThanOrEqual(2));
  });

  test('naming needs a non-empty label; button disabled until typed', async () => {
    mockApi();
    renderPanel();
    await screen.findByText('Rev 3');
    expect(screen.getByRole('button', { name: /^save version$/i })).toBeDisabled();
  });

  test('deduplicated naming tells the user the current state was already saved', async () => {
    mockApi({ post: () => ({ ok: true, status: 200, json: async () => ({ deduplicated: true, version: meta(3) }) }) });
    renderPanel();
    await screen.findByText('Rev 3');
    await type(screen.getByLabelText(/version name/i), 'X');
    await click(screen.getByRole('button', { name: /^save version$/i }));
    expect(await screen.findByText(/already saved as version #3/i)).toBeInTheDocument();
  });

  test('read-only role: list and preview, but no naming form and no restore', async () => {
    mockApi();
    renderPanel({ canWrite: false });
    await screen.findByText('Rev 3');
    expect(screen.queryByLabelText(/version name/i)).toBeNull();
    await click(screen.getByText('Rev 3'));
    await screen.findByAltText(/preview of/i);
    expect(screen.queryByRole('button', { name: /restore this version/i })).toBeNull();
  });

  test('selecting a version loads its content and shows a static preview image', async () => {
    const calls = mockApi();
    renderPanel();
    await click(await screen.findByText('Rev 3'));
    const img = await screen.findByAltText(/preview of rev 3/i);
    expect(img.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(calls.some((c) => c.url === '/api/diagrams/d1/versions/3')).toBe(true);
  });

  test('restore asks for confirmation first; cancel does nothing', async () => {
    mockApi();
    const onRestore = jest.fn(async () => ({ ok: true }));
    renderPanel({ onRestore });
    await click(await screen.findByText('Rev 3'));
    await click(await screen.findByRole('button', { name: /restore this version/i }));
    const dlg = await screen.findByRole('dialog', { name: /restore/i });
    expect(dlg).toHaveTextContent(/nothing is deleted|kept as a version/i);
    await click(within(dlg).getByRole('button', { name: /cancel/i }));
    expect(onRestore).not.toHaveBeenCalled();
  });

  test('confirming restore calls onRestore(number) and reports the saved pre-restore version', async () => {
    const calls = mockApi();
    const onRestore = jest.fn(async () => ({ ok: true, preRestoreVersion: { number: 5 }, version: { number: 6 } }));
    renderPanel({ onRestore });
    await click(await screen.findByText('Rev 3'));
    await click(await screen.findByRole('button', { name: /restore this version/i }));
    const dlg = await screen.findByRole('dialog', { name: /restore/i });
    await click(within(dlg).getByRole('button', { name: /^restore$/i }));
    await waitFor(() => expect(onRestore).toHaveBeenCalledWith(3));
    expect(await screen.findByText(/restored.*version #5/i)).toBeInTheDocument();
    await waitFor(() => expect(calls.filter((c) => !c.init.method && /versions(\?|$)/.test(c.url)).length).toBeGreaterThanOrEqual(2));
  });

  test('failed restore shows the error inside the dialog and keeps it open', async () => {
    mockApi();
    const onRestore = jest.fn(async () => ({ ok: false, error: 'Access denied' }));
    renderPanel({ onRestore });
    await click(await screen.findByText('Rev 3'));
    await click(await screen.findByRole('button', { name: /restore this version/i }));
    const dlg = await screen.findByRole('dialog', { name: /restore/i });
    await click(within(dlg).getByRole('button', { name: /^restore$/i }));
    expect(await within(dlg).findByText('Access denied')).toBeInTheDocument();
  });

  test('rename: PATCHes the label and updates the list', async () => {
    const calls = mockApi();
    renderPanel();
    await click(await screen.findByText('Rev 1'));
    await click(await screen.findByRole('button', { name: /rename/i }));
    const input = screen.getByLabelText(/new name/i);
    await type(input, 'Baseline');
    await click(screen.getByRole('button', { name: /^save name$/i }));
    await waitFor(() => expect(calls.some((c) => c.init.method === 'PATCH')).toBe(true));
    const patch = calls.find((c) => c.init.method === 'PATCH');
    expect(patch.url).toBe('/api/diagrams/d1/versions/1');
    expect(JSON.parse(patch.init.body)).toEqual({ label: 'Baseline' });
  });

  test('Escape / close button calls onClose', async () => {
    mockApi();
    const onClose = jest.fn();
    renderPanel({ onClose });
    await screen.findByText('Rev 3');
    await click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('VersionHistory (editor wiring)', () => {
  const diagram = (caps) => ({
    id: 'd1', name: 'Mine', type: 'infinite-canvas', revision: 5,
    content: { elements: [], connections: [], layers: [], groups: [] },
    ...(caps ? { access: { role: 'x', capabilities: caps } } : {}),
  });
  function Harness({ d }) {
    const { setDiagram } = useDiagram();
    return <button onClick={() => setDiagram(d)}>load</button>;
  }
  const mount = (d) => render(<DiagramProvider><Harness d={d} /><VersionHistory /></DiagramProvider>);
  beforeEach(() => { jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  async function open(d) {
    mockApi();
    const calls = global.fetch;
    mount(d);
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    await click(screen.getByText('load'));
    await act(async () => { window.dispatchEvent(new CustomEvent(OPEN_VERSION_HISTORY_EVENT)); });
    return calls;
  }

  test('the menu event opens the panel for the open diagram', async () => {
    await open(diagram(['version.read', 'version.create', 'version.restore']));
    expect(await screen.findByRole('complementary', { name: /version history/i })).toBeInTheDocument();
    expect(await screen.findByText('Rev 3')).toBeInTheDocument();
    expect(screen.getByLabelText(/version name/i)).toBeInTheDocument();
  });

  test('a viewer (no version.create) gets the read-only panel', async () => {
    await open(diagram(['version.read']));
    await screen.findByText('Rev 3');
    expect(screen.queryByLabelText(/version name/i)).toBeNull();
  });
});

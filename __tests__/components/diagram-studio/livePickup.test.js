// AI-2 live pickup: the editor polls the revision probe, merges a newer head by id (three-way), and the next save
// uses the new revision. Mocked fetch plays the server (CAS on If-Match). The 409 dialog is only the fallback.
import { renderHook, act, screen } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { getCompare, setCompare } from '../../../components/diagram-studio/versions/compareStore';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, label: id, ...extra });
const wrapper = ({ children }) => <DiagramProvider diagramId="d1" defaultPack="process-flow">{children}</DiagramProvider>;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let server; let calls;
const body = () => ({
  id: 'd1', name: 'X', type: 'infinite-canvas', revision: server.revision, updated_at: 't', updated_by: server.updatedBy,
  access: { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] }, content: server.content,
});
const writeAs = (content, { agent = false, by = 'bob', previous = 4 } = {}) => {
  server.revision += 1; server.content = content; server.updatedBy = by;
  server.agentChange = agent ? { versionNumber: 5, previousVersionNumber: previous, label: 'agent: edit' } : null;
};
const puts = () => calls.filter((c) => c.method === 'PUT');

beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  server = { revision: 3, updatedBy: 'alice@x.co', agentChange: null, content: { elements: [el('a'), el('b')], connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 } } };
  global.fetch = jest.fn(async (url, opts = {}) => {
    const method = opts.method || 'GET';
    calls.push({ method, url, opts });
    if (method === 'PUT') {
      const m = /"(\d+)"/.exec(opts.headers['If-Match'] || '');
      if (m && Number(m[1]) !== server.revision) return res(409, { code: 'REVISION_CONFLICT', current: { revision: server.revision } });
      server.revision += 1; server.content = JSON.parse(opts.body).content; server.updatedBy = 'me@x.co';
      return res(200, body());
    }
    if (/\/revision\?since=/.test(url)) return res(200, { revision: server.revision, updatedAt: 't', updatedBy: server.updatedBy.split('@')[0], agentChange: server.agentChange });
    if (/\/diff\?/.test(url)) return res(200, { changes: [{ id: 'n', kind: 'element', change: 'added', label: 'n' }], summary: { added: 1, removed: 0, changed: 0 } });
    if (server.failHead) return res(500, {});
    return res(200, body());
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); setCompare(null); });

async function open() {
  const hook = renderHook(() => useDiagram(), { wrapper });
  await act(async () => { await Promise.resolve(); });
  act(() => { hook.result.current.setDiagram(body()); });
  return hook;
}
const tick = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const settle = async (ms = 3100) => { await tick(ms); await tick(0); await tick(0); };
// Edit at t = 2.2 s so the 3 s poll runs before the 1 s autosave debounce would.
const editThenRemote = async (hook, edit, remote) => {
  await tick(2200);
  act(() => { edit(hook.result.current); });
  remote();
  await tick(900); await tick(0); await tick(0);
};
const ids = (hook) => hook.result.current.elements.map((e) => e.id);

test('clean editor picks up an agent change within the poll interval: no PUT, no dialog, notice shown', async () => {
  const hook = await open();
  writeAs({ ...server.content, elements: [el('a'), el('b'), el('n', { label: 'from agent' })] }, { agent: true });
  await settle();
  expect(ids(hook)).toEqual(['a', 'b', 'n']);
  expect(hook.result.current.diagram.revision).toBe(4);
  expect(hook.result.current.saveStatus?.dirty).not.toBe(true);
  expect(puts()).toHaveLength(0);
  expect(screen.queryByText(/changed elsewhere/)).toBeNull();
  expect(screen.getByTestId('remote-update-notice').textContent).toMatch(/Updated by an agent/);
  expect(screen.getByTestId('remote-update-notice').textContent).toMatch(/1 added/);
  for (let i = 0; i < 4; i += 1) await tick(5000); // nothing further happens on its own
  expect(puts()).toHaveLength(0);
});

test('dirty editor: local move + remote add both survive, and the next save carries the new revision (no dialog)', async () => {
  const hook = await open();
  await editThenRemote(hook, (c) => c.updateElement('a', { x: 200 }), () => writeAs({ ...server.content, elements: [el('a'), el('b'), el('n')] }, { by: 'bob@x.co' }));
  expect(ids(hook)).toEqual(['a', 'b', 'n']);
  expect(hook.result.current.elements.find((e) => e.id === 'a').x).toBe(200);
  expect(puts()).toHaveLength(0); // merged by the poller, nothing sent yet
  await tick(1100); await tick(0);
  expect(puts()).toHaveLength(1);
  expect(puts()[0].opts.headers['If-Match']).toBe('"4"');
  expect(JSON.parse(puts()[0].opts.body).content.elements.map((e) => e.id)).toEqual(['a', 'b', 'n']);
  expect(server.revision).toBe(5);
  expect(screen.queryByText(/changed elsewhere/)).toBeNull();
  expect(screen.getByTestId('remote-update-notice').textContent).toMatch(/Updated by bob/);
});

test('same-field conflict: local wins and the notice says so', async () => {
  const hook = await open();
  await editThenRemote(hook, (c) => c.updateElement('a', { label: 'mine' }), () => writeAs({ ...server.content, elements: [el('a', { label: 'theirs' }), el('b')] }));
  expect(hook.result.current.elements.find((e) => e.id === 'a').label).toBe('mine');
  expect(screen.getByTestId('remote-update-conflicts').textContent).toMatch(/your edits were kept on 1 item/i);
});

test('remote change identical to the local edit leaves the editor clean (no pointless save)', async () => {
  const hook = await open();
  await editThenRemote(hook, (c) => c.updateElement('a', { label: 'same' }), () => writeAs({ ...server.content, elements: [el('a', { label: 'same', updatedAt: hook.result.current.elements.find((e) => e.id === 'a').updatedAt }), el('b')] }));
  for (let i = 0; i < 2; i += 1) await tick(5000);
  expect(puts()).toHaveLength(0);
});

test('a save that races the poller gets 409, merges, and retries without the dialog', async () => {
  const hook = await open();
  act(() => { hook.result.current.updateElement('b', { y: 90 }); });
  // the write lands after the user's edit but before the 3 s poll; the 1 s autosave hits it first
  writeAs({ ...server.content, elements: [el('a'), el('b'), el('n')] }, { agent: true });
  await tick(1100); await tick(0); await tick(0);
  await tick(1100); await tick(0); await tick(0);
  expect(puts().map((p) => p.opts.headers['If-Match'])).toEqual(['"3"', '"4"']);
  expect(ids(hook)).toEqual(['a', 'b', 'n']);
  expect(server.content.elements.map((e) => e.id)).toEqual(['a', 'b', 'n']);
  expect(server.content.elements.find((e) => e.id === 'b').y).toBe(90);
  expect(screen.queryByText(/changed elsewhere/)).toBeNull();
});

test('when the newer head cannot be fetched/merged the 409 dialog is the fallback', async () => {
  const hook = await open();
  act(() => { hook.result.current.updateElement('a', { x: 5 }); });
  server.revision += 1; server.failHead = true;
  await tick(1100); await tick(0); await tick(0);
  expect(screen.getByText(/changed elsewhere/)).toBeTruthy();
  expect(ids(hook)).toEqual(['a', 'b']);
});

test('undo after a merge undoes only the local edit and keeps the agent elements', async () => {
  const hook = await open();
  await editThenRemote(hook, (c) => c.updateElement('a', { x: 200 }), () => writeAs({ ...server.content, elements: [el('a'), el('b'), el('n')] }));
  expect(hook.result.current.canUndo).toBe(true);
  act(() => { hook.result.current.undo(); });
  expect(ids(hook)).toEqual(['a', 'b', 'n']);
  expect(hook.result.current.elements.find((e) => e.id === 'a').x).toBe(0);
  act(() => { hook.result.current.redo(); });
  expect(ids(hook)).toEqual(['a', 'b', 'n']);
  expect(hook.result.current.elements.find((e) => e.id === 'a').x).toBe(200);
});

test('an agent deletion survives undo of a local edit (no resurrection)', async () => {
  const hook = await open();
  await editThenRemote(hook, (c) => c.updateElement('a', { x: 200 }), () => writeAs({ ...server.content, elements: [el('a')] })); // agent removed untouched b
  expect(ids(hook)).toEqual(['a']);
  act(() => { hook.result.current.undo(); });
  expect(ids(hook)).toEqual(['a']);
});

test('polling is cheap: only revision probes while nothing changed, and every 30 s when the tab is hidden', async () => {
  await open();
  for (let i = 0; i < 3; i += 1) await tick(3000);
  const probes = () => calls.filter((c) => /\/revision\?since=3$/.test(c.url)).length;
  expect(probes()).toBe(3);
  expect(calls.filter((c) => c.url === '/api/diagrams/d1' && c.method === 'GET').length).toBeLessThanOrEqual(1); // none from polling
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  await tick(3000); // the pending visible-interval timer fires once, then it backs off
  const before = probes();
  for (let i = 0; i < 4; i += 1) await tick(5000);
  expect(probes()).toBe(before);
  for (let i = 0; i < 3; i += 1) await tick(5000);
  expect(probes()).toBe(before + 1);
  Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
});

test('"Review agent change" opens the compare overlay from the pre-agent version; absent for person edits', async () => {
  const hook = await open();
  writeAs({ ...server.content, elements: [el('a'), el('b'), el('n')] }, { agent: true, previous: 4 });
  await settle();
  const btn = screen.getByRole('button', { name: 'Review agent change' });
  await act(async () => { btn.click(); await Promise.resolve(); await Promise.resolve(); });
  expect(calls.some((c) => /\/versions\/4\/diff\?against=head/.test(c.url))).toBe(true);
  expect(getCompare()).toMatchObject({ from: { number: 4 }, to: 'head', summary: { added: 1 } });
  expect(hook.result.current.elements).toHaveLength(3);
  setCompare(null);
  writeAs({ ...server.content, elements: [el('a'), el('b'), el('n'), el('m')] }, { agent: false });
  await settle();
  expect(screen.queryByRole('button', { name: 'Review agent change' })).toBeNull();
});

test('viewport and selection are kept; selection of a removed element is dropped', async () => {
  const hook = await open();
  act(() => { hook.result.current.setViewport({ x: 123, y: 456, scale: 2 }); hook.result.current.setSelection({ nodeIds: ['a', 'b'], connectionIds: [] }); });
  writeAs({ ...server.content, elements: [el('a')] });
  await settle();
  expect(hook.result.current.viewport).toEqual({ x: 123, y: 456, scale: 2 });
  expect(hook.result.current.selection.nodeIds).toEqual(['a']);
});

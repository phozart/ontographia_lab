// LA-1: a live pickup sets `remoteHighlight` (ids from mergeContent, color by who wrote). No extra versions or
// revisions: the pickup still writes nothing to the server.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, label: id, ...extra });
const wrapper = ({ children }) => <DiagramProvider diagramId="d1" defaultPack="process-flow">{children}</DiagramProvider>;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let server; let calls;
const body = () => ({
  id: 'd1', name: 'X', type: 'infinite-canvas', revision: server.revision, updated_at: 't', updated_by: server.updatedBy,
  access: { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] }, content: server.content,
});
const writeAs = (content, { agent = false, by = 'bob' } = {}) => {
  server.revision += 1; server.content = content; server.updatedBy = by;
  server.agentChange = agent ? { versionNumber: 5, previousVersionNumber: 4, label: 'agent: edit' } : null;
};

beforeEach(() => {
  jest.useFakeTimers();
  calls = [];
  server = { revision: 3, updatedBy: 'alice@x.co', agentChange: null, content: { elements: [el('a'), el('b')], connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 } } };
  global.fetch = jest.fn(async (url, opts = {}) => {
    calls.push({ method: opts.method || 'GET', url });
    if (/\/revision\?since=/.test(url)) return res(200, { revision: server.revision, updatedAt: 't', updatedBy: server.updatedBy.split('@')[0], agentChange: server.agentChange });
    return res(200, body());
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const tick = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const settle = async () => { await tick(3100); await tick(0); await tick(0); };
async function open() {
  const hook = renderHook(() => useDiagram(), { wrapper });
  await act(async () => { await Promise.resolve(); });
  act(() => { hook.result.current.setDiagram(body()); });
  return hook;
}

test('an agent adds 3 and moves 2: exactly those 5 are highlighted, in lavender', async () => {
  const hook = await open();
  expect(hook.result.current.remoteHighlight).toBeNull();
  writeAs({
    ...server.content,
    elements: [el('a', { x: 90 }), el('b', { y: 70 }), el('n1', { x: 300 }), el('n2', { x: 400 }), el('n3', { x: 500 })],
  }, { agent: true });
  await settle();
  const h = hook.result.current.remoteHighlight;
  expect(h).toBeTruthy();
  expect(h.items.map((i) => i.id).sort()).toEqual(['a', 'b', 'n1', 'n2', 'n3']);
  expect(h.agent).toBe(true);
  expect(h.color.toLowerCase()).toBe('#9a8ac8');
  expect(calls.filter((c) => c.method === 'PUT')).toHaveLength(0); // no extra versions or revisions
});

test('a human change rings in cyan', async () => {
  const hook = await open();
  writeAs({ ...server.content, elements: [el('a', { x: 40 }), el('b')] }, { by: 'bob@x.co' });
  await settle();
  const h = hook.result.current.remoteHighlight;
  expect(h.items.map((i) => i.id)).toEqual(['a']);
  expect(h.agent).toBe(false);
  expect(h.color.toLowerCase()).toBe('#4fb3ce');
  expect(h.who).toBe('bob');
});

test('a removed element becomes a ghost at its old position', async () => {
  const hook = await open();
  writeAs({ ...server.content, elements: [el('a')] }, { by: 'bob@x.co' });
  await settle();
  const h = hook.result.current.remoteHighlight;
  expect(h.items).toEqual([expect.objectContaining({ id: 'b', kind: 'ghost' })]);
});

test('600 changed elements become one ring around the union bbox', async () => {
  const hook = await open();
  const many = Array.from({ length: 600 }, (_, i) => el(`n${i}`, { x: i * 5, y: i * 3 }));
  writeAs({ ...server.content, elements: [el('a'), el('b'), ...many] }, { agent: true });
  await settle();
  const h = hook.result.current.remoteHighlight;
  expect(h.collapsed).toBe(true);
  expect(h.items).toHaveLength(1);
});

test('clearRemoteHighlight empties it; a pickup that changed nothing visible leaves it unset', async () => {
  const hook = await open();
  writeAs({ ...server.content, elements: [el('a'), el('b')], layers: [{ id: 'default', name: 'Renamed' }] }, { by: 'bob@x.co' });
  await settle();
  expect(hook.result.current.remoteHighlight).toBeNull();
  writeAs({ ...server.content, elements: [el('a', { x: 5 }), el('b')] }, { by: 'bob@x.co' });
  await settle();
  expect(hook.result.current.remoteHighlight).toBeTruthy();
  act(() => { hook.result.current.clearRemoteHighlight(); });
  expect(hook.result.current.remoteHighlight).toBeNull();
});

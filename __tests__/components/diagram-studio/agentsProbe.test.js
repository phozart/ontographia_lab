// LA-2: the poll hands the probe's agents[] to the context; rendering them is AgentIndicator's job.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const el = (id) => ({ id, type: 'rectangle', x: 0, y: 0, size: { width: 100, height: 60 }, label: id });
const wrapper = ({ children }) => <DiagramProvider diagramId="d1" defaultPack="process-flow">{children}</DiagramProvider>;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let revision; let agents; let probes;
const content = { elements: [el('a')], connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 } };
const body = () => ({ id: 'd1', name: 'X', type: 'infinite-canvas', revision, updated_at: 't', updated_by: 'a@x.co', access: { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] }, content });

beforeEach(() => {
  jest.useFakeTimers();
  revision = 3; agents = []; probes = 0;
  global.fetch = jest.fn(async (url) => {
    if (/\/revision\?since=/.test(url)) { probes += 1; return res(200, { revision, updatedAt: 't', updatedBy: null, agentChange: null, agents }); }
    return res(200, body());
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

const tick = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
async function open() {
  const hook = renderHook(() => useDiagram(), { wrapper });
  await act(async () => { await Promise.resolve(); });
  act(() => { hook.result.current.setDiagram(body()); });
  return hook;
}
const A1 = { key: 'k1', label: 'Claude', state: 'reading', tool: 'diagram_get', lastAt: 5, ageMs: 100, mine: true };

test('agents from the probe reach the context, even when the revision did not change (no pickup)', async () => {
  const hook = await open();
  expect(hook.result.current.agents).toEqual([]);
  agents = [A1];
  await tick(3100);
  expect(hook.result.current.agents).toEqual([A1]);
  expect(hook.result.current.diagram.revision).toBe(3);
});

test('agents disappear from the context when the probe stops reporting them', async () => {
  const hook = await open();
  agents = [A1];
  await tick(3100);
  agents = [];
  await tick(3100);
  expect(hook.result.current.agents).toEqual([]);
});

test('an unchanged agents list keeps its identity (no re-render churn every 3 s)', async () => {
  const hook = await open();
  agents = [A1];
  await tick(3100);
  const first = hook.result.current.agents;
  await tick(3100);
  expect(probes).toBeGreaterThanOrEqual(2);
  expect(hook.result.current.agents).toBe(first);
});

test('a malformed agents field is ignored', async () => {
  const hook = await open();
  agents = 'nope';
  await tick(3100);
  expect(hook.result.current.agents).toEqual([]);
});

// Slice 3: session-end checkpoint (Q-V2). On pagehide / tab hidden the editor fires a best-effort keepalive POST
// { kind: 'auto', reason: 'session_end' }, only when a save happened this session, never for viewers.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { sendSessionEndCheckpoint } from '../../../components/diagram-studio/versions/versionsClient';

const base = {
  id: 'd1', name: 'Mine', type: 'infinite-canvas', revision: 5,
  content: { elements: [{ id: 'a', type: 'rectangle', x: 1, y: 2 }], connections: [], layers: [], groups: [] },
};
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

function setup(access) {
  global.fetch = jest.fn(async (url, init = {}) => {
    if (init.method === 'POST') return { ok: true, status: 200, json: async () => ({ deduplicated: true }) };
    if (init.method === 'PUT') return { ok: true, status: 200, json: async () => ({ ...base, revision: 6 }) };
    return { ok: true, status: 200, json: async () => ({ ...base, access }) };
  });
  const wrapper = ({ children }) => <DiagramProvider diagramId="d1">{children}</DiagramProvider>;
  return renderHook(() => useDiagram(), { wrapper });
}
const checkpoints = () => global.fetch.mock.calls.filter(([, init]) => init && init.method === 'POST');
const hide = () => act(async () => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
const show = () => { Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true }); };

describe('sendSessionEndCheckpoint', () => {
  test('POSTs kind auto / reason session_end with keepalive and never throws', async () => {
    global.fetch = jest.fn(async () => ({ ok: true }));
    expect(await sendSessionEndCheckpoint('a b')).toBe(true);
    const [url, init] = global.fetch.mock.calls[0];
    expect(url).toBe('/api/diagrams/a%20b/versions');
    expect(init).toMatchObject({ method: 'POST', keepalive: true });
    expect(JSON.parse(init.body)).toEqual({ kind: 'auto', reason: 'session_end' });
    global.fetch = jest.fn(async () => { throw new Error('offline'); });
    expect(await sendSessionEndCheckpoint('x')).toBe(false);
  });
});

describe('editor session-end checkpoint', () => {
  afterEach(() => show());

  test('hidden tab after a save -> one checkpoint; hidden again without a new save -> none', async () => {
    const { result } = setup({ role: 'editor' });
    await settle();
    await act(async () => { await result.current.saveDiagram(true); });
    await hide();
    expect(checkpoints()).toHaveLength(1);
    expect(checkpoints()[0][0]).toBe('/api/diagrams/d1/versions');
    await hide();
    expect(checkpoints()).toHaveLength(1);
  });

  test('pagehide also triggers it', async () => {
    const { result } = setup({ role: 'owner' });
    await settle();
    await act(async () => { await result.current.saveDiagram(true); });
    await act(async () => { window.dispatchEvent(new Event('pagehide')); });
    expect(checkpoints()).toHaveLength(1);
  });

  test('nothing saved this session -> no checkpoint', async () => {
    setup({ role: 'editor' });
    await settle();
    await hide();
    expect(checkpoints()).toHaveLength(0);
  });

  test('viewers never send one', async () => {
    const { result } = setup({ role: 'viewer' });
    await settle();
    await act(async () => { await result.current.saveDiagram(true); });
    await hide();
    expect(checkpoints()).toHaveLength(0);
  });

  test('a visible tab does not send', async () => {
    const { result } = setup({ role: 'editor' });
    await settle();
    await act(async () => { await result.current.saveDiagram(true); });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(checkpoints()).toHaveLength(0);
  });
});

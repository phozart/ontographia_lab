// Slice 2: restoring a version from the editor. The editor must flush local edits first (so they become the
// pre_restore snapshot), restore with If-Match, reload the new head + revision, and never let a stale autosave
// overwrite the restored head.
import { renderHook, act, waitFor, screen } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const diagram = {
  id: 'd1', name: 'Mine', type: 'infinite-canvas', revision: 5,
  content: { elements: [{ id: 'a', type: 'rectangle', x: 1, y: 2 }], connections: [], layers: [], groups: [] },
};
const restoredHead = {
  ...diagram, revision: 8,
  content: { elements: [{ id: 'old', type: 'rectangle', x: 0, y: 0 }], connections: [], layers: [], groups: [] },
};

const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); }); // let the provider's initial auto-load land

function setup() {
  const wrapper = ({ children }) => <DiagramProvider diagramId="d1">{children}</DiagramProvider>;
  return renderHook(() => useDiagram(), { wrapper });
}

describe('restoreFromVersion', () => {
  let calls;
  let restoreResponse;
  let putResponse;
  let restoreCalled;
  beforeEach(() => {
    calls = [];
    restoreCalled = false;
    putResponse = () => ({ ok: true, status: 200, json: async () => ({ ...diagram, revision: 6 }) });
    restoreResponse = () => ({
      ok: true, status: 200,
      json: async () => ({ diagram: { id: 'd1', revision: 8 }, version: { number: 4, kind: 'restore' }, preRestoreVersion: { number: 3, kind: 'pre_restore' } }),
    });
    global.fetch = jest.fn(async (url, init = {}) => {
      calls.push({ url, init });
      if (String(url).endsWith('/restore')) {
        const r = await restoreResponse();
        if (r.ok) restoreCalled = true;
        return r;
      }
      if (init.method === 'PUT') return putResponse();
      // the initial auto-load (before any restore) returns the original; afterwards the restored head
      const snapshot = restoreCalled ? restoredHead : diagram;
      return { ok: true, status: 200, json: async () => snapshot };
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const restores = () => calls.filter((c) => String(c.url).endsWith('/restore'));
  const puts = () => calls.filter((c) => c.init.method === 'PUT');

  test('clean editor: POSTs restore with If-Match, then loads the new head and revision', async () => {
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    let out;
    await act(async () => { out = await result.current.restoreFromVersion(2); });
    expect(out).toMatchObject({ ok: true, preRestoreVersion: { number: 3 }, version: { number: 4 } });
    expect(restores()).toHaveLength(1);
    expect(restores()[0].url).toBe('/api/diagrams/d1/versions/2/restore');
    expect(restores()[0].init.method).toBe('POST');
    expect(restores()[0].init.headers['If-Match']).toBe('"5"');
    expect(puts()).toHaveLength(0); // nothing to flush
    expect(result.current.diagram.revision).toBe(8);
    expect(result.current.elements.map((e) => e.id)).toEqual(['old']);
    expect(result.current.saveStatus.dirty).toBe(false);
  });

  test('dirty editor: local edits are saved first (they become the pre_restore snapshot), restore uses the new revision', async () => {
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    act(() => { result.current.updateElement('a', { x: 99 }); });
    await act(async () => { await result.current.restoreFromVersion(2); });
    const order = calls.map((c) => (String(c.url).endsWith('/restore') ? 'restore' : c.init.method || 'GET'));
    expect(order.indexOf('PUT')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('PUT')).toBeLessThan(order.indexOf('restore'));
    expect(restores()[0].init.headers['If-Match']).toBe('"6"'); // revision returned by the flush save
    expect(result.current.diagram.revision).toBe(8);
  });

  test('no stale autosave after a restore: edits made during the restore never reach the server', async () => {
    let release;
    restoreResponse = () => new Promise((resolve) => {
      release = () => resolve({ ok: true, status: 200, json: async () => ({ diagram: { id: 'd1', revision: 8 }, version: { number: 4 } }) });
    });
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    let pending;
    act(() => { pending = result.current.restoreFromVersion(2); });
    await waitFor(() => expect(restores()).toHaveLength(1));
    act(() => { result.current.updateElement('a', { x: 5 }); }); // user keeps typing while the request is in flight
    await new Promise((r) => setTimeout(r, 1300));             // longer than the 1 s autosave debounce
    expect(puts()).toHaveLength(0);
    await act(async () => { release(); await pending; });
    expect(puts()).toHaveLength(0); // reloaded head is clean; nothing stale to save
    expect(result.current.elements.map((e) => e.id)).toEqual(['old']);
  });

  test('restore 409 -> conflict dialog, local state untouched, returns not ok', async () => {
    restoreResponse = () => ({ ok: false, status: 409, json: async () => ({ code: 'REVISION_CONFLICT', current: { revision: 9 } }) });
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    let out;
    await act(async () => { out = await result.current.restoreFromVersion(2); });
    expect(out.ok).toBe(false);
    expect(out.conflict).toBe(true);
    expect(await screen.findByText(/changed elsewhere/i)).toBeInTheDocument();
    expect(result.current.diagram.revision).toBe(5);
    expect(result.current.elements.map((e) => e.id)).toEqual(['a']);
  });

  test('flush save failing aborts the restore (nothing is restored over unsaved work)', async () => {
    putResponse = () => ({ ok: false, status: 500, json: async () => ({}) });
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    act(() => { result.current.updateElement('a', { x: 99 }); });
    let out;
    await act(async () => { out = await result.current.restoreFromVersion(2); });
    expect(out.ok).toBe(false);
    expect(restores()).toHaveLength(0);
    expect(result.current.elements[0].x).toBe(99); // local edit kept
  });

  test('server error -> not ok with a message, state untouched, saving resumes', async () => {
    restoreResponse = () => ({ ok: false, status: 403, json: async () => ({ code: 'FORBIDDEN', error: 'Access denied' }) });
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    let out;
    await act(async () => { out = await result.current.restoreFromVersion(2); });
    expect(out).toMatchObject({ ok: false, error: 'Access denied' });
    expect(result.current.diagram.revision).toBe(5);
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts()).toHaveLength(1); // lock released
  });

  test('"unchanged" (version equals the head) reloads nothing destructive and reports it', async () => {
    restoreResponse = () => ({ ok: true, status: 200, json: async () => ({ unchanged: true, diagram: { id: 'd1', revision: 5 }, version: { number: 2 } }) });
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    let out;
    await act(async () => { out = await result.current.restoreFromVersion(2); });
    expect(out).toMatchObject({ ok: true, unchanged: true });
    expect(result.current.diagram.revision).toBe(5);
  });

  test('selection is cleared after a restore (ids may no longer exist)', async () => {
    const { result } = setup();
    await settle();
    act(() => { result.current.setDiagram(diagram); });
    act(() => { result.current.setSelection({ nodeIds: ['a'], connectionIds: [] }); });
    await act(async () => { await result.current.restoreFromVersion(2); });
    expect(result.current.selection.nodeIds).toEqual([]);
  });
});

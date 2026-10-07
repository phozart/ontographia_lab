import { renderHook, act, waitFor, screen } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { resolveAccessAfterDenied, canWrite } from '../../../components/diagram-studio/sharing/accessMode';

const wrapper = ({ children }) => <DiagramProvider diagramId="d1" defaultPack="process-flow">{children}</DiagramProvider>;
const editorDiagram = { id: 'd1', name: 'X', type: 'infinite-canvas', revision: 1, access: { role: 'editor', capabilities: ['diagram.read', 'diagram.write', 'comment.create'] }, content: { elements: [], connections: [] } };
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

describe('resolveAccessAfterDenied', () => {
  const editor = { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] };
  it('treats 404/403/no response as removed', () => {
    for (const r of [{ status: 404 }, { status: 403 }, null]) {
      const out = resolveAccessAfterDenied(editor, r);
      expect(out.kind).toBe('removed');
      expect(canWrite(out.access)).toBe(false);
    }
  });
  it('adopts the new lower role as changed', () => {
    const out = resolveAccessAfterDenied(editor, { status: 200, body: { access: { role: 'viewer', capabilities: ['diagram.read'] } } });
    expect(out.kind).toBe('changed');
    expect(canWrite(out.access)).toBe(false);
  });
  it('still-editor re-read is denied (autosave must stop, access unchanged)', () => {
    const out = resolveAccessAfterDenied(editor, { status: 200, body: { access: editor } });
    expect(out).toEqual({ kind: 'denied', access: editor });
  });
});

describe('save refused with 403/404 (access revoked or demoted)', () => {
  let calls;
  beforeEach(() => { calls = []; jest.spyOn(console, 'error').mockImplementation(() => {}); });
  afterEach(() => jest.restoreAllMocks());

  const setup = async (reread) => {
    global.fetch = jest.fn(async (url, opts = {}) => {
      calls.push(`${opts.method || 'GET'} ${url}`);
      if (opts.method === 'PUT') return res(403, { error: 'forbidden' });
      // the provider's own initial load (if any) sees the editor payload; the post-403 re-read sees `reread`
      return calls.filter((c) => c.startsWith('PUT')).length === 0 ? res(200, editorDiagram) : reread;
    });
    const hook = renderHook(() => useDiagram(), { wrapper });
    await act(async () => { await Promise.resolve(); }); // let the provider's own initial load settle
    act(() => { hook.result.current.setDiagram(editorDiagram); });
    return hook;
  };

  it('stops autosave, goes read-only and shows the demoted notice (no unhandled error)', async () => {
    jest.useFakeTimers();
    const { result } = await setup(res(200, { ...editorDiagram, access: { role: 'viewer', capabilities: ['diagram.read'] } }));
    act(() => { result.current.addElement({ id: 'a', type: 'rectangle', x: 0, y: 0 }); });
    await act(async () => { jest.advanceTimersByTime(1100); });
    await act(async () => { await Promise.resolve(); });
    expect(canWrite(result.current.diagram.access)).toBe(false);
    expect(screen.getByTestId('access-changed-notice').textContent).toMatch(/access to this diagram changed/);
    const puts = () => calls.filter((c) => c.startsWith('PUT')).length;
    expect(puts()).toBe(1);
    await act(async () => { jest.advanceTimersByTime(10000); });
    expect(puts()).toBe(1); // no retry loop
    expect(result.current.elements.map((e) => e.id)).toEqual(['a']);
    // local edits are refused from now on
    act(() => { result.current.addElement({ id: 'b', type: 'rectangle', x: 0, y: 0 }); });
    expect(result.current.elements.map((e) => e.id)).toEqual(['a']);
    jest.useRealTimers();
  });

  it('shows the removed notice when the re-read is 404', async () => {
    jest.useFakeTimers();
    const { result } = await setup(res(404, { error: 'not found' }));
    act(() => { result.current.addElement({ id: 'a', type: 'rectangle', x: 0, y: 0 }); });
    await act(async () => { jest.advanceTimersByTime(1100); });
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('access-changed-notice').textContent).toMatch(/access to this diagram was removed/);
    expect(canWrite(result.current.diagram.access)).toBe(false);
    jest.useRealTimers();
  });
});

describe('read-only context refuses local mutations', () => {
  it('addElement/addConnection/deleteSelected are no-ops for a viewer', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.setDiagram({ ...editorDiagram, access: { role: 'viewer', capabilities: ['diagram.read'] }, content: { elements: [{ id: 'e1', type: 'rectangle', x: 0, y: 0 }], connections: [] } }); });
    act(() => {
      result.current.addElement({ id: 'n', type: 'rectangle', x: 1, y: 1 });
      result.current.addConnection({ id: 'c', source: 'e1', target: 'e1' });
      result.current.updateElement('e1', { x: 99 });
      result.current.selectAll();
      result.current.deleteSelected();
    });
    expect(result.current.elements.map((e) => e.id)).toEqual(['e1']);
    expect(result.current.elements[0].x).toBe(0);
    expect(result.current.connections).toHaveLength(0);
  });
});

// Slice 1: saves send If-Match <revision>; a 409 pauses autosave and shows the conflict dialog.
import { renderHook, act, waitFor, screen } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const diagram = {
  id: 'd1', name: 'Mine', type: 'infinite-canvas', revision: 5,
  content: { elements: [{ id: 'a', type: 'rectangle', x: 1, y: 2 }], connections: [], layers: [], groups: [] },
};

function setup() {
  const wrapper = ({ children }) => <DiagramProvider diagramId="d1">{children}</DiagramProvider>;
  return renderHook(() => useDiagram(), { wrapper });
}

describe('save concurrency', () => {
  let calls;
  let putResponse;
  beforeEach(() => {
    calls = [];
    putResponse = () => ({ ok: true, status: 200, json: async () => ({ ...diagram, revision: 6 }) });
    global.fetch = jest.fn(async (url, init = {}) => {
      calls.push({ url, init });
      if (init.method === 'PUT') return putResponse();
      if (init.method === 'POST') return { ok: true, status: 201, json: async () => ({ id: 'd2', short_id: 'LAB-2' }) };
      return { ok: true, status: 200, json: async () => ({ ...diagram, revision: 9, name: 'Latest' }) };
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  const puts = () => calls.filter((c) => c.init.method === 'PUT');

  test('PUT carries If-Match with the loaded revision and the next save uses the returned one', async () => {
    const { result } = setup();
    act(() => { result.current.setDiagram(diagram); });
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts()[0].init.headers['If-Match']).toBe('"5"');
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts()[1].init.headers['If-Match']).toBe('"6"');
  });

  test('no revision known -> no If-Match header (older payloads keep working)', async () => {
    const { result } = setup();
    act(() => { result.current.setDiagram({ ...diagram, revision: undefined }); });
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts()[0].init.headers['If-Match']).toBeUndefined();
  });

  test('409 shows the conflict dialog, keeps local edits and stops further saves', async () => {
    putResponse = () => ({ ok: false, status: 409, json: async () => ({ code: 'REVISION_CONFLICT', current: { revision: 9 } }) });
    const { result } = setup();
    act(() => { result.current.setDiagram(diagram); });
    await act(async () => { await result.current.saveDiagram(true); });
    expect(await screen.findByText(/changed elsewhere/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reload latest/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save my version as a copy/i })).toBeInTheDocument();
    expect(result.current.elements).toHaveLength(1);
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts()).toHaveLength(1);
  });

  test('"Reload latest" loads the server version and resumes saving', async () => {
    putResponse = () => ({ ok: false, status: 409, json: async () => ({ current: { revision: 9 } }) });
    const { result } = setup();
    act(() => { result.current.setDiagram(diagram); });
    await act(async () => { await result.current.saveDiagram(true); });
    await act(async () => { screen.getByRole('button', { name: /reload latest/i }).click(); });
    await waitFor(() => expect(result.current.diagram.revision).toBe(9));
    expect(result.current.diagram.name).toBe('Latest');
    await waitFor(() => expect(screen.queryByText(/changed elsewhere/i)).toBeNull());
    putResponse = () => ({ ok: true, status: 200, json: async () => ({ ...diagram, revision: 10 }) });
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts().pop().init.headers['If-Match']).toBe('"9"');
  });

  test('"Save my version as a copy" POSTs the local content as a new diagram', async () => {
    putResponse = () => ({ ok: false, status: 409, json: async () => ({ current: { revision: 9 } }) });
    const { result } = setup();
    act(() => { result.current.setDiagram(diagram); });
    await act(async () => { await result.current.saveDiagram(true); });
    await act(async () => { screen.getByRole('button', { name: /save my version as a copy/i }).click(); });
    // jsdom cannot navigate; the POST is what matters here (navigation goes to /diagram/LAB-2)
    await waitFor(() => expect(calls.some((c) => c.init.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.init.method === 'POST');
    const body = JSON.parse(post.init.body);
    expect(body.name).toMatch(/ \(my version\)$/);
    expect(body.content.elements.map((e) => e.id)).toEqual(['a']);
  });
});

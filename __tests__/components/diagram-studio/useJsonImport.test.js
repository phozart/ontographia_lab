import { renderHook, act } from '@testing-library/react';

const mockCtx = {
  elements: [{ id: 'existing', x: 0, y: 0, size: { width: 10, height: 10 } }],
  connections: [],
  viewport: { x: 0, y: 0, scale: 1 },
  setElements: jest.fn(),
  setConnections: jest.fn(),
  setSelection: jest.fn(),
};
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => mockCtx,
}));

import {
  useJsonImport,
  IMPORT_JSON_EVENT,
  requestJsonImportFromDrop,
} from '../../../components/diagram-studio/export/useJsonImport';

const valid = JSON.stringify({
  format: 'ontographia-diagram',
  version: 1,
  exportedAt: 'x',
  diagram: {
    name: 'Imported',
    type: 'cld',
    content: {
      elements: [
        { id: 'a', type: 'rect', x: 0, y: 0, size: { width: 100, height: 50 } },
        { id: 'b', type: 'rect', x: 200, y: 0, size: { width: 100, height: 50 } },
      ],
      connections: [{ id: 'c', sourceId: 'a', targetId: 'b' }],
    },
  },
});

beforeEach(() => {
  Object.values(mockCtx).forEach(v => v.mockClear && v.mockClear());
});

describe('useJsonImport', () => {
  it('stages a valid file for confirmation', () => {
    const { result } = renderHook(() => useJsonImport());
    act(() => { result.current.importText(valid, 'x.json'); });
    expect(result.current.pending.counts).toEqual({ elements: 2, connections: 1 });
    expect(result.current.error).toBeNull();
  });

  it('shows an error for invalid files and stages nothing', () => {
    const { result } = renderHook(() => useJsonImport());
    act(() => { result.current.importText('nope', 'x.json'); });
    expect(result.current.pending).toBeNull();
    expect(result.current.error).toMatch(/not valid JSON/i);
  });

  it('rejects oversized File objects before reading', async () => {
    const { result } = renderHook(() => useJsonImport());
    const big = { name: 'big.json', size: 6 * 1024 * 1024, text: jest.fn() };
    await act(async () => { await result.current.importFile(big); });
    expect(big.text).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/too large/i);
  });

  it('merges into the current diagram with new ids centered on the viewport', () => {
    const { result } = renderHook(() => useJsonImport());
    act(() => { result.current.importText(valid, 'x.json'); });
    act(() => { result.current.mergeIntoCurrent(); });

    const updater = mockCtx.setElements.mock.calls[0][0];
    const merged = updater(mockCtx.elements);
    expect(merged).toHaveLength(3);
    expect(merged[0].id).toBe('existing');
    const added = merged.slice(1);
    expect(added.map(e => e.id)).not.toContain('a');
    // bbox 0..300 x 0..50 centered on 600,400 (default area)
    expect(added[0].x).toBe(450);
    expect(added[0].y).toBe(375);

    const connUpdater = mockCtx.setConnections.mock.calls[0][0];
    const conns = connUpdater([]);
    expect(conns).toHaveLength(1);
    expect(conns[0].sourceId).toBe(added[0].id);
    expect(conns[0].targetId).toBe(added[1].id);
    expect(mockCtx.setSelection).toHaveBeenCalledWith({ nodeIds: added.map(e => e.id), connectionIds: [] });
    expect(result.current.pending).toBeNull();
  });

  it('creates a new diagram via POST /api/diagrams and opens it', async () => {
    const navigate = jest.fn();
    global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'uuid-1', short_id: 'LAB-9' }) });
    const { result } = renderHook(() => useJsonImport({ navigate }));
    act(() => { result.current.importText(valid, 'x.json'); });
    await act(async () => { await result.current.createNewDiagram(); });

    expect(global.fetch).toHaveBeenCalledWith('/api/diagrams', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse(global.fetch.mock.calls[0][1].body);
    expect(body.name).toBe('Imported');
    expect(body.type).toBe('cld');
    expect(body.content.elements).toHaveLength(2);
    expect(navigate).toHaveBeenCalledWith('/diagram/LAB-9');
  });

  it('reports API failures', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 400, json: async () => ({ error: 'bad type' }) });
    const { result } = renderHook(() => useJsonImport({ navigate: jest.fn() }));
    act(() => { result.current.importText(valid, 'x.json'); });
    await act(async () => { await result.current.createNewDiagram(); });
    expect(result.current.error).toMatch(/bad type/);
  });

  it('listens for drop events dispatched on window', async () => {
    const { result } = renderHook(() => useJsonImport());
    const file = { name: 'd.json', size: valid.length, text: async () => valid };
    await act(async () => {
      window.dispatchEvent(new CustomEvent(IMPORT_JSON_EVENT, { detail: { file } }));
    });
    expect(result.current.pending?.counts.elements).toBe(2);
  });
});

describe('requestJsonImportFromDrop', () => {
  it('handles a dropped .json file and reports true', () => {
    const handler = jest.fn();
    window.addEventListener(IMPORT_JSON_EVENT, handler);
    const file = { name: 'a.json', type: 'application/json' };
    expect(requestJsonImportFromDrop({ files: [file] })).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    window.removeEventListener(IMPORT_JSON_EVENT, handler);
  });
  it('ignores other drops', () => {
    expect(requestJsonImportFromDrop({ files: [{ name: 'a.png', type: 'image/png' }] })).toBe(false);
    expect(requestJsonImportFromDrop({ files: [] })).toBe(false);
    expect(requestJsonImportFromDrop(null)).toBe(false);
  });
});

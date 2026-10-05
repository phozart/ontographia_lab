// Slice 0: exactly one PUT per save, canonical stored shape, legacy shapes load normalized.
import { renderHook, act, waitFor } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const nestedLegacy = {
  id: 'd1',
  name: 'Legacy',
  type: 'infinite-canvas',
  content: {
    elements: [{ id: 'a', type: 'rectangle', x: 1, y: 2 }],
    connections: [],
    layers: [{ id: 'default', name: 'Default', visible: true, locked: false, order: 0 }],
    groups: [],
    diagram: {
      id: 'd1',
      content: { elements: [{ id: 'a' }], viewport: { x: 7, y: 8, zoom: 1.5 } },
    },
  },
};

function setup(onSave) {
  const wrapper = ({ children }) => (
    <DiagramProvider diagramId="d1" onSave={onSave}>{children}</DiagramProvider>
  );
  return renderHook(() => useDiagram(), { wrapper });
}

describe('save path', () => {
  let puts;
  beforeEach(() => {
    puts = [];
    global.fetch = jest.fn(async (url, init = {}) => {
      if (init.method === 'PUT') {
        const body = JSON.parse(init.body);
        puts.push({ url, body });
        return { ok: true, json: async () => ({ id: 'd1', name: body.name, content: body.content }) };
      }
      return { ok: true, json: async () => nestedLegacy };
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => jest.restoreAllMocks());

  test('a save issues exactly one PUT with content = {elements, connections, layers, groups, viewport}', async () => {
    const { result } = setup();
    act(() => { result.current.setDiagram(nestedLegacy); });
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts).toHaveLength(1);
    expect(Object.keys(puts[0].body.content).sort()).toEqual(['connections', 'elements', 'groups', 'layers', 'viewport']);
    expect(puts[0].body.content).not.toHaveProperty('diagram');
  });

  test('a legacy nested diagram is normalized on load and its viewport is kept on the next save', async () => {
    const { result } = setup();
    act(() => { result.current.setDiagram(nestedLegacy); });
    expect(result.current.elements.map((e) => e.id)).toEqual(['a']);
    await act(async () => { await result.current.saveDiagram(true); });
    expect(puts[0].body.content.viewport).toEqual({ x: 7, y: 8, zoom: 1.5 });
    expect(JSON.stringify(puts[0].body.content)).not.toMatch(/"diagram"/);
  });

  test('onSave is a notification only: the context does not trigger further network writes', async () => {
    const onSave = jest.fn();
    const { result } = setup(onSave);
    act(() => { result.current.setDiagram(nestedLegacy); });
    await act(async () => { await result.current.saveDiagram(true); });
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(global.fetch.mock.calls.filter(([, i]) => i?.method === 'PUT')).toHaveLength(1);
  });

  test('nested legacy content gets legacy element types upgraded (normalize, then migrate)', () => {
    const { result } = setup();
    act(() => {
      result.current.setDiagram({
        id: 'd1', name: 'L', type: 'mindmap',
        content: { diagram: { content: { elements: [{ id: 'n1', type: 'central-idea', x: 0, y: 0 }] } } },
      });
    });
    expect(result.current.elements).toHaveLength(1);
    expect(result.current.elements[0]).toMatchObject({ id: 'n1', type: 'central-topic', packId: 'mind-map' });
  });
});

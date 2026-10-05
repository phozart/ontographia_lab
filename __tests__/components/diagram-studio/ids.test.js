// Slice 0 (ADR-0004 P1): stable, globally unique ids from crypto.randomUUID().
import { renderHook, act } from '@testing-library/react';
import { generateId } from '../../../components/diagram-studio/utils/ids';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { useClipboard } from '../../../components/diagram-studio/hooks/interaction/useClipboard';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('generateId', () => {
  test('prefix + uuid v4, usable as an SVG/CSS id (starts with a letter)', () => {
    const id = generateId('el');
    expect(id).toMatch(/^el-/);
    expect(id).toMatch(UUID_RE);
  });

  test('1000 ids are unique, even in the same millisecond', () => {
    const ids = new Set(Array.from({ length: 1000 }, () => generateId('el')));
    expect(ids.size).toBe(1000);
  });

  test('uses crypto.randomUUID when available and never Math.random', () => {
    const rand = jest.spyOn(Math, 'random');
    const uuid = jest.spyOn(globalThis.crypto, 'randomUUID');
    generateId('conn');
    expect(uuid).toHaveBeenCalled();
    expect(rand).not.toHaveBeenCalled();
    rand.mockRestore();
    uuid.mockRestore();
  });

  test('falls back to getRandomValues when randomUUID is unavailable (insecure context)', () => {
    const original = globalThis.crypto.randomUUID;
    Object.defineProperty(globalThis.crypto, 'randomUUID', { value: undefined, configurable: true, writable: true });
    try {
      const ids = new Set(Array.from({ length: 200 }, () => generateId('x')));
      expect(ids.size).toBe(200);
      for (const id of ids) expect(id).toMatch(UUID_RE);
    } finally {
      Object.defineProperty(globalThis.crypto, 'randomUUID', { value: original, configurable: true, writable: true });
    }
  });
});

describe('no collisions when duplicating / pasting 1000 elements', () => {
  const wrapper = ({ children }) => <DiagramProvider diagramId="t">{children}</DiagramProvider>;
  const seed = (n) => Array.from({ length: n }, (_, i) => ({ id: `seed-${i}`, type: 'rectangle', x: i * 10, y: 0, packId: 'core' }));

  test('DiagramContext.duplicateSelected', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.setElements(seed(1000)); });
    act(() => { result.current.setSelection({ nodeIds: seed(1000).map((e) => e.id), connectionIds: [] }); });
    act(() => { result.current.duplicateSelected(); });
    const ids = result.current.elements.map((e) => e.id);
    expect(ids).toHaveLength(2000);
    expect(new Set(ids).size).toBe(2000);
    expect(ids.filter((i) => !i.startsWith('seed-')).every((i) => UUID_RE.test(i))).toBe(true);
  });

  test('useClipboard.duplicate called repeatedly', () => {
    const elements = seed(1000);
    const added = [];
    const hook = renderHook(() => useClipboard({
      elements,
      connections: [],
      selection: { nodeIds: elements.map((e) => e.id), connectionIds: [] },
      addElement: (e) => added.push(e),
      addConnection: () => {},
      selectElements: () => {},
      recordHistory: () => {},
    }));
    act(() => { hook.result.current.duplicate(); });
    act(() => { hook.result.current.duplicate(); });
    expect(added).toHaveLength(2000);
    expect(new Set(added.map((e) => e.id)).size).toBe(2000);
    expect(added.every((e) => UUID_RE.test(e.id))).toBe(true);
  });
});

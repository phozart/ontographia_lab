import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

const node = (id, extra = {}) => ({ id, type: 'rectangle', x: 100, y: 100, packId: 'process-flow', ...extra });

// Count how many undo presses it takes until undo is exhausted.
function countUndos(result) {
  let n = 0;
  while (result.current.canUndo && n < 100) {
    act(() => result.current.undo());
    n++;
  }
  return n;
}

describe('undo history', () => {
  test('recordHistory with no change since the last snapshot does not add entries', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(node('a')); });
    // simulate repeated plain clicks recording the same state
    act(() => { result.current.recordHistory(); });
    act(() => { result.current.recordHistory(); });
    act(() => { result.current.recordHistory(); });
    // add (pre-state: empty) + one snapshot of {a}
    expect(countUndos(result)).toBe(2);
  });

  test('repeated identical snapshots in one tick collapse', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(node('a')); });
    act(() => {
      result.current.recordHistory();
      result.current.recordHistory();
      result.current.recordHistory();
    });
    expect(countUndos(result)).toBe(2);
  });

  test('a drag (updateElement + trailing recordHistory) is exactly one entry', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(node('a')); });
    const base = countUndosFrom(result);
    act(() => {
      result.current.updateElement('a', { x: 200 });
      result.current.recordHistory();
    });
    expect(countUndosFrom(result) - base).toBe(1);
  });

  test('nudge-like multi-update plus recordHistory is one entry per press', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => {
      result.current.addElement(node('a'));
      result.current.addElement(node('b'));
    });
    const base = countUndosFrom(result);
    act(() => {
      result.current.updateElement('a', { x: 120 });
      result.current.updateElement('b', { x: 120 });
      result.current.recordHistory();
    });
    expect(countUndosFrom(result) - base).toBe(1);
  });

  test('a continuous gesture with a coalesce key is one undo entry (resize)', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(node('a', { size: { width: 100, height: 50 } })); });
    const base = countUndosFrom(result);
    for (let w = 110; w <= 200; w += 10) {
      act(() => {
        result.current.updateElement('a', { size: { width: w, height: 50 } }, { coalesceKey: 'resize:a' });
      });
    }
    expect(countUndosFrom(result) - base).toBe(1);
    // undo restores the pre-gesture size in one step
    act(() => result.current.undo());
    expect(result.current.elements[0].size.width).toBe(100);
  });

  test('discardElement removes a fresh node and leaves no history trace', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(node('root')); });
    const base = countUndosFrom(result);
    act(() => { result.current.addElement(node('fresh')); });
    act(() => { result.current.addConnection({ id: 'c1', sourceId: 'root', targetId: 'fresh' }); });
    expect(result.current.elements.map(e => e.id)).toEqual(['root', 'fresh']);
    act(() => { result.current.discardElement('fresh'); });
    expect(result.current.elements.map(e => e.id)).toEqual(['root']);
    expect(result.current.connections).toHaveLength(0);
    // creation + cancel leave no trace: depth is back to what it was before creation
    expect(countUndosFrom(result)).toBe(base);
    // and the next undo is a real step (reverts creating 'root'), not a no-op
    act(() => result.current.undo());
    expect(result.current.elements).toEqual([]);
  });
});

// Counts undo depth without consuming it (reads the length via a dry run on a copy is not
// possible, so approximate by undoing everything then redoing everything).
function countUndosFrom(result) {
  const n = countUndos(result);
  for (let i = 0; i < n; i++) act(() => result.current.redo());
  return n;
}

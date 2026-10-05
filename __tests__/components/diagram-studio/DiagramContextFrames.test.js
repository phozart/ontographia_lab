// Frame membership through the context: explicit, never geometric on drag.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

const wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

const frame = { id: 'f', type: 'frame', packId: 'core', x: 0, y: 0, size: { width: 500, height: 500 } };
const box = (id, x, y, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x, y, size: { width: 100, height: 50 }, ...extra });
const byId = (result, id) => result.current.elements.find((e) => e.id === id);

describe('frame membership in DiagramContext', () => {
  it('marks a newly added frame as explicit and does not adopt shapes underneath', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(box('under', 10, 10)); });
    act(() => { result.current.addElement(frame); });
    expect(byId(result, 'f').membershipExplicit).toBe(true);
    expect(byId(result, 'under').parentFrameId).toBeUndefined();
  });

  it('adopts a shape created inside an existing frame', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(frame); });
    act(() => { result.current.addElement(box('n', 100, 100)); });
    expect(byId(result, 'n').parentFrameId).toBe('f');
  });

  it('a template frame inserted over an existing shape does not adopt it, but adopts its own members', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(box('existing', 10, 10)); });
    act(() => {
      result.current.addElement(frame);
      result.current.addElement(box('tpl', 200, 200, { parentFrameId: 'f' }));
    });
    expect(byId(result, 'existing').parentFrameId).toBeUndefined();
    expect(byId(result, 'tpl').parentFrameId).toBe('f');
  });

  it('removing a frame releases its members', () => {
    const { result } = renderHook(() => useDiagram(), { wrapper });
    act(() => { result.current.addElement(frame); });
    act(() => { result.current.addElement(box('n', 100, 100)); });
    act(() => { result.current.removeElement('f'); });
    expect(byId(result, 'n').parentFrameId).toBeNull();
  });
});

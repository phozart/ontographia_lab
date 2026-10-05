// Frame membership through the context: explicit, never geometric on drag.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram, useDiagramSelection } from '../../../components/diagram-studio/DiagramContext';

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

  it('deleteSelected on a frame releases its members, and undo restores them', () => {
    const { result } = renderHook(() => ({ d: useDiagram(), s: useDiagramSelection() }), { wrapper });
    act(() => { result.current.d.addElement(frame); });
    act(() => { result.current.d.addElement(box('n', 100, 100)); });
    act(() => { result.current.s.selectElements(['f']); });
    act(() => { result.current.d.deleteSelected(); });
    expect(result.current.d.elements.find((e) => e.id === 'n').parentFrameId).toBeNull();
    act(() => { result.current.d.undo(); });
    expect(result.current.d.elements.find((e) => e.id === 'f')).toBeDefined();
    expect(result.current.d.elements.find((e) => e.id === 'n').parentFrameId).toBe('f');
  });

  describe('duplicateSelected', () => {
    const setup = () => {
      const r = renderHook(() => ({ d: useDiagram(), s: useDiagramSelection() }), { wrapper });
      act(() => { r.result.current.d.addElement(frame); });
      act(() => { r.result.current.d.addElement(box('n', 100, 100)); });
      return r;
    };

    it('duplicating a frame together with its members binds the copies to the copied frame', () => {
      const { result } = setup();
      act(() => { result.current.s.selectElements(['f', 'n']); });
      act(() => { result.current.d.duplicateSelected(); });
      const els = result.current.d.elements;
      const newFrame = els.find((e) => e.type === 'frame' && e.id !== 'f');
      const newBox = els.find((e) => e.type === 'rectangle' && e.id !== 'n');
      expect(newFrame).toBeDefined();
      expect(newBox.parentFrameId).toBe(newFrame.id);
      expect(els.find((e) => e.id === 'n').parentFrameId).toBe('f');
    });

    it('duplicating a member alone binds the copy only if it lands inside the frame', () => {
      const { result } = setup();
      act(() => { result.current.s.selectElements(['n']); });
      act(() => { result.current.d.duplicateSelected(); });
      const copy = result.current.d.elements.find((e) => e.type === 'rectangle' && e.id !== 'n');
      const inside = copy.x >= 0 && copy.y >= 0 && copy.x + 100 <= 500 && copy.y + 50 <= 500;
      expect(copy.parentFrameId).toBe(inside ? 'f' : null);
    });

    it('duplicating a member whose copy lands outside the frame releases it', () => {
      const r = renderHook(() => ({ d: useDiagram(), s: useDiagramSelection() }), { wrapper });
      act(() => { r.result.current.d.addElement({ ...frame, size: { width: 240, height: 200 } }); });
      act(() => { r.result.current.d.addElement(box('n', 100, 100)); });
      act(() => { r.result.current.s.selectElements(['n']); });
      act(() => { r.result.current.d.duplicateSelected(); });
      const copy = r.result.current.d.elements.find((e) => e.type === 'rectangle' && e.id !== 'n');
      expect(copy.x).toBeGreaterThan(200);
      expect(copy.parentFrameId).toBeNull();
    });
  });
});

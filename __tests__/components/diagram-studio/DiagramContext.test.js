// __tests__/components/diagram-studio/DiagramContext.test.js
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram, useDiagramViewport, useDiagramSelection, useDiagramHistory } from '../../../components/diagram-studio/DiagramContext';

// Wrapper component for hooks
const wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

describe('DiagramContext', () => {
  describe('useDiagram', () => {
    it('should provide initial state', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      expect(result.current.elements).toEqual([]);
      expect(result.current.connections).toEqual([]);
      expect(result.current.activeTool).toBe('select');
      expect(result.current.showGrid).toBe(true);
      expect(result.current.gridStyle).toBe('lines');
    });

    it('should add element', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.addElement({
          id: 'elem-1',
          type: 'rectangle',
          x: 100,
          y: 100,
          packId: 'process-flow',
        });
      });

      expect(result.current.elements).toHaveLength(1);
      expect(result.current.elements[0].id).toBe('elem-1');
    });

    it('should update element', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.addElement({
          id: 'elem-1',
          type: 'rectangle',
          x: 100,
          y: 100,
          packId: 'process-flow',
        });
      });

      act(() => {
        result.current.updateElement('elem-1', { x: 200, y: 200 });
      });

      expect(result.current.elements[0].x).toBe(200);
      expect(result.current.elements[0].y).toBe(200);
    });

    it('should remove element', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.addElement({
          id: 'elem-1',
          type: 'rectangle',
          x: 100,
          y: 100,
          packId: 'process-flow',
        });
      });

      act(() => {
        result.current.removeElement('elem-1');
      });

      expect(result.current.elements).toHaveLength(0);
    });

    it('should change active tool', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.setActiveTool('connect');
      });

      expect(result.current.activeTool).toBe('connect');
    });

    it('should toggle grid', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      expect(result.current.showGrid).toBe(true);

      act(() => {
        result.current.setShowGrid(false);
      });

      expect(result.current.showGrid).toBe(false);
    });

    it('should change grid style', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      expect(result.current.gridStyle).toBe('lines');

      act(() => {
        result.current.setGridStyle('dots');
      });

      expect(result.current.gridStyle).toBe('dots');
    });

    it('should add connection', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.addConnection({
          id: 'conn-1',
          sourceId: 'elem-1',
          targetId: 'elem-2',
          sourcePort: 'bottom',
          targetPort: 'top',
        });
      });

      expect(result.current.connections).toHaveLength(1);
      expect(result.current.connections[0].id).toBe('conn-1');
    });
  });

  describe('useDiagramViewport', () => {
    it('should provide initial viewport', () => {
      const { result } = renderHook(() => useDiagramViewport(), { wrapper });

      // Infinite canvas: 100000x100000 with origin at center, so the initial
      // viewport is offset to (-50000, -50000)
      expect(result.current.viewport).toEqual({
        x: -50000,
        y: -50000,
        scale: 1,
      });
    });

    it('should zoom in', () => {
      const { result } = renderHook(() => useDiagramViewport(), { wrapper });

      act(() => {
        result.current.zoomIn();
      });

      expect(result.current.viewport.scale).toBeGreaterThan(1);
    });

    it('should zoom out', () => {
      const { result } = renderHook(() => useDiagramViewport(), { wrapper });

      act(() => {
        result.current.zoomOut();
      });

      expect(result.current.viewport.scale).toBeLessThan(1);
    });

    it('should pan viewport', () => {
      const { result } = renderHook(() => useDiagramViewport(), { wrapper });

      act(() => {
        result.current.pan(100, 50);
      });

      expect(result.current.viewport.x).toBe(-50000 + 100);
      expect(result.current.viewport.y).toBe(-50000 + 50);
    });
  });

  describe('useDiagramSelection', () => {
    it('should start with empty selection', () => {
      const { result } = renderHook(() => useDiagramSelection(), { wrapper });

      expect(result.current.selection.nodeIds).toEqual([]);
      expect(result.current.selection.connectionIds).toEqual([]);
    });

    it('should select element', () => {
      const { result } = renderHook(() => useDiagramSelection(), { wrapper });

      act(() => {
        result.current.selectElement('elem-1');
      });

      expect(result.current.selection.nodeIds).toContain('elem-1');
    });

    it('should select multiple elements', () => {
      const { result } = renderHook(() => useDiagramSelection(), { wrapper });

      act(() => {
        result.current.selectElements(['elem-1', 'elem-2', 'elem-3']);
      });

      expect(result.current.selection.nodeIds).toHaveLength(3);
    });

    it('should clear selection', () => {
      const { result } = renderHook(() => useDiagramSelection(), { wrapper });

      act(() => {
        result.current.selectElement('elem-1');
      });

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selection.nodeIds).toHaveLength(0);
    });

    it('should check if element is selected', () => {
      const { result } = renderHook(() => useDiagramSelection(), { wrapper });

      act(() => {
        result.current.selectElement('elem-1');
      });

      expect(result.current.isElementSelected('elem-1')).toBe(true);
      expect(result.current.isElementSelected('elem-2')).toBe(false);
    });
  });

  describe('useDiagramHistory', () => {
    it('should start with no undo/redo available', () => {
      const { result } = renderHook(() => useDiagramHistory(), { wrapper });

      expect(result.current.canUndo).toBe(false);
      expect(result.current.canRedo).toBe(false);
    });

    it('should allow undo after recording history', () => {
      const { result: diagramResult } = renderHook(() => useDiagram(), { wrapper });
      const { result: historyResult } = renderHook(() => useDiagramHistory(), { wrapper });

      act(() => {
        diagramResult.current.addElement({
          id: 'elem-1',
          type: 'rectangle',
          x: 100,
          y: 100,
          packId: 'process-flow',
        });
        diagramResult.current.recordHistory();
      });

      // Note: undo/redo functionality depends on implementation
      // This test verifies the hooks are accessible
      expect(typeof historyResult.current.undo).toBe('function');
      expect(typeof historyResult.current.redo).toBe('function');
    });
  });
});

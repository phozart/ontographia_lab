// __tests__/components/diagram-studio/GridStyle.test.js
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';

// Wrapper component for hooks
const wrapper = ({ children }) => (
  <DiagramProvider diagramId="test-diagram" defaultPack="process-flow">
    {children}
  </DiagramProvider>
);

describe('Grid Style Feature', () => {
  describe('Grid visibility', () => {
    it('should start with grid visible', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });
      expect(result.current.showGrid).toBe(true);
    });

    it('should toggle grid visibility', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.setShowGrid(false);
      });
      expect(result.current.showGrid).toBe(false);

      act(() => {
        result.current.setShowGrid(true);
      });
      expect(result.current.showGrid).toBe(true);
    });
  });

  describe('Grid style options', () => {
    it('should default to dots style', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });
      expect(result.current.gridStyle).toBe('dots');
    });

    it('should change to lines style', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.setGridStyle('lines');
      });
      expect(result.current.gridStyle).toBe('lines');
    });

    it('should change to none style', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      act(() => {
        result.current.setGridStyle('none');
      });
      expect(result.current.gridStyle).toBe('none');
    });

    it('should cycle through styles', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      // Start with dots
      expect(result.current.gridStyle).toBe('dots');

      // Change to lines
      act(() => {
        result.current.setGridStyle('lines');
      });
      expect(result.current.gridStyle).toBe('lines');

      // Change to none
      act(() => {
        result.current.setGridStyle('none');
      });
      expect(result.current.gridStyle).toBe('none');

      // Back to dots
      act(() => {
        result.current.setGridStyle('dots');
      });
      expect(result.current.gridStyle).toBe('dots');
    });
  });

  describe('Grid and style interaction', () => {
    it('should maintain grid style when toggling visibility', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      // Set to lines style
      act(() => {
        result.current.setGridStyle('lines');
      });
      expect(result.current.gridStyle).toBe('lines');

      // Hide grid
      act(() => {
        result.current.setShowGrid(false);
      });
      expect(result.current.showGrid).toBe(false);
      expect(result.current.gridStyle).toBe('lines'); // Style preserved

      // Show grid again
      act(() => {
        result.current.setShowGrid(true);
      });
      expect(result.current.showGrid).toBe(true);
      expect(result.current.gridStyle).toBe('lines'); // Still lines
    });

    it('should allow changing style while grid is hidden', () => {
      const { result } = renderHook(() => useDiagram(), { wrapper });

      // Hide grid
      act(() => {
        result.current.setShowGrid(false);
      });

      // Change style while hidden
      act(() => {
        result.current.setGridStyle('lines');
      });
      expect(result.current.gridStyle).toBe('lines');

      // Show grid - should use new style
      act(() => {
        result.current.setShowGrid(true);
      });
      expect(result.current.gridStyle).toBe('lines');
    });
  });
});

// components/diagram-studio/ResizablePanel.js
// Resizable panel component for DiagramStudio
// Supports left, right, and bottom positions with drag handles

import { useState, useRef, useCallback, useEffect } from 'react';

// ============ CONSTANTS ============

const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 600;
const DEFAULT_MIN_HEIGHT = 100;
const DEFAULT_MAX_HEIGHT = 400;

// Storage key prefix for persisting panel sizes
const STORAGE_KEY_PREFIX = 'ds-panel-size-';

// ============ COMPONENT ============

function ResizablePanel({
  position = 'left', // 'left' | 'right' | 'bottom'
  defaultSize,
  minSize,
  maxSize,
  collapsed = false,
  collapsible = true,
  onCollapse,
  onResize,
  storageKey,
  className = '',
  children,
}) {
  // Determine dimension based on position
  const isHorizontal = position === 'left' || position === 'right';
  const sizeProp = isHorizontal ? 'width' : 'height';

  // Defaults based on position
  const defaults = {
    size: defaultSize || (isHorizontal ? 280 : 150),
    min: minSize || (isHorizontal ? DEFAULT_MIN_WIDTH : DEFAULT_MIN_HEIGHT),
    max: maxSize || (isHorizontal ? DEFAULT_MAX_WIDTH : DEFAULT_MAX_HEIGHT),
  };

  // State - start with default, load from localStorage on mount
  const [size, setSize] = useState(defaults.size);
  const [isResizing, setIsResizing] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const panelRef = useRef(null);
  const startPosRef = useRef(0);
  const startSizeRef = useRef(0);

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    if (storageKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`${STORAGE_KEY_PREFIX}${storageKey}`);
      if (stored) {
        const parsed = parseInt(stored, 10);
        if (!isNaN(parsed) && parsed >= defaults.min && parsed <= defaults.max) {
          setSize(parsed);
        }
      }
    }
    setHydrated(true);
  }, [storageKey, defaults.min, defaults.max]);

  // Save size to localStorage when it changes
  useEffect(() => {
    if (hydrated && storageKey && !collapsed && typeof window !== 'undefined') {
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${storageKey}`, String(size));
    }
  }, [size, storageKey, collapsed, hydrated]);

  // Handle resize start
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    startPosRef.current = isHorizontal ? e.clientX : e.clientY;
    startSizeRef.current = size;

    // Add listeners to document for drag
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }, [isHorizontal, size]);

  // Handle resize move
  const handleResizeMove = useCallback((e) => {
    if (!isResizing) return;

    const currentPos = isHorizontal ? e.clientX : e.clientY;
    let delta = currentPos - startPosRef.current;

    // Invert delta for right and bottom panels
    if (position === 'right' || position === 'bottom') {
      delta = -delta;
    }

    const newSize = Math.min(defaults.max, Math.max(defaults.min, startSizeRef.current + delta));
    setSize(newSize);
    onResize?.(newSize);
  }, [isResizing, isHorizontal, position, defaults.min, defaults.max, onResize]);

  // Handle resize end
  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [handleResizeMove, handleResizeEnd]);

  // Handle collapse toggle
  const handleCollapseToggle = useCallback(() => {
    onCollapse?.(!collapsed);
  }, [collapsed, onCollapse]);

  // Keyboard handler for resize handle
  const handleKeyDown = useCallback((e) => {
    const step = e.shiftKey ? 50 : 10;
    let delta = 0;

    if (isHorizontal) {
      if (e.key === 'ArrowLeft') delta = position === 'left' ? -step : step;
      if (e.key === 'ArrowRight') delta = position === 'left' ? step : -step;
    } else {
      if (e.key === 'ArrowUp') delta = -step;
      if (e.key === 'ArrowDown') delta = step;
    }

    if (delta !== 0) {
      e.preventDefault();
      const newSize = Math.min(defaults.max, Math.max(defaults.min, size + delta));
      setSize(newSize);
      onResize?.(newSize);
    }
  }, [isHorizontal, position, size, defaults.min, defaults.max, onResize]);

  // Panel styles
  const panelStyle = {
    [sizeProp]: collapsed ? 0 : size,
    minWidth: isHorizontal ? (collapsed ? 0 : defaults.min) : undefined,
    maxWidth: isHorizontal ? (collapsed ? 0 : defaults.max) : undefined,
    minHeight: !isHorizontal ? (collapsed ? 0 : defaults.min) : undefined,
    maxHeight: !isHorizontal ? (collapsed ? 0 : defaults.max) : undefined,
  };

  // Handle position class
  const positionClass = `ds-resizable-panel-${position}`;

  return (
    <div
      ref={panelRef}
      className={`ds-resizable-panel ${positionClass} ${collapsed ? 'collapsed' : ''} ${isResizing ? 'resizing' : ''} ${className}`}
      style={panelStyle}
    >
      {/* Resize Handle */}
      {!collapsed && (
        <div
          className={`ds-resize-handle ds-resize-handle-${position}`}
          onMouseDown={handleResizeStart}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="separator"
          aria-orientation={isHorizontal ? 'vertical' : 'horizontal'}
          aria-valuenow={size}
          aria-valuemin={defaults.min}
          aria-valuemax={defaults.max}
          title={`Drag to resize (${size}px)`}
        >
          <div className="ds-resize-handle-indicator" />
        </div>
      )}

      {/* Panel Content */}
      <div className="ds-resizable-panel-content">
        {/* Collapse Button */}
        {collapsible && (
          <button
            className="ds-collapse-button"
            onClick={handleCollapseToggle}
            title={collapsed ? 'Expand panel' : 'Collapse panel'}
            aria-expanded={!collapsed}
          >
            <CollapseIcon position={position} collapsed={collapsed} />
          </button>
        )}

        {/* Children (hidden when collapsed) */}
        {!collapsed && children}
      </div>
    </div>
  );
}

// ============ COLLAPSE ICON ============

function CollapseIcon({ position, collapsed }) {
  // Determine arrow direction based on position and state
  let direction;
  if (position === 'left') {
    direction = collapsed ? 'right' : 'left';
  } else if (position === 'right') {
    direction = collapsed ? 'left' : 'right';
  } else {
    direction = collapsed ? 'up' : 'down';
  }

  const paths = {
    left: 'M15 18l-6-6 6-6',
    right: 'M9 18l6-6-6-6',
    up: 'M18 15l-6-6-6 6',
    down: 'M6 9l6 6 6-6',
  };

  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[direction]} />
    </svg>
  );
}

// ============ PANEL GROUP ============

/**
 * PanelGroup manages multiple resizable panels in a flex container
 */
export function PanelGroup({ children, direction = 'horizontal', className = '' }) {
  return (
    <div className={`ds-panel-group ds-panel-group-${direction} ${className}`}>
      {children}
    </div>
  );
}

// ============ HOOKS ============

/**
 * Hook to manage panel state
 */
export function usePanelState(panelId, initialCollapsed = false) {
  const storageKey = `ds-panel-collapsed-${panelId}`;
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // Load from localStorage after mount (SSR-safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(storageKey);
      if (stored === 'true') {
        setCollapsed(true);
      } else if (stored === 'false') {
        setCollapsed(false);
      }
    }
  }, [storageKey]);

  const toggleCollapsed = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(storageKey, String(next));
      }
      return next;
    });
  }, [storageKey]);

  const setCollapsedValue = useCallback((value) => {
    setCollapsed(value);
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, String(value));
    }
  }, [storageKey]);

  return {
    collapsed,
    toggleCollapsed,
    setCollapsed: setCollapsedValue,
  };
}

// ============ EXPORTS ============

export { ResizablePanel };
export default ResizablePanel;

// components/diagram-studio/DiagramCanvas.js
// Core canvas engine for DiagramStudio
// Handles rendering, pan/zoom, selection, drag, and connections

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  useDiagram,
  useDiagramSelection,
  useDiagramViewport,
  isMindMapElement,
  isCentralTopic,
  getMindMapChildType,
  getMindMapStencilSize,
  getMindMapStencilColor,
  buildMindMapHierarchy,
  getMindMapSubtree,
  countMindMapDescendants,
} from './DiagramContext';
import {
  applyLayoutConstraints,
  findContainingZone,
  getZones,
  isValidHierarchyConnection,
} from './LayoutEngine';
import Minimap from './Minimap';
import { SmartRouter } from './routing/SmartRouter';
import ConnectionToolbar from './ui/toolbar/ConnectionToolbar';
import EmptyCanvasWelcome from './ui/EmptyCanvasWelcome';

// Modular connection system (refactored 2025-12-28)
import { Connection, ConnectionMarkers, ArrowMarker } from './connections';
import CrossingIndicators from './connections/CrossingIndicators';
import { calculateMidLabelPosition } from './connections/geometry/labelPositioning';
import { calculateOrthogonalWaypoints, buildOrthogonalThroughWaypoints, buildOrthogonalPath } from './connections/geometry/orthogonalRouting';
import { buildStraightPath } from './connections/geometry/pathBuilders';

// Extracted hooks (refactored 2025-12-29)
import { useClipboard, useQuickCreate, useAlignmentGuides } from './hooks';
import { useCanvasInteractions } from './hooks/composite/useCanvasInteractions';

// Extracted utilities (refactored 2025-12-29)
import {
  // Constants
  GRID_SIZE,
  SNAP_THRESHOLD,
  MIN_ZOOM,
  MAX_ZOOM,
  INFINITE_CANVAS_SIZE,
  INFINITE_CANVAS_OFFSET,
  CANVAS_MIN,
  CANVAS_MAX,
  EDGE_PAN_ZONE,
  EDGE_PAN_SPEED,
  SNAP_TO_STRAIGHT_THRESHOLD,
  GUIDE_SNAP_THRESHOLD,
  // Geometry utilities
  snapToGrid,
  clampToCanvas,
  clampViewport,
  getPortDirection,
  detectBorderClick,
  lineIntersectsRect,
  // Port calculation
  getPortPosition,
  getOptimalPorts,
  shouldAutoUpdatePorts,
  getEffectivePorts,
  // Path generation
  getConnectionPath,
  getSmartPath,
  getCurvedPath,
  getOrthogonalPath,
  cleanupWaypoints,
  avoidObstacles,
  insertWaypointSorted,
  getDashArray,
  // Snapping
  calculateSnapGuides,
} from './utils';

// ============ HELPER FUNCTIONS ============
// (Pure geometry utilities moved to ./utils/)

// Find all elements that are inside a frame (based on bounding box containment)
function getElementsInsideFrame(frame, elements, packRegistry) {
  if (!frame || frame.type !== 'frame') return [];

  const pack = packRegistry?.get?.(frame.packId);
  const stencil = pack?.stencils?.find(s => s.id === frame.type);
  const frameSize = frame.size || stencil?.defaultSize || { width: 600, height: 400 };

  const frameLeft = frame.x;
  const frameTop = frame.y;
  const frameRight = frame.x + frameSize.width;
  const frameBottom = frame.y + frameSize.height;

  return elements.filter(el => {
    if (el.id === frame.id) return false; // Exclude the frame itself
    if (el.type === 'frame') return false; // Don't nest frames

    const elPack = packRegistry?.get?.(el.packId);
    const elStencil = elPack?.stencils?.find(s => s.id === el.type);
    const elSize = el.size || elStencil?.defaultSize || { width: 120, height: 60 };

    const elLeft = el.x;
    const elTop = el.y;
    const elRight = el.x + elSize.width;
    const elBottom = el.y + elSize.height;

    // Element is inside if its bounds are within the frame bounds
    return elLeft >= frameLeft && elTop >= frameTop &&
           elRight <= frameRight && elBottom <= frameBottom;
  });
}

// Get connections where both source and target are in the given element list
function getConnectionsInsideFrame(elementIds, connections) {
  const idSet = new Set(elementIds);
  return connections.filter(conn =>
    idSet.has(conn.sourceId) && idSet.has(conn.targetId)
  );
}

// Find a frame that contains both elements (for clipping connections to frame bounds)
function findCommonParentFrame(sourceEl, targetEl, elements, packRegistry) {
  // Find all frames
  const frames = elements.filter(el => el.type === 'frame');

  for (const frame of frames) {
    const elementsInFrame = getElementsInsideFrame(frame, elements, packRegistry);
    const elementIds = new Set(elementsInFrame.map(el => el.id));

    // Check if both source and target are in this frame
    if (elementIds.has(sourceEl.id) && elementIds.has(targetEl.id)) {
      return frame.id;
    }
  }

  return null;
}


// ============ ALIGNMENT TOOLBAR ============

function AlignmentToolbar({ selectedElements, onAlign, onDistribute, onMatchSize }) {
  if (selectedElements.length < 2) return null;

  return (
    <div className="ds-alignment-toolbar">
      {/* Horizontal Alignment */}
      <div className="ds-align-toolbar-group">
        <span className="ds-align-toolbar-label">Align</span>
        <div className="ds-align-toolbar-buttons">
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('left')}
            title="Align Left"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="2" height="14" />
              <rect x="5" y="3" width="8" height="4" />
              <rect x="5" y="9" width="6" height="4" />
            </svg>
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('center-h')}
            title="Align Center (Horizontal)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="7" y="1" width="2" height="14" />
              <rect x="3" y="3" width="10" height="4" />
              <rect x="4" y="9" width="8" height="4" />
            </svg>
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('right')}
            title="Align Right"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="13" y="1" width="2" height="14" />
              <rect x="3" y="3" width="8" height="4" />
              <rect x="5" y="9" width="6" height="4" />
            </svg>
          </button>
        </div>
      </div>

      <div className="ds-align-toolbar-divider" />

      {/* Vertical Alignment */}
      <div className="ds-align-toolbar-group">
        <div className="ds-align-toolbar-buttons">
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('top')}
            title="Align Top"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="1" width="14" height="2" />
              <rect x="3" y="5" width="4" height="8" />
              <rect x="9" y="5" width="4" height="6" />
            </svg>
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('center-v')}
            title="Align Middle (Vertical)"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="7" width="14" height="2" />
              <rect x="3" y="3" width="4" height="10" />
              <rect x="9" y="4" width="4" height="8" />
            </svg>
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onAlign('bottom')}
            title="Align Bottom"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="1" y="13" width="14" height="2" />
              <rect x="3" y="3" width="4" height="8" />
              <rect x="9" y="5" width="4" height="6" />
            </svg>
          </button>
        </div>
      </div>

      {selectedElements.length >= 3 && (
        <>
          <div className="ds-align-toolbar-divider" />

          {/* Distribute */}
          <div className="ds-align-toolbar-group">
            <span className="ds-align-toolbar-label">Distribute</span>
            <div className="ds-align-toolbar-buttons">
              <button
                className="ds-align-toolbar-btn"
                onClick={() => onDistribute('horizontal')}
                title="Distribute Horizontally"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="1" y="4" width="3" height="8" />
                  <rect x="6.5" y="4" width="3" height="8" />
                  <rect x="12" y="4" width="3" height="8" />
                </svg>
              </button>
              <button
                className="ds-align-toolbar-btn"
                onClick={() => onDistribute('vertical')}
                title="Distribute Vertically"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                  <rect x="4" y="1" width="8" height="3" />
                  <rect x="4" y="6.5" width="8" height="3" />
                  <rect x="4" y="12" width="8" height="3" />
                </svg>
              </button>
            </div>
          </div>
        </>
      )}

      <div className="ds-align-toolbar-divider" />

      {/* Match Size */}
      <div className="ds-align-toolbar-group">
        <span className="ds-align-toolbar-label">Size</span>
        <div className="ds-align-toolbar-buttons">
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onMatchSize('width')}
            title="Match Width"
          >
            ↔
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onMatchSize('height')}
            title="Match Height"
          >
            ↕
          </button>
          <button
            className="ds-align-toolbar-btn"
            onClick={() => onMatchSize('both')}
            title="Match Both"
          >
            ⬚
          </button>
        </div>
      </div>
    </div>
  );
}
// ============ NODE COMPONENT ============

function Node({
  element,
  isSelected,
  isDragging,
  onSelect,
  onDragStart,
  onConnectStart,
  onConnectEnd,
  onLabelChange,
  onQuickCreate,
  packRegistry,
  readOnly,
  renderNode,
  isConnectMode,
  isConnecting,
  isEditingLabel,
  onEditingLabelDone,
  onShowProperties,
  activePack,
  hasConnections, // Whether this element already has connections
  commentMode, // Whether comment mode is active
}) {
  const pack = packRegistry?.get?.(element.packId);
  const stencil = pack?.stencils?.find(s => s.id === element.type);
  const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };
  const [isHovered, setIsHovered] = useState(false);
  const [hoveredHandle, setHoveredHandle] = useState(null); // Track which connection handle is hovered
  const [localLabel, setLocalLabel] = useState(element.label || element.name || '');
  const inputRef = useRef(null);
  const hoverTimeoutRef = useRef(null); // For debouncing handle hover

  // Check if this element type supports connections (frames don't)
  const supportsConnections = !stencil?.noConnections && element.type !== 'frame';

  // Cleanup hover timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // Stable hover handlers with debounce for handle hover
  const handleHandleMouseEnter = useCallback((direction) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredHandle(direction);
  }, []);

  const handleHandleMouseLeave = useCallback(() => {
    // Small delay before clearing hover to prevent flicker
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredHandle(null);
    }, 50);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingLabel && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingLabel]);

  // Update local label when element changes
  useEffect(() => {
    setLocalLabel(element.label || element.name || '');
  }, [element.label, element.name]);

  const handleMouseDown = (e) => {
    if (readOnly || isEditingLabel) return;

    // In comment mode, let the click bubble to the canvas handler
    // which will handle placing a comment on this node
    if (commentMode) {
      return;
    }

    // Check if clicking on a resize handle - let it bubble to canvas for resize handling
    if (e.target.closest('.ds-resize-handle')) {
      return;
    }

    // Check if clicking on a rotation handle - let it bubble to canvas for rotation handling
    if (e.target.closest('.ds-rotation-handle')) {
      return;
    }

    // Check if clicking on a connection handle - start connection immediately
    const handleEl = e.target.closest('.ds-edge-handle');
    if (handleEl && supportsConnections) {
      e.stopPropagation();
      const portId = handleEl.dataset.port;
      // Start connection from this specific port
      onConnectStart?.(element, e, portId);
      return;
    }

    // For frames: only select/drag when clicking on the border area (not interior)
    // This allows elements inside the frame to be clicked instead
    const isFrame = element.type === 'frame' || element.isFrame;
    if (isFrame && !isSelected) {
      const rect = e.currentTarget.getBoundingClientRect();
      const borderWidth = 20; // Clickable border area in pixels
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const isOnBorder = x < borderWidth || x > rect.width - borderWidth ||
                         y < borderWidth || y > rect.height - borderWidth;

      // If clicking in the interior of the frame, let event bubble to elements above
      if (!isOnBorder) {
        return; // Don't stop propagation, let elements above handle the click
      }
    }

    // Detect if clicking on the border to start a connection from that exact position
    // ONLY in Connect mode - in Select mode, border clicks should select/drag the element
    if (isConnectMode && supportsConnections && !isConnecting) {
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      // Check if click is on the border (outer 12px)
      const borderThreshold = 12;
      const isOnTop = localY < borderThreshold;
      const isOnBottom = localY > rect.height - borderThreshold;
      const isOnLeft = localX < borderThreshold;
      const isOnRight = localX > rect.width - borderThreshold;

      if (isOnTop || isOnBottom || isOnLeft || isOnRight) {
        e.stopPropagation();
        // Determine which edge and the exact position
        let edge, ratio;
        if (isOnTop) {
          edge = 'top';
          ratio = localX / rect.width;
        } else if (isOnBottom) {
          edge = 'bottom';
          ratio = localX / rect.width;
        } else if (isOnLeft) {
          edge = 'left';
          ratio = localY / rect.height;
        } else {
          edge = 'right';
          ratio = localY / rect.height;
        }
        // Start connection from this border position
        onConnectStart?.(element, e, edge, ratio);
        return;
      }
    }

    e.stopPropagation();

    // In connect mode, start a connection from nearest border (Miro-like behavior)
    if (isConnectMode && !isConnecting && supportsConnections) {
      const rect = e.currentTarget.getBoundingClientRect();
      const localX = e.clientX - rect.left;
      const localY = e.clientY - rect.top;

      // Find nearest edge and ratio
      const distTop = localY;
      const distBottom = rect.height - localY;
      const distLeft = localX;
      const distRight = rect.width - localX;

      const minDist = Math.min(distTop, distBottom, distLeft, distRight);
      let edge, ratio;

      if (minDist === distTop) {
        edge = 'top';
        ratio = localX / rect.width;
      } else if (minDist === distBottom) {
        edge = 'bottom';
        ratio = localX / rect.width;
      } else if (minDist === distLeft) {
        edge = 'left';
        ratio = localY / rect.height;
      } else {
        edge = 'right';
        ratio = localY / rect.height;
      }

      onConnectStart?.(element, e, edge, ratio);
      return;
    }

    onSelect?.(element.id);
    onDragStart?.(e, element);
  };

  const handleMouseUp = (e) => {
    // Complete connection if in connecting state
    if (isConnecting) {
      e.stopPropagation();
      e.preventDefault();
      onConnectEnd?.(element, e);
    }
  };

  const handleClick = (e) => {
    // In comment mode, don't handle clicks on nodes
    if (commentMode) return;

    // Don't select if clicking a handle
    if (e.target.closest('.ds-edge-handle')) return;

    // For frames: only select when clicking on the border area (not interior)
    const isFrame = element.type === 'frame' || element.isFrame;
    if (isFrame && !isSelected) {
      const rect = e.currentTarget.getBoundingClientRect();
      const borderWidth = 20;
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const isOnBorder = x < borderWidth || x > rect.width - borderWidth ||
                         y < borderWidth || y > rect.height - borderWidth;
      if (!isOnBorder) {
        return; // Let click pass through to elements above
      }
    }

    e.stopPropagation();
    if (!isConnectMode && !isEditingLabel) {
      onSelect?.(element.id, e.shiftKey);
    }
  };

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (!readOnly && !isConnectMode) {
      // Double-click enters label editing mode
      onEditingLabelDone?.(element.id, true);
    }
  };

  const handleLabelKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      onLabelChange?.(element.id, localLabel);
      onEditingLabelDone?.(element.id, false);
    } else if (e.key === 'Escape') {
      setLocalLabel(element.label || element.name || '');
      onEditingLabelDone?.(element.id, false);
    }
  };

  const handleLabelBlur = () => {
    onLabelChange?.(element.id, localLabel);
    onEditingLabelDone?.(element.id, false);
  };

  // Helper to calculate relative luminance and determine if color is light or dark
  const getContrastTextColor = (hexColor) => {
    if (!hexColor || typeof hexColor !== 'string') return '#1f2937'; // Default dark text

    // Handle hex colors (with or without #)
    let hex = hexColor.replace('#', '');

    // Handle shorthand hex (e.g., #fff -> #ffffff)
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }

    // Handle rgba/rgb - extract just the RGB values
    if (hexColor.startsWith('rgb')) {
      const match = hexColor.match(/\d+/g);
      if (match && match.length >= 3) {
        const [r, g, b] = match.map(Number);
        // Calculate relative luminance using sRGB formula
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        return luminance > 0.5 ? '#1f2937' : '#ffffff';
      }
      return '#1f2937';
    }

    if (hex.length !== 6) return '#1f2937'; // Invalid, default to dark

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate relative luminance using sRGB formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Return dark text for light backgrounds, light text for dark backgrounds
    return luminance > 0.5 ? '#1f2937' : '#ffffff';
  };

  // Default node rendering
  const shape = stencil?.shape || 'rect';
  const color = element.color || stencil?.color || '#3b82f6';
  const fontSize = element.fontSize || 13;
  const fontWeight = element.fontWeight || 'normal';
  const textAlign = element.textAlign || 'center';
  const verticalAlign = element.verticalAlign || 'center';
  const fontFamily = element.fontFamily || null; // null means system default

  // Auto-calculate text color based on background if not explicitly set
  const backgroundColor = element.backgroundColor || element.color || stencil?.color || '#ffffff';
  const textColor = element.textColor || getContrastTextColor(backgroundColor);

  // Border and shape properties
  const borderStyle = element.borderStyle || 'solid';
  const borderWidth = element.borderWidth ?? 2;
  // Circle shapes should have 50% border-radius (use 999 as magic value)
  const borderRadius = element.borderRadius ?? (shape === 'circle' ? 999 : 8);
  const borderColor = element.borderColor || color;
  const showShadow = element.showShadow ?? true;
  const showAccentBar = element.showAccentBar || false;
  const bgOpacity = element.opacity ?? 1;

  // Map vertical align to flexbox
  const justifyMap = { 'top': 'flex-start', 'flex-start': 'flex-start', 'center': 'center', 'middle': 'center', 'bottom': 'flex-end', 'flex-end': 'flex-end' };
  const justifyContent = justifyMap[verticalAlign] || 'center';

  // Show edge handles on hover (for creating connections) - NOT tied to selection
  // In connect mode, the whole border is clickable so we don't need specific handles
  // Just show handles when hovering (outside connect mode) or when actively connecting
  const showEdgeHandles = !readOnly && supportsConnections && !isConnectMode &&
    (isConnecting || isHovered);

  // Show quick-create only when a specific handle is hovered and not connecting
  const showQuickCreate = !readOnly && hoveredHandle && !isConnecting && !isConnectMode && !isEditingLabel;

  const labelContent = isEditingLabel ? (
    <input
      ref={inputRef}
      type="text"
      className="ds-node-label-input"
      value={localLabel}
      onChange={(e) => setLocalLabel(e.target.value)}
      onKeyDown={handleLabelKeyDown}
      onBlur={handleLabelBlur}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        fontSize,
        fontWeight,
        fontFamily: fontFamily || 'inherit',
        textAlign,
        color: textColor,
        width: '100%',
        border: 'none',
        background: 'transparent',
        outline: 'none',
        padding: '2px 4px',
        caretColor: 'var(--accent, #3b82f6)',
      }}
    />
  ) : (
    <span
      className="ds-node-label"
      style={{ fontSize, fontWeight, fontFamily: fontFamily || 'inherit', textAlign, color: textColor }}
    >
      {element.label || element.name || 'Untitled'}
    </span>
  );

  // Check if using custom renderer - must actually return content, not just exist
  const customContent = pack?.renderNode?.(element, stencil, isSelected) || renderNode?.(element, stencil, isSelected);
  const hasCustomRenderer = customContent !== undefined && customContent !== null;

  // Determine if this node is a valid drop target for connection (not the source)
  const isConnectionTarget = isConnecting && supportsConnections;

  return (
    <div
      className={`ds-node ds-node-${shape} ${isSelected ? 'selected' : ''} ${isDragging ? 'dragging' : ''} ${isConnectMode ? 'connect-mode' : ''} ${isConnectionTarget ? 'connect-target' : ''} ${hasCustomRenderer ? 'ds-node-custom-render' : ''} ${element.locked ? 'locked' : ''}`}
      data-node-id={element.id}
      data-type={element.type}
      style={{
        left: element.x,
        top: element.y,
        width: size.width,
        height: size.height,
        // Note: opacity is handled by StyledRectRenderer to only affect background
        zIndex: (element.zIndex || 0) + 5, // Base z-index of 5, above grid (0) and connections (2)
        transform: [
          element.scaleX !== undefined && element.scaleX !== 1 ? `scaleX(${element.scaleX})` : '',
          element.scaleY !== undefined && element.scaleY !== 1 ? `scaleY(${element.scaleY})` : '',
          // Always include rotate to override any CSS transform rules
          `rotate(${element.rotation || 0}deg)`,
        ].filter(Boolean).join(' '),
        transformOrigin: 'center center',
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Accent Bar (left border accent) */}
      {showAccentBar && !hasCustomRenderer && (
        <div
          className="ds-node-accent-bar"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: color,
            borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`,
            zIndex: 1,
          }}
        />
      )}
      <div
        className="ds-node-content"
        style={hasCustomRenderer ? {
          // Custom renderer handles its own styling - no background/border
          background: 'transparent',
          border: 'none',
          padding: 0,
        } : {
          borderColor: isSelected ? 'var(--accent)' : borderColor,
          borderStyle: borderStyle === 'none' ? 'solid' : borderStyle,
          borderWidth: borderStyle === 'none' ? 0 : borderWidth,
          borderRadius: borderRadius >= 999 ? '50%' : borderRadius,
          backgroundColor: bgOpacity < 1
            ? `rgba(255, 255, 255, ${bgOpacity})`
            : (element.backgroundColor || element.color || 'var(--panel)'),
          boxShadow: showShadow
            ? `0 2px 8px rgba(0, 0, 0, 0.08), 0 4px 16px rgba(0, 0, 0, 0.04)`
            : 'none',
          justifyContent: justifyContent,
          paddingLeft: showAccentBar ? 16 : undefined,
        }}
      >
        {/* Use pack's custom renderer if available and returns content */}
        {customContent ||
         (shape === 'diamond' ? (
          <div className="ds-node-inner">
            {labelContent}
          </div>
        ) : (
          labelContent
        ))}
        {/* Editing overlay for custom rendered nodes */}
        {isEditingLabel && hasCustomRenderer && (
          <div
            className="ds-node-edit-overlay"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.95)',
              borderRadius: 6,
              padding: 8,
              zIndex: 10,
            }}
          >
            <input
              ref={inputRef}
              type="text"
              className="ds-node-label-input"
              value={localLabel}
              onChange={(e) => setLocalLabel(e.target.value)}
              onKeyDown={handleLabelKeyDown}
              onBlur={handleLabelBlur}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              style={{
                fontSize: 14,
                fontWeight: 500,
                textAlign: 'center',
                width: '90%',
                border: '1px solid var(--border)',
                background: 'white',
                outline: '2px solid var(--accent)',
                borderRadius: 4,
                padding: '6px 8px',
              }}
            />
          </div>
        )}
      </div>

      {/* Edge Connection Handles - appear on hover, draggable to create connections */}
      {showEdgeHandles && (
        <>
          {['right', 'bottom', 'left', 'top'].map(direction => {
            const isHandleHovered = hoveredHandle === direction;
            return (
              <div
                key={direction}
                className={`ds-edge-handle ds-edge-handle-${direction} ${isHandleHovered ? 'hovered' : ''}`}
                data-port={direction}
                data-element-id={element.id}
                onMouseEnter={() => handleHandleMouseEnter(direction)}
                onMouseLeave={handleHandleMouseLeave}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();

                  // Track start position to differentiate click from drag
                  const startX = e.clientX;
                  const startY = e.clientY;
                  let hasMoved = false;

                  const handleMouseMove = (moveEvent) => {
                    const dx = Math.abs(moveEvent.clientX - startX);
                    const dy = Math.abs(moveEvent.clientY - startY);
                    if (dx > 5 || dy > 5) {
                      hasMoved = true;
                      // Start connection on drag
                      onConnectStart?.(element, e, direction, 0.5);
                      // Clean up listeners
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                    }
                  };

                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);

                    if (!hasMoved && !readOnly) {
                      // Click without drag = quick-create
                      onQuickCreate?.(element, direction);
                    }
                  };

                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              >
                {/* Inner dot - + icon shown via CSS on hover */}
                <div className="ds-edge-handle-dot" />
              </div>
            );
          })}
        </>
      )}

      {/* Legacy ports for drop targets when connecting */}
      {isConnecting && renderPorts(element, stencil)}

      {/* Resize handles - only when selected and not locked */}
      {isSelected && !readOnly && !isConnectMode && !isConnecting && !element.locked && (
        <>
          <div className="ds-resize-handle ds-resize-e" data-resize="e" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-s" data-resize="s" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-se" data-resize="se" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-w" data-resize="w" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-n" data-resize="n" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-nw" data-resize="nw" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-ne" data-resize="ne" data-element-id={element.id} />
          <div className="ds-resize-handle ds-resize-sw" data-resize="sw" data-element-id={element.id} />
          {/* Rotation handle - positioned above the element */}
          <div
            className="ds-rotation-handle"
            data-rotate="true"
            data-element-id={element.id}
            title="Drag to rotate (Shift for 15° snap)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
            </svg>
          </div>
        </>
      )}
    </div>
  );
}

function renderPorts(element, stencil) {
  const ports = stencil?.ports || ['top', 'bottom', 'left', 'right'];

  return ports.map(port => {
    const portId = typeof port === 'object' ? port.id : port;
    return (
      <div
        key={portId}
        className={`ds-port ds-port-${portId}`}
        data-port={portId}
        data-element-id={element.id}
      />
    );
  });
}

// ============ GRID COMPONENT ============
// Supports multiple grid styles: dots, lines, lines-wide, or none

function Grid({ showGrid, gridStyle = 'dots', viewport }) {
  if (!showGrid) return null;

  // Adaptive grid density based on zoom
  const scale = viewport?.scale || 1;
  const gridMultiplier = scale < 0.3 ? 4 : scale < 0.5 ? 2 : 1;

  // Base grid size depends on style
  const baseGridSize = gridStyle === 'lines-wide' ? GRID_SIZE * 2 : GRID_SIZE; // 40px for wide, 20px for normal
  const effectiveGridSize = baseGridSize * gridMultiplier;
  const majorGridSize = effectiveGridSize * 5;
  const dotRadius = Math.max(0.5, 1 / scale);
  const lineWidth = Math.max(0.5, 0.5 / scale);

  // Render based on grid style
  if (gridStyle === 'lines' || gridStyle === 'lines-wide') {
    // Get CSS variable values for grid colors
    const gridLineColor = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim() || '#e2e8f0'
      : '#e2e8f0';
    const gridLineMajorColor = typeof window !== 'undefined'
      ? getComputedStyle(document.documentElement).getPropertyValue('--grid-line-major').trim() || '#cbd5e1'
      : '#cbd5e1';

    return (
      <svg className="ds-grid" width="100%" height="100%">
        <defs>
          {/* Minor grid - thin lines */}
          <pattern
            id="ds-grid-lines-minor"
            width={effectiveGridSize}
            height={effectiveGridSize}
            patternUnits="userSpaceOnUse"
          >
            {/* Vertical line */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={effectiveGridSize}
              stroke={gridLineColor}
              strokeWidth={1}
            />
            {/* Horizontal line */}
            <line
              x1="0"
              y1="0"
              x2={effectiveGridSize}
              y2="0"
              stroke={gridLineColor}
              strokeWidth={1}
            />
          </pattern>
          {/* Major grid - stronger lines every 5 cells */}
          <pattern
            id="ds-grid-lines-major"
            width={majorGridSize}
            height={majorGridSize}
            patternUnits="userSpaceOnUse"
          >
            <rect width={majorGridSize} height={majorGridSize} fill="url(#ds-grid-lines-minor)" />
            {/* Major vertical line */}
            <line
              x1="0"
              y1="0"
              x2="0"
              y2={majorGridSize}
              stroke={gridLineMajorColor}
              strokeWidth={1}
            />
            {/* Major horizontal line */}
            <line
              x1="0"
              y1="0"
              x2={majorGridSize}
              y2="0"
              stroke={gridLineMajorColor}
              strokeWidth={1}
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#ds-grid-lines-major)" />
      </svg>
    );
  }

  // Default: dots style
  const dotColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#64748b'
    : '#64748b';

  return (
    <svg className="ds-grid" width="100%" height="100%">
      <defs>
        {/* Minor grid - subtle dots at each grid intersection */}
        <pattern
          id="ds-grid-dots"
          width={effectiveGridSize}
          height={effectiveGridSize}
          patternUnits="userSpaceOnUse"
        >
          <circle
            cx={0}
            cy={0}
            r={dotRadius * 1.2}
            fill={dotColor}
            opacity="0.25"
          />
        </pattern>
        {/* Major grid - stronger dots every 5 cells */}
        <pattern
          id="ds-grid-major"
          width={majorGridSize}
          height={majorGridSize}
          patternUnits="userSpaceOnUse"
        >
          <rect width={majorGridSize} height={majorGridSize} fill="url(#ds-grid-dots)" />
          <circle
            cx={0}
            cy={0}
            r={dotRadius * 2}
            fill={dotColor}
            opacity="0.5"
          />
        </pattern>
        {/* Origin crosshair */}
        <pattern id="ds-origin" width={INFINITE_CANVAS_SIZE} height={INFINITE_CANVAS_SIZE} patternUnits="userSpaceOnUse">
          <rect width="100%" height="100%" fill="url(#ds-grid-major)" />
          {/* Vertical center line */}
          <line
            x1={INFINITE_CANVAS_OFFSET}
            y1="0"
            x2={INFINITE_CANVAS_OFFSET}
            y2={INFINITE_CANVAS_SIZE}
            stroke="var(--accent, #0e74a3)"
            strokeWidth="1"
            opacity="0.15"
          />
          {/* Horizontal center line */}
          <line
            x1="0"
            y1={INFINITE_CANVAS_OFFSET}
            x2={INFINITE_CANVAS_SIZE}
            y2={INFINITE_CANVAS_OFFSET}
            stroke="var(--accent, #0e74a3)"
            strokeWidth="1"
            opacity="0.15"
          />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#ds-origin)" />
    </svg>
  );
}

// ============ MAIN CANVAS COMPONENT ============

export default function DiagramCanvas({
  packRegistry,
  renderNode,
  profile,
  onContextMenu,
  draggingStencil,
  onDragEnd,
  onCanvasClick,
  commentMode = false,
  className = '',
  onDragStart,
  onShowProperties,
  onShowToolbar,
  editLabelRequest,
  onOpenStencilPanel,
  onOpenTemplates,
  onShowShortcuts,
}) {
  const containerRef = useRef(null);
  const canvasRef = useRef(null);

  // Context
  const {
    diagram,
    elements,
    connections,
    showGrid,
    gridStyle,
    activeTool,
    setActiveTool,
    activePack,
    setElements,
    addElement,
    updateElement,
    removeElement,
    addConnection,
    updateConnection,
    removeConnection,
    recordHistory,
    layers,
    groups,
    groupElements,
    ungroupElements,
    selectedStencil,
    setSelectedStencil,
    stickyNoteColor,
    lastLineStyle,
    setIsDragging,
    setIsRotating,
  } = useDiagram();

  // Get layout settings from diagram
  const layoutSettings = diagram?.settings || {};

  const { viewport, setViewport, pan, zoomToFitAll, resetZoom } = useDiagramViewport();
  const {
    selection,
    selectElement,
    selectElements,
    toggleElementSelection,
    selectAll,
    selectConnection,
    clearSelection,
    isElementSelected,
    isConnectionSelected,
  } = useDiagramSelection();

  // Clipboard operations (extracted hook)
  const {
    copy: clipboardCopy,
    paste: clipboardPaste,
    duplicate: clipboardDuplicate,
    canPaste: clipboardCanPaste,
  } = useClipboard({
    elements,
    connections,
    selection,
    addElement,
    addConnection,
    selectElements,
    recordHistory,
  });

  // Quick create operations (extracted hook)
  const {
    quickCreate: hookQuickCreate,
    quickCreateWithType,
  } = useQuickCreate({
    elements,
    addElement,
    addConnection,
    selectElement,
    recordHistory,
    packRegistry,
    readOnly: false,
  });

  // Alignment guides (extracted hook)
  const {
    guides: snapGuides,
    calculateGuides: calculateAlignmentGuides,
    setGuides: setSnapGuides,
    clearGuides: clearSnapGuides,
  } = useAlignmentGuides({
    elements,
    packRegistry,
  });

  // Profile settings - extracted early for use in hooks
  const readOnly = profile?.editingPolicy?.readOnly || false;
  const canMove = profile?.editingPolicy?.canMove !== false;
  const canConnect = profile?.editingPolicy?.canConnect !== false;

  // Canvas interactions composite hook (orchestrates drag, connection, viewport systems)
  // NOTE: Hook is initialized but NOT used to replace local state - used only for specific operations
  // The hook provides additional functionality without breaking existing state management
  const canvasInteractions = useCanvasInteractions({
    elements,
    connections,
    selection,
    viewport,
    setViewport,
    addElement,
    updateElement,
    removeElements: removeElement,
    addConnection,
    updateConnection,
    removeConnections: removeConnection,
    selectElement,
    selectConnection,
    clearSelection,
    recordHistory,
    containerRef,
    packRegistry,
    activeTool,
    readOnly,
    canMove,
    canvasBounds: { min: CANVAS_MIN, max: CANVAS_MAX },
  });

  // Local state
  const [draggingElement, setDraggingElement] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragStartPositions, setDragStartPositions] = useState({}); // For multi-select drag

  // Refs for immediate access during drag (avoids React state batching delay)
  const draggingElementRef = useRef(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const dragStartPositionsRef = useRef({});
  const rafRef = useRef(null); // For requestAnimationFrame throttling during drag
  const pendingDragUpdateRef = useRef(null); // Store pending position for RAF batching
  const edgePanRef = useRef(null); // For edge-pan animation during drag
  const lastMouseClientPos = useRef({ x: 0, y: 0 }); // Track mouse position in client coords for edge-pan
  const dragStartedRef = useRef(false); // Track if actual drag movement has started (vs just mousedown)
  const viewportRef = useRef(viewport); // Keep ref updated with latest viewport for closures

  // Keep viewportRef in sync with viewport - update synchronously during render
  // This ensures the ref is ALWAYS up-to-date when event handlers read it
  viewportRef.current = viewport;

  // Smooth follow effect refs - uses direct DOM manipulation to avoid React re-renders
  const targetPosRef = useRef({ x: 0, y: 0 }); // Where the mouse wants the element (absolute)
  const currentPosRef = useRef({ x: 0, y: 0 }); // Current interpolated position (absolute)
  const dragStartElementPosRef = useRef({ x: 0, y: 0 }); // Original element position when drag started
  const alignmentSnappedRef = useRef({ x: false, y: false }); // Tracks if position was snapped via alignment guide

  // Refs to store immediate handlers for proper cleanup (same function reference needed for removeEventListener)
  const immediateMouseMoveRef = useRef(null);
  const immediateMouseUpRef = useRef(null);

  // Cleanup immediate event listeners on unmount
  useEffect(() => {
    return () => {
      if (immediateMouseMoveRef.current) {
        document.removeEventListener('mousemove', immediateMouseMoveRef.current);
      }
      if (immediateMouseUpRef.current) {
        document.removeEventListener('mouseup', immediateMouseUpRef.current);
      }
    };
  }, []);

  const velocityRef = useRef({ x: 0, y: 0 }); // For momentum on release
  const lastMousePosRef = useRef({ x: 0, y: 0 }); // For velocity calculation
  const lastUpdateTimeRef = useRef(0);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [connectMousePos, setConnectMousePos] = useState(null);
  // Infinite canvas - no fixed size limit
  const [contextMenu, setContextMenu] = useState(null);
  const [showConnectionToolbar, setShowConnectionToolbar] = useState(false); // Show connection toolbar on right-click
  const [hoveredElement, setHoveredElement] = useState(null);
  const [editingLabelId, setEditingLabelId] = useState(null);
  const [editingConnectionId, setEditingConnectionId] = useState(null);
  const [hoveredConnectionId, setHoveredConnectionId] = useState(null);
  const [draggingWaypoint, setDraggingWaypoint] = useState(null); // { connectionId, waypointIndex }
  const [draggingSegment, setDraggingSegment] = useState(null); // { connectionId, segmentIndex, isHorizontal, startMousePos }
  const draggingSegmentRef = useRef(null); // Ref for document-level handler access
  const [draggingEndpoint, setDraggingEndpoint] = useState(null); // { connectionId, endpoint: 'source' | 'target', previewPos: {x, y} }
  const draggingEndpointRef = useRef(null); // Ref for document-level handler access
  const [draggingCurve, setDraggingCurve] = useState(null); // { connectionId, sourcePos, targetPos }
  const draggingCurveRef = useRef(null); // Ref for document-level handler access
  // Marquee selection state
  const [marquee, setMarquee] = useState(null); // { startX, startY, currentX, currentY }
  const [resizing, setResizing] = useState(null); // { elementId, direction, startX, startY, startSize, startPos }
  const [rotating, setRotating] = useState(null); // { elementId, centerX, centerY, startAngle, startRotation }
  const [rotationIndicator, setRotationIndicator] = useState(null); // { x, y, angle } for showing angle during drag
  const [floatingHandlePos, setFloatingHandlePos] = useState(null); // { x, y } for floating rotation handle
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  // Draw-to-size state
  const [drawing, setDrawing] = useState(null); // { startX, startY, currentX, currentY }
  // Mouse position for coordinates display
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Handle edit label request from external (e.g., toolbar)
  useEffect(() => {
    if (editLabelRequest?.id) {
      setEditingLabelId(editLabelRequest.id);
    }
  }, [editLabelRequest]);

  // Clear connection toolbar when connection selection changes
  useEffect(() => {
    // Only clear if no connections are selected
    if (!selection?.connectionIds?.length) {
      setShowConnectionToolbar(false);
    }
  }, [selection?.connectionIds]);

  // Keep refs in sync with state for document-level handler access
  // Sync during render (not in useEffect) to ensure refs are never stale in handlers
  draggingCurveRef.current = draggingCurve;
  draggingSegmentRef.current = draggingSegment;
  draggingEndpointRef.current = draggingEndpoint;

  const currentDragOffset = draggingElement
    ? {
        x: currentPosRef.current.x - dragStartElementPosRef.current.x,
        y: currentPosRef.current.y - dragStartElementPosRef.current.y,
      }
    : null;
  const dragIds = useMemo(() => {
    if (!draggingElement) return new Set();
    const ids = Object.keys(dragStartPositions || {});
    return new Set(ids.length > 0 ? ids : [draggingElement]);
  }, [draggingElement, dragStartPositions]);
  const dragState = draggingElement && currentDragOffset
    ? { ids: dragIds, offset: currentDragOffset }
    : null;

  // ============ MIND MAP COLLAPSE VISIBILITY ============
  // Calculate which elements should be hidden due to collapsed ancestors
  const { visibleElements, hiddenElementIds, visibleConnections } = useMemo(() => {
    // Build hierarchy for mind map elements
    const hierarchy = buildMindMapHierarchy(elements, connections);

    // Find all elements that are descendants of collapsed nodes
    const hiddenIds = new Set();
    const collapsedCounts = {}; // Track child count for collapsed nodes

    elements.forEach(el => {
      if (isMindMapElement(el) && el.collapsed) {
        // Get all descendants of this collapsed node
        const descendants = getMindMapSubtree(el.id, hierarchy.childrenMap);
        // Count descendants (excluding the node itself)
        collapsedCounts[el.id] = descendants.length - 1;
        // Add all descendants (except the collapsed node itself) to hidden set
        descendants.forEach(id => {
          if (id !== el.id) {
            hiddenIds.add(id);
          }
        });
      }
    });

    // Filter elements to only show visible ones, and add collapsed count
    // Also exclude drawing elements - they're rendered by DrawingLayer.js
    const visible = elements
      .filter(el => !hiddenIds.has(el.id))
      .filter(el => !el.type?.startsWith('drawing-')) // Drawing strokes are rendered separately
      .map(el => {
        // Add collapsedChildCount to collapsed elements
        if (el.collapsed && collapsedCounts[el.id] !== undefined) {
          return { ...el, collapsedChildCount: collapsedCounts[el.id] };
        }
        return el;
      });

    // Filter connections - hide if either end is hidden
    const visibleConns = connections.filter(conn => {
      return !hiddenIds.has(conn.sourceId) && !hiddenIds.has(conn.targetId);
    });

    return {
      visibleElements: visible,
      hiddenElementIds: hiddenIds,
      visibleConnections: visibleConns,
    };
  }, [elements, connections]);

  // Calculate floating rotation handle position for selected element
  useEffect(() => {
    // Only show floating handle when exactly one element is selected, not rotating, and not read-only
    if (selection.nodeIds.length !== 1 || rotating || readOnly) {
      setFloatingHandlePos(null);
      return;
    }

    const selectedId = selection.nodeIds[0];
    const element = elements.find(el => el.id === selectedId);
    if (!element || element.locked) {
      setFloatingHandlePos(null);
      return;
    }

    // Get element size
    const pack = packRegistry?.get?.(element.packId);
    const stencil = pack?.stencils?.find(s => s.id === element.type);
    const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

    // Calculate screen position
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      setFloatingHandlePos(null);
      return;
    }

    // Element position in screen coordinates
    const screenX = rect.left + (element.x + size.width / 2 + viewport.x) * viewport.scale;
    const screenY = rect.top + (element.y + size.height + viewport.y) * viewport.scale + 40; // 40px below element

    setFloatingHandlePos({ x: screenX, y: screenY, elementId: selectedId });
  }, [selection.nodeIds, elements, viewport, rotating, readOnly, packRegistry]);

  // Infinite canvas - no bounds calculation needed

  // ============ SMOOTH FOLLOW DRAG SYSTEM ============
  // Professional-grade drag with smooth interpolation for a polished feel

  // Lerp function for smooth interpolation
  const lerp = (start, end, factor) => start + (end - start) * factor;

  // Helper to build transform string including rotation/scale for an element
  const buildElementTransform = useCallback((element, translateX = 0, translateY = 0) => {
    const parts = [];
    if (translateX !== 0 || translateY !== 0) {
      parts.push(`translate(${translateX}px, ${translateY}px)`);
    }
    if (element?.scaleX !== undefined && element.scaleX !== 1) {
      parts.push(`scaleX(${element.scaleX})`);
    }
    if (element?.scaleY !== undefined && element.scaleY !== 1) {
      parts.push(`scaleY(${element.scaleY})`);
    }
    // Always include rotation to maintain consistency with React render
    parts.push(`rotate(${element?.rotation || 0}deg)`);
    return parts.join(' ');
  }, []);

  // Direct DOM update for drag - applies CSS transform without React re-renders
  // This is the approach used by professional tools like Figma for instant response
  const updateDragTransform = useCallback((offsetX, offsetY) => {
    const currentDraggingId = draggingElementRef.current;
    if (!currentDraggingId) return;

    const startPositions = dragStartPositionsRef.current;

    // Apply CSS transform directly to DOM elements, preserving rotation/scale
    if (Object.keys(startPositions).length > 0) {
      // Multi-element drag
      Object.keys(startPositions).forEach(id => {
        const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
        if (nodeEl) {
          const element = elements.find(el => el.id === id);
          nodeEl.style.transform = buildElementTransform(element, offsetX, offsetY);
          nodeEl.style.zIndex = '1000';
        }
      });
    } else {
      // Single element drag
      const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${currentDraggingId}"]`);
      if (nodeEl) {
        const element = elements.find(el => el.id === currentDraggingId);
        nodeEl.style.transform = buildElementTransform(element, offsetX, offsetY);
        nodeEl.style.zIndex = '1000';
      }
    }
  }, [elements, buildElementTransform]);

  // Clear drag transforms from DOM and restore proper z-index and rotation/scale
  const clearDragTransforms = useCallback(() => {
    const currentDraggingId = draggingElementRef.current;
    if (!currentDraggingId) return;

    const startPositions = dragStartPositionsRef.current;

    // Helper to restore element's proper transform (rotation/scale only, no translate) and z-index
    const restoreElement = (nodeEl, elementId) => {
      const element = elements.find(el => el.id === elementId);
      const properZIndex = (element?.zIndex || 0) + 5;
      // Restore rotation/scale transforms (without translate)
      nodeEl.style.transform = buildElementTransform(element, 0, 0);
      nodeEl.style.zIndex = String(properZIndex);
    };

    if (Object.keys(startPositions).length > 0) {
      Object.keys(startPositions).forEach(id => {
        const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
        if (nodeEl) {
          restoreElement(nodeEl, id);
        }
      });
    } else {
      const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${currentDraggingId}"]`);
      if (nodeEl) {
        restoreElement(nodeEl, currentDraggingId);
      }
    }
  }, [elements, buildElementTransform]);

  // Document-level drag events with smooth follow
  useEffect(() => {
    const isDragging = draggingElement || isPanning || draggingWaypoint || draggingSegment ||
                       draggingEndpoint || draggingCurve || resizing || marquee || drawing || rotating;

    if (!isDragging) return;

    const handleDocumentMouseMove = (e) => {
      // Handle rotation (must be checked first since it uses document-level events)
      if (rotating) {
        const { elementId, centerX, centerY, startAngle, startRotation, startX, startY, hasMoved } = rotating;

        // Check if user has moved enough to consider it a rotation (3 degree threshold)
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        let angleDelta = currentAngle - startAngle;

        // Check if this is a significant movement (more than 2 degrees or 5 pixels from start)
        const movedFromStart = startX !== undefined && startY !== undefined
          ? Math.sqrt(Math.pow(e.clientX - startX, 2) + Math.pow(e.clientY - startY, 2))
          : 0;
        const isSignificantMove = hasMoved || movedFromStart > 5 || Math.abs(angleDelta) > 2;

        if (!isSignificantMove) {
          // Not enough movement yet, don't update rotation
          return;
        }

        // Mark that we've started moving
        if (!hasMoved) {
          setRotating(prev => ({ ...prev, hasMoved: true }));
        }

        let newRotation = startRotation + angleDelta;

        // Normalize to -180 to 180 range
        while (newRotation > 180) newRotation -= 360;
        while (newRotation < -180) newRotation += 360;

        // Snap to 15° increments if Shift is held
        if (e.shiftKey) {
          newRotation = Math.round(newRotation / 15) * 15;
        }

        // Round to 1 decimal place for cleaner values
        newRotation = Math.round(newRotation * 10) / 10;

        // Update element rotation
        updateElement(elementId, { rotation: newRotation });

        // Update indicator
        setRotationIndicator({
          x: e.clientX + 15,
          y: e.clientY - 30,
          angle: newRotation,
        });
        return;
      }

      // Use containerRef for consistent bounding rect (outer container without transforms)
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Use ref to get latest viewport values (avoids stale closure issues)
      const vp = viewportRef.current;
      const x = (e.clientX - rect.left) / vp.scale - vp.x;
      const y = (e.clientY - rect.top) / vp.scale - vp.y;

      // Track velocity for potential momentum
      const now = performance.now();
      const dt = now - lastUpdateTimeRef.current;
      if (dt > 0 && dt < 100) {
        velocityRef.current = {
          x: (x - lastMousePosRef.current.x) / dt * 16, // Normalize to ~60fps
          y: (y - lastMousePosRef.current.y) / dt * 16,
        };
      }
      lastMousePosRef.current = { x, y };
      lastUpdateTimeRef.current = now;

      // Handle panning (no smooth follow needed, direct response)
      if (isPanning) {
        const dx = e.clientX - panStart.x;
        const dy = e.clientY - panStart.y;
        const containerWidth = canvasRef.current?.clientWidth || 1200;
        const containerHeight = canvasRef.current?.clientHeight || 800;
        setViewport(prev => {
          const newViewport = {
            ...prev,
            x: prev.x + dx / prev.scale,
            y: prev.y + dy / prev.scale,
          };
          return clampViewport(newViewport, containerWidth, containerHeight);
        });
        setPanStart({ x: e.clientX, y: e.clientY });
        return;
      }

      // Handle element dragging - direct positioning for instant response
      const currentDraggingId = draggingElementRef.current;
      if (currentDraggingId) {
        e.preventDefault();

        // Call onDragStart only on first actual movement (not on mousedown)
        if (!dragStartedRef.current) {
          dragStartedRef.current = true;
          onDragStart?.();
        }

        // Store client mouse position for edge-pan detection
        lastMouseClientPos.current = { x: e.clientX, y: e.clientY };

        const currentDragOffset = dragOffsetRef.current;
        const startElementPos = dragStartElementPosRef.current;

        // Calculate new position (clamped to valid canvas bounds)
        const newX = clampToCanvas(x - currentDragOffset.x);
        const newY = clampToCanvas(y - currentDragOffset.y);

        // Store current position for final commit
        currentPosRef.current = { x: newX, y: newY };

        // Calculate offset from original position
        let offsetX = newX - startElementPos.x;
        let offsetY = newY - startElementPos.y;

        // Apply snap guides
        const currentElement = elements.find(el => el.id === currentDraggingId);
        if (currentElement) {
          const isFrame = currentElement.type === 'frame' || currentElement.isFrame;
          if (!isFrame) {
            const tempElement = { ...currentElement, x: newX, y: newY };
            const { snapX, snapY } = calculateAlignmentGuides(tempElement);
            // snapX/snapY are DELTAS (how much to move to snap), not absolute positions
            // Track whether alignment snapping is active (to preserve on drop instead of grid-snapping)
            alignmentSnappedRef.current.x = snapX !== null;
            alignmentSnappedRef.current.y = snapY !== null;
            if (snapX !== null) {
              const snappedX = newX + snapX;
              offsetX = snappedX - startElementPos.x;
              currentPosRef.current.x = snappedX;
            }
            if (snapY !== null) {
              const snappedY = newY + snapY;
              offsetY = snappedY - startElementPos.y;
              currentPosRef.current.y = snappedY;
            }
          } else {
            clearSnapGuides();
            alignmentSnappedRef.current = { x: false, y: false };
          }
        }

        // Apply transform directly to DOM (no React re-render)
        updateDragTransform(offsetX, offsetY);

        // Edge-pan detection - auto-pan viewport when dragging near edges
        const edgeLeft = e.clientX - rect.left;
        const edgeRight = rect.right - e.clientX;
        const edgeTop = e.clientY - rect.top;
        const edgeBottom = rect.bottom - e.clientY;

        let panX = 0;
        let panY = 0;

        if (edgeLeft < EDGE_PAN_ZONE) {
          panX = (EDGE_PAN_ZONE - edgeLeft) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
        } else if (edgeRight < EDGE_PAN_ZONE) {
          panX = -(EDGE_PAN_ZONE - edgeRight) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
        }

        if (edgeTop < EDGE_PAN_ZONE) {
          panY = (EDGE_PAN_ZONE - edgeTop) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
        } else if (edgeBottom < EDGE_PAN_ZONE) {
          panY = -(EDGE_PAN_ZONE - edgeBottom) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
        }

        // Start or update edge-pan animation
        if (panX !== 0 || panY !== 0) {
          if (!edgePanRef.current) {
            const edgePanLoop = () => {
              const mousePos = lastMouseClientPos.current;
              const currentRect = containerRef.current?.getBoundingClientRect();
              if (!currentRect || !draggingElementRef.current) {
                edgePanRef.current = null;
                return;
              }

              // Recalculate edge distances and pan amounts based on current mouse position
              const currEdgeLeft = mousePos.x - currentRect.left;
              const currEdgeRight = currentRect.right - mousePos.x;
              const currEdgeTop = mousePos.y - currentRect.top;
              const currEdgeBottom = currentRect.bottom - mousePos.y;

              let currentPanX = 0;
              let currentPanY = 0;

              if (currEdgeLeft < EDGE_PAN_ZONE && currEdgeLeft >= 0) {
                currentPanX = (EDGE_PAN_ZONE - currEdgeLeft) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
              } else if (currEdgeRight < EDGE_PAN_ZONE && currEdgeRight >= 0) {
                currentPanX = -(EDGE_PAN_ZONE - currEdgeRight) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
              }

              if (currEdgeTop < EDGE_PAN_ZONE && currEdgeTop >= 0) {
                currentPanY = (EDGE_PAN_ZONE - currEdgeTop) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
              } else if (currEdgeBottom < EDGE_PAN_ZONE && currEdgeBottom >= 0) {
                currentPanY = -(EDGE_PAN_ZONE - currEdgeBottom) / EDGE_PAN_ZONE * EDGE_PAN_SPEED;
              }

              if (currentPanX !== 0 || currentPanY !== 0) {
                // Pan the viewport
                const currentVp = viewportRef.current;
                setViewport(prev => ({
                  ...prev,
                  x: prev.x + currentPanX / prev.scale,
                  y: prev.y + currentPanY / prev.scale,
                }));

                // Update element position to follow the pan
                currentPosRef.current.x -= currentPanX / currentVp.scale;
                currentPosRef.current.y -= currentPanY / currentVp.scale;

                // Update DOM transform
                const startPos = dragStartElementPosRef.current;
                updateDragTransform(
                  currentPosRef.current.x - startPos.x,
                  currentPosRef.current.y - startPos.y
                );

                edgePanRef.current = requestAnimationFrame(edgePanLoop);
              } else {
                edgePanRef.current = null;
              }
            };
            edgePanRef.current = requestAnimationFrame(edgePanLoop);
          }
        } else if (edgePanRef.current) {
          cancelAnimationFrame(edgePanRef.current);
          edgePanRef.current = null;
        }

        return;
      }

      // Handle marquee (direct, no smooth follow)
      if (marquee) {
        setMarquee(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        return;
      }

      // Handle drawing (direct, no smooth follow)
      if (drawing) {
        setDrawing(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
        return;
      }

      // Handle segment dragging (for step/elbow lines) - document level for reliable dragging
      const currentDraggingSegment = draggingSegmentRef.current;
      if (currentDraggingSegment) {
        const { connectionId, segmentIndex, isHorizontal, originalAllPoints } = currentDraggingSegment;
        const connection = connections.find(c => c.id === connectionId);
        if (connection && originalAllPoints && originalAllPoints.length >= 2) {
          // Calculate new position based on mouse - snap to grid
          const gridSize = 10;
          const snapToGrid = (val) => Math.round(val / gridSize) * gridSize;
          const newPos = isHorizontal ? snapToGrid(y) : snapToGrid(x);

          // Copy all points and modify only the dragged segment
          const modifiedPoints = originalAllPoints.map((p, i) => ({ ...p }));

          // Update the coordinates of the dragged segment's endpoints
          if (isHorizontal) {
            // Horizontal segment: move Y coordinate of both endpoints
            modifiedPoints[segmentIndex].y = newPos;
            modifiedPoints[segmentIndex + 1].y = newPos;
          } else {
            // Vertical segment: move X coordinate of both endpoints
            modifiedPoints[segmentIndex].x = newPos;
            modifiedPoints[segmentIndex + 1].x = newPos;
          }

          // Extract waypoints - need to identify which points are real waypoints vs. auto-generated stubs
          // The path structure after buildOrthogonalPath processing can vary, so we use a smarter approach:
          // 1. Skip the first point (source) and last point (target)
          // 2. Filter out points that are within MIN_STUB (30px) distance of source/target AND
          //    on the same axis as the perpendicular stub direction
          const sourcePos = modifiedPoints[0];
          const targetPos = modifiedPoints[modifiedPoints.length - 1];
          const MIN_STUB = 35; // Slightly more than the 30px stub to catch them

          // Get intermediate points (everything except source and target)
          let waypoints = modifiedPoints.slice(1, -1);

          // Filter out stub points - points that are very close to source/target on one axis
          waypoints = waypoints.filter(wp => {
            // Check if this point is part of the source stub
            const nearSourceX = Math.abs(wp.x - sourcePos.x) < MIN_STUB;
            const nearSourceY = Math.abs(wp.y - sourcePos.y) < MIN_STUB;
            const onSourceStub = (nearSourceX && wp.y === sourcePos.y) || (nearSourceY && wp.x === sourcePos.x);

            // Check if this point is part of the target stub
            const nearTargetX = Math.abs(wp.x - targetPos.x) < MIN_STUB;
            const nearTargetY = Math.abs(wp.y - targetPos.y) < MIN_STUB;
            const onTargetStub = (nearTargetX && wp.y === targetPos.y) || (nearTargetY && wp.x === targetPos.x);

            // Keep if not on a stub
            return !onSourceStub && !onTargetStub;
          });

          // Clean up redundant collinear points
          waypoints = waypoints.filter((wp, i, arr) => {
            if (arr.length <= 2) return true; // Keep all if 2 or fewer points
            if (i === 0 || i === arr.length - 1) return true;
            const prev = arr[i - 1];
            const next = arr[i + 1];
            const sameX = Math.abs(prev.x - wp.x) < 2 && Math.abs(wp.x - next.x) < 2;
            const sameY = Math.abs(prev.y - wp.y) < 2 && Math.abs(wp.y - next.y) < 2;
            return !(sameX || sameY); // Keep if it's a corner (not collinear)
          });

          // Snap-to-straight check: If source and target are nearly aligned,
          // clear waypoints to let automatic snap-to-straight routing take over
          const SNAP_THRESHOLD = 15;
          const endDx = Math.abs(targetPos.x - sourcePos.x);
          const endDy = Math.abs(targetPos.y - sourcePos.y);
          const isNearlyHorizontal = endDy <= SNAP_THRESHOLD && endDx > endDy;
          const isNearlyVertical = endDx <= SNAP_THRESHOLD && endDy > endDx;

          if (isNearlyHorizontal || isNearlyVertical) {
            // Endpoints are nearly aligned - clear waypoints for snap-to-straight
            updateConnection(connectionId, { waypoints: [], hasManualWaypoints: false });
          } else {
            // Mark as manually adjusted so we track user edits
            updateConnection(connectionId, { waypoints, hasManualWaypoints: true });
          }
        }
        return;
      }

      // Handle endpoint dragging - document level for reliable dragging
      const currentDraggingEndpoint = draggingEndpointRef.current;
      if (currentDraggingEndpoint) {
        // Calculate snapped position
        const gridSize = 10;
        const snapToGrid = (val) => Math.round(val / gridSize) * gridSize;
        const snappedPos = { x: snapToGrid(x), y: snapToGrid(y) };

        // Update preview position in state
        setDraggingEndpoint(prev => ({
          ...prev,
          previewPos: snappedPos
        }));
        // Also update the ref
        draggingEndpointRef.current = {
          ...currentDraggingEndpoint,
          previewPos: snappedPos
        };
        return;
      }

      // Handle curve dragging (for curved/arc lines) - document level for reliable dragging
      // Use ref instead of state to avoid stale closure issues
      const currentDraggingCurve = draggingCurveRef.current;
      if (currentDraggingCurve) {
        const { connectionId, sourcePos, targetPos } = currentDraggingCurve;
        // Calculate perpendicular distance from midpoint to mouse position
        const midX = (sourcePos.x + targetPos.x) / 2;
        const midY = (sourcePos.y + targetPos.y) / 2;
        const dx = targetPos.x - sourcePos.x;
        const dy = targetPos.y - sourcePos.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const perpX = -dy / len;
        const perpY = dx / len;
        const offsetX = x - midX;
        const offsetY = y - midY;
        const curveValue = Math.round(offsetX * perpX + offsetY * perpY);
        // Clamp curve value between -200 and 200
        const clampedCurve = Math.max(-200, Math.min(200, curveValue));
        updateConnection(connectionId, { curve: clampedCurve });
        return;
      }

      // Handle resizing (direct response for precision)
      if (resizing) {
        const dx = e.clientX - resizing.startMouseX;
        const dy = e.clientY - resizing.startMouseY;
        const scaledDx = dx / viewport.scale;
        const scaledDy = dy / viewport.scale;

        let newWidth = resizing.startSize.width;
        let newHeight = resizing.startSize.height;
        let newX = resizing.startPos.x;
        let newY = resizing.startPos.y;

        if (resizing.direction.includes('e')) {
          newWidth = Math.max(40, resizing.startSize.width + scaledDx);
        }
        if (resizing.direction.includes('w')) {
          const widthChange = Math.min(scaledDx, resizing.startSize.width - 40);
          newWidth = resizing.startSize.width - widthChange;
          newX = resizing.startPos.x + widthChange;
        }
        if (resizing.direction.includes('s')) {
          newHeight = Math.max(40, resizing.startSize.height + scaledDy);
        }
        if (resizing.direction.includes('n')) {
          const heightChange = Math.min(scaledDy, resizing.startSize.height - 40);
          newHeight = resizing.startSize.height - heightChange;
          newY = resizing.startPos.y + heightChange;
        }

        updateElement(resizing.elementId, {
          x: newX,
          y: newY,
          size: { width: newWidth, height: newHeight },
        });
      }
    };

    const handleDocumentMouseUp = (e) => {
      // Handle rotation end
      if (rotating) {
        recordHistory();
        setRotating(null);
        setRotationIndicator(null);
        setIsRotating?.(false); // Notify context to show toolbar again
        return;
      }

      // Cancel any pending RAF
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      pendingDragUpdateRef.current = null;

      // Cancel edge-pan animation
      if (edgePanRef.current) {
        cancelAnimationFrame(edgePanRef.current);
        edgePanRef.current = null;
      }

      // Clear snap guides
      clearSnapGuides();

      // Commit final positions and clear transforms
      const currentDraggingId = draggingElementRef.current;
      const startPositions = dragStartPositionsRef.current;
      const startElementPos = dragStartElementPosRef.current;
      const current = currentPosRef.current;

      if (currentDraggingId) {
        // Clear transforms first
        clearDragTransforms();

        // Calculate final offset from original position
        const offsetX = current.x - startElementPos.x;
        const offsetY = current.y - startElementPos.y;

        // Check if position was snapped to alignment guides
        // If so, preserve that alignment instead of snapping to grid
        const wasAlignedX = alignmentSnappedRef.current.x;
        const wasAlignedY = alignmentSnappedRef.current.y;

        // Commit final positions (clamped to valid canvas bounds)
        if (Object.keys(startPositions).length > 0) {
          // Multi-element drag
          Object.keys(startPositions).forEach(id => {
            const startPos = startPositions[id];
            updateElement(id, {
              x: clampToCanvas(wasAlignedX ? (startPos.x + offsetX) : snapToGrid(startPos.x + offsetX)),
              y: clampToCanvas(wasAlignedY ? (startPos.y + offsetY) : snapToGrid(startPos.y + offsetY)),
            });
          });
        } else {
          // Single element drag
          updateElement(currentDraggingId, {
            x: clampToCanvas(wasAlignedX ? current.x : snapToGrid(current.x)),
            y: clampToCanvas(wasAlignedY ? current.y : snapToGrid(current.y)),
          });
        }

        // When elements move, reset connections to auto-routing
        // Per requirement: "if stencil is moved, the connector can move to the shortest place again"
        const movedElementIds = Object.keys(startPositions).length > 0
          ? Object.keys(startPositions)
          : [currentDraggingId];

        connections.forEach(conn => {
          const isAttached = movedElementIds.includes(conn.sourceId) ||
                            movedElementIds.includes(conn.targetId);
          if (isAttached) {
            // Reset to auto-routing when stencil moves
            const updates = {
              manualPorts: false, // Reset to auto port selection
            };
            // Also clear waypoints to allow fresh path calculation
            if (conn.waypoints && conn.waypoints.length > 0) {
              updates.waypoints = [];
              updates.hasManualWaypoints = false;
            }
            updateConnection(conn.id, updates);
          }
        });
      }

      // Reset refs
      currentPosRef.current = { x: 0, y: 0 };
      dragStartElementPosRef.current = { x: 0, y: 0 };
      alignmentSnappedRef.current = { x: false, y: false };

      // Clear all drag states
      draggingElementRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
      dragStartPositionsRef.current = {};

      setDraggingElement(null);
      setDragStartPositions({});
      setIsPanning(false);
      setDraggingWaypoint(null);
      setDraggingSegment(null);
      draggingSegmentRef.current = null;

      // Commit endpoint drag before clearing
      const endpointData = draggingEndpointRef.current;
      if (endpointData) {
        const { connectionId, endpoint, previewPos } = endpointData;
        let x, y;

        if (previewPos) {
          x = previewPos.x;
          y = previewPos.y;
        } else {
          // Calculate from mouse position if no preview
          const rect = canvasRef.current?.getBoundingClientRect();
          if (rect) {
            x = (e.clientX - rect.left) / viewport.scale - viewport.x;
            y = (e.clientY - rect.top) / viewport.scale - viewport.y;
          }
        }

        if (x !== undefined && y !== undefined) {
          const nearbyNode = findNearbyNode(x, y, elements, packRegistry, 25);

          if (nearbyNode) {
            // Attach to the nearby node
            const pack = packRegistry?.get?.(nearbyNode.packId);
            const stencil = pack?.stencils?.find(s => s.id === nearbyNode.type);
            const nodeSize = nearbyNode.size || stencil?.defaultSize || { width: 120, height: 60 };

            const borderInfo = detectBorderClick(x, y, nearbyNode, nodeSize, 20);
            let port, ratio;
            let isManualDrop = false;

            if (borderInfo.edge) {
              port = borderInfo.edge;
              ratio = borderInfo.ratio;
              isManualDrop = true; // User dropped on specific border
            } else {
              port = determineBestPort(x, y, nearbyNode);
              ratio = 0.5;
            }

            // Update endpoint position
            // Ports auto-update based on element positions (no manualPorts lock)
            if (endpoint === 'source') {
              updateConnection(connectionId, {
                sourceId: nearbyNode.id,
                sourcePort: port,
                sourceRatio: ratio,
                sourcePos: null,
              });
            } else {
              updateConnection(connectionId, {
                targetId: nearbyNode.id,
                targetPort: port,
                targetRatio: ratio,
                targetPos: null,
              });
            }
          } else {
            // Keep as freehand endpoint
            const posKey = endpoint === 'source' ? 'sourcePos' : 'targetPos';
            const idKey = endpoint === 'source' ? 'sourceId' : 'targetId';
            const gridSize = 10;
            updateConnection(connectionId, {
              [idKey]: null,
              [posKey]: { x: Math.round(x / gridSize) * gridSize, y: Math.round(y / gridSize) * gridSize },
            });
          }
        }
      }

      setDraggingEndpoint(null);
      draggingEndpointRef.current = null;
      setDraggingCurve(null);
      draggingCurveRef.current = null;
      setResizing(null);
      setMarquee(null);
      setDrawing(null);
    };

    // Attach document-level listeners
    document.addEventListener('mousemove', handleDocumentMouseMove);
    document.addEventListener('mouseup', handleDocumentMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleDocumentMouseMove);
      document.removeEventListener('mouseup', handleDocumentMouseUp);
      // Also clean up immediate drag handlers to prevent race conditions
      if (immediateMouseMoveRef.current) {
        document.removeEventListener('mousemove', immediateMouseMoveRef.current);
        immediateMouseMoveRef.current = null;
      }
      if (immediateMouseUpRef.current) {
        document.removeEventListener('mouseup', immediateMouseUpRef.current);
        immediateMouseUpRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      if (edgePanRef.current) {
        cancelAnimationFrame(edgePanRef.current);
        edgePanRef.current = null;
      }
    };
  }, [draggingElement, isPanning, draggingWaypoint, draggingSegment, draggingEndpoint, draggingCurve,
      resizing, marquee, drawing, rotating, viewport, panStart, updateElement, updateConnection, setViewport,
      elements, connections, packRegistry, updateDragTransform, clearDragTransforms, onDragStart]);

  // ============ DRAG HANDLING ============

  const handleDragStart = useCallback((e, element) => {
    if (readOnly || !canMove) return;

    // Don't allow dragging locked elements
    if (element.locked) return;

    // CRITICAL: If we're already dragging this element, don't re-initialize
    // This prevents listener removal during re-renders
    if (draggingElementRef.current === element.id) {
      return;
    }

    // Get the node element to check for any residual transform
    const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${element.id}"]`);

    // Parse any existing transform to account for residual offset
    let residualX = 0;
    let residualY = 0;
    if (nodeEl) {
      const transform = nodeEl.style.transform;
      if (transform && transform.includes('translate')) {
        const match = transform.match(/translate\(([^,]+)px,\s*([^)]+)px\)/);
        if (match) {
          residualX = parseFloat(match[1]) || 0;
          residualY = parseFloat(match[2]) || 0;
        }
      }
      // Keep the residual transform applied - don't clear it yet
      // It will be managed by the drag system from here
      nodeEl.style.zIndex = '1000';
    }

    // For multi-select, set zIndex on all selected elements
    if (selection.nodeIds.length > 1) {
      selection.nodeIds.forEach(id => {
        const selectedNodeEl = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
        if (selectedNodeEl) {
          selectedNodeEl.style.zIndex = '1000';
        }
      });
    }
    // For frame drag, set zIndex on all child elements
    if (element.type === 'frame') {
      const childElements = getElementsInsideFrame(element, elements, packRegistry);
      childElements.forEach(child => {
        const childEl = canvasRef.current?.querySelector(`[data-node-id="${child.id}"]`);
        if (childEl) {
          childEl.style.zIndex = '1000';
        }
      });
    }

    // Use containerRef for consistent bounding rect
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Use ref to get latest viewport values
    const vp = viewportRef.current;
    const x = (e.clientX - rect.left) / vp.scale - vp.x;
    const y = (e.clientY - rect.top) / vp.scale - vp.y;

    // Account for residual transform in offset calculation
    // The element's visual position was at (element.x + residualX, element.y + residualY)
    // We want to start the new drag from the visual position
    const visualX = element.x + residualX;
    const visualY = element.y + residualY;

    const offset = {
      x: x - visualX,
      y: y - visualY,
    };

    // Set refs immediately for synchronous access in handleMouseMove
    draggingElementRef.current = element.id;
    dragOffsetRef.current = offset;
    dragStartedRef.current = false; // Will be set true on first movement

    // Store original STORED element position for calculating transform offsets
    // This is element.x, not the visual position, because transform = newPos - storedPos
    dragStartElementPosRef.current = { x: element.x, y: element.y };

    // Initialize smooth follow positions at element's VISUAL position
    // (stored position + residual transform)
    targetPosRef.current = { x: visualX, y: visualY };
    currentPosRef.current = { x: visualX, y: visualY };
    lastMousePosRef.current = { x, y };
    lastUpdateTimeRef.current = performance.now();
    velocityRef.current = { x: 0, y: 0 };

    // Also set state for React re-renders (like showing .dragging class)
    setDraggingElement(element.id);
    setDragOffset(offset);
    setIsDragging?.(true); // Notify context to hide toolbars during drag

    // CRITICAL: Attach mousemove AND mouseup listeners IMMEDIATELY to avoid race condition
    // The useEffect-based listeners may not be attached in time for quick drags

    // Clean up any existing listeners from a previous drag that wasn't cleaned up properly
    if (immediateMouseMoveRef.current) {
      document.removeEventListener('mousemove', immediateMouseMoveRef.current);
      immediateMouseMoveRef.current = null;
    }
    if (immediateMouseUpRef.current) {
      document.removeEventListener('mouseup', immediateMouseUpRef.current);
      immediateMouseUpRef.current = null;
    }

    // Immediate mousemove handler to track position during drag
    const handleImmediateMouseMove = (moveEvent) => {
      // Only handle if we're still dragging this element
      if (draggingElementRef.current !== element.id) return;

      // Calculate new position (same logic as handleDocumentMouseMove)
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const vp = viewportRef.current;
      const mouseX = (moveEvent.clientX - rect.left) / vp.scale - vp.x;
      const mouseY = (moveEvent.clientY - rect.top) / vp.scale - vp.y;

      const currentDragOffset = dragOffsetRef.current;
      let newX = clampToCanvas(mouseX - currentDragOffset.x);
      let newY = clampToCanvas(mouseY - currentDragOffset.y);

      // Apply alignment snap guides (same as handleDocumentMouseMove)
      const isFrame = element.type === 'frame' || element.isFrame;
      if (!isFrame) {
        const tempElement = { ...element, x: newX, y: newY };
        const { snapX, snapY } = calculateAlignmentGuides(tempElement);
        // Track whether alignment snapping is active
        alignmentSnappedRef.current.x = snapX !== null;
        alignmentSnappedRef.current.y = snapY !== null;
        if (snapX !== null) {
          newX = newX + snapX;
        }
        if (snapY !== null) {
          newY = newY + snapY;
        }
      } else {
        clearSnapGuides();
        alignmentSnappedRef.current = { x: false, y: false };
      }

      // Update current position ref with snapped position
      currentPosRef.current = { x: newX, y: newY };

      // Update CSS transform for visual feedback, preserving rotation/scale
      const startPos = dragStartElementPosRef.current;
      const offsetX = newX - startPos.x;
      const offsetY = newY - startPos.y;

      const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${element.id}"]`);
      if (nodeEl) {
        nodeEl.style.transform = buildElementTransform(element, offsetX, offsetY);
      }

      // Also update for multi-select
      const positions = dragStartPositionsRef.current;
      if (Object.keys(positions).length > 0) {
        Object.keys(positions).forEach(id => {
          if (id !== element.id) {
            const el = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
            if (el) {
              const elem = elements.find(e => e.id === id);
              el.style.transform = buildElementTransform(elem, offsetX, offsetY);
            }
          }
        });
      }
    };

    const handleImmediateMouseUp = (upEvent) => {
      // Remove both listeners using refs
      if (immediateMouseMoveRef.current) {
        document.removeEventListener('mousemove', immediateMouseMoveRef.current);
        immediateMouseMoveRef.current = null;
      }
      if (immediateMouseUpRef.current) {
        document.removeEventListener('mouseup', immediateMouseUpRef.current);
        immediateMouseUpRef.current = null;
      }

      // Only handle if we're still dragging this element
      if (draggingElementRef.current !== element.id) {
        return;
      }

      // Helper to restore proper transform (rotation/scale) and z-index based on element's properties
      const restoreElementStyle = (nodeEl, elementId) => {
        const elem = elements.find(e => e.id === elementId);
        const properZIndex = (elem?.zIndex || 0) + 5;
        nodeEl.style.transform = buildElementTransform(elem, 0, 0);
        nodeEl.style.zIndex = String(properZIndex);
      };

      // Clear translate transforms and restore rotation/scale + z-index
      const nodeToUpdate = canvasRef.current?.querySelector(`[data-node-id="${element.id}"]`);
      if (nodeToUpdate) {
        restoreElementStyle(nodeToUpdate, element.id);
      }

      // Also restore transforms for multi-select or frame children
      const positions = dragStartPositionsRef.current;
      if (Object.keys(positions).length > 0) {
        Object.keys(positions).forEach(id => {
          const el = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
          if (el) {
            restoreElementStyle(el, id);
          }
        });
      }

      // Commit final position
      const current = currentPosRef.current;
      const startPos = dragStartElementPosRef.current;
      const offsetX = current.x - startPos.x;
      const offsetY = current.y - startPos.y;

      // Check if position was snapped to alignment guides
      // If so, preserve that alignment instead of snapping to grid
      const wasAlignedX = alignmentSnappedRef.current.x;
      const wasAlignedY = alignmentSnappedRef.current.y;

      if (Object.keys(positions).length > 0) {
        // Multi-element drag
        Object.keys(positions).forEach(id => {
          const pos = positions[id];
          updateElement(id, {
            x: clampToCanvas(wasAlignedX ? (pos.x + offsetX) : snapToGrid(pos.x + offsetX)),
            y: clampToCanvas(wasAlignedY ? (pos.y + offsetY) : snapToGrid(pos.y + offsetY)),
          });
        });
      } else {
        // Single element drag
        updateElement(element.id, {
          x: clampToCanvas(wasAlignedX ? current.x : snapToGrid(current.x)),
          y: clampToCanvas(wasAlignedY ? current.y : snapToGrid(current.y)),
        });
      }

      // Reset refs
      draggingElementRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
      dragStartPositionsRef.current = {};
      currentPosRef.current = { x: 0, y: 0 };
      dragStartElementPosRef.current = { x: 0, y: 0 };
      alignmentSnappedRef.current = { x: false, y: false };

      // Reset state
      setDraggingElement(null);
      setDragStartPositions({});
      clearSnapGuides();
    };

    // Store handlers in refs for later cleanup
    immediateMouseMoveRef.current = handleImmediateMouseMove;
    immediateMouseUpRef.current = handleImmediateMouseUp;

    document.addEventListener('mousemove', handleImmediateMouseMove);
    document.addEventListener('mouseup', handleImmediateMouseUp);

    // Fallback mouseup handler - since the immediate handler sometimes doesn't fire
    // (possibly due to React Strict Mode or re-renders), this ensures the drop is handled
    const fallbackMouseUp = () => {
      document.removeEventListener('mouseup', fallbackMouseUp);

      // Check if there's a valid position to commit (currentPosRef is set)
      const current = currentPosRef.current;
      const hasValidPosition = current && (current.x !== 0 || current.y !== 0);

      // Skip if no valid position (drag was already fully committed or never started)
      if (!hasValidPosition) {
        return;
      }

      // Remove immediate listeners
      if (immediateMouseMoveRef.current) {
        document.removeEventListener('mousemove', immediateMouseMoveRef.current);
        immediateMouseMoveRef.current = null;
      }
      if (immediateMouseUpRef.current) {
        document.removeEventListener('mouseup', immediateMouseUpRef.current);
        immediateMouseUpRef.current = null;
      }

      // Helper to restore proper transform (rotation/scale) and z-index based on element's properties
      const restoreElementStyle = (nodeEl, elementId) => {
        const elem = elements.find(e => e.id === elementId);
        const properZIndex = (elem?.zIndex || 0) + 5;
        nodeEl.style.transform = buildElementTransform(elem, 0, 0);
        nodeEl.style.zIndex = String(properZIndex);
      };

      // Clear translate transforms and restore rotation/scale + z-index
      const nodeToUpdate = canvasRef.current?.querySelector(`[data-node-id="${element.id}"]`);
      if (nodeToUpdate) {
        restoreElementStyle(nodeToUpdate, element.id);
      }

      // Also restore transforms for multi-select or frame children
      const positions = dragStartPositionsRef.current;
      if (Object.keys(positions).length > 0) {
        Object.keys(positions).forEach(id => {
          const el = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
          if (el) {
            restoreElementStyle(el, id);
          }
        });
      }

      // Commit final position with alignment preservation
      // (current is already defined above from currentPosRef.current)
      const startPos = dragStartElementPosRef.current;
      const offsetX = current.x - startPos.x;
      const offsetY = current.y - startPos.y;

      const wasAlignedX = alignmentSnappedRef.current.x;
      const wasAlignedY = alignmentSnappedRef.current.y;

      if (Object.keys(positions).length > 0) {
        // Multi-element drag
        Object.keys(positions).forEach(id => {
          const pos = positions[id];
          updateElement(id, {
            x: clampToCanvas(wasAlignedX ? (pos.x + offsetX) : snapToGrid(pos.x + offsetX)),
            y: clampToCanvas(wasAlignedY ? (pos.y + offsetY) : snapToGrid(pos.y + offsetY)),
          });
        });
      } else {
        // Single element drag
        updateElement(element.id, {
          x: clampToCanvas(wasAlignedX ? current.x : snapToGrid(current.x)),
          y: clampToCanvas(wasAlignedY ? current.y : snapToGrid(current.y)),
        });
      }

      // Reset refs
      draggingElementRef.current = null;
      dragOffsetRef.current = { x: 0, y: 0 };
      dragStartPositionsRef.current = {};
      currentPosRef.current = { x: 0, y: 0 };
      dragStartElementPosRef.current = { x: 0, y: 0 };
      alignmentSnappedRef.current = { x: false, y: false };

      // Reset state
      setDraggingElement(null);
      setDragStartPositions({});
      clearSnapGuides();
    };
    document.addEventListener('mouseup', fallbackMouseUp);

    // Note: onDragStart will be called when actual movement starts (in handleDocumentMouseMove)
    // to avoid closing properties panel on simple clicks

    // Store starting positions for all selected elements (for multi-drag)
    if (selection.nodeIds.length > 1 && selection.nodeIds.includes(element.id)) {
      const positions = {};
      elements.forEach(el => {
        if (selection.nodeIds.includes(el.id)) {
          positions[el.id] = { x: el.x, y: el.y };
        }
      });
      dragStartPositionsRef.current = positions;
      setDragStartPositions(positions);
    }
    // If dragging a frame, also store positions of all child elements
    else if (element.type === 'frame') {
      const childElements = getElementsInsideFrame(element, elements, packRegistry);
      const positions = { [element.id]: { x: element.x, y: element.y } };
      childElements.forEach(child => {
        positions[child.id] = { x: child.x, y: child.y };
      });
      dragStartPositionsRef.current = positions;
      setDragStartPositions(positions);
    }
    // If dragging a mind map element (without Alt key), move entire subtree
    else if (isMindMapElement(element) && !e.altKey) {
      // Build hierarchy and get subtree IDs
      const hierarchy = buildMindMapHierarchy(elements, connections);
      const subtreeIds = getMindMapSubtree(element.id, hierarchy.childrenMap);

      const positions = {};
      subtreeIds.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) {
          positions[id] = { x: el.x, y: el.y };
        }
      });
      dragStartPositionsRef.current = positions;
      setDragStartPositions(positions);
    } else {
      dragStartPositionsRef.current = {};
    }
  }, [readOnly, canMove, selection.nodeIds, elements, connections, packRegistry, onDragStart, updateElement]);

  const handleMouseMove = useCallback((e) => {
    // Use containerRef for consistent bounding rect
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Use ref to get latest viewport values
    const vp = viewportRef.current;
    const x = (e.clientX - rect.left) / vp.scale - vp.x;
    const y = (e.clientY - rect.top) / vp.scale - vp.y;

    // Update mouse position for coordinates display (relative to canvas center)
    // Canvas center is at 50000,50000 so we offset to show (0,0) at center
    setMousePos({ x: Math.round(x - INFINITE_CANVAS_OFFSET), y: Math.round(y - INFINITE_CANVAS_OFFSET) });

    // Track mouse position for connection line with alignment snap
    if (isConnecting && connectSource) {
      let snapX = x;
      let snapY = y;
      const guides = { horizontal: [], vertical: [] };
      // Threshold in screen pixels, converted to canvas space for consistent feel at any zoom
      const SCREEN_THRESHOLD = 20; // 20 screen pixels
      const canvasThreshold = SCREEN_THRESHOLD / vp.scale;

      // Check for horizontal alignment (same Y as source)
      if (Math.abs(y - connectSource.y) < canvasThreshold) {
        snapY = connectSource.y;
        guides.horizontal.push({
          y: connectSource.y,
          x1: Math.min(connectSource.x, x) - 50,
          x2: Math.max(connectSource.x, x) + 50,
          type: 'center'
        });
      }

      // Check for vertical alignment (same X as source)
      if (Math.abs(x - connectSource.x) < canvasThreshold) {
        snapX = connectSource.x;
        guides.vertical.push({
          x: connectSource.x,
          y1: Math.min(connectSource.y, y) - 50,
          y2: Math.max(connectSource.y, y) + 50,
          type: 'center'
        });
      }

      setConnectMousePos({ x: snapX, y: snapY });
      // Show alignment guides during connection dragging
      if (guides.horizontal.length > 0 || guides.vertical.length > 0) {
        setSnapGuides(guides);
      } else {
        clearSnapGuides();
      }
    }

    // Handle draw-to-size
    if (drawing) {
      setDrawing(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      return;
    }

    // Handle marquee selection
    if (marquee) {
      setMarquee(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      return;
    }

    // Handle waypoint dragging
    if (draggingWaypoint) {
      const { connectionId, waypointIndex } = draggingWaypoint;
      const connection = connections.find(c => c.id === connectionId);
      if (connection) {
        const newWaypoints = [...(connection.waypoints || [])];
        newWaypoints[waypointIndex] = { x: snapToGrid(x), y: snapToGrid(y) };
        // Mark as manually adjusted so we track user edits
        updateConnection(connectionId, { waypoints: newWaypoints, hasManualWaypoints: true });
      }
      return;
    }

    // Handle endpoint dragging - only update preview position, finalize on mouseup
    if (draggingEndpoint) {
      // Update preview position in state (don't modify the actual connection yet)
      // This prevents flickering from constant connection recalculation
      setDraggingEndpoint(prev => ({
        ...prev,
        previewPos: { x: snapToGrid(x), y: snapToGrid(y) }
      }));
      return;
    }

    // Handle segment dragging (for step/orthogonal lines)
    // Preserve full path structure while moving the dragged segment
    if (draggingSegment) {
      const { connectionId, segmentIndex, isHorizontal, originalAllPoints } = draggingSegment;
      const connection = connections.find(c => c.id === connectionId);
      if (connection && originalAllPoints && originalAllPoints.length >= 2) {
        // Calculate new position based on mouse - snap to grid
        const newPos = isHorizontal ? snapToGrid(y) : snapToGrid(x);

        // Copy all points and modify only the dragged segment
        const modifiedPoints = originalAllPoints.map((p, i) => ({ ...p }));

        // Update the coordinates of the dragged segment's endpoints
        if (isHorizontal) {
          // Horizontal segment: move Y coordinate of both endpoints
          modifiedPoints[segmentIndex].y = newPos;
          modifiedPoints[segmentIndex + 1].y = newPos;
        } else {
          // Vertical segment: move X coordinate of both endpoints
          modifiedPoints[segmentIndex].x = newPos;
          modifiedPoints[segmentIndex + 1].x = newPos;
        }

        // Extract waypoints - need to identify which points are real waypoints vs. auto-generated stubs
        // The path structure after buildOrthogonalPath processing can vary, so we use a smarter approach:
        // 1. Skip the first point (source) and last point (target)
        // 2. Filter out points that are within MIN_STUB distance of source/target on same axis
        const sourcePos = modifiedPoints[0];
        const targetPos = modifiedPoints[modifiedPoints.length - 1];
        const MIN_STUB = 35; // Slightly more than the 30px stub to catch them

        // Get intermediate points (everything except source and target)
        let waypoints = modifiedPoints.slice(1, -1);

        // Filter out stub points - points that are very close to source/target on one axis
        waypoints = waypoints.filter(wp => {
          // Check if this point is part of the source stub
          const nearSourceX = Math.abs(wp.x - sourcePos.x) < MIN_STUB;
          const nearSourceY = Math.abs(wp.y - sourcePos.y) < MIN_STUB;
          const onSourceStub = (nearSourceX && wp.y === sourcePos.y) || (nearSourceY && wp.x === sourcePos.x);

          // Check if this point is part of the target stub
          const nearTargetX = Math.abs(wp.x - targetPos.x) < MIN_STUB;
          const nearTargetY = Math.abs(wp.y - targetPos.y) < MIN_STUB;
          const onTargetStub = (nearTargetX && wp.y === targetPos.y) || (nearTargetY && wp.x === targetPos.x);

          // Keep if not on a stub
          return !onSourceStub && !onTargetStub;
        });

        // Clean up redundant collinear points
        waypoints = waypoints.filter((wp, i, arr) => {
          if (arr.length <= 2) return true; // Keep all if 2 or fewer points
          if (i === 0 || i === arr.length - 1) return true;
          const prev = arr[i - 1];
          const next = arr[i + 1];
          const sameX = Math.abs(prev.x - wp.x) < 2 && Math.abs(wp.x - next.x) < 2;
          const sameY = Math.abs(prev.y - wp.y) < 2 && Math.abs(wp.y - next.y) < 2;
          return !(sameX || sameY); // Keep if it's a corner (not collinear)
        });

        // Snap-to-straight check: If source and target are nearly aligned,
        // clear waypoints to let automatic snap-to-straight routing take over
        const SNAP_THRESHOLD = 15;
        const endDx = Math.abs(targetPos.x - sourcePos.x);
        const endDy = Math.abs(targetPos.y - sourcePos.y);
        const isNearlyHorizontal = endDy <= SNAP_THRESHOLD && endDx > endDy;
        const isNearlyVertical = endDx <= SNAP_THRESHOLD && endDy > endDx;

        if (isNearlyHorizontal || isNearlyVertical) {
          // Endpoints are nearly aligned - clear waypoints for snap-to-straight
          updateConnection(connectionId, { waypoints: [], hasManualWaypoints: false });
        } else {
          // Mark as manually adjusted so we track user edits
          updateConnection(connectionId, { waypoints, hasManualWaypoints: true });
        }
      }
      return;
    }

    // Handle curve dragging (for curved/arc lines)
    if (draggingCurve) {
      const { connectionId, sourcePos, targetPos } = draggingCurve;
      // Calculate perpendicular distance from midpoint to mouse position
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;
      const offsetX = x - midX;
      const offsetY = y - midY;
      const curveValue = Math.round(offsetX * perpX + offsetY * perpY);
      // Clamp curve value between -200 and 200
      const clampedCurve = Math.max(-200, Math.min(200, curveValue));
      updateConnection(connectionId, { curve: clampedCurve });
      return;
    }

    // Handle resizing with proper grid snapping
    if (resizing) {
      const { elementId, direction, startX, startY, startSize, startPos } = resizing;
      const dx = x - startX;
      const dy = y - startY;

      let newWidth = startSize.width;
      let newHeight = startSize.height;
      let newX = startPos.x;
      let newY = startPos.y;

      // Minimum size constraints
      const minWidth = 60;
      const minHeight = 40;

      // Handle each resize direction with grid snapping
      if (direction.includes('e')) {
        // East: expand width, position stays same
        const targetWidth = startSize.width + dx;
        newWidth = Math.max(minWidth, snapToGrid(targetWidth));
      }
      if (direction.includes('w')) {
        // West: expand width leftward, position moves
        const targetX = startPos.x + dx;
        const snappedX = snapToGrid(targetX);
        const widthDelta = startPos.x - snappedX;
        newWidth = Math.max(minWidth, startSize.width + widthDelta);
        // Only move X if we have room for minimum width
        if (startSize.width + widthDelta >= minWidth) {
          newX = snappedX;
        } else {
          newX = startPos.x + startSize.width - minWidth;
          newWidth = minWidth;
        }
      }
      if (direction.includes('s')) {
        // South: expand height, position stays same
        const targetHeight = startSize.height + dy;
        newHeight = Math.max(minHeight, snapToGrid(targetHeight));
      }
      if (direction.includes('n')) {
        // North: expand height upward, position moves
        const targetY = startPos.y + dy;
        const snappedY = snapToGrid(targetY);
        const heightDelta = startPos.y - snappedY;
        newHeight = Math.max(minHeight, startSize.height + heightDelta);
        // Only move Y if we have room for minimum height
        if (startSize.height + heightDelta >= minHeight) {
          newY = snappedY;
        } else {
          newY = startPos.y + startSize.height - minHeight;
          newHeight = minHeight;
        }
      }

      // Ensure final position is on grid
      newX = snapToGrid(newX);
      newY = snapToGrid(newY);
      // Ensure final size is on grid
      newWidth = snapToGrid(newWidth);
      newHeight = snapToGrid(newHeight);

      updateElement(elementId, {
        x: Math.max(0, newX),
        y: Math.max(0, newY),
        size: { width: newWidth, height: newHeight },
      });
      return;
    }

    // Handle rotation
    if (rotating) {
      const { elementId, centerX, centerY, startAngle, startRotation } = rotating;

      // Calculate current angle from center to mouse
      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const currentAngle = Math.atan2(dy, dx) * (180 / Math.PI);

      // Calculate rotation delta
      let angleDelta = currentAngle - startAngle;
      let newRotation = startRotation + angleDelta;

      // Normalize to -180 to 180 range
      while (newRotation > 180) newRotation -= 360;
      while (newRotation < -180) newRotation += 360;

      // Snap to 15° increments if Shift is held
      if (e.shiftKey) {
        newRotation = Math.round(newRotation / 15) * 15;
      }

      // Round to 1 decimal place for cleaner values
      newRotation = Math.round(newRotation * 10) / 10;

      // Update element rotation
      updateElement(elementId, { rotation: newRotation });

      // Update indicator
      setRotationIndicator({
        x: e.clientX + 15,
        y: e.clientY - 30,
        angle: newRotation,
      });
      return;
    }

    // Element dragging is handled by the document-level handler (uses DOM transforms for performance)
    // Only handle panning here since it updates viewport state
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      const containerWidth = canvasRef.current?.clientWidth || 1200;
      const containerHeight = canvasRef.current?.clientHeight || 800;
      setViewport(prev => {
        const newViewport = {
          ...prev,
          x: prev.x + dx / prev.scale,
          y: prev.y + dy / prev.scale,
        };
        return clampViewport(newViewport, containerWidth, containerHeight);
      });
      setPanStart({ x: e.clientX, y: e.clientY });
    }
  }, [isPanning, panStart, isConnecting, connectSource, draggingWaypoint, draggingSegment, draggingEndpoint, resizing, marquee, drawing, connections, elements, packRegistry, setViewport, updateConnection]);

  const handleMouseUp = useCallback((e) => {
    // Complete draw-to-size (requires actual drag, not just click)
    if (drawing) {
      const minX = Math.min(drawing.startX, drawing.currentX);
      const maxX = Math.max(drawing.startX, drawing.currentX);
      const minY = Math.min(drawing.startY, drawing.currentY);
      const maxY = Math.max(drawing.startY, drawing.currentY);

      const width = maxX - minX;
      const height = maxY - minY;

      // Minimum drag distance required to create element (prevents accidental click-create)
      const minDragSize = 20;
      const didDrag = width >= minDragSize || height >= minDragSize;

      if (didDrag) {
        // Handle sticky note creation
        if (drawing.isSticky) {
          // Keep sticky notes square, use the larger dimension
          const stickySize = Math.max(width, height, 100); // Minimum 100px
          const newElement = {
            id: `sticky-${Date.now()}`,
            type: 'sticky-medium',
            packId: 'sticky-notes',
            label: '',
            x: snapToGrid(minX),
            y: snapToGrid(minY),
            size: { width: snapToGrid(stickySize), height: snapToGrid(stickySize) },
            color: stickyNoteColor || '#fef08a',
            shape: 'sticky',
            data: {},
            isAnnotation: true,
          };
          addElement(newElement);
          recordHistory();
          selectElement(newElement.id);
        }
        // Handle regular stencil creation
        else if (selectedStencil) {
          const finalWidth = snapToGrid(Math.max(width, 60)); // Minimum 60px
          const finalHeight = snapToGrid(Math.max(height, 40)); // Minimum 40px

          const newElement = {
            id: `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: selectedStencil.id,
            packId: selectedStencil.packId,
            name: selectedStencil.name,
            label: selectedStencil.name,
            x: snapToGrid(minX),
            y: snapToGrid(minY),
            size: { width: finalWidth, height: finalHeight },
            color: selectedStencil.color,
            layerId: 'default',
            properties: {},
          };

          addElement(newElement);
          recordHistory();
          selectElement(newElement.id);
        }
      }
      // If didn't drag enough, just cancel the drawing (no element created)

      setDrawing(null);
      return;
    }

    // Complete marquee selection
    if (marquee) {
      const minX = Math.min(marquee.startX, marquee.currentX);
      const maxX = Math.max(marquee.startX, marquee.currentX);
      const minY = Math.min(marquee.startY, marquee.currentY);
      const maxY = Math.max(marquee.startY, marquee.currentY);

      // Only select if there was actual dragging (not just a click)
      const didDrag = Math.abs(maxX - minX) > 5 || Math.abs(maxY - minY) > 5;

      if (didDrag) {
        // Find elements that intersect with marquee rectangle
        const selectedIds = elements.filter(el => {
          const pack = packRegistry?.get?.(el.packId);
          const stencil = pack?.stencils?.find(s => s.id === el.type);
          const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };

          // Check if element intersects with marquee
          return !(el.x + size.width < minX ||
                   el.x > maxX ||
                   el.y + size.height < minY ||
                   el.y > maxY);
        }).map(el => el.id);

        if (selectedIds.length > 0) {
          // Use the addToSelection flag stored when marquee started
          selectElements(selectedIds, marquee.addToSelection || false);
        }
      }
      setMarquee(null);
      return;
    }

    // Track if we need to record history (only once per mouseUp)
    let shouldRecordHistory = false;

    if (draggingElement) {
      shouldRecordHistory = true;
      // Clear snap guides when done dragging
      clearSnapGuides();

      // Clear CSS transforms and commit final positions
      // This acts as a fallback in case handleImmediateMouseUp didn't complete
      const currentDragId = draggingElementRef.current;
      if (currentDragId) {
        // Helper to restore proper transform (rotation/scale) and z-index
        const restoreElementStyle = (nodeEl, elementId) => {
          const elem = elements.find(e => e.id === elementId);
          const properZIndex = (elem?.zIndex || 0) + 5;
          nodeEl.style.transform = buildElementTransform(elem, 0, 0);
          nodeEl.style.zIndex = String(properZIndex);
        };

        // Clear translate transform and restore rotation/scale + z-index on the dragged element
        const nodeEl = canvasRef.current?.querySelector(`[data-node-id="${currentDragId}"]`);
        if (nodeEl) {
          restoreElementStyle(nodeEl, currentDragId);
        }

        // Commit position from currentPosRef
        const current = currentPosRef.current;
        if (current && (current.x !== 0 || current.y !== 0)) {
          const positions = dragStartPositionsRef.current;
          const startPos = dragStartElementPosRef.current;
          const offsetX = current.x - startPos.x;
          const offsetY = current.y - startPos.y;

          if (Object.keys(positions).length > 0) {
            // Multi-element drag - clear translate transforms and restore rotation/scale + commit positions
            Object.keys(positions).forEach(id => {
              const el = canvasRef.current?.querySelector(`[data-node-id="${id}"]`);
              if (el) {
                restoreElementStyle(el, id);
              }
              const pos = positions[id];
              updateElement(id, {
                x: clampToCanvas(snapToGrid(pos.x + offsetX)),
                y: clampToCanvas(snapToGrid(pos.y + offsetY)),
              });
            });
          } else {
            // Single element drag
            updateElement(currentDragId, {
              x: clampToCanvas(snapToGrid(current.x)),
              y: clampToCanvas(snapToGrid(current.y)),
            });
          }
        }
      }
    }
    if (draggingWaypoint) {
      shouldRecordHistory = true;
    }
    if (draggingSegment) {
      shouldRecordHistory = true;
    }
    if (draggingEndpoint) {
      shouldRecordHistory = true;
      // Use the preview position from state, or calculate from mouse event
      const { connectionId, endpoint, previewPos } = draggingEndpoint;
      let x, y;

      if (previewPos) {
        x = previewPos.x;
        y = previewPos.y;
      } else {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          y = (e.clientY - rect.top) / viewport.scale - viewport.y;
        }
      }

      if (x !== undefined && y !== undefined) {
        const nearbyNode = findNearbyNode(x, y, elements, packRegistry, 25); // Larger threshold for attachment

        if (nearbyNode) {
          // Attach to the nearby node with exact position
          const pack = packRegistry?.get?.(nearbyNode.packId);
          const stencil = pack?.stencils?.find(s => s.id === nearbyNode.type);
          const nodeSize = nearbyNode.size || stencil?.defaultSize || { width: 120, height: 60 };

          // Check if dropping on a specific border position
          const borderInfo = detectBorderClick(x, y, nearbyNode, nodeSize, 20);
          let port, ratio;
          let isManualDrop = false;

          if (borderInfo.edge) {
            // User dropped on a specific border point
            port = borderInfo.edge;
            ratio = borderInfo.ratio;
            isManualDrop = true; // User dropped on specific border
          } else {
            // User dropped in center area, use auto-port at center
            port = determineBestPort(x, y, nearbyNode);
            ratio = 0.5;
          }

          if (endpoint === 'source') {
            updateConnection(connectionId, {
              sourceId: nearbyNode.id,
              sourcePort: port,
              sourceRatio: ratio,
              sourcePos: null, // Clear freehand position
            });
          } else {
            updateConnection(connectionId, {
              targetId: nearbyNode.id,
              targetPort: port,
              targetRatio: ratio,
              targetPos: null, // Clear freehand position
            });
          }
        } else {
          // Keep as freehand endpoint at current position
          const posKey = endpoint === 'source' ? 'sourcePos' : 'targetPos';
          const idKey = endpoint === 'source' ? 'sourceId' : 'targetId';
          updateConnection(connectionId, {
            [idKey]: null,
            [posKey]: { x: snapToGrid(x), y: snapToGrid(y) },
          });
        }
      }
      setDraggingEndpoint(null);
    }
    if (resizing) {
      shouldRecordHistory = true;
    }

    // Record history only once for all drag operations
    if (shouldRecordHistory) {
      recordHistory();
    }

    // Handle connection release - create freehand connection or cancel
    if (isConnecting && connectSource) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const endX = (e.clientX - rect.left) / viewport.scale - viewport.x;
        const endY = (e.clientY - rect.top) / viewport.scale - viewport.y;

        // Check if we have a minimum distance (at least 20 pixels) to create a connection
        const dx = endX - connectSource.x;
        const dy = endY - connectSource.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance >= 20) {
          // Use connectSource.elementId if we started from an edge handle, otherwise find nearby node
          const sourceElement = connectSource.elementId
            ? elements.find(el => el.id === connectSource.elementId)
            : findNearbyNode(connectSource.x, connectSource.y, elements, packRegistry);

          // Check if end is near a node
          const nearbyEndNode = findNearbyNode(endX, endY, elements, packRegistry);

          // Don't connect a node to itself
          const sourceId = sourceElement?.id || null;
          const targetId = nearbyEndNode?.id || null;

          // Don't create connection with no endpoints at all (both null with no freehand positions)
          // At least one endpoint must exist or we need valid freehand positions
          const hasValidSource = sourceId || (connectSource.x !== undefined && connectSource.y !== undefined);
          const hasValidTarget = targetId || (endX !== undefined && endY !== undefined);

          if ((sourceId !== targetId) && hasValidSource && hasValidTarget) {
            // Use last line style if user changed it, otherwise get from source element's pack
            const sourcePack = sourceElement ? packRegistry?.get?.(sourceElement.packId) : null;
            const packDefaultLineStyle = sourcePack?.defaultLineStyle || 'curved';
            let effectiveLineStyle = lastLineStyle || packDefaultLineStyle;

            // Calculate source port
            const sourcePort = sourceElement ? (connectSource.portId || determineBestPort(connectSource.x, connectSource.y, sourceElement)) : null;

            // Calculate target port and ratio from exact drop position
            let targetPort = null;
            let targetRatio = 0.5;
            let targetIsManual = false;
            if (nearbyEndNode) {
              const targetPack = packRegistry?.get?.(nearbyEndNode.packId);
              const targetStencil = targetPack?.stencils?.find(s => s.id === nearbyEndNode.type);
              const targetSize = nearbyEndNode.size || targetStencil?.defaultSize || { width: 120, height: 60 };
              const borderInfo = detectBorderClick(endX, endY, nearbyEndNode, targetSize, 25);
              if (borderInfo.edge) {
                targetPort = borderInfo.edge;
                targetRatio = borderInfo.ratio;
                targetIsManual = true; // User dropped on specific border
              } else {
                targetPort = determineBestPort(endX, endY, nearbyEndNode);
                targetRatio = 0.5;
              }
            }

            // Miro-like behavior: Use curved line when ports are on the same side
            // (left-left, right-right, top-top, bottom-bottom)
            if (sourcePort && targetPort && sourcePort === targetPort && !lastLineStyle) {
              effectiveLineStyle = 'curved';
            }

            // Ports auto-update based on element positions (no manual lock)
            addConnection({
              sourceId,
              targetId,
              sourcePort,
              targetPort,
              sourceRatio: connectSource.ratio ?? 0.5,
              targetRatio,
              sourcePos: sourceElement ? null : { x: connectSource.x, y: connectSource.y },
              targetPos: nearbyEndNode ? null : { x: endX, y: endY },
              lineStyle: effectiveLineStyle,
            });
            // Return to Select mode after creating a connection
            setActiveTool('select');
          }
        }
      }
      setIsConnecting(false);
      setConnectSource(null);
      setConnectMousePos(null);
    }

    // Clear refs immediately
    draggingElementRef.current = null;
    dragOffsetRef.current = { x: 0, y: 0 };
    dragStartPositionsRef.current = {};

    // Clear immediate event listeners if they still exist (safety cleanup)
    if (immediateMouseMoveRef.current) {
      document.removeEventListener('mousemove', immediateMouseMoveRef.current);
      immediateMouseMoveRef.current = null;
    }
    if (immediateMouseUpRef.current) {
      document.removeEventListener('mouseup', immediateMouseUpRef.current);
      immediateMouseUpRef.current = null;
    }

    // Also clear state for React re-renders
    setDraggingElement(null);
    setDragStartPositions({});
    setIsPanning(false);
    setDraggingWaypoint(null);
    setDraggingSegment(null);
    draggingSegmentRef.current = null;
    setDraggingEndpoint(null);
    draggingEndpointRef.current = null;
    setDraggingCurve(null);
    draggingCurveRef.current = null;
    setResizing(null);
    // Clear rotation state and record history if was rotating
    if (rotating) {
      recordHistory();
    }
    setRotating(null);
    setRotationIndicator(null);
    setIsRotating?.(false); // Notify context to show toolbar again
    setIsDragging?.(false); // Notify context that dragging ended
  }, [draggingElement, draggingWaypoint, draggingSegment, draggingEndpoint, draggingCurve, resizing, rotating, marquee, drawing, selectedStencil, stickyNoteColor, elements, packRegistry, selectElements, selectElement, addElement, recordHistory, isConnecting, connectSource, viewport, addConnection, updateConnection, updateElement, lastLineStyle, setIsDragging, setIsRotating]);

  // ============ PAN HANDLING ============

  const handleCanvasMouseDown = useCallback((e) => {
    // Clear any editing state when clicking on canvas
    setEditingLabelId(null);
    setEditingConnectionId(null);
    setShowConnectionToolbar(false); // Close connection toolbar on canvas click

    // Check if clicking on a resize handle
    const resizeHandle = e.target.closest('.ds-resize-handle');
    if (resizeHandle && !readOnly) {
      e.stopPropagation();
      e.preventDefault();

      const direction = resizeHandle.dataset.resize;
      const elementId = resizeHandle.dataset.elementId;
      const element = elements.find(el => el.id === elementId);

      // Don't allow resizing locked elements
      if (element && element.locked) return;

      if (element) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

          const pack = packRegistry?.get?.(element.packId);
          const stencil = pack?.stencils?.find(s => s.id === element.type);
          const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

          setResizing({
            elementId,
            direction,
            startMouseX: e.clientX,
            startMouseY: e.clientY,
            startSize: { ...size },
            startPos: { x: element.x, y: element.y },
          });
        }
      }
      return;
    }

    // Check if clicking on a rotation handle
    const rotationHandle = e.target.closest('.ds-rotation-handle');
    if (rotationHandle && !readOnly) {
      e.stopPropagation();
      e.preventDefault();

      const elementId = rotationHandle.dataset.elementId;
      const element = elements.find(el => el.id === elementId);

      // Don't allow rotating locked elements
      if (element && element.locked) return;

      if (element) {
        const pack = packRegistry?.get?.(element.packId);
        const stencil = pack?.stencils?.find(s => s.id === element.type);
        const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

        // Calculate element center in screen coordinates
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const centerX = rect.left + (element.x + size.width / 2 + viewport.x) * viewport.scale;
          const centerY = rect.top + (element.y + size.height / 2 + viewport.y) * viewport.scale;

          // Calculate initial angle from center to mouse
          const dx = e.clientX - centerX;
          const dy = e.clientY - centerY;
          const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

          setRotating({
            elementId,
            centerX,
            centerY,
            startAngle,
            startRotation: element.rotation || 0,
            startX: e.clientX,
            startY: e.clientY,
            hasMoved: false,
          });
          setIsRotating?.(true); // Notify context to hide toolbar

          // Show initial indicator
          setRotationIndicator({
            x: e.clientX,
            y: e.clientY,
            angle: element.rotation || 0,
          });
        }
      }
      return;
    }

    // Handle comment mode clicks - prioritize this before other canvas interactions
    // In comment mode, clicking anywhere should place a comment (including on nodes)
    if (commentMode && onCanvasClick) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        // Calculate canvas coordinates (not screen coordinates)
        const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
        const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

        // Check if clicking on a node to attach the comment to it
        const nodeElement = e.target.closest('.ds-node');
        const elementId = nodeElement?.dataset?.elementId || null;

        onCanvasClick(x, y, elementId);
      }
      return;
    }

    // Check if clicking on canvas background or space key is pressed
    // Simplified condition using proper parentheses for operator precedence
    const isOnCanvasBackground =
      e.target === canvasRef.current ||
      e.target.classList.contains('ds-grid') ||
      isSpacePressed ||
      (e.target.closest('.ds-canvas-inner') === e.target.closest('.ds-canvas')?.querySelector('.ds-canvas-inner') &&
       !e.target.closest('.ds-node') &&
       !e.target.closest('.ds-connection-group'));

    if (isOnCanvasBackground) {

      if (activeTool === 'pan' || e.button === 1 || isSpacePressed) { // Middle mouse button or space key
        setIsPanning(true);
        setPanStart({ x: e.clientX, y: e.clientY });
      } else if (!readOnly && activeTool === 'connect') {
        // Start freehand connection drawing
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          const y = (e.clientY - rect.top) / viewport.scale - viewport.y;
          setIsConnecting(true);
          setConnectSource({
            elementId: null, // null means freehand (not attached to element)
            portId: null,
            x: x,
            y: y,
          });
          setConnectMousePos({ x, y });
        }
      } else if (!readOnly && activeTool === 'draw' && selectedStencil) {
        // If there's a selection, first deselect and exit draw mode
        // This prevents accidental creation when clicking away from a selection
        if (selection?.nodeIds?.length > 0) {
          clearSelection();
          setSelectedStencil(null);
          setActiveTool('select');
          return;
        }
        // Start draw-to-size mode
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          const y = (e.clientY - rect.top) / viewport.scale - viewport.y;
          setDrawing({ startX: x, startY: y, currentX: x, currentY: y });
          clearSelection();
        }
      } else if (!readOnly && activeTool === 'sticky') {
        // Sticky note uses draw-to-size (drag to create)
        // Shift+click for instant placement at default size
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

          if (e.shiftKey) {
            // Shift+click: instant placement at default size
            const stickySize = 150;
            const newElement = {
              id: `sticky-${Date.now()}`,
              type: 'sticky-medium',
              packId: 'sticky-notes',
              label: '',
              x: snapToGrid(x - stickySize / 2),
              y: snapToGrid(y - stickySize / 2),
              size: { width: stickySize, height: stickySize },
              color: stickyNoteColor || '#fef08a',
              shape: 'sticky',
              data: {},
              isAnnotation: true,
            };
            recordHistory();
            addElement(newElement);
            selectElement(newElement.id);
          } else {
            // Regular click: start draw-to-size mode
            setDrawing({ startX: x, startY: y, currentX: x, currentY: y, isSticky: true });
            clearSelection();
          }
        }
      } else if (!readOnly && activeTool === 'select') {
        // In select mode:
        // - Regular drag = marquee selection
        // - Shift+drag = add to existing selection with marquee
        // (Space+drag for panning is handled above with isSpacePressed)
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
          const y = (e.clientY - rect.top) / viewport.scale - viewport.y;
          setMarquee({ startX: x, startY: y, currentX: x, currentY: y, addToSelection: e.shiftKey });
          if (!e.shiftKey) {
            clearSelection();
          }
        }
      } else {
        clearSelection();
      }
    }
  }, [activeTool, clearSelection, elements, viewport, readOnly, packRegistry, isSpacePressed, commentMode, onCanvasClick, selectedStencil, selection, setSelectedStencil, setActiveTool, stickyNoteColor, addElement, recordHistory, selectElement]);

  // ============ ZOOM HANDLING ============

  // Use effect to add non-passive wheel listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      const containerWidth = containerRef.current?.clientWidth || 1200;
      const containerHeight = containerRef.current?.clientHeight || 800;
      const rect = container.getBoundingClientRect();

      // Ctrl/Meta + wheel = zoom (centered on cursor)
      if (e.ctrlKey || e.metaKey) {
        if (profile?.uiPolicy?.allowZoom !== false) {
          e.preventDefault();
          e.stopPropagation();

          // Get cursor position relative to container
          const mouseX = e.clientX - rect.left;
          const mouseY = e.clientY - rect.top;

          const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

          setViewport(prev => {
            const newScale = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev.scale * zoomFactor));

            // Calculate new viewport to keep cursor position fixed on canvas
            // The point under cursor: canvasX = mouseX / scale - viewportX
            // After zoom: newViewportX = mouseX / newScale - canvasX
            const newX = prev.x + mouseX / newScale - mouseX / prev.scale;
            const newY = prev.y + mouseY / newScale - mouseY / prev.scale;

            return clampViewport({ x: newX, y: newY, scale: newScale }, containerWidth, containerHeight);
          });
        }
      } else if (profile?.uiPolicy?.allowPan !== false) {
        // Two-finger scroll (trackpad) or scroll wheel = pan
        e.preventDefault();
        e.stopPropagation();
        // deltaX is horizontal scroll, deltaY is vertical scroll
        // Divide by scale to maintain consistent pan speed at different zoom levels
        setViewport(prev => {
          const newViewport = {
            ...prev,
            x: prev.x - e.deltaX / prev.scale,
            y: prev.y - e.deltaY / prev.scale,
          };
          return clampViewport(newViewport, containerWidth, containerHeight);
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [profile, setViewport]);

  // ============ DRAG & DROP HANDLING ============

  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounterRef = useRef(0);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsDragOver(false);

    // Use containerRef for consistent bounding rect with drag handling
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Get drop position in canvas coordinates
    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    // Try to parse dropped data - try application/json first, then fallback to text/plain
    let rawData = e.dataTransfer.getData('application/json');
    if (!rawData) {
      rawData = e.dataTransfer.getData('text/plain');
    }
    if (!rawData) {
      console.warn('No drag data found');
      return;
    }

    try {
      const data = JSON.parse(rawData);

      if (data.type === 'stencil') {
        const pack = packRegistry?.get?.(data.packId || activePack);
        const stencil = pack?.stencils?.find(s => s.id === data.stencilId);

        if (stencil) {
          // Center the element on the drop point
          const snappedX = snapToGrid(x - (stencil.defaultSize?.width || 60) / 2);
          const snappedY = snapToGrid(y - (stencil.defaultSize?.height || 30) / 2);

          addElement({
            type: stencil.id,
            packId: data.packId || activePack,
            name: stencil.name,
            label: stencil.name,
            x: snappedX, // Allow any coordinate on infinite canvas
            y: snappedY,
            size: stencil.defaultSize || { width: 120, height: 60 },
            color: stencil.color,
          });
        }
      }

      // Handle sticky note drops from toolbar color picker
      if (data.type === 'sticky-note') {
        const stickyPack = packRegistry?.get?.('sticky-notes');
        const stencil = stickyPack?.stencils?.find(s => s.id === data.stencilId) ||
                        stickyPack?.stencils?.find(s => s.id === 'sticky-medium');

        if (stencil) {
          // Center the element on the drop point
          const snappedX = snapToGrid(x - (stencil.defaultSize?.width || 150) / 2);
          const snappedY = snapToGrid(y - (stencil.defaultSize?.height || 150) / 2);

          addElement({
            type: stencil.id,
            packId: 'sticky-notes',
            name: stencil.name,
            label: '',
            x: snappedX,
            y: snappedY,
            size: stencil.defaultSize || { width: 150, height: 150 },
            color: data.color || stencil.color,
          });
        }
      }
    } catch (err) {
      console.warn('Drop parse error:', err);
    }

    onDragEnd?.();
  }, [viewport, packRegistry, activePack, addElement, onDragEnd]);

  // ============ CONNECTION HANDLING ============

  const handlePortClick = useCallback((e) => {
    if (!canConnect || readOnly) return;

    const portEl = e.target.closest('.ds-port');
    if (!portEl) return;

    const elementId = portEl.dataset.elementId;
    const portId = portEl.dataset.port;

    if (!isConnecting) {
      // Start connection - need to include x,y for preview line
      const sourceElement = elements.find(el => el.id === elementId);
      if (sourceElement) {
        const portPosition = getPortPosition(sourceElement, portId, packRegistry);
        setIsConnecting(true);
        setConnectSource({ elementId, portId, ratio: 0.5, x: portPosition.x, y: portPosition.y }); // Port buttons are at center
      }
    } else {
      // Complete connection
      if (elementId !== connectSource.elementId) {
        // Use last line style if user changed it, otherwise get from source element's pack
        const sourceEl = elements.find(el => el.id === connectSource.elementId);
        const targetEl = elements.find(el => el.id === elementId);
        const sourcePack = sourceEl ? packRegistry?.get?.(sourceEl.packId) : null;
        const packDefaultLineStyle = sourcePack?.defaultLineStyle || 'curved';
        let effectiveLineStyle = lastLineStyle || packDefaultLineStyle;

        // Miro-like behavior: Use curved line when ports are on the same side
        const sourcePort = connectSource.portId;
        if (sourcePort && portId && sourcePort === portId && !lastLineStyle) {
          effectiveLineStyle = 'curved';
        }

        // Check if both elements are inside a frame (for clipping)
        const parentFrameId = sourceEl && targetEl
          ? findCommonParentFrame(sourceEl, targetEl, elements, packRegistry)
          : null;

        addConnection({
          sourceId: connectSource.elementId,
          targetId: elementId,
          sourcePort,
          targetPort: portId,
          sourceRatio: 0.5, // Port buttons are always at center
          targetRatio: 0.5,
          lineStyle: effectiveLineStyle,
          parentFrameId,
        });
        // Return to Select mode after creating a connection
        setActiveTool('select');
      }
      setIsConnecting(false);
      setConnectSource(null);
    }
  }, [isConnecting, connectSource, canConnect, readOnly, addConnection, elements, packRegistry, lastLineStyle, setActiveTool]);

  // ============ KEYBOARD SHORTCUTS ============

  // Clipboard operations now provided by useClipboard hook:
  // clipboardCopy, clipboardPaste, clipboardDuplicate

  // Nudge selected elements with arrow keys
  const handleNudge = useCallback((dx, dy) => {
    if (selection.nodeIds.length === 0 || readOnly) return;

    selection.nodeIds.forEach(id => {
      const el = elements.find(e => e.id === id);
      if (el) {
        updateElement(id, {
          x: snapToGrid(el.x + dx), // Allow any coordinate on infinite canvas
          y: snapToGrid(el.y + dy),
        });
      }
    });
    recordHistory();
  }, [selection.nodeIds, elements, updateElement, readOnly, recordHistory]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept keys when typing in input fields or contenteditable elements
      const activeEl = document.activeElement;
      if (activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA' || activeEl?.isContentEditable) return;

      // Space key for pan mode (only when not in a text field)
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        setIsSpacePressed(true);
      }

      // Escape - cancel current operation
      if (e.key === 'Escape') {
        setIsConnecting(false);
        setConnectSource(null);
        setConnectMousePos(null);
        setContextMenu(null);
        setMarquee(null);
        clearSelection();
      }

      // Ctrl/Cmd + A - Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        selectAll();
      }

      // Ctrl/Cmd + C - Copy
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && !readOnly) {
        e.preventDefault();
        clipboardCopy();
      }

      // Ctrl/Cmd + V - Paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && !readOnly) {
        e.preventDefault();
        clipboardPaste();
      }

      // Ctrl/Cmd + D - Duplicate
      if ((e.ctrlKey || e.metaKey) && e.key === 'd' && !readOnly) {
        e.preventDefault();
        clipboardDuplicate();
      }

      // Arrow keys - Nudge selected elements
      const nudgeAmount = e.shiftKey ? GRID_SIZE * 2 : GRID_SIZE;
      if (e.key === 'ArrowLeft' && !readOnly) {
        e.preventDefault();
        handleNudge(-nudgeAmount, 0);
      }
      if (e.key === 'ArrowRight' && !readOnly) {
        e.preventDefault();
        handleNudge(nudgeAmount, 0);
      }
      if (e.key === 'ArrowUp' && !readOnly) {
        e.preventDefault();
        handleNudge(0, -nudgeAmount);
      }
      if (e.key === 'ArrowDown' && !readOnly) {
        e.preventDefault();
        handleNudge(0, nudgeAmount);
      }

      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && !readOnly) {
        e.preventDefault();
        // Delete selected elements using selection state
        if (selection?.nodeIds?.length > 0) {
          selection.nodeIds.forEach(id => removeElement(id));
        }
        if (selection?.connectionIds?.length > 0) {
          selection.connectionIds.forEach(id => removeConnection(id));
        }
        clearSelection();
      }

      // M - Toggle minimap
      if (e.key === 'm' || e.key === 'M') {
        setShowMinimap(prev => !prev);
      }

      // T - Toggle connection toolbar when a connection is selected
      if ((e.key === 't' || e.key === 'T') && !readOnly) {
        if (selection?.connectionIds?.length === 1) {
          e.preventDefault();
          setShowConnectionToolbar(prev => !prev);
        }
      }

      // F - Fit all elements in view
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        if (elements.length > 0) {
          const containerWidth = containerRef.current?.clientWidth || 1200;
          const containerHeight = containerRef.current?.clientHeight || 800;
          zoomToFitAll(elements, containerWidth, containerHeight, 80);
        } else {
          resetZoom();
        }
      }

      // 0 (zero) or Home - Fit all elements in view (or reset if no elements)
      if ((e.key === '0' || e.key === 'Home') && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        if (elements.length > 0) {
          const containerWidth = containerRef.current?.clientWidth || 1200;
          const containerHeight = containerRef.current?.clientHeight || 800;
          zoomToFitAll(elements, containerWidth, containerHeight, 80);
        } else {
          resetZoom();
        }
      }

      // Cmd/Ctrl + 0 - Zoom to selection
      if (e.key === '0' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        if (selection?.nodeIds?.length > 0) {
          // Zoom to selected elements
          const selectedEls = elements.filter(el => selection.nodeIds.includes(el.id));
          if (selectedEls.length > 0) {
            const containerWidth = containerRef.current?.clientWidth || 1200;
            const containerHeight = containerRef.current?.clientHeight || 800;
            zoomToFitAll(selectedEls, containerWidth, containerHeight, 60);
          }
        } else {
          // No selection - reset view
          resetZoom();
        }
      }

      // Ctrl/Cmd + G - Group selected elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && !e.shiftKey && !readOnly) {
        e.preventDefault();
        if (selection?.nodeIds?.length >= 2) {
          groupElements(selection.nodeIds);
        }
      }

      // Ctrl/Cmd + Shift + G - Ungroup selected elements
      if ((e.ctrlKey || e.metaKey) && e.key === 'g' && e.shiftKey && !readOnly) {
        e.preventDefault();
        const selectedWithGroups = elements.filter(el =>
          selection?.nodeIds?.includes(el.id) && el.groupId
        );
        const groupIds = [...new Set(selectedWithGroups.map(el => el.groupId))];
        groupIds.forEach(groupId => ungroupElements(groupId));
      }

      // [ - Rotate 90° counter-clockwise
      if (e.key === '[' && !e.ctrlKey && !e.metaKey && !readOnly && selection?.nodeIds?.length > 0) {
        e.preventDefault();
        selection.nodeIds.forEach(id => {
          const el = elements.find(el => el.id === id);
          if (el && !el.locked) {
            const currentRotation = el.rotation || 0;
            let newRotation = currentRotation - 90;
            while (newRotation < -180) newRotation += 360;
            updateElement(id, { rotation: newRotation });
          }
        });
      }

      // ] - Rotate 90° clockwise
      if (e.key === ']' && !e.ctrlKey && !e.metaKey && !readOnly && selection?.nodeIds?.length > 0) {
        e.preventDefault();
        selection.nodeIds.forEach(id => {
          const el = elements.find(el => el.id === id);
          if (el && !el.locked) {
            const currentRotation = el.rotation || 0;
            let newRotation = currentRotation + 90;
            while (newRotation > 180) newRotation -= 360;
            updateElement(id, { rotation: newRotation });
          }
        });
      }

      // Shift + H - Flip horizontal
      if (e.key === 'H' && e.shiftKey && !e.ctrlKey && !e.metaKey && !readOnly && selection?.nodeIds?.length > 0) {
        e.preventDefault();
        selection.nodeIds.forEach(id => {
          const el = elements.find(el => el.id === id);
          if (el && !el.locked) {
            const currentScaleX = el.scaleX ?? 1;
            updateElement(id, { scaleX: currentScaleX * -1 });
          }
        });
      }

      // Shift + V - Flip vertical
      if (e.key === 'V' && e.shiftKey && !e.ctrlKey && !e.metaKey && !readOnly && selection?.nodeIds?.length > 0) {
        e.preventDefault();
        selection.nodeIds.forEach(id => {
          const el = elements.find(el => el.id === id);
          if (el && !el.locked) {
            const currentScaleY = el.scaleY ?? 1;
            updateElement(id, { scaleY: currentScaleY * -1 });
          }
        });
      }

      // S - Start creating a task/rectangle stencil
      if (e.key === 's' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !readOnly) {
        // Find the task stencil from ProcessFlowPack
        const processFlowPack = packRegistry?.get?.('process-flow');
        const taskStencil = processFlowPack?.stencils?.find(s => s.id === 'task');
        if (taskStencil) {
          e.preventDefault();
          setActiveTool('draw');
          setSelectedStencil({ ...taskStencil, packId: 'process-flow' });
        }
      }

      // C - Toggle connect mode for drawing connections
      if (e.key === 'c' && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey && !readOnly) {
        e.preventDefault();
        if (activeTool === 'connect') {
          // Exit connect mode
          setActiveTool('select');
        } else {
          // Enter connect mode
          setActiveTool('connect');
          setSelectedStencil(null);
        }
      }

      // Escape - Deselect stencil, exit connect mode, close toolbars, and clear selection
      if (e.key === 'Escape') {
        if (selectedStencil) {
          setSelectedStencil(null);
          setActiveTool('select');
        }
        if (activeTool === 'connect') {
          setActiveTool('select');
        }
        setShowConnectionToolbar(false);
        clearSelection();
      }

      // Text formatting shortcuts (when elements are selected)
      if ((e.ctrlKey || e.metaKey) && !readOnly && selection?.nodeIds?.length > 0) {
        const selectedEls = elements.filter(el => selection.nodeIds.includes(el.id));

        // Ctrl/Cmd + B - Toggle Bold
        if (e.key === 'b' && !e.shiftKey) {
          e.preventDefault();
          const isBold = selectedEls[0]?.fontWeight === 'bold' || selectedEls[0]?.fontWeight === '600' || selectedEls[0]?.fontWeight === '700';
          selectedEls.forEach(el => updateElement(el.id, { fontWeight: isBold ? 'normal' : 'bold' }));
        }

        // Ctrl/Cmd + I - Toggle Italic
        if (e.key === 'i' && !e.shiftKey) {
          e.preventDefault();
          const isItalic = selectedEls[0]?.fontStyle === 'italic';
          selectedEls.forEach(el => updateElement(el.id, { fontStyle: isItalic ? 'normal' : 'italic' }));
        }

        // Ctrl/Cmd + U - Toggle Underline
        if (e.key === 'u' && !e.shiftKey) {
          e.preventDefault();
          const isUnderline = selectedEls[0]?.textDecoration === 'underline';
          selectedEls.forEach(el => updateElement(el.id, { textDecoration: isUnderline ? 'none' : 'underline' }));
        }
      }

      // ============ MIND MAP RAPID CREATION ============
      // Tab - Create child node (when single mind map element selected)
      // Enter - Create sibling node (when single non-root mind map element selected)
      if (!readOnly && selection?.nodeIds?.length === 1) {
        const selectedEl = elements.find(el => el.id === selection.nodeIds[0]);

        if (selectedEl && isMindMapElement(selectedEl)) {
          // Tab - Create child
          if (e.key === 'Tab' && !e.shiftKey) {
            e.preventDefault();

            const childType = getMindMapChildType(selectedEl);
            const childSize = getMindMapStencilSize(childType);
            const childColor = getMindMapStencilColor(childType);
            const parentSize = selectedEl.size || getMindMapStencilSize(selectedEl.type);

            // Position child to the right of parent with spacing
            const spacing = 60;
            const childX = selectedEl.x + parentSize.width + spacing;
            const childY = selectedEl.y + (parentSize.height - childSize.height) / 2;

            // Find how many existing children to fan them out
            const existingChildren = connections.filter(c => c.sourceId === selectedEl.id);
            const yOffset = existingChildren.length * (childSize.height + 20);

            // Create the child element
            const childElement = addElement({
              type: childType,
              packId: 'mind-map',
              x: childX,
              y: childY + yOffset,
              size: childSize,
              color: childColor,
              label: '',
              parentId: selectedEl.id,
            });

            // Create curved connection (no arrowheads for mind map)
            addConnection({
              sourceId: selectedEl.id,
              targetId: childElement.id,
              sourcePort: 'right',
              targetPort: 'left',
              lineStyle: 'curved',
              sourceMarker: 'none',
              targetMarker: 'none',
            });

            // Select the new child and start editing
            selectElement(childElement.id);
            setEditingLabelId(childElement.id);
          }

          // Enter - Create sibling (only for non-root elements)
          if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey && !isCentralTopic(selectedEl)) {
            e.preventDefault();

            // Find the parent connection
            const parentConn = connections.find(c => c.targetId === selectedEl.id);
            if (parentConn) {
              const parentEl = elements.find(el => el.id === parentConn.sourceId);
              if (parentEl) {
                const siblingType = selectedEl.type;
                const siblingSize = selectedEl.size || getMindMapStencilSize(siblingType);
                const siblingColor = selectedEl.color || getMindMapStencilColor(siblingType);

                // Position sibling below the current element
                const spacing = 20;
                const siblingX = selectedEl.x;
                const siblingY = selectedEl.y + siblingSize.height + spacing;

                // Create the sibling element
                const siblingElement = addElement({
                  type: siblingType,
                  packId: 'mind-map',
                  x: siblingX,
                  y: siblingY,
                  size: siblingSize,
                  color: siblingColor,
                  label: '',
                  parentId: parentEl.id,
                });

                // Create curved connection from parent to sibling
                addConnection({
                  sourceId: parentEl.id,
                  targetId: siblingElement.id,
                  sourcePort: parentConn.sourcePort || 'right',
                  targetPort: parentConn.targetPort || 'left',
                  lineStyle: 'curved',
                  sourceMarker: 'none',
                  targetMarker: 'none',
                });

                // Select the new sibling and start editing
                selectElement(siblingElement.id);
                setEditingLabelId(siblingElement.id);
              }
            }
          }

          // Ctrl+Shift+] - Expand all (entire tree) - must check before Ctrl+]
          if (e.key === ']' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
            e.preventDefault();

            // Get all mind map elements and expand them
            elements.forEach(el => {
              if (isMindMapElement(el) && el.collapsed) {
                updateElement(el.id, { collapsed: false });
              }
            });
            return;
          }

          // Ctrl+[ - Collapse subtree
          if (e.key === '[' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();

            // Build hierarchy to check if this node has children
            const hierarchy = buildMindMapHierarchy(elements, connections);
            const children = hierarchy.childrenMap[selectedEl.id] || [];

            if (children.length > 0) {
              // Toggle collapsed state
              updateElement(selectedEl.id, { collapsed: true });
            }
            return;
          }

          // Ctrl+] - Expand subtree (single node)
          if (e.key === ']' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
            e.preventDefault();

            if (selectedEl.collapsed) {
              updateElement(selectedEl.id, { collapsed: false });
            }
            return;
          }
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === ' ') {
        setIsSpacePressed(false);
        setIsPanning(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [readOnly, clearSelection, selectAll, selection, elements, connections, removeElement, removeConnection, clipboardCopy, clipboardPaste, clipboardDuplicate, handleNudge, groupElements, ungroupElements, packRegistry, setActiveTool, setSelectedStencil, selectedStencil, updateElement, zoomToFitAll, resetZoom, addElement, addConnection, selectElement, setEditingLabelId]);

  // ============ ALIGNMENT HANDLERS ============

  // Get selected elements with their sizes
  const getSelectedElementsWithSizes = useCallback(() => {
    return elements
      .filter(el => selection.nodeIds.includes(el.id))
      .map(el => {
        const pack = packRegistry?.get?.(el.packId);
        const stencil = pack?.stencils?.find(s => s.id === el.type);
        const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };
        return { ...el, size };
      });
  }, [elements, selection.nodeIds, packRegistry]);

  // Align selected elements
  const handleAlign = useCallback((direction) => {
    const selectedEls = getSelectedElementsWithSizes();
    if (selectedEls.length < 2) return;

    let targetValue;
    switch (direction) {
      case 'left':
        targetValue = Math.min(...selectedEls.map(el => el.x));
        selectedEls.forEach(el => updateElement(el.id, { x: targetValue }));
        break;
      case 'center-h':
        const centerXs = selectedEls.map(el => el.x + el.size.width / 2);
        targetValue = (Math.min(...centerXs) + Math.max(...centerXs)) / 2;
        selectedEls.forEach(el => updateElement(el.id, { x: targetValue - el.size.width / 2 }));
        break;
      case 'right':
        targetValue = Math.max(...selectedEls.map(el => el.x + el.size.width));
        selectedEls.forEach(el => updateElement(el.id, { x: targetValue - el.size.width }));
        break;
      case 'top':
        targetValue = Math.min(...selectedEls.map(el => el.y));
        selectedEls.forEach(el => updateElement(el.id, { y: targetValue }));
        break;
      case 'center-v':
        const centerYs = selectedEls.map(el => el.y + el.size.height / 2);
        targetValue = (Math.min(...centerYs) + Math.max(...centerYs)) / 2;
        selectedEls.forEach(el => updateElement(el.id, { y: targetValue - el.size.height / 2 }));
        break;
      case 'bottom':
        targetValue = Math.max(...selectedEls.map(el => el.y + el.size.height));
        selectedEls.forEach(el => updateElement(el.id, { y: targetValue - el.size.height }));
        break;
    }
    recordHistory();
  }, [getSelectedElementsWithSizes, updateElement, recordHistory]);

  // Distribute selected elements evenly
  const handleDistribute = useCallback((direction) => {
    const selectedEls = getSelectedElementsWithSizes();
    if (selectedEls.length < 3) return;

    if (direction === 'horizontal') {
      // Sort by X position
      const sorted = [...selectedEls].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpace = (last.x + last.size.width) - first.x;
      const totalWidth = sorted.reduce((sum, el) => sum + el.size.width, 0);
      const gap = (totalSpace - totalWidth) / (sorted.length - 1);

      let currentX = first.x;
      sorted.forEach((el, i) => {
        if (i > 0) {
          updateElement(el.id, { x: snapToGrid(currentX) });
        }
        currentX += el.size.width + gap;
      });
    } else {
      // Sort by Y position
      const sorted = [...selectedEls].sort((a, b) => a.y - b.y);
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const totalSpace = (last.y + last.size.height) - first.y;
      const totalHeight = sorted.reduce((sum, el) => sum + el.size.height, 0);
      const gap = (totalSpace - totalHeight) / (sorted.length - 1);

      let currentY = first.y;
      sorted.forEach((el, i) => {
        if (i > 0) {
          updateElement(el.id, { y: snapToGrid(currentY) });
        }
        currentY += el.size.height + gap;
      });
    }
    recordHistory();
  }, [getSelectedElementsWithSizes, updateElement, recordHistory]);

  // Match size of selected elements
  const handleMatchSize = useCallback((dimension) => {
    const selectedEls = getSelectedElementsWithSizes();
    if (selectedEls.length < 2) return;

    // Use the first selected element as the reference
    const reference = selectedEls[0];

    selectedEls.slice(1).forEach(el => {
      const newSize = { ...el.size };
      if (dimension === 'width' || dimension === 'both') {
        newSize.width = reference.size.width;
      }
      if (dimension === 'height' || dimension === 'both') {
        newSize.height = reference.size.height;
      }
      updateElement(el.id, { size: newSize });
    });
    recordHistory();
  }, [getSelectedElementsWithSizes, updateElement, recordHistory]);

  // ============ START CONNECTION FROM NODE ============

  const handleNodeConnectionStart = useCallback((element, e, portId = null, ratio = 0.5) => {
    // Check both profile and layout settings for connection permissions
    if (!canConnect || readOnly) {
      return;
    }
    if (layoutSettings.allowConnections === false) {
      return;
    }

    e.stopPropagation();

    // Get element size
    const pack = packRegistry?.get?.(element.packId);
    const stencil = pack?.stencils?.find(s => s.id === element.type);
    const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

    // Calculate start position based on port and ratio
    // ratio is a 0-1 value indicating position along the edge
    let startX, startY;
    const effectivePort = portId || 'center';
    const clampedRatio = Math.max(0, Math.min(1, ratio));

    switch (effectivePort) {
      case 'top':
        // ratio goes from left (0) to right (1) along top edge
        startX = element.x + size.width * clampedRatio;
        startY = element.y;
        break;
      case 'bottom':
        // ratio goes from left (0) to right (1) along bottom edge
        startX = element.x + size.width * clampedRatio;
        startY = element.y + size.height;
        break;
      case 'left':
        // ratio goes from top (0) to bottom (1) along left edge
        startX = element.x;
        startY = element.y + size.height * clampedRatio;
        break;
      case 'right':
        // ratio goes from top (0) to bottom (1) along right edge
        startX = element.x + size.width;
        startY = element.y + size.height * clampedRatio;
        break;
      default:
        startX = element.x + size.width / 2;
        startY = element.y + size.height / 2;
    }

    setIsConnecting(true);
    setConnectSource({
      elementId: element.id,
      portId: effectivePort,
      ratio: clampedRatio,
      x: startX,
      y: startY,
    });
    setConnectMousePos({ x: startX, y: startY });
  }, [canConnect, readOnly, layoutSettings, packRegistry]);

  const handleNodeConnectionEnd = useCallback((targetElement, e) => {
    if (!isConnecting || !connectSource) {
      return;
    }

    e.stopPropagation();

    // Check if connections are allowed by layout settings
    if (layoutSettings.allowConnections === false) {
      setIsConnecting(false);
      setConnectSource(null);
      setConnectMousePos(null);
      return;
    }

    // Don't connect to self
    if (targetElement.id === connectSource.elementId) {
      setIsConnecting(false);
      setConnectSource(null);
      setConnectMousePos(null);
      return;
    }

    // Determine best ports based on relative positions
    const sourceEl = elements.find(el => el.id === connectSource.elementId);
    if (!sourceEl) {
      // Source element not found - clean up state and abort
      setIsConnecting(false);
      setConnectSource(null);
      setConnectMousePos(null);
      return;
    }

    // Validate hierarchy rules if defined
    if (layoutSettings.hierarchyRules) {
      const isValid = isValidHierarchyConnection(
        sourceEl.type,
        targetElement.type,
        layoutSettings.hierarchyRules
      );
      if (!isValid) {
        setIsConnecting(false);
        setConnectSource(null);
        setConnectMousePos(null);
        return;
      }
    }

    // Use source port/ratio from connection start if specified, otherwise auto-determine
    const autoPorts = determineBestPorts(sourceEl, targetElement);
    const sourcePort = connectSource.portId && connectSource.portId !== 'center'
      ? connectSource.portId
      : autoPorts.sourcePort;
    const sourceRatio = connectSource.ratio ?? 0.5;

    // Calculate target port and ratio from exact drop position
    let targetPort = autoPorts.targetPort;
    let targetRatio = 0.5;
    let targetIsManual = false;

    // Get mouse position to determine exact attachment point
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const endX = (e.clientX - rect.left) / viewport.scale - viewport.x;
      const endY = (e.clientY - rect.top) / viewport.scale - viewport.y;
      const targetPack = packRegistry?.get?.(targetElement.packId);
      const targetStencil = targetPack?.stencils?.find(s => s.id === targetElement.type);
      const targetSize = targetElement.size || targetStencil?.defaultSize || { width: 120, height: 60 };
      const borderInfo = detectBorderClick(endX, endY, targetElement, targetSize, 25);
      if (borderInfo.edge) {
        targetPort = borderInfo.edge;
        targetRatio = borderInfo.ratio;
        targetIsManual = true; // User dropped on specific border
      }
    }

    // Check if source has manual port (from edge handle or specific border)
    const validEdgePorts = ['top', 'right', 'bottom', 'left'];
    const sourceIsManual = validEdgePorts.includes(connectSource.portId);

    // Ports auto-update based on element positions (no manual lock)

    // Get default line style from source element's pack
    const sourcePack = packRegistry?.get?.(sourceEl.packId);
    const defaultLineStyle = sourcePack?.defaultLineStyle || 'curved';

    // Check if both elements are inside a frame (for clipping)
    const parentFrameId = findCommonParentFrame(sourceEl, targetElement, elements, packRegistry);

    const connectionData = {
      sourceId: connectSource.elementId,
      targetId: targetElement.id,
      sourcePort,
      targetPort,
      sourceRatio,
      targetRatio,
      lineStyle: defaultLineStyle,
      parentFrameId, // For clipping connection to frame bounds
    };
    addConnection(connectionData);

    // Return to Select mode after creating a connection
    setActiveTool('select');

    setIsConnecting(false);
    setConnectSource(null);
    setConnectMousePos(null);
  }, [isConnecting, connectSource, elements, addConnection, layoutSettings, packRegistry, setActiveTool]);

  // Helper to determine best connection ports
  function determineBestPorts(source, target) {
    const sourceSize = source.size || { width: 120, height: 60 };
    const targetSize = target.size || { width: 120, height: 60 };

    const sourceCX = source.x + sourceSize.width / 2;
    const sourceCY = source.y + sourceSize.height / 2;
    const targetCX = target.x + targetSize.width / 2;
    const targetCY = target.y + targetSize.height / 2;

    const dx = targetCX - sourceCX;
    const dy = targetCY - sourceCY;

    let sourcePort, targetPort;

    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal connection
      sourcePort = dx > 0 ? 'right' : 'left';
      targetPort = dx > 0 ? 'left' : 'right';
    } else {
      // Vertical connection
      sourcePort = dy > 0 ? 'bottom' : 'top';
      targetPort = dy > 0 ? 'top' : 'bottom';
    }

    return { sourcePort, targetPort };
  }

  // Helper to find a node near a given position (for freehand connection snapping)
  function findNearbyNode(x, y, elements, packRegistry, threshold = 15) {
    for (const el of elements) {
      const pack = packRegistry?.get?.(el.packId);
      const stencil = pack?.stencils?.find(s => s.id === el.type);
      const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };

      // Check if point is within or near the element bounds
      const expandedBounds = {
        left: el.x - threshold,
        right: el.x + size.width + threshold,
        top: el.y - threshold,
        bottom: el.y + size.height + threshold,
      };

      if (x >= expandedBounds.left && x <= expandedBounds.right &&
          y >= expandedBounds.top && y <= expandedBounds.bottom) {
        return el;
      }
    }
    return null;
  }

  // Helper to determine the best port for a point near a node
  function determineBestPort(x, y, element) {
    const size = element.size || { width: 120, height: 60 };
    const cx = element.x + size.width / 2;
    const cy = element.y + size.height / 2;

    const dx = x - cx;
    const dy = y - cy;

    if (Math.abs(dx) > Math.abs(dy)) {
      return dx > 0 ? 'right' : 'left';
    } else {
      return dy > 0 ? 'bottom' : 'top';
    }
  }

  // ============ QUICK CREATE HANDLING ============
  // Uses useQuickCreate hook for element and connection creation

  const handleQuickCreate = useCallback((sourceElement, direction) => {
    // Get pack and stencil info
    const pack = packRegistry?.get?.(sourceElement.packId);
    const stencil = pack?.stencils?.find(s => s.id === sourceElement.type);
    const defaultLineStyle = pack?.defaultLineStyle || 'curved';

    // Use hook to create element and connection
    const result = hookQuickCreate(sourceElement, direction, {
      stencil: stencil ? { ...stencil, packId: sourceElement.packId } : null,
      label: stencil?.name || 'New Node',
      connectionOptions: { lineStyle: defaultLineStyle },
    });

    // Start editing label on the new element
    if (result?.element) {
      setEditingLabelId(result.element.id);
    }
  }, [packRegistry, hookQuickCreate]);

  // ============ CONNECTION EDITING ============

  const handleConnectionDoubleClick = useCallback((connection, e) => {
    if (readOnly) return;

    // Get click position in canvas coordinates
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const clickY = (e.clientY - rect.top) / viewport.scale - viewport.y;

    // Get source and target positions to calculate label position
    const source = elements.find(el => el.id === connection.sourceId);
    const target = elements.find(el => el.id === connection.targetId);
    const sourcePos = source
      ? getPortPosition(source, connection.sourcePort || 'bottom', packRegistry, connection.sourceRatio ?? 0.5)
      : connection.sourcePos;
    const targetPos = target
      ? getPortPosition(target, connection.targetPort || 'top', packRegistry, connection.targetRatio ?? 0.5)
      : connection.targetPos;

    if (!sourcePos || !targetPos) return;

    const labelPos = calculateMidLabelPosition(sourcePos, targetPos, connection.waypoints || []);

    // Check if click is near the label area (within 50px radius)
    const distToLabel = Math.sqrt((clickX - labelPos.x) ** 2 + (clickY - labelPos.y) ** 2);

    if (distToLabel < 50) {
      // Double-click near label - enter label editing mode
      setEditingConnectionId(connection.id);
    }
    // Double-click elsewhere just selects the connection and shows toolbar
    // Use shift+click or shift+double-click to add waypoints instead

    selectConnection(connection.id);
  }, [readOnly, selectConnection, viewport, elements, packRegistry]);

  const handleConnectionLabelChange = useCallback((connectionId, label, waypoints) => {
    const updates = { label };
    if (waypoints !== undefined) {
      updates.waypoints = waypoints;
    }
    updateConnection(connectionId, updates);
  }, [updateConnection]);

  const handleWaypointDragStart = useCallback((connectionId, waypointIndex, e) => {
    e.stopPropagation();
    setDraggingWaypoint({ connectionId, waypointIndex });
  }, []);

  // Handler for starting segment drag (for step/orthogonal lines)
  const handleSegmentDragStart = useCallback((connectionId, segmentIndex, isHorizontal, e) => {
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / viewport.scale - viewport.x;
    const y = (e.clientY - rect.top) / viewport.scale - viewport.y;

    // Get the connection and its current waypoints
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      // Get source and target positions
      const sourceEl = elements.find(el => el.id === connection.sourceId);
      const targetEl = elements.find(el => el.id === connection.targetId);
      if (sourceEl && targetEl) {
        const sourcePos = getPortPosition(sourceEl, connection.sourcePort || 'right', packRegistry, connection.sourceRatio ?? 0.5);
        const targetPos = getPortPosition(targetEl, connection.targetPort || 'left', packRegistry, connection.targetRatio ?? 0.5);

        // Get stencil bounds for routing
        const sourcePack = packRegistry?.get?.(sourceEl.packId);
        const sourceStencil = sourcePack?.stencils?.find(s => s.id === sourceEl.type);
        const sourceSize = sourceEl.size || sourceStencil?.defaultSize || { width: 120, height: 60 };
        const sourceBounds = { x: sourceEl.x, y: sourceEl.y, width: sourceSize.width, height: sourceSize.height };

        const targetPack = packRegistry?.get?.(targetEl.packId);
        const targetStencil = targetPack?.stencils?.find(s => s.id === targetEl.type);
        const targetSize = targetEl.size || targetStencil?.defaultSize || { width: 120, height: 60 };
        const targetBounds = { x: targetEl.x, y: targetEl.y, width: targetSize.width, height: targetSize.height };

        // CRITICAL: Use buildOrthogonalPath to get the EXACT same points array
        // that was used to calculate the segments. This includes all post-processing:
        // - ensureCorrectApproach
        // - removeReversals
        // - routeAroundSelfStencils
        const lineStyle = connection.lineStyle || 'step';
        const sharp = lineStyle === 'step-sharp';
        const pathResult = buildOrthogonalPath(sourcePos, targetPos, connection.sourcePort, connection.targetPort, {
          sharp,
          waypoints: connection.waypoints || [],
          sourceBounds,
          targetBounds,
        });

        // Store the full points array (matching what segments were calculated from)
        const segmentData = {
          connectionId,
          segmentIndex,
          isHorizontal,
          startMousePos: { x, y },
          originalAllPoints: pathResult.points, // Use the PROCESSED points array
        };
        draggingSegmentRef.current = segmentData;
        setDraggingSegment(segmentData);
      }
    }
  }, [connections, elements, viewport, packRegistry]);

  // Handler for starting curve drag (for curved/arc lines)
  const handleCurveDragStart = useCallback((connectionId, sourcePos, targetPos, e) => {
    e.stopPropagation();
    const curveData = { connectionId, sourcePos, targetPos };
    draggingCurveRef.current = curveData; // Update ref synchronously for document handler
    setDraggingCurve(curveData);
  }, []);

  const handleAddWaypoint = useCallback((connectionId, position) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    const newWaypoints = [...(connection.waypoints || []), position];
    // Mark as manually adjusted when user adds a waypoint
    updateConnection(connectionId, { waypoints: newWaypoints, hasManualWaypoints: true });
  }, [connections, updateConnection]);

  const handleClearWaypoints = useCallback((connectionId) => {
    // Clear waypoints and reset manual flag to allow auto-routing
    updateConnection(connectionId, { waypoints: [], hasManualWaypoints: false });
  }, [updateConnection]);

  // Handler for starting endpoint drag - allows repositioning on element border
  const handleEndpointDragStart = useCallback((connectionId, endpoint, e) => {
    e.stopPropagation();

    // Check if the endpoint is attached to a locked element
    const connection = connections.find(c => c.id === connectionId);
    if (connection) {
      const attachedElementId = endpoint === 'source' ? connection.sourceId : connection.targetId;
      const attachedElement = elements.find(el => el.id === attachedElementId);
      if (attachedElement?.locked) {
        // Don't allow dragging endpoints from locked elements
        return;
      }
    }

    const endpointData = { connectionId, endpoint };
    draggingEndpointRef.current = endpointData; // Update ref synchronously for document handler
    setDraggingEndpoint(endpointData);
  }, [connections, elements]);

  // ============ CONTEXT MENU ============

  const handleContextMenu = useCallback((e) => {
    e.preventDefault();

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX;
    const y = e.clientY;

    // Check if right-clicking on a node
    const nodeEl = e.target.closest('.ds-node');
    const connectionEl = e.target.closest('.ds-connection-group');

    let menuItems = [];

    if (nodeEl) {
      const nodeId = nodeEl.dataset?.nodeId;
      if (nodeId && !readOnly) {
        menuItems = [
          { label: 'Edit Label', action: 'edit-label', icon: '✏️' },
          { label: 'Properties', action: 'properties', icon: '⚙️', shortcut: 'P' },
          { label: 'Show Toolbar', action: 'show-toolbar', icon: '🎛️', shortcut: 'T' },
          { label: 'Duplicate', action: 'duplicate', icon: '📋' },
          { type: 'divider' },
          { label: 'Bring to Front', action: 'bring-front', icon: '⬆️' },
          { label: 'Send to Back', action: 'send-back', icon: '⬇️' },
          { type: 'divider' },
          { label: 'Delete', action: 'delete', icon: '🗑️', danger: true },
        ];
      }
    } else if (connectionEl) {
      const connId = connectionEl.dataset?.connectionId;
      const conn = connections.find(c => c.id === connId);

      if (conn) {
        // Select the connection
        selectConnection(connId);

        if (!readOnly) {
          // Show context menu for connection - styling is in the toolbar (press T)
          menuItems = [
            { label: 'Edit Properties (T)', action: 'connection-properties', icon: '⚙️' },
            { type: 'divider' },
            { label: 'Reverse Direction', action: 'connection-reverse', icon: '⇄' },
            { type: 'divider' },
            { label: 'Delete', action: 'connection-delete', icon: '🗑️', danger: true },
          ];
        }
      }
    } else {
      // Canvas background
      menuItems = [
        { label: 'Select All', action: 'select-all', icon: '☑️' },
        { label: 'Paste', action: 'paste', icon: '📋', disabled: true },
        { type: 'divider' },
        { label: 'Fit to View', action: 'fit-view', icon: '🔍' },
        { label: 'Reset Zoom', action: 'reset-zoom', icon: '↺' },
      ];
    }

    if (menuItems.length > 0) {
      setContextMenu({ x, y, items: menuItems, nodeEl, connectionEl });
    }
  }, [readOnly, connections, selectConnection]);

  const handleContextMenuAction = useCallback((action, nodeEl, connectionEl) => {
    setContextMenu(null);

    const nodeId = nodeEl?.dataset?.nodeId;
    const connectionId = connectionEl?.dataset?.connectionId;

    switch (action) {
      case 'edit-label':
        if (nodeId) {
          setEditingLabelId(nodeId);
          selectElement(nodeId);
        }
        break;
      case 'properties':
        if (nodeId) {
          selectElement(nodeId);
          onShowProperties?.();
        }
        break;
      case 'show-toolbar':
        if (nodeId) {
          selectElement(nodeId);
          onShowToolbar?.();
        }
        break;
      case 'delete':
        if (nodeId) {
          removeElement(nodeId);
        }
        break;
      case 'delete-connection':
        if (connectionId) {
          removeConnection(connectionId);
        }
        break;
      case 'duplicate':
        if (nodeId) {
          const element = elements.find(el => el.id === nodeId);
          if (element) {
            addElement({
              ...element,
              id: undefined,
              x: element.x + 20,
              y: element.y + 20,
              label: `${element.label || element.name} (copy)`,
            });
          }
        }
        break;
      case 'select-all':
        // Select all elements
        elements.forEach(el => selectElement(el.id, true));
        break;
      case 'fit-view':
      case 'reset-zoom':
        setViewport({ x: 0, y: 0, scale: 1 });
        break;
      case 'edit-connection-label':
        if (connectionId) {
          setEditingConnectionId(connectionId);
          selectConnection(connectionId);
        }
        break;
      case 'line-smart':
        if (connectionId) updateConnection(connectionId, { lineStyle: 'smart' });
        break;
      case 'line-straight':
        if (connectionId) updateConnection(connectionId, { lineStyle: 'straight' });
        break;
      case 'line-curved':
        if (connectionId) updateConnection(connectionId, { lineStyle: 'curved' });
        break;
      case 'line-arc':
        if (connectionId) updateConnection(connectionId, { lineStyle: 'arc' });
        break;
      case 'line-step':
        if (connectionId) updateConnection(connectionId, { lineStyle: 'step' });
        break;
      case 'stroke-1':
        if (connectionId) updateConnection(connectionId, { strokeWidth: 1 });
        break;
      case 'stroke-2':
        if (connectionId) updateConnection(connectionId, { strokeWidth: 2 });
        break;
      case 'stroke-3':
        if (connectionId) updateConnection(connectionId, { strokeWidth: 3 });
        break;
      case 'solid':
        if (connectionId) updateConnection(connectionId, { dashed: false });
        break;
      case 'dashed':
        if (connectionId) updateConnection(connectionId, { dashed: true });
        break;
      case 'add-waypoint':
        if (connectionId) {
          const conn = connections.find(c => c.id === connectionId);
          if (conn) {
            const sourceEl = elements.find(e => e.id === conn.sourceId);
            const targetEl = elements.find(e => e.id === conn.targetId);
            if (sourceEl && targetEl) {
              const sourceSize = sourceEl.size || { width: 120, height: 60 };
              const targetSize = targetEl.size || { width: 120, height: 60 };
              const midX = (sourceEl.x + sourceSize.width / 2 + targetEl.x + targetSize.width / 2) / 2;
              const midY = (sourceEl.y + sourceSize.height / 2 + targetEl.y + targetSize.height / 2) / 2;
              handleAddWaypoint(connectionId, { x: midX, y: midY });
            }
          }
        }
        break;
      case 'clear-waypoints':
        if (connectionId) handleClearWaypoints(connectionId);
        break;
      case 'connection-properties':
        if (connectionId) {
          selectConnection(connectionId);
          setShowConnectionToolbar(true);
        }
        break;
      case 'connection-reverse':
        if (connectionId) {
          const conn = connections.find(c => c.id === connectionId);
          if (conn) {
            updateConnection(connectionId, {
              sourceId: conn.targetId,
              targetId: conn.sourceId,
              sourcePort: conn.targetPort,
              targetPort: conn.sourcePort,
              sourcePos: conn.targetPos,
              targetPos: conn.sourcePos,
            });
          }
        }
        break;
      case 'connection-delete':
        if (connectionId) {
          removeConnection(connectionId);
        }
        break;
      default:
        break;
    }
  }, [elements, connections, addElement, removeElement, removeConnection, updateConnection, selectElement, selectConnection, setViewport, handleAddWaypoint, handleClearWaypoints, setShowConnectionToolbar]);

  // ============ RENDER ============

  return (
    <div
      ref={containerRef}
      className={`ds-canvas-area ${className} ${isSpacePressed ? 'space-pan' : ''} ${isPanning ? 'panning' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={handleContextMenu}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div
        ref={canvasRef}
        className="ds-canvas"
        onMouseDown={handleCanvasMouseDown}
        onClick={handlePortClick}
        style={{
          cursor: isPanning ? 'grabbing' : isConnecting ? 'crosshair' : commentMode ? 'crosshair' : activeTool === 'pan' ? 'grab' : activeTool === 'draw' ? 'crosshair' : activeTool === 'sticky' ? 'crosshair' : 'default',
        }}
      >
        <div
          className="ds-canvas-inner"
          style={{
            transform: `scale(${viewport.scale}) translate(${viewport.x}px, ${viewport.y}px)`,
            transformOrigin: '0 0',
            width: INFINITE_CANVAS_SIZE,
            height: INFINITE_CANVAS_SIZE,
          }}
        >
          {/* Grid */}
          <Grid showGrid={showGrid && profile?.uiPolicy?.showGrid !== false} gridStyle={gridStyle} viewport={viewport} />

          {/* Marquee Selection Rectangle */}
          {marquee && (
            <div
              className="ds-marquee"
              style={{
                position: 'absolute',
                left: Math.min(marquee.startX, marquee.currentX),
                top: Math.min(marquee.startY, marquee.currentY),
                width: Math.abs(marquee.currentX - marquee.startX),
                height: Math.abs(marquee.currentY - marquee.startY),
                border: '2px dashed var(--selection, #4FB3CE)',
                backgroundColor: 'rgba(79, 179, 206, 0.1)',
                pointerEvents: 'none',
                zIndex: 1000,
              }}
            />
          )}

          {/* Draw-to-size Preview Rectangle */}
          {drawing && selectedStencil && (
            <div
              className="ds-draw-preview"
              style={{
                position: 'absolute',
                left: Math.min(drawing.startX, drawing.currentX),
                top: Math.min(drawing.startY, drawing.currentY),
                width: Math.abs(drawing.currentX - drawing.startX),
                height: Math.abs(drawing.currentY - drawing.startY),
                border: '2px solid var(--selection, #4FB3CE)',
                backgroundColor: 'rgba(79, 179, 206, 0.15)',
                borderRadius: '4px',
                pointerEvents: 'none',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{
                fontSize: '12px',
                fontWeight: 600,
                color: 'var(--selection, #4FB3CE)',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                padding: '2px 8px',
                borderRadius: '4px',
                whiteSpace: 'nowrap',
              }}>
                {Math.abs(drawing.currentX - drawing.startX).toFixed(0)} × {Math.abs(drawing.currentY - drawing.startY).toFixed(0)}
              </span>
            </div>
          )}

          {/* Connections Layer (SVG) */}
          <svg className="ds-connections" width="100%" height="100%">
            <defs>
              {/* Connection markers */}
              <ConnectionMarkers
                defaultColor="var(--text-muted)"
                selectedColor="var(--selection, #4FB3CE)"
              />
              {/* Temp arrow marker for connection-in-progress */}
              <ArrowMarker id="arrow-temp" color="var(--selection, #4FB3CE)" />
              {/* ClipPath definitions for frames - connections inside frames are clipped to frame bounds */}
              {elements.filter(el => el.type === 'frame').map(frame => {
                const pack = packRegistry?.get?.(frame.packId);
                const stencil = pack?.stencils?.find(s => s.id === frame.type);
                const frameSize = frame.size || stencil?.defaultSize || { width: 600, height: 400 };
                const frameOffset = dragState?.ids?.has(frame.id) ? dragState.offset : null;
                const frameX = frame.x + (frameOffset ? frameOffset.x : 0);
                const frameY = frame.y + (frameOffset ? frameOffset.y : 0);
                // Add some padding so connections don't get cut off at the exact edge
                const padding = 10;
                return (
                  <clipPath key={`clip-${frame.id}`} id={`clip-frame-${frame.id}`}>
                    <rect
                      x={frameX - padding}
                      y={frameY - padding}
                      width={frameSize.width + padding * 2}
                      height={frameSize.height + padding * 2}
                    />
                  </clipPath>
                );
              })}
            </defs>
            {/* Render connections - filtered for collapsed nodes */}
            {(visibleConnections || []).map(conn => (
              <Connection
                key={conn.id}
                connection={conn}
                elements={visibleElements}
                packRegistry={packRegistry}
                isSelected={isConnectionSelected(conn.id)}
                isHovered={hoveredConnectionId === conn.id}
                isEditingLabel={editingConnectionId === conn.id}
                onSelect={selectConnection}
                onDoubleClick={handleConnectionDoubleClick}
                onUpdate={(updates) => updateConnection(conn.id, updates)}
                onDelete={() => {
                  removeConnection(conn.id);
                  clearSelection();
                }}
                onLabelChange={handleConnectionLabelChange}
                onEditingDone={(id, editing) => setEditingConnectionId(editing ? id : null)}
                onMouseEnter={() => setHoveredConnectionId(conn.id)}
                onMouseLeave={() => setHoveredConnectionId(null)}
                onWaypointDrag={handleWaypointDragStart}
                onSegmentDrag={handleSegmentDragStart}
                onEndpointDrag={handleEndpointDragStart}
                onCurveDrag={handleCurveDragStart}
                dragState={dragState}
                readOnly={readOnly}
              />
            ))}
            {/* Crossing indicators - render after connections */}
            <CrossingIndicators
              connections={visibleConnections || []}
              elements={visibleElements}
              packRegistry={packRegistry}
            />
            {/* Temporary connection line while dragging - shows orthogonal preview */}
            {isConnecting && connectSource && connectMousePos && (() => {
              // Get source element for line style
              const sourceEl = connectSource.elementId
                ? elements.find(e => e.id === connectSource.elementId)
                : null;

              // Use the manually set source port
              const sourcePort = connectSource.portId || 'right';

              // For preview target, use opposite of source port direction
              const oppositePort = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };
              const targetPort = oppositePort[sourcePort] || 'left';

              // Get source pack for default line style
              const sourcePack = sourceEl ? packRegistry?.get?.(sourceEl.packId) : null;
              const defaultLineStyle = sourcePack?.defaultLineStyle || 'step';

              // For orthogonal line styles, show orthogonal preview
              if (defaultLineStyle === 'step' || defaultLineStyle === 'step-sharp') {
                const sourcePos = { x: connectSource.x, y: connectSource.y };
                const targetPos = connectMousePos;

                // Calculate source bounds to avoid path crossing through source stencil
                let sourceBounds = null;
                if (sourceEl) {
                  const sourceStencil = sourcePack?.stencils?.find(s => s.id === sourceEl.type);
                  const sourceSize = sourceEl.size || sourceStencil?.defaultSize || { width: 120, height: 60 };
                  sourceBounds = {
                    x: sourceEl.x,
                    y: sourceEl.y,
                    width: sourceSize.width,
                    height: sourceSize.height,
                  };
                }

                // Use buildOrthogonalPath for preview to match final rendering
                // This ensures path routes around source stencil during preview
                const pathResult = buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, {
                  sharp: defaultLineStyle === 'step-sharp',
                  sourceBounds,
                  targetBounds: null, // Target not determined yet during drag
                });

                const pathStr = pathResult.path || `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;

                return (
                  <path
                    className="ds-connection ds-connection-temp"
                    d={pathStr}
                    stroke="var(--selection, #4FB3CE)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                    markerEnd="url(#arrow-temp)"
                    style={{ pointerEvents: 'none' }}
                  />
                );
              }

              // Fallback to straight line for other line styles - use buildStraightPath for snap-to-straight
              const straightPath = buildStraightPath(
                { x: connectSource.x, y: connectSource.y },
                connectMousePos
              );
              return (
                <path
                  className="ds-connection ds-connection-temp"
                  d={straightPath}
                  stroke="var(--selection, #4FB3CE)"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                  fill="none"
                  markerEnd="url(#arrow-temp)"
                  style={{ pointerEvents: 'none' }}
                />
              );
            })()}
            {/* Endpoint drag preview - shows where the endpoint will be placed */}
            {draggingEndpoint?.previewPos && (() => {
              const conn = connections.find(c => c.id === draggingEndpoint.connectionId);
              if (!conn) return null;

              // Get the fixed endpoint position (the one NOT being dragged)
              const isSource = draggingEndpoint.endpoint === 'source';
              let fixedPos;
              if (isSource) {
                const targetEl = elements.find(e => e.id === conn.targetId);
                fixedPos = targetEl
                  ? getPortPosition(targetEl, conn.targetPort || 'left', packRegistry, conn.targetRatio ?? 0.5)
                  : conn.targetPos;
              } else {
                const sourceEl = elements.find(e => e.id === conn.sourceId);
                fixedPos = sourceEl
                  ? getPortPosition(sourceEl, conn.sourcePort || 'right', packRegistry, conn.sourceRatio ?? 0.5)
                  : conn.sourcePos;
              }

              if (!fixedPos) return null;

              // Build preview path based on connection's lineStyle
              let previewPath;
              const lineStyle = conn.lineStyle || 'step';

              if (lineStyle === 'step' || lineStyle === 'step-sharp') {
                // Use orthogonal path for step lines
                const sourcePos = isSource ? draggingEndpoint.previewPos : fixedPos;
                const targetPos = isSource ? fixedPos : draggingEndpoint.previewPos;
                // Ports stay with their original roles, not swapped with positions
                const sourcePort = conn.sourcePort || 'right';
                const targetPort = conn.targetPort || 'left';

                const pathResult = buildOrthogonalPath(sourcePos, targetPos, sourcePort, targetPort, {
                  sharp: lineStyle === 'step-sharp',
                });
                previewPath = pathResult.path || `M ${sourcePos.x} ${sourcePos.y} L ${targetPos.x} ${targetPos.y}`;
              } else if (lineStyle === 'straight') {
                // Use buildStraightPath for snap-to-straight
                previewPath = buildStraightPath(fixedPos, draggingEndpoint.previewPos);
              } else {
                // For curved/arc, just use a simple line preview
                previewPath = `M ${fixedPos.x} ${fixedPos.y} L ${draggingEndpoint.previewPos.x} ${draggingEndpoint.previewPos.y}`;
              }

              return (
                <g style={{ pointerEvents: 'none' }}>
                  {/* Preview line from fixed point to cursor */}
                  <path
                    d={previewPath}
                    stroke="var(--selection, #4FB3CE)"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                    fill="none"
                  />
                  {/* Preview endpoint circle */}
                  <circle
                    cx={draggingEndpoint.previewPos.x}
                    cy={draggingEndpoint.previewPos.y}
                    r="8"
                    fill="var(--selection, #4FB3CE)"
                    fillOpacity="0.3"
                    stroke="var(--selection, #4FB3CE)"
                    strokeWidth="2"
                  />
                </g>
              );
            })()}

            {/* Snap Guides */}
            {(draggingElement || isConnecting) && (
              <>
                {/* Vertical guides */}
                {snapGuides.vertical.map((guide, idx) => (
                  <line
                    key={`v-${idx}`}
                    x1={guide.x}
                    y1={guide.y1 - 20}
                    x2={guide.x}
                    y2={guide.y2 + 20}
                    stroke={guide.type === 'center' ? 'var(--selection, #4FB3CE)' : '#22c55e'}
                    strokeWidth="1"
                    strokeDasharray={guide.type === 'center' ? '4,4' : 'none'}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
                {/* Horizontal guides */}
                {snapGuides.horizontal.map((guide, idx) => (
                  <line
                    key={`h-${idx}`}
                    x1={guide.x1 - 20}
                    y1={guide.y}
                    x2={guide.x2 + 20}
                    y2={guide.y}
                    stroke={guide.type === 'center' ? 'var(--selection, #4FB3CE)' : '#22c55e'}
                    strokeWidth="1"
                    strokeDasharray={guide.type === 'center' ? '4,4' : 'none'}
                    style={{ pointerEvents: 'none' }}
                  />
                ))}
              </>
            )}
          </svg>

          {/* Nodes Layer - sorted by zIndex for proper layering, filtered for collapsed */}
          {[...visibleElements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0)).map(element => (
            <Node
              key={element.id}
              element={element}
              isSelected={isElementSelected(element.id)}
              isDragging={draggingElement === element.id}
              isCollapsed={element.collapsed && isMindMapElement(element)}
              collapsedChildCount={element.collapsedChildCount || 0}
              onSelect={(id, shiftKey) => {
                if (shiftKey) {
                  toggleElementSelection(id);
                } else {
                  selectElement(id);
                }
              }}
              onDragStart={handleDragStart}
              onConnectStart={handleNodeConnectionStart}
              onConnectEnd={handleNodeConnectionEnd}
              onLabelChange={(id, label) => updateElement(id, { label })}
              onQuickCreate={handleQuickCreate}
              packRegistry={packRegistry}
              readOnly={readOnly}
              renderNode={renderNode}
              isConnectMode={activeTool === 'connect'}
              isConnecting={isConnecting}
              isEditingLabel={editingLabelId === element.id}
              onEditingLabelDone={(id, editing) => setEditingLabelId(editing ? id : null)}
              onShowProperties={onShowProperties}
              activePack={activePack}
              hasConnections={connections?.some(c => c.sourceId === element.id || c.targetId === element.id) || false}
              commentMode={commentMode}
            />
          ))}

          {/* Endpoint Handles Overlay - renders ON TOP of nodes for accessibility */}
          <svg
            className="ds-endpoint-overlay"
            width="100%"
            height="100%"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              pointerEvents: 'none',
              overflow: 'visible',
              zIndex: 50, // Higher than edge handles (z-index: 12) so endpoints can be grabbed
            }}
          >
            <g>
              {/* Render endpoint handles for selected or hovered connections on top of everything */}
              {/* Note: No transform needed here since ds-canvas-inner parent already applies viewport transform */}
              {connections.filter(conn => isConnectionSelected(conn.id) || hoveredConnectionId === conn.id).map(conn => {
                const isSelected = isConnectionSelected(conn.id);
                const isHovered = hoveredConnectionId === conn.id && !isSelected;
                const source = elements.find(e => e.id === conn.sourceId);
                const target = elements.find(e => e.id === conn.targetId);

                // Ports are always sticky - they only change when user explicitly changes them
                // No auto-port selection; use stored ports directly
                const effectiveSourcePort = conn.sourcePort || 'right';
                const effectiveTargetPort = conn.targetPort || 'left';

                // Calculate source position using effective port
                let sourcePos;
                if (source) {
                  sourcePos = getPortPosition(source, effectiveSourcePort, packRegistry, conn.sourceRatio ?? 0.5);
                } else if (conn.sourcePos) {
                  sourcePos = conn.sourcePos;
                }

                // Calculate target position using effective port
                let targetPos;
                if (target) {
                  targetPos = getPortPosition(target, effectiveTargetPort, packRegistry, conn.targetRatio ?? 0.5);
                } else if (conn.targetPos) {
                  targetPos = conn.targetPos;
                }

                if (!sourcePos || !targetPos) return null;

                // Style differently for selected vs hovered
                const handleRadius = isSelected ? 10 : 8;
                const handleFill = isSelected ? 'white' : 'var(--bg)';
                const handleStroke = 'var(--selection, #4FB3CE)';
                const handleStrokeWidth = isSelected ? 2 : 1.5;
                const handleOpacity = isSelected ? 1 : 0.9;

                return (
                  <g key={`endpoint-overlay-${conn.id}`} style={{ opacity: handleOpacity }}>
                    {/* Source endpoint handle */}
                    <circle
                      cx={sourcePos.x}
                      cy={sourcePos.y}
                      r={handleRadius}
                      fill={handleFill}
                      stroke={handleStroke}
                      strokeWidth={handleStrokeWidth}
                      style={{ cursor: 'move', pointerEvents: 'auto' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleEndpointDragStart(conn.id, 'source', e);
                      }}
                      onMouseEnter={() => setHoveredConnectionId(conn.id)}
                    />
                    {/* Target endpoint handle */}
                    <circle
                      cx={targetPos.x}
                      cy={targetPos.y}
                      r={handleRadius}
                      fill={handleFill}
                      stroke={handleStroke}
                      strokeWidth={handleStrokeWidth}
                      style={{ cursor: 'move', pointerEvents: 'auto' }}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        handleEndpointDragStart(conn.id, 'target', e);
                      }}
                      onMouseEnter={() => setHoveredConnectionId(conn.id)}
                    />
                  </g>
                );
              })}
            </g>
          </svg>
        </div>
      </div>

      {/* Tool mode indicator */}
      {activeTool === 'connect' && !isConnecting && (
        <div className="ds-tool-hint" style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '8px 16px',
          background: 'var(--panel)',
          color: 'var(--text)',
          borderRadius: 8,
          fontSize: 12,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
          border: '1px solid var(--border)',
          zIndex: 100,
        }}>
          Connect Mode: Click and drag anywhere to draw an arrow. Press C or Esc to exit.
        </div>
      )}

      {/* Connection in progress indicator */}
      {isConnecting && (
        <div className="ds-connect-hint" style={{
          position: 'absolute',
          bottom: 16,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '10px 20px',
          background: 'var(--accent)',
          color: 'white',
          borderRadius: 20,
          fontSize: 13,
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.2)',
          zIndex: 100,
        }}>
          Release on target node to connect, or press Escape to cancel
        </div>
      )}

      {/* Empty Canvas Welcome - shows when canvas has no elements */}
      <EmptyCanvasWelcome
        visible={elements.length === 0 && connections.length === 0 && !readOnly}
        onAddShapes={onOpenStencilPanel}
        onUseTemplate={onOpenTemplates}
        onShowShortcuts={onShowShortcuts}
      />

      {/* Connection Toolbar - shows on right-click when a connection is selected */}
      {!readOnly && showConnectionToolbar && selection?.connectionIds?.length === 1 && (() => {
        const selectedConn = connections.find(c => c.id === selection.connectionIds[0]);
        if (!selectedConn) return null;

        // Hide toolbar when dragging elements (prevents blocking drag operations)
        const isDragging = draggingElement || resizing || draggingWaypoint || draggingSegment || draggingEndpoint || draggingCurve;
        if (isDragging) return null;

        // Get source and target elements
        const sourceEl = elements.find(e => e.id === selectedConn.sourceId);
        const targetEl = elements.find(e => e.id === selectedConn.targetId);

        // Calculate the highest point among: source element, target element, and connection line
        // This ensures the toolbar never overlaps with any part of the connection
        let menuX, highestY = Infinity;
        const yPoints = [];

        if (sourceEl) {
          yPoints.push(sourceEl.y);
        }
        if (targetEl) {
          yPoints.push(targetEl.y);
        }

        // Get source and target positions for the connection
        let sourcePos, targetPos;
        if (sourceEl) {
          const sourceSize = sourceEl.size || { width: 120, height: 60 };
          const portPos = getPortPosition(sourceEl, selectedConn.sourcePort || 'right', packRegistry);
          sourcePos = portPos || { x: sourceEl.x + sourceSize.width / 2, y: sourceEl.y + sourceSize.height / 2 };
        } else if (selectedConn.sourcePos) {
          sourcePos = selectedConn.sourcePos;
        }

        if (targetEl) {
          const targetSize = targetEl.size || { width: 120, height: 60 };
          const portPos = getPortPosition(targetEl, selectedConn.targetPort || 'left', packRegistry);
          targetPos = portPos || { x: targetEl.x + targetSize.width / 2, y: targetEl.y + targetSize.height / 2 };
        } else if (selectedConn.targetPos) {
          targetPos = selectedConn.targetPos;
        }

        // Add connection endpoint positions
        if (sourcePos) yPoints.push(sourcePos.y);
        if (targetPos) yPoints.push(targetPos.y);

        // Add waypoint positions (for step/orthogonal lines)
        if (selectedConn.waypoints && selectedConn.waypoints.length > 0) {
          selectedConn.waypoints.forEach(wp => yPoints.push(wp.y));
        }

        // For curved lines, estimate the curve apex (midpoint + curve offset)
        if (sourcePos && targetPos && (selectedConn.lineStyle === 'curved' || selectedConn.lineStyle === 'arc')) {
          const midY = (sourcePos.y + targetPos.y) / 2;
          const curveAmount = selectedConn.curveAmount || 0;
          // Curve apex could be above or below the midpoint
          yPoints.push(midY + curveAmount);
          yPoints.push(midY - Math.abs(curveAmount || 30)); // Estimate if no curveAmount set
        }

        // Find the highest Y (smallest value)
        highestY = Math.min(...yPoints.filter(y => typeof y === 'number' && !isNaN(y)));

        // Calculate center X
        if (sourcePos && targetPos) {
          menuX = (sourcePos.x + targetPos.x) / 2;
        } else if (sourceEl && targetEl) {
          const sourceSize = sourceEl.size || { width: 120, height: 60 };
          const targetSize = targetEl.size || { width: 120, height: 60 };
          menuX = ((sourceEl.x + sourceSize.width / 2) + (targetEl.x + targetSize.width / 2)) / 2;
        } else if (sourcePos) {
          menuX = sourcePos.x;
        } else if (targetPos) {
          menuX = targetPos.x;
        } else {
          return null;
        }

        // Position 30px above the highest point
        const topY = highestY - 30;

        // Convert to screen coordinates
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;

        const screenX = rect.left + (menuX + viewport.x) * viewport.scale;
        let screenY = rect.top + (topY + viewport.y) * viewport.scale;

        // If menu would go off top of screen, position it at a minimum distance from top
        if (screenY < 60) {
          screenY = 60;
        }

        return (
          <ConnectionToolbar
            connection={selectedConn}
            position={{ x: screenX, y: screenY }}
            onUpdate={(updates) => updateConnection(selectedConn.id, updates)}
            onDelete={() => {
              removeConnection(selectedConn.id);
              clearSelection();
            }}
            onClose={() => {}}
          />
        );
      })()}

      {/* Alignment Toolbar - shows when multiple nodes are selected */}
      {!readOnly && selection?.nodeIds?.length >= 2 && (() => {
        const selectedEls = elements.filter(el => selection.nodeIds.includes(el.id));
        if (selectedEls.length < 2) return null;

        // Calculate center of selection for toolbar position
        const minX = Math.min(...selectedEls.map(el => el.x));
        const maxX = Math.max(...selectedEls.map(el => el.x + (el.size?.width || 120)));
        const minY = Math.min(...selectedEls.map(el => el.y));

        const centerX = (minX + maxX) / 2;
        const topY = minY - 60;

        // Convert to screen coordinates
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return null;

        const screenX = rect.left + (centerX + viewport.x) * viewport.scale;
        const screenY = rect.top + (topY + viewport.y) * viewport.scale;

        return (
          <div style={{
            position: 'fixed',
            left: screenX,
            top: Math.max(60, screenY),
            transform: 'translateX(-50%)',
            zIndex: 200,
          }}>
            <AlignmentToolbar
              selectedElements={selectedEls}
              onAlign={handleAlign}
              onDistribute={handleDistribute}
              onMatchSize={handleMatchSize}
            />
          </div>
        );
      })()}

      {/* Minimap Navigator */}
      {showMinimap && (
        <Minimap
          packRegistry={packRegistry}
          containerSize={{
            width: containerRef.current?.clientWidth || 1200,
            height: containerRef.current?.clientHeight || 800,
          }}
        />
      )}

      {/* Coordinates Display */}
      <div
        className="ds-coordinates-display"
        style={{
          position: 'absolute',
          bottom: 12,
          left: 12,
          background: 'rgba(255, 255, 255, 0.9)',
          backdropFilter: 'blur(8px)',
          padding: '4px 8px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: 'monospace',
          color: 'var(--text-muted, #6b7280)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
          pointerEvents: 'none',
          zIndex: 100,
        }}
      >
        X: {mousePos.x} &nbsp; Y: {mousePos.y}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <>
          <div
            className="ds-context-menu-backdrop"
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setContextMenu(null)}
          />
          <div
            className="ds-context-menu"
            style={{
              position: 'fixed',
              left: contextMenu.x,
              top: contextMenu.y,
              zIndex: 1000,
            }}
          >
            {contextMenu.items.map((item, idx) =>
              item.type === 'divider' ? (
                <div key={idx} className="ds-context-menu-divider" />
              ) : (
                <button
                  key={idx}
                  className={`ds-context-menu-item ${item.danger ? 'danger' : ''}`}
                  onClick={() => handleContextMenuAction(item.action, contextMenu.nodeEl, contextMenu.connectionEl)}
                  disabled={item.disabled}
                >
                  <span style={{ width: 20 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.shortcut && <kbd style={{ marginLeft: 8, fontSize: 11, opacity: 0.6 }}>{item.shortcut}</kbd>}
                </button>
              )
            )}
          </div>
        </>
      )}

      {/* Rotation angle indicator - shown while dragging rotation handle */}
      {rotationIndicator && (
        <div
          className="ds-rotation-indicator"
          style={{
            left: rotationIndicator.x,
            top: rotationIndicator.y,
          }}
        >
          {rotationIndicator.angle.toFixed(1)}°
        </div>
      )}

      {/* Floating rotation handle - rendered via portal to be above toolbar */}
      {floatingHandlePos && typeof document !== 'undefined' && createPortal(
        <div
          className="ds-floating-rotation-handle"
          style={{
            position: 'fixed',
            left: floatingHandlePos.x - 12,
            top: floatingHandlePos.y - 12,
            width: 24,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            border: '2px solid var(--accent, #6EC5D8)',
            borderRadius: '50%',
            cursor: 'grab',
            zIndex: 10000,
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
            color: 'var(--accent, #6EC5D8)',
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            e.preventDefault();
            const elementId = floatingHandlePos.elementId;
            const element = elements.find(el => el.id === elementId);
            if (!element || element.locked) return;

            const pack = packRegistry?.get?.(element.packId);
            const stencil = pack?.stencils?.find(s => s.id === element.type);
            const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

            const rect = containerRef.current?.getBoundingClientRect();
            if (rect) {
              const centerX = rect.left + (element.x + size.width / 2 + viewport.x) * viewport.scale;
              const centerY = rect.top + (element.y + size.height / 2 + viewport.y) * viewport.scale;
              const dx = e.clientX - centerX;
              const dy = e.clientY - centerY;
              const startAngle = Math.atan2(dy, dx) * (180 / Math.PI);

              setRotating({
                elementId,
                centerX,
                centerY,
                startAngle,
                startRotation: element.rotation || 0,
                startX: e.clientX,
                startY: e.clientY,
                hasMoved: false,
              });
              setIsRotating?.(true); // Notify context to hide toolbar
              setRotationIndicator({
                x: e.clientX,
                y: e.clientY,
                angle: element.rotation || 0,
              });
            }
          }}
          title="Drag to rotate (Shift for 15° snap)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </div>,
        document.body
      )}
    </div>
  );
}

// ============ EXPORTS ============

export { getPortPosition, getConnectionPath, snapToGrid };

// components/diagram-studio/hooks/composite/useCanvasInteractions.js
// Composite hook that orchestrates all canvas interaction systems

import { useCallback, useMemo, useRef, useEffect } from 'react';

// Import interaction hooks
import { useDragSystem } from '../interaction/useDragSystem';
import { useConnectionDrag } from '../interaction/useConnectionDrag';
import { useViewportControls } from '../interaction/useViewportControls';
import { useClipboard } from '../interaction/useClipboard';
import { useQuickCreate } from '../interaction/useQuickCreate';

// Import utility hooks
import { useDragListeners } from '../utilities/useDocumentEvents';
import { useEdgePanning } from '../utilities/useEdgePanning';

/**
 * Interaction modes for determining which system handles events
 */
const InteractionMode = {
  NONE: 'none',
  SELECTING: 'selecting',
  DRAGGING: 'dragging',
  PANNING: 'panning',
  CONNECTING: 'connecting',
  MARQUEE: 'marquee',
  WAYPOINT: 'waypoint',
  SEGMENT: 'segment',
  ENDPOINT: 'endpoint',
  CURVE: 'curve',
  RESIZING: 'resizing',
};

/**
 * Composite hook for all canvas interactions.
 * Orchestrates drag, connection, viewport, clipboard, and quick-create systems.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Array} options.connections - All diagram connections
 * @param {Object} options.selection - Current selection { nodeIds: string[], connectionIds: string[] }
 * @param {Object} options.viewport - Current viewport { x, y, scale }
 * @param {Function} options.setViewport - Function to set viewport
 * @param {Function} options.addElement - Function to add an element
 * @param {Function} options.updateElement - Function to update an element
 * @param {Function} options.removeElements - Function to remove elements
 * @param {Function} options.addConnection - Function to add a connection
 * @param {Function} options.updateConnection - Function to update a connection
 * @param {Function} options.removeConnections - Function to remove connections
 * @param {Function} options.selectElement - Function to select an element
 * @param {Function} options.selectConnection - Function to select a connection
 * @param {Function} options.clearSelection - Function to clear selection
 * @param {Function} options.recordHistory - Function to record undo history
 * @param {Object} options.containerRef - Ref to the container element
 * @param {Object} options.packRegistry - Pack registry for element info
 * @param {string} options.activeTool - Current active tool ('select', 'pan', 'connect', etc.)
 * @param {boolean} options.readOnly - Whether in read-only mode
 * @param {boolean} options.canMove - Whether elements can be moved
 * @param {Object} options.canvasBounds - Canvas bounds for viewport clamping
 * @returns {Object} - Unified interaction interface
 */
export function useCanvasInteractions({
  elements,
  connections,
  selection,
  viewport,
  setViewport,
  addElement,
  updateElement,
  removeElements,
  addConnection,
  updateConnection,
  removeConnections,
  selectElement,
  selectConnection,
  clearSelection,
  recordHistory,
  containerRef,
  packRegistry,
  activeTool = 'select',
  readOnly = false,
  canMove = true,
  canvasBounds,
}) {
  // Track current interaction mode
  const modeRef = useRef(InteractionMode.NONE);

  // Initialize drag system
  const drag = useDragSystem({
    elements,
    selection,
    viewport,
    updateElement,
    selectElement,
    recordHistory,
    containerRef,
    packRegistry,
    readOnly,
    canMove,
  });

  // Initialize connection drag system
  const connection = useConnectionDrag({
    elements,
    connections,
    viewport,
    addConnection,
    updateConnection,
    selectConnection,
    recordHistory,
    containerRef,
    packRegistry,
    readOnly,
  });

  // Initialize viewport controls
  const viewportControls = useViewportControls({
    viewport,
    setViewport,
    containerRef,
    canvasBounds,
    elements,
    packRegistry,
  });

  // Initialize clipboard
  const clipboard = useClipboard({
    elements,
    connections,
    selection,
    addElement,
    addConnection,
    selectElement,
    clearSelection,
    recordHistory,
    viewport,
    packRegistry,
    readOnly,
  });

  // Initialize quick create
  const quickCreate = useQuickCreate({
    elements,
    addElement,
    addConnection,
    selectElement,
    recordHistory,
    packRegistry,
    readOnly,
  });

  // Initialize edge panning
  const edgePan = useEdgePanning({
    enabled: drag.isDragging || connection.isCreating,
    viewport,
    setViewport,
    containerRef,
    canvasBounds,
  });

  /**
   * Get current interaction mode
   */
  const getMode = useCallback(() => modeRef.current, []);

  /**
   * Set interaction mode
   */
  const setMode = useCallback((mode) => {
    modeRef.current = mode;
  }, []);

  /**
   * Check if any interaction is active
   */
  const isInteracting = useCallback(() => {
    return modeRef.current !== InteractionMode.NONE;
  }, []);

  /**
   * Handle mouse down on canvas
   */
  const handleCanvasMouseDown = useCallback((e) => {
    if (readOnly) return;

    // Prevent default for middle mouse button (pan)
    if (e.button === 1) {
      e.preventDefault();
      viewportControls.startPan(e);
      setMode(InteractionMode.PANNING);
      return;
    }

    // Right click - let context menu handle it
    if (e.button === 2) return;

    // Left click behavior depends on tool
    if (activeTool === 'pan') {
      viewportControls.startPan(e);
      setMode(InteractionMode.PANNING);
      return;
    }

    // Check if clicking on empty canvas (for marquee or deselect)
    const target = e.target;
    const isCanvasClick = target.classList?.contains('diagram-canvas-background') ||
                          target.tagName === 'svg';

    if (isCanvasClick) {
      if (e.shiftKey) {
        // Shift+click on canvas starts marquee
        drag.startMarquee(e);
        setMode(InteractionMode.MARQUEE);
      } else {
        // Click on empty canvas clears selection
        clearSelection?.();
        setMode(InteractionMode.SELECTING);
      }
    }
  }, [readOnly, activeTool, viewportControls, drag, clearSelection, setMode]);

  /**
   * Handle mouse down on an element
   */
  const handleElementMouseDown = useCallback((e, element, options = {}) => {
    if (readOnly) return;
    if (e.button !== 0) return; // Left click only

    const { isPort = false, portId = null } = options;

    // If clicking on a port in connect mode, start connection
    if (isPort && (activeTool === 'connect' || e.altKey)) {
      connection.startConnectionCreate(element, portId, e);
      setMode(InteractionMode.CONNECTING);
      return;
    }

    // Start element drag
    if (drag.startDrag(e, element, { addToSelection: e.shiftKey })) {
      setMode(InteractionMode.DRAGGING);
    }
  }, [readOnly, activeTool, connection, drag, setMode]);

  /**
   * Handle mouse down on a connection
   */
  const handleConnectionMouseDown = useCallback((e, conn, options = {}) => {
    if (readOnly) return;
    if (e.button !== 0) return;

    const {
      isWaypoint = false,
      waypointIndex = null,
      isSegment = false,
      segmentIndex = null,
      orientation = null,
      isEndpoint = false,
      endpoint = null,
      isCurve = false,
    } = options;

    // Handle waypoint drag
    if (isWaypoint && waypointIndex !== null) {
      connection.startWaypointDrag(conn.id, waypointIndex, e);
      setMode(InteractionMode.WAYPOINT);
      return;
    }

    // Handle segment drag
    if (isSegment && segmentIndex !== null) {
      connection.startSegmentDrag(conn.id, segmentIndex, orientation, e);
      setMode(InteractionMode.SEGMENT);
      return;
    }

    // Handle endpoint drag
    if (isEndpoint && endpoint) {
      connection.startEndpointDrag(conn.id, endpoint, e);
      setMode(InteractionMode.ENDPOINT);
      return;
    }

    // Handle curve drag
    if (isCurve) {
      connection.startCurveDrag(conn.id, e);
      setMode(InteractionMode.CURVE);
      return;
    }

    // Just select the connection
    selectConnection?.(conn.id);
  }, [readOnly, connection, selectConnection, setMode]);

  /**
   * Handle mouse move (dispatches to active system)
   */
  const handleMouseMove = useCallback((e) => {
    const mode = modeRef.current;

    switch (mode) {
      case InteractionMode.PANNING:
        viewportControls.continuePan(e);
        break;

      case InteractionMode.DRAGGING:
        const dragResult = drag.continueDrag(e);
        if (dragResult) {
          // Update edge panning
          edgePan.checkPosition(e.clientX, e.clientY);
        }
        break;

      case InteractionMode.MARQUEE:
        drag.continueMarquee(e);
        break;

      case InteractionMode.CONNECTING:
        connection.updateConnectionPreview(e);
        edgePan.checkPosition(e.clientX, e.clientY);
        break;

      case InteractionMode.WAYPOINT:
        connection.continueWaypointDrag(e);
        break;

      case InteractionMode.SEGMENT:
        connection.continueSegmentDrag(e);
        break;

      case InteractionMode.ENDPOINT:
        connection.continueEndpointDrag(e);
        break;

      case InteractionMode.CURVE:
        connection.continueCurveDrag(e);
        break;

      default:
        // No active interaction, could update hover states
        break;
    }
  }, [viewportControls, drag, connection, edgePan]);

  /**
   * Handle mouse up (completes active interaction)
   */
  const handleMouseUp = useCallback((e) => {
    const mode = modeRef.current;

    switch (mode) {
      case InteractionMode.PANNING:
        viewportControls.endPan();
        break;

      case InteractionMode.DRAGGING:
        drag.endDrag();
        edgePan.stop();
        break;

      case InteractionMode.MARQUEE:
        drag.endMarquee((selectedIds) => {
          // Select all elements within marquee
          if (selectedIds.length > 0) {
            selectedIds.forEach((id, index) => {
              selectElement?.(id, index > 0); // Add to selection after first
            });
          }
        });
        break;

      case InteractionMode.CONNECTING:
        // Connection completion is handled by target element
        connection.cancelConnectionCreate();
        edgePan.stop();
        break;

      case InteractionMode.WAYPOINT:
        connection.endWaypointDrag();
        break;

      case InteractionMode.SEGMENT:
        connection.endSegmentDrag();
        break;

      case InteractionMode.ENDPOINT:
        connection.endEndpointDrag();
        break;

      case InteractionMode.CURVE:
        connection.endCurveDrag();
        break;
    }

    setMode(InteractionMode.NONE);
  }, [viewportControls, drag, connection, edgePan, selectElement, setMode]);

  /**
   * Handle completing a connection on a target element
   */
  const handleConnectionComplete = useCallback((targetElement, targetPort) => {
    if (modeRef.current !== InteractionMode.CONNECTING) return null;

    const result = connection.completeConnection(targetElement, targetPort);
    edgePan.stop();
    setMode(InteractionMode.NONE);
    return result;
  }, [connection, edgePan, setMode]);

  /**
   * Handle completing an endpoint drag on a target element
   */
  const handleEndpointComplete = useCallback((targetElement, targetPort) => {
    if (modeRef.current !== InteractionMode.ENDPOINT) return null;

    const result = connection.endEndpointDrag(targetElement, targetPort);
    setMode(InteractionMode.NONE);
    return result;
  }, [connection, setMode]);

  /**
   * Handle wheel event for zooming
   */
  const handleWheel = useCallback((e) => {
    viewportControls.handleWheel(e);
  }, [viewportControls]);

  /**
   * Cancel current interaction
   */
  const cancelInteraction = useCallback(() => {
    const mode = modeRef.current;

    switch (mode) {
      case InteractionMode.PANNING:
        viewportControls.endPan();
        break;
      case InteractionMode.DRAGGING:
        drag.cancelDrag();
        edgePan.stop();
        break;
      case InteractionMode.MARQUEE:
        drag.cancelMarquee();
        break;
      case InteractionMode.CONNECTING:
        connection.cancelConnectionCreate();
        edgePan.stop();
        break;
      case InteractionMode.WAYPOINT:
        connection.endWaypointDrag();
        break;
      case InteractionMode.SEGMENT:
        connection.endSegmentDrag();
        break;
      case InteractionMode.ENDPOINT:
        connection.endEndpointDrag();
        break;
      case InteractionMode.CURVE:
        connection.endCurveDrag();
        break;
    }

    setMode(InteractionMode.NONE);
  }, [viewportControls, drag, connection, edgePan, setMode]);

  // Set up document-level mouse events for drag operations
  // Only active when an interaction is in progress
  useDragListeners(
    { onMove: handleMouseMove, onEnd: handleMouseUp },
    modeRef.current !== InteractionMode.NONE
  );

  // Cancel interaction on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isInteracting()) {
        cancelInteraction();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isInteracting, cancelInteraction]);

  // Compose unified canvas handlers
  const canvasHandlers = useMemo(() => ({
    onMouseDown: handleCanvasMouseDown,
    onMouseMove: handleMouseMove,
    onMouseUp: handleMouseUp,
    onWheel: handleWheel,
  }), [handleCanvasMouseDown, handleMouseMove, handleMouseUp, handleWheel]);

  // Compose interaction state
  const interactionState = useMemo(() => ({
    mode: modeRef.current,
    isDragging: drag.isDragging,
    isPanning: viewportControls.isPanning,
    isConnecting: connection.isCreating,
    isMarquee: drag.marquee !== null,
    isEditing: connection.draggingWaypoint !== null ||
               connection.draggingSegment !== null ||
               connection.draggingEndpoint !== null ||
               connection.draggingCurve !== null,
    snapGuides: drag.snapGuides,
    marquee: drag.marquee,
    connectionPreview: connection.isCreating ? {
      source: connection.connectSource,
      mousePos: connection.connectMousePos,
    } : null,
  }), [drag, viewportControls, connection]);

  // Compose actions
  const actions = useMemo(() => ({
    // Clipboard
    copy: clipboard.copy,
    paste: clipboard.paste,
    duplicate: clipboard.duplicate,
    canPaste: clipboard.canPaste,

    // Viewport
    zoomIn: viewportControls.zoomIn,
    zoomOut: viewportControls.zoomOut,
    zoomTo: viewportControls.zoomTo,
    resetZoom: viewportControls.resetZoom,
    fitToScreen: viewportControls.zoomToFitAll,
    panTo: viewportControls.panTo,

    // Quick create
    quickCreate: quickCreate.quickCreate,
    quickCreateWithType: quickCreate.quickCreateWithType,
    getQuickCreateOptions: quickCreate.getQuickCreateOptions,

    // Connection management
    addWaypoint: connection.addWaypoint,
    removeWaypoint: connection.removeWaypoint,
    clearWaypoints: connection.clearWaypoints,

    // Interaction control
    cancelInteraction,
  }), [clipboard, viewportControls, quickCreate, connection, cancelInteraction]);

  return {
    // Unified handlers
    canvasHandlers,

    // Event handlers for specific elements
    handleElementMouseDown,
    handleConnectionMouseDown,
    handleConnectionComplete,
    handleEndpointComplete,

    // State
    interactionState,

    // Actions
    actions,

    // Direct hook access for advanced usage
    hooks: {
      drag,
      connection,
      viewport: viewportControls,
      clipboard,
      quickCreate,
      edgePan,
    },

    // Mode utilities
    getMode,
    isInteracting,
  };
}

export { InteractionMode };
export default useCanvasInteractions;

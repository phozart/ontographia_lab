// components/diagram-studio/hooks/interaction/useConnectionDrag.js
// Connection creation and editing (waypoint, segment, endpoint, curve dragging)

import { useState, useRef, useCallback, useEffect } from 'react';
import { getPortPosition, getOptimalPorts, insertWaypointSorted } from '../../utils';

/**
 * Hook for connection drag operations.
 * Handles connection creation, waypoint editing, segment dragging, and endpoint repositioning.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Array} options.connections - All diagram connections
 * @param {Object} options.viewport - Current viewport { x, y, scale }
 * @param {Function} options.addConnection - Function to add a connection
 * @param {Function} options.updateConnection - Function to update a connection
 * @param {Function} options.selectConnection - Function to select a connection
 * @param {Function} options.recordHistory - Function to record undo history
 * @param {Object} options.containerRef - Ref to the container element
 * @param {Object} options.packRegistry - Pack registry for element sizes
 * @param {boolean} options.readOnly - Whether in read-only mode
 * @returns {Object} - Connection drag methods and state
 */
export function useConnectionDrag({
  elements,
  connections,
  viewport,
  addConnection,
  updateConnection,
  selectConnection,
  recordHistory,
  containerRef,
  packRegistry,
  readOnly = false,
}) {
  // Connection creation state
  const [isCreating, setIsCreating] = useState(false);
  const [connectSource, setConnectSource] = useState(null);
  const [connectMousePos, setConnectMousePos] = useState(null);

  // Connection editing state
  const [draggingWaypoint, setDraggingWaypoint] = useState(null);
  const [draggingSegment, setDraggingSegment] = useState(null);
  const [draggingEndpoint, setDraggingEndpoint] = useState(null);
  const [draggingCurve, setDraggingCurve] = useState(null);

  // Refs for synchronous access
  const viewportRef = useRef(viewport);
  const draggingWaypointRef = useRef(null);
  const draggingSegmentRef = useRef(null);
  const draggingEndpointRef = useRef(null);
  const draggingCurveRef = useRef(null);

  // Keep viewport ref in sync
  useEffect(() => {
    viewportRef.current = viewport;
  }, [viewport]);

  // Keep refs in sync with state for document-level handler access
  useEffect(() => {
    draggingWaypointRef.current = draggingWaypoint;
    draggingSegmentRef.current = draggingSegment;
    draggingEndpointRef.current = draggingEndpoint;
    draggingCurveRef.current = draggingCurve;
  }, [draggingWaypoint, draggingSegment, draggingEndpoint, draggingCurve]);

  /**
   * Convert screen coordinates to canvas coordinates
   */
  const screenToCanvas = useCallback((clientX, clientY) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const vp = viewportRef.current;
    return {
      x: (clientX - rect.left) / vp.scale - vp.x,
      y: (clientY - rect.top) / vp.scale - vp.y,
    };
  }, [containerRef]);

  /**
   * Start creating a connection from an element
   * @param {Object} element - The source element
   * @param {string} port - The port name (top, right, bottom, left, center)
   * @param {MouseEvent} e - The mouse event
   * @param {Object} options - Additional options
   * @param {number} options.ratio - Position ratio along the port (0-1, default 0.5)
   * @param {Object} options.sourceOverride - Custom source object to use instead of auto-generated
   */
  const startConnectionCreate = useCallback((element, port, e, options = {}) => {
    if (readOnly) return;

    const { ratio = 0.5, sourceOverride } = options;

    // If sourceOverride is provided, use it directly (for DiagramCanvas compatibility)
    if (sourceOverride) {
      setIsCreating(true);
      setConnectSource(sourceOverride);
      if (e) {
        const mousePos = screenToCanvas(e.clientX, e.clientY);
        setConnectMousePos(mousePos);
      } else if (sourceOverride.x !== undefined && sourceOverride.y !== undefined) {
        setConnectMousePos({ x: sourceOverride.x, y: sourceOverride.y });
      }
      return;
    }

    const portPos = getPortPosition(element, port, packRegistry);

    setIsCreating(true);
    setConnectSource({
      elementId: element.id,
      port,
      portId: port, // Alias for compatibility
      ratio,
      x: portPos.x,
      y: portPos.y,
      position: portPos, // Keep for backwards compatibility
    });

    if (e) {
      const mousePos = screenToCanvas(e.clientX, e.clientY);
      setConnectMousePos(mousePos);
    }
  }, [readOnly, packRegistry, screenToCanvas]);

  /**
   * Update connection preview during creation
   */
  const updateConnectionPreview = useCallback((e) => {
    if (!isCreating || !connectSource) return null;

    const mousePos = screenToCanvas(e.clientX, e.clientY);
    setConnectMousePos(mousePos);

    return {
      source: connectSource,
      mousePos,
    };
  }, [isCreating, connectSource, screenToCanvas]);

  /**
   * Complete connection creation
   */
  const completeConnection = useCallback((targetElement, targetPort) => {
    if (!isCreating || !connectSource) return null;

    const sourceElement = elements.find(el => el.id === connectSource.elementId);
    if (!sourceElement || !targetElement) return null;

    // Don't allow self-connections (unless explicitly enabled)
    if (connectSource.elementId === targetElement.id) {
      cancelConnectionCreate();
      return null;
    }

    // Determine optimal ports if not specified
    let sourcePort = connectSource.port;
    let finalTargetPort = targetPort;

    if (!sourcePort || sourcePort === 'auto') {
      const optimal = getOptimalPorts(sourceElement, targetElement, packRegistry);
      sourcePort = optimal.sourcePort;
    }

    if (!finalTargetPort || finalTargetPort === 'auto') {
      const optimal = getOptimalPorts(sourceElement, targetElement, packRegistry);
      finalTargetPort = optimal.targetPort;
    }

    // Create the connection
    const newConnection = addConnection({
      sourceId: connectSource.elementId,
      targetId: targetElement.id,
      sourcePort,
      targetPort: finalTargetPort,
      lineStyle: 'curved',
    });

    // Clean up
    setIsCreating(false);
    setConnectSource(null);
    setConnectMousePos(null);

    selectConnection?.(newConnection?.id);
    recordHistory?.();

    return newConnection;
  }, [isCreating, connectSource, elements, packRegistry, addConnection, selectConnection, recordHistory]);

  /**
   * Cancel connection creation
   */
  const cancelConnectionCreate = useCallback(() => {
    setIsCreating(false);
    setConnectSource(null);
    setConnectMousePos(null);
  }, []);

  /**
   * Start dragging a waypoint
   */
  const startWaypointDrag = useCallback((connectionId, waypointIndex, e) => {
    if (readOnly) return;

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    setDraggingWaypoint({
      connectionId,
      waypointIndex,
      startPos: mousePos,
    });
  }, [readOnly, screenToCanvas]);

  /**
   * Continue dragging a waypoint
   */
  const continueWaypointDrag = useCallback((e) => {
    if (!draggingWaypointRef.current) return null;

    const mousePos = screenToCanvas(e.clientX, e.clientY);
    const { connectionId, waypointIndex } = draggingWaypointRef.current;

    // Update waypoint position
    const connection = connections.find(c => c.id === connectionId);
    if (!connection?.waypoints) return null;

    const newWaypoints = [...connection.waypoints];
    newWaypoints[waypointIndex] = { x: mousePos.x, y: mousePos.y };

    updateConnection(connectionId, { waypoints: newWaypoints });

    return { connectionId, waypointIndex, position: mousePos };
  }, [connections, updateConnection, screenToCanvas]);

  /**
   * End waypoint drag
   */
  const endWaypointDrag = useCallback(() => {
    if (draggingWaypointRef.current) {
      recordHistory?.();
    }
    setDraggingWaypoint(null);
  }, [recordHistory]);

  /**
   * Update waypoint drag state directly (for DiagramCanvas compatibility)
   */
  const updateWaypointDrag = useCallback((value) => {
    setDraggingWaypoint(value);
  }, []);

  /**
   * Start dragging a connection segment (for orthogonal lines)
   */
  const startSegmentDrag = useCallback((connectionId, segmentIndex, orientation, e) => {
    if (readOnly) return;

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    setDraggingSegment({
      connectionId,
      segmentIndex,
      orientation, // 'horizontal' or 'vertical'
      startPos: mousePos,
    });
  }, [readOnly, screenToCanvas]);

  /**
   * Continue dragging a segment
   */
  const continueSegmentDrag = useCallback((e) => {
    if (!draggingSegmentRef.current) return null;

    const mousePos = screenToCanvas(e.clientX, e.clientY);
    const { connectionId, segmentIndex, orientation } = draggingSegmentRef.current;

    const connection = connections.find(c => c.id === connectionId);
    if (!connection?.waypoints) return null;

    // For segment drag, we move the waypoint that controls this segment
    const newWaypoints = [...connection.waypoints];

    if (segmentIndex >= 0 && segmentIndex < newWaypoints.length) {
      if (orientation === 'horizontal') {
        newWaypoints[segmentIndex] = { ...newWaypoints[segmentIndex], y: mousePos.y };
      } else {
        newWaypoints[segmentIndex] = { ...newWaypoints[segmentIndex], x: mousePos.x };
      }
      updateConnection(connectionId, { waypoints: newWaypoints });
    }

    return { connectionId, segmentIndex, position: mousePos };
  }, [connections, updateConnection, screenToCanvas]);

  /**
   * End segment drag
   */
  const endSegmentDrag = useCallback(() => {
    if (draggingSegmentRef.current) {
      recordHistory?.();
    }
    setDraggingSegment(null);
  }, [recordHistory]);

  /**
   * Update segment drag state directly (for DiagramCanvas compatibility)
   */
  const updateSegmentDrag = useCallback((value) => {
    setDraggingSegment(value);
  }, []);

  /**
   * Start dragging a connection endpoint
   */
  const startEndpointDrag = useCallback((connectionId, endpoint, e) => {
    if (readOnly) return;

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    setDraggingEndpoint({
      connectionId,
      endpoint, // 'source' or 'target'
      startPos: mousePos,
    });
  }, [readOnly, screenToCanvas]);

  /**
   * Continue dragging an endpoint
   */
  const continueEndpointDrag = useCallback((e) => {
    if (!draggingEndpointRef.current) return null;

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    // Just return the position - actual repositioning happens on end
    return {
      ...draggingEndpointRef.current,
      currentPos: mousePos,
    };
  }, [screenToCanvas]);

  /**
   * Update endpoint drag state (for preview position updates during drag)
   */
  const updateEndpointDrag = useCallback((updater) => {
    if (!draggingEndpointRef.current) return;

    // Support both functional updates and direct values
    const newState = typeof updater === 'function'
      ? updater(draggingEndpointRef.current)
      : updater;

    setDraggingEndpoint(newState);
  }, []);

  /**
   * End endpoint drag (attach to new element or position)
   */
  const endEndpointDrag = useCallback((targetElement, targetPort) => {
    if (!draggingEndpointRef.current) return null;

    const { connectionId, endpoint } = draggingEndpointRef.current;

    if (targetElement) {
      // Attach to new element
      const updates = endpoint === 'source'
        ? { sourceId: targetElement.id, sourcePort: targetPort || 'center' }
        : { targetId: targetElement.id, targetPort: targetPort || 'center' };

      updateConnection(connectionId, updates);
      recordHistory?.();
    }

    setDraggingEndpoint(null);
    return { connectionId, endpoint, targetElement };
  }, [updateConnection, recordHistory]);

  /**
   * Start dragging curve control (for curved lines)
   */
  const startCurveDrag = useCallback((connectionId, e) => {
    if (readOnly) return;

    const mousePos = screenToCanvas(e.clientX, e.clientY);

    setDraggingCurve({
      connectionId,
      startPos: mousePos,
    });
  }, [readOnly, screenToCanvas]);

  /**
   * Continue dragging curve
   */
  const continueCurveDrag = useCallback((e) => {
    if (!draggingCurveRef.current) return null;

    const mousePos = screenToCanvas(e.clientX, e.clientY);
    const { connectionId, startPos } = draggingCurveRef.current;

    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return null;

    // Calculate curve amount based on perpendicular offset from line
    const sourceEl = elements.find(el => el.id === connection.sourceId);
    const targetEl = elements.find(el => el.id === connection.targetId);

    if (sourceEl && targetEl) {
      const sourcePos = getPortPosition(sourceEl, connection.sourcePort, packRegistry);
      const targetPos = getPortPosition(targetEl, connection.targetPort, packRegistry);

      // Calculate perpendicular distance
      const dx = targetPos.x - sourcePos.x;
      const dy = targetPos.y - sourcePos.y;
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      const perpX = -dy / len;
      const perpY = dx / len;

      // Project mouse position onto perpendicular
      const midX = (sourcePos.x + targetPos.x) / 2;
      const midY = (sourcePos.y + targetPos.y) / 2;
      const curveAmount = (mousePos.x - midX) * perpX + (mousePos.y - midY) * perpY;

      updateConnection(connectionId, { curveAmount });
    }

    return { connectionId, position: mousePos };
  }, [connections, elements, packRegistry, updateConnection, screenToCanvas]);

  /**
   * End curve drag
   */
  const endCurveDrag = useCallback(() => {
    if (draggingCurveRef.current) {
      recordHistory?.();
    }
    setDraggingCurve(null);
  }, [recordHistory]);

  /**
   * Update curve drag state directly (for DiagramCanvas compatibility)
   */
  const updateCurveDrag = useCallback((value) => {
    setDraggingCurve(value);
  }, []);

  /**
   * Add a waypoint to a connection
   */
  const addWaypoint = useCallback((connectionId, position) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection) return;

    const sourceEl = elements.find(el => el.id === connection.sourceId);
    const targetEl = elements.find(el => el.id === connection.targetId);

    if (!sourceEl || !targetEl) return;

    const sourcePos = getPortPosition(sourceEl, connection.sourcePort, packRegistry);
    const targetPos = getPortPosition(targetEl, connection.targetPort, packRegistry);

    const newWaypoints = insertWaypointSorted(
      connection.waypoints || [],
      position,
      sourcePos,
      targetPos
    );

    updateConnection(connectionId, { waypoints: newWaypoints });
    recordHistory?.();
  }, [connections, elements, packRegistry, updateConnection, recordHistory]);

  /**
   * Remove a waypoint from a connection
   */
  const removeWaypoint = useCallback((connectionId, waypointIndex) => {
    const connection = connections.find(c => c.id === connectionId);
    if (!connection?.waypoints) return;

    const newWaypoints = connection.waypoints.filter((_, i) => i !== waypointIndex);
    updateConnection(connectionId, { waypoints: newWaypoints });
    recordHistory?.();
  }, [connections, updateConnection, recordHistory]);

  /**
   * Clear all waypoints from a connection
   */
  const clearWaypoints = useCallback((connectionId) => {
    updateConnection(connectionId, { waypoints: [] });
    recordHistory?.();
  }, [updateConnection, recordHistory]);

  /**
   * Check if any connection drag is active
   */
  const isAnyDragActive = useCallback(() => {
    return isCreating ||
           draggingWaypointRef.current !== null ||
           draggingSegmentRef.current !== null ||
           draggingEndpointRef.current !== null ||
           draggingCurveRef.current !== null;
  }, [isCreating]);

  return {
    // Connection creation
    isCreating,
    connectSource,
    connectMousePos,
    startConnectionCreate,
    updateConnectionPreview,
    completeConnection,
    cancelConnectionCreate,

    // Waypoint dragging
    draggingWaypoint,
    startWaypointDrag,
    continueWaypointDrag,
    updateWaypointDrag,
    endWaypointDrag,

    // Segment dragging
    draggingSegment,
    startSegmentDrag,
    continueSegmentDrag,
    updateSegmentDrag,
    endSegmentDrag,

    // Endpoint dragging
    draggingEndpoint,
    startEndpointDrag,
    continueEndpointDrag,
    updateEndpointDrag,
    endEndpointDrag,

    // Curve dragging
    draggingCurve,
    startCurveDrag,
    continueCurveDrag,
    updateCurveDrag,
    endCurveDrag,

    // Waypoint management
    addWaypoint,
    removeWaypoint,
    clearWaypoints,

    // Utilities
    screenToCanvas,
    isAnyDragActive,
  };
}

export default useConnectionDrag;

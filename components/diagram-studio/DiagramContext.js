// components/diagram-studio/DiagramContext.js
// State management for DiagramStudio component

import { createContext, useContext, useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';

// ============ CONTEXT ============

const DiagramContext = createContext({
  // Diagram data
  diagram: null,
  elements: [],
  connections: [],
  layers: [],
  groups: [],

  // UI state
  viewport: { x: 0, y: 0, scale: 1 },
  selection: { nodeIds: [], connectionIds: [] },
  activePack: 'process-flow',
  activeTool: 'select',
  showGrid: true,

  // History (undo/redo)
  canUndo: false,
  canRedo: false,

  // Save status
  saveStatus: { dirty: false, saving: false, lastSaved: null },

  // Loading state
  loading: false,
  error: null,

  // Actions
  setDiagram: () => {},
  setElements: () => {},
  setConnections: () => {},
  setViewport: () => {},
  setSelection: () => {},
  setActivePack: () => {},
  setActiveTool: () => {},
  setShowGrid: () => {},

  // Element operations
  addElement: () => {},
  updateElement: () => {},
  removeElement: () => {},

  // Connection operations
  addConnection: () => {},
  updateConnection: () => {},
  removeConnection: () => {},

  // Layer operations
  addLayer: () => {},
  updateLayer: () => {},
  removeLayer: () => {},
  reorderLayers: () => {},

  // Group operations
  groupElements: () => {},
  ungroupElements: () => {},

  // History operations
  undo: () => {},
  redo: () => {},
  recordHistory: () => {},

  // Persistence
  saveDiagram: () => {},
  loadDiagram: () => {},
  createDiagram: () => {},
});

// ============ HISTORY MANAGEMENT ============

const MAX_HISTORY_SIZE = 50;

function createHistorySnapshot(elements, connections) {
  return {
    elements: JSON.parse(JSON.stringify(elements)),
    connections: JSON.parse(JSON.stringify(connections)),
    timestamp: Date.now(),
  };
}

// ============ PROVIDER ============

// Default layer
const DEFAULT_LAYER = { id: 'default', name: 'Default', visible: true, locked: false, order: 0 };

export function DiagramProvider({ children, diagramId: initialDiagramId, defaultPack = 'process-flow', onSave: onSaveCallback }) {
  const { data: session } = useSession();
  const user = session?.user?.email;
  const role = session?.user?.role;

  // Diagram data
  const [diagram, setDiagramState] = useState(null);
  const [elements, setElementsState] = useState([]);
  const [connections, setConnectionsState] = useState([]);
  const [layers, setLayersState] = useState([DEFAULT_LAYER]);
  const [groups, setGroupsState] = useState([]);

  // UI state - start viewport centered on the canvas origin
  // The infinite canvas is 100000x100000 with the logical origin at center (50000, 50000)
  // Initialize viewport to show the center area
  const [viewport, setViewport] = useState({ x: -50000, y: -50000, scale: 1 });
  const [selection, setSelection] = useState({ nodeIds: [], connectionIds: [] });
  const [activePack, setActivePack] = useState(defaultPack);
  const [activeTool, setActiveTool] = useState('select');
  const [showGrid, setShowGrid] = useState(true);
  const [gridStyle, setGridStyle] = useState('lines'); // 'dots', 'lines', 'none'
  const [selectedStencil, setSelectedStencil] = useState(null); // For draw-to-size mode
  const [stickyNoteColor, setStickyNoteColor] = useState('#fef08a'); // Default yellow sticky
  const [drawingTool, setDrawingToolInternal] = useState(null); // 'pen' | 'highlighter' | 'eraser' | null
  const [drawingColor, setDrawingColor] = useState('#1f2937'); // Drawing tool color
  const [drawingStrokeWidth, setDrawingStrokeWidth] = useState(2); // Drawing stroke width (1-8)

  // Tool-specific defaults for drawing
  const DRAWING_DEFAULTS = {
    pen: { color: '#1f2937', strokeWidth: 2 },
    highlighter: { color: '#fef08a', strokeWidth: 20 },
    eraser: { color: '#ffffff', strokeWidth: 20 },
  };

  // Set drawing tool with appropriate defaults
  const setDrawingTool = useCallback((tool) => {
    setDrawingToolInternal(tool);
    if (tool && DRAWING_DEFAULTS[tool]) {
      setDrawingColor(DRAWING_DEFAULTS[tool].color);
      setDrawingStrokeWidth(DRAWING_DEFAULTS[tool].strokeWidth);
    }
  }, []);
  const [lastLineStyle, setLastLineStyle] = useState(null); // Remember last used line style for new connections
  const [isDragging, setIsDragging] = useState(false); // Track if user is dragging elements (hides toolbars)
  const [isRotating, setIsRotating] = useState(false); // Track if user is rotating elements (hides toolbars)

  // History state
  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);

  // Save status
  const [saveStatus, setSaveStatus] = useState({ dirty: false, saving: false, lastSaved: null });

  // Loading state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Auto-save timer ref (debounced save after changes)
  const autoSaveTimerRef = useRef(null);
  const autoSaveDelayMs = 1000; // 1 second debounce after last change

  // ============ HISTORY OPERATIONS ============

  const recordHistory = useCallback(() => {
    const snapshot = createHistorySnapshot(elements, connections);
    setHistoryPast(prev => {
      const newPast = [...prev, snapshot];
      if (newPast.length > MAX_HISTORY_SIZE) {
        return newPast.slice(-MAX_HISTORY_SIZE);
      }
      return newPast;
    });
    setHistoryFuture([]); // Clear redo stack on new action
    setSaveStatus(prev => ({ ...prev, dirty: true }));
  }, [elements, connections]);

  const undo = useCallback(() => {
    if (historyPast.length === 0) return;

    // Save current state to future
    const currentSnapshot = createHistorySnapshot(elements, connections);
    setHistoryFuture(prev => [currentSnapshot, ...prev]);

    // Restore previous state
    const previousSnapshot = historyPast[historyPast.length - 1];
    setHistoryPast(prev => prev.slice(0, -1));
    setElementsState(previousSnapshot.elements);
    setConnectionsState(previousSnapshot.connections);
    setSaveStatus(prev => ({ ...prev, dirty: true }));
  }, [historyPast, elements, connections]);

  const redo = useCallback(() => {
    if (historyFuture.length === 0) return;

    // Save current state to past
    const currentSnapshot = createHistorySnapshot(elements, connections);
    setHistoryPast(prev => [...prev, currentSnapshot]);

    // Restore future state
    const futureSnapshot = historyFuture[0];
    setHistoryFuture(prev => prev.slice(1));
    setElementsState(futureSnapshot.elements);
    setConnectionsState(futureSnapshot.connections);
    setSaveStatus(prev => ({ ...prev, dirty: true }));
  }, [historyFuture, elements, connections]);

  // ============ ELEMENT OPERATIONS ============

  const setElements = useCallback((newElements) => {
    recordHistory();
    setElementsState(typeof newElements === 'function' ? newElements(elements) : newElements);
  }, [elements, recordHistory]);

  const addElement = useCallback((element) => {
    recordHistory();
    const newElement = {
      id: element.id || `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      ...element,
    };
    setElementsState(prev => [...prev, newElement]);
    return newElement;
  }, [recordHistory]);

  const updateElement = useCallback((elementId, updates) => {
    recordHistory();
    setElementsState(prev => prev.map(el =>
      el.id === elementId
        ? { ...el, ...updates, updatedAt: new Date().toISOString() }
        : el
    ));
  }, [recordHistory]);

  const removeElement = useCallback((elementId) => {
    recordHistory();
    setElementsState(prev => prev.filter(el => el.id !== elementId));
    // Also remove connections to/from this element
    setConnectionsState(prev => prev.filter(
      conn => conn.sourceId !== elementId && conn.targetId !== elementId
    ));
    // Clear selection if removed element was selected
    setSelection(prev => ({
      nodeIds: prev.nodeIds.filter(id => id !== elementId),
      connectionIds: prev.connectionIds,
    }));
  }, [recordHistory]);

  // ============ CONNECTION OPERATIONS ============

  const setConnections = useCallback((newConnections) => {
    recordHistory();
    setConnectionsState(typeof newConnections === 'function' ? newConnections(connections) : newConnections);
  }, [connections, recordHistory]);

  const addConnection = useCallback((connection) => {
    recordHistory();
    const newConnection = {
      id: connection.id || `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      // Default to arrow on target endpoint
      targetMarker: connection.targetMarker ?? 'arrow',
      sourceMarker: connection.sourceMarker ?? 'none',
      ...connection,
    };
    setConnectionsState(prev => [...prev, newConnection]);
    return newConnection;
  }, [recordHistory]);

  const updateConnection = useCallback((connectionId, updates) => {
    recordHistory();
    // Track line style changes to remember for new connections
    if (updates.lineStyle) {
      setLastLineStyle(updates.lineStyle);
    }
    setConnectionsState(prev => prev.map(conn =>
      conn.id === connectionId
        ? { ...conn, ...updates, updatedAt: new Date().toISOString() }
        : conn
    ));
  }, [recordHistory]);

  const removeConnection = useCallback((connectionId) => {
    recordHistory();
    setConnectionsState(prev => prev.filter(conn => conn.id !== connectionId));
    // Clear selection if removed connection was selected
    setSelection(prev => ({
      nodeIds: prev.nodeIds,
      connectionIds: prev.connectionIds.filter(id => id !== connectionId),
    }));
  }, [recordHistory]);

  // ============ LAYER OPERATIONS ============

  const addLayer = useCallback((layer) => {
    recordHistory();
    const newLayer = {
      id: layer.id || `layer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: layer.name || `Layer ${layers.length + 1}`,
      visible: layer.visible !== false,
      locked: layer.locked || false,
      order: layers.length,
      ...layer,
    };
    setLayersState(prev => [...prev, newLayer]);
    return newLayer;
  }, [recordHistory, layers.length]);

  const updateLayer = useCallback((layerId, updates) => {
    recordHistory();
    setLayersState(prev => prev.map(layer =>
      layer.id === layerId ? { ...layer, ...updates } : layer
    ));
  }, [recordHistory]);

  const removeLayer = useCallback((layerId) => {
    if (layerId === 'default') return; // Cannot remove default layer
    recordHistory();
    // Move elements from deleted layer to default layer
    setElementsState(prev => prev.map(el =>
      el.layerId === layerId ? { ...el, layerId: 'default' } : el
    ));
    setLayersState(prev => prev.filter(layer => layer.id !== layerId));
  }, [recordHistory]);

  const reorderLayers = useCallback((newOrder) => {
    recordHistory();
    setLayersState(prev => {
      const layerMap = Object.fromEntries(prev.map(l => [l.id, l]));
      return newOrder.map((id, index) => ({ ...layerMap[id], order: index }));
    });
  }, [recordHistory]);

  // ============ GROUP OPERATIONS ============

  const groupElements = useCallback((elementIds) => {
    if (elementIds.length < 2) return null;
    recordHistory();

    const groupId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Get the bounding box of all elements to position the group
    const groupedElements = elements.filter(el => elementIds.includes(el.id));
    const minX = Math.min(...groupedElements.map(el => el.x));
    const minY = Math.min(...groupedElements.map(el => el.y));
    const maxX = Math.max(...groupedElements.map(el => el.x + (el.size?.width || 100)));
    const maxY = Math.max(...groupedElements.map(el => el.y + (el.size?.height || 60)));

    const newGroup = {
      id: groupId,
      name: `Group ${groups.length + 1}`,
      elementIds: [...elementIds],
      bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      createdAt: new Date().toISOString(),
    };

    // Update elements to reference the group
    setElementsState(prev => prev.map(el =>
      elementIds.includes(el.id) ? { ...el, groupId } : el
    ));

    setGroupsState(prev => [...prev, newGroup]);
    return newGroup;
  }, [recordHistory, elements, groups.length]);

  const ungroupElements = useCallback((groupId) => {
    recordHistory();

    // Remove groupId from elements
    setElementsState(prev => prev.map(el =>
      el.groupId === groupId ? { ...el, groupId: undefined } : el
    ));

    // Remove the group
    setGroupsState(prev => prev.filter(g => g.id !== groupId));
  }, [recordHistory]);

  // ============ SELECTION OPERATIONS ============

  // Delete all selected elements and connections
  const deleteSelected = useCallback(() => {
    recordHistory();

    // Get selected IDs
    const selectedNodeIds = selection.nodeIds || [];
    const selectedConnectionIds = selection.connectionIds || [];

    if (selectedNodeIds.length === 0 && selectedConnectionIds.length === 0) return;

    // Remove selected elements
    if (selectedNodeIds.length > 0) {
      setElementsState(prev => prev.filter(el => !selectedNodeIds.includes(el.id)));
      // Also remove connections that reference deleted elements
      setConnectionsState(prev => prev.filter(conn =>
        !selectedNodeIds.includes(conn.sourceId) && !selectedNodeIds.includes(conn.targetId)
      ));
    }

    // Remove selected connections
    if (selectedConnectionIds.length > 0) {
      setConnectionsState(prev => prev.filter(conn => !selectedConnectionIds.includes(conn.id)));
    }

    // Clear selection
    setSelection({ nodeIds: [], connectionIds: [] });
  }, [recordHistory, selection, setSelection]);

  // Duplicate all selected elements
  const duplicateSelected = useCallback(() => {
    recordHistory();

    const selectedNodeIds = selection.nodeIds || [];
    if (selectedNodeIds.length === 0) return;

    const selectedElements = elements.filter(el => selectedNodeIds.includes(el.id));
    if (selectedElements.length === 0) return;

    // Calculate bounding box of selected elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    selectedElements.forEach(el => {
      const width = el.size?.width || 100;
      const height = el.size?.height || 60;
      minX = Math.min(minX, el.x || 0);
      minY = Math.min(minY, el.y || 0);
      maxX = Math.max(maxX, (el.x || 0) + width);
      maxY = Math.max(maxY, (el.y || 0) + height);
    });

    const selectionWidth = maxX - minX;
    const selectionHeight = maxY - minY;
    const gap = 30;

    // Helper function to check if a position would overlap with ANY existing element
    const checkOverlap = (testX, testY) => {
      return elements.some(el => {
        const elWidth = el.size?.width || 100;
        const elHeight = el.size?.height || 60;
        const elLeft = el.x || 0;
        const elTop = el.y || 0;
        const elRight = elLeft + elWidth;
        const elBottom = elTop + elHeight;

        const newRight = testX + selectionWidth;
        const newBottom = testY + selectionHeight;

        // Check if bounding boxes overlap
        return !(testX >= elRight || newRight <= elLeft || testY >= elBottom || newBottom <= elTop);
      });
    };

    // Try positions: right, then below, then keep trying right with increasing offset
    let finalOffsetX = selectionWidth + gap;
    let finalOffsetY = 0;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const testX = minX + finalOffsetX;
      const testY = minY + finalOffsetY;

      if (!checkOverlap(testX, testY)) {
        break; // Found a clear spot
      }

      attempts++;
      if (attempts === 1) {
        // First fallback: try below
        finalOffsetX = 0;
        finalOffsetY = selectionHeight + gap;
      } else {
        // Keep moving right
        finalOffsetX = (selectionWidth + gap) * attempts;
        finalOffsetY = 0;
      }
    }

    // Create ID mapping for updating connections
    const idMapping = {};

    // Duplicate elements
    const newElements = selectedElements.map(el => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMapping[el.id] = newId;
      return {
        ...el,
        id: newId,
        x: (el.x || 0) + finalOffsetX,
        y: (el.y || 0) + finalOffsetY,
        groupId: undefined, // Don't copy group membership
      };
    });

    // Add new elements
    setElementsState(prev => [...prev, ...newElements]);

    // Duplicate connections between selected elements
    const selectedConnections = connections.filter(conn =>
      selectedNodeIds.includes(conn.sourceId) && selectedNodeIds.includes(conn.targetId)
    );

    if (selectedConnections.length > 0) {
      const newConnections = selectedConnections.map(conn => ({
        ...conn,
        id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        sourceId: idMapping[conn.sourceId] || conn.sourceId,
        targetId: idMapping[conn.targetId] || conn.targetId,
      }));
      setConnectionsState(prev => [...prev, ...newConnections]);
    }

    // Select the new elements
    setSelection({
      nodeIds: newElements.map(el => el.id),
      connectionIds: [],
    });
  }, [recordHistory, selection, elements, connections, setSelection]);

  // Select all elements
  const selectAll = useCallback(() => {
    setSelection({
      nodeIds: elements.map(el => el.id),
      connectionIds: connections.map(conn => conn.id),
    });
  }, [setSelection, elements, connections]);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelection({ nodeIds: [], connectionIds: [] });
  }, [setSelection]);

  // ============ DIAGRAM OPERATIONS ============

  const setDiagram = useCallback((newDiagram) => {
    setDiagramState(newDiagram);
    if (newDiagram) {
      // Extract elements and connections from content field (database format)
      // or from top-level fields (legacy/direct format)
      const content = newDiagram.content || {};
      const elements = newDiagram.elements || content.elements || content.nodes || [];
      const connections = newDiagram.connections || content.connections || content.edges || [];
      const layers = newDiagram.layers || content.layers || [DEFAULT_LAYER];
      const groups = newDiagram.groups || content.groups || [];

      setElementsState(elements);
      setConnectionsState(connections);
      setLayersState(layers);
      setGroupsState(groups);
      setActivePack(newDiagram.type || 'process-flow');
      // Reset history when loading new diagram
      setHistoryPast([]);
      setHistoryFuture([]);
      setSaveStatus({ dirty: false, saving: false, lastSaved: newDiagram.updated_at || newDiagram.updatedAt || null });
    }
  }, []);

  const loadDiagram = useCallback(async (diagramId) => {
    if (!user || !diagramId) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/diagrams/${diagramId}`);

      if (!res.ok) {
        throw new Error('Failed to load diagram');
      }

      const data = await res.json();
      setDiagram(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setDiagram]);

  const createDiagram = useCallback(async ({ name, type, description = '' }) => {
    if (!user) return null;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/diagrams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name,
          type,
          description,
          elements: [],
          connections: [],
          settings: {},
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to create diagram');
      }

      const data = await res.json();
      setDiagram(data);
      return data;
    } catch (e) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, setDiagram]);

  const saveDiagram = useCallback(async (forceOrOptions = false) => {
    // Support both saveDiagram(true) and saveDiagram({ force: true, name: 'new name' })
    const options = typeof forceOrOptions === 'boolean'
      ? { force: forceOrOptions }
      : forceOrOptions || {};
    const { force = false, name: nameOverride, description: descOverride } = options;

    if (!diagram?.id || (!saveStatus.dirty && !force)) return;

    setSaveStatus(prev => ({ ...prev, saving: true }));

    try {
      // Pack elements, connections, layers, groups into content field for database
      const content = {
        elements,
        connections,
        layers,
        groups,
        viewport: diagram.content?.viewport || { x: 0, y: 0, zoom: 1 },
      };

      // Use overrides if provided (for immediate saves after state changes)
      const saveName = nameOverride !== undefined ? nameOverride : diagram.name;
      const saveDescription = descOverride !== undefined ? descOverride : diagram.description;

      const res = await fetch(`/api/diagrams/${diagram.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: saveName,
          description: saveDescription,
          content,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to save diagram');
      }

      const data = await res.json();
      setDiagramState(prev => ({ ...prev, ...data }));
      setSaveStatus({ dirty: false, saving: false, lastSaved: new Date().toISOString() });

      // Call external save callback if provided
      if (onSaveCallback) {
        onSaveCallback({ elements, connections, layers, groups, diagram: data });
      }

      return data;
    } catch (e) {
      console.error('Save diagram error:', e);
      setError(e.message);
      setSaveStatus(prev => ({ ...prev, saving: false }));
      return null;
    }
  }, [diagram, elements, connections, layers, groups, saveStatus.dirty, onSaveCallback]);

  // ============ AUTO-SAVE ============

  // Debounced autosave - triggers shortly after changes are made
  useEffect(() => {
    // Clear existing timer on any change
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Set up debounced save when dirty
    if (diagram?.id && saveStatus.dirty && !saveStatus.saving) {
      autoSaveTimerRef.current = setTimeout(() => {
        saveDiagram();
      }, autoSaveDelayMs);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [diagram?.id, saveStatus.dirty, saveStatus.saving, saveDiagram, elements, connections]);

  // Save before unload
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (saveStatus.dirty && diagram?.id) {
        saveDiagram(true);
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveStatus.dirty, diagram?.id, saveDiagram]);

  // Auto-load diagram when initialDiagramId is provided
  useEffect(() => {
    if (initialDiagramId && user && !diagram) {
      loadDiagram(initialDiagramId);
    }
  }, [initialDiagramId, user, diagram, loadDiagram]);

  // ============ CONTEXT VALUE ============

  const value = useMemo(() => ({
    // Diagram data
    diagram,
    elements,
    connections,
    layers,
    groups,

    // UI state
    viewport,
    selection,
    activePack,
    activeTool,
    showGrid,
    gridStyle,
    selectedStencil,
    stickyNoteColor,
    drawingTool,
    drawingColor,
    drawingStrokeWidth,
    lastLineStyle,
    isDragging,
    setIsDragging,
    isRotating,
    setIsRotating,

    // History
    canUndo: historyPast.length > 0,
    canRedo: historyFuture.length > 0,

    // Save status
    saveStatus,

    // Loading state
    loading,
    error,

    // Actions
    setDiagram,
    setElements,
    setConnections,
    setViewport,
    setSelection,
    setActivePack,
    setActiveTool,
    setShowGrid,
    setGridStyle,
    setSelectedStencil,
    setStickyNoteColor,
    setDrawingTool,
    setDrawingColor,
    setDrawingStrokeWidth,
    setLastLineStyle,

    // Element operations
    addElement,
    updateElement,
    removeElement,

    // Connection operations
    addConnection,
    updateConnection,
    removeConnection,

    // Layer operations
    addLayer,
    updateLayer,
    removeLayer,
    reorderLayers,

    // Group operations
    groupElements,
    ungroupElements,

    // Selection operations
    deleteSelected,
    duplicateSelected,
    selectAll,
    clearSelection,

    // History operations
    undo,
    redo,
    recordHistory,

    // Persistence
    saveDiagram,
    loadDiagram,
    createDiagram,
  }), [
    diagram, elements, connections, layers, groups,
    viewport, selection, activePack, activeTool, showGrid, gridStyle, selectedStencil, stickyNoteColor, drawingTool, drawingColor, drawingStrokeWidth,
    historyPast.length, historyFuture.length,
    saveStatus, loading, error,
    deleteSelected, duplicateSelected, selectAll, clearSelection,
    setDiagram, setElements, setConnections,
    addElement, updateElement, removeElement,
    addConnection, updateConnection, removeConnection,
    addLayer, updateLayer, removeLayer, reorderLayers,
    groupElements, ungroupElements,
    undo, redo, recordHistory,
    saveDiagram, loadDiagram, createDiagram,
  ]);

  return (
    <DiagramContext.Provider value={value}>
      {children}
    </DiagramContext.Provider>
  );
}

// ============ HOOKS ============

export function useDiagram() {
  return useContext(DiagramContext);
}

// ============ MIND MAP HELPERS ============

// Stencil types that belong to the mind map pack
const MIND_MAP_STENCIL_TYPES = [
  'central-topic',
  'main-topic',
  'sub-topic',
  'floating-topic',
  'topic-red',
  'topic-blue',
  'topic-green',
  'topic-purple',
  'callout',
  'boundary',
  'summary',
];

/**
 * Check if an element is a mind map element (belongs to MindMapPack)
 */
export function isMindMapElement(element) {
  if (!element) return false;
  return element.packId === 'mind-map' || MIND_MAP_STENCIL_TYPES.includes(element.type);
}

/**
 * Check if an element is a central topic (root of mind map)
 */
export function isCentralTopic(element) {
  if (!element) return false;
  return element.type === 'central-topic';
}

/**
 * Get the appropriate child type for a mind map element
 * Central Topic -> Main Topic, Main Topic -> Sub-topic, etc.
 */
export function getMindMapChildType(parentElement) {
  if (!parentElement) return 'sub-topic';
  switch (parentElement.type) {
    case 'central-topic':
      return 'main-topic';
    case 'main-topic':
    case 'sub-topic':
    case 'floating-topic':
    case 'topic-red':
    case 'topic-blue':
    case 'topic-green':
    case 'topic-purple':
      return 'sub-topic';
    default:
      return 'sub-topic';
  }
}

/**
 * Get the default size for a mind map stencil type
 */
export function getMindMapStencilSize(type) {
  switch (type) {
    case 'central-topic':
      return { width: 160, height: 80 };
    case 'main-topic':
      return { width: 140, height: 50 };
    case 'sub-topic':
      return { width: 120, height: 40 };
    case 'floating-topic':
      return { width: 100, height: 35 };
    default:
      return { width: 120, height: 40 };
  }
}

/**
 * Get the default color for a mind map stencil type
 */
export function getMindMapStencilColor(type) {
  switch (type) {
    case 'central-topic':
      return '#3b82f6';
    case 'main-topic':
      return '#22c55e';
    case 'sub-topic':
      return '#f59e0b';
    case 'floating-topic':
      return '#8b5cf6';
    case 'topic-red':
      return '#ef4444';
    case 'topic-blue':
      return '#3b82f6';
    case 'topic-green':
      return '#22c55e';
    case 'topic-purple':
      return '#8b5cf6';
    default:
      return '#f59e0b';
  }
}

// ============ MIND MAP HIERARCHY HELPERS ============

/**
 * Build a parent-child map from connections
 * Returns { parentMap: { childId -> parentId }, childrenMap: { parentId -> [childIds] } }
 */
export function buildMindMapHierarchy(elements, connections) {
  const parentMap = {}; // childId -> parentId
  const childrenMap = {}; // parentId -> [childIds]

  // Initialize childrenMap for all elements
  elements.forEach(el => {
    if (isMindMapElement(el)) {
      childrenMap[el.id] = [];
    }
  });

  // Build hierarchy from connections
  // In mind maps, the source is typically the parent and target is the child
  connections.forEach(conn => {
    const sourceEl = elements.find(el => el.id === conn.sourceId);
    const targetEl = elements.find(el => el.id === conn.targetId);

    if (sourceEl && targetEl && isMindMapElement(sourceEl) && isMindMapElement(targetEl)) {
      // Determine parent-child relationship based on hierarchy level
      // Central topic is always root, main topics are children of central, etc.
      const sourceLevel = getMindMapLevel(sourceEl.type);
      const targetLevel = getMindMapLevel(targetEl.type);

      if (sourceLevel < targetLevel) {
        // Source is parent of target
        parentMap[conn.targetId] = conn.sourceId;
        if (childrenMap[conn.sourceId]) {
          childrenMap[conn.sourceId].push(conn.targetId);
        }
      } else if (targetLevel < sourceLevel) {
        // Target is parent of source
        parentMap[conn.sourceId] = conn.targetId;
        if (childrenMap[conn.targetId]) {
          childrenMap[conn.targetId].push(conn.sourceId);
        }
      } else {
        // Same level - use source as parent (default direction)
        parentMap[conn.targetId] = conn.sourceId;
        if (childrenMap[conn.sourceId]) {
          childrenMap[conn.sourceId].push(conn.targetId);
        }
      }
    }
  });

  return { parentMap, childrenMap };
}

/**
 * Get hierarchy level for mind map element type (lower = higher in hierarchy)
 */
function getMindMapLevel(type) {
  switch (type) {
    case 'central-topic':
      return 0;
    case 'main-topic':
      return 1;
    case 'sub-topic':
      return 2;
    case 'floating-topic':
    case 'topic-red':
    case 'topic-blue':
    case 'topic-green':
    case 'topic-purple':
      return 2;
    case 'callout':
    case 'boundary':
    case 'summary':
      return 3;
    default:
      return 2;
  }
}

/**
 * Get all descendants of a node (children, grandchildren, etc.)
 */
export function getMindMapDescendants(elementId, childrenMap, visited = new Set()) {
  const descendants = [];

  if (visited.has(elementId)) return descendants;
  visited.add(elementId);

  const children = childrenMap[elementId] || [];
  for (const childId of children) {
    descendants.push(childId);
    descendants.push(...getMindMapDescendants(childId, childrenMap, visited));
  }

  return descendants;
}

/**
 * Get the parent of a mind map node
 */
export function getMindMapParent(elementId, parentMap) {
  return parentMap[elementId] || null;
}

/**
 * Get direct children of a mind map node
 */
export function getMindMapChildren(elementId, childrenMap) {
  return childrenMap[elementId] || [];
}

/**
 * Get the root (central topic) of a mind map tree
 */
export function getMindMapRoot(elementId, parentMap) {
  let current = elementId;
  const visited = new Set();

  while (parentMap[current] && !visited.has(current)) {
    visited.add(current);
    current = parentMap[current];
  }

  return current;
}

/**
 * Get all nodes in a subtree (node + all descendants)
 */
export function getMindMapSubtree(elementId, childrenMap) {
  return [elementId, ...getMindMapDescendants(elementId, childrenMap)];
}

/**
 * Count the number of descendants
 */
export function countMindMapDescendants(elementId, childrenMap) {
  return getMindMapDescendants(elementId, childrenMap).length;
}

/**
 * Check if a node is collapsed (has hidden children)
 */
export function isMindMapNodeCollapsed(element) {
  return element?.collapsed === true;
}

/**
 * Hook to get mind map hierarchy for current diagram
 */
export function useMindMapHierarchy() {
  const { elements, connections } = useContext(DiagramContext);

  const hierarchy = useMemo(() => {
    return buildMindMapHierarchy(elements, connections);
  }, [elements, connections]);

  const getDescendants = useCallback((elementId) => {
    return getMindMapDescendants(elementId, hierarchy.childrenMap);
  }, [hierarchy.childrenMap]);

  const getSubtree = useCallback((elementId) => {
    return getMindMapSubtree(elementId, hierarchy.childrenMap);
  }, [hierarchy.childrenMap]);

  const getParent = useCallback((elementId) => {
    return getMindMapParent(elementId, hierarchy.parentMap);
  }, [hierarchy.parentMap]);

  const getChildren = useCallback((elementId) => {
    return getMindMapChildren(elementId, hierarchy.childrenMap);
  }, [hierarchy.childrenMap]);

  const getRoot = useCallback((elementId) => {
    return getMindMapRoot(elementId, hierarchy.parentMap);
  }, [hierarchy.parentMap]);

  const countDescendants = useCallback((elementId) => {
    return countMindMapDescendants(elementId, hierarchy.childrenMap);
  }, [hierarchy.childrenMap]);

  return {
    parentMap: hierarchy.parentMap,
    childrenMap: hierarchy.childrenMap,
    getDescendants,
    getSubtree,
    getParent,
    getChildren,
    getRoot,
    countDescendants,
  };
}

export function useDiagramSelection() {
  const { selection, setSelection, elements, connections } = useContext(DiagramContext);

  const selectedElements = useMemo(() =>
    elements.filter(el => selection.nodeIds.includes(el.id)),
    [elements, selection.nodeIds]
  );

  const selectedConnections = useMemo(() =>
    connections.filter(conn => selection.connectionIds.includes(conn.id)),
    [connections, selection.connectionIds]
  );

  const selectElement = useCallback((elementId, addToSelection = false) => {
    setSelection(prev => ({
      nodeIds: addToSelection ? [...prev.nodeIds, elementId] : [elementId],
      connectionIds: addToSelection ? prev.connectionIds : [],
    }));
  }, [setSelection]);

  // Select multiple elements at once (for marquee selection)
  const selectElements = useCallback((elementIds, addToSelection = false) => {
    setSelection(prev => ({
      nodeIds: addToSelection
        ? [...new Set([...prev.nodeIds, ...elementIds])]
        : elementIds,
      connectionIds: addToSelection ? prev.connectionIds : [],
    }));
  }, [setSelection]);

  // Toggle element in selection (for shift+click)
  const toggleElementSelection = useCallback((elementId) => {
    setSelection(prev => {
      const isSelected = prev.nodeIds.includes(elementId);
      return {
        nodeIds: isSelected
          ? prev.nodeIds.filter(id => id !== elementId)
          : [...prev.nodeIds, elementId],
        connectionIds: prev.connectionIds,
      };
    });
  }, [setSelection]);

  // Select all elements
  const selectAll = useCallback(() => {
    setSelection({
      nodeIds: elements.map(el => el.id),
      connectionIds: connections.map(conn => conn.id),
    });
  }, [setSelection, elements, connections]);

  const selectConnection = useCallback((connectionId, addToSelection = false) => {
    setSelection(prev => ({
      nodeIds: addToSelection ? prev.nodeIds : [],
      connectionIds: addToSelection ? [...prev.connectionIds, connectionId] : [connectionId],
    }));
  }, [setSelection]);

  const clearSelection = useCallback(() => {
    setSelection({ nodeIds: [], connectionIds: [] });
  }, [setSelection]);

  const isElementSelected = useCallback((elementId) =>
    selection.nodeIds.includes(elementId),
    [selection.nodeIds]
  );

  const isConnectionSelected = useCallback((connectionId) =>
    selection.connectionIds.includes(connectionId),
    [selection.connectionIds]
  );

  return {
    selection,
    selectedElements,
    selectedConnections,
    selectElement,
    selectElements,
    toggleElementSelection,
    selectAll,
    selectConnection,
    clearSelection,
    isElementSelected,
    isConnectionSelected,
  };
}

export function useDiagramHistory() {
  const { canUndo, canRedo, undo, redo, recordHistory } = useContext(DiagramContext);
  return { canUndo, canRedo, undo, redo, recordHistory };
}

export function useDiagramViewport() {
  const { viewport, setViewport } = useContext(DiagramContext);

  // Zoom step of 1.1 (10% change) for finer control
  const ZOOM_STEP = 1.1;
  const MIN_ZOOM = 0.1;
  const MAX_ZOOM = 4;

  // Zoom towards center of viewport (keeps the center point fixed)
  const zoomIn = useCallback(() => {
    setViewport(prev => {
      const newScale = Math.min(MAX_ZOOM, prev.scale * ZOOM_STEP);
      // Assume viewport center is roughly center of typical window
      const centerX = (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2;
      const centerY = (typeof window !== 'undefined' ? window.innerHeight : 800) / 2;
      // Adjust viewport to keep center fixed
      const newX = prev.x + centerX / newScale - centerX / prev.scale;
      const newY = prev.y + centerY / newScale - centerY / prev.scale;
      return { x: newX, y: newY, scale: newScale };
    });
  }, [setViewport]);

  const zoomOut = useCallback(() => {
    setViewport(prev => {
      const newScale = Math.max(MIN_ZOOM, prev.scale / ZOOM_STEP);
      // Assume viewport center is roughly center of typical window
      const centerX = (typeof window !== 'undefined' ? window.innerWidth : 1200) / 2;
      const centerY = (typeof window !== 'undefined' ? window.innerHeight : 800) / 2;
      // Adjust viewport to keep center fixed
      const newX = prev.x + centerX / newScale - centerX / prev.scale;
      const newY = prev.y + centerY / newScale - centerY / prev.scale;
      return { x: newX, y: newY, scale: newScale };
    });
  }, [setViewport]);

  const resetZoom = useCallback(() => {
    // Reset to centered position on the infinite canvas
    setViewport({ x: -50000, y: -50000, scale: 1 });
  }, [setViewport]);

  const pan = useCallback((dx, dy) => {
    setViewport(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
  }, [setViewport]);

  // Zoom to fit a specific element (frame) within the viewport
  // containerWidth and containerHeight are the canvas container dimensions
  const zoomToFrame = useCallback((element, containerWidth = 1200, containerHeight = 800, padding = 60) => {
    if (!element) return;

    const { x, y, size } = element;
    const width = size?.width || 600;
    const height = size?.height || 400;

    // Calculate the scale to fit the element with padding
    const scaleX = (containerWidth - padding * 2) / width;
    const scaleY = (containerHeight - padding * 2) / height;
    const scale = Math.min(Math.max(0.25, Math.min(scaleX, scaleY)), 2);

    // Calculate viewport position to center the element
    const centerX = x + width / 2;
    const centerY = y + height / 2;

    // Viewport x/y represent the offset - we want the center of the element
    // to be at the center of the container
    const viewportX = -(centerX - (containerWidth / 2) / scale);
    const viewportY = -(centerY - (containerHeight / 2) / scale);

    setViewport({ x: viewportX, y: viewportY, scale });
  }, [setViewport]);

  // Zoom to fit all elements in view
  const zoomToFitAll = useCallback((elements, containerWidth = 1200, containerHeight = 800, padding = 60) => {
    if (!elements || elements.length === 0) {
      resetZoom();
      return;
    }

    // Find bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
      const width = el.size?.width || 100;
      const height = el.size?.height || 60;
      minX = Math.min(minX, el.x);
      minY = Math.min(minY, el.y);
      maxX = Math.max(maxX, el.x + width);
      maxY = Math.max(maxY, el.y + height);
    });

    const width = maxX - minX;
    const height = maxY - minY;

    if (width <= 0 || height <= 0) {
      resetZoom();
      return;
    }

    // Calculate scale
    const scaleX = (containerWidth - padding * 2) / width;
    const scaleY = (containerHeight - padding * 2) / height;
    const scale = Math.min(Math.max(0.25, Math.min(scaleX, scaleY)), 2);

    // Center
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const viewportX = -(centerX - (containerWidth / 2) / scale);
    const viewportY = -(centerY - (containerHeight / 2) / scale);

    setViewport({ x: viewportX, y: viewportY, scale });
  }, [setViewport, resetZoom]);

  return { viewport, setViewport, zoomIn, zoomOut, resetZoom, pan, zoomToFrame, zoomToFitAll };
}

export default DiagramContext;

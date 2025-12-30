// components/diagram-studio/hooks/interaction/useClipboard.js
// Clipboard operations for diagram elements (copy, paste, duplicate)

import { useState, useCallback } from 'react';

/**
 * Hook for clipboard operations on diagram elements.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Array} options.connections - All diagram connections
 * @param {Object} options.selection - Current selection { nodeIds: string[] }
 * @param {Function} options.addElement - Function to add an element
 * @param {Function} options.addConnection - Function to add a connection
 * @param {Function} options.selectElements - Function to select elements by IDs
 * @param {Function} options.recordHistory - Function to record undo history
 * @returns {Object} - { copy, paste, duplicate, canPaste, clipboard }
 */
export function useClipboard({
  elements,
  connections,
  selection,
  addElement,
  addConnection,
  selectElements,
  recordHistory,
}) {
  const [clipboard, setClipboard] = useState(null);

  /**
   * Copy selected elements to internal clipboard.
   * Stores elements with normalized positions (relative to bounding box)
   * and connections between selected elements.
   */
  const copy = useCallback(() => {
    if (!selection?.nodeIds?.length) return;

    const selectedEls = elements.filter(el => selection.nodeIds.includes(el.id));
    if (selectedEls.length === 0) return;

    const selectedConns = connections.filter(conn =>
      selection.nodeIds.includes(conn.sourceId) && selection.nodeIds.includes(conn.targetId)
    );

    // Calculate bounds for offset on paste
    const minX = Math.min(...selectedEls.map(el => el.x));
    const minY = Math.min(...selectedEls.map(el => el.y));

    setClipboard({
      elements: selectedEls.map(el => ({
        ...el,
        x: el.x - minX,
        y: el.y - minY,
      })),
      connections: selectedConns,
      offset: { x: minX, y: minY },
    });
  }, [selection?.nodeIds, elements, connections]);

  /**
   * Paste elements from clipboard.
   * Creates new elements with new IDs at an offset from original position.
   *
   * @param {Object} options - Paste options
   * @param {number} options.offsetX - X offset from original position (default: 40)
   * @param {number} options.offsetY - Y offset from original position (default: 40)
   */
  const paste = useCallback((options = {}) => {
    if (!clipboard || clipboard.elements.length === 0) return;

    const { offsetX = 40, offsetY = 40 } = options;
    const idMap = {}; // Map old IDs to new IDs

    // Create new elements with new IDs
    const newElements = clipboard.elements.map(el => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[el.id] = newId;
      return {
        ...el,
        id: newId,
        x: el.x + clipboard.offset.x + offsetX,
        y: el.y + clipboard.offset.y + offsetY,
      };
    });

    // Create new connections with updated IDs
    const newConnections = clipboard.connections.map(conn => ({
      ...conn,
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceId: idMap[conn.sourceId],
      targetId: idMap[conn.targetId],
    }));

    // Add elements and connections
    newElements.forEach(el => addElement(el));
    newConnections.forEach(conn => addConnection(conn));

    // Select the pasted elements
    selectElements(newElements.map(el => el.id));

    recordHistory();

    return { elements: newElements, connections: newConnections };
  }, [clipboard, addElement, addConnection, selectElements, recordHistory]);

  /**
   * Duplicate selected elements.
   * Copies and immediately pastes at an offset.
   */
  const duplicate = useCallback(() => {
    if (!selection?.nodeIds?.length) return;

    // Perform copy synchronously
    const selectedEls = elements.filter(el => selection.nodeIds.includes(el.id));
    if (selectedEls.length === 0) return;

    const selectedConns = connections.filter(conn =>
      selection.nodeIds.includes(conn.sourceId) && selection.nodeIds.includes(conn.targetId)
    );

    const minX = Math.min(...selectedEls.map(el => el.x));
    const minY = Math.min(...selectedEls.map(el => el.y));

    const tempClipboard = {
      elements: selectedEls.map(el => ({
        ...el,
        x: el.x - minX,
        y: el.y - minY,
      })),
      connections: selectedConns,
      offset: { x: minX, y: minY },
    };

    // Paste immediately
    const idMap = {};
    const pasteOffset = 40;

    const newElements = tempClipboard.elements.map(el => {
      const newId = `el-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      idMap[el.id] = newId;
      return {
        ...el,
        id: newId,
        x: el.x + tempClipboard.offset.x + pasteOffset,
        y: el.y + tempClipboard.offset.y + pasteOffset,
      };
    });

    const newConnections = tempClipboard.connections.map(conn => ({
      ...conn,
      id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      sourceId: idMap[conn.sourceId],
      targetId: idMap[conn.targetId],
    }));

    newElements.forEach(el => addElement(el));
    newConnections.forEach(conn => addConnection(conn));
    selectElements(newElements.map(el => el.id));
    recordHistory();

    return { elements: newElements, connections: newConnections };
  }, [selection?.nodeIds, elements, connections, addElement, addConnection, selectElements, recordHistory]);

  /**
   * Clear the clipboard
   */
  const clear = useCallback(() => {
    setClipboard(null);
  }, []);

  return {
    copy,
    paste,
    duplicate,
    clear,
    canPaste: clipboard !== null && clipboard.elements.length > 0,
    clipboard,
  };
}

export default useClipboard;

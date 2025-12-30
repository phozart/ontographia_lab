// components/diagram-studio/hooks/interaction/useContextMenu.js
// Context menu handling for diagram elements

import { useState, useCallback } from 'react';

/**
 * Menu item definition:
 * {
 *   label: string,           // Display text
 *   action: string,          // Action identifier
 *   icon?: string,           // Emoji or icon component
 *   shortcut?: string,       // Keyboard shortcut hint
 *   disabled?: boolean,      // Whether item is disabled
 *   danger?: boolean,        // Whether item is destructive
 *   type?: 'divider',        // Divider item type
 * }
 */

/**
 * Context menu state:
 * {
 *   x: number,               // Menu X position
 *   y: number,               // Menu Y position
 *   items: MenuItem[],       // Menu items to display
 *   context: Object,         // Additional context data (nodeId, connectionId, etc.)
 * }
 */

/**
 * Hook for managing context menu state and behavior.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.menuBuilders - Builders for different context types
 * @param {Function} options.menuBuilders.node - (nodeId, element) => MenuItem[]
 * @param {Function} options.menuBuilders.connection - (connectionId, connection) => MenuItem[]
 * @param {Function} options.menuBuilders.canvas - () => MenuItem[]
 * @param {Object} options.actionHandlers - Action handlers keyed by action string
 * @param {boolean} options.readOnly - Whether in read-only mode
 * @returns {Object} - { contextMenu, showMenu, hideMenu, handleAction, onContextMenu }
 */
export function useContextMenu(options = {}) {
  const {
    menuBuilders = {},
    actionHandlers = {},
    readOnly = false,
  } = options;

  const [contextMenu, setContextMenu] = useState(null);

  /**
   * Show context menu at position with items
   */
  const showMenu = useCallback((x, y, items, context = {}) => {
    if (items.length > 0) {
      setContextMenu({ x, y, items, ...context });
    }
  }, []);

  /**
   * Hide context menu
   */
  const hideMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * Handle context menu action
   */
  const handleAction = useCallback((action, context = {}) => {
    hideMenu();

    const handler = actionHandlers[action];
    if (handler) {
      handler(context);
    }
  }, [actionHandlers, hideMenu]);

  /**
   * Create onContextMenu handler for the canvas element
   */
  const onContextMenu = useCallback((e, getContext) => {
    e.preventDefault();
    if (readOnly) return;

    const x = e.clientX;
    const y = e.clientY;

    // Get context from callback if provided
    const context = getContext ? getContext(e) : {};

    // Determine what was right-clicked
    const nodeEl = e.target.closest('.ds-node');
    const connectionEl = e.target.closest('.ds-connection-group');

    let items = [];

    if (nodeEl && menuBuilders.node) {
      const nodeId = nodeEl.dataset?.nodeId;
      items = menuBuilders.node(nodeId, { nodeEl, ...context });
    } else if (connectionEl && menuBuilders.connection) {
      const connectionId = connectionEl.dataset?.connectionId;
      items = menuBuilders.connection(connectionId, { connectionEl, ...context });
    } else if (menuBuilders.canvas) {
      items = menuBuilders.canvas(context);
    }

    if (items.length > 0) {
      setContextMenu({
        x,
        y,
        items,
        nodeEl,
        connectionEl,
        ...context,
      });
    }
  }, [readOnly, menuBuilders]);

  return {
    contextMenu,
    showMenu,
    hideMenu,
    handleAction,
    onContextMenu,
    isOpen: contextMenu !== null,
  };
}

/**
 * Standard node menu items for diagrams
 */
export function getNodeMenuItems(nodeId, options = {}) {
  const { readOnly = false } = options;
  if (readOnly) return [];

  return [
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

/**
 * Standard connection menu items for diagrams
 */
export function getConnectionMenuItems(connectionId, options = {}) {
  const { readOnly = false, hasWaypoints = false } = options;
  if (readOnly) return [];

  return [
    { label: 'Edit Label', action: 'edit-connection-label', icon: '✏️' },
    { type: 'divider' },
    { label: 'Add Waypoint Here', action: 'add-waypoint', icon: '📍' },
    ...(hasWaypoints ? [{ label: 'Clear Waypoints', action: 'clear-waypoints', icon: '🧹' }] : []),
    { type: 'divider' },
    { label: 'Delete', action: 'delete-connection', icon: '🗑️', danger: true },
  ];
}

/**
 * Standard canvas menu items for diagrams
 */
export function getCanvasMenuItems(options = {}) {
  const { canPaste = false } = options;

  return [
    { label: 'Select All', action: 'select-all', icon: '☑️' },
    { label: 'Paste', action: 'paste', icon: '📋', disabled: !canPaste },
    { type: 'divider' },
    { label: 'Fit to View', action: 'fit-view', icon: '🔍' },
    { label: 'Reset Zoom', action: 'reset-zoom', icon: '↺' },
  ];
}

/**
 * Create standard diagram action handlers
 */
export function createDiagramContextActions(actions) {
  return {
    'edit-label': ({ nodeId }) => actions.editLabel?.(nodeId),
    'properties': ({ nodeId }) => actions.showProperties?.(nodeId),
    'show-toolbar': ({ nodeId }) => actions.showToolbar?.(nodeId),
    'duplicate': ({ nodeId }) => actions.duplicate?.(nodeId),
    'delete': ({ nodeId }) => actions.deleteNode?.(nodeId),
    'delete-connection': ({ connectionId }) => actions.deleteConnection?.(connectionId),
    'bring-front': ({ nodeId }) => actions.bringToFront?.(nodeId),
    'send-back': ({ nodeId }) => actions.sendToBack?.(nodeId),
    'select-all': () => actions.selectAll?.(),
    'paste': () => actions.paste?.(),
    'fit-view': () => actions.fitToView?.(),
    'reset-zoom': () => actions.resetZoom?.(),
    'edit-connection-label': ({ connectionId }) => actions.editConnectionLabel?.(connectionId),
    'add-waypoint': (context) => actions.addWaypoint?.(context),
    'clear-waypoints': ({ connectionId }) => actions.clearWaypoints?.(connectionId),
  };
}

export default useContextMenu;

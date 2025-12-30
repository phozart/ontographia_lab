// components/diagram-studio/hooks/interaction/useQuickCreate.js
// Quick-create functionality for creating connected elements from edge handles

import { useCallback } from 'react';
import { getPortPosition, snapToGrid } from '../../utils';

/**
 * Default spacing between elements when quick-creating
 */
const DEFAULT_SPACING = 80;

/**
 * Hook for quick-create functionality.
 * Creates a new element connected to an existing element via edge handle + button.
 *
 * @param {Object} options - Configuration options
 * @param {Array} options.elements - All diagram elements
 * @param {Function} options.addElement - Function to add an element
 * @param {Function} options.addConnection - Function to add a connection
 * @param {Function} options.selectElement - Function to select an element
 * @param {Function} options.recordHistory - Function to record undo history
 * @param {Object} options.packRegistry - Pack registry for element info
 * @param {boolean} options.readOnly - Whether in read-only mode
 * @returns {Object} - Quick-create methods
 */
export function useQuickCreate({
  elements,
  addElement,
  addConnection,
  selectElement,
  recordHistory,
  packRegistry,
  readOnly = false,
}) {
  /**
   * Get element size from pack registry
   */
  const getElementSize = useCallback((element) => {
    const pack = packRegistry?.get?.(element.packId);
    const stencil = pack?.stencils?.find(s => s.id === element.type);
    return element.size || stencil?.defaultSize || { width: 120, height: 60 };
  }, [packRegistry]);

  /**
   * Get default stencil for a pack
   */
  const getDefaultStencil = useCallback((packId) => {
    const pack = packRegistry?.get?.(packId);
    if (!pack?.stencils?.length) return null;

    // Try to find a default stencil (usually 'task' or 'rectangle')
    const defaultTypes = ['task', 'rectangle', 'process', 'box'];
    for (const type of defaultTypes) {
      const stencil = pack.stencils.find(s => s.id === type);
      if (stencil) return { ...stencil, packId };
    }

    // Fall back to first stencil
    return { ...pack.stencils[0], packId };
  }, [packRegistry]);

  /**
   * Find an available position for a new element
   * Avoids overlapping with existing elements
   */
  const findAvailablePosition = useCallback((baseX, baseY, size, direction) => {
    const checkOverlap = (x, y) => {
      return elements.some(el => {
        const elSize = getElementSize(el);
        const elRight = el.x + elSize.width;
        const elBottom = el.y + elSize.height;
        const newRight = x + size.width;
        const newBottom = y + size.height;

        // Check for overlap with padding
        const padding = 10;
        return !(x >= elRight + padding ||
                 newRight <= el.x - padding ||
                 y >= elBottom + padding ||
                 newBottom <= el.y - padding);
      });
    };

    let x = baseX;
    let y = baseY;
    let attempts = 0;
    const maxAttempts = 10;
    const stepSize = size.height + 20;

    while (checkOverlap(x, y) && attempts < maxAttempts) {
      attempts++;

      // Offset based on direction
      switch (direction) {
        case 'right':
        case 'left':
          y += stepSize * (attempts % 2 === 0 ? 1 : -1) * Math.ceil(attempts / 2);
          break;
        case 'bottom':
        case 'top':
          x += stepSize * (attempts % 2 === 0 ? 1 : -1) * Math.ceil(attempts / 2);
          break;
        default:
          y += stepSize;
      }
    }

    return { x: snapToGrid(x), y: snapToGrid(y) };
  }, [elements, getElementSize]);

  /**
   * Calculate position for new element based on source element and port
   */
  const calculateNewElementPosition = useCallback((sourceElement, port, newSize) => {
    const sourceSize = getElementSize(sourceElement);
    const spacing = DEFAULT_SPACING;

    let baseX, baseY;

    switch (port) {
      case 'right':
        baseX = sourceElement.x + sourceSize.width + spacing;
        baseY = sourceElement.y + (sourceSize.height - newSize.height) / 2;
        break;
      case 'left':
        baseX = sourceElement.x - spacing - newSize.width;
        baseY = sourceElement.y + (sourceSize.height - newSize.height) / 2;
        break;
      case 'bottom':
        baseX = sourceElement.x + (sourceSize.width - newSize.width) / 2;
        baseY = sourceElement.y + sourceSize.height + spacing;
        break;
      case 'top':
        baseX = sourceElement.x + (sourceSize.width - newSize.width) / 2;
        baseY = sourceElement.y - spacing - newSize.height;
        break;
      default:
        // Default to right
        baseX = sourceElement.x + sourceSize.width + spacing;
        baseY = sourceElement.y + (sourceSize.height - newSize.height) / 2;
    }

    return findAvailablePosition(baseX, baseY, newSize, port);
  }, [getElementSize, findAvailablePosition]);

  /**
   * Get the opposite port for a given port
   */
  const getOppositePort = useCallback((port) => {
    switch (port) {
      case 'right': return 'left';
      case 'left': return 'right';
      case 'top': return 'bottom';
      case 'bottom': return 'top';
      default: return 'left';
    }
  }, []);

  /**
   * Create a new element connected to an existing element
   *
   * @param {Object} sourceElement - The source element to connect from
   * @param {string} port - The port on the source element ('top', 'right', 'bottom', 'left')
   * @param {Object} options - Additional options
   * @param {Object} options.stencil - Stencil to use for new element (uses default if not specified)
   * @param {string} options.label - Label for new element
   * @param {Object} options.connectionOptions - Options for the connection
   * @returns {Object} - { element, connection } or null if failed
   */
  const quickCreate = useCallback((sourceElement, port, options = {}) => {
    if (readOnly) return null;
    if (!sourceElement) return null;

    const {
      stencil,
      label = '',
      connectionOptions = {},
    } = options;

    // Get stencil to use
    const useStencil = stencil || getDefaultStencil(sourceElement.packId);
    if (!useStencil) return null;

    // Get size for new element
    const newSize = useStencil.defaultSize || { width: 120, height: 60 };

    // Calculate position
    const position = calculateNewElementPosition(sourceElement, port, newSize);

    // Create new element
    const newElement = addElement({
      type: useStencil.id,
      packId: useStencil.packId,
      x: position.x,
      y: position.y,
      size: newSize,
      label,
      color: useStencil.defaultColor,
    });

    if (!newElement) return null;

    // Create connection
    const targetPort = getOppositePort(port);
    const newConnection = addConnection({
      sourceId: sourceElement.id,
      targetId: newElement.id,
      sourcePort: port,
      targetPort: targetPort,
      lineStyle: connectionOptions.lineStyle || 'curved',
      ...connectionOptions,
    });

    // Select the new element
    selectElement?.(newElement.id);

    // Record history
    recordHistory?.();

    return {
      element: newElement,
      connection: newConnection,
    };
  }, [
    readOnly,
    getDefaultStencil,
    calculateNewElementPosition,
    getOppositePort,
    addElement,
    addConnection,
    selectElement,
    recordHistory,
  ]);

  /**
   * Quick-create with a specific stencil type
   */
  const quickCreateWithType = useCallback((sourceElement, port, stencilType, packId) => {
    const pack = packRegistry?.get?.(packId || sourceElement.packId);
    const stencil = pack?.stencils?.find(s => s.id === stencilType);

    if (!stencil) return null;

    return quickCreate(sourceElement, port, {
      stencil: { ...stencil, packId: packId || sourceElement.packId },
    });
  }, [packRegistry, quickCreate]);

  /**
   * Get available quick-create options for an element
   * Returns stencils that can be created from this element
   */
  const getQuickCreateOptions = useCallback((element) => {
    const pack = packRegistry?.get?.(element.packId);
    if (!pack?.stencils) return [];

    return pack.stencils
      .filter(s => !s.hideInQuickCreate)
      .map(s => ({
        id: s.id,
        label: s.name || s.id,
        packId: element.packId,
        icon: s.icon,
      }));
  }, [packRegistry]);

  return {
    quickCreate,
    quickCreateWithType,
    getQuickCreateOptions,
    calculateNewElementPosition,
    findAvailablePosition,
    getElementSize,
    getDefaultStencil,
  };
}

export default useQuickCreate;

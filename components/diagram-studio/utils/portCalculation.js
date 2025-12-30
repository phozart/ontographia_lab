// components/diagram-studio/utils/portCalculation.js
// Port position and optimal port calculation utilities

/**
 * Get the position of a port on an element
 */
export function getPortPosition(element, portId, packRegistry, ratio = 0.5) {
  const pack = packRegistry?.get?.(element.packId);
  const stencil = pack?.stencils?.find(s => s.id === element.type);
  const size = element.size || stencil?.defaultSize || { width: 120, height: 60 };

  const cx = element.x + size.width / 2;
  const cy = element.y + size.height / 2;
  const clampedRatio = Math.max(0, Math.min(1, ratio));

  switch (portId) {
    case 'top': return { x: element.x + size.width * clampedRatio, y: element.y };
    case 'bottom': return { x: element.x + size.width * clampedRatio, y: element.y + size.height };
    case 'left': return { x: element.x, y: element.y + size.height * clampedRatio };
    case 'right': return { x: element.x + size.width, y: element.y + size.height * clampedRatio };
    case 'center': return { x: cx, y: cy };
    default: return { x: cx, y: cy };
  }
}

/**
 * Calculate optimal ports based on relative positions of two elements
 * Returns { sourcePort, targetPort } - the best ports for connecting the elements
 */
export function getOptimalPorts(sourceElement, targetElement, packRegistry) {
  const sourceSize = sourceElement.size || { width: 120, height: 60 };
  const targetSize = targetElement.size || { width: 120, height: 60 };

  // Calculate element bounds
  const sourceLeft = sourceElement.x;
  const sourceRight = sourceElement.x + sourceSize.width;
  const sourceTop = sourceElement.y;
  const sourceBottom = sourceElement.y + sourceSize.height;

  const targetLeft = targetElement.x;
  const targetRight = targetElement.x + targetSize.width;
  const targetTop = targetElement.y;
  const targetBottom = targetElement.y + targetSize.height;

  // Calculate centers
  const sourceCx = sourceElement.x + sourceSize.width / 2;
  const sourceCy = sourceElement.y + sourceSize.height / 2;
  const targetCx = targetElement.x + targetSize.width / 2;
  const targetCy = targetElement.y + targetSize.height / 2;

  const dx = targetCx - sourceCx;
  const dy = targetCy - sourceCy;

  // Check for clear horizontal or vertical alignment
  const horizontalOverlap = !(sourceRight < targetLeft || targetRight < sourceLeft);
  const verticalOverlap = !(sourceBottom < targetTop || targetBottom < sourceTop);

  let sourcePort, targetPort;

  // Case 1: Elements are horizontally aligned (vertical overlap)
  if (verticalOverlap) {
    if (dx > 0) {
      sourcePort = 'right';
      targetPort = 'left';
    } else {
      sourcePort = 'left';
      targetPort = 'right';
    }
  }
  // Case 2: Elements are vertically aligned (horizontal overlap)
  else if (horizontalOverlap) {
    if (dy > 0) {
      sourcePort = 'bottom';
      targetPort = 'top';
    } else {
      sourcePort = 'top';
      targetPort = 'bottom';
    }
  }
  // Case 3: Diagonal - choose based on which direction is dominant and cleaner
  else {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx > absDy * 1.5) {
      // Horizontal is dominant - use left/right ports
      if (dx > 0) {
        sourcePort = 'right';
        targetPort = 'left';
      } else {
        sourcePort = 'left';
        targetPort = 'right';
      }
    } else if (absDy > absDx * 1.5) {
      // Vertical is dominant - use top/bottom ports
      if (dy > 0) {
        sourcePort = 'bottom';
        targetPort = 'top';
      } else {
        sourcePort = 'top';
        targetPort = 'bottom';
      }
    } else {
      // Roughly equal - choose based on creating the best step path
      if (dy < 0) {
        sourcePort = 'top';
        targetPort = 'bottom';
      } else {
        sourcePort = 'bottom';
        targetPort = 'top';
      }
    }
  }

  return { sourcePort, targetPort };
}

/**
 * Check if connection uses auto ports (should recalculate on element move)
 */
export function shouldAutoUpdatePorts(connection) {
  // If explicitly marked as manual, don't auto-update
  if (connection.manualPorts) return false;
  // If no ports specified or using 'auto', update automatically
  if (!connection.sourcePort || !connection.targetPort) return true;
  if (connection.sourcePort === 'auto' || connection.targetPort === 'auto') return true;
  // Default: auto-update unless manually set
  return !connection.manualPorts;
}

/**
 * Get the effective ports for a connection (calculates optimal if auto)
 */
export function getEffectivePorts(connection, sourceElement, targetElement, packRegistry) {
  if (shouldAutoUpdatePorts(connection)) {
    return getOptimalPorts(sourceElement, targetElement, packRegistry);
  }
  return {
    sourcePort: connection.sourcePort || 'bottom',
    targetPort: connection.targetPort || 'top',
  };
}

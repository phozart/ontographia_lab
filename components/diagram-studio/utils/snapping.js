// components/diagram-studio/utils/snapping.js
// Alignment snap guide calculation utilities

export const GUIDE_SNAP_THRESHOLD = 15;

/**
 * Calculate snap guides for alignment with other elements
 * Returns { guides: { horizontal: [], vertical: [] }, snapX, snapY }
 */
export function calculateSnapGuides(draggingEl, allElements, packRegistry, threshold = GUIDE_SNAP_THRESHOLD) {
  const guides = { horizontal: [], vertical: [] };
  let snapX = null;
  let snapY = null;

  // Get dragging element size
  const dragPack = packRegistry?.get?.(draggingEl.packId);
  const dragStencil = dragPack?.stencils?.find(s => s.id === draggingEl.type);
  const dragSize = draggingEl.size || dragStencil?.defaultSize || { width: 120, height: 60 };

  // Dragging element edges and center
  const dragLeft = draggingEl.x;
  const dragRight = draggingEl.x + dragSize.width;
  const dragCenterX = draggingEl.x + dragSize.width / 2;
  const dragTop = draggingEl.y;
  const dragBottom = draggingEl.y + dragSize.height;
  const dragCenterY = draggingEl.y + dragSize.height / 2;

  // Check against other elements
  allElements.forEach(el => {
    if (el.id === draggingEl.id) return;

    const pack = packRegistry?.get?.(el.packId);
    const stencil = pack?.stencils?.find(s => s.id === el.type);
    const size = el.size || stencil?.defaultSize || { width: 120, height: 60 };

    // Target element edges and center
    const targetLeft = el.x;
    const targetRight = el.x + size.width;
    const targetCenterX = el.x + size.width / 2;
    const targetTop = el.y;
    const targetBottom = el.y + size.height;
    const targetCenterY = el.y + size.height / 2;

    // Vertical guides (align X positions)
    // Left-to-left
    if (Math.abs(dragLeft - targetLeft) < threshold) {
      guides.vertical.push({ x: targetLeft, y1: Math.min(dragTop, targetTop), y2: Math.max(dragBottom, targetBottom), type: 'edge' });
      if (snapX === null) snapX = targetLeft - dragLeft;
    }
    // Right-to-right
    if (Math.abs(dragRight - targetRight) < threshold) {
      guides.vertical.push({ x: targetRight, y1: Math.min(dragTop, targetTop), y2: Math.max(dragBottom, targetBottom), type: 'edge' });
      if (snapX === null) snapX = targetRight - dragRight;
    }
    // Left-to-right
    if (Math.abs(dragLeft - targetRight) < threshold) {
      guides.vertical.push({ x: targetRight, y1: Math.min(dragTop, targetTop), y2: Math.max(dragBottom, targetBottom), type: 'edge' });
      if (snapX === null) snapX = targetRight - dragLeft;
    }
    // Right-to-left
    if (Math.abs(dragRight - targetLeft) < threshold) {
      guides.vertical.push({ x: targetLeft, y1: Math.min(dragTop, targetTop), y2: Math.max(dragBottom, targetBottom), type: 'edge' });
      if (snapX === null) snapX = targetLeft - dragRight;
    }
    // Center-to-center (X)
    if (Math.abs(dragCenterX - targetCenterX) < threshold) {
      guides.vertical.push({ x: targetCenterX, y1: Math.min(dragTop, targetTop), y2: Math.max(dragBottom, targetBottom), type: 'center' });
      if (snapX === null) snapX = targetCenterX - dragCenterX;
    }

    // Horizontal guides (align Y positions)
    // Top-to-top
    if (Math.abs(dragTop - targetTop) < threshold) {
      guides.horizontal.push({ y: targetTop, x1: Math.min(dragLeft, targetLeft), x2: Math.max(dragRight, targetRight), type: 'edge' });
      if (snapY === null) snapY = targetTop - dragTop;
    }
    // Bottom-to-bottom
    if (Math.abs(dragBottom - targetBottom) < threshold) {
      guides.horizontal.push({ y: targetBottom, x1: Math.min(dragLeft, targetLeft), x2: Math.max(dragRight, targetRight), type: 'edge' });
      if (snapY === null) snapY = targetBottom - dragBottom;
    }
    // Top-to-bottom
    if (Math.abs(dragTop - targetBottom) < threshold) {
      guides.horizontal.push({ y: targetBottom, x1: Math.min(dragLeft, targetLeft), x2: Math.max(dragRight, targetRight), type: 'edge' });
      if (snapY === null) snapY = targetBottom - dragTop;
    }
    // Bottom-to-top
    if (Math.abs(dragBottom - targetTop) < threshold) {
      guides.horizontal.push({ y: targetTop, x1: Math.min(dragLeft, targetLeft), x2: Math.max(dragRight, targetRight), type: 'edge' });
      if (snapY === null) snapY = targetTop - dragBottom;
    }
    // Center-to-center (Y)
    if (Math.abs(dragCenterY - targetCenterY) < threshold) {
      guides.horizontal.push({ y: targetCenterY, x1: Math.min(dragLeft, targetLeft), x2: Math.max(dragRight, targetRight), type: 'center' });
      if (snapY === null) snapY = targetCenterY - dragCenterY;
    }
  });

  return { guides, snapX, snapY };
}

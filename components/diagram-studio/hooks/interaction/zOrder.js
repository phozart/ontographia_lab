// components/diagram-studio/hooks/interaction/zOrder.js
// Pure helper for bring-to-front / send-to-back. Elements are rendered sorted by `zIndex`.

/**
 * @returns {number|null} the new zIndex for `elementId`, or null when no change is needed.
 */
export function getZIndexForOrder(elements, elementId, direction) {
  const target = elements.find(el => el.id === elementId);
  if (!target) return null;
  const others = elements.filter(el => el.id !== elementId).map(el => el.zIndex || 0);
  if (others.length === 0) return null;
  const current = target.zIndex || 0;
  if (direction === 'front') {
    const max = Math.max(...others);
    return current > max ? null : max + 1;
  }
  const min = Math.min(...others);
  return current < min ? null : min - 1;
}

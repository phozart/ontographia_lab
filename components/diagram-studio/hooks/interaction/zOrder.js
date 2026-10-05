// components/diagram-studio/hooks/interaction/zOrder.js
// Pure helper for bring-to-front / send-to-back. Elements are rendered sorted by `zIndex`.
// Children (elements geometrically inside a frame) always render above their frame.

const DEFAULT_SIZE = { width: 120, height: 60 };
const DEFAULT_FRAME_SIZE = { width: 600, height: 400 };

const isFrame = (el) => el.type === 'frame' || el.isFrame;

function sizeOf(el, getSize) {
  return el.size || getSize?.(el) || (isFrame(el) ? DEFAULT_FRAME_SIZE : DEFAULT_SIZE);
}

function isInside(inner, outer, getSize) {
  const is = sizeOf(inner, getSize);
  const os = sizeOf(outer, getSize);
  return inner.x >= outer.x && inner.y >= outer.y &&
    inner.x + is.width <= outer.x + os.width &&
    inner.y + is.height <= outer.y + os.height;
}

/**
 * @param {Array} elements
 * @param {string} elementId
 * @param {'front'|'back'} direction
 * @param {(el) => {width:number,height:number}|undefined} [getSize] optional size resolver (e.g. stencil defaults)
 * @returns {number|null} the new zIndex for `elementId`, or null when no change is needed.
 */
export function getZIndexForOrder(elements, elementId, direction, getSize) {
  const target = elements.find(el => el.id === elementId);
  if (!target) return null;
  const rest = elements.filter(el => el.id !== elementId);
  if (rest.length === 0) return null;
  const z = (el) => el.zIndex || 0;
  const current = z(target);

  if (direction === 'front') {
    let next = Math.max(...rest.map(z)) + 1;
    if (isFrame(target)) {
      const children = rest.filter(el => !isFrame(el) && isInside(el, target, getSize));
      if (children.length > 0) next = Math.min(next, Math.min(...children.map(z)) - 1);
    }
    return next > current ? next : null;
  }

  let next = Math.min(...rest.map(z)) - 1;
  if (!isFrame(target)) {
    const frames = rest.filter(el => isFrame(el) && isInside(target, el, getSize));
    if (frames.length > 0) next = Math.max(next, Math.max(...frames.map(z)) + 1);
  }
  return next < current ? next : null;
}

/**
 * Render-order comparator: ascending zIndex; at equal z, frames (background containers) first.
 * Array.prototype.sort is stable, so other ties keep creation order.
 */
export function compareByZOrder(a, b) {
  const dz = (a.zIndex || 0) - (b.zIndex || 0);
  if (dz !== 0) return dz;
  return (isFrame(b) ? 1 : 0) - (isFrame(a) ? 1 : 0);
}

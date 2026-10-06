// components/diagram-studio/utils/frameMembership.js
// Explicit frame membership. An element belongs to a frame only when its
// `parentFrameId` says so; membership is never recomputed from geometry on a
// frame drag. It changes only when:
//   - a shape is created inside a frame, or inserted as part of a template
//   - the user drops a shape inside a frame (adopt) or drags it out (release)
//   - a legacy diagram is loaded once (deriveLegacyFrameMembership)

const DEFAULT_ELEMENT_SIZE = { width: 120, height: 60 };
const DEFAULT_FRAME_SIZE = { width: 600, height: 400 };

export const isFrame = (el) => !!el && (el.type === 'frame' || el.isFrame === true);

const sizeOf = (el) => el.size || (isFrame(el) ? DEFAULT_FRAME_SIZE : DEFAULT_ELEMENT_SIZE);

/** Elements that explicitly belong to the frame. */
export function getFrameMembers(frameId, elements) {
  if (!frameId || !Array.isArray(elements)) return [];
  return elements.filter((el) => el.id !== frameId && el.parentFrameId === frameId);
}

/** Members of a frame including nested frames and, recursively, their members. */
export function getFrameDescendants(frameId, elements) {
  const out = [];
  const seen = new Set([frameId]);
  const queue = [frameId];
  while (queue.length) {
    const id = queue.shift();
    getFrameMembers(id, elements).forEach((el) => {
      if (seen.has(el.id)) return;
      seen.add(el.id);
      out.push(el);
      if (isFrame(el)) queue.push(el.id);
    });
  }
  return out;
}

/**
 * The frame (id) whose bounds contain the element's centre, or null.
 * Later frames in the list win (they render on top).
 */
export function findFrameForElement(el, frames) {
  if (!el || isFrame(el)) return null;
  const { width, height } = sizeOf(el);
  const cx = el.x + width / 2;
  const cy = el.y + height / 2;
  let found = null;
  for (const f of frames || []) {
    const fs = sizeOf(f);
    if (cx >= f.x && cx <= f.x + fs.width && cy >= f.y && cy <= f.y + fs.height) found = f.id;
  }
  return found;
}

/**
 * Given the final positions of the elements moved by one drag gesture
 * (`finals`: id -> {x, y}), return { id: newParentFrameId | null } for the
 * elements whose membership changes. Members that travel with their own frame
 * keep their membership; frames themselves never get a parent.
 */
export function computeFrameMembershipChanges(elements, finals) {
  const changes = {};
  if (!Array.isArray(elements) || !finals) return changes;
  const orig = Object.fromEntries(elements.map((el) => [el.id, el]));
  const placed = elements.map((el) => (finals[el.id] ? { ...el, x: finals[el.id].x, y: finals[el.id].y } : el));
  const frames = placed.filter(isFrame);
  placed.forEach((el) => {
    if (!finals[el.id] || isFrame(el)) return;
    if (finals[el.id].x === orig[el.id].x && finals[el.id].y === orig[el.id].y) return; // not actually moved
    if (el.parentFrameId && finals[el.parentFrameId]) return; // moved with its frame
    const next = findFrameForElement(el, frames);
    if ((el.parentFrameId || null) !== next) changes[el.id] = next;
  });
  return changes;
}

/**
 * Creation-time membership. Frames are marked as explicit-membership; a shape
 * without a `parentFrameId` key created inside a frame joins that frame. An
 * explicit key (even null) is respected, which is how templates opt out.
 */
export function assignFrameOnCreate(element, existingElements) {
  if (!element) return element;
  if (isFrame(element)) {
    return element.membershipExplicit ? element : { ...element, membershipExplicit: true };
  }
  if ('parentFrameId' in element) return element;
  if (typeof element.x !== 'number' || typeof element.y !== 'number') return element;
  const frameId = findFrameForElement(element, (existingElements || []).filter(isFrame));
  return frameId ? { ...element, parentFrameId: frameId } : element;
}

/**
 * One-time migration for diagrams saved before membership was explicit: every
 * frame lacking `membershipExplicit` adopts the parentless shapes fully inside
 * its bounds (the old on-the-fly behavior), then is flagged so it is never
 * derived again. Returns the same reference when nothing changes.
 */
export function deriveLegacyFrameMembership(elements) {
  if (!Array.isArray(elements)) return elements;
  const legacy = elements.filter((el) => isFrame(el) && !el.membershipExplicit);
  if (legacy.length === 0) return elements;
  const adopt = new Map();
  legacy.forEach((f) => {
    const fs = sizeOf(f);
    elements.forEach((el) => {
      if (el.id === f.id || isFrame(el) || el.parentFrameId || adopt.has(el.id)) return;
      const s = sizeOf(el);
      if (el.x >= f.x && el.y >= f.y && el.x + s.width <= f.x + fs.width && el.y + s.height <= f.y + fs.height) {
        adopt.set(el.id, f.id);
      }
    });
  });
  const legacyIds = new Set(legacy.map((f) => f.id));
  return elements.map((el) => {
    if (legacyIds.has(el.id)) return { ...el, membershipExplicit: true };
    if (adopt.has(el.id)) return { ...el, parentFrameId: adopt.get(el.id) };
    return el;
  });
}

/**
 * Parent frame for a duplicated element. If its frame was duplicated too, the copy
 * joins the copied frame; otherwise it keeps the original frame only when the copy
 * lands fully inside it, else it is released (null).
 */
export function remapDuplicateParent(original, copy, idMapping, elements) {
  const parentId = original.parentFrameId;
  if (!parentId) return parentId === undefined ? undefined : null;
  if (idMapping[parentId]) return idMapping[parentId];
  const frame = (elements || []).find((e) => e.id === parentId);
  if (!frame) return null;
  const fs = sizeOf(frame);
  const s = sizeOf(copy);
  const inside = copy.x >= frame.x && copy.y >= frame.y &&
    copy.x + s.width <= frame.x + fs.width && copy.y + s.height <= frame.y + fs.height;
  return inside ? parentId : null;
}

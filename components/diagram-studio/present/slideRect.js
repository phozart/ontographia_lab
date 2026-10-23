// components/diagram-studio/present/slideRect.js
// The world rectangle covering a set of slide frames (what culling must keep mounted while slides are cloned from the live canvas).
import { rectOfFrame } from '../canvasCulling';

/** @param {Array<{x?: number, y?: number, size?: {width?: number, height?: number}}>} frames @returns {{x,y,width,height}|null} */
export function unionFrameRect(frames) {
  const list = (frames || []).filter(Boolean).map(rectOfFrame);
  if (!list.length) return null;
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  for (const r of list) { x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y); x1 = Math.max(x1, r.x + r.width); y1 = Math.max(y1, r.y + r.height); }
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
}

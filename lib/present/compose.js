// lib/present/compose.js
// Composition blocks (ADR-0007 D3b, section 5.2 fit rule). A `copy` block places a SNAPSHOT of board content into a slide
// slot: the elements are cloned (new ids), scaled uniformly (positions, sizes, font sizes, stroke widths, table scale),
// centred in the slot, never upscaled above 1.5x, and refused below 0.35x (unreadable). Each clone records where it came
// from: origin.copiedFrom = {elementId, revision}. The originals are never touched. Pure and deterministic.

import { MAX_COPY_ELEMENTS } from '../diagramLimits';

export const MIN_SCALE = 0.35;
export const MAX_SCALE = 1.5;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clip = (s) => String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 60);
const bad = (error) => ({ ok: false, error });

const sizeOf = (el) => ({ width: num(el.size?.width, num(el.width, 120)), height: num(el.size?.height, num(el.height, 80)) });

/** @returns {{ok: true, scale: number} | {ok: false, error: string}} */
export function fitScale(box, slot) {
  const raw = Math.min(slot.w / Math.max(1, box.width), slot.h / Math.max(1, box.height));
  if (raw < MIN_SCALE) {
    return bad(`The content (${Math.round(box.width)} x ${Math.round(box.height)}) would have to shrink to ${Math.round(raw * 100)}% to fit the slot "${slot.name}", which is unreadable (minimum ${Math.round(MIN_SCALE * 100)}%). Put the whole frame on its own slide with slide_add {frameId} instead, or copy fewer elements.`);
  }
  return { ok: true, scale: Math.min(MAX_SCALE, raw) };
}

const SCALED_KEYS = ['fontSize', 'borderWidth', 'strokeWidth'];

function cloneElement(el, id, parentId, transform, provenance) {
  const out = { ...el, id, parentFrameId: parentId };
  delete out.groupId;
  delete out.locked;
  const sz = sizeOf(el);
  out.x = transform.x(num(el.x, 0));
  out.y = transform.y(num(el.y, 0));
  out.size = { ...(isObj(el.size) ? el.size : {}), width: sz.width * transform.s, height: sz.height * transform.s };
  for (const k of SCALED_KEYS) if (typeof el[k] === 'number') out[k] = el[k] * transform.s;
  if (isObj(el.data) && isObj(el.data.table)) {
    out.data = { ...el.data, table: { ...el.data.table, scale: num(el.data.table.scale, 1) * transform.s } };
  }
  out.origin = provenance;
  return out;
}

/**
 * @param {{elements?: object[], connections?: object[]}} content the board
 * @param {{elementIds?: string[], frameId?: string}} spec exactly one of
 * @param {{name: string, x: number, y: number, w: number, h: number}} slot
 * @param {{newId: (prefix: string) => string, revision: number, parentId: string}} deps
 * @returns {{ok: true, elements: object[], connections: object[], scale: number} | {ok: false, error: string}}
 */
export function copyIntoSlot(content, spec, slot, { newId, revision, parentId }) {
  const all = Array.isArray(content?.elements) ? content.elements.filter(isObj) : [];
  const byId = new Map(all.map((e) => [e.id, e]));
  if (!isObj(spec) || (spec.elementIds === undefined) === (spec.frameId === undefined)) return bad('A copy block needs exactly one of elementIds or frameId');
  let sources;
  let frame = null;
  if (spec.frameId !== undefined) {
    frame = byId.get(spec.frameId);
    if (!frame) return bad(`Frame "${clip(spec.frameId)}" does not exist on the board`);
    if (!(frame.type === 'frame' || frame.isFrame === true)) return bad(`Element "${clip(spec.frameId)}" is not a frame (use elementIds for single elements)`);
    const inside = new Set([frame.id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const e of all) if (!inside.has(e.id) && e.parentFrameId && inside.has(e.parentFrameId)) { inside.add(e.id); grew = true; }
    }
    sources = all.filter((e) => inside.has(e.id) && e.id !== frame.id && !(e.type === 'frame' || e.isFrame === true));
    if (sources.length === 0) return bad(`Frame "${clip(spec.frameId)}" has no content to copy`);
  } else {
    if (!Array.isArray(spec.elementIds) || spec.elementIds.length === 0) return bad('elementIds must be a non-empty array');
    sources = [];
    for (const id of spec.elementIds) {
      const e = byId.get(id);
      if (!e) return bad(`Element "${clip(id)}" does not exist on the board`);
      if (!sources.includes(e)) sources.push(e);
    }
  }
  if (sources.length > MAX_COPY_ELEMENTS) return bad(`A copy block takes at most ${MAX_COPY_ELEMENTS} elements (got ${sources.length}); copy the frame to its own slide or split the content`);

  // bounding box: the frame itself when copying a frame, else the union of the sources
  let x1 = Infinity; let y1 = Infinity; let x2 = -Infinity; let y2 = -Infinity;
  const boxes = frame ? [frame] : sources;
  for (const e of boxes) {
    const sz = sizeOf(e);
    x1 = Math.min(x1, num(e.x, 0)); y1 = Math.min(y1, num(e.y, 0));
    x2 = Math.max(x2, num(e.x, 0) + sz.width); y2 = Math.max(y2, num(e.y, 0) + sz.height);
  }
  const box = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
  const fit = fitScale(box, slot);
  if (!fit.ok) return fit;
  const s = fit.scale;
  const offX = slot.x + (slot.w - box.width * s) / 2;
  const offY = slot.y + (slot.h - box.height * s) / 2;
  const transform = { s, x: (x) => offX + (x - box.x) * s, y: (y) => offY + (y - box.y) * s };

  const idMap = new Map();
  const elements = sources.map((e) => {
    const id = newId('el');
    idMap.set(e.id, id);
    return cloneElement(e, id, parentId, transform, { copiedFrom: { elementId: e.id, revision }, slot: slot.name });
  });
  const connections = [];
  for (const c of Array.isArray(content?.connections) ? content.connections : []) {
    if (!isObj(c) || !idMap.has(c.sourceId) || !idMap.has(c.targetId)) continue;
    const out = { ...c, id: newId('conn'), sourceId: idMap.get(c.sourceId), targetId: idMap.get(c.targetId) };
    if (Array.isArray(c.waypoints)) out.waypoints = c.waypoints.filter(isObj).map((p) => ({ ...p, x: transform.x(num(p.x, 0)), y: transform.y(num(p.y, 0)) }));
    if (typeof c.strokeWidth === 'number') out.strokeWidth = c.strokeWidth * s;
    connections.push(out);
  }
  return { ok: true, elements, connections, scale: s };
}

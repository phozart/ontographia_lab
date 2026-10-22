// lib/present/slideBuild.js
// Editor-side layout application (ADR-0007 P2): "Add slide with a layout" and "Apply layout to this slide". Pure planning:
// the editor applies the returned updates, creates and removes through its own context callbacks.
//
// A slot filled by an earlier layout is recognised by origin.slot on a child of the frame. Applying a layout:
//   - moves what sits on a slot the new layout also has (geometry only; the person's preset and text stay);
//   - moves content from slots the new layout does not have into the slots that are still empty, in reading order, so
//     "two columns" -> "three columns" keeps both columns;
//   - adds placeholders only for slots that are still empty (visual slots get none);
//   - redraws the decor (accent bar / cover strip) for the new layout.
// Locked elements are skipped; elements without origin.slot (the person's own) are never touched.

import { layoutSlots, layoutDecor, layoutBackground, SLOT_NAMES } from './layouts';
import { newPresetTextElement, plainLabelOf } from './textPreset';

export const PLACEHOLDERS = Object.freeze({
  title: 'Slide title', subtitle: 'Subtitle', body: 'Body text', left: 'Left column', right: 'Right column', c1: 'First column', c2: 'Second column', c3: 'Third column',
  caption: 'Caption', number: '42%', label: 'What the number means', full: 'Text',
});

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const V = { top: 'top', middle: 'middle', bottom: 'bottom' };

/** A decor shape (accent bar or strip): a label-less, shadow-less rectangle in @accent; origin.slot "decor" marks it as the tool's. */
export const decorElement = (id, frameId, d) => ({
  id, type: 'rectangle', packId: 'core', name: 'Accent', label: '', showLabel: false, layerId: 'default', parentFrameId: frameId,
  x: d.x, y: d.y, size: { width: d.w, height: d.h },
  backgroundColor: '@accent', borderColor: '@accent', borderWidth: 0, borderRadius: d.radius, showShadow: false, properties: {},
  origin: { slot: 'decor' },
});

export { layoutBackground };

/**
 * @param {{frame: object, elements: object[], layout: string, title?: string, idGen: (prefix: string) => string}} p
 * @returns {{ok: true, updates: Array<{id: string, patch: object}>, creates: object[], removes: string[], background: string}
 *          | {ok: false, error: string}}
 */
export function planLayout({ frame, elements, layout, title, idGen }) {
  const size = { width: frame.size?.width || 1920, height: frame.size?.height || 1080 };
  const at = { x: frame.x || 0, y: frame.y || 0 };
  const lay = layoutSlots(layout, size, at);
  if (lay.ok === false) return lay;
  const placed = (Array.isArray(elements) ? elements : []).filter((e) => isObj(e) && e.parentFrameId === frame.id && isObj(e.origin) && typeof e.origin.slot === 'string');
  const taken = new Map();
  for (const e of placed) if (e.origin.slot !== 'decor' && !taken.has(e.origin.slot)) taken.set(e.origin.slot, e);
  const slotNames = new Set(lay.slots.map((s) => s.name));

  const assign = new Map();
  for (const slot of lay.slots) if (taken.has(slot.name)) assign.set(slot.name, taken.get(slot.name));
  const orphans = [...taken.entries()].filter(([name, e]) => !slotNames.has(name) && e.locked !== true).map(([, e]) => e).sort((a, b) => ((a.y || 0) - (b.y || 0)) || ((a.x || 0) - (b.x || 0)));
  for (const slot of lay.slots) {
    if (slot.name === 'title' || assign.has(slot.name) || orphans.length === 0) continue;
    assign.set(slot.name, orphans.shift());
  }

  const updates = [];
  const creates = [];
  for (const slot of lay.slots) {
    const el = assign.get(slot.name);
    if (el) {
      if (el.locked === true) continue;
      const patch = { x: slot.x, y: slot.y, size: { width: slot.w, height: Math.max(slot.h, el.size?.height || 0) } };
      if (el.origin.slot !== slot.name) patch.origin = { ...el.origin, slot: slot.name };
      updates.push({ id: el.id, patch });
      continue;
    }
    if (slot.kind === 'visual') continue;
    const markdown = slot.name === 'title' ? (title || plainLabelOf(frame.label || '') || PLACEHOLDERS.title) : PLACEHOLDERS[slot.name] || 'Text';
    const el2 = newPresetTextElement({ id: idGen('el'), x: slot.x, y: slot.y, preset: slot.preset || 'body', markdown, width: slot.w, height: slot.h, frameHeight: size.height, extra: { verticalAlign: V[slot.vAlign] || 'top' } });
    creates.push({ ...el2, parentFrameId: frame.id, origin: { slot: slot.name } });
  }
  const removes = placed.filter((e) => e.origin.slot === 'decor' && e.locked !== true).map((e) => e.id);
  for (const d of layoutDecor(layout, size, at)) creates.push(decorElement(idGen('el'), frame.id, d));
  return { ok: true, updates, creates, removes, background: layoutBackground(layout) };
}

export { SLOT_NAMES };

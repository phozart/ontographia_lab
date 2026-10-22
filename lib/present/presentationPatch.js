// lib/present/presentationPatch.js
// The `presentation_patch` op (ADR-0007 section 9): one pure function that creates a deck or edits one. The editor
// panel, the MCP deck tools (through applyOps) and the tests all use it, so every path enforces the same rules.
//
//   { id?: presentationId, create?: {title?, aspect?}, title?, aspect?,
//     insertSlides?: [{frameId, position?, notes?, hidden?}], removeSlideIds?: [slideId],
//     updateSlides?: [{slideId, notes?, hidden?}], order?: [slideId], removeDeck?: true }
//
// Order of work: create, title/aspect, remove, insert, update, order (the final order must list exactly the slides left).
// Writes are strict about frames (a new slide must reference an existing frame); content that already has dangling
// slides stays valid (those are "missing" slides). Inputs are never mutated.

import { MAX_PRESENTATIONS, MAX_SLIDES } from '../diagramLimits';
import { ASPECTS, DEFAULT_ASPECT, DEFAULT_TITLE, cleanPresentationTitle, cleanNotes } from './presentationSchema';
import { isFrameElement } from './presentationModel';

export const PATCH_KEYS = ['id', 'create', 'title', 'aspect', 'insertSlides', 'removeSlideIds', 'updateSlides', 'order', 'removeDeck'];
const MAX_INSERT = 40; // per call (ADR section 9 caps: 40 slides per call)

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const clip = (s, n = 60) => (typeof s === 'string' ? s.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, n) : String(s).slice(0, n));

/**
 * @param {object[]} presentations current content.presentations (may be undefined)
 * @param {object[]} elements current content.elements (frames are looked up here)
 * @param {object} patch
 * @param {{newId: (prefix: string) => string}} deps
 * @returns {{ok: true, presentations: object[], presentationId: string|null, slideIds: string[], removed: boolean}
 *          | {ok: false, errors: string[]}}
 */
export function applyPresentationPatch(presentations, elements, patch, { newId }) {
  const errors = [];
  const fail = (m) => { errors.push(m); return { ok: false, errors }; };
  if (!isObj(patch)) return fail('presentation_patch must be an object');
  for (const k of Object.keys(patch)) if (k !== 'op' && !PATCH_KEYS.includes(k)) return fail(`Unknown field "${clip(k, 40)}" for presentation_patch; allowed: ${PATCH_KEYS.join(', ')}`);

  const list = Array.isArray(presentations) ? presentations.map((p) => ({ ...p, slides: [...(p.slides || [])] })) : [];
  const frames = new Map((Array.isArray(elements) ? elements : []).filter(isObj).map((e) => [e.id, e]));
  let deck;
  if (patch.create !== undefined) {
    if (patch.id !== undefined) return fail('give either create or id, not both');
    if (!isObj(patch.create)) return fail('create must be an object {title?, aspect?}');
    if (list.length >= MAX_PRESENTATIONS) return fail(`A board holds at most ${MAX_PRESENTATIONS} presentations`);
    const aspect = patch.create.aspect ?? DEFAULT_ASPECT;
    if (!ASPECTS.includes(aspect)) return fail(`aspect must be one of ${ASPECTS.join(', ')}`);
    deck = { id: newId('pres'), title: cleanPresentationTitle(patch.create.title ?? DEFAULT_TITLE) || DEFAULT_TITLE, aspect, slides: [] };
    list.push(deck);
  } else {
    if (typeof patch.id !== 'string' || !patch.id) return fail('presentation_patch needs a presentation id, or create');
    deck = list.find((p) => p.id === patch.id);
    if (!deck) return fail(`Presentation "${clip(patch.id)}" does not exist`);
  }

  if (patch.removeDeck === true) {
    const rest = Object.keys(patch).filter((k) => !['op', 'id', 'removeDeck'].includes(k));
    if (rest.length) return fail('removeDeck cannot be combined with other fields');
    return { ok: true, presentations: list.filter((p) => p !== deck), presentationId: deck.id, slideIds: [], removed: true };
  }

  if (patch.title !== undefined) {
    if (typeof patch.title !== 'string') return fail('title must be a string');
    deck.title = cleanPresentationTitle(patch.title) || DEFAULT_TITLE;
  }
  if (patch.aspect !== undefined) {
    if (!ASPECTS.includes(patch.aspect)) return fail(`aspect must be one of ${ASPECTS.join(', ')}`);
    deck.aspect = patch.aspect;
  }

  if (patch.removeSlideIds !== undefined) {
    if (!Array.isArray(patch.removeSlideIds)) return fail('removeSlideIds must be an array of slide ids');
    const have = new Set(deck.slides.map((s) => s.id));
    for (const id of patch.removeSlideIds) if (!have.has(id)) return fail(`Slide "${clip(id)}" is not in this presentation`);
    const drop = new Set(patch.removeSlideIds);
    deck.slides = deck.slides.filter((s) => !drop.has(s.id));
  }

  const created = [];
  if (patch.insertSlides !== undefined) {
    if (!Array.isArray(patch.insertSlides) || patch.insertSlides.length === 0) return fail('insertSlides must be a non-empty array');
    if (patch.insertSlides.length > MAX_INSERT) return fail(`Too many slides in one call (${patch.insertSlides.length}); the limit is ${MAX_INSERT}`);
    if (deck.slides.length + patch.insertSlides.length > MAX_SLIDES) return fail(`A presentation holds at most ${MAX_SLIDES} slides`);
    let at = null;
    for (const spec of patch.insertSlides) {
      if (!isObj(spec) || typeof spec.frameId !== 'string') return fail('Each inserted slide needs a frameId');
      const frame = frames.get(spec.frameId);
      if (!frame) return fail(`Frame "${clip(spec.frameId)}" does not exist on the board`);
      if (!isFrameElement(frame)) return fail(`Element "${clip(spec.frameId)}" is not a frame; only frames can be slides`);
      const slide = { id: newId('slide'), frameId: spec.frameId };
      if (spec.notes !== undefined) {
        if (typeof spec.notes !== 'string') return fail('notes must be a string');
        const notes = cleanNotes(spec.notes);
        if (notes) slide.notes = notes;
      }
      if (spec.hidden === true) slide.hidden = true;
      let pos = spec.position;
      if (pos !== undefined && (!Number.isInteger(pos) || pos < 0)) return fail('position must be a whole number, 0 or more');
      if (pos === undefined) pos = at === null ? deck.slides.length : at;
      pos = Math.min(pos, deck.slides.length);
      deck.slides.splice(pos, 0, slide);
      at = pos + 1;
      created.push(slide.id);
    }
  }

  if (patch.updateSlides !== undefined) {
    if (!Array.isArray(patch.updateSlides) || patch.updateSlides.length === 0) return fail('updateSlides must be a non-empty array');
    deck.slides = deck.slides.map((s) => s);
    for (const u of patch.updateSlides) {
      if (!isObj(u) || typeof u.slideId !== 'string') return fail('Each slide update needs a slideId');
      for (const k of Object.keys(u)) if (!['slideId', 'notes', 'hidden'].includes(k)) return fail(`Unknown field "${clip(k, 40)}" in a slide update; allowed: slideId, notes, hidden`);
      const i = deck.slides.findIndex((s) => s.id === u.slideId);
      if (i < 0) return fail(`Slide "${clip(u.slideId)}" is not in this presentation`);
      const next = { ...deck.slides[i] };
      if (u.notes !== undefined) {
        if (typeof u.notes !== 'string') return fail('notes must be a string');
        const notes = cleanNotes(u.notes);
        if (notes) next.notes = notes; else delete next.notes;
      }
      if (u.hidden !== undefined) {
        if (typeof u.hidden !== 'boolean') return fail('hidden must be true or false');
        if (u.hidden) next.hidden = true; else delete next.hidden;
      }
      deck.slides[i] = next;
    }
  }

  if (patch.order !== undefined) {
    if (!Array.isArray(patch.order)) return fail('order must be an array of slide ids');
    const ids = deck.slides.map((s) => s.id);
    const given = new Set(patch.order);
    if (given.size !== patch.order.length) return fail('order lists a slide more than once');
    if (patch.order.length !== ids.length || ids.some((id) => !given.has(id))) {
      return fail(`order must list every slide of the presentation exactly once (${ids.length} slides)`);
    }
    const by = new Map(deck.slides.map((s) => [s.id, s]));
    deck.slides = patch.order.map((id) => by.get(id));
  }

  return { ok: true, presentations: list, presentationId: deck.id, slideIds: created, removed: false };
}

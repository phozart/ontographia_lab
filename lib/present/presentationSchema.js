// lib/present/presentationSchema.js
// Closed schema, normalization and validation of content.presentations (ADR-0007 section 5.1). Pure.
//
//   presentation = { id, title, aspect: '16:9'|'4:3'|'1:1', slides: [{ id, frameId, notes?, hidden? }] }
//
// Unknown keys are rejected (the editor, the MCP tools and import all write through this). A slide whose frame no
// longer exists is NOT an error: it is a "missing" slide (an autosave must never fail because a frame was deleted).
// Notes are plain text: control and bidi characters are stripped, the cap is MAX_NOTES_BYTES.

import { MAX_PRESENTATIONS, MAX_SLIDES, MAX_NOTES_BYTES, MAX_PRESENTATION_TITLE } from '../diagramLimits';

export const ASPECTS = Object.freeze(['16:9', '4:3', '1:1']);
export const FRAME_ASPECTS = Object.freeze([...ASPECTS, 'free']);
export const DEFAULT_ASPECT = '16:9';
export const MAX_ID_LENGTH = 128;
export const DEFAULT_TITLE = 'Presentation';
const PRESENTATION_KEYS = new Set(['id', 'title', 'aspect', 'slides']);
const SLIDE_KEYS = new Set(['id', 'frameId', 'notes', 'hidden']);

// Notes keep tab and newline; C1 controls, line/paragraph separators and bidi overrides go too.
const NOTES_STRIP_RE = new RegExp('[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
const TITLE_STRIP_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]', 'g');
const HAS_CONTROL_RE = new RegExp('[\\u0000-\\u001f\\u007f-\\u009f\\u2028\\u2029\\u202a-\\u202e\\u2066-\\u2069\\ufeff]');

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const err = (error, status = 400, code = 'VALIDATION_FAILED') => ({ ok: false, status, code, error });
const clip = (s) => String(s).replace(TITLE_STRIP_RE, ' ').slice(0, 40);

export const cleanPresentationTitle = (t) => String(t ?? '').replace(TITLE_STRIP_RE, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_PRESENTATION_TITLE);
export const cleanNotes = (t) => String(t ?? '').replace(NOTES_STRIP_RE, '');

const validId = (v) => typeof v === 'string' && v.length >= 1 && v.length <= MAX_ID_LENGTH && !HAS_CONTROL_RE.test(v);

/**
 * @param {unknown} list content.presentations
 * @returns {{ok: true, presentations: object[]|undefined, warnings: string[]} | {ok: false, status: number, code: string, error: string}}
 */
export function validatePresentations(list) {
  if (list === undefined) return { ok: true, presentations: undefined, warnings: [] };
  if (!Array.isArray(list)) return err('content.presentations must be an array');
  if (list.length > MAX_PRESENTATIONS) return err(`content.presentations has too many items (${list.length}); the limit is ${MAX_PRESENTATIONS}`);
  const seen = new Set();
  const out = [];
  for (let i = 0; i < list.length; i += 1) {
    const p = list[i];
    const at = `content.presentations[${i}]`;
    if (!isObj(p)) return err(`${at} must be an object`);
    for (const k of Object.keys(p)) if (!PRESENTATION_KEYS.has(k)) return err(`${at} has an unsupported key "${clip(k)}"; allowed: ${[...PRESENTATION_KEYS].join(', ')}`);
    if (!validId(p.id)) return err(`${at}.id must be a string of 1 to ${MAX_ID_LENGTH} characters`);
    if (seen.has(p.id)) return err(`content.presentations has more than one item with the id "${clip(p.id)}"; ids must be unique`);
    seen.add(p.id);
    if (p.title !== undefined && typeof p.title !== 'string') return err(`${at}.title must be a string`);
    if (p.aspect !== undefined && !ASPECTS.includes(p.aspect)) return err(`${at}.aspect must be one of ${ASPECTS.join(', ')}`);
    if (!Array.isArray(p.slides)) return err(`${at}.slides must be an array`);
    if (p.slides.length > MAX_SLIDES) return err(`${at}.slides has too many slides (${p.slides.length}); the limit is ${MAX_SLIDES}`);
    const slideIds = new Set();
    const slides = [];
    for (let j = 0; j < p.slides.length; j += 1) {
      const s = p.slides[j];
      const sat = `${at}.slides[${j}]`;
      if (!isObj(s)) return err(`${sat} must be an object`);
      for (const k of Object.keys(s)) if (!SLIDE_KEYS.has(k)) return err(`${sat} has an unsupported key "${clip(k)}"; allowed: ${[...SLIDE_KEYS].join(', ')}`);
      if (!validId(s.id)) return err(`${sat}.id must be a string of 1 to ${MAX_ID_LENGTH} characters`);
      if (slideIds.has(s.id)) return err(`${at} has more than one slide with the id "${clip(s.id)}"; ids must be unique`);
      slideIds.add(s.id);
      if (!validId(s.frameId)) return err(`${sat}.frameId must be a string of 1 to ${MAX_ID_LENGTH} characters (the id of a frame)`);
      if (s.hidden !== undefined && typeof s.hidden !== 'boolean') return err(`${sat}.hidden must be true or false`);
      const slide = { id: s.id, frameId: s.frameId };
      if (s.notes !== undefined) {
        if (typeof s.notes !== 'string') return err(`${sat}.notes must be a string`);
        const bytes = Buffer.byteLength(s.notes, 'utf8');
        if (bytes > MAX_NOTES_BYTES) return err(`${sat}.notes is too large (${bytes} bytes); the limit is ${MAX_NOTES_BYTES} bytes`, 413, 'PAYLOAD_TOO_LARGE');
        const notes = cleanNotes(s.notes);
        if (notes) slide.notes = notes;
      }
      if (s.hidden === true) slide.hidden = true;
      slides.push(slide);
    }
    out.push({ id: p.id, title: cleanPresentationTitle(p.title ?? DEFAULT_TITLE) || DEFAULT_TITLE, aspect: p.aspect || DEFAULT_ASPECT, slides });
  }
  return { ok: true, presentations: out, warnings: [] };
}

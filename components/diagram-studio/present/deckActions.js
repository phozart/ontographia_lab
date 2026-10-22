// components/diagram-studio/present/deckActions.js
// Editor-side deck operations built on the same pure presentation_patch the MCP tools use (lib/present). They take
// the context callbacks as arguments so they are testable without React.

import { SLIDE_SIZES, nextSlidePosition, frameSize, coverSize } from '../../../lib/present/presentationModel';
import { DEFAULT_ASPECT } from '../../../lib/present/presentationSchema';
import { planLayout, layoutBackground } from '../../../lib/present/slideBuild';
import { newPresetTextElement, PRESET_SPECS } from '../../../lib/present/textPreset';
import { MARGIN } from '../../../lib/present/layouts';
import { generateId } from '../utils/ids';

/** The deck "Add to presentation" targets: the active one if it still exists, else the first, else none. */
export function pickDeck(presentations, activeId) {
  const list = Array.isArray(presentations) ? presentations : [];
  return list.find((p) => p.id === activeId) || list[0] || null;
}

/**
 * Add existing frames as slides. With no deck yet, a first "Presentation 1" is created (Q-P1).
 * @returns {{ok: true, presentationId: string, slideIds: string[]} | {ok: false, errors: string[]}}
 */
export function addFramesToDeck({ patchPresentation, presentations, activeId, frameIds }) {
  let deck = pickDeck(presentations, activeId);
  let presentationId = deck?.id;
  if (!deck) {
    const made = patchPresentation({ create: { title: 'Presentation 1' } });
    if (!made.ok) return made;
    presentationId = made.presentationId;
  }
  return patchPresentation({ id: presentationId, insertSlides: frameIds.map((frameId) => ({ frameId })) });
}

/**
 * "Add slide": a new 16:9 frame placed right of the deck's last slide, then added to the deck.
 * `elements` is the live element list (so the position sees the current board).
 */
export function addNewSlide({ patchPresentation, addElement, presentations, activeId, elements, layout }) {
  let deck = pickDeck(presentations, activeId);
  let presentationId = deck?.id;
  if (!deck) {
    const made = patchPresentation({ create: { title: 'Presentation 1' } });
    if (!made.ok) return made;
    presentationId = made.presentationId;
    deck = { id: presentationId, aspect: DEFAULT_ASPECT, slides: [] };
  }
  const aspect = deck.aspect || DEFAULT_ASPECT;
  const pos = nextSlidePosition({ elements }, deck);
  const count = (deck.slides || []).length;
  const frame = addElement({
    type: 'frame',
    packId: 'core',
    label: `Slide ${count + 1}`,
    x: pos.x,
    y: pos.y,
    size: { ...SLIDE_SIZES[aspect] },
    color: '#64748b',
    data: { backgroundColor: layout ? layoutBackground(layout) : '@bg', showTitle: true, aspect, ...(layout ? { layout } : {}) },
  });
  const res = patchPresentation({ id: presentationId, insertSlides: [{ frameId: frame.id }] });
  if (!res.ok) return res;
  if (layout) {
    // ADR-0007 P2: the layout's decor bar, title and placeholders (theme tokens, so a theme switch restyles them)
    const plan = planLayout({ frame, elements: [frame], layout, idGen: generateId });
    if (plan.ok) for (const el of plan.creates) addElement(el);
  }
  return { ...res, frameId: frame.id };
}

/**
 * "Apply layout to this slide": moves what an earlier layout placed into the new slots, adds placeholders for the empty ones,
 * remembers the layout on the frame. The person's own elements are never touched.
 */
export function applyLayoutToFrame({ frame, elements, layout, addElement, updateElement, removeElement }) {
  if (!frame) return { ok: false, errors: ['Select a slide frame on the board first.'] };
  const plan = planLayout({ frame, elements, layout, idGen: generateId });
  if (!plan.ok) return { ok: false, errors: [plan.error] };
  for (const id of plan.removes) removeElement?.(id);
  for (const u of plan.updates) updateElement(u.id, u.patch);
  for (const el of plan.creates) addElement(el);
  const cur = frame.data || {};
  const themed = cur.backgroundColor === '@bg' || cur.backgroundColor === '@surface';
  updateElement(frame.id, { data: { ...cur, layout, ...(themed ? { backgroundColor: plan.background } : {}) } });
  return { ok: true, moved: plan.updates.length, added: plan.creates.length };
}

const TEXT_PLACEHOLDER = { title: 'Title', subtitle: 'Subtitle', heading: 'Heading', body: 'Body text', caption: 'Caption', quote: '"A quote worth remembering"', number: '42%' };

/**
 * Insert a preset text box: inside the given slide frame (below what is already there), else at `center` on the canvas.
 * @returns {{ok: true, elementId: string}}
 */
export function addPresetText({ preset, frame, elements, addElement, center }) {
  const markdown = TEXT_PLACEHOLDER[preset] || PRESET_SPECS[preset]?.label || 'Text';
  if (frame) {
    const h = frame.size?.height || 1080;
    const w = frame.size?.width || 1920;
    const u = h / 1080;
    const M = Math.round(MARGIN * u);
    // a cascade (like a paste): each text the person adds sits a little lower and to the right of the previous one, starting
    // below the title band, so it never lands exactly on top of another
    const added = (elements || []).filter((e) => e.parentFrameId === frame.id && !e.origin).length;
    const step = added % 6;
    const y = frame.y + M + Math.round(168 * u) + step * Math.round(48 * u);
    const x = frame.x + M + step * Math.round(24 * u);
    const el = newPresetTextElement({ id: generateId('el'), x, y, preset, markdown, width: w - 2 * M - step * Math.round(24 * u), frameHeight: h });
    addElement({ ...el, parentFrameId: frame.id });
    return { ok: true, elementId: el.id };
  }
  const c = center || { x: 0, y: 0 };
  const el = newPresetTextElement({ id: generateId('el'), x: Math.round(c.x - 300), y: Math.round(c.y - 40), preset, markdown, width: 600 });
  addElement(el);
  return { ok: true, elementId: el.id };
}

/**
 * Give a frame a slide shape. A fixed ratio grows the frame to that ratio (never shrinks, content does not move);
 * 'free' just removes the lock.
 */
export function setFrameShape(frame, aspect, updateElement) {
  const size = aspect === 'free' ? frameSize(frame) : coverSize(aspect, frameSize(frame));
  updateElement(frame.id, { size, data: { ...(frame.data || {}), aspect } });
}

/** Keep a 0-based slide index inside the playable range (the deck can shrink under the presenter). */
export function clampIndex(index, count) {
  if (count <= 0) return 0;
  return Math.min(Math.max(0, index), count - 1);
}


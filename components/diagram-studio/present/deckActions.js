// components/diagram-studio/present/deckActions.js
// Editor-side deck operations built on the same pure presentation_patch the MCP tools use (lib/present). They take
// the context callbacks as arguments so they are testable without React.

import { SLIDE_SIZES, nextSlidePosition, frameSize, coverSize } from '../../../lib/present/presentationModel';
import { DEFAULT_ASPECT } from '../../../lib/present/presentationSchema';

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
export function addNewSlide({ patchPresentation, addElement, presentations, activeId, elements }) {
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
    data: { backgroundColor: '#ffffff', showTitle: true, aspect },
  });
  const res = patchPresentation({ id: presentationId, insertSlides: [{ frameId: frame.id }] });
  return res.ok ? { ...res, frameId: frame.id } : res;
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


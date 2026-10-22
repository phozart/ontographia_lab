/**
 * @jest-environment node
 */
// ADR-0007 P2: "align to slide" and "centre in slide" (the slide frame is the reference, not the other selected elements).
import { alignToSlide, ALIGN_MODES, slideFrameOf } from '../../lib/present/alignToSlide';

const frame = { id: 'f', type: 'frame', packId: 'core', isFrame: true, x: 1000, y: 500, size: { width: 1920, height: 1080 } };
const box = (id, x, y, w, h, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x, y, size: { width: w, height: h }, parentFrameId: 'f', ...extra });
const by = (updates, id) => updates.find((u) => u.id === id);

describe('alignToSlide', () => {
  test('modes', () => expect(ALIGN_MODES).toEqual(['left', 'center-h', 'right', 'top', 'center-v', 'bottom', 'center']));
  test('left / right / top / bottom go to the slide margin (96 units at 1080)', () => {
    const a = box('a', 1300, 700, 200, 100);
    expect(by(alignToSlide([a], frame, 'left'), 'a')).toEqual({ id: 'a', x: 1096 });
    expect(by(alignToSlide([a], frame, 'right'), 'a')).toEqual({ id: 'a', x: 1000 + 1920 - 96 - 200 });
    expect(by(alignToSlide([a], frame, 'top'), 'a')).toEqual({ id: 'a', y: 596 });
    expect(by(alignToSlide([a], frame, 'bottom'), 'a')).toEqual({ id: 'a', y: 500 + 1080 - 96 - 100 });
  });
  test('centre-h, centre-v and centre use the middle of the slide for each element separately', () => {
    const a = box('a', 1100, 600, 200, 100);
    expect(by(alignToSlide([a], frame, 'center-h'), 'a')).toEqual({ id: 'a', x: 1000 + 960 - 100 });
    expect(by(alignToSlide([a], frame, 'center-v'), 'a')).toEqual({ id: 'a', y: 500 + 540 - 50 });
    expect(by(alignToSlide([a], frame, 'center'), 'a')).toEqual({ id: 'a', x: 1860, y: 990 });
  });
  test('margins scale with the frame height', () => {
    const small = { ...frame, size: { width: 960, height: 540 } };
    expect(by(alignToSlide([box('a', 1100, 600, 100, 50)], small, 'left'), 'a').x).toBe(1048);
  });
  test('locked elements and elements on locked layers are skipped; the frame itself is never moved', () => {
    const r = alignToSlide([box('a', 0, 0, 10, 10, { locked: true }), box('b', 0, 0, 10, 10), frame], frame, 'left', { layers: [] });
    expect(r.map((u) => u.id)).toEqual(['b']);
  });
  test('unknown mode returns nothing', () => {
    expect(alignToSlide([box('a', 0, 0, 10, 10)], frame, 'nope')).toEqual([]);
  });
});

describe('slideFrameOf', () => {
  const other = { ...frame, id: 'g' };
  test('the frame that holds every selected element, else null', () => {
    const els = [frame, other, box('a', 0, 0, 1, 1), box('b', 0, 0, 1, 1), box('c', 0, 0, 1, 1, { parentFrameId: 'g' })];
    expect(slideFrameOf(els, ['a', 'b'])?.id).toBe('f');
    expect(slideFrameOf(els, ['a', 'c'])).toBeNull();
    expect(slideFrameOf(els, [])).toBeNull();
    expect(slideFrameOf(els, ['f'])).toBeNull(); // a frame is not aligned to itself
    expect(slideFrameOf([box('z', 0, 0, 1, 1, { parentFrameId: undefined })], ['z'])).toBeNull();
  });
});

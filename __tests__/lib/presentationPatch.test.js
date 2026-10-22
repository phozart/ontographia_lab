import { applyPresentationPatch } from '../../lib/present/presentationPatch';
import {
  resolveDeck, lockedSize, coverSize, aspectRatio, nextSlidePosition, frameAspectOf, SLIDE_SIZES, SLIDE_GAP, frameTitleOf,
} from '../../lib/present/presentationModel';
import { MAX_PRESENTATIONS, MAX_SLIDES } from '../../lib/diagramLimits';

let n = 0;
const newId = (p) => `${p}-${++n}`;
const frame = (id, x = 0, y = 0, w = 1920, h = 1080, extra = {}) => ({ id, type: 'frame', packId: 'core', x, y, size: { width: w, height: h }, label: id, ...extra });
const els = [frame('f1'), frame('f2', 2100), frame('f3', 4200), { id: 'box', type: 'task', x: 0, y: 0 }];
const deck = { id: 'p1', title: 'D', aspect: '16:9', slides: [{ id: 's1', frameId: 'f1' }, { id: 's2', frameId: 'f2' }, { id: 's3', frameId: 'f3' }] };

describe('applyPresentationPatch', () => {
  beforeEach(() => { n = 0; });

  it('creates a deck with defaults and an id', () => {
    const r = applyPresentationPatch(undefined, els, { create: { title: '  Review  ' } }, { newId });
    expect(r.ok).toBe(true);
    expect(r.presentations).toEqual([{ id: 'pres-1', title: 'Review', aspect: '16:9', slides: [] }]);
    expect(r.presentationId).toBe('pres-1');
  });

  it('inserts slides from existing frames at a position and returns their ids', () => {
    const r = applyPresentationPatch([deck], els, { id: 'p1', insertSlides: [{ frameId: 'f3', position: 0, notes: 'hi' }, { frameId: 'f1' }] }, { newId });
    expect(r.ok).toBe(true);
    expect(r.presentations[0].slides.map((s) => s.frameId)).toEqual(['f3', 'f1', 'f1', 'f2', 'f3']);
    expect(r.presentations[0].slides[0].notes).toBe('hi');
    expect(r.slideIds).toHaveLength(2);
  });

  it('refuses a frame that does not exist and an element that is not a frame', () => {
    expect(applyPresentationPatch([deck], els, { id: 'p1', insertSlides: [{ frameId: 'nope' }] }, { newId }).errors[0]).toMatch(/does not exist/);
    expect(applyPresentationPatch([deck], els, { id: 'p1', insertSlides: [{ frameId: 'box' }] }, { newId }).errors[0]).toMatch(/not a frame/);
  });

  it('reorders only with a full permutation', () => {
    const ok = applyPresentationPatch([deck], els, { id: 'p1', order: ['s3', 's1', 's2'] }, { newId });
    expect(ok.presentations[0].slides.map((s) => s.id)).toEqual(['s3', 's1', 's2']);
    expect(applyPresentationPatch([deck], els, { id: 'p1', order: ['s3', 's1'] }, { newId }).ok).toBe(false);
    expect(applyPresentationPatch([deck], els, { id: 'p1', order: ['s3', 's3', 's1'] }, { newId }).ok).toBe(false);
    expect(applyPresentationPatch([deck], els, { id: 'p1', order: ['s3', 's1', 'zz'] }, { newId }).ok).toBe(false);
  });

  it('removes slides (the frame stays) and refuses unknown slide ids', () => {
    const r = applyPresentationPatch([deck], els, { id: 'p1', removeSlideIds: ['s2'] }, { newId });
    expect(r.presentations[0].slides.map((s) => s.id)).toEqual(['s1', 's3']);
    expect(applyPresentationPatch([deck], els, { id: 'p1', removeSlideIds: ['zz'] }, { newId }).ok).toBe(false);
  });

  it('updates notes and hidden; clearing notes / hidden removes the keys', () => {
    const withNotes = { ...deck, slides: [{ id: 's1', frameId: 'f1', notes: 'x', hidden: true }] };
    const r = applyPresentationPatch([withNotes], els, { id: 'p1', updateSlides: [{ slideId: 's1', notes: '', hidden: false }] }, { newId });
    expect(r.presentations[0].slides[0]).toEqual({ id: 's1', frameId: 'f1' });
    const r2 = applyPresentationPatch([deck], els, { id: 'p1', updateSlides: [{ slideId: 's2', notes: 'a\u0000b', hidden: true }] }, { newId });
    expect(r2.presentations[0].slides[1]).toEqual({ id: 's2', frameId: 'f2', notes: 'ab', hidden: true });
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify([deck]);
    applyPresentationPatch([deck], els, { id: 'p1', order: ['s3', 's2', 's1'], updateSlides: [{ slideId: 's1', notes: 'z' }], removeSlideIds: ['s2'] }, { newId });
    expect(JSON.stringify([deck])).toBe(before);
  });

  it('enforces the deck and slide caps and unknown fields', () => {
    const many = Array.from({ length: MAX_PRESENTATIONS }, (_, i) => ({ id: `p${i}`, title: 't', aspect: '16:9', slides: [] }));
    expect(applyPresentationPatch(many, els, { create: {} }, { newId }).ok).toBe(false);
    const full = { ...deck, slides: Array.from({ length: MAX_SLIDES }, (_, i) => ({ id: `s${i}`, frameId: 'f1' })) };
    expect(applyPresentationPatch([full], els, { id: 'p1', insertSlides: [{ frameId: 'f1' }] }, { newId }).ok).toBe(false);
    expect(applyPresentationPatch([deck], els, { id: 'p1', color: 'red' }, { newId }).errors[0]).toMatch(/Unknown field/);
    expect(applyPresentationPatch([deck], els, { id: 'missing', title: 'x' }, { newId }).ok).toBe(false);
  });

  it('removes a whole deck only on its own', () => {
    expect(applyPresentationPatch([deck], els, { id: 'p1', removeDeck: true }, { newId }).presentations).toEqual([]);
    expect(applyPresentationPatch([deck], els, { id: 'p1', removeDeck: true, title: 'x' }, { newId }).ok).toBe(false);
  });

  it('retitles and changes the default aspect', () => {
    const r = applyPresentationPatch([deck], els, { id: 'p1', title: 'New', aspect: '4:3' }, { newId });
    expect(r.presentations[0]).toMatchObject({ title: 'New', aspect: '4:3' });
    expect(applyPresentationPatch([deck], els, { id: 'p1', aspect: 'free' }, { newId }).ok).toBe(false);
  });
});

describe('presentationModel', () => {
  it('resolves a deck: missing frames, hidden slides and numbering', () => {
    const content = { elements: els, presentations: [{ ...deck, slides: [{ id: 's1', frameId: 'f1' }, { id: 's2', frameId: 'gone', notes: 'n' }, { id: 's3', frameId: 'f3', hidden: true }, { id: 's4', frameId: 'box' }] }] };
    const r = resolveDeck(content, 'p1');
    expect(r.slides.map((s) => [s.n, s.missing, s.hidden])).toEqual([[1, false, false], [2, true, false], [3, false, true], [4, true, false]]);
    expect(r.slides[1].notes).toBe('n');
    expect(r.playable.map((s) => s.slideId)).toEqual(['s1']);
    expect(resolveDeck(content, 'nope')).toBeNull();
  });

  it('knows the canonical sizes and locks resize to the ratio', () => {
    expect(SLIDE_SIZES['16:9']).toEqual({ width: 1920, height: 1080 });
    expect(aspectRatio('4:3')).toBeCloseTo(4 / 3);
    expect(aspectRatio('free')).toBeNull();
    expect(lockedSize('16:9', { width: 960, height: 700 }, { width: 1920, height: 1080 })).toEqual({ width: 960, height: 540 });
    expect(lockedSize('16:9', { width: 1900, height: 540 }, { width: 1920, height: 1080 })).toEqual({ width: 960, height: 540 });
    expect(lockedSize('free', { width: 10, height: 20 })).toEqual({ width: 10, height: 20 });
    expect(lockedSize('1:1', { width: 300, height: 100 }, { width: 100, height: 100 })).toEqual({ width: 300, height: 300 });
  });

  it('coverSize grows to the ratio without shrinking', () => {
    expect(coverSize('16:9', { width: 600, height: 400 })).toEqual({ width: 711, height: 400 });
    expect(coverSize('16:9', { width: 1920, height: 200 })).toEqual({ width: 1920, height: 1080 });
    expect(coverSize('free', { width: 5, height: 6 })).toEqual({ width: 5, height: 6 });
  });

  it('places the next slide to the right of the deck, else of the content', () => {
    const content = { elements: els, presentations: [deck] };
    expect(nextSlidePosition(content, deck)).toEqual({ x: 4200 + 1920 + SLIDE_GAP, y: 0 });
    expect(nextSlidePosition({ elements: [] }, { slides: [] })).toEqual({ x: 0, y: 0 });
    expect(nextSlidePosition({ elements: [frame('a', 100, 50, 600, 400)] }, { slides: [] })).toEqual({ x: 100 + 600 + SLIDE_GAP, y: 50 });
  });

  it('reads aspect and titles', () => {
    expect(frameAspectOf(frame('a', 0, 0, 1, 1, { data: { aspect: '4:3' } }))).toBe('4:3');
    expect(frameAspectOf(frame('a'))).toBeNull();
    expect(frameTitleOf({ label: '  Hello   there ' })).toBe('Hello there');
    expect(frameTitleOf({}, 'X')).toBe('X');
  });
});

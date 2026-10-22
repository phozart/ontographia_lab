/**
 * @jest-environment node
 */
// ADR-0007 P2: editor-side layout application (planLayout): move what the layout placed, add placeholders for empty slots.
import { planLayout, PLACEHOLDERS } from '../../lib/present/slideBuild';
import { validateDiagramContent } from '../../lib/diagramContent';

let n = 0;
const idGen = (p) => `${p}-${(n += 1)}`;
const frame = { id: 'f', type: 'frame', packId: 'core', isFrame: true, x: 1000, y: 500, size: { width: 1920, height: 1080 }, label: 'My slide', data: { aspect: '16:9' } };

describe('planLayout on an empty slide', () => {
  beforeEach(() => { n = 0; });
  test('creates the decor bar, a title from the frame label and placeholders for text slots, in board coordinates, as children of the frame', () => {
    const plan = planLayout({ frame, elements: [frame], layout: 'two-column', idGen });
    expect(plan.updates).toEqual([]);
    const slots = plan.creates.map((e) => e.origin.slot).sort();
    expect(slots).toEqual(['decor', 'left', 'right', 'title']);
    const title = plan.creates.find((e) => e.origin.slot === 'title');
    expect(title.data.text).toMatchObject({ preset: 'heading', markdown: 'My slide' });
    expect(title.x).toBe(1000 + 96);
    expect(title.y).toBe(500 + 96);
    expect(title.parentFrameId).toBe('f');
    expect(title.fontSize).toBe(48);
    const left = plan.creates.find((e) => e.origin.slot === 'left');
    expect(left.data.text.markdown).toBe(PLACEHOLDERS.left);
    expect(plan.creates.every((e) => e.parentFrameId === 'f')).toBe(true);
    expect(validateDiagramContent({ elements: [frame, ...plan.creates] }).ok).toBe(true);
  });
  test('visual slots get no placeholder element', () => {
    const plan = planLayout({ frame, elements: [frame], layout: 'title-visual', idGen });
    expect(plan.creates.map((e) => e.origin.slot).sort()).toEqual(['decor', 'title']);
  });
  test('the title can be given; blank has no title and no decor', () => {
    expect(planLayout({ frame, elements: [frame], layout: 'title-body', title: 'Hi', idGen }).creates.find((e) => e.origin.slot === 'title').data.text.markdown).toBe('Hi');
    expect(planLayout({ frame, elements: [frame], layout: 'blank', idGen }).creates).toEqual([]);
  });
  test('font sizes follow the frame scale', () => {
    const small = { ...frame, size: { width: 960, height: 540 } };
    const plan = planLayout({ frame: small, elements: [small], layout: 'title-body', idGen });
    expect(plan.creates.find((e) => e.origin.slot === 'title').fontSize).toBe(24);
  });
});

describe('planLayout on a slide that already has content', () => {
  beforeEach(() => { n = 0; });
  const built = () => planLayout({ frame, elements: [frame], layout: 'two-column', idGen }).creates;
  test('moves what an earlier layout placed into the new slots and only adds what is missing', () => {
    const els = [frame, ...built()];
    const plan = planLayout({ frame, elements: els, layout: 'three-column', idGen });
    const moved = new Set(plan.updates.map((u) => els.find((e) => e.id === u.id).origin.slot));
    expect(moved.has('left') && moved.has('right') && moved.has('title')).toBe(true);
    const left = els.find((e) => e.origin?.slot === 'left');
    expect(plan.updates.find((u) => u.id === left.id).patch.origin.slot).toBe('c1');
    const created = plan.creates.map((e) => e.origin.slot).sort();
    expect(created).toEqual(['c3', 'decor']); // left and right move into c1 and c2; the decor is redrawn
    expect(plan.removes).toHaveLength(1);
    const u = plan.updates.find((x) => els.find((e) => e.id === x.id).origin.slot === 'title');
    expect(u.patch.size.width).toBe(1728);
  });
  test('elements the person added (no origin.slot) are never touched, and locked ones are skipped', () => {
    const mine = { id: 'mine', type: 'rectangle', packId: 'core', x: 1100, y: 600, size: { width: 50, height: 50 }, parentFrameId: 'f' };
    const els = [frame, ...built().map((e) => (e.origin.slot === 'left' ? { ...e, locked: true } : e)), mine];
    const plan = planLayout({ frame, elements: els, layout: 'title-body', idGen });
    expect(plan.updates.find((u) => u.id === 'mine')).toBeUndefined();
    expect(plan.updates.find((u) => els.find((e) => e.id === u.id)?.locked)).toBeUndefined();
  });
  test('content from slots the new layout lacks fills the empty slots in reading order; with no free slot left it stays put', () => {
    const els = [frame, ...built()];
    const plan = planLayout({ frame, elements: els, layout: 'title-body', idGen });
    const leftEl = els.find((e) => e.origin?.slot === 'left');
    const rightEl = els.find((e) => e.origin?.slot === 'right');
    expect(plan.updates.find((u) => u.id === leftEl.id).patch.origin.slot).toBe('body');
    expect(plan.updates.find((u) => u.id === rightEl.id)).toBeUndefined();
  });
  test('the cover layout draws a strip on the surface ground; other layouts the accent bar on the page ground', () => {
    const cover = planLayout({ frame, elements: [frame], layout: 'title', idGen });
    expect(cover.background).toBe('@surface');
    const strip = cover.creates.find((e) => e.origin.slot === 'decor');
    expect(strip.size.height).toBe(1080);
    expect(strip.showLabel).toBe(false);
    expect(planLayout({ frame, elements: [frame], layout: 'title-body', idGen }).background).toBe('@bg');
  });
  test('an unknown layout is an error value', () => {
    expect(planLayout({ frame, elements: [frame], layout: 'nope', idGen })).toEqual({ ok: false, error: expect.stringMatching(/layout/i) });
  });
});

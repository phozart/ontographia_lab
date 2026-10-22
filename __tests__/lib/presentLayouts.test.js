/**
 * @jest-environment node
 */
// ADR-0007 P2: slide layouts are deterministic placement grids (named slots, 96-unit margins, 48-unit gutters).
import { LAYOUT_NAMES, SLOT_NAMES, layoutSlots, assignBlocksToSlots, MARGIN, GUTTER } from '../../lib/present/layouts';

const SIZE = { width: 1920, height: 1080 };
const slotsOf = (layout, size = SIZE) => Object.fromEntries(layoutSlots(layout, size).slots.map((s) => [s.name, s]));
const overlaps = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('layout catalogue (ADR 5.2)', () => {
  test('the eight layouts and their slot names', () => {
    expect(LAYOUT_NAMES).toEqual(['title', 'title-body', 'two-column', 'three-column', 'title-visual', 'visual-caption', 'big-number', 'blank']);
    expect(SLOT_NAMES).toEqual({
      title: ['title', 'subtitle'],
      'title-body': ['title', 'body'],
      'two-column': ['title', 'left', 'right'],
      'three-column': ['title', 'c1', 'c2', 'c3'],
      'title-visual': ['title', 'visual'],
      'visual-caption': ['visual', 'caption'],
      'big-number': ['number', 'label', 'body'],
      blank: ['full'],
    });
  });
  test.each(LAYOUT_NAMES)('%s: slots match the catalogue and are named in order', (name) => {
    expect(layoutSlots(name, SIZE).slots.map((s) => s.name)).toEqual(SLOT_NAMES[name]);
  });
});

describe('geometry', () => {
  test('constants are the ADR margins', () => {
    expect(MARGIN).toBe(96);
    expect(GUTTER).toBe(48);
  });
  test.each(LAYOUT_NAMES)('%s: every slot stays inside the margins and no two slots overlap', (name) => {
    const slots = layoutSlots(name, SIZE).slots;
    for (const s of slots) {
      expect(s.x).toBeGreaterThanOrEqual(MARGIN);
      expect(s.y).toBeGreaterThanOrEqual(MARGIN);
      expect(s.x + s.w).toBeLessThanOrEqual(SIZE.width - MARGIN);
      expect(s.y + s.h).toBeLessThanOrEqual(SIZE.height - MARGIN);
      expect(s.w).toBeGreaterThan(0);
      expect(s.h).toBeGreaterThan(0);
    }
    for (let i = 0; i < slots.length; i += 1) for (let j = i + 1; j < slots.length; j += 1) expect(overlaps(slots[i], slots[j])).toBe(false);
  });
  test('two-column: equal columns separated by a 48 gutter', () => {
    const s = slotsOf('two-column');
    expect(s.left.w).toBe(s.right.w);
    expect(s.right.x - (s.left.x + s.left.w)).toBe(GUTTER);
    expect(s.left.y).toBe(s.right.y);
    expect(s.left.y).toBeGreaterThan(s.title.y + s.title.h);
  });
  test('three-column: three equal columns, 48 gutters, filling the content width', () => {
    const s = slotsOf('three-column');
    expect(s.c1.w).toBe(s.c2.w);
    expect(s.c2.w).toBe(s.c3.w);
    expect(s.c2.x - (s.c1.x + s.c1.w)).toBe(GUTTER);
    expect(s.c3.x - (s.c2.x + s.c2.w)).toBe(GUTTER);
    expect(s.c3.x + s.c3.w).toBeLessThanOrEqual(SIZE.width - MARGIN);
    expect(SIZE.width - MARGIN - (s.c3.x + s.c3.w)).toBeLessThan(3);
  });
  test('title-visual: the visual takes the full content width below the title', () => {
    const s = slotsOf('title-visual');
    expect(s.visual.w).toBe(SIZE.width - 2 * MARGIN);
    expect(s.visual.y).toBeGreaterThan(s.title.y + s.title.h - 1);
  });
  test('visual-caption: caption under the visual', () => {
    const s = slotsOf('visual-caption');
    expect(s.caption.y).toBeGreaterThanOrEqual(s.visual.y + s.visual.h);
  });
  test('slot presets: cover title uses the title preset, content titles the heading preset, big-number the number preset', () => {
    expect(slotsOf('title').title.preset).toBe('title');
    expect(slotsOf('title').subtitle.preset).toBe('subtitle');
    expect(slotsOf('title-body').title.preset).toBe('heading');
    expect(slotsOf('title-body').body.preset).toBe('body');
    expect(slotsOf('big-number').number.preset).toBe('number');
    expect(slotsOf('visual-caption').caption.preset).toBe('caption');
    expect(slotsOf('two-column').left.kind).toBe('content');
    expect(slotsOf('title-visual').visual.kind).toBe('visual');
  });
  test('units scale with the frame height (a 960x540 frame has half the margins)', () => {
    const small = slotsOf('title-body', { width: 960, height: 540 });
    expect(small.title.x).toBe(48);
    expect(small.title.y).toBe(48);
    expect(small.body.w).toBe(960 - 96);
  });
  test('4:3 and 1:1 frames get valid grids', () => {
    for (const size of [{ width: 1440, height: 1080 }, { width: 1080, height: 1080 }]) {
      for (const name of LAYOUT_NAMES) {
        for (const s of layoutSlots(name, size).slots) {
          expect(s.x + s.w).toBeLessThanOrEqual(size.width - MARGIN);
          expect(s.y + s.h).toBeLessThanOrEqual(size.height - MARGIN);
        }
      }
    }
  });
  test('deterministic', () => {
    expect(layoutSlots('three-column', SIZE)).toEqual(layoutSlots('three-column', SIZE));
  });
  test('an unknown layout is an error value, not a throw', () => {
    expect(layoutSlots('nope', SIZE)).toEqual({ ok: false, error: expect.stringMatching(/layout/i) });
  });
});

describe('assignBlocksToSlots', () => {
  test('blocks without a slot fill the free content slots in order; the title slot is reserved for the slide title', () => {
    const r = assignBlocksToSlots('two-column', [{ text: { markdown: 'a' } }, { text: { markdown: 'b' } }]);
    expect(r.ok).toBe(true);
    expect(r.assigned.map((b) => b.slot)).toEqual(['left', 'right']);
  });
  test('explicit slots are honoured and not reused by the rest', () => {
    const r = assignBlocksToSlots('two-column', [{ slot: 'right', text: { markdown: 'a' } }, { text: { markdown: 'b' } }]);
    expect(r.assigned.map((b) => b.slot)).toEqual(['right', 'left']);
  });
  test('errors: unknown slot, two blocks in one slot, more blocks than slots, too many blocks', () => {
    expect(assignBlocksToSlots('two-column', [{ slot: 'middle', text: { markdown: 'a' } }]).ok).toBe(false);
    expect(assignBlocksToSlots('two-column', [{ slot: 'left', text: { markdown: 'a' } }, { slot: 'left', text: { markdown: 'b' } }]).ok).toBe(false);
    expect(assignBlocksToSlots('title-body', [{ text: { markdown: 'a' } }, { text: { markdown: 'b' } }]).error).toMatch(/slot/);
    expect(assignBlocksToSlots('blank', Array.from({ length: 13 }, () => ({ text: { markdown: 'a' } }))).ok).toBe(false);
  });
  test('the blank layout has one slot "full"', () => {
    expect(assignBlocksToSlots('blank', [{ text: { markdown: 'x' } }]).assigned[0].slot).toBe('full');
  });
});

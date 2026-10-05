import {
  getFrameMembers,
  findFrameForElement,
  computeFrameMembershipChanges,
  deriveLegacyFrameMembership,
  assignFrameOnCreate,
} from '../../../components/diagram-studio/utils/frameMembership';

const frame = (id, x, y, w, h, extra = {}) => ({ id, type: 'frame', x, y, size: { width: w, height: h }, ...extra });
const box = (id, x, y, extra = {}) => ({ id, type: 'rectangle', x, y, size: { width: 100, height: 50 }, ...extra });

describe('getFrameMembers', () => {
  it('returns only elements that explicitly reference the frame', () => {
    const els = [frame('f', 0, 0, 500, 500), box('in', 10, 10, { parentFrameId: 'f' }), box('under', 20, 20)];
    expect(getFrameMembers('f', els).map((e) => e.id)).toEqual(['in']);
  });
});

describe('findFrameForElement', () => {
  const frames = [frame('f', 0, 0, 500, 500)];
  it('matches when the element centre is inside', () => {
    expect(findFrameForElement({ x: 400, y: 100, size: { width: 100, height: 50 } }, frames)).toBe('f');
  });
  it('does not match when the centre is outside', () => {
    expect(findFrameForElement({ x: 460, y: 100, size: { width: 100, height: 50 } }, frames)).toBeNull();
  });
  it('never returns a frame for a frame', () => {
    expect(findFrameForElement(frame('g', 10, 10, 50, 50), frames)).toBeNull();
  });
});

describe('computeFrameMembershipChanges', () => {
  const base = () => [frame('f', 0, 0, 500, 500), box('a', 600, 10), box('b', 10, 10, { parentFrameId: 'f' })];

  it('adopts a shape dropped inside the frame', () => {
    expect(computeFrameMembershipChanges(base(), { a: { x: 100, y: 100 } })).toEqual({ a: 'f' });
  });
  it('releases a shape dragged out of the frame', () => {
    expect(computeFrameMembershipChanges(base(), { b: { x: 700, y: 10 } })).toEqual({ b: null });
  });
  it('reports nothing when membership is unchanged', () => {
    expect(computeFrameMembershipChanges(base(), { b: { x: 20, y: 20 }, a: { x: 900, y: 10 } })).toEqual({});
  });
  it('does not change members that move together with their frame', () => {
    const finals = { f: { x: 1000, y: 0 }, b: { x: 1010, y: 10 } };
    expect(computeFrameMembershipChanges(base(), finals)).toEqual({});
  });
  it('a plain click (no movement) on a shape under a frame never adopts it', () => {
    const els = [frame('f', 0, 0, 500, 500), box('under', 10, 10)];
    expect(computeFrameMembershipChanges(els, { under: { x: 10, y: 10 } })).toEqual({});
  });
  it('a frame drag over a non-member never adopts it', () => {
    const els = [frame('f', 0, 0, 500, 500), box('x', 1000, 10)];
    expect(computeFrameMembershipChanges(els, { f: { x: 900, y: 0 } })).toEqual({});
  });
});

describe('assignFrameOnCreate', () => {
  const frames = [frame('f', 0, 0, 500, 500)];
  it('adopts a shape created inside a frame', () => {
    expect(assignFrameOnCreate(box('n', 100, 100), frames).parentFrameId).toBe('f');
  });
  it('leaves a shape created outside alone', () => {
    expect(assignFrameOnCreate(box('n', 900, 100), frames).parentFrameId).toBeUndefined();
  });
  it('respects explicit membership (including null for a template shape)', () => {
    expect(assignFrameOnCreate(box('n', 100, 100, { parentFrameId: null }), frames).parentFrameId).toBeNull();
  });
  it('marks new frames as explicit-membership and never adopts frames', () => {
    const f = assignFrameOnCreate(frame('g', 0, 0, 50, 50), frames);
    expect(f.membershipExplicit).toBe(true);
    expect(f.parentFrameId).toBeUndefined();
  });
});

describe('deriveLegacyFrameMembership', () => {
  it('adopts fully-contained shapes of frames without explicit membership, once', () => {
    const els = [frame('f', 0, 0, 500, 500), box('in', 10, 10), box('out', 600, 10), box('part', 450, 10)];
    const out = deriveLegacyFrameMembership(els);
    expect(out.find((e) => e.id === 'in').parentFrameId).toBe('f');
    expect(out.find((e) => e.id === 'out').parentFrameId).toBeUndefined();
    expect(out.find((e) => e.id === 'part').parentFrameId).toBeUndefined();
    expect(out.find((e) => e.id === 'f').membershipExplicit).toBe(true);
  });
  it('is idempotent (same reference second time) and does not mutate input', () => {
    const els = [frame('f', 0, 0, 500, 500), box('in', 10, 10)];
    const snap = JSON.parse(JSON.stringify(els));
    const out = deriveLegacyFrameMembership(els);
    expect(els).toEqual(snap);
    expect(deriveLegacyFrameMembership(out)).toBe(out);
  });
  it('leaves frames that are already explicit untouched, even when empty', () => {
    const els = [frame('f', 0, 0, 500, 500, { membershipExplicit: true }), box('under', 10, 10)];
    expect(deriveLegacyFrameMembership(els)).toBe(els);
  });
  it('does not steal shapes that already have a parent', () => {
    const els = [frame('f', 0, 0, 500, 500), frame('g', 0, 0, 500, 500, { membershipExplicit: true }), box('in', 10, 10, { parentFrameId: 'g' })];
    const out = deriveLegacyFrameMembership(els);
    expect(out.find((e) => e.id === 'in').parentFrameId).toBe('g');
  });
  it('returns non-arrays unchanged', () => {
    expect(deriveLegacyFrameMembership(undefined)).toBeUndefined();
  });
});

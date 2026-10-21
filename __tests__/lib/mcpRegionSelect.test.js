/**
 * @jest-environment node
 */
import { selectRegion, orderForReading, RegionInputError } from '../../lib/mcp/regionSelect';

const el = (id, x, y, extra = {}) => ({ id, type: 'sticky-note', packId: 'core', x, y, size: { width: 100, height: 100 }, ...extra });
const frame = (id, x, y, w = 500, h = 400, extra = {}) => ({ id, type: 'frame', packId: 'core', x, y, size: { width: w, height: h }, ...extra });

const ELEMENTS = [
  frame('F1', 0, 0),
  el('a', 300, 20, { parentFrameId: 'F1' }),
  el('b', 20, 20, { parentFrameId: 'F1' }),
  el('c', 20, 200, { parentFrameId: 'F1' }),
  frame('F2', 100, 100, 200, 200, { parentFrameId: 'F1' }), // nested
  el('n', 120, 120, { parentFrameId: 'F2' }),
  el('geo', 50, 50), // geometrically inside F1 but NOT a member
  el('out', 2000, 2000),
];
const ids = (r) => r.elements.map((e) => e.id);

describe('frame focus', () => {
  test('frame + transitive explicit members, in reading order (frame -> y -> x), never by geometry', () => {
    const r = selectRegion(ELEMENTS, { frameId: 'F1' });
    expect(r.kind).toBe('frame');
    expect(ids(r)).toEqual(['F1', 'b', 'a', 'F2', 'n', 'c']); // nested frame F2 (y=100) reads before c (y=200)
    expect(ids(r)).not.toContain('geo');
  });
  test('unknown frame or non-frame id is an input error', () => {
    expect(() => selectRegion(ELEMENTS, { frameId: 'nope' })).toThrow(RegionInputError);
    expect(() => selectRegion(ELEMENTS, { frameId: 'a' })).toThrow(/not a frame/i);
  });
  test('cyclic parent links terminate', () => {
    const cyc = [frame('X', 0, 0, 10, 10, { parentFrameId: 'Y' }), frame('Y', 0, 0, 10, 10, { parentFrameId: 'X' })];
    expect(ids(selectRegion(cyc, { frameId: 'X' })).sort()).toEqual(['X', 'Y']);
  });
});

describe('elementIds focus (selection / link)', () => {
  test('plain ids return just those, in reading order, and report unknown ids', () => {
    const r = selectRegion(ELEMENTS, { elementIds: ['c', 'a', 'ghost'] });
    expect(r.kind).toBe('elements');
    expect(ids(r)).toEqual(['a', 'c']);
    expect(r.notFound).toEqual(['ghost']);
  });
  test('a frame id in the list expands to its members', () => {
    expect(ids(selectRegion(ELEMENTS, { elementIds: ['F2'] }))).toEqual(['F2', 'n']);
  });
  test('all ids unknown -> input error', () => {
    expect(() => selectRegion(ELEMENTS, { elementIds: ['x', 'y'] })).toThrow(/none of the requested/i);
  });
});

describe('bbox focus', () => {
  test('includes anything whose rectangle overlaps; touching edges do not count', () => {
    const r = selectRegion(ELEMENTS, { bbox: { x: 400, y: 0, width: 100, height: 100 } });
    expect(r.kind).toBe('region');
    // F1 (0-500) overlaps; its member a (300-400) only touches the region edge, so it is excluded
    expect(ids(r)).toEqual(['F1']);
  });
  test('a region reaching into a frame returns the overlapping members, not the whole frame', () => {
    expect(ids(selectRegion(ELEMENTS, { bbox: { x: 290, y: 0, width: 100, height: 100 } }))).toEqual(['F1', 'a']);
  });
  test('edge-touching is excluded (strict overlap)', () => {
    const r = selectRegion([el('t', 0, 0)], { bbox: { x: 100, y: 0, width: 50, height: 50 } });
    expect(ids(r)).toEqual([]);
  });
  test('partial overlap is included; far elements are not', () => {
    const r = selectRegion(ELEMENTS, { bbox: { x: 1990, y: 1990, width: 20, height: 20 } });
    expect(ids(r)).toEqual(['out']);
  });
  test('elements without a size use defaults; elements without coordinates are never selected', () => {
    const els = [{ id: 'p', type: 'task', x: 0, y: 0 }, { id: 'q', type: 'task' }];
    expect(ids(selectRegion(els, { bbox: { x: 10, y: 10, width: 5, height: 5 } }))).toEqual(['p']);
  });
  test('invalid bbox is an input error', () => {
    expect(() => selectRegion(ELEMENTS, { bbox: { x: 0, y: 0, width: 0, height: 5 } })).toThrow(RegionInputError);
  });
});

describe('around an element', () => {
  test('expands the element rect by the radius', () => {
    const r = selectRegion(ELEMENTS, { around: { elementId: 'out', radius: 50 } });
    expect(r.kind).toBe('around');
    expect(ids(r)).toEqual(['out']);
    const near = selectRegion([el('m', 0, 0), el('k', 140, 0), el('far', 600, 0)], { around: { elementId: 'm', radius: 60 } });
    expect(ids(near)).toEqual(['m', 'k']);
  });
  test('unknown element, and radius is clamped', () => {
    expect(() => selectRegion(ELEMENTS, { around: { elementId: 'zz' } })).toThrow(RegionInputError);
    const r = selectRegion([el('m', 0, 0), el('far', 9000, 0)], { around: { elementId: 'm', radius: 1e9 } });
    expect(ids(r)).toEqual(['m']); // clamped to 5000
  });
});

describe('focus validation', () => {
  test.each([[{}], [null], [{ frameId: 'F1', bbox: { x: 0, y: 0, width: 1, height: 1 } }]])('needs exactly one focus: %j', (f) => {
    expect(() => selectRegion(ELEMENTS, f)).toThrow(RegionInputError);
  });
});

describe('orderForReading', () => {
  test('ties on y break by x then id; members follow their frame', () => {
    const els = [el('z', 10, 0), el('y', 10, 0), el('w', 0, 0)];
    expect(orderForReading(els).map((e) => e.id)).toEqual(['w', 'y', 'z']);
  });
});

describe('neighbourhood', () => {
  test('summary lists frames outside the focus with member counts, nearest first, id+label+count only', () => {
    const els = [
      frame('IN', 0, 0, 100, 100),
      el('m', 10, 10, { parentFrameId: 'IN' }),
      frame('NEAR', 200, 0, 100, 100, { label: 'Near' }),
      el('n1', 210, 10, { parentFrameId: 'NEAR' }),
      el('n2', 220, 10, { parentFrameId: 'NEAR' }),
      frame('FAR', 5000, 0, 100, 100, { label: 'Far' }),
    ];
    const r = selectRegion(els, { frameId: 'IN' }, { neighbourhood: 'summary' });
    expect(r.neighbourhood.frames).toEqual([
      { id: 'NEAR', label: 'Near', count: 2 },
      { id: 'FAR', label: 'Far', count: 0 },
    ]);
  });
  test('none by default', () => {
    expect(selectRegion(ELEMENTS, { frameId: 'F1' }).neighbourhood).toBeUndefined();
  });
});

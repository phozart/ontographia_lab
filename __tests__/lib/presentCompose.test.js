/**
 * @jest-environment node
 */
// ADR-0007 P2: composition copies a SNAPSHOT of board content into a slot (scaled, centred, provenance, never above
// 1.5x, refused below 0.35x), deterministic.
import { fitScale, copyIntoSlot, MIN_SCALE, MAX_SCALE } from '../../lib/present/compose';
import { validateDiagramContent } from '../../lib/diagramContent';

let n = 0;
const ids = () => `new-${(n += 1)}`;
const slot = { name: 'left', x: 100, y: 200, w: 800, h: 600 };
const rect = (id, x, y, w, h, extra = {}) => ({ id, type: 'rectangle', packId: 'core', x, y, size: { width: w, height: h }, label: id, fontSize: 20, borderWidth: 2, ...extra });
const table = (id, x, y) => ({
  id, type: 'table', packId: 'core', x, y, size: { width: 400, height: 100 }, label: '',
  data: { table: { columns: [{ id: 'col-a', name: 'A', type: 'text' }], rows: [{ id: 'row-1', cells: { 'col-a': 'x' } }] } },
});
const content = {
  elements: [rect('a', 1000, 1000, 200, 100), rect('b', 1400, 1000, 200, 100, { parentFrameId: 'f' }), table('t', 1000, 1300), { id: 'f', type: 'frame', packId: 'core', isFrame: true, x: 900, y: 900, size: { width: 800, height: 700 }, label: 'F' }],
  connections: [{ id: 'c1', sourceId: 'a', targetId: 'b', lineStyle: 'step', waypoints: [{ x: 1300, y: 1050 }] }, { id: 'c2', sourceId: 'a', targetId: 'zzz' }],
};

describe('fitScale', () => {
  test('fits, centres in the slot and caps at 1.5x', () => {
    expect(fitScale({ width: 400, height: 300 }, slot).scale).toBe(1.5);
    expect(fitScale({ width: 1600, height: 600 }, slot).scale).toBe(0.5);
  });
  test('refuses below 0.35x with a helpful message', () => {
    const r = fitScale({ width: 4000, height: 3000 }, slot);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/whole frame on its own slide|own slide/);
    expect(fitScale({ width: 800 / 0.35, height: 100 }, slot).ok).toBe(true);
    expect(MIN_SCALE).toBe(0.35);
    expect(MAX_SCALE).toBe(1.5);
  });
});

describe('copyIntoSlot', () => {
  const run = (spec, s = slot) => { n = 0; return copyIntoSlot(content, spec, s, { newId: ids, revision: 7, parentId: 'slide-frame' }); };
  test('copies elements with new ids, scaled and centred in the slot, and records provenance', () => {
    const r = run({ elementIds: ['a', 'b'] });
    expect(r.ok).toBe(true);
    expect(r.elements).toHaveLength(2);
    const [a, b] = r.elements;
    expect(a.id).toBe('new-1');
    expect(a.parentFrameId).toBe('slide-frame');
    expect(b.parentFrameId).toBe('slide-frame');
    // bbox is 800x100 (x 1000..1600? a 1000-1200, b 1400-1600 => 600 wide); scale = min(800/600, 600/100) = 1.333
    expect(r.scale).toBe(Math.min(1.5, 800 / 600));
    expect(a.size.width).toBeCloseTo(200 * r.scale, 5);
    expect(a.fontSize).toBeCloseTo(20 * r.scale, 5);
    expect(a.borderWidth).toBeCloseTo(2 * r.scale, 5);
    expect(a.origin).toEqual({ copiedFrom: { elementId: 'a', revision: 7 }, slot: 'left' });
    // centred
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x + a.size.width, b.x + b.size.width);
    expect((left + right) / 2).toBeCloseTo(slot.x + slot.w / 2, 3);
    expect(content.elements[0].id).toBe('a'); // sources untouched
    expect(content.elements[0].size.width).toBe(200);
  });
  test('copies connections between copied elements only, remapped, waypoints scaled', () => {
    const r = run({ elementIds: ['a', 'b'] });
    expect(r.connections).toHaveLength(1);
    expect(r.connections[0]).toMatchObject({ sourceId: r.elements[0].id, targetId: r.elements[1].id, lineStyle: 'step' });
    expect(r.connections[0].id).not.toBe('c1');
    expect(r.connections[0].waypoints).toHaveLength(1);
    const dangling = run({ elementIds: ['a'] });
    expect(dangling.connections).toEqual([]);
  });
  test('a table is copied with a table scale so its rows and text shrink with it', () => {
    const r = run({ elementIds: ['t'] }, { ...slot, w: 200, h: 100 });
    expect(r.ok).toBe(true);
    const t = r.elements[0];
    expect(t.data.table.scale).toBeCloseTo(r.scale, 5);
    expect(t.size.width).toBeCloseTo(400 * r.scale, 5);
    expect(validateDiagramContent({ elements: [t] }).ok).toBe(true);
  });
  test('copying a frame copies its members (not the frame)', () => {
    const r = run({ frameId: 'f' });
    expect(r.ok).toBe(true);
    expect(r.elements).toHaveLength(1);
    expect(r.elements[0].origin.copiedFrom.elementId).toBe('b');
  });
  test('errors: unknown id, empty selection, empty frame, too many, below 0.35x', () => {
    expect(run({ elementIds: ['nope'] }).ok).toBe(false);
    expect(run({ elementIds: [] }).ok).toBe(false);
    expect(run({ frameId: 'a' }).error).toMatch(/not a frame/);
    expect(run({ elementIds: ['a'], frameId: 'f' }).ok).toBe(false);
    expect(run({ elementIds: ['a', 'b'] }, { ...slot, w: 40, h: 40 }).error).toMatch(/own slide/);
    const many = { elements: Array.from({ length: 301 }, (_, i) => rect(`e${i}`, i, 0, 10, 10)) };
    const big = copyIntoSlot(many, { elementIds: many.elements.map((e) => e.id) }, slot, { newId: ids, revision: 1, parentId: 'p' });
    expect(big.ok).toBe(false);
    expect(big.error).toMatch(/300/);
  });
  test('deterministic and result passes content validation', () => {
    const a = run({ elementIds: ['a', 'b', 't'] });
    const b = run({ elementIds: ['a', 'b', 't'] });
    expect(a).toEqual(b);
    expect(validateDiagramContent({ elements: a.elements, connections: a.connections }).ok).toBe(true);
  });
});

// M2: LayoutEngine.hierarchicalLayout was unused and untested before agent edits started relying on it.
import { hierarchicalLayout } from '../../components/diagram-studio/LayoutEngine';

const el = (id, w = 120, h = 60) => ({ id, x: 0, y: 0, size: { width: w, height: h } });
const conn = (s, t) => ({ id: `${s}-${t}`, sourceId: s, targetId: t });
const by = (arr) => Object.fromEntries(arr.map((e) => [e.id, e]));

describe('hierarchicalLayout', () => {
  test('empty input returns empty', () => {
    expect(hierarchicalLayout([], [])).toEqual([]);
  });

  test('left-right: a chain moves right layer by layer and keeps y equal', () => {
    const out = by(hierarchicalLayout([el('a'), el('b'), el('c')], [conn('a', 'b'), conn('b', 'c')], { direction: 'left-right', layerSpacing: 200, startX: 0, startY: 0 }));
    expect(out.a.x).toBe(0);
    expect(out.b.x).toBe(200);
    expect(out.c.x).toBe(400);
    expect(new Set([out.a.y, out.b.y, out.c.y]).size).toBe(1);
  });

  test('top-down: siblings share a layer (same y) and get distinct x', () => {
    const out = by(hierarchicalLayout([el('a'), el('b'), el('c')], [conn('a', 'b'), conn('a', 'c')], { direction: 'top-down', layerSpacing: 150, startX: 0, startY: 0 }));
    expect(out.b.y).toBe(out.c.y);
    expect(out.b.y).toBeGreaterThan(out.a.y);
    expect(out.b.x).not.toBe(out.c.x);
  });

  test('does not mutate its input and keeps every element', () => {
    const input = [el('a'), el('b')];
    const out = hierarchicalLayout(input, [conn('a', 'b')]);
    expect(input[0].x).toBe(0);
    expect(out).toHaveLength(2);
  });

  test('cycles and disconnected elements terminate and are all placed', () => {
    const out = hierarchicalLayout([el('a'), el('b'), el('z')], [conn('a', 'b'), conn('b', 'a')]);
    expect(out.map((e) => e.id).sort()).toEqual(['a', 'b', 'z']);
    out.forEach((e) => { expect(Number.isFinite(e.x)).toBe(true); expect(Number.isFinite(e.y)).toBe(true); });
  });

  test('ignores connections that reference unknown ids', () => {
    expect(() => hierarchicalLayout([el('a')], [conn('a', 'ghost')])).not.toThrow();
  });
});

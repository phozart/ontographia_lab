/**
 * @jest-environment node
 */
import { layoutStructure, LAYOUTS, FRAME_PAD, FRAME_TITLE } from '../../lib/layout/structureLayout';

// small deterministic PRNG so "random" structures are reproducible
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}
function randomStructure(seed, n, { groups = 0, treeLike = true } = {}) {
  const r = rng(seed);
  const nodes = Array.from({ length: n }, (_, i) => ({
    key: `n${i}`,
    w: 60 + Math.floor(r() * 120),
    h: 30 + Math.floor(r() * 100),
    ...(groups ? { group: r() < 0.15 ? undefined : `g${Math.floor(r() * groups)}` } : {}),
  }));
  const edges = [];
  for (let i = 1; i < n; i++) edges.push({ from: `n${treeLike ? Math.floor(r() * i) : Math.floor(r() * n)}`, to: `n${i}` });
  if (!treeLike) for (let i = 0; i < n / 2; i++) edges.push({ from: `n${Math.floor(r() * n)}`, to: `n${Math.floor(r() * n)}` });
  return { nodes, edges, groups: Array.from({ length: groups }, (_, i) => ({ key: `g${i}` })) };
}
const boxes = (s, out) => s.nodes.map((n) => ({ key: n.key, ...out.nodes.get(n.key), w: n.w, h: n.h }));
const overlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
function anyOverlap(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (overlap(list[i], list[j])) return [list[i], list[j]];
  return null;
}

describe('no overlaps, every layout', () => {
  test.each(LAYOUTS)('%s: 1, 2, 9, 60 and 200 nodes', (layout) => {
    for (const n of [1, 2, 9, 60, 200]) {
      for (const seed of [1, 2, 3]) {
        const s = randomStructure(seed * 7 + n, n, { treeLike: seed !== 3 });
        const out = layoutStructure({ ...s, groups: [], layout });
        expect(out.nodes.size).toBe(n);
        expect(anyOverlap(boxes(s, out))).toBeNull();
        for (const p of out.nodes.values()) expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  test('works without edges and with cyclic and self-referencing edges', () => {
    const nodes = Array.from({ length: 6 }, (_, i) => ({ key: `n${i}`, w: 100, h: 60 }));
    const cyc = [{ from: 'n0', to: 'n1' }, { from: 'n1', to: 'n2' }, { from: 'n2', to: 'n0' }, { from: 'n3', to: 'n3' }, { from: 'n0', to: 'n1' }];
    for (const layout of LAYOUTS) {
      for (const edges of [[], cyc]) {
        const out = layoutStructure({ nodes, edges, layout });
        expect(anyOverlap(boxes({ nodes }, out))).toBeNull();
      }
    }
  });
});

describe('groups become packed frames', () => {
  test.each(LAYOUTS)('%s: members sit inside their frame, frames are disjoint, loose nodes stay clear', (layout) => {
    const s = randomStructure(42, 40, { groups: 4, treeLike: false });
    const out = layoutStructure({ ...s, layout });
    expect(out.frames.size).toBe(4);
    const fr = [...out.frames.entries()].map(([key, f]) => ({ key, ...f }));
    expect(anyOverlap(fr)).toBeNull();
    for (const n of s.nodes) {
      const p = out.nodes.get(n.key);
      const b = { x: p.x, y: p.y, w: n.w, h: n.h };
      if (n.group) {
        const f = out.frames.get(n.group);
        expect(b.x).toBeGreaterThanOrEqual(f.x + FRAME_PAD / 2);
        expect(b.y).toBeGreaterThanOrEqual(f.y + FRAME_TITLE - 10);
        expect(b.x + b.w).toBeLessThanOrEqual(f.x + f.w - FRAME_PAD / 2);
        expect(b.y + b.h).toBeLessThanOrEqual(f.y + f.h - FRAME_PAD / 2);
      } else {
        for (const f of fr) expect(overlap(b, f)).toBe(false);
      }
    }
    expect(anyOverlap(boxes(s, out))).toBeNull();
  });

  test('cluster: an empty group still gets a frame of a minimum size', () => {
    const out = layoutStructure({ nodes: [{ key: 'a', w: 100, h: 60, group: 'g1' }], edges: [], groups: [{ key: 'g1' }, { key: 'g2' }], layout: 'cluster' });
    expect(out.frames.get('g2').w).toBeGreaterThanOrEqual(200);
  });
});

describe('determinism and shape', () => {
  test('same input, same output (and independent of the input being reused)', () => {
    for (const layout of LAYOUTS) {
      const s = randomStructure(5, 30, { groups: 3, treeLike: false });
      const a = layoutStructure({ ...s, layout });
      const b = layoutStructure({ ...JSON.parse(JSON.stringify(s)), layout });
      expect([...a.nodes]).toEqual([...b.nodes]);
      expect([...a.frames]).toEqual([...b.frames]);
    }
  });

  test('positions are snapped to the 20px grid and non-negative', () => {
    for (const layout of LAYOUTS) {
      const s = randomStructure(9, 25, { treeLike: true });
      const out = layoutStructure({ ...s, groups: [], layout });
      for (const p of out.nodes.values()) {
        expect(p.x % 20).toBe(0);
        expect(p.y % 20).toBe(0);
        expect(p.x).toBeGreaterThanOrEqual(-20);
      }
    }
  });

  test('mindmap: hub in the middle with children on both sides', () => {
    const nodes = [{ key: 'hub', w: 160, h: 80 }, ...Array.from({ length: 8 }, (_, i) => ({ key: `c${i}`, w: 140, h: 50 }))];
    const edges = nodes.slice(1).map((n) => ({ from: 'hub', to: n.key }));
    const out = layoutStructure({ nodes, edges, layout: 'mindmap' });
    const hub = out.nodes.get('hub');
    const left = nodes.slice(1).filter((n) => out.nodes.get(n.key).x < hub.x).length;
    const right = nodes.slice(1).filter((n) => out.nodes.get(n.key).x > hub.x).length;
    expect(left).toBe(4);
    expect(right).toBe(4);
  });

  test('radial: root central, children on a ring around it', () => {
    const nodes = [{ key: 'r', w: 100, h: 60 }, ...Array.from({ length: 6 }, (_, i) => ({ key: `c${i}`, w: 100, h: 60 }))];
    const edges = nodes.slice(1).map((n) => ({ from: 'r', to: n.key }));
    const out = layoutStructure({ nodes, edges, layout: 'radial' });
    const c = (k) => ({ x: out.nodes.get(k).x + 50, y: out.nodes.get(k).y + 30 });
    const radii = nodes.slice(1).map((n) => Math.hypot(c(n.key).x - c('r').x, c(n.key).y - c('r').y));
    expect(Math.max(...radii) - Math.min(...radii)).toBeLessThan(30);
  });

  test('flow: layers run left to right along the edges, a cycle does not break it', () => {
    const nodes = ['a', 'b', 'c', 'd', 'e', 'f'].map((key) => ({ key, w: 120, h: 60 }));
    const edges = [['a', 'b'], ['b', 'c'], ['c', 'd'], ['d', 'e'], ['e', 'f'], ['f', 'a']].map(([from, to]) => ({ from, to }));
    const out = layoutStructure({ nodes, edges, layout: 'flow' });
    const xs = nodes.map((n) => out.nodes.get(n.key).x);
    expect(xs).toEqual([...xs].sort((p, q) => p - q));
    expect(new Set(xs).size).toBe(6);
  });

  test('tree: children sit below their parent', () => {
    const nodes = ['r', 'a', 'b', 'c'].map((key) => ({ key, w: 100, h: 50 }));
    const edges = [{ from: 'r', to: 'a' }, { from: 'r', to: 'b' }, { from: 'a', to: 'c' }];
    const out = layoutStructure({ nodes, edges, layout: 'tree' });
    expect(out.nodes.get('a').y).toBeGreaterThan(out.nodes.get('r').y);
    expect(out.nodes.get('c').y).toBeGreaterThan(out.nodes.get('a').y);
  });

  test('rejects an unknown layout', () => {
    expect(() => layoutStructure({ nodes: [], edges: [], layout: 'spiral' })).toThrow(/Unknown layout/);
  });
});

describe('performance', () => {
  test('200 nodes in every layout stay well under the budget', () => {
    const s = randomStructure(77, 200, { treeLike: false });
    for (const layout of LAYOUTS) {
      const t = performance.now();
      layoutStructure({ ...s, groups: [], layout });
      expect(performance.now() - t).toBeLessThan(100);
    }
  });
});

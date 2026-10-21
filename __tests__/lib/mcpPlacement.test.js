import { placeNewElements } from '../../lib/mcp/placement';

const el = (id, x, y, w = 120, h = 80, extra = {}) => ({ id, type: 'task', x, y, size: { width: w, height: h }, ...extra });
const fresh = (id, w = 120, h = 80, extra = {}) => ({ id, type: 'task', size: { width: w, height: h }, ...extra });
const conn = (s, t) => ({ id: `c-${s}-${t}`, sourceId: s, targetId: t });

function overlaps(a, b) {
  const sa = a.size; const sb = b.size;
  return a.x < b.x + sb.width && a.x + sa.width > b.x && a.y < b.y + sb.height && a.y + sa.height > b.y;
}
function anyOverlap(list) {
  for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) if (overlaps(list[i], list[j])) return [list[i].id, list[j].id];
  return null;
}

describe('placeNewElements', () => {
  test('empty canvas: new connected chain is laid out left to right from a positive origin', () => {
    const elements = [fresh('a'), fresh('b'), fresh('c')];
    const out = placeNewElements({ elements, connections: [conn('a', 'b'), conn('b', 'c')], newIds: ['a', 'b', 'c'] });
    const m = Object.fromEntries(out.map((e) => [e.id, e]));
    expect(m.a.x).toBeLessThan(m.b.x);
    expect(m.b.x).toBeLessThan(m.c.x);
    expect(anyOverlap(out)).toBeNull();
    out.forEach((e) => { expect(e.x).toBeGreaterThanOrEqual(0); expect(e.y).toBeGreaterThanOrEqual(0); });
  });

  test('places new elements to the right of existing content without moving existing ones', () => {
    const existing = [el('e1', 100, 100), el('e2', 400, 300)];
    const out = placeNewElements({ elements: [...existing, fresh('n1'), fresh('n2')], connections: [conn('n1', 'n2')], newIds: ['n1', 'n2'] });
    const m = Object.fromEntries(out.map((e) => [e.id, e]));
    expect(m.e1.x).toBe(100);
    expect(m.e2.y).toBe(300);
    const right = 400 + 120;
    expect(m.n1.x).toBeGreaterThanOrEqual(right);
    expect(anyOverlap(out)).toBeNull();
  });

  test('mixed sizes in one layer never overlap', () => {
    const elements = [fresh('r', 100, 40), fresh('a', 100, 200), fresh('b', 300, 40), fresh('c', 100, 120)];
    const conns = [conn('r', 'a'), conn('r', 'b'), conn('r', 'c')];
    const out = placeNewElements({ elements, connections: conns, newIds: ['r', 'a', 'b', 'c'] });
    expect(anyOverlap(out)).toBeNull();
  });

  test('direction TB stacks layers downwards', () => {
    const out = placeNewElements({ elements: [fresh('a'), fresh('b')], connections: [conn('a', 'b')], newIds: ['a', 'b'], direction: 'TB' });
    const m = Object.fromEntries(out.map((e) => [e.id, e]));
    expect(m.b.y).toBeGreaterThan(m.a.y);
  });

  test('elements with explicit coordinates are left alone and counted as occupied', () => {
    const pinned = { ...fresh('p'), x: 500, y: 500 };
    const out = placeNewElements({ elements: [pinned, fresh('n')], connections: [], newIds: ['p', 'n'] });
    const m = Object.fromEntries(out.map((e) => [e.id, e]));
    expect(m.p.x).toBe(500);
    expect(m.n.x).toBeGreaterThanOrEqual(620);
  });

  test('a child of a frame is placed inside the frame, clear of its siblings', () => {
    const frame = { id: 'f', type: 'frame', x: 0, y: 0, size: { width: 800, height: 600 } };
    const sib = el('s', 40, 40, 120, 80, { parentFrameId: 'f' });
    const out = placeNewElements({ elements: [frame, sib, fresh('n', 120, 80, { parentFrameId: 'f' })], connections: [], newIds: ['n'] });
    const n = out.find((e) => e.id === 'n');
    expect(n.x).toBeGreaterThanOrEqual(0);
    expect(n.y).toBeGreaterThanOrEqual(0);
    expect(n.x + 120).toBeLessThanOrEqual(800);
    expect(n.y + 80).toBeLessThanOrEqual(600);
    expect(overlaps(n, sib)).toBe(false);
  });

  test('a new frame with new children is sized around them', () => {
    const elements = [fresh('f', 0, 0, { type: 'frame', size: undefined }), fresh('a', 120, 80, { parentFrameId: 'f' }), fresh('b', 120, 80, { parentFrameId: 'f' })];
    const out = placeNewElements({ elements, connections: [conn('a', 'b')], newIds: ['f', 'a', 'b'] });
    const m = Object.fromEntries(out.map((e) => [e.id, e]));
    for (const k of ['a', 'b']) {
      expect(m[k].x).toBeGreaterThanOrEqual(m.f.x);
      expect(m[k].y).toBeGreaterThanOrEqual(m.f.y);
      expect(m[k].x + 120).toBeLessThanOrEqual(m.f.x + m.f.size.width);
      expect(m[k].y + 80).toBeLessThanOrEqual(m.f.y + m.f.size.height);
    }
  });

  test('200 unconnected new elements are all placed without overlap', () => {
    const elements = Array.from({ length: 200 }, (_, i) => fresh(`n${i}`));
    const out = placeNewElements({ elements, connections: [], newIds: elements.map((e) => e.id) });
    expect(anyOverlap(out)).toBeNull();
  });

  test('coordinates are snapped to the 20px grid and stay within canvas bounds', () => {
    const out = placeNewElements({ elements: [fresh('a'), fresh('b')], connections: [conn('a', 'b')], newIds: ['a', 'b'] });
    out.forEach((e) => { expect(e.x % 20).toBe(0); expect(e.y % 20).toBe(0); expect(e.x).toBeLessThan(99000); });
  });

  test('does not mutate the input array or objects', () => {
    const input = [fresh('a')];
    placeNewElements({ elements: input, connections: [], newIds: ['a'] });
    expect(input[0].x).toBeUndefined();
  });
});

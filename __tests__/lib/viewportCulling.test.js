import {
  visibleWorldRect, cullWorldRect, rectsIntersect, elementBox, cullElements, connectionBox, cullConnections, boxIndex,
  CULL_PAD,
} from '../../lib/render/viewportCulling';

const el = (id, x, y, w = 100, h = 50, extra = {}) => ({ id, x, y, size: { width: w, height: h }, ...extra });

describe('visibleWorldRect', () => {
  test('maps the container to world coordinates (screen = (world + viewport.xy) * scale)', () => {
    expect(visibleWorldRect({ x: -500, y: -200, scale: 2 }, { width: 1000, height: 600 })).toEqual({ x: 500, y: 200, width: 500, height: 300 });
  });
  test('is null while the container size is unknown', () => {
    expect(visibleWorldRect({ x: 0, y: 0, scale: 1 }, { width: 0, height: 0 })).toBeNull();
    expect(visibleWorldRect({ x: 0, y: 0, scale: 1 }, null)).toBeNull();
  });
});

describe('cullWorldRect', () => {
  const vis = { x: 1000, y: 500, width: 800, height: 600 };
  test('grows by the margin on every side and always contains the visible rectangle', () => {
    const r = cullWorldRect(vis);
    expect(r.x).toBeLessThanOrEqual(vis.x - vis.width);
    expect(r.x + r.width).toBeGreaterThanOrEqual(vis.x + 2 * vis.width);
    expect(r.y).toBeLessThanOrEqual(vis.y - vis.height);
    expect(r.y + r.height).toBeGreaterThanOrEqual(vis.y + 2 * vis.height);
  });
  test('snaps: a small pan returns the identical rectangle, a big pan a different one', () => {
    expect(cullWorldRect({ ...vis, x: vis.x + 30 })).toEqual(cullWorldRect({ ...vis, x: vis.x + 31 }));
    expect(cullWorldRect({ ...vis, x: vis.x + 3000 })).not.toEqual(cullWorldRect(vis));
  });
  test('null stays null', () => expect(cullWorldRect(null)).toBeNull());
});

describe('rectsIntersect', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  test('overlap, containment, edge touch (no intersection) and separation', () => {
    expect(rectsIntersect(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
    expect(rectsIntersect(a, { x: 2, y: 2, width: 1, height: 1 })).toBe(true);
    expect(rectsIntersect(a, { x: 10, y: 0, width: 5, height: 5 })).toBe(false);
    expect(rectsIntersect(a, { x: 50, y: 50, width: 5, height: 5 })).toBe(false);
  });
});

describe('elementBox', () => {
  test('uses size, falls back to the stencil default, then to 120x60', () => {
    expect(elementBox(el('a', 1, 2, 30, 40))).toEqual({ x: 1, y: 2, width: 30, height: 40 });
    expect(elementBox({ id: 'b', x: 0, y: 0 }, () => ({ width: 7, height: 8 }))).toEqual({ x: 0, y: 0, width: 7, height: 8 });
    expect(elementBox({ id: 'c', x: 0, y: 0 })).toEqual({ x: 0, y: 0, width: 120, height: 60 });
  });
  test('a rotated element gets the circle box around its centre (never smaller than the unrotated box)', () => {
    const b = elementBox(el('r', 100, 100, 200, 20, { rotation: 45 }));
    expect(b.x).toBeLessThan(100);
    expect(b.x + b.width).toBeGreaterThan(300);
    expect(b.width).toBeCloseTo(b.height);
  });
});

describe('cullElements', () => {
  const rect = { x: 0, y: 0, width: 1000, height: 1000 };
  const many = (n, make) => Array.from({ length: n }, (_, i) => make(i));
  const field = many(300, (i) => el(`e${i}`, (i % 30) * 400, Math.floor(i / 30) * 400));

  test('keeps what intersects the rectangle plus the pad, drops the rest, preserves z-order', () => {
    const out = cullElements(field, rect, { min: 0 });
    expect(out.length).toBeGreaterThan(0);
    expect(out.length).toBeLessThan(field.length);
    expect(out.map((e) => e.id)).toEqual(field.filter((e) => out.includes(e)).map((e) => e.id));
    expect(out.some((e) => e.id === 'e0')).toBe(true);
    expect(out.some((e) => e.id === 'e29')).toBe(false); // x = 11600
  });
  test('the pad keeps an element just outside the rectangle (external label / handles still draw)', () => {
    const near = el('near', 1000 + CULL_PAD - 5, 100);
    const far = el('far', 1000 + CULL_PAD + 5, 100);
    expect(cullElements([near, far], rect, { min: 0 }).map((e) => e.id)).toEqual(['near']);
  });
  test('keepIds are mounted wherever they are (selected, dragged, being edited)', () => {
    const out = cullElements(field, rect, { min: 0, keepIds: new Set(['e29']) });
    expect(out.some((e) => e.id === 'e29')).toBe(true);
  });
  test('several rectangles: an element in any of them is kept (viewport band + a held frame far away)', () => {
    const frameRect = { x: 11000, y: 0, width: 1000, height: 1000 };
    const out = cullElements(field, [rect, frameRect], { min: 0 });
    expect(out.some((e) => e.id === 'e0')).toBe(true);
    expect(out.some((e) => e.id === 'e28')).toBe(true); // x = 11200, inside the held frame
    expect(out.some((e) => e.id === 'e15')).toBe(false); // x = 6000, in neither
  });
  test('small boards and an unknown rectangle are never culled (same array back)', () => {
    const small = field.slice(0, 50);
    expect(cullElements(small, rect)).toBe(small);
    expect(cullElements(field, null)).toBe(field);
  });
});

describe('connections', () => {
  const rect = { x: 0, y: 0, width: 1000, height: 1000 };
  const left = el('L', -5000, 400);
  const right = el('R', 6000, 400);
  const farA = el('A', 5000, 5000);
  const farB = el('B', 6000, 6000);
  const boxes = boxIndex([left, right, farA, farB]);

  test('a connection whose endpoints are both off-screen but whose line crosses the viewport is kept', () => {
    const crossing = { id: 'x', sourceId: 'L', targetId: 'R' };
    expect(cullConnections([crossing], boxes, rect, { min: 0 })).toEqual([crossing]);
  });
  test('a connection entirely away from the viewport is dropped', () => {
    expect(cullConnections([{ id: 'y', sourceId: 'A', targetId: 'B' }], boxes, rect, { min: 0 })).toEqual([]);
  });
  test('waypoints widen the box; a waypoint inside the viewport keeps the connection', () => {
    const c = { id: 'w', sourceId: 'A', targetId: 'B', waypoints: [{ x: 500, y: 500 }] };
    expect(connectionBox(c, boxes).x).toBeLessThan(500);
    expect(cullConnections([c], boxes, rect, { min: 0 })).toEqual([c]);
  });
  test('keepIds keep connections of selected or edited elements and the connection itself', () => {
    const c = { id: 'k', sourceId: 'A', targetId: 'B' };
    expect(cullConnections([c], boxes, rect, { min: 0, keepIds: new Set(['A']) })).toEqual([c]);
    expect(cullConnections([c], boxes, rect, { min: 0, keepIds: new Set(['k']) })).toEqual([c]);
  });
  test('dangling connections are kept (they draw nothing); small boards are not culled', () => {
    const d = { id: 'd', sourceId: 'nope', targetId: 'gone' };
    expect(cullConnections([d], boxes, rect, { min: 0 })).toEqual([d]);
    const list = [{ id: 'y', sourceId: 'A', targetId: 'B' }];
    expect(cullConnections(list, boxes, rect, { total: 10 })).toBe(list);
  });
});

describe('overview (level of detail)', () => {
  const { shouldUseOverview, hitTestElements } = require('../../lib/render/viewportCulling');
  test('overview below the zoom threshold or above the node budget', () => {
    expect(shouldUseOverview(1, 100)).toBe(false);
    expect(shouldUseOverview(0.1, 10)).toBe(true);
    expect(shouldUseOverview(0.5, 801)).toBe(true);
  });
  test('hit test: topmost element wins, a frame only when nothing else is under the point', () => {
    const f = { id: 'f', type: 'frame', x: 0, y: 0, size: { width: 500, height: 500 } };
    const a = { id: 'a', x: 10, y: 10, size: { width: 100, height: 50 } };
    const b = { id: 'b', x: 50, y: 20, size: { width: 100, height: 50 } };
    expect(hitTestElements([f, a, b], 60, 30)?.id).toBe('b');
    expect(hitTestElements([f, a, b], 20, 20)?.id).toBe('a');
    expect(hitTestElements([f, a, b], 400, 400)?.id).toBe('f');
    expect(hitTestElements([a, b], 400, 400)).toBeNull();
  });
});

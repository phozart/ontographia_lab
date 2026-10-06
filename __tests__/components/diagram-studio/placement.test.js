import { findFreePlacement, placeAtPoint } from '../../../components/diagram-studio/hooks/interaction/placement';

const box = (x, y, w = 150, h = 150) => ({ id: `${x}-${y}`, x, y, size: { width: w, height: h } });
const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const rectOf = (e) => ({ x: e.x, y: e.y, w: e.size.width, h: e.size.height });

describe('placeAtPoint', () => {
  test('centers the item on the point and snaps to grid', () => {
    expect(placeAtPoint({ x: 300, y: 200 }, { width: 120, height: 80 }, 20)).toEqual({ x: 240, y: 160 });
    expect(placeAtPoint({ x: 305, y: 207 }, { width: 150, height: 150 }, 20)).toEqual({ x: 240, y: 140 });
  });
  test('works near the origin', () => {
    expect(placeAtPoint({ x: 100, y: 100 }, { width: 150, height: 150 }, 20)).toEqual({ x: 20, y: 20 });
  });
});

describe('findFreePlacement', () => {
  const size = { width: 150, height: 150 };
  test('empty canvas: centered on the target point', () => {
    expect(findFreePlacement({ center: { x: 500, y: 400 }, size, elements: [] })).toEqual({ x: 420, y: 320 });
  });
  test('moves off an occupied centre to a nearby free spot', () => {
    const elements = [box(420, 320)];
    const p = findFreePlacement({ center: { x: 500, y: 400 }, size, elements });
    expect(overlaps({ x: p.x, y: p.y, w: 150, h: 150 }, rectOf(elements[0]))).toBe(false);
    expect(Math.hypot(p.x - 420, p.y - 320)).toBeLessThan(260);
  });
  test('never overlaps any element, even in a dense field', () => {
    const elements = [];
    for (let i = -3; i <= 3; i++) for (let j = -3; j <= 3; j++) elements.push(box(420 + i * 170, 320 + j * 170));
    const p = findFreePlacement({ center: { x: 500, y: 400 }, size, elements });
    for (const e of elements) expect(overlaps({ x: p.x, y: p.y, w: 150, h: 150 }, rectOf(e))).toBe(false);
  });
  test('prefers a spot inside the viewport bounds', () => {
    const elements = [box(420, 320)];
    const bounds = { x: 0, y: 0, width: 1000, height: 800 };
    const p = findFreePlacement({ center: { x: 500, y: 400 }, size, elements, bounds });
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.x + 150).toBeLessThanOrEqual(1000);
    expect(p.y + 150).toBeLessThanOrEqual(800);
  });
  test('falls back outside the bounds when the viewport is full', () => {
    const bounds = { x: 0, y: 0, width: 200, height: 200 };
    const elements = [box(0, 0, 200, 200)];
    const p = findFreePlacement({ center: { x: 100, y: 100 }, size, elements, bounds });
    expect(overlaps({ x: p.x, y: p.y, w: 150, h: 150 }, rectOf(elements[0]))).toBe(false);
  });
  test('frames are backgrounds and do not block placement', () => {
    const frame = { ...box(0, 0, 2000, 2000), type: 'frame' };
    expect(findFreePlacement({ center: { x: 500, y: 400 }, size, elements: [frame] })).toEqual({ x: 420, y: 320 });
  });
  test('ignores elements without a size', () => {
    expect(findFreePlacement({ center: { x: 500, y: 400 }, size, elements: [{ id: 'a', x: 420, y: 320 }] })).toEqual({ x: 420, y: 320 });
  });
});

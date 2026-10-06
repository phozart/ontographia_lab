import { computeFit, visibleArea } from '../../../components/diagram-studio/viewportFit';

const toScreen = (vp, area, p) => ({
  x: (p.x + vp.x) * vp.scale,
  y: (p.y + vp.y) * vp.scale,
});

describe('computeFit', () => {
  it('fits all content inside the area with padding', () => {
    const bounds = { minX: 0, minY: 0, maxX: 2000, maxY: 1000 };
    const area = { left: 0, top: 0, width: 1000, height: 800 };
    const vp = computeFit(bounds, area, { padding: 80 });
    const tl = toScreen(vp, area, { x: 0, y: 0 });
    const br = toScreen(vp, area, { x: 2000, y: 1000 });
    expect(tl.x).toBeGreaterThanOrEqual(80 - 0.01);
    expect(br.x).toBeLessThanOrEqual(920 + 0.01);
    expect(tl.y).toBeGreaterThanOrEqual(80 - 0.01);
    expect(br.y).toBeLessThanOrEqual(720 + 0.01);
  });

  it('centers content in the visible area, honoring an area offset (left sidebar)', () => {
    const bounds = { minX: 100, minY: 100, maxX: 300, maxY: 200 };
    const area = { left: 72, top: 56, width: 900, height: 700 };
    const vp = computeFit(bounds, area, { padding: 80 });
    const a = toScreen(vp, area, { x: 100, y: 100 });
    const b = toScreen(vp, area, { x: 300, y: 200 });
    expect((a.x + b.x) / 2).toBeCloseTo(72 + 450, 3);
    expect((a.y + b.y) / 2).toBeCloseTo(56 + 350, 3);
  });

  it('can zoom out below 25% so large content is always fully visible', () => {
    const bounds = { minX: 0, minY: 0, maxX: 20000, maxY: 10000 };
    const area = { left: 0, top: 0, width: 1000, height: 800 };
    const vp = computeFit(bounds, area, { padding: 80 });
    expect(vp.scale).toBeLessThan(0.25);
    const br = toScreen(vp, area, { x: 20000, y: 10000 });
    expect(br.x).toBeLessThanOrEqual(920 + 0.01);
  });

  it('caps zoom-in at maxScale for tiny content', () => {
    const bounds = { minX: 0, minY: 0, maxX: 10, maxY: 10 };
    const vp = computeFit(bounds, { left: 0, top: 0, width: 1000, height: 800 }, { padding: 80 });
    expect(vp.scale).toBe(1);
  });

  it('is deterministic: same input gives same output (Fit button == F key)', () => {
    const bounds = { minX: 0, minY: 0, maxX: 800, maxY: 600 };
    const area = { left: 72, top: 56, width: 1300, height: 900 };
    expect(computeFit(bounds, area, { padding: 80 })).toEqual(computeFit(bounds, area, { padding: 80 }));
  });
});

describe('visibleArea', () => {
  it('subtracts edge-hugging panels from the container rect', () => {
    const container = { left: 0, top: 0, width: 1379, height: 985 };
    const obstacles = [
      { left: 0, top: 0, right: 1379, bottom: 56 },
      { left: 0, top: 56, right: 72, bottom: 985 },
      { left: 1079, top: 56, right: 1379, bottom: 985 },
    ];
    expect(visibleArea(container, obstacles)).toEqual({ left: 72, top: 56, width: 1007, height: 929 });
  });
});

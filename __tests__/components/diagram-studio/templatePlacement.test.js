import {
  getTemplateBounds,
  getContentBounds,
  computeTemplatePlacement,
  computeFitViewport,
} from '../../../components/diagram-studio/utils/templatePlacement';

const container = { width: 1000, height: 800 };
const pack = {
  frame: { x: 50, y: 50, width: 400, height: 200 },
  elements: [
    { x: 100, y: 100, size: { width: 100, height: 50 } },
    { x: 300, y: 120, size: { width: 100, height: 50 } },
  ],
};

const overlaps = (a, b) =>
  a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;

describe('getTemplateBounds', () => {
  it('unions the frame and the elements', () => {
    expect(getTemplateBounds(pack)).toEqual({ x: 50, y: 50, width: 400, height: 200 });
  });
  it('works without a frame', () => {
    expect(getTemplateBounds({ elements: pack.elements })).toEqual({ x: 100, y: 100, width: 300, height: 70 });
  });
});

describe('getContentBounds', () => {
  it('returns null for an empty canvas', () => {
    expect(getContentBounds([])).toBeNull();
  });
  it('covers every element, falling back to default sizes', () => {
    const b = getContentBounds([{ x: 10, y: 20, size: { width: 30, height: 40 } }, { x: 100, y: 5 }]);
    expect(b).toEqual({ x: 10, y: 5, width: 210, height: 60 });
  });
});

describe('computeTemplatePlacement', () => {
  const bounds = getTemplateBounds(pack);

  it('centres the template in the viewport on an empty canvas', () => {
    const viewport = { x: -2000, y: -3000, scale: 1 };
    const { dx, dy } = computeTemplatePlacement({ bounds, contentBounds: null, viewport, container });
    const placed = { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height };
    expect(placed.x + placed.width / 2).toBe(2000 + 500);
    expect(placed.y + placed.height / 2).toBe(3000 + 400);
  });

  it('centres relative to the viewport when zoomed', () => {
    const viewport = { x: -100, y: -100, scale: 0.5 };
    const { dx, dy } = computeTemplatePlacement({ bounds, contentBounds: null, viewport, container });
    expect(bounds.x + dx + bounds.width / 2).toBe(1000 / 2 / 0.5 + 100);
    expect(bounds.y + dy + bounds.height / 2).toBe(800 / 2 / 0.5 + 100);
  });

  it('places to the right of existing content with a gap and never overlaps it', () => {
    const contentBounds = { x: 50000, y: 50100, width: 600, height: 300 };
    const { dx, dy } = computeTemplatePlacement({ bounds, contentBounds, viewport: { x: 0, y: 0, scale: 1 }, container, gap: 80 });
    const placed = { x: bounds.x + dx, y: bounds.y + dy, width: bounds.width, height: bounds.height };
    expect(placed.x).toBe(50000 + 600 + 80);
    expect(placed.y).toBe(50100);
    expect(overlaps(placed, contentBounds)).toBe(false);
  });

  it('still places right of content that sits at the viewport edge', () => {
    const viewport = { x: -49000, y: -50000, scale: 1 }; // sees x 49000..50000
    const contentBounds = { x: 49800, y: 50000, width: 400, height: 100 }; // straddles right edge
    const { dx } = computeTemplatePlacement({ bounds, contentBounds, viewport, container });
    expect(bounds.x + dx).toBeGreaterThanOrEqual(contentBounds.x + contentBounds.width);
  });
});

describe('computeFitViewport', () => {
  it('centres the rect in the container at scale 1 when it fits', () => {
    const rect = { x: 2000, y: 3000, width: 400, height: 200 };
    const vp = computeFitViewport(rect, container, { padding: 60 });
    expect(vp.scale).toBe(1);
    expect((2200 + vp.x) * vp.scale).toBe(500);
    expect((3100 + vp.y) * vp.scale).toBe(400);
  });
  it('zooms out to fit a large rect', () => {
    const rect = { x: 0, y: 0, width: 4000, height: 1000 };
    const vp = computeFitViewport(rect, container, { padding: 0 });
    expect(vp.scale).toBeCloseTo(0.25);
    expect((2000 + vp.x) * vp.scale).toBeCloseTo(500);
  });
});

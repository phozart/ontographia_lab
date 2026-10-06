/**
 * @jest-environment jsdom
 */
import {
  computePlacement,
  usableBounds,
  unionRects,
} from '../../../components/diagram-studio/ui/positioning';

const VP = { width: 1379, height: 985 };
const LEFT_SIDEBAR = { left: 0, top: 56, right: 72, bottom: 985 };
const TITLE = { left: 0, top: 0, right: 1379, bottom: 56 };
const PROPS = { left: 1079, top: 56, right: 1379, bottom: 985 };

describe('usableBounds', () => {
  it('shrinks the viewport by edge-hugging obstacles plus margin', () => {
    const b = usableBounds(VP, [LEFT_SIDEBAR, TITLE], 8);
    expect(b).toEqual({ left: 80, top: 64, right: 1371, bottom: 977 });
  });

  it('shrinks from the right for a right panel', () => {
    const b = usableBounds(VP, [PROPS], 8);
    expect(b.right).toBe(1079 - 8);
  });

  it('ignores obstacles that sit in the middle of the viewport', () => {
    const mid = { left: 500, top: 400, right: 600, bottom: 500 };
    expect(usableBounds(VP, [mid], 8)).toEqual({ left: 8, top: 8, right: 1371, bottom: 977 });
  });
});

describe('computePlacement', () => {
  const size = { width: 400, height: 40 };

  it('places above the anchor, centered, when there is room', () => {
    const anchor = { left: 600, top: 400, width: 100, height: 60 };
    const r = computePlacement({ anchor, size, viewport: VP, obstacles: [] });
    expect(r.placement).toBe('top');
    expect(r.left).toBe(650 - 200);
    expect(r.top).toBe(400 - 8 - 40);
  });

  it('flips below when there is no room above', () => {
    const anchor = { left: 600, top: 20, width: 100, height: 60 };
    const r = computePlacement({ anchor, size, viewport: VP, obstacles: [TITLE] });
    expect(r.placement).toBe('bottom');
    expect(r.top).toBe(80 + 8);
  });

  it('flips above when preferred bottom has no room (context menu near bottom edge)', () => {
    const anchor = { left: 300, top: 960, width: 0, height: 0 };
    const r = computePlacement({
      anchor, size: { width: 200, height: 300 }, viewport: VP, obstacles: [], preferred: 'bottom', gap: 0, align: 'start',
    });
    expect(r.placement).toBe('top');
    expect(r.top + 300).toBeLessThanOrEqual(985 - 8);
    expect(r.top).toBeGreaterThanOrEqual(8);
  });

  it('clamps horizontally so a shape at the left edge does not slide under the sidebar', () => {
    const anchor = { left: 90, top: 400, width: 60, height: 60 };
    const r = computePlacement({ anchor, size, viewport: VP, obstacles: [LEFT_SIDEBAR] });
    expect(r.left).toBeGreaterThanOrEqual(72 + 8);
  });

  it('clamps horizontally at the right edge', () => {
    const anchor = { left: 1300, top: 400, width: 60, height: 60 };
    const r = computePlacement({ anchor, size, viewport: VP, obstacles: [] });
    expect(r.left + 400).toBeLessThanOrEqual(1379 - 8);
  });

  it('avoids the open properties panel on the right', () => {
    const anchor = { left: 1000, top: 400, width: 60, height: 60 };
    const r = computePlacement({ anchor, size, viewport: VP, obstacles: [PROPS] });
    expect(r.left + 400).toBeLessThanOrEqual(1079 - 8);
  });

  it('keeps an anchor that is behind an obstacle visible', () => {
    const anchor = { left: 20, top: 500, width: 40, height: 40 };
    const r = computePlacement({ anchor, size: { width: 200, height: 40 }, viewport: VP, obstacles: [LEFT_SIDEBAR] });
    expect(r.left).toBeGreaterThanOrEqual(80);
  });

  it('never leaves the usable bounds origin even if nothing fits', () => {
    const anchor = { left: 100, top: 100, width: 50, height: 50 };
    const r = computePlacement({
      anchor, size: { width: 5000, height: 5000 }, viewport: { width: 800, height: 600 }, obstacles: [],
    });
    expect(r.left).toBe(8);
    expect(r.top).toBe(8);
  });

  it('supports side placement for popovers', () => {
    const anchor = { left: 100, top: 200, width: 30, height: 30 };
    const r = computePlacement({
      anchor, size: { width: 200, height: 100 }, viewport: VP, obstacles: [], preferred: 'right', align: 'start',
    });
    expect(r.placement).toBe('right');
    expect(r.left).toBe(130 + 8);
  });
});

describe('unionRects', () => {
  it('returns the bounding box in {left, top, width, height}', () => {
    expect(unionRects([
      { left: 10, top: 10, width: 10, height: 10 },
      { left: 50, top: 5, width: 10, height: 10 },
    ])).toEqual({ left: 10, top: 5, width: 50, height: 15 });
  });
});

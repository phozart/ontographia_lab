import { getZIndexForOrder } from '../../../components/diagram-studio/hooks/interaction/zOrder';

const els = [{ id: 'a', zIndex: 0 }, { id: 'b' }, { id: 'c', zIndex: 3 }];

describe('getZIndexForOrder', () => {
  test('front goes above the current max', () => {
    expect(getZIndexForOrder(els, 'a', 'front')).toBe(4);
  });
  test('back goes below the current min', () => {
    expect(getZIndexForOrder(els, 'c', 'back')).toBe(-1);
  });
  test('already at extreme returns null (no-op)', () => {
    expect(getZIndexForOrder(els, 'c', 'front')).toBeNull();
    expect(getZIndexForOrder([{ id: 'a' }], 'a', 'back')).toBeNull();
  });
  test('unknown id returns null', () => {
    expect(getZIndexForOrder(els, 'zz', 'front')).toBeNull();
  });
});

describe('getZIndexForOrder with frames', () => {
  const frame = { id: 'f', type: 'frame', x: 0, y: 0, size: { width: 400, height: 300 }, zIndex: 2 };
  const child = { id: 'c', type: 'task', x: 50, y: 50, size: { width: 100, height: 50 }, zIndex: 5 };
  const outsideLow = { id: 'o1', type: 'task', x: 900, y: 900, size: { width: 100, height: 50 }, zIndex: 0 };
  const outsideHigh = { id: 'o2', type: 'task', x: 900, y: 900, size: { width: 100, height: 50 }, zIndex: 10 };

  test("send-to-back on a frame's child stays above the frame", () => {
    expect(getZIndexForOrder([frame, child, outsideLow], 'c', 'back')).toBe(3);
  });

  test('send-to-back on a child already directly above the frame is a no-op', () => {
    const c = { ...child, zIndex: 3 };
    expect(getZIndexForOrder([frame, c, outsideLow], 'c', 'back')).toBeNull();
  });

  test('send-to-back on a non-child is unchanged', () => {
    expect(getZIndexForOrder([frame, child, outsideLow, outsideHigh], 'o2', 'back')).toBe(-1);
  });

  test('bring-to-front on a frame stays below its children', () => {
    const z = getZIndexForOrder([frame, child, outsideHigh], 'f', 'front');
    expect(z).toBe(4);
    expect(z).toBeLessThan(child.zIndex);
  });

  test('bring-to-front on a frame with no children behaves normally', () => {
    expect(getZIndexForOrder([frame, outsideHigh], 'f', 'front')).toBe(11);
  });

  test('bring-to-front on a frame already just below its children is a no-op', () => {
    const f = { ...frame, zIndex: 4 };
    expect(getZIndexForOrder([f, child, outsideHigh], 'f', 'front')).toBeNull();
  });
});

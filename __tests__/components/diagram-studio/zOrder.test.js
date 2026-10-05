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

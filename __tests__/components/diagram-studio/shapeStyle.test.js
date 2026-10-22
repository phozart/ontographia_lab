// ADR-0007 P2: shape opacity keeps the fill colour (it used to wash every fill to white).
import { withAlpha } from '../../../components/diagram-studio/packs/colorUtils';

describe('withAlpha', () => {
  test('keeps the colour and sets the alpha', () => {
    expect(withAlpha('#4FB3CE', 0.4)).toBe('rgba(79, 179, 206, 0.4)');
    expect(withAlpha('rgb(1, 2, 3)', 0.5)).toBe('rgba(1, 2, 3, 0.5)');
  });
  test('clamps alpha and refuses unknown colours', () => {
    expect(withAlpha('#000000', 3)).toBe('rgba(0, 0, 0, 1)');
    expect(withAlpha('var(--x)', 0.5)).toBeNull();
    expect(withAlpha('#fff', NaN)).toBeNull();
  });
});

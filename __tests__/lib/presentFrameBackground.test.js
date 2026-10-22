/**
 * @jest-environment node
 */
import { frameBackground, themeFromPreset } from '../../lib/present/themes';

describe('frameBackground', () => {
  test('resolves a token through the theme, passes hex, defaults to white', () => {
    const dark = themeFromPreset('slate-dark');
    expect(frameBackground({ data: { backgroundColor: '@bg' } }, dark)).toBe('#18212b');
    expect(frameBackground({ data: { backgroundColor: '#123456' } }, dark)).toBe('#123456');
    expect(frameBackground({ data: {} }, dark)).toBe('#ffffff');
    expect(frameBackground({ data: { backgroundColor: 'transparent' } }, dark)).toBe('#ffffff');
    expect(frameBackground({ data: { backgroundColor: '@nope' } }, dark)).toBe('#ffffff');
    expect(frameBackground({ data: { backgroundColor: '@bg' } }, undefined)).toBe('#ffffff');
  });
});

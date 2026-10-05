import { isMac, formatShortcut } from '../../lib/platform';

describe('platform helpers', () => {
  test('isMac detects Apple platforms', () => {
    expect(isMac({ platform: 'MacIntel' })).toBe(true);
    expect(isMac({ userAgentData: { platform: 'macOS' }, platform: '' })).toBe(true);
    expect(isMac({ platform: 'iPhone' })).toBe(true);
  });

  test('isMac is false for Windows/Linux and when navigator is missing', () => {
    expect(isMac({ platform: 'Win32' })).toBe(false);
    expect(isMac({ userAgentData: { platform: 'Windows' }, platform: 'Win32' })).toBe(false);
    expect(isMac({ platform: 'Linux x86_64' })).toBe(false);
    expect(isMac(null)).toBe(false);
  });

  test('formatShortcut renders Mac glyphs', () => {
    expect(formatShortcut('Mod+S', true)).toBe('⌘S');
    expect(formatShortcut('Mod+Shift+Z', true)).toBe('⌘⇧Z');
    expect(formatShortcut('Mod+Alt+K', true)).toBe('⌘⌥K');
  });

  test('formatShortcut renders Ctrl+ on other platforms', () => {
    expect(formatShortcut('Mod+S', false)).toBe('Ctrl+S');
    expect(formatShortcut('Mod+Shift+Z', false)).toBe('Ctrl+Shift+Z');
    expect(formatShortcut('Mod+Alt+K', false)).toBe('Ctrl+Alt+K');
  });
});

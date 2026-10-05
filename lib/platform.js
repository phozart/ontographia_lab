// lib/platform.js
// Tiny platform helpers so keyboard-shortcut labels match the user's OS.

/** True on macOS / iOS. Safe to call during SSR (returns false). */
export function isMac(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false;
  const platform = nav.userAgentData?.platform || nav.platform || '';
  return /mac|iphone|ipad|ipod/i.test(platform);
}

const MAC_GLYPHS = { Mod: '⌘', Shift: '⇧', Alt: '⌥', Ctrl: '⌃' };
const OTHER_NAMES = { Mod: 'Ctrl' };

/**
 * 'Mod+S' -> '⌘S' on Mac, 'Ctrl+S' elsewhere. 'Mod' is Cmd on Mac and Ctrl elsewhere.
 */
export function formatShortcut(combo, mac = isMac()) {
  const parts = combo.split('+');
  if (mac) return parts.map((p) => MAC_GLYPHS[p] || p).join('');
  return parts.map((p) => OTHER_NAMES[p] || p).join('+');
}

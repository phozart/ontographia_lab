// components/diagram-studio/hooks/interaction/editorShortcuts.js
// Pure resolver for editor-level shortcuts (undo/redo, tool switching, zoom).

import { isTypingTarget } from './keyboardFocus';
export { isTypingTarget };

/**
 * Map a keyboard event to an editor action name, or null.
 * Returns: 'undo' | 'redo' | 'tool-select' | 'tool-pan' | 'zoom-in' | 'zoom-out' | null
 */
export function resolveEditorShortcut(e) {
  if (!e || isTypingTarget(e.target)) return null;
  const key = (e.key || '').toLowerCase();
  const mod = e.ctrlKey || e.metaKey;

  if (mod) {
    if (e.altKey) return null;
    if (key === 'z') return e.shiftKey ? 'redo' : 'undo';
    if (key === 'y' && !e.shiftKey) return 'redo';
    return null;
  }
  if (e.altKey) return null;
  if (e.shiftKey && (key === 'v' || key === 'h')) return null;
  if (key === 'v') return 'tool-select';
  if (key === 'h') return 'tool-pan';
  if (e.key === '+' || e.key === '=') return 'zoom-in';
  if (e.key === '-' || e.key === '_') return 'zoom-out';
  return null;
}

/**
 * F = fit to screen, Shift+F = toggle focus mode. One key, one thing each.
 * Returns 'fit' | 'focus-mode' | null.
 */
export function resolveFKey(e) {
  if (!e || (e.key || '').toLowerCase() !== 'f') return null;
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  return e.shiftKey ? 'focus-mode' : 'fit';
}

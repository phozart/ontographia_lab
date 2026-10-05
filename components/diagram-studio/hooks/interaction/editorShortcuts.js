// components/diagram-studio/hooks/interaction/editorShortcuts.js
// Pure resolver for editor-level shortcuts (undo/redo, tool switching, zoom).

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || !!target.isContentEditable;
}

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

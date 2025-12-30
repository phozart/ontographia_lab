// components/diagram-studio/hooks/interaction/useKeyboardShortcuts.js
// Keyboard shortcut handling with declarative configuration

import { useRef, useCallback, useEffect } from 'react';

/**
 * Shortcut definition interface:
 * {
 *   key: string | string[],        // Key(s) that trigger this shortcut
 *   ctrl?: boolean,                // Require Ctrl/Cmd modifier
 *   shift?: boolean,               // Require Shift modifier
 *   alt?: boolean,                 // Require Alt modifier
 *   action: (event) => void,       // Handler function
 *   preventDefault?: boolean,      // Call e.preventDefault() (default: true)
 *   when?: () => boolean,          // Condition function (returns false to skip)
 *   repeat?: boolean,              // Allow key repeat (default: false)
 *   ignoreInputs?: boolean,        // Ignore when focused on inputs (default: true)
 * }
 */

/**
 * Hook for declarative keyboard shortcut handling.
 *
 * @param {Array<Object>} shortcuts - Array of shortcut definitions
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether shortcuts are enabled
 * @param {Function} options.onKeyDown - Additional keydown handler
 * @param {Function} options.onKeyUp - Additional keyup handler
 * @param {HTMLElement} options.target - Target element (default: window)
 * @returns {Object} - { activeModifiers }
 */
export function useKeyboardShortcuts(shortcuts, options = {}) {
  const {
    enabled = true,
    onKeyDown,
    onKeyUp,
    target,
  } = options;

  const shortcutsRef = useRef(shortcuts);
  const activeModifiersRef = useRef(new Set());

  // Update shortcuts ref when shortcuts change
  useEffect(() => {
    shortcutsRef.current = shortcuts;
  }, [shortcuts]);

  /**
   * Check if a shortcut matches the current event
   */
  const matchesShortcut = useCallback((shortcut, event) => {
    // Check key match
    const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
    const keyMatches = keys.some(k => k.toLowerCase() === event.key.toLowerCase());
    if (!keyMatches) return false;

    // Check modifiers
    const ctrlKey = event.ctrlKey || event.metaKey;
    if (shortcut.ctrl && !ctrlKey) return false;
    if (!shortcut.ctrl && ctrlKey && !shortcut.allowWithMod) return false;

    if (shortcut.shift && !event.shiftKey) return false;
    if (shortcut.shift === false && event.shiftKey) return false;

    if (shortcut.alt && !event.altKey) return false;
    if (shortcut.alt === false && event.altKey) return false;

    // Check repeat
    if (event.repeat && !shortcut.repeat) return false;

    // Check when condition
    if (shortcut.when && !shortcut.when()) return false;

    return true;
  }, []);

  /**
   * Check if focused on an input element
   */
  const isInputFocused = useCallback(() => {
    const activeEl = document.activeElement;
    if (!activeEl) return false;

    const tagName = activeEl.tagName;
    if (tagName === 'INPUT' || tagName === 'TEXTAREA') return true;
    if (activeEl.isContentEditable) return true;

    return false;
  }, []);

  const handleKeyDown = useCallback((event) => {
    if (!enabled) return;

    // Track active modifiers
    if (event.key === 'Control' || event.key === 'Meta') {
      activeModifiersRef.current.add('ctrl');
    }
    if (event.key === 'Shift') {
      activeModifiersRef.current.add('shift');
    }
    if (event.key === 'Alt') {
      activeModifiersRef.current.add('alt');
    }

    // Call additional handler first
    onKeyDown?.(event);

    // Find and execute matching shortcuts
    for (const shortcut of shortcutsRef.current) {
      // Skip if in input and ignoreInputs is true (default)
      const ignoreInputs = shortcut.ignoreInputs !== false;
      if (ignoreInputs && isInputFocused()) continue;

      if (matchesShortcut(shortcut, event)) {
        const shouldPrevent = shortcut.preventDefault !== false;
        if (shouldPrevent) {
          event.preventDefault();
        }

        shortcut.action(event);

        // Only execute first matching shortcut
        break;
      }
    }
  }, [enabled, onKeyDown, matchesShortcut, isInputFocused]);

  const handleKeyUp = useCallback((event) => {
    // Track active modifiers
    if (event.key === 'Control' || event.key === 'Meta') {
      activeModifiersRef.current.delete('ctrl');
    }
    if (event.key === 'Shift') {
      activeModifiersRef.current.delete('shift');
    }
    if (event.key === 'Alt') {
      activeModifiersRef.current.delete('alt');
    }

    if (!enabled) return;

    onKeyUp?.(event);
  }, [enabled, onKeyUp]);

  useEffect(() => {
    const targetEl = target || window;

    targetEl.addEventListener('keydown', handleKeyDown);
    targetEl.addEventListener('keyup', handleKeyUp);

    return () => {
      targetEl.removeEventListener('keydown', handleKeyDown);
      targetEl.removeEventListener('keyup', handleKeyUp);
    };
  }, [target, handleKeyDown, handleKeyUp]);

  return {
    activeModifiers: activeModifiersRef.current,
    isModifierPressed: (modifier) => activeModifiersRef.current.has(modifier),
  };
}

/**
 * Creates a standard shortcut definition with common defaults
 */
export function createShortcut(key, action, options = {}) {
  return {
    key,
    action,
    preventDefault: true,
    ignoreInputs: true,
    repeat: false,
    ...options,
  };
}

/**
 * Common shortcut helpers
 */
export const ShortcutHelpers = {
  /**
   * Create a Ctrl/Cmd + key shortcut
   */
  ctrlKey: (key, action, options = {}) => createShortcut(key, action, { ctrl: true, ...options }),

  /**
   * Create a Ctrl/Cmd + Shift + key shortcut
   */
  ctrlShiftKey: (key, action, options = {}) => createShortcut(key, action, { ctrl: true, shift: true, ...options }),

  /**
   * Create a plain key shortcut (no modifiers)
   */
  plainKey: (key, action, options = {}) => createShortcut(key, action, { ctrl: false, shift: false, alt: false, ...options }),

  /**
   * Create an arrow key shortcut with shift variant
   */
  arrowKey: (direction, action, options = {}) => ({
    key: `Arrow${direction}`,
    action,
    preventDefault: true,
    ignoreInputs: true,
    ...options,
  }),
};

/**
 * Standard diagram shortcuts that can be composed with actions
 */
export function createDiagramShortcuts(actions) {
  const shortcuts = [];

  // Clipboard
  if (actions.copy) {
    shortcuts.push(ShortcutHelpers.ctrlKey('c', actions.copy, { when: actions.canCopy }));
  }
  if (actions.paste) {
    shortcuts.push(ShortcutHelpers.ctrlKey('v', actions.paste, { when: actions.canPaste }));
  }
  if (actions.duplicate) {
    shortcuts.push(ShortcutHelpers.ctrlKey('d', actions.duplicate, { when: actions.canDuplicate }));
  }

  // Selection
  if (actions.selectAll) {
    shortcuts.push(ShortcutHelpers.ctrlKey('a', actions.selectAll));
  }

  // Delete
  if (actions.delete) {
    shortcuts.push(createShortcut(['Delete', 'Backspace'], actions.delete, { when: actions.canDelete }));
  }

  // Undo/Redo
  if (actions.undo) {
    shortcuts.push(ShortcutHelpers.ctrlKey('z', actions.undo));
  }
  if (actions.redo) {
    shortcuts.push(ShortcutHelpers.ctrlKey('y', actions.redo));
    shortcuts.push(ShortcutHelpers.ctrlShiftKey('z', actions.redo));
  }

  // Grouping
  if (actions.group) {
    shortcuts.push(ShortcutHelpers.ctrlKey('g', actions.group, { when: actions.canGroup }));
  }
  if (actions.ungroup) {
    shortcuts.push(ShortcutHelpers.ctrlShiftKey('g', actions.ungroup, { when: actions.canUngroup }));
  }

  // View
  if (actions.fitToView) {
    shortcuts.push(createShortcut(['f', 'F'], actions.fitToView));
    shortcuts.push(createShortcut(['0', 'Home'], actions.fitToView, { ctrl: false }));
  }
  if (actions.zoomToSelection) {
    shortcuts.push(ShortcutHelpers.ctrlKey('0', actions.zoomToSelection));
  }
  if (actions.resetZoom) {
    shortcuts.push(createShortcut(['1'], actions.resetZoom, { ctrl: true }));
  }

  // Escape
  if (actions.escape) {
    shortcuts.push(createShortcut('Escape', actions.escape, { ignoreInputs: false }));
  }

  // Arrow key nudging
  if (actions.nudge) {
    const nudgeShortcut = (direction, dx, dy) => ({
      key: `Arrow${direction}`,
      action: (e) => actions.nudge(e.shiftKey ? dx * 2 : dx, e.shiftKey ? dy * 2 : dy),
      preventDefault: true,
      ignoreInputs: true,
      allowWithMod: true, // Allow with shift for larger nudge
    });
    shortcuts.push(nudgeShortcut('Left', -1, 0));
    shortcuts.push(nudgeShortcut('Right', 1, 0));
    shortcuts.push(nudgeShortcut('Up', 0, -1));
    shortcuts.push(nudgeShortcut('Down', 0, 1));
  }

  // Text formatting
  if (actions.toggleBold) {
    shortcuts.push(ShortcutHelpers.ctrlKey('b', actions.toggleBold, { shift: false }));
  }
  if (actions.toggleItalic) {
    shortcuts.push(ShortcutHelpers.ctrlKey('i', actions.toggleItalic, { shift: false }));
  }
  if (actions.toggleUnderline) {
    shortcuts.push(ShortcutHelpers.ctrlKey('u', actions.toggleUnderline, { shift: false }));
  }

  return shortcuts;
}

export default useKeyboardShortcuts;

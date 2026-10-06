// components/diagram-studio/hooks/interaction/keyboardFocus.js
// The single focus rule for every key handler:
//   single-key (unmodified) shortcuts fire only when focus is on the canvas/body
//   and no editor is active. A caret in any text field, an on-canvas editor, a
//   dialog/modal or the command palette suspends them.

const OVERLAY_SELECTOR = '[role="dialog"], [aria-modal="true"], [data-suspend-shortcuts]';

export function isTypingTarget(target) {
  if (!target) return false;
  const tag = target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return true;
  return typeof target.getAttribute === 'function' && target.getAttribute('role') === 'textbox';
}

export function isInsideOverlay(target) {
  if (!target || typeof target.closest !== 'function') return false;
  return !!target.closest(OVERLAY_SELECTOR);
}

/** True when a modal dialog is open anywhere in the document. */
export function isOverlayOpen(doc = typeof document !== 'undefined' ? document : null) {
  return !!doc?.querySelector?.(OVERLAY_SELECTOR);
}

const ACTIVATION_KEYS = new Set(['Enter', ' ', 'Tab']);

function isActivationTarget(target) {
  const tag = target?.tagName;
  return tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
}

/**
 * @param {KeyboardEvent} event
 * @param {{ activeElement?: Element|null, editorActive?: boolean, overlayOpen?: boolean }} [focusState]
 * @returns {boolean} whether a global/canvas shortcut handler may act on this event
 */
export function shouldHandleShortcut(event, focusState = {}) {
  if (!event) return false;
  const { activeElement = null, editorActive = false, overlayOpen = false } = focusState;
  if (event.isComposing) return false;
  if (editorActive) return false;
  if (isTypingTarget(event.target) || isTypingTarget(activeElement)) return false;

  const modified = event.ctrlKey || event.metaKey || event.altKey;
  if (modified) return true; // Cmd/Ctrl shortcuts keep working with a dialog open; typing is already excluded

  // Single-key: also suspended inside/over dialogs and for keys that activate a focused control.
  if (overlayOpen || isInsideOverlay(event.target) || isInsideOverlay(activeElement)) return false;
  if (ACTIVATION_KEYS.has(event.key) && (isActivationTarget(event.target) || isActivationTarget(activeElement))) return false;
  return true;
}

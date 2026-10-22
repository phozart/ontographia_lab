// components/diagram-studio/present/presentKeys.js
// The keyboard contract of present mode (ADR-0007 5.3) as a pure function, so it is unit-tested without a browser.
//   Next: ArrowRight ArrowDown Space PageDown Enter     Previous: ArrowLeft ArrowUp PageUp Backspace
//   Home / End: first / last     digits then Enter: go to that slide     B: black screen     F: full screen
//   N: notes (presenter)     Esc: leave
// Enter and Backspace work on the typed slide number first, when there is one.

/**
 * @param {string} key KeyboardEvent.key
 * @param {string} buffer digits typed so far
 * @returns {{type: string, digit?: string, n?: number}|null}
 */
export function actionForKey(key, buffer = '') {
  if (/^[0-9]$/.test(key)) return { type: 'digit', digit: key };
  switch (key) {
    case 'ArrowRight':
    case 'ArrowDown':
    case ' ':
    case 'Spacebar':
    case 'PageDown':
      return { type: 'next' };
    case 'Enter':
      return buffer ? { type: 'goto', n: Number(buffer) } : { type: 'next' };
    case 'ArrowLeft':
    case 'ArrowUp':
    case 'PageUp':
      return { type: 'prev' };
    case 'Backspace':
      return buffer ? { type: 'digit-back' } : { type: 'prev' };
    case 'Home':
      return { type: 'first' };
    case 'End':
      return { type: 'last' };
    case 'Escape':
      return { type: 'exit' };
    case 'b':
    case 'B':
      return { type: 'black' };
    case 'f':
    case 'F':
      return { type: 'fullscreen' };
    case 'n':
    case 'N':
      return { type: 'notes' };
    default:
      return null;
  }
}

/** Click or tap position to an action: the left third goes back, the right third goes next, the middle does nothing. */
export function actionForClick(clientX, width) {
  if (!(width > 0)) return null;
  const r = clientX / width;
  if (r < 1 / 3) return { type: 'prev' };
  if (r > 2 / 3) return { type: 'next' };
  return null;
}

/** Horizontal swipe: a drag of at least `min` px left means next, right means previous. */
export function actionForSwipe(dx, dy, min = 50) {
  if (Math.abs(dx) < min || Math.abs(dx) < Math.abs(dy) * 1.5) return null;
  return dx < 0 ? { type: 'next' } : { type: 'prev' };
}

/** Apply a navigation action to a 0-based index over `count` playable slides. */
export function moveIndex(index, action, count) {
  if (count <= 0) return 0;
  const clamp = (i) => Math.min(Math.max(0, i), count - 1);
  switch (action.type) {
    case 'next': return clamp(index + 1);
    case 'prev': return clamp(index - 1);
    case 'first': return 0;
    case 'last': return count - 1;
    case 'goto': return clamp(action.n - 1);
    default: return index;
  }
}

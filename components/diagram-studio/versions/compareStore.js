// components/diagram-studio/versions/compareStore.js
// Tiny module-level store linking the History panel (which computes a compare) to the canvas overlay and the
// canvas "reveal" handler (both mounted by DiagramStudio). Pure view state: nothing here touches diagram content
// and nothing is persisted, so a compare can never create a version or mark the diagram dirty.
//
// state: null | { from: {number, title}, to: 'head', changes: EntityChange[], summary }

import { useSyncExternalStore } from 'react';

let state = null;
const listeners = new Set();
const revealListeners = new Set();

export function getCompare() {
  return state;
}

/** Show (object) or dismiss (null) the overlay. */
export function setCompare(next) {
  if (next === state) return;
  state = next || null;
  listeners.forEach((l) => l());
}

export function subscribeCompare(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useCompare() {
  return useSyncExternalStore(subscribeCompare, getCompare, () => null);
}

/** Ask the canvas to select/zoom to one change: `change` is an EntityChange from the diff. */
export function requestReveal(change) {
  revealListeners.forEach((l) => l(change));
}

export function onReveal(cb) {
  revealListeners.add(cb);
  return () => revealListeners.delete(cb);
}

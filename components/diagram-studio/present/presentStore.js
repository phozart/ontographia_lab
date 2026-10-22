// components/diagram-studio/present/presentStore.js
// Tiny module-level view-state store shared by the Presentation panel, the frame toolbar and the present host
// (same pattern as versions/compareStore.js). Pure UI state: nothing here is saved with the diagram.
//
// state: { panelOpen, activeId (the deck the panel shows and "Add to presentation" targets),
//          presenting: null | { presentationId, index } }

import { useSyncExternalStore } from 'react';

export const OPEN_PRESENTATIONS_EVENT = 'ds:open-presentations';
export const START_PRESENTATION_EVENT = 'ds:start-presentation';

const INITIAL = Object.freeze({ panelOpen: false, activeId: null, presenting: null });
let state = INITIAL;
const listeners = new Set();

export const getPresentState = () => state;

export function setPresentState(patch) {
  const next = { ...state, ...patch };
  if (next.panelOpen === state.panelOpen && next.activeId === state.activeId && next.presenting === state.presenting) return;
  state = next;
  listeners.forEach((l) => l());
}

export function resetPresentState() {
  state = INITIAL;
  listeners.forEach((l) => l());
}

export function subscribePresent(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function usePresentState() {
  return useSyncExternalStore(subscribePresent, getPresentState, () => INITIAL);
}

/** Start presenting a deck at a 0-based index among its playable slides. */
export const startPresenting = (presentationId, index = 0) => setPresentState({ presenting: { presentationId, index } });
export const stopPresenting = () => setPresentState({ presenting: null });
export const openPresentationPanel = (activeId) => setPresentState({ panelOpen: true, ...(activeId ? { activeId } : {}) });
export const closePresentationPanel = () => setPresentState({ panelOpen: false });

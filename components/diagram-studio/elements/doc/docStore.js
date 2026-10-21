// components/diagram-studio/elements/doc/docStore.js
// Tiny external store for the doc side panel (AI-5): which doc is open, and how an element link is followed.
// A store (not React context) because the card lives inside the canvas tree and the panel in the studio shell;
// both must agree without touching DiagramContext. One editor per page, so a module singleton is enough.

import { useSyncExternalStore } from 'react';

let openId = null;
let followHandler = null;
const listeners = new Set();

const emit = () => listeners.forEach((l) => l());
const subscribe = (l) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export const openDoc = (id) => {
  const next = typeof id === 'string' ? id : null;
  if (openId === next) return;
  openId = next;
  emit();
};
export const closeDoc = () => openDoc(null);
export const getOpenDocId = () => openId;
export const useOpenDocId = () => useSyncExternalStore(subscribe, getOpenDocId, () => null);

/** The studio registers how `#el=<id>` is followed (select + zoom). Returns an unregister function. */
export function registerElementLinkHandler(fn) {
  followHandler = fn;
  return () => {
    if (followHandler === fn) followHandler = null;
  };
}
export const followElementLink = (id) => {
  if (typeof followHandler === 'function') followHandler(id);
};

/** Tests only. */
export function resetDocStore() {
  openId = null;
  followHandler = null;
  emit();
}

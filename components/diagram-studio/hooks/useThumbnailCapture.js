// components/diagram-studio/hooks/useThumbnailCapture.js
// After an EDIT (never on open), render a small PNG preview from the board's content and store it via the normal PUT
// path as the diagram's `thumbnail` for the dashboard cards. WHEN is decided by lib/thumbnail's scheduler (baseline on
// open, pre-render after a short quiet period, debounced + idle PUT after an edit-save, throttled, flushed when the user
// leaves); HOW is renderThumbnailPng (SVG from content, no DOM cloning). Failures are silent (the dashboard falls back
// to the logo).

import { useEffect, useRef } from 'react';
import { createThumbnailScheduler, isValidThumbnail } from '../../../lib/thumbnail';

export function useThumbnailCapture({ diagramId, lastSaved, elements, connections, theme, readOnly = false }) {
  const latestRef = useRef({ elements, connections, theme });
  latestRef.current = { elements, connections, theme };
  const mountedRef = useRef(true);
  const schedulerRef = useRef(null);
  const preparedRef = useRef(null); // { id, dataUrl }: pre-rendered after the last edit-save, dropped by the next one

  if (!schedulerRef.current) {
    const render = async () => {
      const { elements: els, connections: conns, theme: th } = latestRef.current;
      if (!els?.length) return null;
      const { renderThumbnailPng } = await import('../export/thumbnailRenderer');
      const dataUrl = await renderThumbnailPng({ elements: els, connections: conns, theme: th });
      return isValidThumbnail(dataUrl) ? dataUrl : null;
    };
    const send = (id, dataUrl, flush) => {
      const body = JSON.stringify({ thumbnail: dataUrl });
      return fetch(`/api/diagrams/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body,
        // a flush may run while the page is going away; keepalive requests are capped at 64 KB
        ...(flush && body.length < 60000 ? { keepalive: true } : {}),
      });
    };
    schedulerRef.current = createThumbnailScheduler({
      prepare: async (id) => {
        try {
          const dataUrl = await render();
          if (dataUrl && mountedRef.current) preparedRef.current = { id, dataUrl };
        } catch { /* best effort */ }
      },
      capture: (id, opts = {}) => {
        // (not async: with a prepared image the request is sent synchronously, which is what a page that is closing needs)
        const ready = preparedRef.current && preparedRef.current.id === id ? preparedRef.current.dataUrl : null;
        if (ready) return send(id, ready, opts.flush).catch(() => {});
        return (async () => {
          try {
            const dataUrl = await render();
            if ((!opts.flush && !mountedRef.current) || !dataUrl) return;
            await send(id, dataUrl, opts.flush);
          } catch {
            // Best effort only
          }
        })();
      },
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    const scheduler = schedulerRef.current;
    // load the renderer chunk while the browser is idle, so a pre-render after the first edit is not waiting for the network
    const preload = () => { import('../export/thumbnailRenderer').catch(() => {}); };
    const idleHandle = typeof requestIdleCallback === 'function' ? requestIdleCallback(preload, { timeout: 5000 }) : setTimeout(preload, 2000);
    // leaving the board (route change, tab hidden, page closing) must not lose a thumbnail that is still pending
    const onHide = () => { if (document.visibilityState === 'hidden') scheduler.flush(); };
    const onPageHide = () => scheduler.flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      if (typeof cancelIdleCallback === 'function' && typeof requestIdleCallback === 'function') cancelIdleCallback(idleHandle); else clearTimeout(idleHandle);
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      scheduler.flush();
      mountedRef.current = false;
      scheduler.cancel();
    };
  }, []);

  useEffect(() => {
    if (!diagramId || !lastSaved || readOnly) return;
    preparedRef.current = null; // the content changed: a pre-rendered image is stale
    schedulerRef.current.observe(diagramId, lastSaved);
  }, [diagramId, lastSaved, readOnly]);
}

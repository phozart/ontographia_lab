// components/diagram-studio/hooks/useThumbnailCapture.js
// After an EDIT (never on open), render a small PNG preview from the board's content and store it via the normal PUT
// path as the diagram's `thumbnail` for the dashboard cards. WHEN is decided by lib/thumbnail's scheduler (baseline on
// open, debounced + idle after an edit-save, throttled); HOW is renderThumbnailPng (SVG from content, no DOM cloning).
// Failures are silent (the dashboard falls back to the logo).

import { useEffect, useRef } from 'react';
import { createThumbnailScheduler, isValidThumbnail } from '../../../lib/thumbnail';

export function useThumbnailCapture({ diagramId, lastSaved, elements, connections, theme, readOnly = false }) {
  const latestRef = useRef({ elements, connections, theme });
  latestRef.current = { elements, connections, theme };
  const mountedRef = useRef(true);
  const schedulerRef = useRef(null);

  if (!schedulerRef.current) {
    schedulerRef.current = createThumbnailScheduler({
      capture: async (id, opts = {}) => {
        try {
          const { elements: els, connections: conns, theme: th } = latestRef.current;
          if ((!opts.flush && !mountedRef.current) || !els?.length) return;
          const { renderThumbnailPng } = await import('../export/thumbnailRenderer');
          const dataUrl = await renderThumbnailPng({ elements: els, connections: conns, theme: th });
          if ((!opts.flush && !mountedRef.current) || !isValidThumbnail(dataUrl)) return;
          const body = JSON.stringify({ thumbnail: dataUrl });
          await fetch(`/api/diagrams/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body,
            // a flush may run while the page is going away; keepalive requests are capped at 64 KB
            ...(opts.flush && body.length < 60000 ? { keepalive: true } : {}),
          });
        } catch {
          // Best effort only
        }
      },
    });
  }

  useEffect(() => {
    mountedRef.current = true;
    const scheduler = schedulerRef.current;
    // leaving the board (route change, tab hidden, page closing) must not lose a thumbnail that is still pending
    const onHide = () => { if (document.visibilityState === 'hidden') scheduler.flush(); };
    const onPageHide = () => scheduler.flush();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onPageHide);
      scheduler.flush();
      mountedRef.current = false;
      scheduler.cancel();
    };
  }, []);

  useEffect(() => {
    if (!diagramId || !lastSaved || readOnly) return;
    schedulerRef.current.observe(diagramId, lastSaved);
  }, [diagramId, lastSaved, readOnly]);
}

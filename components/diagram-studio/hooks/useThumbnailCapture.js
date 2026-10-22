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
      capture: async (id) => {
        try {
          const { elements: els, connections: conns, theme: th } = latestRef.current;
          if (!mountedRef.current || !els?.length) return;
          const { renderThumbnailPng } = await import('../export/thumbnailRenderer');
          const dataUrl = await renderThumbnailPng({ elements: els, connections: conns, theme: th });
          if (!mountedRef.current || !isValidThumbnail(dataUrl)) return;
          await fetch(`/api/diagrams/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ thumbnail: dataUrl }),
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
    return () => { mountedRef.current = false; scheduler.cancel(); };
  }, []);

  useEffect(() => {
    if (!diagramId || !lastSaved || readOnly) return;
    schedulerRef.current.observe(diagramId, lastSaved);
  }, [diagramId, lastSaved, readOnly]);
}

// components/diagram-studio/hooks/useThumbnailCapture.js
// After a save, render a small PNG preview of the live canvas (lazy-loaded export capture) and
// store it via the normal PUT path as the diagram's `thumbnail` for the dashboard cards.
// Throttled to once per THUMBNAIL_INTERVAL_MS; failures are silent (the dashboard falls back to the logo).

import { useEffect, useRef } from 'react';
import { isValidThumbnail, shouldCaptureThumbnail, THUMBNAIL_WIDTH } from '../../../lib/thumbnail';

export function useThumbnailCapture({ diagramId, lastSaved, elements, connections, readOnly = false }) {
  const lastCapturedRef = useRef(new Map()); // diagramId -> ms timestamp
  const latestRef = useRef({ elements, connections });
  latestRef.current = { elements, connections };
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (!diagramId || !lastSaved || readOnly) return undefined;
    if (!latestRef.current.elements?.length) return undefined;
    if (!shouldCaptureThumbnail(lastCapturedRef.current.get(diagramId))) return undefined;

    // Claim the slot immediately so overlapping saves cannot start a second capture
    lastCapturedRef.current.set(diagramId, Date.now());

    (async () => {
      try {
        const { renderPreview, nextFrames } = await import('../export/exportRenderer');
        await nextFrames(2);
        if (!mountedRef.current) return;
        const { elements: els, connections: conns } = latestRef.current;
        // renderPreview renders at 2x of maxSide, so THUMBNAIL_WIDTH / 2 yields a <= 320px PNG
        const { dataUrl } = await renderPreview(
          { scope: 'canvas', elements: els, connections: conns, background: 'white' },
          THUMBNAIL_WIDTH / 2
        );
        if (!mountedRef.current || !isValidThumbnail(dataUrl)) return;
        await fetch(`/api/diagrams/${diagramId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ thumbnail: dataUrl }),
        });
      } catch {
        // Best effort only
      }
    })();

    return undefined;
  }, [diagramId, lastSaved, readOnly]);
}

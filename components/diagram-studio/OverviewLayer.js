// components/diagram-studio/OverviewLayer.js
// Level of detail for very large or zoomed-out views: instead of mounting thousands of nodes (60k DOM nodes at 5,000
// elements after "fit all"), the board is drawn as ONE static image from lib/render/diagramSvg (cached until the content
// changes). Clicks are hit-tested by geometry and select the element; when the user zooms in (or pans to a smaller
// area) the canvas hands over to normal node mounting. Selection outlines are drawn here as overlays.

import { useEffect, useMemo, useRef, useState } from 'react';
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { hitTestElements } from '../../lib/render/viewportCulling';

export default function OverviewLayer({ elements, connections, theme, viewport, canvasRef, selectedIds, sizeOf, onSelect }) {
  const drawing = useMemo(
    () => renderDiagramSvg({ elements, connections, theme }, { maxElements: 5000, maxConnections: 10000, maxBytes: Infinity }),
    [elements, connections, theme]
  );
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!drawing.svg) { setUrl(null); return undefined; }
    const u = URL.createObjectURL(new Blob([drawing.svg], { type: 'image/svg+xml' }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [drawing]);

  const downRef = useRef(null);
  const vb = drawing.viewBox;
  const byId = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);
  const outlines = selectedIds.length > 100 ? selectedIds.slice(0, 500).map((id) => byId.get(id)).filter(Boolean) : [];

  const worldPoint = (e) => {
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r) return null;
    return { x: (e.clientX - r.left) / viewport.scale - viewport.x, y: (e.clientY - r.top) / viewport.scale - viewport.y };
  };

  return (
    <>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid="board-overview"
          alt=""
          src={url}
          draggable={false}
          style={{ position: 'absolute', left: vb.x, top: vb.y, width: vb.width, height: vb.height, zIndex: 3, userSelect: 'none', maxWidth: 'none' }}
          onMouseDown={(e) => { downRef.current = { x: e.clientX, y: e.clientY }; }}
          onClick={(e) => {
            const d = downRef.current;
            if (d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 4) return; // a drag (pan / marquee), not a click
            const p = worldPoint(e);
            if (!p) return;
            const hit = hitTestElements(elements, p.x, p.y, sizeOf);
            if (hit) onSelect(hit.id, e.shiftKey);
          }}
        />
      )}
      {outlines.map((el) => {
        const s = el.size || sizeOf(el) || { width: 120, height: 60 };
        return (
          <div
            key={el.id}
            style={{ position: 'absolute', left: el.x, top: el.y, width: s.width, height: s.height, zIndex: 4, pointerEvents: 'none', boxSizing: 'border-box', border: `${Math.max(1, 2 / (viewport.scale || 1))}px solid var(--selection, #4FB3CE)` }}
          />
        );
      })}
    </>
  );
}

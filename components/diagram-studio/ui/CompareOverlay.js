// components/diagram-studio/ui/CompareOverlay.js
// Read-only canvas highlight for a version compare (slice 8): added = green, changed = amber, removed = red
// ghost outline at the OLD position. Same screen-space convention as the comment markers:
// screen = (canvas + viewport.offset) * scale, relative to the canvas container. Every layer has
// pointer-events: none so the canvas underneath behaves exactly as before; only the legend chip is interactive.
// It never writes diagram state: dismissing just clears the compare store.

import { useMemo } from 'react';

export const COMPARE_COLORS = Object.freeze({ added: '#2e9e5b', changed: '#e0a30b', removed: '#d64545' });

const centerOf = (el) => ({ x: el.x + (el.size?.width ?? el.width ?? 100) / 2, y: el.y + (el.size?.height ?? el.height ?? 60) / 2 });

export default function CompareOverlay({ compare, elements, connections, viewport, onDismiss }) {
  const live = useMemo(() => new Map((elements || []).map((e) => [e.id, e])), [elements]);
  const liveConnections = useMemo(() => new Map((connections || []).map((c) => [c.id, c])), [connections]);
  if (!compare || !viewport) return null;
  const { x: vx, y: vy, scale } = viewport;
  const sx = (x) => (x + vx) * scale;
  const sy = (y) => (y + vy) * scale;

  const boxes = [];
  const lines = [];
  for (const ch of compare.changes) {
    if (ch.kind === 'element') {
      // Added/changed: where the element is now (live, so unsaved moves line up); removed: the old box from the diff.
      const el = ch.change === 'removed' ? null : live.get(ch.id);
      const b = el
        ? { x: el.x, y: el.y, width: el.size?.width ?? el.width ?? 100, height: el.size?.height ?? el.height ?? 60 }
        : ch.bounds;
      if (b) boxes.push({ ch, b });
    } else if (ch.kind === 'connection' && ch.change !== 'removed') {
      const c = liveConnections.get(ch.id);
      const a = c && live.get(c.sourceId);
      const z = c && live.get(c.targetId);
      if (a && z) {
        const pts = [centerOf(a), ...(Array.isArray(c.waypoints) ? c.waypoints.filter((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y)) : []), centerOf(z)];
        lines.push({ ch, pts });
      }
    }
  }

  const { added = 0, changed = 0, removed = 0 } = compare.summary || {};
  return (
    <>
      <div data-compare-overlay style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 40 }}>
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'visible' }} aria-hidden="true">
          {lines.map(({ ch, pts }) => (
            <polyline
              key={`${ch.kind}:${ch.id}`}
              data-compare-id={ch.id}
              data-compare-change={ch.change}
              points={pts.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke={COMPARE_COLORS[ch.change]}
              strokeWidth={4}
              strokeLinecap="round"
              strokeOpacity={0.7}
            />
          ))}
        </svg>
        {boxes.map(({ ch, b }) => (
          <div
            key={`${ch.kind}:${ch.id}`}
            data-compare-id={ch.id}
            data-compare-change={ch.change}
            title={`${ch.change}: ${ch.label || ch.id}`}
            style={{
              position: 'absolute',
              left: `${sx(b.x)}px`,
              top: `${sy(b.y)}px`,
              width: `${b.width * scale}px`,
              height: `${b.height * scale}px`,
              boxSizing: 'border-box',
              borderRadius: 6,
              pointerEvents: 'none',
              border: `2px ${ch.change === 'removed' ? 'dashed' : 'solid'} ${COMPARE_COLORS[ch.change]}`,
              background: ch.change === 'removed' ? 'rgba(214, 69, 69, 0.08)' : ch.change === 'added' ? 'rgba(46, 158, 91, 0.12)' : 'rgba(224, 163, 11, 0.14)',
              boxShadow: ch.change === 'removed' ? 'none' : `0 0 0 3px ${COMPARE_COLORS[ch.change]}33`,
              opacity: ch.change === 'removed' ? 0.85 : 1,
            }}
          />
        ))}
      </div>
      <div
        role="status"
        data-compare-legend
        style={{
          position: 'absolute', left: '50%', bottom: 16, transform: 'translateX(-50%)', zIndex: 41, pointerEvents: 'auto',
          display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 999, fontSize: 12.5,
          background: 'var(--surface, #fff)', color: 'var(--text, #1f2937)', border: '1px solid var(--border, #e5e7eb)',
          boxShadow: '0 4px 16px rgba(0,0,0,0.14)', whiteSpace: 'nowrap',
        }}
      >
        <span>Comparing <strong>{compare.from?.title || `#${compare.from?.number}`}</strong> with current</span>
        <span style={{ color: COMPARE_COLORS.added }}>{added} added</span>
        <span style={{ color: COMPARE_COLORS.changed }}>{changed} changed</span>
        <span style={{ color: COMPARE_COLORS.removed }}>{removed} removed</span>
        <button
          type="button"
          onClick={onDismiss}
          style={{ border: '1px solid var(--border, #d1d5db)', background: 'transparent', color: 'inherit', borderRadius: 999, padding: '3px 10px', font: 'inherit', cursor: 'pointer' }}
        >
          Dismiss
        </button>
      </div>
    </>
  );
}

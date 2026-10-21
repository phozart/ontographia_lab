// components/diagram-studio/ui/RemoteHighlight.js
// LA-1 change highlight (ADR-0006 section 5.2): fading rings (and dashed ghosts for removed shapes) over what
// another writer just changed, an edge chip for changes outside the viewport, and the lifecycle hook that times them.
// Cyan for people, lavender for agents. Pure CSS animation (no React re-render per frame); reduced motion gets a
// static ring held for 3 s. Rings are decoration: aria-hidden, never intercept the pointer.

import { useCallback, useEffect, useState } from 'react';
import { RING_FADE_MS, REDUCED_HOLD_MS, CHIP_LIFETIME_MS } from '../live/remoteHighlight';

const PAD = 4; // canvas px of air between a shape and its ring
const ARROWS = { n: '↑', ne: '↗', e: '→', se: '↘', s: '↓', sw: '↙', w: '←', nw: '↖' };

export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    try { return !!(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches); } catch (_) { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia?.('(prefers-reduced-motion: reduce)'); } catch (_) { mq = null; }
    if (!mq?.addEventListener) return undefined;
    const on = () => setReduced(!!mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * Timing of one highlight. Rings show for the fade (or the 3 s static hold); the edge chip lives CHIP_LIFETIME_MS;
 * then `onExpire` clears the highlight. `replay()` restarts the rings (the chip's click does, after panning).
 * @returns {{reduced: boolean, ringsOn: boolean, chipOn: boolean, replay: () => void, replayCount: number}}
 */
export function useHighlightLifecycle(highlight, enabled, onExpire) {
  const reduced = usePrefersReducedMotion();
  const [replayCount, setReplayCount] = useState(0);
  const [ringsOn, setRingsOn] = useState(!!highlight && enabled);
  const key = highlight?.key;
  const active = !!highlight && enabled;

  useEffect(() => {
    if (!active) { setRingsOn(false); return undefined; }
    setRingsOn(true);
    const t = setTimeout(() => setRingsOn(false), reduced ? REDUCED_HOLD_MS : RING_FADE_MS + 100);
    return () => clearTimeout(t);
  }, [key, active, reduced, replayCount]);

  useEffect(() => {
    if (!highlight || !onExpire) return undefined;
    const t = setTimeout(onExpire, CHIP_LIFETIME_MS);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  const replay = useCallback(() => setReplayCount((n) => n + 1), []);
  return { reduced, ringsOn: active && ringsOn, chipOn: active, replay, replayCount };
}

/** Rings and ghosts, in canvas coordinates: render inside the scaled canvas layer. */
export function RemoteHighlightLayer({ highlight, scale = 1, reduced = false, replayCount = 0 }) {
  if (!highlight) return null;
  const stroke = 2 / (scale || 1); // constant 2 px on screen at any zoom
  const motion = reduced ? 'reduced' : 'fade';
  const motionClass = reduced ? 'ds-remote-static' : 'ds-remote-fade';
  return (
    <div
      aria-hidden="true"
      data-testid="remote-highlight-layer"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 900 }}
    >
      {highlight.items.map((item) => {
        const common = {
          'data-testid': 'remote-ring',
          'data-kind': item.kind,
          'data-agent': highlight.agent ? 'true' : 'false',
          'data-motion': motion,
        };
        if (item.kind === 'connection') {
          const r = item.rect;
          const pad = 8;
          return (
            <svg
              key={`${highlight.key}:${replayCount}:${item.id}`}
              {...common}
              className={`ds-remote-line ${motionClass}`}
              width={Math.max(r.w, 1) + pad * 2}
              height={Math.max(r.h, 1) + pad * 2}
              style={{ position: 'absolute', left: r.x - pad, top: r.y - pad, overflow: 'visible', '--hl-color': highlight.color }}
            >
              <polyline
                points={item.points.map((p) => `${p.x - r.x + pad},${p.y - r.y + pad}`).join(' ')}
                fill="none"
                stroke={highlight.color}
                strokeWidth={stroke * 2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          );
        }
        const ghost = item.kind === 'ghost';
        const r = item.rect;
        return (
          <div
            key={`${highlight.key}:${replayCount}:${item.id}`}
            {...common}
            className={`${ghost ? 'ds-remote-ghost' : 'ds-remote-ring'} ${motionClass}`}
            style={{
              position: 'absolute',
              left: r.x - PAD,
              top: r.y - PAD,
              width: r.w + PAD * 2,
              height: r.h + PAD * 2,
              boxSizing: 'border-box',
              borderRadius: 10,
              borderStyle: ghost ? 'dashed' : 'solid',
              borderWidth: stroke,
              borderColor: highlight.color,
              '--hl-color': highlight.color,
            }}
          />
        );
      })}
    </div>
  );
}

const CHIP_POS = {
  n: { top: 12, left: '50%', transform: 'translateX(-50%)' },
  s: { bottom: 44, left: '50%', transform: 'translateX(-50%)' },
  e: { right: 12, top: '50%', transform: 'translateY(-50%)' },
  w: { left: 12, top: '50%', transform: 'translateY(-50%)' },
  ne: { top: 12, right: 12 },
  nw: { top: 12, left: 12 },
  se: { bottom: 44, right: 12 },
  sw: { bottom: 44, left: 12 },
};

/** "4 changes ↗" at the viewport edge nearest the off-screen changes; click pans there. */
export function RemoteHighlightChip({ summary, agent = false, onReveal }) {
  if (!summary) return null;
  const n = summary.count;
  const label = `${n} change${n === 1 ? '' : 's'} ${ARROWS[summary.direction] || ''}`;
  const color = agent ? '#9A8AC8' : '#4FB3CE';
  return (
    <button
      type="button"
      data-testid="remote-chip"
      data-direction={summary.direction}
      aria-label={`Pan to ${n} change${n === 1 ? '' : 's'} outside the view`}
      onClick={() => onReveal?.(summary.bbox)}
      style={{
        position: 'absolute',
        zIndex: 1500,
        ...(CHIP_POS[summary.direction] || CHIP_POS.n),
        padding: '5px 10px',
        borderRadius: 999,
        border: `1.5px solid ${color}`,
        background: 'var(--surface, #ffffff)',
        color: 'var(--text, #1f2937)',
        font: '600 12px/1 system-ui, sans-serif',
        cursor: 'pointer',
        boxShadow: '0 2px 10px rgba(0,0,0,.14)',
      }}
    >
      {label}
    </button>
  );
}

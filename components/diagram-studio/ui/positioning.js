/**
 * Collision-aware positioning for floating UI (toolbars, popovers, context menus).
 *
 * Pure geometry (computePlacement / usableBounds / unionRects) plus a thin DOM layer
 * (getObstacleRects, useFloatingPlacement) so floating elements can be measured after
 * mount and flipped/clamped before the first paint.
 *
 * Rect shapes:
 *   anchor / size  -> { left, top, width, height } / { width, height }
 *   obstacles      -> { left, top, right, bottom }  (viewport coordinates)
 */
import { useLayoutEffect, useState, useCallback } from 'react';

export const DEFAULT_MARGIN = 8;
export const DEFAULT_GAP = 8;
export const FLOATING_LAYOUT_EVENT = 'ds:floating-layout';

// CSS selectors of persistent chrome that floating UI must stay clear of.
export const OBSTACLE_SELECTORS = ['.ds-title-bar', '.ds-shape-sidebar', '.ds-panel-right'];

const EDGE_TOLERANCE = 16;

/**
 * Shrink the viewport by edge-hugging obstacles (bars and side panels) plus a margin.
 * Obstacles floating in the middle of the viewport are ignored.
 */
export function usableBounds(viewport, obstacles = [], margin = DEFAULT_MARGIN) {
  let left = 0;
  let top = 0;
  let right = viewport.width;
  let bottom = viewport.height;
  obstacles.forEach((o) => {
    const w = o.right - o.left;
    const h = o.bottom - o.top;
    if (w <= 0 || h <= 0) return;
    if (w >= viewport.width * 0.6 && h < viewport.height * 0.5) {
      // Horizontal bar
      if (o.top <= EDGE_TOLERANCE) top = Math.max(top, o.bottom);
      else if (o.bottom >= viewport.height - EDGE_TOLERANCE) bottom = Math.min(bottom, o.top);
    } else if (h > w) {
      // Vertical panel
      if (o.left <= EDGE_TOLERANCE) left = Math.max(left, o.right);
      else if (o.right >= viewport.width - EDGE_TOLERANCE) right = Math.min(right, o.left);
    }
  });
  return { left: left + margin, top: top + margin, right: right - margin, bottom: bottom - margin };
}

export function unionRects(rects) {
  const list = rects.filter(Boolean);
  if (list.length === 0) return null;
  const left = Math.min(...list.map((r) => r.left));
  const top = Math.min(...list.map((r) => r.top));
  const right = Math.max(...list.map((r) => r.left + r.width));
  const bottom = Math.max(...list.map((r) => r.top + r.height));
  return { left, top, width: right - left, height: bottom - top };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(v, hi));
const OPPOSITE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

function candidateOrder(preferred) {
  const horizontal = preferred === 'left' || preferred === 'right';
  const cross = horizontal ? ['bottom', 'top'] : ['right', 'left'];
  return [preferred, OPPOSITE[preferred], ...cross];
}

function overlaps(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

/**
 * Place a floating box of `size` next to `anchor`, flipping to the opposite side when the
 * preferred side lacks room and clamping into the usable bounds.
 *
 * `avoid` are non-edge rects (e.g. another floating toolbar) the box must not overlap.
 * Returns { left, top, placement, bounds } in viewport coordinates.
 */
export function computePlacement({
  anchor,
  size,
  viewport,
  obstacles = [],
  avoid = [],
  preferred = 'top',
  gap = DEFAULT_GAP,
  margin = DEFAULT_MARGIN,
  align = 'center',
}) {
  const bounds = usableBounds(viewport, obstacles, margin);
  const { width: w, height: h } = size;
  const aRight = anchor.left + anchor.width;
  const aBottom = anchor.top + anchor.height;

  const build = (side) => {
    let left;
    let top;
    if (side === 'top' || side === 'bottom') {
      top = side === 'top' ? anchor.top - gap - h : aBottom + gap;
      left = align === 'start' ? anchor.left : align === 'end' ? aRight - w : anchor.left + anchor.width / 2 - w / 2;
    } else {
      left = side === 'left' ? anchor.left - gap - w : aRight + gap;
      top = align === 'start' ? anchor.top : align === 'end' ? aBottom - h : anchor.top + anchor.height / 2 - h / 2;
    }
    // Step clear of avoided rects along the main axis.
    avoid.forEach((a) => {
      const box = { left, top, right: left + w, bottom: top + h };
      if (!overlaps(box, a)) return;
      if (side === 'top') top = a.top - gap - h;
      else if (side === 'bottom') top = a.bottom + gap;
      else if (side === 'left') left = a.left - gap - w;
      else left = a.right + gap;
    });
    return { left, top };
  };

  const fits = (side, p) => (
    side === 'top' || side === 'bottom'
      ? p.top >= bounds.top && p.top + h <= bounds.bottom
      : p.left >= bounds.left && p.left + w <= bounds.right
  );

  let chosen = null;
  const order = candidateOrder(preferred);
  for (const side of order) {
    const p = build(side);
    if (fits(side, p)) { chosen = { side, ...p }; break; }
  }
  if (!chosen) {
    // Nothing fits: take the preferred side or whichever overflows least.
    const overflow = (side, p) => (
      side === 'top' || side === 'bottom'
        ? Math.max(0, bounds.top - p.top) + Math.max(0, p.top + h - bounds.bottom)
        : Math.max(0, bounds.left - p.left) + Math.max(0, p.left + w - bounds.right)
    );
    chosen = order
      .map((side) => ({ side, ...build(side) }))
      .reduce((best, c) => (overflow(c.side, c) < overflow(best.side, best) ? c : best));
  }

  // Clamp both axes; the start edge wins when the box is larger than the bounds.
  const left = Math.max(bounds.left, Math.min(chosen.left, bounds.right - w));
  const top = Math.max(bounds.top, Math.min(chosen.top, bounds.bottom - h));
  return { left, top, placement: chosen.side, bounds };
}

// ---------------------------------------------------------------------------
// DOM layer
// ---------------------------------------------------------------------------

export function getViewportSize() {
  return { width: window.innerWidth, height: window.innerHeight };
}

/** Visible persistent chrome (title bar, left sidebar, open right panel) as rects. */
export function getObstacleRects() {
  if (typeof document === 'undefined') return [];
  return OBSTACLE_SELECTORS.flatMap((sel) => Array.from(document.querySelectorAll(sel)))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
}

/** Rects of other floating elements to stack against, by selector. */
export function getAvoidRects(selectors = []) {
  if (typeof document === 'undefined') return [];
  return selectors.flatMap((sel) => Array.from(document.querySelectorAll(sel)))
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0)
    .map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
}

export function rectToAnchor(r) {
  return r ? { left: r.left, top: r.top, width: r.width, height: r.height } : null;
}

/**
 * Measure `ref` after mount (before paint) and compute its placement.
 * `getAnchor` returns an anchor rect in viewport coordinates (or null to hide).
 * Re-runs when `deps` change, on window resize, and when another floating element
 * announces a layout change (so stacked elements settle in order).
 * Returns { left, top, placement, maxHeight, maxWidth, ready }.
 */
export function useFloatingPlacement(ref, getAnchor, options = {}, deps = []) {
  const [state, setState] = useState({ left: 0, top: 0, placement: options.preferred || 'top', ready: false });
  const [tick, setTick] = useState(0);

  useLayoutEffect(() => {
    const onChange = () => setTick((t) => t + 1);
    window.addEventListener('resize', onChange);
    window.addEventListener(FLOATING_LAYOUT_EVENT, onChange);
    return () => {
      window.removeEventListener('resize', onChange);
      window.removeEventListener(FLOATING_LAYOUT_EVENT, onChange);
    };
  }, []);

  const measure = useCallback(() => {
    const el = ref.current;
    const anchor = getAnchor();
    if (!el || !anchor) return;
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    const viewport = getViewportSize();
    const r = computePlacement({
      anchor,
      size,
      viewport,
      obstacles: getObstacleRects(),
      avoid: getAvoidRects(options.avoidSelectors),
      preferred: options.preferred,
      align: options.align,
      gap: options.gap,
    });
    setState((prev) => {
      if (prev.ready && prev.left === r.left && prev.top === r.top && prev.placement === r.placement) return prev;
      return {
        left: r.left,
        top: r.top,
        placement: r.placement,
        maxWidth: r.bounds.right - r.bounds.left,
        maxHeight: r.bounds.bottom - r.bounds.top,
        ready: true,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, ...deps, tick]);

  useLayoutEffect(() => {
    measure();
  }, [measure]);

  // Let stacked floating elements re-measure once this one has moved.
  useLayoutEffect(() => {
    if (state.ready) window.dispatchEvent(new Event(FLOATING_LAYOUT_EVENT));
  }, [state.left, state.top, state.ready]);

  return state;
}

/**
 * Imperatively place a popover element (child of a trigger wrapper) with position: fixed.
 * Used for the many popovers in the contextual toolbar.
 */
export function placePopoverElement(el, { preferred = 'bottom', align = 'center' } = {}) {
  const trigger = el.parentElement;
  if (!trigger) return;
  const anchor = rectToAnchor(trigger.getBoundingClientRect());
  const r = computePlacement({
    anchor,
    size: { width: el.offsetWidth, height: el.offsetHeight },
    viewport: getViewportSize(),
    obstacles: getObstacleRects(),
    preferred,
    align,
  });
  el.style.position = 'fixed';
  el.style.left = `${r.left}px`;
  el.style.top = `${r.top}px`;
  el.style.right = 'auto';
  el.style.bottom = 'auto';
  el.style.transform = 'none';
  el.style.margin = '0';
  el.style.maxWidth = `${r.bounds.right - r.bounds.left}px`;
  el.style.maxHeight = `${r.bounds.bottom - r.bounds.top}px`;
  el.style.overflowY = 'auto';
  el.dataset.placement = r.placement;
}

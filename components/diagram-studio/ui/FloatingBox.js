/**
 * Fixed-position wrapper that places its children against an anchor rect using the shared
 * positioning helper (flip + clamp against the viewport and side panels).
 * `avoidSelectors` stack the box clear of other floating elements (e.g. the style toolbar).
 */
import { useRef } from 'react';
import { useFloatingPlacement } from './positioning';

export default function FloatingBox({
  anchor,
  preferred = 'top',
  align = 'center',
  avoidSelectors,
  gap,
  zIndex = 200,
  className,
  children,
}) {
  const ref = useRef(null);
  const placement = useFloatingPlacement(
    ref,
    () => anchor,
    { preferred, align, avoidSelectors, gap },
    [anchor?.left, anchor?.top, anchor?.width, anchor?.height],
  );
  return (
    <div
      ref={ref}
      className={className}
      data-placement={placement.placement}
      style={{
        position: 'fixed',
        left: placement.left,
        top: placement.top,
        zIndex,
        maxWidth: placement.maxWidth,
        maxHeight: placement.maxHeight,
        overflowY: 'auto',
        visibility: placement.ready ? 'visible' : 'hidden',
      }}
    >
      {children}
    </div>
  );
}

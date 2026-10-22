// components/diagram-studio/text/SvgTextBlock.js
// The SVG twin of TextBlock (ADR-0008 8): text that lives inside an <svg> (connection labels) is drawn as one <text> with a
// <tspan> per pre-broken line of the shared layout, so it cannot re-flow. A clamped layout ends in an ellipsis and carries the
// full text as a <title> (SVG has no badge or popover). `x`, `y` are the top-left corner of the text box.

import { memo } from 'react';

function SvgTextBlockImpl({ layout, x, y, fill, className, opacity, testId = 'label' }) {
  if (!layout || !layout.lines.length) return null;
  const { lines, fontSize, weight, overflow } = layout;
  return (
    <text
      className={className ? `ds-svg-text ${className}` : 'ds-svg-text'}
      fill={fill}
      fontSize={fontSize}
      fontWeight={weight}
      opacity={opacity}
      data-text-block={testId}
      data-font-size={fontSize}
      data-overflow={overflow ? 'true' : undefined}
    >
      {overflow ? <title>{layout.text}</title> : null}
      {lines.map((l, i) => {
        const rtl = l.dir === 'rtl';
        // text-anchor start is the RIGHT edge of a right-to-left run: pin it at the right end of the measured line
        return (
          <tspan key={i} x={x + (rtl ? l.x + l.width : l.x)} y={y + l.y} direction={rtl ? 'rtl' : undefined} unicodeBidi={rtl ? 'plaintext' : undefined}>
            {l.text}
          </tspan>
        );
      })}
    </text>
  );
}

const SvgTextBlock = memo(SvgTextBlockImpl);
export default SvgTextBlock;
export { SvgTextBlock };

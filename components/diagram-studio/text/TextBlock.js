// components/diagram-studio/text/TextBlock.js
// The one way node text is drawn (ADR-0008 3.1 "drawing rule"): every line of a TextLayout is an absolutely positioned
// `white-space: pre` span, so the browser has nothing left to wrap and an export of the DOM cannot drift from the
// canvas. Overflow is never silent: a clamped layout gets a badge (an accent chip) whose title is the full text.
// Memoized on the layout object (layouts are cached and frozen), so panning and zooming re-render nothing.
//
// Cost: a 5,000-element board draws thousands of these, so the per-line markup is minimal. The font, color, line height
// and alignment live once on the block; the line spans carry only their `top` (and `dir` for right-to-left lines); the
// static rules are in styles/diagram-studio.css (.ds-text, .ds-text-line, .ds-text-badge).

import { memo } from 'react';

const ALIGN = { start: 'start', center: 'center', end: 'end' };

function TextBlockImpl({ layout, box, color, fontFamily, fontStyle, textDecoration, offsetX = 0, offsetY = 0, rotate, pill, className, testId }) {
  if (!layout || !box) return null;
  const { lines, lineHeight, fontSize, weight, overflow } = layout;
  const style = {
    left: box.x + offsetX,
    top: box.y + offsetY,
    width: box.width,
    height: box.height,
    fontSize,
    fontWeight: weight,
    lineHeight: `${lineHeight}px`,
    textAlign: ALIGN[layout.align] || 'center',
    '--ds-lh': `${lineHeight}px`,
  };
  if (color) style.color = color;
  if (fontFamily) style.fontFamily = fontFamily;
  if (fontStyle && fontStyle !== 'normal') style.fontStyle = fontStyle;
  if (textDecoration && textDecoration !== 'none') style.textDecoration = textDecoration;
  if (rotate) {
    style.transform = `rotate(${rotate}deg)`;
    style.transformOrigin = 'center center';
  }
  return (
    <div className={`ds-text ${className || ''}`.trim()} style={style} data-text-block={testId || 'label'} data-lines={lines.length} data-font-size={fontSize} data-overflow={overflow ? 'true' : undefined}>
      {lines.map((l, i) => (
        <span key={i} className="ds-text-line" data-line={i} style={{ top: l.top }} dir={l.dir === 'rtl' ? 'rtl' : undefined}>
          {l.text}
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
      {overflow ? (
        <span
          className={`ds-text-badge${pill ? ' ds-text-badge-pill' : ''}`}
          role="img"
          aria-label={`Text is cut off. Full text: ${layout.text}`}
          title={layout.text}
          data-text-overflow="true"
        >
          {'⋯'}
        </span>
      ) : null}
    </div>
  );
}

const TextBlock = memo(TextBlockImpl);
export default TextBlock;
export { TextBlock };

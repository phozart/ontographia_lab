// components/diagram-studio/text/TextBlock.js
// The one way node text is drawn (ADR-0008 3.1 "drawing rule"): every line of a TextLayout is an absolutely positioned
// `white-space: pre` span, so the browser has nothing left to wrap and an export of the DOM cannot drift from the
// canvas. Overflow is never silent: a clamped layout gets a badge (an accent chip) whose title is the full text.
// Memoized on the layout object (layouts are cached and frozen), so panning and zooming re-render nothing.
//
// Cost: a 5,000-element board draws thousands of these, so the per-line markup is minimal. The font, color, line height
// and alignment live once on the block; the line spans carry only their `top` (and `dir` for right-to-left lines); the
// static rules are in styles/diagram-studio.css (.ds-text, .ds-text-line, .ds-text-badge). Lines flow in normal flow.

import { memo } from 'react';

function TextBlockImpl({ layout, box, color, fontFamily, fontStyle, textDecoration, offsetX = 0, offsetY = 0, rotate, pill, className, testId }) {
  if (!layout || !box) return null;
  const { lines, lineHeight, fontSize, weight, overflow } = layout;
  // Only per-node values are inline (position, width, size, first-line offset, color). Everything static is in the
  // stylesheet, the weight is a class, and the lines flow as blocks (no per-line style), so a 5,000-element board writes
  // a handful of style properties per node instead of one object per line.
  const style = { left: box.x + offsetX, top: box.y + offsetY, width: box.width, fontSize, lineHeight: `${lineHeight}px` };
  const first = lines.length ? lines[0].top : 0;
  if (first) style.paddingTop = first;
  if (overflow) style.height = box.height; // the badge hangs from the bottom edge
  if (color) style.color = color;
  if (fontFamily) style.fontFamily = fontFamily;
  if (fontStyle && fontStyle !== 'normal') style.fontStyle = fontStyle;
  if (textDecoration && textDecoration !== 'none') style.textDecoration = textDecoration;
  if (rotate) {
    style.transform = `rotate(${rotate}deg)`;
    style.transformOrigin = 'center center';
  }
  const cls = `ds-text ds-text-w${weight}${layout.align === 'start' ? ' ds-text-start' : layout.align === 'end' ? ' ds-text-end' : ''}${className ? ` ${className}` : ''}`;
  return (
    <div className={cls} style={style} data-text-block={testId || 'label'} data-lines={lines.length} data-font-size={fontSize} data-overflow={overflow ? 'true' : undefined}>
      {lines.map((l, i) => (
        <span key={i} className="ds-text-line" dir={l.dir === 'rtl' ? 'rtl' : undefined}>
          {l.text}
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
      {overflow ? (
        <span
          className={`ds-text-badge${pill ? ' ds-text-badge-pill' : ''}`}
          role="button"
          tabIndex={0}
          aria-label={`Text is cut off. Full text: ${layout.text}`}
          title={layout.text}
          data-text-overflow="true"
        >
          {'\u22EF'}
          <span className="ds-text-full" role="tooltip">{layout.text}</span>
        </span>
      ) : null}
    </div>
  );
}

const TextBlock = memo(TextBlockImpl);
export default TextBlock;
export { TextBlock };

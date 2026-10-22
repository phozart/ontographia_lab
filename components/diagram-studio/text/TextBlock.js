// components/diagram-studio/text/TextBlock.js
// The one way node text is drawn (ADR-0008 3.1 "drawing rule"): every line of a TextLayout is pre-broken
// (`white-space: pre`), so the browser has nothing left to wrap and an export of the DOM cannot drift from the
// canvas. Overflow is never silent: a clamped layout gets a badge (an accent chip) whose title is the full text.
// Memoized on the layout object (layouts are cached and frozen), so panning and zooming re-render nothing.
//
// Cost: a 5,000-element board draws thousands of these, so the markup is minimal. Only per-node values are inline; the static
// rules are in styles/diagram-studio.css (.ds-text, .ds-text-badge). Left-to-right text is ONE text node (lines joined by
// newlines under white-space: pre), so a label is a div and a text node; right-to-left lines get a block span each.

import { memo, useState } from 'react';

// The overflow badge: hover shows the title, keyboard focus shows the full text in a popover (rendered only while focused,
// so a board full of clamped labels carries no hidden popover DOM).
export function OverflowBadge({ text, pill }) {
  const [focused, setFocused] = useState(false);
  return (
    <span
      className={`ds-text-badge${pill ? ' ds-text-badge-pill' : ''}`}
      role="button"
      tabIndex={0}
      aria-label={`Text is cut off. Full text: ${text}`}
      title={text}
      data-text-overflow="true"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
    >
      {'\u22EF'}
      {focused ? <span className="ds-text-full" role="tooltip">{text}</span> : null}
    </span>
  );
}

function TextBlockImpl({ layout, box, color, fontFamily, fontStyle, textDecoration, offsetX = 0, offsetY = 0, rotate, pill, className, testId, hideBadge }) {
  if (!layout || !box) return null;
  const { lines, lineHeight, fontSize, weight, overflow } = layout;
  // Only per-node values are inline (position, width, size, first-line offset, color). Everything static is in the
  // stylesheet, the weight is a class, and the lines flow as blocks (no per-line style), so a 5,000-element board writes
  // a handful of style properties per node instead of one object per line.
  const style = { left: box.x + offsetX, top: box.y + offsetY, width: box.width, fontSize };
  // the role line heights (1.3 and 1.25) are classes; only a custom ratio is written inline
  const ratio = Math.round((lineHeight / fontSize) * 100) / 100;
  const lhClass = ratio === 1.3 ? ' ds-text-lh130' : ratio === 1.25 ? ' ds-text-lh125' : '';
  if (!lhClass) style.lineHeight = `${lineHeight}px`;
  const rtl = lines.some((l) => l.dir === 'rtl'); // right-to-left lines keep one block per line (alignment follows their direction)
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
  const cls = `ds-text ds-text-w${weight}${lhClass}${layout.align === 'start' ? ' ds-text-start' : layout.align === 'end' ? ' ds-text-end' : ''}${className ? ` ${className}` : ''}`;
  return (
    <div className={cls} style={style} data-text-block={testId || 'label'} data-font-size={fontSize} data-overflow={overflow ? 'true' : undefined}>
      {rtl
        ? lines.map((l, i) => (
            <span key={i} className="ds-text-line" dir={l.dir === 'rtl' ? 'rtl' : undefined}>
              {l.text}
              {i < lines.length - 1 ? '\n' : null}
            </span>
          ))
        : lines.map((l) => l.text).join('\n') /* one text node: the lines are pre-broken, white-space: pre keeps them */}
      {overflow && !hideBadge ? <OverflowBadge text={layout.text} pill={pill} /> : null}
    </div>
  );
}

const TextBlock = memo(TextBlockImpl);
export default TextBlock;
export { TextBlock };

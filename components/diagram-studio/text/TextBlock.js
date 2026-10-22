// components/diagram-studio/text/TextBlock.js
// The one way node text is drawn (ADR-0008 3.1 "drawing rule"): every line of a TextLayout is an absolutely positioned
// `white-space: pre` span, so the browser has nothing left to wrap and an export of the DOM cannot drift from the
// canvas. Overflow is never silent: a clamped layout gets a badge (an accent chip) whose title is the full text.
// Memoized on the layout object (layouts are cached and frozen), so panning and zooming re-render nothing.

import { memo } from 'react';

const TEXT_ALIGN = { start: 'start', center: 'center', end: 'end' };

function TextBlockImpl({ layout, box, color, fontFamily, fontStyle, textDecoration, offsetX = 0, offsetY = 0, rotate, pill, className, testId }) {
  if (!layout || !box) return null;
  const { lines, lineHeight, fontSize, weight, overflow } = layout;
  const style = {
    position: 'absolute',
    left: box.x + offsetX,
    top: box.y + offsetY,
    width: box.width,
    height: box.height,
    pointerEvents: 'none',
    userSelect: 'none',
    ...(rotate ? { transform: `rotate(${rotate}deg)`, transformOrigin: 'center center' } : null),
  };
  const lineStyle = {
    position: 'absolute',
    left: 0,
    width: '100%',
    height: lineHeight,
    lineHeight: `${lineHeight}px`,
    whiteSpace: 'pre',
    textAlign: TEXT_ALIGN[layout.align] || 'center',
    unicodeBidi: 'plaintext',
    fontSize,
    fontWeight: weight,
    fontFamily: fontFamily || 'inherit',
    fontStyle: fontStyle || 'normal',
    textDecoration: textDecoration || 'none',
    color: color || 'inherit',
  };
  return (
    <div className={`ds-text ${className || ''}`.trim()} style={style} data-text-block={testId || 'label'} data-lines={lines.length} data-font-size={fontSize} data-overflow={overflow ? 'true' : undefined}>
      {lines.map((l, i) => (
        <span key={i} className="ds-text-line" data-line={i} style={{ ...lineStyle, top: l.top, direction: l.dir }} dir={l.dir}>
          {l.text}
          {i < lines.length - 1 ? ' ' : null}
        </span>
      ))}
      {overflow ? (
        <span
          className="ds-text-badge"
          role="img"
          aria-label={`Text is cut off. Full text: ${layout.text}`}
          title={layout.text}
          data-text-overflow="true"
          style={{
            position: 'absolute',
            right: pill ? 2 : 0,
            bottom: -8,
            pointerEvents: 'auto',
            cursor: 'help',
            fontSize: 11,
            lineHeight: '11px',
            height: 13,
            padding: '0 4px',
            borderRadius: 7,
            background: 'var(--accent, #4FB3CE)',
            color: '#fff',
            fontWeight: 700,
            letterSpacing: 1,
            fontFamily: 'inherit',
            whiteSpace: 'pre',
          }}
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

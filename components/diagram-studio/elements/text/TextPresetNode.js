// components/diagram-studio/elements/text/TextPresetNode.js
// The preset text box (ADR-0007 D5) on the canvas: `core/text-block` with data.text = {preset, markdown, ...}. Colour and font
// resolve through the board theme at render time (a theme switch restyles it); the font size is materialized on the element.
// Present mode and the exports clone this DOM, so they show exactly what the editor shows.
//
// Sizing: the box GROWS to fit its text for people who can edit (never shrinks, so a user's bigger box stays); for everyone
// else, and for locked boxes, overflow is flagged with data-overflow and the text is never clipped (overflow: visible).
// All text measurement and wrapping decisions live behind lib/present/textLayout.js (server-side estimate); here the
// browser lays the real text out.

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useDiagram } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import { presetStyle, textOf, plainLabelOf } from '../../../../lib/present/textPreset';
import PresetMarkdown from './PresetMarkdown';

const JUSTIFY = { top: 'flex-start', middle: 'center', bottom: 'flex-end' };
const FIT_SLACK = 2;

export default function TextPresetNode({ element, edit }) {
  const ctx = useDiagram() || {};
  const { theme, updateElement, diagram } = ctx;
  const text = textOf(element) || { preset: 'body', markdown: '' };
  const style = presetStyle(element, theme);
  const editable = canWrite(diagram?.access) && !element.locked;
  const innerRef = useRef(null);
  const [overflow, setOverflow] = useState(false);
  const [draft, setDraft] = useState(text.markdown);
  const width = element.size?.width;
  const height = element.size?.height;
  const editing = Boolean(edit?.editing) && editable;

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner || editing) return;
    const need = inner.scrollHeight;
    if (!(need > (height || 0) + FIT_SLACK)) {
      setOverflow(false);
      return;
    }
    if (editable && updateElement && Number.isFinite(width)) {
      updateElement(element.id, { size: { width, height: Math.ceil(need) } }, { coalesceKey: `text-fit:${element.id}` });
      setOverflow(false);
    } else {
      setOverflow(true);
    }
  }, [text.markdown, text.preset, style.fontSize, style.fontFamily, style.fontWeight, width, height, editable, editing, element.id, updateElement]);

  useEffect(() => { if (editing) setDraft(text.markdown); }, [editing]); // eslint-disable-line react-hooks/exhaustive-deps

  const commit = () => {
    if (draft !== text.markdown) {
      updateElement?.(element.id, { label: plainLabelOf(draft), data: { ...(element.data || {}), text: { ...text, markdown: draft } } });
    }
    edit?.onDone?.(false);
  };

  const box = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: JUSTIFY[style.verticalAlign] || 'flex-start',
    boxSizing: 'border-box',
    overflow: 'visible',
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    fontFamily: style.fontFamily,
    color: style.color,
    textAlign: style.textAlign,
    lineHeight: style.lineHeight,
    overflowWrap: 'anywhere',
    position: 'relative',
  };

  return (
    <div style={box} data-testid="text-preset" data-preset={text.preset} data-overflow={overflow ? 'true' : undefined}>
      {editing ? (
        <textarea
          autoFocus
          aria-label="Text (Markdown: **bold**, *italic*, - list)"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Escape') { e.preventDefault(); edit?.onDone?.(true); }
            else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(); }
          }}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%', resize: 'none', boxSizing: 'border-box', padding: 4,
            font: 'inherit', color: 'inherit', textAlign: 'inherit', lineHeight: 'inherit', background: 'rgba(255,255,255,0.92)',
            border: '2px solid var(--accent, #4FB3CE)', borderRadius: 6, outline: 'none',
          }}
        />
      ) : null}
      <div ref={innerRef} style={{ visibility: editing ? 'hidden' : 'visible' }}>
        <PresetMarkdown markdown={text.markdown} linkColor={theme?.palette?.accentText || style.color} />
      </div>
    </div>
  );
}

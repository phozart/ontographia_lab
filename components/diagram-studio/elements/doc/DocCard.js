// components/diagram-studio/elements/doc/DocCard.js
// The doc as a card on the canvas (AI-5): a title bar and the first lines of the rendered markdown with a fade-out.
// "Collapsed" shows the title bar only (the element is resized to the bar and its height is remembered).
// Double-click (or Enter on a selected card) opens the side-panel editor.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram } from '../../DiagramContext';
import { canWrite } from '../../sharing/accessMode';
import DocMarkdown from './DocMarkdown';
import { docOf, DEFAULT_EXCERPT_LINES } from '../../../../lib/doc/docElement';
import { openDoc, followElementLink } from './docStore';

export const DOC_BAR_HEIGHT = 40;
const MIN_EXPANDED_HEIGHT = 120;

const S = {
  card: { width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--panel, #ffffff)', border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, boxShadow: '0 1px 3px rgba(15,23,42,0.08), 0 4px 12px rgba(15,23,42,0.04)', overflow: 'hidden', boxSizing: 'border-box' },
  bar: { display: 'flex', alignItems: 'center', gap: 8, height: DOC_BAR_HEIGHT, minHeight: DOC_BAR_HEIGHT, padding: '0 8px 0 12px', borderBottom: '1px solid var(--border-subtle, #f1f5f9)', boxSizing: 'border-box' },
  title: { flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 650, color: 'var(--text, #0f172a)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  btn: { border: 0, background: 'transparent', cursor: 'pointer', color: 'var(--text-muted, #475569)', padding: 4, borderRadius: 4, lineHeight: 0 },
  body: { position: 'relative', flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  scroller: { flex: 1, minHeight: 0, padding: '8px 12px 0', overflowY: 'auto', overflowX: 'hidden', scrollbarWidth: 'thin', scrollbarColor: 'rgba(100,116,139,0.35) transparent', overscrollBehavior: 'contain' },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 36, background: 'linear-gradient(to bottom, rgba(255,255,255,0), var(--panel, #ffffff))', pointerEvents: 'none' },
  empty: { fontSize: 12.5, color: 'var(--text-light, #94a3b8)', fontStyle: 'italic' },
};

const DocIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.5 1.5h6l3 3v10h-9z" fill="none" stroke="var(--accent, #4FB3CE)" strokeWidth="1.3" strokeLinejoin="round" />
    <path d="M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5M5.5 13h3" fill="none" stroke="var(--accent, #4FB3CE)" strokeWidth="1.1" strokeLinecap="round" />
  </svg>
);

const stop = (e) => e.stopPropagation();

// Wheel / two-finger scroll over the card body scrolls the card's text instead of panning the canvas, but only when the
// text overflows. Ctrl/Cmd+wheel still zooms the canvas. A card that is merely hovered (not selected) hands the gesture
// back to the canvas once its text is at the top / bottom edge, so a big card never traps a pan. The canvas pans from a
// native non-passive wheel listener on its container, so this must be a native listener too (React's delegated onWheel
// runs after it).
export function wheelOwnedByCard(el, e, selected) {
  if (!el || e.ctrlKey || e.metaKey) return false;
  const max = el.scrollHeight - el.clientHeight;
  if (max <= 1) return false;
  if (selected) return true;
  const dy = e.deltaY;
  if (dy < 0 && el.scrollTop <= 0) return false;
  if (dy > 0 && el.scrollTop >= max - 1) return false;
  return true;
}

export default function DocCard({ element }) {
  const ctx = useDiagram() || {};
  const { elements, updateElement, diagram } = ctx;
  const doc = useMemo(() => docOf(element) || {}, [element]);
  const editable = canWrite(diagram?.access);
  const title = doc.title || element.label || 'Untitled doc';
  const markdown = typeof doc.markdown === 'string' ? doc.markdown : '';
  const collapsed = doc.collapsed === true;
  const lines = Number.isInteger(doc.excerptLines) ? doc.excerptLines : DEFAULT_EXCERPT_LINES;

  const selected = Boolean(ctx.selection?.nodeIds?.includes(element.id));
  const selectedRef = useRef(selected);
  selectedRef.current = selected;
  const scrollerRef = useRef(null);
  const [more, setMore] = useState(false); // is there more text below the visible part

  const measure = useCallback(() => {
    const el = scrollerRef.current;
    setMore(Boolean(el) && el.scrollHeight - el.clientHeight > 1 && el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      if (!wheelOwnedByCard(el, e, selectedRef.current)) return;
      e.preventDefault();
      e.stopPropagation();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
      el.scrollTop += e.deltaY * unit;
      measure();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    measure();
    return () => {
      el.removeEventListener('wheel', onWheel);
      ro?.disconnect();
    };
  }, [measure, collapsed, markdown]);

  const knownIds = useMemo(() => new Set((elements || []).map((e) => e.id)), [elements]);

  const toggle = useCallback(
    (e) => {
      e.stopPropagation();
      if (!editable || !updateElement) return;
      const height = element.size?.height || 220;
      if (collapsed) {
        const restore = Number.isInteger(doc.restoreHeight) && doc.restoreHeight >= MIN_EXPANDED_HEIGHT ? doc.restoreHeight : 220;
        const { restoreHeight: _omit, ...rest } = doc;
        updateElement(element.id, { size: { ...element.size, height: restore }, data: { ...element.data, doc: { ...rest, collapsed: false } } });
      } else {
        updateElement(element.id, { size: { ...element.size, height: DOC_BAR_HEIGHT }, data: { ...element.data, doc: { ...doc, collapsed: true, restoreHeight: Math.max(MIN_EXPANDED_HEIGHT, Math.round(height)) } } });
      }
    },
    [editable, updateElement, element, doc, collapsed]
  );

  return (
    <div style={S.card} data-testid="doc-card" data-doc-id={element.id}>
      <div style={S.bar}>
        <DocIcon />
        <div style={S.title} title={title}>{title}</div>
        {editable && (
          <button type="button" style={S.btn} onMouseDown={stop} onClick={toggle} aria-label={collapsed ? 'Expand doc' : 'Collapse doc'} title={collapsed ? 'Expand' : 'Collapse'}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d={collapsed ? 'M3 5l4 4 4-4' : 'M3 9l4-4 4 4'} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </button>
        )}
        <button type="button" style={S.btn} onMouseDown={stop} onClick={(e) => { e.stopPropagation(); openDoc(element.id); }} aria-label="Open doc" title={editable ? 'Open and edit' : 'Open'}>
          <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M5 2H2v10h10V9M8 2h4v4M12 2L6.5 7.5" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
      {!collapsed && (
        <div style={S.body} data-excerpt-lines={lines}>
          <div ref={scrollerRef} style={S.scroller} data-testid="doc-card-scroll" data-more={more ? 'true' : 'false'} onScroll={measure}>
            {markdown.trim() ? (
              <DocMarkdown markdown={markdown} knownIds={knownIds} onElementLink={followElementLink} maxChars={20000} maxBlocks={150} />
            ) : (
              <div style={S.empty}>{editable ? 'Empty doc. Double-click to write.' : 'Empty doc.'}</div>
            )}
            <div style={{ height: 12 }} />
          </div>
          {more && <div style={S.fade} data-testid="doc-card-fade" />}
        </div>
      )}
    </div>
  );
}

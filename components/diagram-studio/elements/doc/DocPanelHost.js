// components/diagram-studio/elements/doc/DocPanelHost.js
// Mounts the doc side panel in the studio's right-hand slot (AI-5). The editor itself is lazy-loaded, so a board with
// no open doc pays only for this small shell. Also: Enter on a selected doc card opens it, and a dropped .md file
// becomes a doc card (useDocImport).

import React, { Suspense, useEffect } from 'react';
import { useDiagram } from '../../DiagramContext';
import ResizablePanel from '../../ResizablePanel';
import { useOpenDocId, openDoc, closeDoc, useDocNotice } from './docStore';
import { useDocImport } from './useDocImport';
import { copyAsImage } from '../../export/copyAsImage';

const DocPanel = React.lazy(() => import('./DocPanel'));

const isTyping = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);

export default function DocPanelHost() {
  const openId = useOpenDocId();
  const { elements = [], connections = [], selection, diagram } = useDiagram() || {};
  const { notice, dismiss } = useDocImport();
  const toast = useDocNotice();

  // Enter opens the selected doc card
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Enter' || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey || isTyping(e.target)) return;
      const ids = selection?.nodeIds || [];
      if (ids.length !== 1) return;
      const el = elements.find((x) => x.id === ids[0]);
      if (el && el.type === 'doc') {
        e.preventDefault();
        openDoc(el.id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [elements, selection]);

  // Cmd/Ctrl+Shift+C on the canvas copies the selection (or the whole board) as an image. Inside the doc panel the same
  // keys copy the doc with formatting; the panel handles the event first and stops it, so this listener never sees it.
  // Plain Cmd/Ctrl+C (copy elements) is untouched, and nothing happens while typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'c' || isTyping(e.target)) return;
      if (e.target?.closest?.('[data-testid="doc-panel"]')) return;
      e.preventDefault();
      copyAsImage({ elements, connections, selection, name: diagram?.name });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [elements, connections, selection, diagram]);

  // A deleted doc cannot stay open
  useEffect(() => {
    if (openId && !elements.some((e) => e.id === openId)) closeDoc();
  }, [openId, elements]);

  return (
    <>
      {openId && (
        <div className="ds-panel-wrapper ds-panel-right ds-panel-slide-in" data-testid="doc-panel-wrapper">
          <ResizablePanel position="right" defaultSize={420} minSize={300} maxSize={720} storageKey="ds-doc-panel">
            <Suspense fallback={<div style={{ padding: 16, color: 'var(--text-muted, #475569)' }}>Loading editor...</div>}>
              <DocPanel key={openId} elementId={openId} onClose={closeDoc} />
            </Suspense>
          </ResizablePanel>
        </div>
      )}
      {toast && (
        <div role="status" aria-live="polite" data-testid="doc-toast" data-kind={toast.kind} style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2100, maxWidth: 520, padding: '9px 14px', borderRadius: 8, background: toast.kind === 'error' ? '#fdecea' : '#0f172a', color: toast.kind === 'error' ? '#7a1c12' : '#fff', border: toast.kind === 'error' ? '1px solid #f1a9a0' : '1px solid transparent', boxShadow: '0 4px 16px rgba(0,0,0,.2)', fontSize: 13 }}>
          {toast.text}
        </div>
      )}
      {notice && (
        <div role="status" data-testid="doc-import-notice" style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 2000, maxWidth: 520, padding: '10px 14px', borderRadius: 8, background: '#fff7e6', color: '#5c3b00', border: '1px solid #f0c36d', boxShadow: '0 4px 16px rgba(0,0,0,.15)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span>{notice}</span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16 }}>&times;</button>
        </div>
      )}
    </>
  );
}

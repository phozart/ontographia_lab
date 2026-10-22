// components/diagram-studio/present/PresentationHost.js
// Mounted once inside the editor (DiagramProvider). Owns: the Presentation panel, present mode (the `?present=<id>&slide=<n>`
// deep link included), and deck export. Read-only roles (viewer, commenter) can present and export but not edit: the panel
// hides its editing controls and the context refuses edits anyway.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDiagram, useDiagramViewport, useDiagramSelection } from '../DiagramContext';
import { canWrite as accessCanWrite } from '../sharing/accessMode';
import { resolveDeck, isFrameElement } from '../../../lib/present/presentationModel';
import { downloadExport } from '../export/ExportManager';
import PresentationPanel from './PresentationPanel';
import PresentMode from './PresentMode';
import { exportDeckPdf, exportSlidePng } from './exportDeck';
import { clampIndex, addNewSlide, applyLayoutToFrame, addPresetText } from './deckActions';
import {
  usePresentState, setPresentState, startPresenting, stopPresenting, closePresentationPanel,
  OPEN_PRESENTATIONS_EVENT, START_PRESENTATION_EVENT,
} from './presentStore';

const ZOOM_PADDING = 40;

/** Read `?present=<id>&slide=<n>` (n is 1-based) from a URL search string. */
export function parsePresentQuery(search) {
  try {
    const q = new URLSearchParams(search);
    const id = q.get('present');
    if (!id) return null;
    const n = Number.parseInt(q.get('slide') || '1', 10);
    return { presentationId: id, index: Number.isFinite(n) && n > 0 ? n - 1 : 0 };
  } catch (_) {
    return null;
  }
}

function writeQuery(presentationId, slideNumber) {
  if (typeof window === 'undefined' || !window.history?.replaceState) return;
  try {
    const url = new URL(window.location.href);
    if (presentationId) {
      url.searchParams.set('present', presentationId);
      url.searchParams.set('slide', String(slideNumber));
    } else {
      url.searchParams.delete('present');
      url.searchParams.delete('slide');
    }
    window.history.replaceState(window.history.state, '', url.toString());
  } catch (_) { /* a history failure must never break presenting */ }
}

export default function PresentationHost({ containerRef }) {
  const ctx = useDiagram();
  const { diagram, elements, connections, presentations, patchPresentation, addElement, removeElement, updateElement, theme, applyTheme } = ctx;
  const { zoomToFrame, viewport } = useDiagramViewport();
  const { selection, selectElement } = useDiagramSelection();
  const state = usePresentState();
  const canEdit = accessCanWrite(diagram?.access);
  const viewportCenter = () => {
    const el = containerRef?.current;
    const scale = viewport?.scale || 1;
    return { x: -(viewport?.x || 0) + (el?.offsetWidth || 1200) / 2 / scale, y: -(viewport?.y || 0) + (el?.offsetHeight || 800) / 2 / scale };
  };
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const [exporting, setExporting] = useState(null);
  const [exportError, setExportError] = useState(null);
  const [exportNote, setExportNote] = useState(null);
  const abortRef = useRef(null);
  const linkTried = useRef(null);
  const [notice, setNotice] = useState(null);

  const content = useMemo(() => ({ elements, connections, presentations: presentations || [] }), [elements, connections, presentations]);
  const selectedFrameIds = useMemo(
    () => (selection?.nodeIds || []).filter((id) => isFrameElement(elements.find((e) => e.id === id))),
    [selection, elements]
  );

  // events: the title-bar menu opens the panel, others can start a show
  useEffect(() => {
    const open = () => setPresentState({ panelOpen: true });
    const start = (e) => startPresenting(e.detail?.presentationId, e.detail?.index || 0);
    window.addEventListener(OPEN_PRESENTATIONS_EVENT, open);
    window.addEventListener(START_PRESENTATION_EVENT, start);
    return () => {
      window.removeEventListener(OPEN_PRESENTATIONS_EVENT, open);
      window.removeEventListener(START_PRESENTATION_EVENT, start);
    };
  }, []);

  // deep link: ?present=<presentationId>&slide=<n> starts the show once the board has loaded (once per link)
  useEffect(() => {
    if (!diagram?.id || typeof window === 'undefined') return;
    const q = parsePresentQuery(window.location.search);
    const key = q ? `${diagram.id}:${q.presentationId}:${q.index}` : null;
    if (!q || linkTried.current === key) return;
    linkTried.current = key;
    const deck = resolveDeck(content, q.presentationId);
    if (!deck) { setNotice('That presentation was not found on this board.'); writeQuery(null); return; }
    startPresenting(q.presentationId, q.index);
  }, [diagram?.id, content]);

  const presenting = state.presenting;
  const deck = useMemo(() => (presenting ? resolveDeck(content, presenting.presentationId) : null), [presenting, content]);
  const playable = deck?.playable || [];
  const index = presenting ? clampIndex(presenting.index, playable.length) : 0;

  // the deck vanished under the presenter (deleted by someone else): leave quietly
  useEffect(() => { if (presenting && !deck) { stopPresenting(); writeQuery(null); } }, [presenting, deck]);

  useEffect(() => { if (presenting) writeQuery(presenting.presentationId, index + 1); }, [presenting, index]);

  const exitPresenting = useCallback(() => {
    const current = playable[index];
    stopPresenting();
    writeQuery(null);
    if (current?.frame) {
      const el = containerRef?.current;
      zoomToFrame(current.frame, el?.offsetWidth || 1200, el?.offsetHeight || 800, ZOOM_PADDING);
      selectElement?.(current.frame.id);
    }
  }, [playable, index, zoomToFrame, selectElement, containerRef]);

  const onIndexChange = useCallback((i) => setPresentState({ presenting: { presentationId: presenting.presentationId, index: i } }), [presenting]);

  const reveal = useCallback((frame) => {
    const el = containerRef?.current;
    zoomToFrame(frame, el?.offsetWidth || 1200, el?.offsetHeight || 800, ZOOM_PADDING);
    selectElement?.(frame.id);
  }, [zoomToFrame, selectElement, containerRef]);

  const runExport = useCallback(async (presentationId, only) => {
    setExportError(null);
    setExportNote(null);
    const resolved = resolveDeck(content, presentationId);
    if (!resolved) return;
    const title = resolved.presentation.title;
    const abort = new AbortController();
    abortRef.current = abort;
    try {
      if (only) {
        const s = resolved.slides.find((x) => x.slideId === only);
        if (!s || s.missing) throw new Error('That slide has no frame to export.');
        downloadExport(await exportSlidePng({ slide: s, elements, connections, title, theme, number: s.n }));
      } else {
        setExporting({ done: 0, total: resolved.playable.length });
        const result = await exportDeckPdf({
          slides: resolved.playable, elements, connections, title, theme, signal: abort.signal,
          onProgress: (done, total) => setExporting({ done, total }),
        });
        downloadExport(result);
        // the export reports what it left out (ADR-0007 5.1): hidden slides and slides whose frame was deleted
        const skipped = resolved.slides.length - resolved.playable.length;
        if (skipped > 0) setExportNote(`${result.pages} slide${result.pages === 1 ? '' : 's'} exported; ${skipped} skipped (hidden or missing).`);
      }
    } catch (e) {
      if (e?.name !== 'AbortError') setExportError(e?.message || 'The export failed.');
    } finally {
      setExporting(null);
      abortRef.current = null;
    }
  }, [content, elements, connections, theme]);

  if (!diagram?.id) return null;
  return (
    <>
      <PresentationPanel
        open={state.panelOpen}
        onClose={closePresentationPanel}
        content={content}
        activeId={state.activeId}
        onActiveChange={(id) => setPresentState({ activeId: id })}
        canEdit={canEdit}
        selectedFrameIds={selectedFrameIds}
        patchPresentation={patchPresentation}
        addElement={addElement}
        removeElement={removeElement}
        getLiveElements={() => elementsRef.current}
        onPresent={(presentationId, i) => startPresenting(presentationId, i)}
        onExportPdf={(id) => runExport(id)}
        onExportPng={(id, slideId) => runExport(id, slideId)}
        onRevealFrame={reveal}
        exporting={exporting}
        onCancelExport={() => abortRef.current?.abort()}
        exportError={exportError}
        exportNote={exportNote}
        theme={theme}
        onApplyTheme={(patch) => { const r = applyTheme(patch); return r.ok ? r : { ok: false, errors: [r.error] }; }}
        onAddSlideWithLayout={(layout) => addNewSlide({ patchPresentation, addElement, presentations, activeId: state.activeId, elements: elementsRef.current, layout })}
        onApplyLayout={(layout) => applyLayoutToFrame({ frame: elements.find((e) => e.id === selectedFrameIds[0]), elements: elementsRef.current, layout, addElement, updateElement, removeElement })}
        onAddText={(preset) => addPresetText({ preset, frame: elements.find((e) => e.id === selectedFrameIds[0]) || null, elements: elementsRef.current, addElement, center: viewportCenter() })}
      />
      {presenting && deck && (
        <PresentMode
          slides={playable}
          deckTitle={deck.presentation.title}
          index={index}
          onIndexChange={onIndexChange}
          onExit={exitPresenting}
          elements={elements}
          connections={connections}
          theme={theme}
        />
      )}
      {notice && (
        <div role="status" style={{ position: 'fixed', left: '50%', bottom: 24, transform: 'translateX(-50%)', zIndex: 1400, padding: '8px 14px', borderRadius: 10, background: 'var(--ds-surface, #fff)', color: 'var(--ds-text, #1f2933)', boxShadow: '0 4px 18px rgba(0,0,0,.18)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'center' }}>
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss">&times;</button>
        </div>
      )}
    </>
  );
}

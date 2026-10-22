// components/diagram-studio/present/PresentationPanel.js
// The Presentation panel (ADR-0007 5.3, right slide-in): deck picker, slides with thumbnails, reorder (drag and the
// Move up / down buttons), notes, hide, missing slides, Add slide / Add selected frame, Present and Export.
// Viewers see the same list and can Present and Export, but no editing control (the context refuses edits anyway).

import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import EditNoteIcon from '@mui/icons-material/EditNote';
import CloseIcon from '@mui/icons-material/Close';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import { renderDiagramSvg } from '../../../lib/render/diagramSvg';
import { selectRegion } from '../../../lib/mcp/regionSelect';
import { resolveDeck, frameSize } from '../../../lib/present/presentationModel';
import { MAX_NOTES_BYTES } from '../../../lib/diagramLimits';
import { ASPECTS } from '../../../lib/present/presentationSchema';
import { addFramesToDeck, addNewSlide } from './deckActions';

const NOTES_CHAR_CAP = Math.floor(MAX_NOTES_BYTES / 4); // characters; 4 is the worst case bytes per character

function useThumbnail(frame, elements, connections) {
  return useMemo(() => {
    if (!frame) return null;
    try {
      const region = selectRegion(elements, { frameId: frame.id });
      const r = renderDiagramSvg({ elements, connections }, { elementIds: region.elements.map((e) => e.id), maxElements: 80, maxConnections: 160, labels: true });
      return r.svg ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(r.svg)}` : null;
    } catch (_) {
      return null;
    }
  }, [frame, elements, connections]);
}

function SlideThumb({ slide, elements, connections }) {
  const src = useThumbnail(slide.frame, elements, connections);
  const size = slide.frame ? frameSize(slide.frame) : { width: 16, height: 9 };
  return (
    <div className={`pp-thumb ${slide.missing ? 'missing' : ''}`} style={{ aspectRatio: `${size.width} / ${size.height}` }}>
      {slide.missing ? <span>Missing slide</span> : src ? <img src={src} alt="" /> : <span>{slide.title}</span>}
      <style jsx>{`
        .pp-thumb { width: 96px; flex: none; border: 1px solid var(--border, #e5e7eb); border-radius: 6px; background: #fff; overflow: hidden; display: flex; align-items: center; justify-content: center; font-size: 10px; color: var(--text-muted, #6b7280); text-align: center; }
        .pp-thumb.missing { background: repeating-linear-gradient(45deg, #fef2f2, #fef2f2 6px, #fff 6px, #fff 12px); color: #b91c1c; }
        img { width: 100%; height: 100%; object-fit: contain; display: block; }
      `}</style>
    </div>
  );
}

function NotesField({ value, disabled, onCommit, label }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => { setDraft(value); }, [value]);
  return (
    <textarea
      className="pp-notes"
      aria-label={label}
      value={draft}
      disabled={disabled}
      maxLength={NOTES_CHAR_CAP}
      rows={3}
      placeholder={disabled ? 'No notes' : 'Speaker notes (plain text)'}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
    />
  );
}

/**
 * @param {{open: boolean, onClose: () => void, content: {elements: object[], connections: object[], presentations: object[]},
 *          activeId: string|null, onActiveChange: (id: string|null) => void, canEdit: boolean, selectedFrameIds: string[],
 *          patchPresentation: Function, addElement: Function, removeElement: Function, getLiveElements: () => object[], onPresent: (presentationId: string, index: number) => void,
 *          onExportPdf: (presentationId: string) => void, onExportPng: (presentationId: string, slideId: string) => void,
 *          onRevealFrame: (frame: object) => void, exporting: null | {done: number, total: number}, onCancelExport: () => void,
 *          exportError: string|null}} props
 */
export default function PresentationPanel({
  open, onClose, content, activeId, onActiveChange, canEdit, selectedFrameIds, patchPresentation, addElement, removeElement, getLiveElements,
  onPresent, onExportPdf, onExportPng, onRevealFrame, exporting, onCancelExport, exportError,
}) {
  const panelRef = useRef(null);
  const [expanded, setExpanded] = useState(null); // slide id whose notes are open
  const [dragId, setDragId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // slide being removed (frame still exists)
  const [message, setMessage] = useState(null);
  const elements = useDeferredValue(content.elements);
  const connections = useDeferredValue(content.connections);
  const presentations = content.presentations;
  const deck = presentations.find((p) => p.id === activeId) || presentations[0] || null;
  const resolved = useMemo(() => (deck ? resolveDeck({ elements, presentations }, deck.id) : null), [deck, elements, presentations]);

  useEffect(() => { if (open) panelRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !confirmRemove) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmRemove, onClose]);
  useEffect(() => { if (deck && deck.id !== activeId) onActiveChange(deck.id); }, [deck, activeId, onActiveChange]);

  if (!open) return null;
  const say = (r) => { setMessage(r && !r.ok ? r.errors?.[0] || 'That did not work.' : null); return r; };
  const slides = resolved?.slides || [];
  const playable = resolved?.playable || [];

  const move = (slideId, delta) => {
    const ids = slides.map((s) => s.slideId);
    const i = ids.indexOf(slideId);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    say(patchPresentation({ id: deck.id, order: ids }));
  };
  const drop = (targetId) => {
    if (!dragId || dragId === targetId) { setDragId(null); return; }
    const ids = slides.map((s) => s.slideId).filter((id) => id !== dragId);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    setDragId(null);
    say(patchPresentation({ id: deck.id, order: ids }));
  };
  const removeSlide = (slide, deleteFrame) => {
    say(patchPresentation({ id: deck.id, removeSlideIds: [slide.slideId] }));
    if (deleteFrame && slide.frame) removeElement?.(slide.frame.id);
    setConfirmRemove(null);
  };

  return (
    <aside className="pp-panel" role="complementary" aria-label="Presentation" tabIndex={-1} ref={panelRef} data-testid="presentation-panel">
      <header className="pp-head">
        <h2>Presentation</h2>
        <button type="button" className="pp-icon" onClick={onClose} aria-label="Close presentation panel">&times;</button>
      </header>

      <div className="pp-body">
        <div className="pp-deck-row">
          {presentations.length > 0 ? (
            <select aria-label="Presentation" value={deck?.id || ''} onChange={(e) => onActiveChange(e.target.value)}>
              {presentations.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
            </select>
          ) : <span className="pp-muted">No presentation yet. Add a slide to start one.</span>}
          {canEdit && (
            <button type="button" className="pp-btn" onClick={() => { const r = say(patchPresentation({ create: { title: `Presentation ${presentations.length + 1}` } })); if (r.ok) onActiveChange(r.presentationId); }}>New</button>
          )}
        </div>

        {deck && canEdit && (
          <div className="pp-deck-edit">
            <input
              type="text"
              aria-label="Presentation title"
              defaultValue={deck.title}
              key={`${deck.id}:${deck.title}`}
              maxLength={200}
              onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== deck.title) say(patchPresentation({ id: deck.id, title: v })); }}
            />
            <select aria-label="Default slide shape" value={deck.aspect} onChange={(e) => say(patchPresentation({ id: deck.id, aspect: e.target.value }))}>
              {ASPECTS.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            <button type="button" className="pp-btn danger" onClick={() => { say(patchPresentation({ id: deck.id, removeDeck: true })); }} title="Delete this presentation (the frames stay on the board)">Delete</button>
          </div>
        )}

        {deck && (
          <div className="pp-actions">
            <button type="button" className="pp-btn primary" data-testid="pp-present" onClick={() => onPresent(deck.id, 0)} disabled={playable.length === 0}>Present</button>
            <button type="button" className="pp-btn" data-testid="pp-export-pdf" onClick={() => onExportPdf(deck.id)} disabled={playable.length === 0 || !!exporting}>Export PDF</button>
          </div>
        )}
        {exporting && (
          <div className="pp-progress" role="status">
            Exporting slide {Math.min(exporting.done + 1, exporting.total)} of {exporting.total}
            <button type="button" className="pp-btn" onClick={onCancelExport}>Cancel</button>
          </div>
        )}
        {exportError && <p className="pp-error" role="alert">{exportError}</p>}
        {message && <p className="pp-error" role="alert">{message}</p>}

        {canEdit && (
          <div className="pp-actions">
            <button type="button" className="pp-btn" data-testid="pp-add-slide" onClick={() => say(addNewSlide({ patchPresentation, addElement, presentations, activeId: deck?.id || null, elements: getLiveElements() }))}>Add slide</button>
            <button
              type="button"
              className="pp-btn"
              data-testid="pp-add-selected"
              disabled={selectedFrameIds.length === 0}
              title={selectedFrameIds.length ? 'Add the selected frame as a slide' : 'Select a frame on the board first'}
              onClick={() => say(addFramesToDeck({ patchPresentation, presentations, activeId: deck?.id || null, frameIds: selectedFrameIds }))}
            >Add selected frame{selectedFrameIds.length > 1 ? 's' : ''}</button>
          </div>
        )}

        {deck && slides.length === 0 && <p className="pp-muted">This presentation has no slides. A slide is a frame on the board: use Add slide, or select a frame and Add selected frame.</p>}

        <ol className="pp-slides" aria-label="Slides">
          {slides.map((s) => (
            <li
              key={s.slideId}
              className={`pp-slide ${s.hidden ? 'hidden' : ''} ${dragId === s.slideId ? 'dragging' : ''}`}
              draggable={canEdit}
              onDragStart={() => canEdit && setDragId(s.slideId)}
              onDragOver={(e) => canEdit && e.preventDefault()}
              onDrop={() => canEdit && drop(s.slideId)}
              onDragEnd={() => setDragId(null)}
              data-testid="pp-slide"
              data-slide-id={s.slideId}
            >
              <div className="pp-slide-main">
                <span className="pp-n">{s.n}</span>
                <SlideThumb slide={s} elements={elements} connections={connections} />
                <div className="pp-slide-info">
                  <button type="button" className="pp-link" onClick={() => s.frame && onRevealFrame(s.frame)} disabled={!s.frame} title={s.frame ? 'Show this frame on the board' : 'The frame was deleted'}>{s.title}</button>
                  {s.missing && <span className="pp-badge bad">Missing slide: its frame was deleted. It is skipped when presenting.</span>}
                  {s.hidden && <span className="pp-badge">Hidden</span>}
                </div>
              </div>
              <div className="pp-slide-tools">
                <button type="button" className="pp-icon" onClick={() => onPresent(deck.id, Math.max(0, playable.findIndex((p) => p.slideId === s.slideId)))} disabled={s.missing || s.hidden} aria-label={`Present from slide ${s.n}`} title="Present from here"><PlayArrowIcon fontSize="small" /></button>
                {canEdit && <button type="button" className="pp-icon" onClick={() => move(s.slideId, -1)} disabled={s.n === 1} aria-label={`Move slide ${s.n} up`} title="Move up"><ArrowUpwardIcon fontSize="small" /></button>}
                {canEdit && <button type="button" className="pp-icon" onClick={() => move(s.slideId, 1)} disabled={s.n === slides.length} aria-label={`Move slide ${s.n} down`} title="Move down"><ArrowDownwardIcon fontSize="small" /></button>}
                {canEdit && <button type="button" className="pp-icon" onClick={() => say(patchPresentation({ id: deck.id, updateSlides: [{ slideId: s.slideId, hidden: !s.hidden }] }))} aria-pressed={s.hidden} aria-label={s.hidden ? `Show slide ${s.n}` : `Hide slide ${s.n}`} title={s.hidden ? 'Show this slide' : 'Hide this slide'}>{s.hidden ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}</button>}
                <button type="button" className="pp-icon" onClick={() => onExportPng(deck.id, s.slideId)} disabled={s.missing} aria-label={`Download slide ${s.n} as PNG`} title="Download this slide as PNG"><ImageOutlinedIcon fontSize="small" /></button>
                <button type="button" className="pp-icon" onClick={() => setExpanded(expanded === s.slideId ? null : s.slideId)} aria-expanded={expanded === s.slideId} aria-label={`Notes for slide ${s.n}`} title="Speaker notes"><EditNoteIcon fontSize="small" style={{ color: s.notes ? 'var(--accent, #4fb3ce)' : undefined }} /></button>
                {canEdit && <button type="button" className="pp-icon danger" onClick={() => (s.frame ? setConfirmRemove(s) : removeSlide(s, false))} aria-label={`Remove slide ${s.n}`} title="Remove from the presentation"><CloseIcon fontSize="small" /></button>}
              </div>
              {expanded === s.slideId && (
                <NotesField
                  value={s.notes}
                  disabled={!canEdit}
                  label={`Speaker notes for slide ${s.n}`}
                  onCommit={(text) => say(patchPresentation({ id: deck.id, updateSlides: [{ slideId: s.slideId, notes: text }] }))}
                />
              )}
              {confirmRemove?.slideId === s.slideId && (
                <div className="pp-confirm" role="group" aria-label="Remove slide">
                  <span>Remove this slide from the presentation?</span>
                  <button type="button" className="pp-btn" onClick={() => removeSlide(s, false)}>Remove slide only</button>
                  <button type="button" className="pp-btn danger" onClick={() => removeSlide(s, true)}>Delete frame too</button>
                  <button type="button" className="pp-btn" onClick={() => setConfirmRemove(null)}>Cancel</button>
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>

      <style jsx>{`
        .pp-panel { position: fixed; top: 0; right: 0; bottom: 0; z-index: 1200; width: min(380px, 100vw); display: flex; flex-direction: column; background: var(--surface, #fff); color: var(--text, #1f2937); border-left: 1px solid var(--border, #e5e7eb); box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12); outline: none; font-size: 13px; }
        .pp-head { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; border-bottom: 1px solid var(--border, #e5e7eb); }
        h2 { margin: 0; font-size: 15px; }
        .pp-body { flex: 1; overflow: auto; padding: 12px 14px 24px; display: flex; flex-direction: column; gap: 10px; }
        .pp-deck-row, .pp-deck-edit, .pp-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
        .pp-deck-row select, .pp-deck-edit input, .pp-deck-edit select { flex: 1; min-width: 0; padding: 6px 8px; border: 1px solid var(--border, #d1d5db); border-radius: 6px; font: inherit; background: var(--surface, #fff); color: inherit; }
        .pp-deck-edit select { flex: none; }
        .pp-btn { padding: 6px 12px; border-radius: 8px; border: 1px solid var(--border, #d1d5db); background: transparent; color: inherit; font: inherit; font-weight: 500; cursor: pointer; }
        .pp-btn:hover:not(:disabled) { background: var(--bg-alt, #f3f4f6); }
        .pp-btn.primary { background: var(--accent, #4fb3ce); border-color: var(--accent, #4fb3ce); color: #06222b; }
        .pp-btn.danger { color: #b91c1c; }
        .pp-btn:disabled, .pp-icon:disabled { opacity: 0.45; cursor: default; }
        .pp-btn:focus-visible, .pp-icon:focus-visible, .pp-link:focus-visible { outline: 2px solid var(--accent, #4fb3ce); outline-offset: 1px; }
        .pp-icon { min-width: 28px; height: 28px; padding: 0 6px; border: 1px solid transparent; border-radius: 6px; background: transparent; color: inherit; font: inherit; font-size: 12px; cursor: pointer; }
        .pp-icon:hover:not(:disabled) { background: var(--bg-alt, #f3f4f6); border-color: var(--border, #e5e7eb); }
        .pp-icon.danger { color: #b91c1c; }
        .pp-muted { color: var(--text-muted, #6b7280); margin: 0; }
        .pp-error { margin: 0; padding: 6px 8px; border-radius: 6px; background: #fef2f2; color: #991b1b; }
        .pp-progress { display: flex; gap: 8px; align-items: center; justify-content: space-between; }
        .pp-slides { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
        .pp-slide { border: 1px solid var(--border, #e5e7eb); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px; background: var(--surface, #fff); }
        .pp-slide.hidden { opacity: 0.6; }
        .pp-slide.dragging { outline: 2px dashed var(--accent, #4fb3ce); }
        .pp-slide-main { display: flex; gap: 8px; align-items: center; }
        .pp-n { width: 18px; text-align: right; color: var(--text-muted, #6b7280); font-variant-numeric: tabular-nums; }
        .pp-slide-info { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .pp-link { border: 0; background: none; padding: 0; text-align: left; font: inherit; font-weight: 600; color: inherit; cursor: pointer; overflow-wrap: anywhere; }
        .pp-link:disabled { cursor: default; }
        .pp-badge { font-size: 11px; color: var(--text-muted, #6b7280); }
        .pp-badge.bad { color: #b91c1c; }
        .pp-slide-tools { display: flex; flex-wrap: wrap; gap: 2px; justify-content: flex-end; }
        .pp-confirm { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; padding: 6px; border-radius: 8px; background: #fffbeb; }
        :global(.pp-notes) { width: 100%; box-sizing: border-box; padding: 6px 8px; border: 1px solid var(--border, #d1d5db); border-radius: 6px; font: inherit; resize: vertical; background: var(--surface, #fff); color: inherit; }
      `}</style>
    </aside>
  );
}

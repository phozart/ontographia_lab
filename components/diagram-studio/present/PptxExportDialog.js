// components/diagram-studio/present/PptxExportDialog.js
// The "Export PowerPoint" dialog (ADR-0007 8.3): what will be exported, the Office-safe fonts option, and the fidelity
// limits stated plainly BEFORE the file is made. The export module (compile, capture, writer) and pptxgenjs are loaded only
// when this dialog opens / when Export is clicked, so the editor route does not carry them.

import { useEffect, useRef, useState } from 'react';
import { FONT_LABELS } from '../../../lib/present/themes';

/** The honest list (ADR 8.3). Kept as data so a test can pin the promises the dialog makes. */
export const FIDELITY_NOTES = Object.freeze([
  'Text, shapes, sticky notes, tables, docs and speaker notes become native PowerPoint objects you can edit.',
  'Diagrams (UML, ERD and other stencil packs, and anything joined by connectors) become one picture per group at 2x. They look exact but are not editable.',
  'Line wraps can differ a little: the board\'s line breaks are kept, but PowerPoint measures text with its own fonts.',
  'Fonts are not embedded. A font the viewer does not have is replaced by PowerPoint.',
  'No gradients, shadows, animations or transitions. Fill colours, borders, corner radius and opacity are kept.',
  'Hidden slides and slides whose frame was deleted are left out. Comments and highlights are not exported.',
]);

const PHASE_LABEL = { diagrams: 'Capturing diagram', writing: 'Writing the file' };

/**
 * @param {{open: boolean, onClose: () => void, content: object, presentationId: string|null, boardUrl: string,
 *          onDownload: (result: object) => void}} props
 */
export default function PptxExportDialog({ open, onClose, content, presentationId, boardUrl, onDownload }) {
  const [officeSafe, setOfficeSafe] = useState(true);
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [done, setDone] = useState(null);
  const abortRef = useRef(null);
  const ref = useRef(null);

  useEffect(() => {
    if (!open || !presentationId) return undefined;
    let live = true;
    import('./exportPptx').then((m) => { if (live) setPreview(m.previewDeck({ content, presentationId, boardUrl })); }).catch(() => { if (live) setError('The export could not be prepared.'); });
    return () => { live = false; };
  }, [open, content, presentationId, boardUrl]);

  useEffect(() => { if (open) { setDone(null); setError(null); ref.current?.focus(); } }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      // a modal: the editor's own shortcuts (Delete, V, C, H, ...) must not reach the canvas behind it
      e.stopPropagation();
      if (e.key !== 'Escape') return;
      if (busy) abortRef.current?.abort(); else onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, busy, onClose]);

  if (!open) return null;

  const run = async () => {
    setError(null);
    setDone(null);
    const abort = new AbortController();
    abortRef.current = abort;
    setBusy({ phase: 'writing', done: 0, total: 0 });
    try {
      const m = await import('./exportPptx');
      const result = await m.exportDeckPptx({ content, presentationId, boardUrl, officeSafeFonts: officeSafe, signal: abort.signal, onProgress: setBusy });
      onDownload(result);
      setDone(`${result.slides} slide${result.slides === 1 ? '' : 's'} exported as ${result.filename}.`);
    } catch (e) {
      if (e?.name !== 'AbortError') setError(e?.message || 'The export failed.');
    } finally {
      setBusy(null);
      abortRef.current = null;
    }
  };

  const skipped = preview ? preview.skipped.hidden + preview.skipped.missing : 0;
  const noSlides = preview && preview.slides === 0;
  return (
    <div className="px-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="px-dialog" role="dialog" aria-modal="true" aria-labelledby="px-title" tabIndex={-1} ref={ref} data-testid="pptx-dialog">
        <h2 id="px-title">Export PowerPoint</h2>
        {preview ? (
          <p className="px-summary" data-testid="pptx-summary">
            <strong>{preview.slides}</strong> slide{preview.slides === 1 ? '' : 's'} from &ldquo;{preview.title}&rdquo;
            {skipped > 0 ? `; ${skipped} skipped (${[preview.skipped.hidden ? `${preview.skipped.hidden} hidden` : '', preview.skipped.missing ? `${preview.skipped.missing} missing` : ''].filter(Boolean).join(', ')})` : ''}.
            {preview.pictures > 0 ? ` ${preview.pictures} diagram group${preview.pictures === 1 ? '' : 's'} will be pictures.` : ''}
          </p>
        ) : <p className="px-summary" data-testid="pptx-summary">Preparing&hellip;</p>}

        <label className="px-opt">
          <input type="checkbox" checked={officeSafe} onChange={(e) => setOfficeSafe(e.target.checked)} data-testid="pptx-office-fonts" />
          <span>
            <strong>Office-safe fonts</strong> (Arial, Georgia, Courier New)
            <small>{officeSafe
              ? 'Predictable on every computer. Turn off to keep the theme fonts.'
              : `Keeps ${preview ? [...new Set([FONT_LABELS[preview.fonts.heading], FONT_LABELS[preview.fonts.body]])].join(' and ') : 'the theme fonts'}. People who open the file need those fonts installed, or PowerPoint replaces them.`}</small>
          </span>
        </label>

        <section aria-label="What to expect" className="px-limits" data-testid="pptx-fidelity">
          <h3>What to expect</h3>
          <ul>{FIDELITY_NOTES.map((n) => <li key={n}>{n}</li>)}</ul>
        </section>

        {preview && preview.warnings.length > 0 && (
          <section aria-label="Warnings" className="px-warn" data-testid="pptx-warnings">
            <h3>Heads-up for this deck</h3>
            <ul>{preview.warnings.slice(0, 12).map((w) => <li key={w}>{w}</li>)}</ul>
            {preview.warnings.length > 12 && <p>and {preview.warnings.length - 12} more.</p>}
          </section>
        )}

        {busy && <p role="status" className="px-progress">{PHASE_LABEL[busy.phase] || 'Working'}{busy.phase === 'diagrams' ? ` ${Math.min(busy.done + 1, busy.total)} of ${busy.total}` : ''}&hellip;</p>}
        {error && <p role="alert" className="px-error">{error}</p>}
        {done && <p role="status" className="px-done" data-testid="pptx-done">{done}</p>}

        <div className="px-actions">
          {busy
            ? <button type="button" className="px-btn" onClick={() => abortRef.current?.abort()}>Cancel</button>
            : <button type="button" className="px-btn" onClick={onClose} data-testid="pptx-close">{done ? 'Close' : 'Cancel'}</button>}
          <button type="button" className="px-btn primary" onClick={run} disabled={!!busy || !preview || noSlides} data-testid="pptx-export">Export .pptx</button>
        </div>
      </div>
      <style jsx>{`
        .px-backdrop { position: fixed; inset: 0; z-index: 1300; background: rgba(15, 23, 42, 0.45); display: flex; align-items: center; justify-content: center; padding: 16px; }
        .px-dialog { width: min(520px, 100%); max-height: calc(100vh - 32px); overflow: auto; background: var(--surface, #fff); color: var(--text, #1f2937); border-radius: 14px; padding: 18px 20px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.3); outline: none; font-size: 13px; display: flex; flex-direction: column; gap: 12px; }
        h2 { margin: 0; font-size: 17px; }
        h3 { margin: 0 0 4px; font-size: 13px; }
        .px-summary { margin: 0; }
        .px-opt { display: flex; gap: 10px; align-items: flex-start; cursor: pointer; }
        .px-opt input { margin-top: 3px; }
        .px-opt small { display: block; color: var(--text-muted, #6b7280); margin-top: 2px; }
        ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 4px; }
        .px-limits { padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; }
        .px-warn { padding: 10px 12px; border-radius: 10px; background: #fffbeb; color: #78350f; }
        .px-progress, .px-done { margin: 0; }
        .px-error { margin: 0; padding: 6px 8px; border-radius: 6px; background: #fef2f2; color: #991b1b; }
        .px-actions { display: flex; gap: 8px; justify-content: flex-end; }
        .px-btn { padding: 7px 14px; border-radius: 8px; border: 1px solid var(--border, #d1d5db); background: transparent; color: inherit; font: inherit; font-weight: 500; cursor: pointer; }
        .px-btn.primary { background: var(--accent, #4fb3ce); border-color: var(--accent, #4fb3ce); color: #06222b; }
        .px-btn:disabled { opacity: 0.5; cursor: default; }
        .px-btn:focus-visible, .px-opt input:focus-visible { outline: 2px solid var(--accent, #4fb3ce); outline-offset: 1px; }
      `}</style>
    </div>
  );
}

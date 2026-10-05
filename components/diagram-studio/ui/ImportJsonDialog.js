// components/diagram-studio/ui/ImportJsonDialog.js
// Confirmation / error dialog for JSON import. State comes from useJsonImport().

import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import CloseIcon from '@mui/icons-material/Close';

export default function ImportJsonDialog({ pending, error, busy, onMerge, onCreateNew, onClose, readOnly = false }) {
  const open = !!pending || !!error;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof window === 'undefined') return null;

  const content = (
    <div className="import-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="import-dialog" role="dialog" aria-modal="true" aria-label="Import JSON" data-testid="import-dialog">
        <div className="import-header">
          <h2>{pending ? 'Import diagram' : 'Import failed'}</h2>
          <button className="import-close" onClick={onClose} aria-label="Close"><CloseIcon fontSize="small" /></button>
        </div>

        {error && <p className="import-error" role="alert">{error}</p>}

        {pending && (
          <div className="import-body">
            <p className="import-file">
              <strong>{pending.name}</strong> <span>({pending.fileName})</span>
            </p>
            <p className="import-counts">
              {pending.counts.elements} element{pending.counts.elements === 1 ? '' : 's'},{' '}
              {pending.counts.connections} connection{pending.counts.connections === 1 ? '' : 's'}
            </p>
            {pending.warnings?.length > 0 && (
              <ul className="import-warnings">
                {pending.warnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
            )}
            <p className="import-hint">
              Adding places the content at the center of your view with new IDs. Existing content is not changed.
            </p>
          </div>
        )}

        <div className="import-footer">
          <button className="import-btn" onClick={onClose}>{pending ? 'Cancel' : 'Close'}</button>
          {pending && (
            <>
              <button className="import-btn" onClick={onCreateNew} disabled={busy}>
                {busy ? 'Creating...' : 'Create new diagram'}
              </button>
              {!readOnly && (
                <button className="import-btn primary" onClick={onMerge} disabled={busy}>
                  Add to this diagram
                </button>
              )}
            </>
          )}
        </div>
      </div>

      <style jsx>{`
        .import-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 24px; }
        .import-dialog { width: 100%; max-width: 440px; background: var(--panel, #fff); color: var(--text, #1f2937); border-radius: 14px; box-shadow: 0 20px 60px rgba(0,0,0,0.25); padding: 20px; }
        .import-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
        .import-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
        .import-close { background: none; border: none; cursor: pointer; color: inherit; display: flex; padding: 4px; border-radius: 6px; }
        .import-close:hover { background: rgba(0,0,0,0.06); }
        .import-body p { margin: 0 0 8px; font-size: 13px; }
        .import-file span { color: var(--text-muted, #6b7280); }
        .import-hint { color: var(--text-muted, #6b7280); }
        .import-error { margin: 0 0 12px; font-size: 13px; color: #b91c1c; background: #fef2f2; border-radius: 8px; padding: 10px 12px; }
        .import-warnings { margin: 0 0 8px; padding-left: 18px; font-size: 12px; color: #92400e; }
        .import-footer { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; flex-wrap: wrap; }
        .import-btn { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border, #d1d5db); background: transparent; color: inherit; font-size: 13px; cursor: pointer; }
        .import-btn:hover:not(:disabled) { background: rgba(0,0,0,0.05); }
        .import-btn.primary { background: var(--accent, #4FB3CE); border-color: var(--accent, #4FB3CE); color: #fff; }
        .import-btn:disabled { opacity: 0.6; cursor: default; }
      `}</style>
    </div>
  );
  return createPortal(content, document.body);
}

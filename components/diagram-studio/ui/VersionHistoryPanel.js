// components/diagram-studio/ui/VersionHistoryPanel.js
// History panel (ADR-0001, slice 2): list of versions, "Name current version", static preview, rename and
// restore (with a confirm dialog). Props-driven (no context) so it is easy to test; DiagramStudio mounts it
// through VersionHistory (below) which wires it to the editor.
// Opened from the title-bar menu via OPEN_VERSION_HISTORY_EVENT (same pattern as the export dialog).

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { useDiagram } from '../DiagramContext';
import { getVersion, listVersions, nameCurrentVersion, renameVersion } from '../versions/versionsClient';
import { buildVersionPreview, formatKind, formatRelative, versionTitle } from '../versions/versionUtils';

export const OPEN_VERSION_HISTORY_EVENT = 'ds:open-version-history';

export default function VersionHistoryPanel({ open, diagramId, canWrite = false, onClose, onRestore, flushSave }) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(null);

  const [label, setLabel] = useState('');
  const [description, setDescription] = useState('');
  const [naming, setNaming] = useState(false);
  const [notice, setNotice] = useState(null); // { kind: 'ok'|'error', text }

  const [selected, setSelected] = useState(null); // VersionMeta
  const [detail, setDetail] = useState({ status: 'idle', preview: null, error: null });
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState(''); // kept separately so the dialog text survives its close transition
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState(null);

  const panelRef = useRef(null);
  const detailSeq = useRef(0);

  const loadFirstPage = useCallback(async () => {
    if (!diagramId) return;
    setLoading(true);
    setLoadError(null);
    try {
      const page = await listVersions(diagramId);
      setItems(page.items || []);
      setNextCursor(page.nextCursor || null);
    } catch (e) {
      setLoadError(e.message || 'Could not load versions');
    } finally {
      setLoading(false);
    }
  }, [diagramId]);

  useEffect(() => {
    if (!open) return;
    setSelected(null);
    setNotice(null);
    loadFirstPage();
  }, [open, loadFirstPage]);

  useEffect(() => {
    if (open && panelRef.current) panelRef.current.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape' && !confirmOpen) onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, confirmOpen, onClose]);

  const loadMore = async () => {
    setLoading(true);
    try {
      const page = await listVersions(diagramId, { cursor: nextCursor });
      setItems((prev) => [...prev, ...(page.items || [])]);
      setNextCursor(page.nextCursor || null);
    } catch (e) {
      setLoadError(e.message || 'Could not load more versions');
    } finally {
      setLoading(false);
    }
  };

  const select = async (v) => {
    setSelected(v);
    setRenaming(false);
    setNotice(null);
    const seq = ++detailSeq.current;
    setDetail({ status: 'loading', preview: null, error: null });
    try {
      const full = await getVersion(diagramId, v.number);
      if (seq !== detailSeq.current) return; // a newer selection superseded this one
      setDetail({ status: 'ready', preview: buildVersionPreview(full.content), error: null });
    } catch (e) {
      if (seq !== detailSeq.current) return;
      setDetail({ status: 'error', preview: null, error: e.message || 'Could not load this version' });
    }
  };

  const saveNamed = async (e) => {
    e.preventDefault();
    const trimmed = label.trim();
    if (!trimmed || naming) return;
    setNaming(true);
    setNotice(null);
    try {
      // The server snapshots what it has stored: flush unsaved edits first so the name covers what the user sees.
      if (flushSave && !(await flushSave())) {
        setNotice({ kind: 'error', text: 'Your latest edits could not be saved, so the version was not created.' });
        return;
      }
      const result = await nameCurrentVersion(diagramId, { label: trimmed, description: description.trim() });
      setNotice({
        kind: 'ok',
        text: result.created
          ? `Saved as "${trimmed}" (version #${result.version.number}).`
          : `This state is already saved as version #${result.version.number}; it is now named "${trimmed}".`,
      });
      setLabel('');
      setDescription('');
      await loadFirstPage();
    } catch (err) {
      setNotice({ kind: 'error', text: err.message || 'Could not save the version' });
    } finally {
      setNaming(false);
    }
  };

  const saveRename = async (e) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || !selected) return;
    try {
      const updated = await renameVersion(diagramId, selected.number, trimmed);
      setItems((prev) => prev.map((v) => (v.number === updated.number ? { ...v, ...updated } : v)));
      setSelected((cur) => (cur ? { ...cur, ...updated } : cur));
      setRenaming(false);
    } catch (err) {
      setNotice({ kind: 'error', text: err.message || 'Could not rename the version' });
    }
  };

  const confirmRestore = async () => {
    if (!selected || restoring) return;
    setRestoring(true);
    setRestoreError(null);
    const title = confirmTitle;
    const result = await onRestore(selected.number);
    setRestoring(false);
    if (!result?.ok) {
      setRestoreError(result?.error || 'Could not restore this version');
      return;
    }
    setConfirmOpen(false);
    setSelected(null);
    setNotice({
      kind: 'ok',
      text: result.unchanged
        ? `"${title}" is identical to the current diagram; nothing changed.`
        : result.preRestoreVersion
          ? `Restored "${title}". Your previous state was kept as version #${result.preRestoreVersion.number}.`
          : `Restored "${title}".`,
    });
    loadFirstPage();
  };

  const selectedTitle = selected ? versionTitle(selected) : '';
  const listLabel = useMemo(() => 'Versions', []);

  if (!open || typeof window === 'undefined') return null;

  const content = (
    <aside className="vh-panel" role="complementary" aria-label="Version history" tabIndex={-1} ref={panelRef}>
      <header className="vh-header">
        <h2>Version history</h2>
        <button type="button" className="vh-close" onClick={onClose} aria-label="Close version history">
          <CloseIcon fontSize="small" />
        </button>
      </header>

      <div className="vh-body">
        {canWrite && (
          <form className="vh-name-form" onSubmit={saveNamed}>
            <label htmlFor="vh-label">Version name</label>
            <input
              id="vh-label"
              type="text"
              maxLength={120}
              value={label}
              placeholder="e.g. Issued for review"
              onChange={(e) => setLabel(e.target.value)}
            />
            <label htmlFor="vh-desc">Description (optional)</label>
            <textarea
              id="vh-desc"
              rows={2}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button type="submit" className="vh-primary" disabled={!label.trim() || naming}>
              {naming ? 'Saving...' : 'Save version'}
            </button>
            <p className="vh-hint">Names the diagram as it is now. Named versions are kept permanently.</p>
          </form>
        )}

        {notice && (
          <p role={notice.kind === 'error' ? 'alert' : 'status'} className={`vh-notice vh-notice-${notice.kind}`}>{notice.text}</p>
        )}

        {selected ? (
          <section className="vh-detail" aria-label={`Version ${selected.number}`}>
            <button type="button" className="vh-link" onClick={() => setSelected(null)}>&larr; All versions</button>
            <h3>{selectedTitle}</h3>
            <p className="vh-meta">
              #{selected.number} &middot; {formatKind(selected.kind)} &middot; {selected.createdBy?.name || 'System'} &middot;{' '}
              <time dateTime={selected.createdAt} title={new Date(selected.createdAt).toLocaleString()}>{formatRelative(selected.createdAt)}</time>
              <br />
              {selected.elementCount} element{selected.elementCount === 1 ? '' : 's'}, {selected.connectionCount} connection{selected.connectionCount === 1 ? '' : 's'}
            </p>
            {selected.description && <p className="vh-desc">{selected.description}</p>}

            <div className="vh-preview">
              {detail.status === 'loading' && <span className="vh-muted">Loading preview...</span>}
              {detail.status === 'error' && <span role="alert" className="vh-error">{detail.error}</span>}
              {detail.status === 'ready' && (
                // eslint-disable-next-line @next/next/no-img-element -- static data: URL SVG, no optimization applicable
                <img src={detail.preview.url} alt={`Preview of ${selectedTitle}`} />
              )}
            </div>
            <p className="vh-hint">Simplified preview (shapes and labels). Restore to see the exact diagram.</p>

            {canWrite && (
              <div className="vh-actions">
                {renaming ? (
                  <form className="vh-rename" onSubmit={saveRename}>
                    <label htmlFor="vh-newname">New name</label>
                    <input id="vh-newname" type="text" maxLength={120} value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus />
                    <button type="submit" className="vh-secondary" disabled={!newName.trim()}>Save name</button>
                    <button type="button" className="vh-secondary" onClick={() => setRenaming(false)}>Cancel</button>
                  </form>
                ) : (
                  <button type="button" className="vh-secondary" onClick={() => { setNewName(selected.label || ''); setRenaming(true); }}>
                    Rename
                  </button>
                )}
                <button type="button" className="vh-primary" onClick={() => { setRestoreError(null); setConfirmTitle(selectedTitle); setConfirmOpen(true); }}>
                  Restore this version
                </button>
              </div>
            )}
          </section>
        ) : (
          <section aria-label="Version list">
            {loadError && (
              <div role="alert" className="vh-error">
                <p>{loadError}</p>
                <button type="button" className="vh-secondary" onClick={loadFirstPage}>Try again</button>
              </div>
            )}
            {!loadError && !loading && items.length === 0 && (
              <p className="vh-muted">
                No versions yet. Name the current diagram above to keep a restore point; a version is a permanent snapshot you can
                preview and return to later.
              </p>
            )}
            {items.length > 0 && (
              <ul className="vh-list" aria-label={listLabel}>
                {items.map((v) => (
                  <li key={v.id}>
                    <button type="button" className="vh-item" onClick={() => select(v)}>
                      <span className="vh-item-title">{versionTitle(v)}</span>
                      <span className="vh-item-meta">
                        <span className={`vh-kind vh-kind-${v.kind}`}>{formatKind(v.kind)}</span>
                        <span>{v.createdBy?.name || 'System'}</span>
                        <time dateTime={v.createdAt} title={new Date(v.createdAt).toLocaleString()}>{formatRelative(v.createdAt)}</time>
                        <span className="vh-num">#{v.number}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {loading && <p className="vh-muted" role="status">Loading...</p>}
            {nextCursor && !loading && (
              <button type="button" className="vh-secondary vh-more" onClick={loadMore}>Load more</button>
            )}
          </section>
        )}
      </div>

      <Dialog open={confirmOpen} onClose={() => !restoring && setConfirmOpen(false)} aria-labelledby="vh-restore-title" aria-describedby="vh-restore-desc">
        <DialogTitle id="vh-restore-title">Restore &ldquo;{confirmTitle}&rdquo;?</DialogTitle>
        <DialogContent>
          <DialogContentText id="vh-restore-desc">
            The diagram will be replaced with this version. Your current state is kept as a version (&quot;Before restore&quot;), so
            nothing is deleted and you can come back to it from this panel.
          </DialogContentText>
          {restoreError && <DialogContentText role="alert" sx={{ mt: 1, color: 'error.main' }}>{restoreError}</DialogContentText>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={restoring}>Cancel</Button>
          <Button onClick={confirmRestore} disabled={restoring} variant="contained">{restoring ? 'Restoring...' : 'Restore'}</Button>
        </DialogActions>
      </Dialog>

      <style jsx>{`
        .vh-panel {
          position: fixed; top: 0; right: 0; bottom: 0; z-index: 1200;
          width: min(400px, 100vw); display: flex; flex-direction: column;
          background: var(--surface, #fff); color: var(--text, #1f2937);
          border-left: 1px solid var(--border, #e5e7eb); box-shadow: -8px 0 24px rgba(0, 0, 0, 0.12);
          outline: none; font-size: 13px;
        }
        .vh-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px; border-bottom: 1px solid var(--border, #e5e7eb); }
        .vh-header h2 { margin: 0; font-size: 16px; font-weight: 600; }
        .vh-close { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border: none; border-radius: 8px; background: transparent; color: var(--text-muted, #6b7280); cursor: pointer; }
        .vh-close:hover { background: var(--bg-alt, #f3f4f6); color: var(--text, #1f2937); }
        .vh-body { flex: 1; overflow-y: auto; padding: 16px 20px; display: flex; flex-direction: column; gap: 12px; }
        .vh-name-form { display: flex; flex-direction: column; gap: 6px; padding-bottom: 12px; border-bottom: 1px solid var(--border, #e5e7eb); }
        .vh-name-form label, .vh-rename label { font-weight: 500; color: var(--text-muted, #6b7280); }
        input[type='text'], textarea { padding: 8px 10px; border: 1px solid var(--border, #d1d5db); border-radius: 8px; font: inherit; background: var(--bg, #fff); color: inherit; resize: vertical; }
        input[type='text']:focus, textarea:focus { outline: 2px solid var(--accent, #4fb3ce); outline-offset: 1px; }
        .vh-primary, .vh-secondary { padding: 8px 14px; border-radius: 8px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid transparent; }
        .vh-primary { background: var(--accent, #4fb3ce); color: #fff; }
        .vh-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .vh-secondary { background: transparent; border-color: var(--border, #d1d5db); color: var(--text, #1f2937); }
        .vh-secondary:hover { background: var(--bg-alt, #f3f4f6); }
        .vh-link { align-self: flex-start; background: none; border: none; padding: 0; color: var(--accent, #2b8aa5); cursor: pointer; font: inherit; }
        .vh-hint, .vh-muted { margin: 0; color: var(--text-muted, #6b7280); font-size: 12px; line-height: 1.45; }
        .vh-notice { margin: 0; padding: 8px 10px; border-radius: 8px; }
        .vh-notice-ok { background: rgba(79, 179, 206, 0.12); }
        .vh-notice-error, .vh-error { color: #b91c1c; }
        .vh-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .vh-item { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
        .vh-item:hover, .vh-item:focus-visible { border-color: var(--accent, #4fb3ce); background: var(--bg-alt, #f9fafb); }
        .vh-item-title { font-weight: 600; overflow-wrap: anywhere; }
        .vh-item-meta { display: flex; flex-wrap: wrap; gap: 4px 10px; color: var(--text-muted, #6b7280); font-size: 12px; }
        .vh-kind { padding: 0 6px; border-radius: 999px; background: var(--bg-alt, #f3f4f6); }
        .vh-kind-named { background: rgba(79, 179, 206, 0.18); color: #20728a; }
        .vh-num { margin-left: auto; }
        .vh-detail { display: flex; flex-direction: column; gap: 10px; }
        .vh-detail h3 { margin: 0; font-size: 15px; overflow-wrap: anywhere; }
        .vh-meta { margin: 0; color: var(--text-muted, #6b7280); line-height: 1.5; }
        .vh-desc { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
        .vh-preview { min-height: 160px; display: flex; align-items: center; justify-content: center; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; background: #fff; overflow: hidden; }
        .vh-preview img { display: block; max-width: 100%; max-height: 260px; }
        .vh-actions { display: flex; flex-wrap: wrap; gap: 8px; justify-content: space-between; }
        .vh-rename { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; width: 100%; }
        .vh-rename input { flex: 1 1 140px; }
        .vh-more { align-self: center; margin-top: 8px; }
      `}</style>
    </aside>
  );

  return createPortal(content, document.body);
}

/** Editor wiring: opens on OPEN_VERSION_HISTORY_EVENT, reads permissions from the diagram's `access` block. */
export function VersionHistory() {
  const ctx = useDiagram() || {};
  const { diagram, saveDiagram, saveStatus, restoreFromVersion } = ctx;
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_VERSION_HISTORY_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_VERSION_HISTORY_EVENT, onOpen);
  }, []);

  // Roles come from the server; when the payload has no access block, let the server decide (it enforces anyway).
  const caps = diagram?.access?.capabilities;
  const canWrite = Array.isArray(caps) ? caps.includes('version.create') && caps.includes('version.restore') : true;

  const dirty = !!saveStatus?.dirty;
  const flushSave = useCallback(async () => {
    if (!dirty) return true;
    return !!(await saveDiagram?.(true));
  }, [dirty, saveDiagram]);

  if (!diagram?.id) return null;
  return (
    <VersionHistoryPanel
      open={open}
      diagramId={diagram.id}
      canWrite={canWrite}
      onClose={() => setOpen(false)}
      onRestore={restoreFromVersion}
      flushSave={flushSave}
    />
  );
}

// components/diagram-studio/ui/RemoteUpdateNotice.js
// Subtle, non-blocking notice after live pickup (AI-2): "Updated by <person|an agent>" with what changed, a note when
// the user's own edits were kept over a remote change, and (for agent writes) a "Review agent change" action that
// opens the slice-8 compare overlay. Dismissible; plain updates fade after a while, notes about kept edits and
// agent changes stay until dismissed.

import { useEffect } from 'react';
import { describeRemoteUpdate } from '../live/livePickup';

const AUTO_DISMISS_MS = 10000;

export default function RemoteUpdateNotice({ notice, onReview, onDismiss }) {
  const sticky = !!notice && (notice.agent || notice.conflicts.length > 0);
  useEffect(() => {
    if (!notice || sticky) return undefined;
    const t = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(t);
  }, [notice, sticky, onDismiss]);

  if (!notice) return null;
  const { title, detail, conflictText } = describeRemoteUpdate(notice);
  const canReview = notice.agent && notice.agentChange && notice.agentChange.previousVersionNumber != null;
  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="remote-update-notice"
      style={{ position: 'fixed', left: 72, bottom: 16, zIndex: 1900, maxWidth: 360, padding: '10px 12px', borderRadius: 8, background: 'var(--surface, #ffffff)', color: 'var(--text, #1f2937)', border: '1px solid var(--border, #d1d5db)', boxShadow: '0 4px 16px rgba(0,0,0,.12)', fontSize: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}
    >
      <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 4, background: 'var(--accent, #4FB3CE)', marginTop: 5, flex: '0 0 auto' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{title}</div>
        {detail ? <div style={{ opacity: 0.8 }}>{detail}</div> : null}
        {conflictText ? <div data-testid="remote-update-conflicts" style={{ marginTop: 4 }}>{conflictText}</div> : null}
        {canReview ? (
          <button type="button" onClick={onReview} style={{ marginTop: 6, padding: 0, border: 0, background: 'transparent', color: 'var(--accent, #2b8aa3)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' }}>
            Review agent change
          </button>
        ) : null}
      </div>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" style={{ border: 0, background: 'transparent', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'inherit' }}>&times;</button>
    </div>
  );
}

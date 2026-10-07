// components/diagram-studio/ui/ShareDialog.js
// Share dialog (ADR-0003 section 6): who has access, add an existing user by e-mail, change a role, revoke.
// Owners also see recent sharing activity. Opened from the title-bar Share button via OPEN_SHARE_DIALOG_EVENT.
// The server enforces every rule (editors can only grant viewer/commenter; the owner cannot be removed); this
// dialog only hides controls the caller cannot use and shows the server's error messages.

import { useCallback, useEffect, useState } from 'react';
import { Dialog, DialogTitle, DialogContent, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { canGrant, canModifyMember } from '../../../lib/authz/policy';
import { describeAuditEvent, getAccess, getAudit, shareByEmail, changeMemberRole, revokeMember } from '../sharing/sharingClient';

export const OPEN_SHARE_DIALOG_EVENT = 'ds:open-share-dialog';

const ROLE_LABEL = { viewer: 'Viewer', commenter: 'Commenter', editor: 'Editor' };
const ROLE_HINT = { viewer: 'can view', commenter: 'can comment', editor: 'can edit' };
const personName = (u) => (u && (u.name || u.email)) || 'Unknown';

export function ShareDialogContent({ diagramId, myRole }) {
  const [access, setAccess] = useState(null);
  const [audit, setAudit] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');

  const isOwner = myRole === 'owner';
  const grantable = ['viewer', 'commenter', 'editor'].filter((r) => canGrant(myRole, r));

  const load = useCallback(async () => {
    try {
      setError(null);
      setAccess(await getAccess(diagramId));
      if (isOwner) setAudit((await getAudit(diagramId)).items);
    } catch (e) {
      setError(e.message);
    }
  }, [diagramId, isOwner]);

  useEffect(() => { load(); }, [load]);

  const run = async (fn, okMessage) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (okMessage) setNotice(okMessage);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onAdd = (e) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    run(async () => { await shareByEmail(diagramId, value, role); setEmail(''); }, `Shared with ${value}`);
  };

  const nameOf = (id) => {
    if (!access) return id;
    if (access.owner?.id === id) return personName(access.owner);
    const m = access.members.find((x) => x.user.id === id);
    return m ? personName(m.user) : 'a removed user';
  };

  return (
    <div className="sd-body" data-testid="share-dialog">
      <style jsx>{`
        .sd-body { display: flex; flex-direction: column; gap: 16px; min-width: min(480px, 80vw); color: var(--text, #1f2a37); }
        .sd-add { display: flex; gap: 8px; flex-wrap: wrap; }
        .sd-add input { flex: 1 1 200px; min-width: 0; }
        input, select { padding: 8px 10px; border: 1px solid var(--border, #cbd5e1); border-radius: 8px; font: inherit; background: var(--surface, #fff); color: inherit; }
        input:focus-visible, select:focus-visible, button:focus-visible { outline: 2px solid var(--accent, #4FB3CE); outline-offset: 1px; }
        .sd-btn { padding: 8px 14px; border: none; border-radius: 8px; background: var(--accent, #4FB3CE); color: #0b2530; font-weight: 600; cursor: pointer; }
        .sd-btn:disabled { opacity: 0.5; cursor: default; }
        .sd-link { background: none; border: none; color: var(--text-muted, #64748b); cursor: pointer; padding: 4px 8px; border-radius: 6px; }
        .sd-link:hover { color: #b42318; }
        h3 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted, #64748b); }
        ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        li { display: flex; align-items: center; gap: 10px; justify-content: space-between; padding: 6px 0; }
        .sd-who { min-width: 0; display: flex; flex-direction: column; }
        .sd-who strong { font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
        .sd-who span { font-size: 12px; color: var(--text-muted, #64748b); overflow: hidden; text-overflow: ellipsis; }
        .sd-role-static { font-size: 13px; color: var(--text-muted, #64748b); }
        .sd-error { color: #b42318; font-size: 13px; }
        .sd-notice { color: #067647; font-size: 13px; }
        .sd-audit li { font-size: 13px; padding: 2px 0; justify-content: flex-start; flex-wrap: wrap; }
        .sd-audit time { color: var(--text-muted, #64748b); font-size: 12px; }
      `}</style>

      {grantable.length > 0 && (
        <form className="sd-add" onSubmit={onAdd}>
          <input
            type="email"
            aria-label="Email of an existing user"
            placeholder="Email of an existing user"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            data-testid="share-email"
            autoComplete="off"
          />
          <select aria-label="Role" value={role} onChange={(e) => setRole(e.target.value)} data-testid="share-role">
            {grantable.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]} ({ROLE_HINT[r]})</option>)}
          </select>
          <button type="submit" className="sd-btn" disabled={busy || !email.trim()} data-testid="share-add">Add</button>
        </form>
      )}
      <div aria-live="polite">
        {error && <div className="sd-error" role="alert" data-testid="share-error">{error}</div>}
        {notice && !error && <div className="sd-notice" data-testid="share-notice">{notice}</div>}
      </div>

      <section>
        <h3>People with access</h3>
        {!access && !error && <div>Loading...</div>}
        {access && (
          <ul data-testid="share-members">
            <li>
              <div className="sd-who"><strong>{personName(access.owner)}</strong><span>{access.owner?.email}</span></div>
              <span className="sd-role-static">Owner</span>
            </li>
            {access.members.map((m) => {
              const editable = canModifyMember(myRole, m.role, m.role);
              return (
                <li key={m.user.id} data-testid={`member-${m.user.email}`}>
                  <div className="sd-who"><strong>{personName(m.user)}</strong><span>{m.user.email}</span></div>
                  {editable ? (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <select
                        aria-label={`Role of ${personName(m.user)}`}
                        value={m.role}
                        disabled={busy}
                        onChange={(e) => run(() => changeMemberRole(diagramId, m.user.id, e.target.value))}
                      >
                        {['viewer', 'commenter', 'editor'].filter((r) => r === m.role || canGrant(myRole, r)).map((r) => (
                          <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="sd-link"
                        disabled={busy}
                        aria-label={`Remove ${personName(m.user)}`}
                        onClick={() => run(() => revokeMember(diagramId, m.user.id), `Removed ${personName(m.user)}`)}
                      >Remove</button>
                    </span>
                  ) : (
                    <span className="sd-role-static">{ROLE_LABEL[m.role]}</span>
                  )}
                </li>
              );
            })}
            {access.members.length === 0 && <li><span className="sd-role-static">Not shared with anyone yet.</span></li>}
          </ul>
        )}
      </section>

      {isOwner && audit && (
        <section>
          <h3>Recent activity</h3>
          <ul className="sd-audit" data-testid="share-audit">
            {audit.length === 0 && <li>No activity yet.</li>}
            {audit.map((evt) => (
              <li key={evt.id}>
                <strong>{personName(evt.actor)}</strong>&nbsp;{describeAuditEvent(evt, nameOf)}
                <time dateTime={evt.occurredAt}>&nbsp;{new Date(evt.occurredAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Editor wiring: opens on OPEN_SHARE_DIALOG_EVENT; `access` is the diagram's access block. */
export function ShareDialog({ diagramId, access }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(OPEN_SHARE_DIALOG_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_SHARE_DIALOG_EVENT, onOpen);
  }, []);
  if (!diagramId) return null;
  return (
    <Dialog open={open} onClose={() => setOpen(false)} aria-labelledby="share-title" maxWidth="sm" fullWidth>
      <DialogTitle id="share-title" sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        Share
        <IconButton aria-label="Close" onClick={() => setOpen(false)} size="small"><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>
      <DialogContent>
        {open && <ShareDialogContent diagramId={diagramId} myRole={access?.role} />}
      </DialogContent>
    </Dialog>
  );
}

export default ShareDialog;

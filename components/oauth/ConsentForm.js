// components/oauth/ConsentForm.js
// Consent screen for connecting an app (ADR-0005 5.5). Always shown; Viewer is the default; editor access needs
// diagrams the user can edit, or (administrators only) "all boards I can edit". The server enforces every rule again.

import { useMemo, useState } from 'react';
import { signOut } from 'next-auth/react';

const ROLES = [
  { id: 'viewer', label: 'Viewer', help: 'Read diagrams' },
  { id: 'commenter', label: 'Commenter', help: 'Read and comment' },
  { id: 'editor', label: 'Editor', help: 'Also change diagrams' },
];
const RANK = { viewer: 0, commenter: 1, editor: 2 };
const EXPIRY = [['never', 'Until I disconnect'], ['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['365', '1 year']];

export default function ConsentForm({ rid, csrf, clientLabel, redirectHost, account, isAdmin, ceiling, diagrams, formError }) {
  const [role, setRole] = useState('viewer');
  const [mode, setMode] = useState('all');
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);

  const isEditor = role === 'editor';
  const allBoards = isEditor && isAdmin && mode === 'all';
  const mustPick = (isEditor && !isAdmin) || mode === 'selected';
  const effectiveMode = isEditor && !isAdmin ? 'selected' : mode;
  const candidates = useMemo(() => (isEditor ? diagrams.filter((d) => d.canEdit) : diagrams), [diagrams, isEditor]);
  const chosen = picked.filter((id) => candidates.some((d) => d.id === id));
  const canSubmit = effectiveMode === 'all' || chosen.length > 0;

  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : p.length >= 50 ? p : [...p, id]));

  const switchAccount = async () => {
    setBusy(true);
    try {
      await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ rid, csrf, decision: 'switch' }),
      });
    } catch (_) { /* sign out anyway */ }
    await signOut({ callbackUrl: `/login?callbackUrl=${encodeURIComponent(`/oauth/authorize?rid=${rid}`)}` });
  };

  return (
    <main className="wrap">
      <h1>
        <strong>{clientLabel}</strong> wants to use Ontographia Lab as <strong>{account.email}</strong>
      </h1>
      <p className="muted">
        Not you?{' '}
        <button type="button" className="link" onClick={switchAccount} disabled={busy}>Switch account</button>
      </p>
      <p className="warn" role="note">Only continue if you started connecting Claude yourself just now.</p>
      <p className="muted">After you decide you will be sent back to <strong>{redirectHost}</strong>.</p>

      {formError && <p className="error" role="alert">{formError}</p>}

      <form method="POST" action="/api/oauth/consent">
        <input type="hidden" name="rid" value={rid} />
        <input type="hidden" name="csrf" value={csrf} />
        <input type="hidden" name="diagramMode" value={effectiveMode} />
        {chosen.map((id) => <input key={id} type="hidden" name="diagramIds" value={id} />)}

        <fieldset>
          <legend>Access level</legend>
          {ROLES.map((r) => {
            const disabled = RANK[r.id] > RANK[ceiling];
            return (
              <label key={r.id} className={disabled ? 'opt off' : 'opt'}>
                <input type="radio" name="role" value={r.id} checked={role === r.id} disabled={disabled} onChange={() => setRole(r.id)} />
                <span><strong>{r.label}</strong> <span className="muted">{r.help}</span></span>
              </label>
            );
          })}
        </fieldset>

        <fieldset>
          <legend>Diagrams</legend>
          {!(isEditor && !isAdmin) && (
            <>
              <label className="opt">
                <input type="radio" checked={mode === 'all'} onChange={() => setMode('all')} />
                <span>{isEditor ? <strong>All boards I can edit</strong> : <strong>All my diagrams</strong>} <span className="muted">{isEditor ? '(including ones created later)' : '(owned by me or shared with me)'}</span></span>
              </label>
              <label className="opt">
                <input type="radio" checked={mode === 'selected'} onChange={() => setMode('selected')} />
                <span><strong>Only the diagrams I choose</strong></span>
              </label>
            </>
          )}
          {isEditor && !isAdmin && <p className="muted">Editor access is limited to the diagrams you choose (up to 50), from those you can edit.</p>}
          {allBoards && (
            <p className="warn" role="note">
              Claude can change any board you can edit; every change is saved as a version you can restore. Boards shared with you as viewer or commenter, and other people&apos;s private boards, stay out of reach.
            </p>
          )}
          {mustPick && (
            <div className="picker" role="group" aria-label="Choose diagrams">
              {candidates.length === 0 && <p className="muted">{isEditor ? 'You have no diagrams you can edit.' : 'You have no diagrams.'}</p>}
              {candidates.map((d) => (
                <label key={d.id} className="opt">
                  <input type="checkbox" checked={picked.includes(d.id)} onChange={() => toggle(d.id)} />
                  <span>{d.name} <span className="muted">{d.shortId}, {d.role}</span></span>
                </label>
              ))}
              <p className="muted">{chosen.length} selected</p>
            </div>
          )}
        </fieldset>

        <label className="field">
          Access lasts
          <select name="expiresInDays" defaultValue="never">
            {EXPIRY.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>

        <ul className="muted effects">
          <li>Claude can read the diagrams you choose. Every change it makes is versioned and can be restored from History.</li>
          <li>Diagram text is treated as data, not instructions.</li>
          <li>Disconnect at any time in Account, API tokens, Connected apps.</li>
        </ul>

        <div className="actions">
          <button type="submit" name="decision" value="deny" className="secondary" formNoValidate>Cancel</button>
          <button type="submit" name="decision" value="approve" className="primary" disabled={!canSubmit}>Approve</button>
        </div>
      </form>

      <style jsx>{`
        .wrap { max-width: 560px; margin: 6vh auto; padding: 0 16px 48px; font-family: Inter, system-ui, sans-serif; color: #1a2b3c; }
        h1 { font-size: 22px; line-height: 1.3; margin: 0 0 8px; }
        .muted { color: #5a6b7c; font-size: 14px; }
        .warn { background: #fff8e1; border-left: 3px solid #f0d98a; padding: 8px 12px; font-size: 14px; }
        .error { background: #fdecea; border-left: 3px solid #d33; padding: 8px 12px; font-size: 14px; }
        fieldset { border: 1px solid #d5dde5; border-radius: 8px; margin: 16px 0; padding: 8px 14px 12px; }
        legend { font-weight: 600; padding: 0 6px; }
        .opt { display: flex; gap: 8px; align-items: flex-start; padding: 6px 0; cursor: pointer; }
        .opt.off { opacity: 0.5; cursor: not-allowed; }
        .picker { max-height: 220px; overflow: auto; border-top: 1px solid #e6ecf1; margin-top: 8px; padding-top: 4px; }
        .field { display: flex; flex-direction: column; gap: 4px; font-size: 14px; margin: 8px 0 16px; }
        select { padding: 8px; border-radius: 6px; border: 1px solid #c2ccd6; }
        .effects { padding-left: 18px; }
        .actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 16px; }
        button { font: inherit; border-radius: 8px; padding: 10px 18px; cursor: pointer; border: 1px solid transparent; }
        .primary { background: #4FB3CE; color: #06303c; font-weight: 600; }
        .primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .secondary { background: #fff; border-color: #c2ccd6; }
        .link { background: none; border: 0; padding: 0; color: #2a7f99; text-decoration: underline; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline: 2px solid #4FB3CE; outline-offset: 2px; }
      `}</style>
    </main>
  );
}

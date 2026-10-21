// components/diagram-studio/activity/ActivityTab.js
// Activity tab of the right-hand history panel (ADR-0006 5.3): a live row for agents on the board (from the revision
// probe), then the merged feed (edit sessions, agent edits, restores, named versions, and sharing events for the owner)
// grouped by day and actor, with Review / Compare links that open the slice-8 diff. Read-only: nothing here writes.

import { useCallback, useEffect, useRef, useState } from 'react';
import { listActivity } from './activityClient';
import { compareTarget, describeShare, groupActivity, sessionTime, summarizeCounts } from './activityUtils';
import { getVersionDiff } from '../versions/versionsClient';
import { requestReveal, setCompare, useCompare } from '../versions/compareStore';
import CompareSummary from '../ui/CompareSummary';
import { formatAge } from '../ui/AgentIndicator';

const AGENT_COLOR = '#9A8AC8';
const PAGE = 30;

const glyph = (kind) => ({ agent_edit: '◆', restore: '↺', share: '→', named_version: '●' }[kind] || '○');
const clock = (iso) => new Date(iso).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });

function liveText(a) {
  const base = a.state === 'recent' ? `${a.label} was active ${formatAge(a.ageMs)}` : `${a.label} is ${a.state}`;
  return a.mine ? `${base} (you)` : base;
}

export default function ActivityTab({ diagramId, headRevision, agents = [], flushSave, onOpenVersion }) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [more, setMore] = useState(false);
  const [cmp, setCmp] = useState(null); // { key, status, diff?, against?, title?, error? }
  const overlay = useCompare();
  const seq = useRef(0);
  const cmpSeq = useRef(0);

  const loadFirst = useCallback(async () => {
    if (!diagramId) return;
    const mine = ++seq.current;
    try {
      const page = await listActivity(diagramId, { limit: PAGE });
      if (mine !== seq.current) return;
      setItems(page.items);
      setNextCursor(page.nextCursor);
      setStatus('ready');
      setError(null);
    } catch (e) {
      if (mine !== seq.current) return;
      setError(e.message || 'Could not load activity');
      setStatus((s) => (s === 'ready' ? s : 'error'));
    }
  }, [diagramId]);

  // First load, and a refresh whenever the board moves (the probe reports a new revision)
  useEffect(() => { loadFirst(); }, [loadFirst, headRevision]);

  const loadMore = async () => {
    if (!nextCursor || more) return;
    setMore(true);
    try {
      const page = await listActivity(diagramId, { cursor: nextCursor, limit: PAGE });
      setItems((prev) => [...prev, ...page.items.filter((p) => !prev.some((x) => x.id === p.id))]);
      setNextCursor(page.nextCursor);
    } catch (e) {
      setError(e.message || 'Could not load more');
    } finally {
      setMore(false);
    }
  };

  const runCompare = async (key, item, title) => {
    const target = compareTarget(item, headRevision);
    if (!target) return;
    const mine = ++cmpSeq.current;
    setCmp({ key, status: 'loading', against: target.to });
    try {
      if (target.to === 'head' && flushSave && !(await flushSave())) {
        if (mine === cmpSeq.current) setCmp({ key, status: 'error', error: 'Your latest edits could not be saved, so the comparison was not run.' });
        return;
      }
      const diff = await getVersionDiff(diagramId, target.from, target.to);
      if (mine !== cmpSeq.current) return;
      setCmp({ key, status: 'ready', diff, against: target.to, title, approximate: target.approximate, from: target.from });
      // Only a comparison against the live board can be drawn on the canvas (positions are the current ones).
      setCompare(target.to === 'head' ? { from: { number: target.from, title }, to: 'head', changes: diff.changes, summary: diff.summary } : null);
    } catch (e) {
      if (mine === cmpSeq.current) setCmp({ key, status: 'error', error: e.message || 'Could not compare these versions' });
    }
  };
  const toggleOverlay = () => {
    if (overlay) { setCompare(null); return; }
    if (cmp?.status === 'ready' && cmp.against === 'head') {
      setCompare({ from: { number: cmp.from, title: cmp.title }, to: 'head', changes: cmp.diff.changes, summary: cmp.diff.summary });
    }
  };

  const groups = groupActivity(items, Date.now());
  const agentList = Array.isArray(agents) ? agents : [];

  const compareBox = (key) => (cmp && cmp.key === key ? (
    <div className="act-cmp">
      {cmp.status === 'loading' && <p className="act-muted" role="status">Comparing...</p>}
      {cmp.status === 'error' && <p role="alert" className="act-error">{cmp.error}</p>}
      {cmp.status === 'ready' && (
        <CompareSummary
          diff={cmp.diff}
          against={cmp.against}
          fromTitle={cmp.title}
          overlayOn={!!overlay}
          onToggleOverlay={toggleOverlay}
          onReveal={cmp.against === 'head' ? requestReveal : null}
        />
      )}
      <button type="button" className="act-link" onClick={() => { cmpSeq.current += 1; setCmp(null); if (cmp.against === 'head') setCompare(null); }}>Close comparison</button>
    </div>
  ) : null);

  const compareButton = (key, item, title, verb) => {
    const target = compareTarget(item, headRevision);
    if (!target) return null;
    const label = verb === 'Review' ? 'Review' : target.to === 'head' ? 'Compare with now' : 'Compare';
    return (
      <button type="button" className="act-link" onClick={() => runCompare(key, item, title)} disabled={cmp?.key === key && cmp.status === 'loading'}>
        {label}{target.approximate && verb !== 'Review' ? ' (approximate)' : ''}
      </button>
    );
  };

  return (
    <div className="act-root">
      {agentList.length > 0 && (
        <ul className="act-live" aria-label="Agents on this board">
          {agentList.map((a) => (
            <li key={a.key} data-testid="activity-live">
              <span className="act-dot" aria-hidden="true" style={{ color: AGENT_COLOR }}>{'●'}</span> {liveText(a)}
            </li>
          ))}
        </ul>
      )}

      {status === 'loading' && <p className="act-muted" role="status">Loading...</p>}
      {status === 'error' && (
        <div role="alert" className="act-error">
          <p>{error}</p>
          <button type="button" className="act-btn" onClick={() => { setStatus('loading'); loadFirst(); }}>Try again</button>
        </div>
      )}
      {status === 'ready' && items.length === 0 && (
        <p className="act-muted">No activity yet. Saves, agent edits, restores and named versions will appear here.</p>
      )}

      {groups.map((g) => (
        <section key={g.day} aria-label={g.day}>
          <h3 className="act-day">{g.day}</h3>
          <ul className="act-list">
            {g.rows.map((row) => {
              if (row.type === 'agent_group') {
                const first = row.items[0];
                const who = `${row.label}${row.onBehalfOf?.name ? ` for ${row.onBehalfOf.name}` : ''}`;
                const newest = first;
                const oldest = row.items[row.items.length - 1];
                return (
                  <li key={row.key} className="act-row" data-testid="activity-agent-group">
                    <div className="act-head"><span className="act-glyph" style={{ color: AGENT_COLOR }} aria-hidden="true">{glyph('agent_edit')}</span><strong>{who}</strong><time dateTime={first.at}>{clock(first.at)}</time></div>
                    <div className="act-sub">
                      {row.count} {row.count === 1 ? 'change' : 'changes'}{row.summary ? ` · ${row.summary}` : ''}{row.tools.length ? ` · ${row.tools.join(', ')}` : ''}
                    </div>
                    <div className="act-actions">
                      {compareButton(row.key, { ...newest, compare: { ...newest.compare, from: oldest.compare?.from ?? newest.compare?.from } }, 'Before the agent change', 'Review')}
                    </div>
                    {compareBox(row.key)}
                  </li>
                );
              }
              const it = row.item;
              if (it.kind === 'agent_edit') {
                const who = `${it.agent?.label || 'Agent'}${it.onBehalfOf?.name ? ` for ${it.onBehalfOf.name}` : ''}`;
                const summary = Object.keys(it.counts || {}).length ? ` · ${summarizeCounts(it.counts)}` : '';
                return (
                  <li key={row.key} className="act-row">
                    <div className="act-head"><span className="act-glyph" style={{ color: AGENT_COLOR }} aria-hidden="true">{glyph('agent_edit')}</span><strong>{who}</strong><time dateTime={it.at}>{clock(it.at)}</time></div>
                    <div className="act-sub">{it.agent?.tool || 'edit'}{summary}</div>
                    <div className="act-actions">{compareButton(row.key, it, 'Before the agent change', 'Review')}</div>
                    {compareBox(row.key)}
                  </li>
                );
              }
              if (it.kind === 'edit_session') {
                return (
                  <li key={row.key} className="act-row">
                    <div className="act-head">
                      <span className="act-glyph" aria-hidden="true">{glyph('edit_session')}</span>
                      {row.sameActorAsPrevious ? <span className="act-same">{it.actor?.name}</span> : <strong>{it.actor?.name}</strong>}
                      <time dateTime={it.at}>{sessionTime(it.at, it.endAt)}</time>
                    </div>
                    <div className="act-sub">{it.saves} {it.saves === 1 ? 'save' : 'saves'}</div>
                    <div className="act-actions">{compareButton(row.key, it, `Before ${it.actor?.name || 'the session'}`, 'Compare')}</div>
                    {compareBox(row.key)}
                  </li>
                );
              }
              if (it.kind === 'named_version') {
                return (
                  <li key={row.key} className="act-row">
                    <div className="act-head"><span className="act-glyph" aria-hidden="true">{glyph('named_version')}</span><strong>{it.actor?.name}</strong><time dateTime={it.at}>{clock(it.at)}</time></div>
                    <div className="act-sub">named &ldquo;{it.version?.name}&rdquo;</div>
                    {it.version?.number != null && onOpenVersion && (
                      <div className="act-actions"><button type="button" className="act-link" onClick={() => onOpenVersion(it.version.number)}>Open version {it.version.number}</button></div>
                    )}
                  </li>
                );
              }
              if (it.kind === 'restore') {
                return (
                  <li key={row.key} className="act-row">
                    <div className="act-head"><span className="act-glyph" aria-hidden="true">{glyph('restore')}</span><strong>{it.actor?.name}</strong><time dateTime={it.at}>{clock(it.at)}</time></div>
                    <div className="act-sub">restored version {it.restoredFrom ?? '?'}</div>
                    {it.version?.number != null && onOpenVersion && (
                      <div className="act-actions"><button type="button" className="act-link" onClick={() => onOpenVersion(it.version.number)}>Open version {it.version.number}</button></div>
                    )}
                  </li>
                );
              }
              if (it.kind === 'share') {
                return (
                  <li key={row.key} className="act-row">
                    <div className="act-head"><span className="act-glyph" aria-hidden="true">{glyph('share')}</span><strong>{it.actor?.name}</strong><time dateTime={it.at}>{clock(it.at)}</time></div>
                    <div className="act-sub">{describeShare(it.share)}</div>
                  </li>
                );
              }
              return null;
            })}
          </ul>
        </section>
      ))}

      {status === 'ready' && nextCursor && (
        <button type="button" className="act-btn act-more" onClick={loadMore} disabled={more}>{more ? 'Loading...' : 'Load more'}</button>
      )}

      <style jsx>{`
        .act-root { display: flex; flex-direction: column; gap: 10px; }
        .act-root :global(.act-live) { list-style: none; margin: 0; padding: 8px 10px; border: 1px solid ${AGENT_COLOR}; border-radius: 10px; background: rgba(154, 138, 200, 0.08); display: flex; flex-direction: column; gap: 4px; }
        .act-root :global(.act-day) { margin: 8px 0 4px; font-size: 12px; font-weight: 600; color: var(--text-muted, #6b7280); text-transform: none; }
        .act-root :global(.act-list) { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
        .act-root :global(.act-row) { padding: 9px 11px; border: 1px solid var(--border, #e5e7eb); border-radius: 10px; display: flex; flex-direction: column; gap: 3px; }
        .act-root :global(.act-head) { display: flex; align-items: baseline; gap: 8px; }
        .act-root :global(.act-head) :global(strong) { font-weight: 600; overflow-wrap: anywhere; }
        .act-root :global(.act-head) :global(time) { margin-left: auto; color: var(--text-muted, #6b7280); font-size: 12px; white-space: nowrap; }
        .act-root :global(.act-same) { color: var(--text-muted, #6b7280); }
        .act-root :global(.act-sub) { color: var(--text-muted, #6b7280); font-size: 12px; overflow-wrap: anywhere; }
        .act-root :global(.act-actions) { display: flex; gap: 12px; margin-top: 2px; }
        .act-root :global(.act-link) { padding: 0; border: 0; background: transparent; color: var(--accent, #2b8aa5); cursor: pointer; font: inherit; text-decoration: underline; }
        .act-root :global(.act-link:disabled) { opacity: 0.6; cursor: default; }
        .act-root :global(.act-btn) { padding: 8px 14px; border-radius: 8px; font: inherit; font-weight: 500; cursor: pointer; border: 1px solid var(--border, #d1d5db); background: transparent; color: inherit; }
        .act-root :global(.act-more) { align-self: center; }
        .act-root :global(.act-muted) { margin: 0; color: var(--text-muted, #6b7280); font-size: 12px; line-height: 1.45; }
        .act-root :global(.act-error) { color: #b91c1c; }
        .act-root :global(.act-cmp) { margin-top: 6px; display: flex; flex-direction: column; gap: 6px; }
      `}</style>
    </div>
  );
}


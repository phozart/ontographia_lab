// components/diagram-studio/ui/CompareSummary.js
// Summary of a VersionDiff for the History panel: counts plus the changed items grouped by kind.
// `onReveal(change)` is only passed when comparing against the current diagram: items then become buttons that make
// the canvas select / zoom to the element. Presentational and read-only.

const KIND_HEADINGS = [['element', 'Elements'], ['connection', 'Connections'], ['layer', 'Layers'], ['group', 'Groups']];

export default function CompareSummary({ diff, against, fromTitle, overlayOn, onToggleOverlay, onReveal }) {
  const { added = 0, removed = 0, changed = 0 } = diff.summary || {};
  const target = against === 'head' ? 'current diagram' : `#${diff.to?.number ?? against}`;
  return (
    <section className="vh-changes" aria-label="Changes">
      <h4>{fromTitle} &rarr; {target}</h4>
      {diff.changes.length === 0 ? (
        <p className="vh-muted">No differences. These two states have the same content.</p>
      ) : (
        <>
          <p className="vh-counts">
            <span className="vh-c vh-c-added">{added} added</span>
            <span className="vh-c vh-c-changed">{changed} changed</span>
            <span className="vh-c vh-c-removed">{removed} removed</span>
          </p>
          {against === 'head' && (
            <button type="button" className="vh-secondary" onClick={onToggleOverlay}>
              {overlayOn ? 'Hide overlay' : 'Show on canvas'}
            </button>
          )}
          {KIND_HEADINGS.map(([kind, heading]) => {
            const rows = diff.changes.filter((c) => c.kind === kind);
            if (!rows.length) return null;
            return (
              <div key={kind}>
                <h5>{heading}</h5>
                <ul className="vh-change-list">
                  {rows.map((c) => {
                    const body = (
                      <>
                        <span className={`vh-dot vh-dot-${c.change}`} aria-hidden="true" />
                        <span className="vh-change-name">{c.label || c.id}</span>
                        <span className="vh-change-meta">{c.change}{c.fields?.length ? `: ${c.fields.join(', ')}` : ''}</span>
                      </>
                    );
                    return (
                      <li key={`${c.kind}:${c.id}`}>
                        {onReveal ? (
                          <button type="button" className="vh-change" onClick={() => onReveal(c)} title="Show on canvas">{body}</button>
                        ) : (
                          <div className="vh-change">{body}</div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </>
      )}
      <style jsx>{`
        .vh-changes { display: flex; flex-direction: column; gap: 8px; border-top: 1px solid var(--border, #e5e7eb); padding-top: 10px; }
        h4 { margin: 0; font-size: 13px; overflow-wrap: anywhere; }
        h5 { margin: 6px 0 4px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #6b7280); }
        .vh-muted { margin: 0; color: var(--text-muted, #6b7280); font-size: 12px; }
        .vh-counts { margin: 0; display: flex; flex-wrap: wrap; gap: 6px 12px; font-weight: 600; }
        .vh-c-added { color: #2e9e5b; }
        .vh-c-changed { color: #b57d06; }
        .vh-c-removed { color: #d64545; }
        .vh-secondary { align-self: flex-start; padding: 6px 12px; border-radius: 8px; font: inherit; font-weight: 500; cursor: pointer; background: transparent; border: 1px solid var(--border, #d1d5db); color: var(--text, #1f2937); }
        .vh-secondary:hover { background: var(--bg-alt, #f3f4f6); }
        .vh-change-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 3px; }
        .vh-change { width: 100%; box-sizing: border-box; display: flex; align-items: baseline; gap: 8px; text-align: left; padding: 6px 8px; border: 1px solid transparent; border-radius: 8px; background: transparent; color: inherit; font: inherit; }
        button.vh-change { cursor: pointer; }
        button.vh-change:hover, button.vh-change:focus-visible { border-color: var(--accent, #4fb3ce); background: var(--bg-alt, #f9fafb); }
        .vh-dot { flex: none; width: 8px; height: 8px; border-radius: 50%; }
        .vh-dot-added { background: #2e9e5b; }
        .vh-dot-changed { background: #e0a30b; }
        .vh-dot-removed { background: #d64545; }
        .vh-change-name { font-weight: 500; overflow-wrap: anywhere; }
        .vh-change-meta { margin-left: auto; color: var(--text-muted, #6b7280); font-size: 12px; text-align: right; }
      `}</style>
    </section>
  );
}

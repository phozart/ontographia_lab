// components/diagram-studio/ui/AgentIndicator.js
// LA-2 agent indicator (ADR-0006 5.1, 5.2). The revision probe reports which agents are around and what they did last
// (agents[]); this shows it: a pill in the top bar ("Claude . reading" / "editing" / a muted "45 s ago"), a popover with
// the last action, and, for the user the agent acts for, a dashed lavender box over the region it just read.
// It reports tool calls, not intent: we cannot see Claude "thinking". Lavender is the agent color and is never the only
// signal (the pill always says what it is doing).

import { useEffect, useRef, useState } from 'react';
import { COLOR_AGENT } from '../live/remoteHighlight';

export const FOCUS_BOX_MS = 5000;

const TOOL_TEXT = {
  diagram_get: 'read the board',
  board_read_region: 'read a region',
  diagram_show: 'showed the board',
  diagram_thumbnail: 'looked at the preview',
  'resource:diagram': 'read the board',
  diagram_apply_ops: 'edited shapes',
  map_structure: 'mapped a structure',
  layout_apply: 'arranged shapes',
  doc_create: 'created a doc',
  doc_update: 'updated a doc',
  doc_get: 'read a doc',
  table_create: 'created a table',
  table_update: 'updated a table',
  table_get: 'read a table',
};

/** Plain-language past tense for a tool name; unknown tools are named as is (the name is server-supplied text). */
export function describeTool(tool) {
  if (!tool) return '';
  return TOOL_TEXT[tool] || `used ${String(tool).slice(0, 40)}`;
}

export function formatAge(ms) {
  const s = Math.max(0, Math.round((Number(ms) || 0) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s} s ago`;
  return `${Math.floor(s / 60)} min ago`;
}

const STATE_TEXT = { reading: 'reading', editing: 'editing' };

/** Top-bar pill with a popover. Renders nothing when no agent is around. */
export function AgentIndicator({ agents, canReview = false, onReview, onOpenActivity }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const list = Array.isArray(agents) ? agents : [];

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    const onDown = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('mousedown', onDown); };
  }, [open]);

  if (list.length === 0) return null;
  const [first, ...others] = list;
  const text = first.state === 'recent' ? formatAge(first.ageMs) : STATE_TEXT[first.state] || first.state;
  const sentence = first.state === 'recent' ? `${first.label} was active ${formatAge(first.ageMs)}` : `${first.label} is ${text}`;
  return (
    <span ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        data-testid="agent-pill"
        data-state={first.state}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : 'false'}
        onClick={() => setOpen((v) => !v)}
        style={{
          '--agent-color': COLOR_AGENT,
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 28, padding: '0 10px', borderRadius: 999,
          border: '1.5px solid var(--agent-color)', background: 'transparent', color: 'rgba(255, 255, 255, 0.92)', // the top bar is always dark
          font: '600 12px/1 system-ui, sans-serif', cursor: 'pointer', opacity: first.state === 'recent' ? 0.65 : 1,
          maxWidth: 220, whiteSpace: 'nowrap',
        }}
      >
        <span aria-hidden="true" style={{ color: 'var(--agent-color)' }}>{'◆'}</span>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{`${first.label} · ${text}`}</span>
        {others.length > 0 ? <span aria-hidden="true">{`+${others.length}`}</span> : null}
      </button>
      <span role="status" aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{sentence}</span>
      {open ? (
        <div
          data-testid="agent-popover"
          style={{
            position: 'absolute', top: 34, right: 0, zIndex: 2000, minWidth: 240, maxWidth: 320, padding: 10, borderRadius: 8,
            background: 'var(--surface, #ffffff)', color: 'var(--text, #1f2937)', border: '1px solid var(--border, #d1d5db)',
            boxShadow: '0 4px 16px rgba(0,0,0,.18)', fontSize: 13, textAlign: 'left',
          }}
        >
          {list.map((a) => (
            <div key={a.key} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600 }}>{a.label}</div>
              <div style={{ opacity: 0.8 }}>
                {a.tool ? `Last: ${describeTool(a.tool)} · ${formatAge(a.ageMs)}` : formatAge(a.ageMs)}
              </div>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 12 }}>
            {canReview ? <button type="button" onClick={() => { setOpen(false); onReview?.(); }} style={linkButton}>Review agent change</button> : null}
            {onOpenActivity ? <button type="button" onClick={() => { setOpen(false); onOpenActivity(); }} style={linkButton}>Open activity</button> : null}
          </div>
        </div>
      ) : null}
    </span>
  );
}

const linkButton = { padding: 0, border: 0, background: 'transparent', color: 'var(--accent, #2b8aa3)', cursor: 'pointer', font: 'inherit', textDecoration: 'underline' };

/**
 * Boxes to draw now: one per new read (lastAt) of an agent the viewer owns, each for FOCUS_BOX_MS. Agents of other
 * users never carry a focus (the server withholds it), and a defensive `mine` check backs that up.
 */
export function useAgentFocus(agents) {
  const [boxes, setBoxes] = useState([]);
  const seen = useRef(new Map());
  const timers = useRef(new Set());

  useEffect(() => {
    const fresh = [];
    for (const a of Array.isArray(agents) ? agents : []) {
      if (!a.mine || a.state !== 'reading' || !a.focus) continue;
      if (seen.current.get(a.key) === a.lastAt) continue;
      seen.current.set(a.key, a.lastAt);
      fresh.push({ id: `${a.key}:${a.lastAt}`, rect: a.focus, label: `${a.label} is reading` });
    }
    if (fresh.length === 0) return;
    setBoxes((prev) => [...prev, ...fresh]);
    const t = setTimeout(() => {
      timers.current.delete(t);
      setBoxes((prev) => prev.filter((b) => !fresh.some((f) => f.id === b.id)));
    }, FOCUS_BOX_MS);
    timers.current.add(t);
  }, [agents]);

  useEffect(() => () => { for (const t of timers.current) clearTimeout(t); timers.current.clear(); }, []);
  return boxes;
}

/** Dashed lavender rectangles in canvas coordinates: render inside the scaled canvas layer. */
export function AgentFocusLayer({ boxes, scale = 1 }) {
  if (!boxes || boxes.length === 0) return null;
  const stroke = 2 / (scale || 1);
  return (
    <div aria-hidden="true" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 890 }}>
      {boxes.map((b) => (
        <div
          key={b.id}
          data-testid="agent-focus-box"
          style={{
            position: 'absolute', left: b.rect.x, top: b.rect.y, width: b.rect.w, height: b.rect.h, boxSizing: 'border-box',
            borderStyle: 'dashed', borderWidth: stroke, borderColor: COLOR_AGENT, borderRadius: 8, background: 'rgba(154, 138, 200, 0.07)',
          }}
        >
          <span style={{ position: 'absolute', left: 0, top: -22 / (scale || 1), transform: `scale(${1 / (scale || 1)})`, transformOrigin: '0 0', background: COLOR_AGENT, color: '#fff', font: '600 11px/1 system-ui, sans-serif', padding: '4px 8px', borderRadius: 4, whiteSpace: 'nowrap' }}>
            {b.label}
          </span>
        </div>
      ))}
    </div>
  );
}

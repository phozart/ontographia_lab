// components/diagram-studio/live/livePickup.js
// Pure helpers for live pickup (AI-2): content normalization shared with setDiagram, undo-history rebasing after a
// merge (lazy), and the wording of the "Updated by ..." notice. No React, no fetch (the provider owns those).

import { normalizeDiagramContent } from '../migrations/normalizeContent';
import { migrateDiagram } from '../migrations/migrateDiagram';
import { mergeContent } from '../../../lib/merge/threeWay';

export const LIVE_POLL_VISIBLE_MS = 3000;
export const LIVE_POLL_HIDDEN_MS = 30000;
// Remote deltas kept for lazy undo rebasing; an undo snapshot older than this many pickups is dropped when reached.
export const REMOTE_LOG_LIMIT = 20;

/**
 * The four collections of a diagram API body, exactly as setDiagram derives them (legacy shapes normalized, legacy
 * element types upgraded, top-level fields take precedence over `content`).
 */
export function contentFromDiagram(d) {
  const content = migrateDiagram(normalizeDiagramContent(d.content));
  return {
    elements: migrateDiagram({ elements: d.elements }).elements || content.elements,
    connections: d.connections || content.connections,
    layers: d.layers || content.layers,
    groups: d.groups || content.groups,
    presentations: d.presentations || content.presentations || [],
    theme: d.theme || content.theme,
  };
}

/**
 * Lazy undo rebasing. Undo/redo snapshots hold full elements + connections. A pickup does NOT touch them (that cost
 * grew with snapshots x entities). It appends the remote delta (base -> theirs) to a small log and bumps an epoch;
 * every snapshot is stamped with the epoch it was recorded at. When undo/redo reaches a snapshot, only that one is
 * merged forward through the deltas it missed, so undoing a local edit never removes an agent's elements or
 * resurrects things the agent deleted. A snapshot older than the retained log (REMOTE_LOG_LIMIT pickups) cannot be
 * rebased: rebaseSnapshot returns null and the caller drops the history instead.
 */
export const emptyRemoteLog = () => ({ epoch: 0, deltas: [] });

const slim = (c) => ({ elements: c.elements, connections: c.connections });

/** O(1): record one pickup. Returns a new log (the input is not mutated). */
export function appendRemoteDelta(log, base, theirs) {
  const epoch = log.epoch + 1;
  const deltas = [...log.deltas, { epoch, base: slim(base), theirs: slim(theirs) }].slice(-REMOTE_LOG_LIMIT);
  return { epoch, deltas };
}

export const stampSnapshot = (snap, log) => ({ ...snap, epoch: log.epoch });

/** Merge one snapshot forward through every delta recorded after its epoch. Returns null when that is impossible. */
export function rebaseSnapshot(log, snap) {
  const from = snap.epoch || 0;
  if (from >= log.epoch) return snap;
  const missed = log.deltas.filter((d) => d.epoch > from);
  if (missed.length !== log.epoch - from) return null; // the log no longer reaches back that far
  let cur = slim(snap);
  for (const d of missed) {
    const r = mergeContent(d.base, cur, d.theirs);
    if (!r.ok) return null;
    cur = { elements: r.content.elements, connections: r.content.connections };
  }
  return { ...snap, elements: cur.elements, connections: cur.connections, epoch: log.epoch };
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * @param {{who: string|null, agent: boolean, summary: {added: number, removed: number, changed: number}, conflicts: Array}} n
 * @returns {{title: string, detail: string, conflictText: string|null}}
 */
export function describeRemoteUpdate(n) {
  const who = n.agent ? 'an agent' : (n.who || 'someone else');
  const parts = [];
  if (n.summary.added) parts.push(`${n.summary.added} added`);
  if (n.summary.changed) parts.push(`${n.summary.changed} changed`);
  if (n.summary.removed) parts.push(`${n.summary.removed} removed`);
  const kept = n.conflicts.filter((c) => c.resolution === 'local-wins' || c.resolution === 'kept-local-edit' || c.resolution === 'kept-local-delete');
  const dropped = n.conflicts.filter((c) => c.resolution === 'dropped-dangling');
  const bits = [];
  if (kept.length) bits.push(`your edits were kept on ${plural(kept.length, 'item')} where you both changed the same thing`);
  if (dropped.length) bits.push(`${plural(dropped.length, 'connection')} to deleted shapes ${dropped.length === 1 ? 'was' : 'were'} removed`);
  // table merges report remote cell changes that could not be applied (type change, removed column, cap fallback)
  let lostTable = 0;
  for (const c of n.conflicts) {
    for (const f of c.fields || []) {
      const m = /(?:^|\.)lost:(cell|table)(?::[^:]+:[^:]+|:(\d+))?$/.exec(f);
      if (m) lostTable += m[1] === 'table' ? Number(m[2]) || 1 : 1;
    }
  }
  if (lostTable) bits.push(`${plural(lostTable, 'remote table change')} could not be applied`);
  return {
    title: `Updated by ${who}`,
    detail: parts.join(', '),
    conflictText: bits.length ? `${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.length > 1 ? `; ${bits.slice(1).join('; ')}` : ''}.` : null,
  };
}

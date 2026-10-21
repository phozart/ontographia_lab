// components/diagram-studio/live/livePickup.js
// Pure helpers for live pickup (AI-2): content normalization shared with setDiagram, undo-history rebasing after a
// merge, and the wording of the "Updated by ..." notice. No React, no fetch (the provider owns those).

import { normalizeDiagramContent } from '../migrations/normalizeContent';
import { migrateDiagram } from '../migrations/migrateDiagram';
import { mergeContent } from '../../../lib/merge/threeWay';

export const LIVE_POLL_VISIBLE_MS = 3000;
export const LIVE_POLL_HIDDEN_MS = 30000;
// Above this many entities across the undo/redo stacks we drop the history instead of rebasing it (cost guard).
export const REBASE_WORK_LIMIT = 400000;

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
  };
}

/**
 * Undo/redo snapshots hold full elements + connections. After a remote merge each one is merged with the same
 * remote delta (base -> theirs), so undoing a local edit never removes an agent's elements or resurrects things the
 * agent deleted, and the stacks stay usable. Returns null when history cannot be rebased (caller clears it).
 */
export function rebaseHistory(past, future, base, theirs) {
  const snaps = [...past, ...future];
  const work = snaps.reduce((n, s) => n + s.elements.length + s.connections.length, 0);
  if (work > REBASE_WORK_LIMIT) return null;
  const slim = (c) => ({ elements: c.elements, connections: c.connections });
  const rebase = (s) => {
    const r = mergeContent(slim(base), slim(s), slim(theirs));
    if (!r.ok) return null;
    return { ...s, elements: r.content.elements, connections: r.content.connections };
  };
  const rebased = snaps.map(rebase);
  if (rebased.some((s) => s === null)) return null;
  return { past: rebased.slice(0, past.length), future: rebased.slice(past.length) };
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
  return {
    title: `Updated by ${who}`,
    detail: parts.join(', '),
    conflictText: bits.length ? `${bits[0].charAt(0).toUpperCase()}${bits[0].slice(1)}${bits.length > 1 ? `; ${bits[1]}` : ''}.` : null,
  };
}

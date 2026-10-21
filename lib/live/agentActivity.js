// lib/live/agentActivity.js
// In-memory per-board agent activity register (ADR-0006 section 5.1). The MCP tool handlers note what an agent just
// did on a board (a read or a write, after authorize() succeeded); the revision probe asks which agents are around and
// what they are doing. Never persisted: nothing about reads reaches the database. Process-local (a `globalThis`
// singleton so dev HMR does not duplicate it, the same precedent as the in-memory rate limiters); empty after a restart.
//
// States are derived honestly from the last call, not from any claim about "thinking":
//   editing  last write < 20 s ago        reading  last read < 20 s ago        recent  newest event 20..120 s ago
// Privacy (Q-LA1): an agent's WRITES are visible to everyone who can read the board (they already see "Updated by an
// agent" and the result); its READS and read focus only to the user the agent acts for.

import { createHash } from 'crypto';

export const ACTIVE_MS = 20_000;
export const TTL_MS = 120_000;
export const MAX_KEYS = 10_000;
const MAX_LABEL = 40;

/** Text only, at most 40 chars: OAuth client names (DCR) and display names are client-controlled. */
export function sanitizeLabel(value) {
  if (typeof value !== 'string') return '';
  return value
     
    .replace(/[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁦-⁩]/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL);
}

const finite = (n) => typeof n === 'number' && Number.isFinite(n);
const cleanFocus = (f) => (f && finite(f.x) && finite(f.y) && finite(f.w) && finite(f.h) && f.w >= 0 && f.h >= 0 ? { x: f.x, y: f.y, w: f.w, h: f.h } : undefined);
const publicKey = (diagramId, tokenId) => createHash('sha256').update(`${diagramId}:${tokenId}`).digest('hex').slice(0, 10);

/**
 * @param {{now?: () => number, ttlMs?: number, maxKeys?: number}} [opts] injectable clock and limits (tests)
 */
export const SWEEP_THRESHOLD = 500;
const NAME_RETRY_MS = 60_000;

export function createAgentActivity({ now = Date.now, ttlMs = TTL_MS, maxKeys = MAX_KEYS, sweepThreshold = SWEEP_THRESHOLD } = {}) {
  let lastGlobalSweep = 0;
  const entries = new Map(); // `${diagramId}:${tokenId}` -> entry; insertion order = LRU order
  const byDiagram = new Map(); // diagramId -> Set<key>

  const newest = (e) => Math.max(e.read?.at || 0, e.write?.at || 0);
  const drop = (key) => {
    const e = entries.get(key);
    if (!e) return;
    entries.delete(key);
    const set = byDiagram.get(e.diagramId);
    if (set) { set.delete(key); if (set.size === 0) byDiagram.delete(e.diagramId); }
  };

  function sweep(diagramId) {
    const t = now();
    const keys = diagramId === undefined ? [...entries.keys()] : [...(byDiagram.get(diagramId) || [])];
    for (const k of keys) { const e = entries.get(k); if (e && t - newest(e) >= ttlMs) drop(k); }
  }

  /**
   * Record that an agent just acted on a board. Call only AFTER the access check succeeded.
   * @param {{diagramId: string, tokenId: string, userId: string, kind: 'read'|'write', tool: string,
   *          clientLabel?: string, userName?: string, credential?: string, focus?: {x,y,w,h}}} n
   */
  function note({ diagramId, tokenId, userId, kind, tool, clientLabel, userName, credential, focus }) {
    if (!diagramId || !tokenId || (kind !== 'read' && kind !== 'write')) return;
    const key = `${diagramId}:${tokenId}`;
    const prev = entries.get(key);
    const entry = prev || { diagramId, key: publicKey(diagramId, tokenId), userId };
    if (prev) entries.delete(key); // re-insert: most recently used goes last
    entry.userId = userId;
    if (clientLabel !== undefined) entry.clientLabel = sanitizeLabel(clientLabel);
    if (userName !== undefined) entry.userName = sanitizeLabel(userName);
    if (credential) entry.credential = credential;
    const event = { tool: String(tool || '').slice(0, 60), at: now() };
    if (kind === 'read') entry.read = { ...event, focus: cleanFocus(focus) };
    else entry.write = event;
    entries.set(key, entry);
    if (!byDiagram.has(diagramId)) byDiagram.set(diagramId, new Set());
    byDiagram.get(diagramId).add(key);
    sweep(diagramId);
    // boards nobody polls are never swept per board: sweep everything now and then once the register has grown
    if (entries.size > sweepThreshold && now() - lastGlobalSweep >= 1000) { lastGlobalSweep = now(); sweep(); }
    while (entries.size > maxKeys) drop(entries.keys().next().value);
  }

  const needsName = (diagramId, tokenId) => {
    const e = entries.get(`${diagramId}:${tokenId}`);
    return !!e && !e.userName && !(e.nameTriedAt && now() - e.nameTriedAt < NAME_RETRY_MS);
  };
  const markNameLookup = (diagramId, tokenId) => { const e = entries.get(`${diagramId}:${tokenId}`); if (e) e.nameTriedAt = now(); };
  function setName(diagramId, tokenId, name) {
    const e = entries.get(`${diagramId}:${tokenId}`);
    if (e && name) e.userName = sanitizeLabel(name);
  }

  // The newest event this viewer may see: any write, and reads only when the agent acts for the viewer.
  const visibleEvents = (e, viewerId) => {
    const out = [];
    if (e.write) out.push({ kind: 'write', ...e.write });
    if (e.read && e.userId === viewerId) out.push({ kind: 'read', ...e.read });
    return out.sort((a, b) => b.at - a.at);
  };

  /** Agents on a board as `viewerId` may see them, newest first. Pure read of memory: no I/O. */
  function agentsFor(diagramId, viewerId) {
    sweep(diagramId);
    const t = now();
    const out = [];
    for (const key of byDiagram.get(diagramId) || []) {
      const e = entries.get(key);
      if (!e) continue;
      const [ev] = visibleEvents(e, viewerId);
      if (!ev || t - ev.at >= ttlMs) continue;
      const mine = e.userId === viewerId;
      const state = t - ev.at < ACTIVE_MS ? (ev.kind === 'write' ? 'editing' : 'reading') : 'recent';
      const label = mine
        ? (e.clientLabel || 'Personal token')
        : (e.userName ? `Agent for ${e.userName}` : 'Agent');
      const item = {
        key: e.key,
        label,
        forUser: mine ? { id: e.userId, name: e.userName || null } : { name: e.userName || null },
        mine,
        state,
        tool: ev.tool,
        lastAt: ev.at,
        ageMs: t - ev.at, // relative to the server clock, so the client needs no clock agreement
      };
      if (mine && ev.kind === 'read' && ev.focus) item.focus = ev.focus;
      out.push(item);
    }
    return out.sort((a, b) => b.lastAt - a.lastAt);
  }

  /** Newest event time this viewer can see on a board (0 when none): the probe's ETag changes when it does. */
  function maxAt(diagramId, viewerId) {
    sweep(diagramId);
    let max = 0;
    for (const key of byDiagram.get(diagramId) || []) {
      const e = entries.get(key);
      if (!e) continue;
      const [ev] = visibleEvents(e, viewerId);
      if (ev && ev.at > max) max = ev.at;
    }
    return max;
  }

  return { note, agentsFor, maxAt, needsName, markNameLookup, setName, size: () => entries.size, clear: () => { entries.clear(); byDiagram.clear(); } };
}

const GLOBAL_KEY = '__oglAgentActivity';
export const agentActivity = globalThis[GLOBAL_KEY] || (globalThis[GLOBAL_KEY] = createAgentActivity());

// lib/activity/sessions.js
// Edit-session bucketing for the activity timeline (ADR-0006 5.3, 7; migration 0011). Human web saves are coalesced
// into one row per (diagram, person, burst): a save extends the person's open session when its last_at is less than
// 10 minutes old, otherwise it opens a new one. Pure; the repository applies the decision inside the save transaction.

export const SESSION_GAP_MS = 10 * 60 * 1000;
export const RETENTION_DAYS = 365; // Q-LA3: same horizon as audit (Q-A2)

/**
 * @param {{id: number|string, last_at: Date|string, revision_to: number|string}|null} open the person's newest session on this diagram
 * @param {Date} now the save time
 * @param {number} revision the diagram revision this save produced
 * @returns {{action: 'open', revisionFrom: number, revisionTo: number} | {action: 'extend', id: number|string, revisionTo: number}}
 */
export function planSession(open, now, revision) {
  const rev = Number(revision);
  if (open) {
    const last = open.last_at instanceof Date ? open.last_at.getTime() : Date.parse(open.last_at);
    if (Number.isFinite(last) && now.getTime() - last < SESSION_GAP_MS) return { action: 'extend', id: open.id, revisionTo: rev };
  }
  return { action: 'open', revisionFrom: rev, revisionTo: rev };
}

/** Sessions whose last save is older than this are pruned. */
export function retentionCutoff(now = new Date(), days = RETENTION_DAYS) {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

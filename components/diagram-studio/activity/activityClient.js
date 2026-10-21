// components/diagram-studio/activity/activityClient.js
// Thin fetch wrapper for the activity timeline (ADR-0006 section 8). Errors carry the server's message.

/**
 * @returns {Promise<{items: object[], nextCursor: string|null}>}
 */
export async function listActivity(diagramId, { cursor, limit = 30 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  const res = await fetch(`/api/diagrams/${encodeURIComponent(diagramId)}/activity?${qs}`);
  let body = null;
  try { body = await res.json(); } catch (_) { /* empty body */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Could not load activity (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return { items: Array.isArray(body?.items) ? body.items : [], nextCursor: body?.nextCursor || null };
}

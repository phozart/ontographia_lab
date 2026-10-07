// components/diagram-studio/versions/versionsClient.js
// Thin fetch wrappers for the versions API (api-contracts.md section 3). Errors carry the server's message.

async function request(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch (_) { /* empty body */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }
  return { status: res.status, body };
}

const base = (diagramId) => `/api/diagrams/${encodeURIComponent(diagramId)}/versions`;
const jsonInit = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export async function listVersions(diagramId, { cursor, limit = 30 } = {}) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  return (await request(`${base(diagramId)}?${qs}`)).body;
}

export async function getVersion(diagramId, number) {
  return (await request(`${base(diagramId)}/${number}`)).body;
}

/** @returns {Promise<{created: boolean, version: object}>} */
export async function nameCurrentVersion(diagramId, { label, description }) {
  const payload = { kind: 'named', label };
  if (description) payload.description = description;
  const { status, body } = await request(base(diagramId), jsonInit('POST', payload));
  return status === 200 && body?.deduplicated ? { created: false, version: body.version } : { created: true, version: body };
}

/**
 * Session-end checkpoint (Q-V2): best effort, fire-and-forget. `keepalive` lets the request outlive the page
 * (pagehide / tab hidden). The server snapshots the saved head only if it differs from the latest version and
 * rate limits per user and diagram, so over-sending is harmless. Never throws.
 * @returns {Promise<boolean>} true when the request was handed to the browser
 */
export async function sendSessionEndCheckpoint(diagramId) {
  try {
    if (typeof fetch !== 'function') return false;
    await fetch(base(diagramId), { ...jsonInit('POST', { kind: 'auto', reason: 'session_end' }), keepalive: true });
    return true;
  } catch (_) {
    return false;
  }
}

export async function renameVersion(diagramId, number, label) {
  return (await request(`${base(diagramId)}/${number}`, jsonInit('PATCH', { label }))).body;
}

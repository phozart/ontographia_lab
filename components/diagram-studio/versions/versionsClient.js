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

export async function renameVersion(diagramId, number, label) {
  return (await request(`${base(diagramId)}/${number}`, jsonInit('PATCH', { label }))).body;
}

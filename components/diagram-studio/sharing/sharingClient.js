// components/diagram-studio/sharing/sharingClient.js
// Thin fetch wrappers for the sharing API (api-contracts.md section 5). Errors carry the server's message and code.

async function request(url, init) {
  const res = await fetch(url, init);
  let body = null;
  try { body = await res.json(); } catch (_) { /* empty body (204) */ }
  if (!res.ok) {
    const err = new Error(body?.error || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.code;
    throw err;
  }
  return body;
}

const base = (id) => `/api/diagrams/${encodeURIComponent(id)}`;
const jsonInit = (method, payload) => ({ method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });

export const getAccess = (id) => request(`${base(id)}/access`);
export const shareByEmail = (id, email, role) => request(`${base(id)}/shares`, jsonInit('POST', { email, role }));
export const changeMemberRole = (id, userId, role) => request(`${base(id)}/members/${encodeURIComponent(userId)}`, jsonInit('PUT', { role }));
export const revokeMember = (id, userId) => request(`${base(id)}/members/${encodeURIComponent(userId)}`, { method: 'DELETE' });
export const getAudit = (id, { cursor, limit = 20 } = {}) => {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (cursor) qs.set('cursor', cursor);
  return request(`${base(id)}/audit?${qs}`);
};

/** Human wording for an audit event (ids are resolved by the caller through the access list). */
export function describeAuditEvent(evt, nameOf = (id) => id) {
  const t = evt.target || {};
  switch (evt.action) {
    case 'share.grant': return `shared with ${nameOf(t.userId)} as ${t.role}`;
    case 'share.change': return `changed ${nameOf(t.userId)} from ${t.from} to ${t.to}`;
    case 'share.revoke': return t.self ? `${nameOf(t.userId)} left` : `removed ${nameOf(t.userId)} (${t.role})`;
    case 'version.restore': return `restored version ${t.fromVersion}`;
    default: return evt.action;
  }
}

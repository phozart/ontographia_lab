// lib/oauth/clients.js
// Client registration by Client ID Metadata Document (CIMD), closed allowlist (ADR-0005 5.3).
// - A client_id is accepted only if it is an EXACT entry of OAUTH_TRUSTED_CLIENT_IDS; anything else is refused
//   before any outbound request (no SSRF surface, no self-registration).
// - The document is fetched (not hard-coded) so redirect changes are picked up. Fetch rules: HTTPS only (loopback http
//   only outside production, for local tests), no redirects, 5 s timeout, 64 KB cap, JSON, client_id equal to the URL,
//   non-empty redirect_uris, token_endpoint_auth_method "none".
// - Cached per Cache-Control (clamped 5 min .. 24 h, default 5 min); on fetch failure the last good copy is used for
//   up to 7 days; at most one fetch per URL per minute.

import { getTrustedClientIds } from './config';

export const FETCH_TIMEOUT_MS = 5000;
export const MAX_DOCUMENT_BYTES = 64 * 1024;
const MIN_TTL_MS = 5 * 60 * 1000;
const MAX_TTL_MS = 24 * 60 * 60 * 1000;
const STALE_MAX_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_REFETCH_MS = 60 * 1000;
const MAX_REDIRECT_URIS = 20;

const cache = new Map(); // clientId -> { doc, fetchedAt, expiresAt, lastAttempt }

export function resetClientCache() {
  cache.clear();
}

const isLoopbackHost = (h) => h === 'localhost' || h === '127.0.0.1' || h === '[::1]';

/** https, or http on a loopback host outside production (local development and tests only). */
export function isAcceptableUrl(value) {
  let u;
  try {
    u = new URL(value);
  } catch {
    return false;
  }
  if (u.username || u.password || u.hash) return false;
  if (u.protocol === 'https:') return true;
  return u.protocol === 'http:' && isLoopbackHost(u.hostname) && process.env.NODE_ENV !== 'production';
}

/** Host shown on the consent screen: the host of the client_id URL (never the self-asserted name). */
export const clientLabel = (clientId) => new URL(clientId).host.slice(0, 100);

/** @returns {{ok: true, doc: object} | {ok: false, error: string}} */
export function validateClientDocument(clientId, doc) {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, error: 'invalid_document' };
  if (doc.client_id !== clientId) return { ok: false, error: 'client_id_mismatch' };
  if (doc.token_endpoint_auth_method !== 'none') return { ok: false, error: 'unsupported_auth_method' };
  const uris = doc.redirect_uris;
  if (!Array.isArray(uris) || uris.length === 0 || uris.length > MAX_REDIRECT_URIS) return { ok: false, error: 'invalid_redirect_uris' };
  for (const uri of uris) {
    if (typeof uri !== 'string' || uri.length > 2048 || !isAcceptableUrl(uri)) return { ok: false, error: 'invalid_redirect_uris' };
  }
  return {
    ok: true,
    doc: {
      clientId,
      label: clientLabel(clientId),
      name: typeof doc.client_name === 'string' ? doc.client_name.slice(0, 100) : null,
      redirectUris: [...uris],
    },
  };
}

function ttlFrom(headers) {
  const cc = String(headers.get('cache-control') || '');
  const m = /max-age=(\d+)/i.exec(cc);
  const ms = m ? Number(m[1]) * 1000 : MIN_TTL_MS;
  return Math.min(MAX_TTL_MS, Math.max(MIN_TTL_MS, ms));
}

async function readCapped(res) {
  if (!res.body || typeof res.body.getReader !== 'function') {
    const text = await res.text();
    if (Buffer.byteLength(text) > MAX_DOCUMENT_BYTES) throw new Error('too_large');
    return text;
  }
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_DOCUMENT_BYTES) {
      reader.cancel().catch(() => {});
      throw new Error('too_large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function fetchDocument(clientId, fetchImpl) {
  const res = await fetchImpl(clientId, {
    method: 'GET',
    redirect: 'error',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`status_${res.status}`);
  if (!/json/i.test(String(res.headers.get('content-type') || ''))) throw new Error('not_json');
  const text = await readCapped(res);
  const json = JSON.parse(text);
  const valid = validateClientDocument(clientId, json);
  if (!valid.ok) throw new Error(valid.error);
  return { doc: valid.doc, ttl: ttlFrom(res.headers) };
}

/**
 * @param {string} clientId
 * @param {{fetchImpl?: typeof fetch, now?: () => number}} [deps]
 * @returns {Promise<{ok: true, client: {clientId, label, name, redirectUris}} | {ok: false, error: 'unknown_client'|'client_unavailable'}>}
 */
export async function getClient(clientId, deps = {}) {
  const fetchImpl = deps.fetchImpl || fetch;
  const now = (deps.now || Date.now)();
  if (typeof clientId !== 'string' || clientId.length > 2048 || !getTrustedClientIds().includes(clientId) || !isAcceptableUrl(clientId)) {
    return { ok: false, error: 'unknown_client' };
  }
  const entry = cache.get(clientId);
  if (entry && entry.doc && now < entry.expiresAt) return { ok: true, client: entry.doc };
  if (entry && now - entry.lastAttempt < MIN_REFETCH_MS) {
    return entry.doc && now - entry.fetchedAt < STALE_MAX_MS ? { ok: true, client: entry.doc } : { ok: false, error: 'client_unavailable' };
  }
  try {
    const { doc, ttl } = await fetchDocument(clientId, fetchImpl);
    cache.set(clientId, { doc, fetchedAt: now, expiresAt: now + ttl, lastAttempt: now });
    return { ok: true, client: doc };
  } catch (err) {
    console.warn('OAuth client metadata fetch failed', clientId, err && err.message);
    const prev = cache.get(clientId);
    cache.set(clientId, { doc: prev && prev.doc, fetchedAt: prev ? prev.fetchedAt : 0, expiresAt: 0, lastAttempt: now });
    if (prev && prev.doc && now - prev.fetchedAt < STALE_MAX_MS) return { ok: true, client: prev.doc };
    return { ok: false, error: 'client_unavailable' };
  }
}

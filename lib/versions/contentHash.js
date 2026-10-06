// lib/versions/contentHash.js
// Pure helpers for version snapshots (ADR-0001): canonical JSON, content hash and summary stats.
// Framework-free so the API, a future socket server and an MCP server share one definition of
// "the same content". `viewport` is excluded from the hash: panning/zooming alone is not a change.

import crypto from 'crypto';

/** JSON.stringify with object keys sorted at every depth (arrays keep their order). */
export function canonicalJson(value) {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) out[key] = sortKeys(value[key]);
    return out;
  }
  return value;
}

/** SHA-256 hex of the canonical content, viewport excluded. */
export function contentHash(content) {
  let body = content;
  if (body && typeof body === 'object' && !Array.isArray(body) && 'viewport' in body) {
    body = { ...body };
    delete body.viewport;
  }
  const canonical = canonicalJson(body === undefined ? null : body);
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

/** Cheap summary stored with every version so listing never reads content. */
export function contentStats(content) {
  const json = JSON.stringify(content === undefined ? null : content);
  return {
    sizeBytes: Buffer.byteLength(json, 'utf8'),
    elementCount: Array.isArray(content?.elements) ? content.elements.length : 0,
    connectionCount: Array.isArray(content?.connections) ? content.connections.length : 0,
  };
}

// lib/oauth/config.js
// OAuth sign-in for the MCP server (ADR-0005). Everything is behind MCP_OAUTH_ENABLED (off by default).
//
// Canonical resource R = MCP_PUBLIC_URL (default `${issuer}/api/mcp`); issuer I = OAUTH_ISSUER (default: the NEXTAUTH_URL
// origin). Tokens are bound to R (RFC 8707); metadata documents are served from I.

export const OAUTH_SCOPES = Object.freeze(['diagrams:read', 'diagrams:comment', 'diagrams:write']);
export const OFFLINE_ACCESS = 'offline_access';
export const DEFAULT_TRUSTED_CLIENT_IDS = Object.freeze(['https://claude.ai/oauth/mcp-oauth-client-metadata']);

export function isOAuthEnabled() {
  const v = process.env.MCP_OAUTH_ENABLED;
  return v === 'true' || v === '1';
}

const stripSlash = (s) => String(s).replace(/\/+$/, '');

/** Issuer identifier I (no trailing slash). */
export function getIssuer() {
  const explicit = process.env.OAUTH_ISSUER;
  if (explicit) return stripSlash(explicit.trim());
  try {
    return new URL(process.env.NEXTAUTH_URL).origin;
  } catch {
    return 'http://localhost:3000';
  }
}

/** Canonical MCP resource URL R (no trailing slash). */
export function getResourceUrl() {
  const explicit = process.env.MCP_PUBLIC_URL;
  if (explicit) return stripSlash(explicit.trim());
  return `${getIssuer()}/api/mcp`;
}

/** RFC 9728 well-known URL of the protected resource metadata for R (path inserted after the host). */
export function getProtectedResourceMetadataUrl() {
  const r = new URL(getResourceUrl());
  const path = r.pathname === '/' ? '' : r.pathname;
  return `${r.origin}/.well-known/oauth-protected-resource${path}`;
}

/** Exact client_id URLs that may start a flow (OAUTH_TRUSTED_CLIENT_IDS, comma separated; default: Claude's). */
export function getTrustedClientIds() {
  const raw = process.env.OAUTH_TRUSTED_CLIENT_IDS;
  if (raw === undefined || raw.trim() === '') return [...DEFAULT_TRUSTED_CLIENT_IDS];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

// lib/oauth/config.js
// OAuth sign-in for the MCP server (ADR-0005). Everything is behind MCP_OAUTH_ENABLED (off by default).
//
// Canonical resource R = MCP_PUBLIC_URL (default `${issuer}/api/mcp`); issuer I = OAUTH_ISSUER (default: the NEXTAUTH_URL
// origin). Tokens are bound to R (RFC 8707); metadata documents are served from I.

export const OAUTH_SCOPES = Object.freeze(['diagrams:read', 'diagrams:comment', 'diagrams:write']);
export const OFFLINE_ACCESS = 'offline_access';
export const DEFAULT_TRUSTED_CLIENT_IDS = Object.freeze(['https://claude.ai/oauth/mcp-oauth-client-metadata']);

export const SUPPORTED_RESOURCE_PATH = '/api/mcp';

/**
 * Misconfigurations that must never go live (fail closed): in production the issuer and the resource must be https, and the
 * resource must be this server's /api/mcp (the /.well-known rewrites and the route only exist for that path).
 * @returns {string[]} human readable problems; empty when fine
 */
export function oauthConfigProblems() {
  const problems = [];
  let resource;
  let issuer;
  try { issuer = new URL(getIssuer()); } catch { problems.push('the issuer is not a valid URL'); }
  try { resource = new URL(getResourceUrl()); } catch { problems.push('MCP_PUBLIC_URL is not a valid URL'); }
  if (process.env.NODE_ENV === 'production') {
    if (issuer && issuer.protocol !== 'https:') problems.push('the issuer (OAUTH_ISSUER or NEXTAUTH_URL) must be https in production');
    if (resource && resource.protocol !== 'https:') problems.push('MCP_PUBLIC_URL must be https in production');
  }
  if (resource && resource.pathname.replace(/\/+$/, '') !== SUPPORTED_RESOURCE_PATH) {
    problems.push(`only ${SUPPORTED_RESOURCE_PATH} is supported as the MCP resource path (got ${resource.pathname})`);
  }
  return problems;
}

let reportedProblems = '';
export function resetConfigReport() { reportedProblems = ''; }

/** Flag on AND the configuration is safe. An unsafe configuration disables OAuth entirely and says why, once. */
export function isOAuthEnabled() {
  const v = process.env.MCP_OAUTH_ENABLED;
  if (v !== 'true' && v !== '1') return false;
  const problems = oauthConfigProblems();
  if (problems.length > 0) {
    const msg = problems.join('; ');
    if (msg !== reportedProblems) {
      reportedProblems = msg;
      console.error(`OAUTH_DISABLED: MCP_OAUTH_ENABLED is set but the configuration is unsafe: ${msg}`);
    }
    return false;
  }
  return true;
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

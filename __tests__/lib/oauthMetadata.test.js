/**
 * @jest-environment node
 */
// ADR-0005 O1: discovery documents (RFC 9728 protected resource metadata, RFC 8414 authorization server metadata),
// their handlers, and the next.config.js rewrites that serve them from /.well-known/*.
import { createRequire } from 'module';
import {
  OAuthProtectedResourceMetadataSchema,
  OAuthMetadataSchema,
} from '@modelcontextprotocol/sdk/shared/auth.js';
import {
  isOAuthEnabled,
  getIssuer,
  getResourceUrl,
  getProtectedResourceMetadataUrl,
  OAUTH_SCOPES,
  oauthConfigProblems,
  resetConfigReport,
} from '../../lib/oauth/config';
import { protectedResourceMetadata, authorizationServerMetadata } from '../../lib/oauth/metadata';
import prmHandler from '../../pages/api/oauth/protected-resource';
import asHandler from '../../pages/api/oauth/authorization-server';

const nodeRequire = createRequire(__filename);

const ENV_KEYS = ['MCP_OAUTH_ENABLED', 'OAUTH_ISSUER', 'MCP_PUBLIC_URL', 'NEXTAUTH_URL'];
const saved = {};
beforeEach(() => {
  for (const k of ENV_KEYS) { saved[k] = process.env[k]; delete process.env[k]; }
  process.env.NEXTAUTH_URL = 'https://lab.example.com';
});
afterEach(() => {
  for (const k of ENV_KEYS) { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; }
});

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = (b) => { res.ended = true; if (b !== undefined) res.body = b; return res; };
  return res;
}
const get = (handler, method = 'GET', headers = {}) => {
  const res = mockRes();
  return Promise.resolve(handler({ method, headers }, res)).then(() => res);
};

describe('configuration', () => {
  test('flag is off by default and only "true" or "1" turn it on', () => {
    expect(isOAuthEnabled()).toBe(false);
    for (const v of ['true', '1']) { process.env.MCP_OAUTH_ENABLED = v; expect(isOAuthEnabled()).toBe(true); }
    for (const v of ['false', '0', '', 'yes', 'TRUE']) { process.env.MCP_OAUTH_ENABLED = v; expect(isOAuthEnabled()).toBe(false); }
  });
  test('issuer and resource derive from NEXTAUTH_URL, overridable', () => {
    expect(getIssuer()).toBe('https://lab.example.com');
    expect(getResourceUrl()).toBe('https://lab.example.com/api/mcp');
    expect(getProtectedResourceMetadataUrl()).toBe('https://lab.example.com/.well-known/oauth-protected-resource/api/mcp');
    process.env.OAUTH_ISSUER = 'https://id.example.com/';
    process.env.MCP_PUBLIC_URL = 'https://mcp.example.com/api/mcp/';
    expect(getIssuer()).toBe('https://id.example.com');
    expect(getResourceUrl()).toBe('https://mcp.example.com/api/mcp');
    expect(getProtectedResourceMetadataUrl()).toBe('https://mcp.example.com/.well-known/oauth-protected-resource/api/mcp');
  });
});

describe('metadata documents', () => {
  test('protected resource metadata (RFC 9728) matches the ADR and the SDK schema', () => {
    const doc = protectedResourceMetadata();
    expect(() => OAuthProtectedResourceMetadataSchema.parse(doc)).not.toThrow();
    expect(doc).toEqual({
      resource: 'https://lab.example.com/api/mcp',
      authorization_servers: ['https://lab.example.com'],
      scopes_supported: ['diagrams:read', 'diagrams:comment', 'diagrams:write'],
      bearer_methods_supported: ['header'],
      resource_name: 'Ontographia Lab',
    });
    expect(doc.scopes_supported).not.toContain('offline_access');
  });

  test('authorization server metadata (RFC 8414) matches the ADR and the SDK schema', () => {
    const doc = authorizationServerMetadata();
    expect(() => OAuthMetadataSchema.parse(doc)).not.toThrow();
    expect(doc.issuer).toBe('https://lab.example.com');
    expect(doc.authorization_endpoint).toBe('https://lab.example.com/oauth/authorize');
    expect(doc.token_endpoint).toBe('https://lab.example.com/api/oauth/token');
    expect(doc.revocation_endpoint).toBe('https://lab.example.com/api/oauth/revoke');
    expect(doc.response_types_supported).toEqual(['code']);
    expect(doc.grant_types_supported).toEqual(['authorization_code', 'refresh_token']);
    expect(doc.code_challenge_methods_supported).toEqual(['S256']);
    expect(doc.token_endpoint_auth_methods_supported).toEqual(['none']);
    expect(doc.client_id_metadata_document_supported).toBe(true);
    expect(doc.authorization_response_iss_parameter_supported).toBe(true);
    expect(doc.scopes_supported).toEqual([...OAUTH_SCOPES, 'offline_access']);
  });

  test('no dynamic client registration is advertised', () => {
    expect(authorizationServerMetadata()).not.toHaveProperty('registration_endpoint');
  });
});

describe('well-known handlers', () => {
  test('flag off: 404 and no document', async () => {
    for (const h of [prmHandler, asHandler]) {
      const res = await get(h);
      expect(res.statusCode).toBe(404);
      expect(JSON.stringify(res.body)).not.toMatch(/authorization_endpoint|authorization_servers/);
    }
  });

  test('flag on: 200 JSON with CORS and caching headers', async () => {
    process.env.MCP_OAUTH_ENABLED = 'true';
    const prm = await get(prmHandler);
    expect(prm.statusCode).toBe(200);
    expect(prm.body).toEqual(protectedResourceMetadata());
    expect(prm.headers['access-control-allow-origin']).toBe('*');
    expect(prm.headers['cache-control']).toMatch(/max-age=\d+/);
    const as = await get(asHandler);
    expect(as.statusCode).toBe(200);
    expect(as.body).toEqual(authorizationServerMetadata());
    expect(as.headers['access-control-allow-origin']).toBe('*');
  });

  test('OPTIONS preflight is answered; other methods are 405', async () => {
    process.env.MCP_OAUTH_ENABLED = 'true';
    const pre = await get(prmHandler, 'OPTIONS');
    expect(pre.statusCode).toBe(204);
    expect(pre.headers['access-control-allow-origin']).toBe('*');
    for (const m of ['POST', 'PUT', 'DELETE']) {
      const res = await get(asHandler, m);
      expect(res.statusCode).toBe(405);
      expect(res.headers.allow).toBe('GET, OPTIONS');
    }
  });
});

describe('next.config.js rewrites', () => {
  test('serve the well-known paths from the handlers, and nothing else is rewritten', async () => {
    const cfg = nodeRequire('../../next.config.js');
    const rewrites = await cfg.rewrites();
    const list = Array.isArray(rewrites) ? rewrites : [...(rewrites.beforeFiles || []), ...(rewrites.afterFiles || []), ...(rewrites.fallback || [])];
    const map = Object.fromEntries(list.map((r) => [r.source, r.destination]));
    expect(map).toEqual({
      '/.well-known/oauth-protected-resource': '/api/oauth/protected-resource',
      '/.well-known/oauth-protected-resource/api/mcp': '/api/oauth/protected-resource',
      '/.well-known/oauth-authorization-server': '/api/oauth/authorization-server',
    });
  });
});

// Production evidence (2026-10-21): Claude's backend probes exactly these three URLs after the 401 and stops on a 404.
describe('the three well-known URLs Claude probes', () => {
  const URLS = [
    ['/.well-known/oauth-protected-resource/api/mcp', prmHandler, protectedResourceMetadata],
    ['/.well-known/oauth-protected-resource', prmHandler, protectedResourceMetadata],
    ['/.well-known/oauth-authorization-server', asHandler, authorizationServerMetadata],
  ];
  const handlerFor = async (url) => {
    const cfg = nodeRequire('../../next.config.js');
    const rule = (await cfg.rewrites()).find((r) => r.source === url);
    return rule && rule.destination;
  };

  test.each(URLS)('%s is rewritten to its handler and answers 200 JSON when enabled', async (url, handler, build) => {
    process.env.MCP_OAUTH_ENABLED = 'true';
    const dest = await handlerFor(url);
    expect(dest).toBe(handler === prmHandler ? '/api/oauth/protected-resource' : '/api/oauth/authorization-server');
    const res = await get(handler);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(build());
    expect(res.headers['access-control-allow-origin']).toBe('*');
  });

  test.each(URLS)('%s answers 404 while the flag is off (what Claude saw before OAuth was enabled)', async (url, handler) => {
    expect((await get(handler)).statusCode).toBe(404);
  });

  test('the protected resource document names the exact resource Claude was given', () => {
    process.env.MCP_PUBLIC_URL = 'https://lab.ontographia.com/api/mcp';
    expect(protectedResourceMetadata().resource).toBe('https://lab.ontographia.com/api/mcp');
    expect(getProtectedResourceMetadataUrl()).toBe('https://lab.ontographia.com/.well-known/oauth-protected-resource/api/mcp');
  });
});

describe('fail-closed configuration (security review L4)', () => {
  const setEnv = (nodeEnv) => { Object.defineProperty(process.env, 'NODE_ENV', { value: nodeEnv, configurable: true, writable: true }); };
  const prevEnv = process.env.NODE_ENV;
  afterEach(() => { setEnv(prevEnv); resetConfigReport(); jest.restoreAllMocks(); });

  test('production with an http issuer or http MCP_PUBLIC_URL disables OAuth, logs why, and the well-known routes answer 404', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setEnv('production');
    process.env.MCP_OAUTH_ENABLED = 'true';
    process.env.NEXTAUTH_URL = 'http://lab.example.com';
    expect(oauthConfigProblems().join(' ')).toMatch(/issuer.*https/);
    expect(isOAuthEnabled()).toBe(false);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining('OAUTH_DISABLED'));
    expect((await get(prmHandler)).statusCode).toBe(404);
    expect((await get(asHandler)).statusCode).toBe(404);
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    process.env.MCP_PUBLIC_URL = 'http://lab.example.com/api/mcp';
    expect(oauthConfigProblems().join(' ')).toMatch(/MCP_PUBLIC_URL.*https/);
    expect(isOAuthEnabled()).toBe(false);
  });
  test('https in production is fine; http is fine outside production', () => {
    setEnv('production');
    process.env.MCP_OAUTH_ENABLED = 'true';
    expect(oauthConfigProblems()).toEqual([]);
    expect(isOAuthEnabled()).toBe(true);
    setEnv('development');
    process.env.NEXTAUTH_URL = 'http://localhost:3000';
    expect(isOAuthEnabled()).toBe(true);
  });
  test('only /api/mcp is supported as the resource path: anything else disables OAuth (the rewrites exist for that path only)', () => {
    process.env.MCP_OAUTH_ENABLED = 'true';
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    for (const url of ['https://lab.example.com/mcp', 'https://lab.example.com/', 'https://lab.example.com/api/mcp/v2']) {
      process.env.MCP_PUBLIC_URL = url;
      expect(oauthConfigProblems().join(' ')).toMatch(/only \/api\/mcp is supported/);
      expect(isOAuthEnabled()).toBe(false);
    }
    process.env.MCP_PUBLIC_URL = 'https://lab.example.com/api/mcp/'; // trailing slash tolerated
    expect(isOAuthEnabled()).toBe(true);
    expect(spy).toHaveBeenCalled();
  });
});

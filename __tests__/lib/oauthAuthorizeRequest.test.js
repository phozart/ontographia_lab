/**
 * @jest-environment node
 */
import { validateAuthorizeRequest, parseScope, scopeForCap, resourceMatches, MAX_STATE_LENGTH } from '../../lib/oauth/authorizeRequest';
import { resetClientCache } from '../../lib/oauth/clients';
import { s256Challenge } from '../../lib/oauth/crypto';

const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const fetchImpl = async () => new Response(JSON.stringify({ client_id: CLAUDE, redirect_uris: [CB], token_endpoint_auth_method: 'none', client_name: 'Claude' }), { status: 200, headers: { 'content-type': 'application/json' } });
const challenge = s256Challenge('v'.repeat(50));
const good = (over = {}) => ({
  client_id: CLAUDE, redirect_uri: CB, response_type: 'code', state: 'st-1', code_challenge: challenge,
  code_challenge_method: 'S256', resource: 'https://lab.example.com/api/mcp', scope: 'diagrams:read diagrams:comment diagrams:write offline_access', ...over,
});
const run = (q) => validateAuthorizeRequest(q, { fetchImpl });

beforeEach(() => {
  resetClientCache();
  process.env.NEXTAUTH_URL = 'https://lab.example.com';
  delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER; delete process.env.OAUTH_TRUSTED_CLIENT_IDS;
});

test('a good request validates and carries what the grant needs', async () => {
  const r = await run(good());
  expect(r.ok).toBe(true);
  expect(r.request).toMatchObject({ clientId: CLAUDE, redirectUri: CB, state: 'st-1', codeChallenge: challenge, resource: 'https://lab.example.com/api/mcp' });
  expect(r.client.label).toBe('claude.ai');
});

describe('fatal errors (never redirected)', () => {
  test('unknown client_id, missing client_id, duplicated client_id', async () => {
    for (const q of [good({ client_id: 'https://evil.example/m' }), good({ client_id: undefined }), good({ client_id: [CLAUDE, CLAUDE] })]) {
      const r = await run(q);
      expect(r).toMatchObject({ ok: false, fatal: true, code: 'unknown_client' });
    }
  });
  test('redirect_uri must match exactly: no prefix, trailing slash, case, query, other host, missing, duplicated', async () => {
    const bad = [CB + '/', CB + '?x=1', CB.toUpperCase(), 'https://claude.ai/api/mcp/auth_callbac', 'https://claude.ai/api/mcp/auth_callback/../x', 'https://evil.example/api/mcp/auth_callback',
      'https://claude.ai.evil.example/api/mcp/auth_callback', 'http://claude.ai/api/mcp/auth_callback', ' ' + CB, 'https://claude.com/api/mcp/auth_callback', undefined, [CB, CB], '', 'javascript:alert(1)', '//evil.example/x', '/relative'];
    for (const uri of bad) {
      const r = await run(good({ redirect_uri: uri }));
      expect(r).toMatchObject({ ok: false, fatal: true, code: 'invalid_redirect_uri' });
    }
  });
  test('an unavailable client document is fatal', async () => {
    const r = await validateAuthorizeRequest(good(), { fetchImpl: async () => new Response('nope', { status: 500 }) });
    expect(r).toMatchObject({ ok: false, fatal: true, code: 'client_unavailable' });
  });
});

describe('redirected errors (carry state)', () => {
  const expectRedirect = async (over, error) => {
    const r = await run(good(over));
    expect(r).toMatchObject({ ok: false, fatal: false, redirectUri: CB, error });
    return r;
  };
  test('PKCE: missing, plain and malformed challenges and methods', async () => {
    await expectRedirect({ code_challenge_method: undefined }, 'invalid_request');
    await expectRedirect({ code_challenge_method: 'plain' }, 'invalid_request');
    await expectRedirect({ code_challenge_method: 's256' }, 'invalid_request');
    await expectRedirect({ code_challenge: undefined }, 'invalid_request');
    await expectRedirect({ code_challenge: 'short' }, 'invalid_request');
    await expectRedirect({ code_challenge: 'x'.repeat(44) }, 'invalid_request');
  });
  test('response_type must be code', async () => {
    const r = await expectRedirect({ response_type: 'token' }, 'unsupported_response_type');
    expect(r.state).toBe('st-1');
    await expectRedirect({ response_type: undefined }, 'unsupported_response_type');
  });
  test('resource must be the MCP URL (case-insensitive host, trailing slash tolerated)', async () => {
    await expectRedirect({ resource: 'https://other.example/api/mcp' }, 'invalid_target');
    await expectRedirect({ resource: 'https://lab.example.com/api/mcp/extra' }, 'invalid_target');
    await expectRedirect({ resource: 'https://lab.example.com/' }, 'invalid_target');
    await expectRedirect({ resource: 'http://lab.example.com/api/mcp' }, 'invalid_target');
    await expectRedirect({ resource: 'https://lab.example.com/api/mcp?x=1' }, 'invalid_target');
    await expectRedirect({ resource: 'https://lab.example.com/api/mcp#f' }, 'invalid_target');
    await expectRedirect({ resource: ['https://lab.example.com/api/mcp', 'https://lab.example.com/api/mcp'] }, 'invalid_target');
    expect((await run(good({ resource: 'https://LAB.example.com/api/mcp/' }))).ok).toBe(true);
    expect((await run(good({ resource: undefined }))).request.resource).toBe('https://lab.example.com/api/mcp');
  });
  test('state: echoed unchanged up to 1 KB, oversize refused', async () => {
    const odd = 'a b&c=d%20é/?#';
    expect((await run(good({ state: odd }))).request.state).toBe(odd);
    const r = await run(good({ state: 'x'.repeat(MAX_STATE_LENGTH + 1) }));
    expect(r).toMatchObject({ ok: false, fatal: false, error: 'invalid_request' });
    expect(r.state).toBeUndefined();
    expect((await run(good({ state: undefined }))).request.state).toBeNull();
  });
  test('scope: unknown only is invalid_scope', async () => {
    await expectRedirect({ scope: 'admin everything' }, 'invalid_scope');
    expect((await run(good({ scope: 'diagrams:read bogus' }))).ok).toBe(true);
    expect((await run(good({ scope: undefined }))).ok).toBe(true);
  });
});

describe('scopes and resource helpers', () => {
  test('parseScope ceilings', () => {
    expect(parseScope('diagrams:read')).toEqual({ ok: true, ceiling: 'viewer', offline: false });
    expect(parseScope('diagrams:read diagrams:comment offline_access')).toEqual({ ok: true, ceiling: 'commenter', offline: true });
    expect(parseScope('diagrams:write')).toEqual({ ok: true, ceiling: 'editor', offline: false });
    expect(parseScope('')).toEqual({ ok: true, ceiling: 'editor', offline: false });
    expect(parseScope('nope').ok).toBe(false);
  });
  test('scopeForCap', () => {
    expect(scopeForCap('viewer')).toBe('diagrams:read');
    expect(scopeForCap('commenter', true)).toBe('diagrams:read diagrams:comment offline_access');
    expect(scopeForCap('editor')).toBe('diagrams:read diagrams:comment diagrams:write');
  });
  test('resourceMatches rejects non-strings', () => {
    expect(resourceMatches(undefined)).toBe(false);
    expect(resourceMatches('not a url')).toBe(false);
  });
});

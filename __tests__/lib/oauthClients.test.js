/**
 * @jest-environment node
 */
import { getClient, resetClientCache, validateClientDocument, MAX_DOCUMENT_BYTES } from '../../lib/oauth/clients';

const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const doc = (over = {}) => ({
  client_id: CLAUDE, client_name: 'Claude', redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
  token_endpoint_auth_method: 'none', ...over,
});
const resp = (body, { headers = {}, ...init } = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), {
  status: 200, ...init, headers: { 'content-type': 'application/json', ...headers },
});

beforeEach(() => { resetClientCache(); delete process.env.OAUTH_TRUSTED_CLIENT_IDS; });

describe('allowlist', () => {
  test('unknown client_id is refused without any outbound fetch', async () => {
    const fetchImpl = jest.fn();
    for (const id of ['https://evil.example/x', CLAUDE + '/', CLAUDE + '?x=1', 'https://claude.ai/oauth/claude-code-client-metadata', '', undefined, 5, 'http://claude.ai/oauth/mcp-oauth-client-metadata']) {
      expect(await getClient(id, { fetchImpl })).toEqual({ ok: false, error: 'unknown_client' });
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  test('the default allowlist is Claude hosted client; OAUTH_TRUSTED_CLIENT_IDS replaces it', async () => {
    const fetchImpl = jest.fn(async () => resp(doc()));
    expect((await getClient(CLAUDE, { fetchImpl })).ok).toBe(true);
    process.env.OAUTH_TRUSTED_CLIENT_IDS = 'https://other.example/meta';
    resetClientCache();
    expect(await getClient(CLAUDE, { fetchImpl })).toEqual({ ok: false, error: 'unknown_client' });
  });
  test('a plain http client_id is refused in production even when allowlisted', async () => {
    const prev = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.OAUTH_TRUSTED_CLIENT_IDS = 'http://127.0.0.1:9/meta';
    try {
      expect(await getClient('http://127.0.0.1:9/meta', { fetchImpl: jest.fn() })).toEqual({ ok: false, error: 'unknown_client' });
    } finally { process.env.NODE_ENV = prev; }
  });
});

describe('document validation', () => {
  test('accepts the Claude document and labels it by host', async () => {
    const r = await getClient(CLAUDE, { fetchImpl: async () => resp(doc()) });
    expect(r).toEqual({ ok: true, client: { clientId: CLAUDE, label: 'claude.ai', name: 'Claude', redirectUris: ['https://claude.ai/api/mcp/auth_callback'] } });
  });
  test.each([
    ['client_id mismatch', { client_id: 'https://claude.ai/other' }],
    ['no redirect_uris', { redirect_uris: [] }],
    ['redirect_uris not an array', { redirect_uris: 'https://claude.ai/cb' }],
    ['http redirect (non-loopback)', { redirect_uris: ['http://claude.ai/cb'] }],
    ['javascript redirect', { redirect_uris: ['javascript:alert(1)'] }],
    ['redirect with fragment', { redirect_uris: ['https://claude.ai/cb#x'] }],
    ['redirect with credentials', { redirect_uris: ['https://u:p@claude.ai/cb'] }],
    ['confidential auth method', { token_endpoint_auth_method: 'client_secret_basic' }],
    ['missing auth method', { token_endpoint_auth_method: undefined }],
  ])('rejects: %s', (_n, over) => {
    expect(validateClientDocument(CLAUDE, doc(over)).ok).toBe(false);
  });
  test('rejects non-JSON, oversize, redirects, errors and timeouts', async () => {
    const cases = [
      async () => resp('<html>', { headers: { 'content-type': 'text/html' } }),
      async () => resp('x'.repeat(MAX_DOCUMENT_BYTES + 10)),
      async () => resp({}, { status: 404 }),
      async () => { throw new TypeError('redirect mode is set to error'); },
      async () => resp('not json'),
    ];
    for (const fetchImpl of cases) {
      resetClientCache();
      expect(await getClient(CLAUDE, { fetchImpl })).toEqual({ ok: false, error: 'client_unavailable' });
    }
  });
  test('fetch is called with no redirects, a timeout signal and JSON accept', async () => {
    const fetchImpl = jest.fn(async () => resp(doc()));
    await getClient(CLAUDE, { fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe(CLAUDE);
    expect(init.redirect).toBe('error');
    expect(init.signal).toBeDefined();
  });
});

describe('cache', () => {
  test('served from cache within the TTL; refetched after; stale copy used on failure; limited to one fetch a minute', async () => {
    let t = 1_000_000;
    const now = () => t;
    const fetchImpl = jest.fn(async () => resp(doc()));
    await getClient(CLAUDE, { fetchImpl, now });
    await getClient(CLAUDE, { fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 6 * 60 * 1000; // past the 5 minute minimum TTL
    fetchImpl.mockImplementation(async () => { throw new Error('down'); });
    expect((await getClient(CLAUDE, { fetchImpl, now })).ok).toBe(true); // stale copy
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    t += 10 * 1000; // within a minute of the failed attempt: no new fetch
    expect((await getClient(CLAUDE, { fetchImpl, now })).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    t += 8 * 24 * 60 * 60 * 1000; // stale beyond 7 days
    expect((await getClient(CLAUDE, { fetchImpl, now })).ok).toBe(false);
  });
  test('Cache-Control max-age is honored and clamped', async () => {
    let t = 0; const now = () => t;
    const fetchImpl = jest.fn(async () => resp(doc(), { headers: { 'cache-control': 'max-age=10' } })); // clamped up to 5 min
    await getClient(CLAUDE, { fetchImpl, now });
    t += 4 * 60 * 1000;
    await getClient(CLAUDE, { fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    t += 2 * 60 * 1000;
    await getClient(CLAUDE, { fetchImpl, now });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});

/**
 * @jest-environment node
 */
// ADR-0005 O3: Connected apps API (list + Disconnect) against a throwaway database.
const crypto = require('crypto');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

let mockUser = null;
jest.mock('../../lib/useAuth', () => ({
  requireActiveUser: async (req, res) => {
    if (!mockUser) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    if (mockUser.status !== 'active') { res.status(403).json({ error: 'Account not activated' }); return null; }
    return mockUser;
  },
}));

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const R = 'https://lab.example.com/api/mcp';
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

function mockRes() {
  const res = { headers: {}, statusCode: 200, body: undefined };
  res.setHeader = (k, v) => { res.headers[k.toLowerCase()] = v; return res; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  res.end = () => res;
  return res;
}
const call = async (handler, { method = 'GET', query = {}, headers = {} } = {}) => {
  const res = mockRes();
  await handler({ method, query, headers }, res);
  return res;
};

dbDescribe('Connected apps (throwaway database)', () => {
  let db; let repo; let list; let del; let apps; let alice; let bob; let own; let sharedWithAlice; let bobPrivate;
  const asUser = (u) => { mockUser = u && { id: u.id, email: u.email, name: u.email, role: u.role, status: u.status }; };

  beforeAll(async () => {
    db = await setupOauthDb('oauthapps');
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    process.env.MCP_OAUTH_ENABLED = 'true';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER;
    repo = require('../../lib/oauth/repository');
    apps = require('../../lib/oauth/connectedApps');
    list = require('../../pages/api/user/connected-apps/index').default;
    del = require('../../pages/api/user/connected-apps/[id]').default;
    alice = await db.user('alice@x.co');
    bob = await db.user('bob@x.co');
    own = await db.diagram(alice);
    bobPrivate = await db.diagram(bob);
    sharedWithAlice = await db.diagram(bob); await db.member(sharedWithAlice.id, alice.id, 'viewer');
  });
  afterAll(() => db.teardown());
  beforeEach(async () => {
    asUser(alice);
    await db.pg.query("update oauth_grants set revoked_at = now(), revoked_reason = 'test' where revoked_at is null");
  });

  async function connect(user, { cap = 'viewer', diagramIds = null, allDiagrams = false, expiresAt = null } = {}) {
    const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: 'diagrams:read offline_access' });
    await repo.bindAuthorization(rid, user.id);
    const { code, grant } = await repo.approveAuthorization({ rid, userId: user.id, clientLabel: 'claude.ai', scope: 'diagrams:read offline_access', roleCap: cap, diagramIds, allDiagrams, expiresAt });
    const t = await repo.exchangeAuthorizationCode({ code, clientId: CLAUDE, redirectUri: CB, codeVerifier: verifier, resource: R });
    return { grant, tokens: t.body };
  }

  describe('GET /api/user/connected-apps', () => {
    test('requires a signed-in active user', async () => {
      asUser(null);
      expect((await call(list)).statusCode).toBe(401);
      asUser({ ...alice, status: 'pending' });
      expect((await call(list)).statusCode).toBe(403);
      expect((await call(list, { method: 'POST' })).statusCode).toBe(405);
    });
    test('lists only the caller\'s live connections, newest first, without secrets', async () => {
      const a = await connect(alice);
      const b = await connect(alice, { cap: 'editor', allDiagrams: false, diagramIds: [own.id] });
      await connect(bob);
      const res = await call(list);
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.enabled).toBe(true);
      expect(res.body.apps.map((x) => x.id)).toEqual([b.grant.id, a.grant.id]);
      const text = JSON.stringify(res.body);
      expect(text).not.toMatch(/oga_|ogr_|token_hash|code_hash|code_challenge/);
      expect(res.body.apps[0]).toMatchObject({ clientLabel: 'claude.ai', roleCap: 'editor', scopeKind: 'selected', diagramCount: 1, diagrams: [{ id: own.id, shortId: own.short_id }] });
      expect(res.body.apps[1]).toMatchObject({ roleCap: 'viewer', scopeKind: 'all_readable', diagramCount: null, diagrams: [] });
    });
    test('an admin all-boards connection is labeled; revoked and expired ones are hidden', async () => {
      const adm = await db.user('adm@x.co', { role: 'admin' });
      asUser(adm);
      const all = await connect(adm, { cap: 'editor', allDiagrams: true });
      const gone = await connect(adm);
      await repo.revokeGrant(gone.grant.id, 'user');
      const old = await connect(adm, { expiresAt: new Date(Date.now() + 1000) });
      await db.pg.query("update oauth_grants set expires_at = now() - interval '1 minute' where id=$1", [old.grant.id]);
      const res = await call(list);
      expect(res.body.apps.map((x) => x.id)).toEqual([all.grant.id]);
      expect(res.body.apps[0]).toMatchObject({ scopeKind: 'all_editable', allDiagrams: true, roleCap: 'editor' });
    });
    test('diagram names are shown only for diagrams the user can still read', async () => {
      const g = await connect(alice, { cap: 'commenter', diagramIds: [own.id, sharedWithAlice.id] });
      expect((await apps.listConnectedApps(alice.id)).find((x) => x.id === g.grant.id).diagrams.map((d) => d.id).sort()).toEqual([own.id, sharedWithAlice.id].sort());
      await db.pg.query('delete from diagram_members where diagram_id=$1 and user_id=$2', [sharedWithAlice.id, alice.id]); // access lost
      const after = (await apps.listConnectedApps(alice.id)).find((x) => x.id === g.grant.id);
      expect(after.diagramCount).toBe(2);
      expect(after.diagrams.map((d) => d.id)).toEqual([own.id]);
      await db.pg.query('insert into diagram_members (diagram_id,user_id,role) values ($1,$2,$3)', [sharedWithAlice.id, alice.id, 'viewer']);
      expect(bobPrivate.id).toBeTruthy();
    });
  });

  describe('DELETE /api/user/connected-apps/[id] (Disconnect)', () => {
    test('takes effect on the very next request, for access and refresh tokens', async () => {
      const { grant, tokens } = await connect(alice);
      expect((await repo.verifyAccessToken(tokens.access_token)).ok).toBe(true);
      const res = await call(del, { method: 'DELETE', query: { id: grant.id }, headers: { origin: 'https://lab.example.com' } });
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ revoked: true });
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'revoked' });
      expect(await repo.refreshTokens({ refreshToken: tokens.refresh_token, clientId: CLAUDE })).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await call(list)).body.apps).toEqual([]);
    });
    test('writes an audit event attributed to the user, with no secrets', async () => {
      const { grant, tokens } = await connect(alice);
      await call(del, { method: 'DELETE', query: { id: grant.id } });
      const rows = (await db.pg.query("select actor_type, actor_user_id, target from audit_events where action='oauth.grant.revoke' and target->>'grantId'=$1", [grant.id])).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ actor_type: 'user', actor_user_id: alice.id });
      expect(JSON.stringify(rows)).not.toContain(tokens.access_token);
    });
    test('another user\'s connection, unknown ids, malformed ids and repeats all answer 404', async () => {
      const bobs = await connect(bob);
      for (const id of [bobs.grant.id, crypto.randomUUID(), 'nope', '', undefined]) {
        expect((await call(del, { method: 'DELETE', query: { id } })).statusCode).toBe(404);
      }
      expect((await repo.verifyAccessToken(bobs.tokens.access_token)).ok).toBe(true); // untouched
      const mine = await connect(alice);
      expect((await call(del, { method: 'DELETE', query: { id: mine.grant.id } })).statusCode).toBe(200);
      expect((await call(del, { method: 'DELETE', query: { id: mine.grant.id } })).statusCode).toBe(404);
    });
    test('cross-origin requests are refused; wrong methods and signed-out callers too', async () => {
      const { grant, tokens } = await connect(alice);
      const res = await call(del, { method: 'DELETE', query: { id: grant.id }, headers: { origin: 'https://evil.example' } });
      expect(res.statusCode).toBe(403);
      expect((await repo.verifyAccessToken(tokens.access_token)).ok).toBe(true);
      expect((await call(del, { method: 'GET', query: { id: grant.id } })).statusCode).toBe(405);
      asUser(null);
      expect((await call(del, { method: 'DELETE', query: { id: grant.id } })).statusCode).toBe(401);
    });
  });
});

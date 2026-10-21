/**
 * @jest-environment node
 */
// ADR-0005 O2: the consent decision (throwaway database): what a connection may be granted.
const crypto = require('crypto');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const R = 'https://lab.example.com/api/mcp';
const challenge = crypto.createHash('sha256').update('v'.repeat(50)).digest('base64url');
const doc = (uris = [CB]) => ({ client_id: CLAUDE, redirect_uris: uris, token_endpoint_auth_method: 'none' });
const fetchImpl = (d = doc()) => async () => new Response(JSON.stringify(d), { status: 200, headers: { 'content-type': 'application/json' } });

dbDescribe('oauth consent decision (throwaway database)', () => {
  let db; let consent; let repo; let clients;
  let owner; let editorUser; let viewerUser; let stranger; let admin; let suspended;
  let own; let sharedEdit; let sharedView; let strangerPrivate;

  beforeAll(async () => {
    db = await setupOauthDb('oauthconsent');
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER; delete process.env.OAUTH_TRUSTED_CLIENT_IDS;
    consent = require('../../lib/oauth/consent');
    repo = require('../../lib/oauth/repository');
    clients = require('../../lib/oauth/clients');
    owner = await db.user('owner@x.co');
    editorUser = await db.user('ed@x.co');
    viewerUser = await db.user('vw@x.co');
    stranger = await db.user('st@x.co');
    admin = await db.user('adm@x.co', { role: 'admin' });
    suspended = await db.user('sus@x.co', { status: 'suspended' });
    own = await db.diagram(editorUser); // editorUser owns it
    sharedEdit = await db.diagram(owner); await db.member(sharedEdit.id, editorUser.id, 'editor');
    sharedView = await db.diagram(owner); await db.member(sharedView.id, editorUser.id, 'viewer');
    strangerPrivate = await db.diagram(stranger);
  });
  afterAll(() => db.teardown());
  beforeEach(async () => {
    clients.resetClientCache();
    await db.pg.query("update oauth_grants set revoked_at = now(), revoked_reason = 'test' where revoked_at is null");
    await db.pg.query('update oauth_authorizations set consumed_at = now() where consumed_at is null');
  });

  const newRid = (scope = 'diagrams:read diagrams:comment diagrams:write offline_access', state = 'state-123') =>
    repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state, codeChallenge: challenge, resource: R, requestedScope: scope });
  const decide = async (user, form, { scope, rid, state, fetch } = {}) => {
    const r = rid || (await newRid(scope, state));
    return { rid: r, out: await consent.decideConsent({ rid: r, user, form, fetchImpl: fetch || fetchImpl() }) };
  };
  const lastGrant = async (userId) => (await db.pg.query('select * from oauth_grants where user_id=$1 and revoked_at is null order by created_at desc limit 1', [userId])).rows[0];

  test('approve: redirect carries code, echoed state and iss; consent was recorded', async () => {
    const { out } = await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'all' }, { state: 'a b&c=d' });
    expect(out.ok).toBe(true);
    const u = new URL(out.redirect);
    expect(`${u.origin}${u.pathname}`).toBe(CB);
    expect(u.searchParams.get('state')).toBe('a b&c=d');
    expect(u.searchParams.get('iss')).toBe('https://lab.example.com');
    expect(u.searchParams.get('code')).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const g = await lastGrant(editorUser.id);
    expect(g).toMatchObject({ role_cap: 'viewer', diagram_ids: null, all_diagrams: false, client_label: 'claude.ai', resource: R, scope: 'diagrams:read offline_access' });
  });

  test('deny redirects with access_denied, state and iss, and writes an audit row', async () => {
    const { out, rid } = await decide(editorUser, { decision: 'deny' });
    expect(out.ok).toBe(true);
    const u = new URL(out.redirect);
    expect(u.searchParams.get('error')).toBe('access_denied');
    expect(u.searchParams.get('state')).toBe('state-123');
    expect(u.searchParams.get('iss')).toBe('https://lab.example.com');
    expect(u.searchParams.get('code')).toBeNull();
    expect(await repo.getOpenAuthorization(rid)).toBeNull();
    expect((await db.pg.query("select 1 from audit_events where action='oauth.consent.deny' and actor_user_id=$1", [editorUser.id])).rowCount).toBeGreaterThan(0);
  });

  describe('editor', () => {
    test('without diagrams: refused', async () => {
      for (const form of [
        { decision: 'approve', role: 'editor', diagramMode: 'selected' },
        { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [] },
        { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: '' },
      ]) {
        expect((await decide(editorUser, form)).out).toEqual({ ok: false, error: 'editor_needs_diagrams' });
      }
      expect(await lastGrant(editorUser.id)).toBeUndefined();
    });
    test('with diagrams the user can edit (owned, shared as editor): accepted with an allowlist', async () => {
      const { out } = await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [own.id, sharedEdit.id] });
      expect(out.ok).toBe(true);
      expect(await lastGrant(editorUser.id)).toMatchObject({ role_cap: 'editor', diagram_ids: expect.arrayContaining([own.id, sharedEdit.id]), all_diagrams: false, scope: 'diagrams:read diagrams:comment diagrams:write offline_access' });
    });
    test('cannot grant more than the live role: shared as viewer, someone else\'s private diagram, unknown id', async () => {
      for (const id of [sharedView.id, strangerPrivate.id, '00000000-0000-4000-8000-000000000000']) {
        expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [own.id, id] })).out).toEqual({ ok: false, error: 'diagram_denied' });
      }
      expect(await lastGrant(editorUser.id)).toBeUndefined();
    });
    test('an admin has no implicit access: another user\'s private diagram is refused for them too', async () => {
      expect((await decide(admin, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [strangerPrivate.id] })).out).toEqual({ ok: false, error: 'diagram_denied' });
    });
    test('ids are validated: not uuids, too many', async () => {
      expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: ['x; drop table'] })).out).toEqual({ ok: false, error: 'invalid_form' });
      const many = Array.from({ length: 51 }, () => crypto.randomUUID());
      expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: many })).out).toEqual({ ok: false, error: 'too_many_diagrams' });
    });
  });

  describe('all boards I can edit (admins only)', () => {
    test('a non-admin who crafts the request is refused and nothing is created', async () => {
      expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'all' })).out).toEqual({ ok: false, error: 'all_boards_admin_only' });
      expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'all', allDiagrams: '1', diagramIds: [own.id] })).out).toEqual({ ok: false, error: 'all_boards_admin_only' });
      expect(await lastGrant(editorUser.id)).toBeUndefined();
    });
    test('an admin gets an editor grant without an allowlist and with all_diagrams', async () => {
      const { out } = await decide(admin, { decision: 'approve', role: 'editor', diagramMode: 'all' });
      expect(out.ok).toBe(true);
      expect(await lastGrant(admin.id)).toMatchObject({ role_cap: 'editor', diagram_ids: null, all_diagrams: true });
      const audit = (await db.pg.query("select target from audit_events where action='oauth.grant.create' and actor_user_id=$1 order by id desc limit 1", [admin.id])).rows[0];
      expect(audit.target).toMatchObject({ roleCap: 'editor', allDiagrams: true });
    });
    test('an admin may still choose specific diagrams; viewer/commenter "all" is not all_diagrams', async () => {
      expect((await decide(admin, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [] })).out.error).toBe('editor_needs_diagrams');
      await decide(admin, { decision: 'approve', role: 'commenter', diagramMode: 'all' });
      expect(await lastGrant(admin.id)).toMatchObject({ role_cap: 'commenter', all_diagrams: false, diagram_ids: null });
    });
  });

  describe('viewer and commenter', () => {
    test('may be limited to readable diagrams, not to unreadable ones', async () => {
      expect((await decide(editorUser, { decision: 'approve', role: 'commenter', diagramMode: 'selected', diagramIds: [sharedView.id] })).out.ok).toBe(true);
      expect((await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'selected', diagramIds: [strangerPrivate.id] })).out).toEqual({ ok: false, error: 'diagram_denied' });
      expect((await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'selected' })).out).toEqual({ ok: false, error: 'diagrams_required' });
    });
  });

  describe('ceiling and form validation', () => {
    test('the cap cannot exceed the scope the client requested', async () => {
      expect((await decide(editorUser, { decision: 'approve', role: 'commenter', diagramMode: 'all' }, { scope: 'diagrams:read' })).out).toEqual({ ok: false, error: 'role_above_request' });
      expect((await decide(editorUser, { decision: 'approve', role: 'editor', diagramMode: 'selected', diagramIds: [own.id] }, { scope: 'diagrams:read diagrams:comment' })).out).toEqual({ ok: false, error: 'role_above_request' });
      expect((await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'all' }, { scope: 'diagrams:read' })).out.ok).toBe(true);
    });
    test('unknown role, missing decision, bad mode, bad expiry', async () => {
      for (const form of [
        { decision: 'approve', role: 'owner', diagramMode: 'all' },
        { decision: 'approve', role: 'admin', diagramMode: 'all' },
        { decision: 'approve', role: ['viewer'], diagramMode: 'all' },
        { decision: 'approve', diagramMode: 'all' },
        { role: 'viewer', diagramMode: 'all' },
        { decision: 'maybe', role: 'viewer', diagramMode: 'all' },
        { decision: 'approve', role: 'viewer', diagramMode: 'bogus' },
        { decision: 'approve', role: 'viewer', diagramMode: 'all', expiresInDays: '9999' },
        undefined,
      ]) {
        expect((await decide(editorUser, form)).out).toEqual({ ok: false, error: 'invalid_form' });
      }
    });
    test('optional expiry is applied', async () => {
      await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'all', expiresInDays: '30' });
      const g = await lastGrant(editorUser.id);
      const days = (new Date(g.expires_at).getTime() - Date.now()) / 86400000;
      expect(days).toBeGreaterThan(29.9); expect(days).toBeLessThan(30.1);
    });
  });

  describe('who may decide', () => {
    test('another user\'s rid is refused', async () => {
      const rid = await newRid();
      await repo.bindAuthorization(rid, editorUser.id);
      const out = await consent.decideConsent({ rid, user: viewerUser, form: { decision: 'approve', role: 'viewer', diagramMode: 'all' }, fetchImpl: fetchImpl() });
      expect(out).toEqual({ ok: false, error: 'expired' });
      expect(await lastGrant(viewerUser.id)).toBeUndefined();
    });
    test('a suspended user cannot consent', async () => {
      expect((await decide(suspended, { decision: 'approve', role: 'viewer', diagramMode: 'all' })).out).toEqual({ ok: false, error: 'inactive' });
    });
    test('a request is single use', async () => {
      const { rid } = await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'all' });
      const again = await consent.decideConsent({ rid, user: editorUser, form: { decision: 'approve', role: 'viewer', diagramMode: 'all' }, fetchImpl: fetchImpl() });
      expect(again).toEqual({ ok: false, error: 'expired' });
    });
    test('unknown or malformed rid', async () => {
      for (const rid of ['nope', '00000000-0000-4000-8000-000000000000', undefined]) {
        expect((await consent.decideConsent({ rid, user: editorUser, form: { decision: 'approve', role: 'viewer', diagramMode: 'all' }, fetchImpl: fetchImpl() })).ok).toBe(false);
      }
    });
    test('if the client document no longer lists the redirect URI, the request is refused', async () => {
      const { out } = await decide(editorUser, { decision: 'approve', role: 'viewer', diagramMode: 'all' }, { fetch: fetchImpl(doc(['https://claude.com/api/mcp/auth_callback'])) });
      expect(out).toEqual({ ok: false, error: 'expired' });
    });
    test('the 10 active connections limit surfaces as grant_limit', async () => {
      const u = await db.user('cap@x.co');
      for (let i = 0; i < 10; i += 1) expect((await decide(u, { decision: 'approve', role: 'viewer', diagramMode: 'all' })).out.ok).toBe(true);
      expect((await decide(u, { decision: 'approve', role: 'viewer', diagramMode: 'all' })).out).toEqual({ ok: false, error: 'grant_limit' });
    });
  });
});

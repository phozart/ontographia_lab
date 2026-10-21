/**
 * @jest-environment node
 */
// ADR-0005 O2: grants, codes, tokens, rotation, reuse detection, verification, revocation (throwaway database).
const crypto = require('crypto');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const R = 'https://lab.example.com/api/mcp';
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

dbDescribe('oauth repository (throwaway database)', () => {
  let db; let repo; let crypt; let u1; let u2; let admin; let d1;
  let n = 0;
  const at = (ms) => new Date(Date.now() + ms);

  beforeAll(async () => {
    db = await setupOauthDb('oauthrepo');
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER;
    repo = require('../../lib/oauth/repository');
    crypt = require('../../lib/oauth/crypto');
    u1 = await db.user('u1@x.co');
    u2 = await db.user('u2@x.co');
    admin = await db.user('adm@x.co', { role: 'admin' });
    d1 = await db.diagram(u1);
  });
  afterAll(() => db.teardown());
  // Keep the per-user grant cap out of the way: every test starts with no live grants for the shared users.
  beforeEach(() => db.pg.query("update oauth_grants set revoked_at = now(), revoked_reason = 'test' where revoked_at is null"));

  // Creates a grant through the real pending-request -> approve path and returns the one-time code.
  async function grantWithCode(user, { cap = 'viewer', diagramIds = null, allDiagrams = false, scope, expiresAt = null, state = 's', now } = {}) {
    n += 1;
    const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state, codeChallenge: challenge, resource: R, requestedScope: scope || 'diagrams:read diagrams:comment diagrams:write offline_access' }, now);
    const bound = await repo.bindAuthorization(rid, user.id, now);
    expect(bound.ok).toBe(true);
    const { code, grant } = await repo.approveAuthorization({
      rid, userId: user.id, clientLabel: 'claude.ai', scope: `diagrams:read${cap !== 'viewer' ? ' diagrams:comment' : ''}${cap === 'editor' ? ' diagrams:write' : ''} offline_access`,
      roleCap: cap, diagramIds, allDiagrams, expiresAt,
    }, now);
    return { rid, code, grant };
  }
  const exchange = (code, over = {}, now) => repo.exchangeAuthorizationCode({ code, clientId: CLAUDE, redirectUri: CB, codeVerifier: verifier, resource: R, ...over }, now);
  async function connected(user, opts) {
    const g = await grantWithCode(user, opts);
    const t = await exchange(g.code);
    expect(t.ok).toBe(true);
    return { ...g, tokens: t.body };
  }
  const refresh = (rt, over = {}, now) => repo.refreshTokens({ refreshToken: rt, clientId: CLAUDE, ...over }, now);
  const grantRow = async (id) => (await db.pg.query('select * from oauth_grants where id=$1', [id])).rows[0];

  describe('pending authorization requests', () => {
    test('bound to the first signed-in user; another user is refused; single use; expiry', async () => {
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: 'x', codeChallenge: challenge, resource: R, requestedScope: null });
      expect((await repo.bindAuthorization(rid, u1.id)).ok).toBe(true);
      expect((await repo.bindAuthorization(rid, u1.id)).ok).toBe(true); // same user again
      expect(await repo.bindAuthorization(rid, u2.id)).toEqual({ ok: false, reason: 'other_user' });
      await expect(repo.approveAuthorization({ rid, userId: u2.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' })).rejects.toMatchObject({ code: 'not_found' });
      await repo.approveAuthorization({ rid, userId: u1.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' });
      await expect(repo.approveAuthorization({ rid, userId: u1.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' })).rejects.toMatchObject({ code: 'not_found' });
      expect((await repo.bindAuthorization(rid, u1.id)).ok).toBe(false); // consumed
    });
    test('requests expire after 10 minutes; unknown or malformed rids are not found', async () => {
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
      expect(await repo.getOpenAuthorization(rid, at(9 * 60 * 1000))).toBeTruthy();
      expect(await repo.getOpenAuthorization(rid, at(11 * 60 * 1000))).toBeNull();
      expect(await repo.getOpenAuthorization('nope')).toBeNull();
      expect(await repo.getOpenAuthorization('00000000-0000-0000-0000-000000000000')).toBeNull();
    });
    test('deny consumes the request', async () => {
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
      await repo.bindAuthorization(rid, u1.id);
      expect(await repo.denyAuthorization(rid, u1.id)).toBe(true);
      expect(await repo.getOpenAuthorization(rid)).toBeNull();
    });
  });

  describe('authorization code', () => {
    test('happy path: exchange yields an access and a refresh token with the granted scope', async () => {
      const { code } = await grantWithCode(u1);
      const r = await exchange(code);
      expect(r.ok).toBe(true);
      expect(r.body).toMatchObject({ token_type: 'Bearer', expires_in: 3600, scope: 'diagrams:read offline_access' });
      expect(crypt.looksLikeAccessToken(r.body.access_token)).toBe(true);
      expect(crypt.looksLikeRefreshToken(r.body.refresh_token)).toBe(true);
      // only hashes are stored
      const rows = (await db.pg.query('select token_hash from oauth_tokens')).rows.map((x) => x.token_hash);
      expect(rows).toContain(crypt.sha256Hex(r.body.access_token));
      expect(rows).not.toContain(r.body.access_token);
      const authRows = (await db.pg.query('select code_hash from oauth_authorizations where code_hash is not null')).rows.map((x) => x.code_hash);
      expect(authRows).not.toContain(code);
    });
    test('no refresh token without offline_access', async () => {
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: 'diagrams:read' });
      await repo.bindAuthorization(rid, u1.id);
      const { code } = await repo.approveAuthorization({ rid, userId: u1.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' });
      const r = await exchange(code);
      expect(r.ok).toBe(true);
      expect(r.body.refresh_token).toBeUndefined();
    });
    test('second use fails and revokes the grant and its tokens', async () => {
      const { code, grant } = await grantWithCode(u1);
      const first = await exchange(code);
      expect(first.ok).toBe(true);
      const second = await exchange(code);
      expect(second).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await grantRow(grant.id)).revoked_reason).toBe('code_reuse');
      expect(await repo.verifyAccessToken(first.body.access_token)).toMatchObject({ ok: false, reason: 'revoked' });
      expect(await refresh(first.body.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
      const audit = (await db.pg.query("select actor_type, target from audit_events where action='oauth.grant.revoke_code_reuse'")).rows;
      expect(audit.some((a) => a.actor_type === 'system' && a.target.grantId === grant.id)).toBe(true);
    });
    test('expired code (60 s) fails', async () => {
      const { code, grant } = await grantWithCode(u1);
      const r = await exchange(code, {}, at(61 * 1000));
      expect(r).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await grantRow(grant.id)).revoked_at).toBeTruthy();
    });
    test('wrong verifier, missing verifier, wrong client, wrong redirect (prefix/slash), unknown code: all invalid_grant and burn the code', async () => {
      const cases = [
        { codeVerifier: crypto.randomBytes(32).toString('base64url') },
        { codeVerifier: undefined },
        { codeVerifier: 'short' },
        { codeVerifier: challenge }, // plain: the challenge presented as the verifier
        { clientId: 'https://claude.ai/oauth/other' },
        { redirectUri: CB + '/' },
        { redirectUri: CB.slice(0, -1) },
        { redirectUri: 'https://evil.example/cb' },
      ];
      for (const over of cases) {
        const { code, grant } = await grantWithCode(u1);
        expect(await exchange(code, over)).toMatchObject({ ok: false, error: 'invalid_grant' });
        // the legitimate holder cannot redeem a burned code either
        expect(await exchange(code)).toMatchObject({ ok: false, error: 'invalid_grant' });
        expect((await grantRow(grant.id)).revoked_at).toBeTruthy();
      }
      expect(await exchange(crypto.randomBytes(32).toString('base64url'))).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect(await exchange('garbage')).toMatchObject({ ok: false, error: 'invalid_grant' });
    });
    test('resource mismatch is invalid_target; matching or absent resource passes', async () => {
      const a = await grantWithCode(u1);
      expect(await exchange(a.code, { resource: 'https://other.example/api/mcp' })).toMatchObject({ ok: false, error: 'invalid_target' });
      const b = await grantWithCode(u1);
      expect((await exchange(b.code, { resource: undefined })).ok).toBe(true);
      const c = await grantWithCode(u1);
      expect((await exchange(c.code, { resource: R + '/' })).ok).toBe(true);
    });
    test('a suspended user cannot redeem a code', async () => {
      const u = await db.user('susp1@x.co');
      const { code } = await grantWithCode(u);
      await db.pg.query("update users set status='suspended' where id=$1", [u.id]);
      expect(await exchange(code)).toMatchObject({ ok: false, error: 'invalid_grant' });
    });
  });

  describe('access token verification', () => {
    test('resolves to the agent principal used by lib/authz', async () => {
      const { tokens, grant } = await connected(u1, { cap: 'editor', diagramIds: [d1.id] });
      const v = await repo.verifyAccessToken(tokens.access_token);
      expect(v).toEqual({ ok: true, principal: { kind: 'agent', userId: u1.id, tokenId: grant.id, roleCap: 'editor', diagramScope: [d1.id], allDiagrams: false, credential: 'oauth', clientId: CLAUDE } });
    });
    test('unknown, garbage, refresh-as-access and oversize tokens are invalid', async () => {
      const { tokens } = await connected(u1);
      for (const t of ['oga_' + 'a'.repeat(43), 'garbage', tokens.refresh_token, 'oga_' + 'a'.repeat(500), undefined]) {
        expect(await repo.verifyAccessToken(t)).toEqual({ ok: false, reason: 'invalid' });
      }
    });
    test('expires after 1 hour; the grant expiry also applies', async () => {
      const { tokens } = await connected(u1);
      expect((await repo.verifyAccessToken(tokens.access_token, at(59 * 60 * 1000))).ok).toBe(true);
      expect(await repo.verifyAccessToken(tokens.access_token, at(61 * 60 * 1000))).toEqual({ ok: false, reason: 'expired' });
      const short = await connected(u1, { expiresAt: at(30 * 60 * 1000) });
      expect(await repo.verifyAccessToken(short.tokens.access_token, at(31 * 60 * 1000))).toEqual({ ok: false, reason: 'expired' });
    });
    test('a token for another resource (audience) is refused', async () => {
      const { tokens, grant } = await connected(u1);
      await db.pg.query("update oauth_grants set resource='https://other.example/api/mcp' where id=$1", [grant.id]);
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'invalid' });
    });
    test('revocation (Disconnect) takes effect on the very next verification', async () => {
      const { tokens, grant } = await connected(u1);
      expect((await repo.verifyAccessToken(tokens.access_token)).ok).toBe(true);
      expect(await repo.revokeGrant(grant.id, 'user', { onlyUserId: u2.id })).toBeNull(); // not theirs
      expect((await repo.verifyAccessToken(tokens.access_token)).ok).toBe(true);
      expect(await repo.revokeGrant(grant.id, 'user', { onlyUserId: u1.id })).toBeTruthy();
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'revoked' });
      expect(await refresh(tokens.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect(await repo.revokeGrant(grant.id, 'user')).toBeNull(); // idempotent
      const audit = (await db.pg.query("select actor_user_id from audit_events where action='oauth.grant.revoke' and target->>'grantId'=$1", [grant.id])).rows;
      expect(audit).toHaveLength(1);
    });
    test('suspended user: invalid at once; reinstated user works again', async () => {
      const u = await db.user('susp2@x.co');
      const { tokens } = await connected(u);
      await db.pg.query("update users set status='suspended' where id=$1", [u.id]);
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'inactive' });
      await db.pg.query("update users set status='active' where id=$1", [u.id]);
      expect((await repo.verifyAccessToken(tokens.access_token)).ok).toBe(true);
    });
    test('deleting the user removes the connection', async () => {
      const u = await db.user('gone@x.co');
      const { tokens } = await connected(u);
      await db.pg.query('delete from users where id=$1', [u.id]);
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'invalid' });
    });
    test('editor without an allowlist and without all_diagrams cannot exist (database CHECK)', async () => {
      await expect(db.pg.query(
        "insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap) values ($1,'c','c','r','R','s','editor')", [u1.id]
      )).rejects.toThrow(/oauth_grants_editor_requires_scope/);
      await expect(db.pg.query(
        "insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap,diagram_ids) values ($1,'c','c','r','R','s','editor','{}')", [u1.id]
      )).rejects.toThrow(/oauth_grants_editor_requires_scope/);
      await expect(db.pg.query(
        "insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap,all_diagrams) values ($1,'c','c','r','R','s','viewer',true)", [u1.id]
      )).rejects.toThrow(/oauth_grants_all_diagrams_editor_only/);
      await expect(db.pg.query(
        "insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap,all_diagrams,diagram_ids) values ($1,'c','c','r','R','s','editor',true,$2)", [u1.id, [d1.id]]
      )).rejects.toThrow(/oauth_grants_all_diagrams_editor_only/);
    });
  });

  describe('all-boards editor connection (admins only)', () => {
    test('principal carries allDiagrams for an admin and drops to commenter once demoted', async () => {
      const a = await db.user('adm2@x.co', { role: 'admin' });
      const { tokens } = await connected(a, { cap: 'editor', allDiagrams: true });
      const v = await repo.verifyAccessToken(tokens.access_token);
      expect(v.principal).toMatchObject({ roleCap: 'editor', diagramScope: null, allDiagrams: true, credential: 'oauth' });
      await db.pg.query("update users set role='user' where id=$1", [a.id]);
      const demoted = await repo.verifyAccessToken(tokens.access_token);
      expect(demoted.ok).toBe(true); // still connected: reads and comments
      expect(demoted.principal).toMatchObject({ roleCap: 'commenter', diagramScope: null, allDiagrams: false });
      await db.pg.query("update users set role='admin' where id=$1", [a.id]);
      expect((await repo.verifyAccessToken(tokens.access_token)).principal.allDiagrams).toBe(true);
    });
  });

  describe('refresh tokens', () => {
    test('rotation: a new pair every time, the old refresh token is spent', async () => {
      const { tokens, grant } = await connected(u1);
      const r1 = await refresh(tokens.refresh_token);
      expect(r1.ok).toBe(true);
      expect(r1.body.refresh_token).not.toBe(tokens.refresh_token);
      expect(r1.body.access_token).not.toBe(tokens.access_token);
      expect(r1.body.scope).toBe(tokens.scope);
      expect((await repo.verifyAccessToken(r1.body.access_token)).principal.tokenId).toBe(grant.id); // stable id across rotations
      const r2 = await refresh(r1.body.refresh_token);
      expect(r2.ok).toBe(true);
    });
    test('reuse of a spent token revokes the whole grant (after the grace window or once the successor was used)', async () => {
      const { tokens, grant } = await connected(u1);
      const r1 = await refresh(tokens.refresh_token);
      const r2 = await refresh(r1.body.refresh_token); // the successor is now used
      expect(r2.ok).toBe(true);
      const replay = await refresh(tokens.refresh_token); // old token again, successor already used: theft
      expect(replay).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await grantRow(grant.id)).revoked_reason).toBe('reuse');
      expect(await repo.verifyAccessToken(r2.body.access_token)).toEqual({ ok: false, reason: 'revoked' });
      expect(await refresh(r2.body.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
      const audit = (await db.pg.query("select actor_type from audit_events where action='oauth.grant.revoke_reuse' and target->>'grantId'=$1", [grant.id])).rows;
      expect(audit).toEqual([{ actor_type: 'system' }]);
    });
    test('reuse after the 60 s grace window revokes even when the successor is unused', async () => {
      const { tokens, grant } = await connected(u1);
      expect((await refresh(tokens.refresh_token)).ok).toBe(true);
      const late = await refresh(tokens.refresh_token, {}, at(61 * 1000));
      expect(late).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await grantRow(grant.id)).revoked_reason).toBe('reuse');
    });
    test('retry within 60 s with an unused successor: fresh pair, and the lost successor is revoked', async () => {
      const { tokens, grant } = await connected(u1);
      const lost = await refresh(tokens.refresh_token); // the client never received this response
      const retry = await refresh(tokens.refresh_token);
      expect(retry.ok).toBe(true);
      expect(retry.body.refresh_token).not.toBe(lost.body.refresh_token);
      expect((await grantRow(grant.id)).revoked_at).toBeNull();
      // the lost pair is dead, the retry pair works
      expect(await repo.verifyAccessToken(lost.body.access_token)).toEqual({ ok: false, reason: 'revoked' });
      expect((await repo.verifyAccessToken(retry.body.access_token)).ok).toBe(true);
      expect((await refresh(retry.body.refresh_token)).ok).toBe(true);
      expect((await grantRow(grant.id)).revoked_at).toBeNull();
    });
    test('theft sequence: a thief replays R1 in the grace window, then the holder presents the superseded R2 = reuse, whole grant revoked', async () => {
      const { tokens, grant } = await connected(u1);
      const holder = await refresh(tokens.refresh_token); // R2 (the holder's response is slow or lost)
      const thief = await refresh(tokens.refresh_token); // replay of R1 within 60 s: grace path hands the thief a chain
      expect(thief.ok).toBe(true);
      expect((await db.pg.query("select revoked_reason from oauth_tokens where kind='refresh' and revoked_reason is not null and grant_id=$1", [grant.id])).rows).toEqual([{ revoked_reason: 'grace_superseded' }]);
      const holderTry = await refresh(holder.body.refresh_token); // the legitimate holder arrives with R2
      expect(holderTry).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect((await grantRow(grant.id)).revoked_reason).toBe('reuse');
      // the thief's chain dies with the grant
      expect(await repo.verifyAccessToken(thief.body.access_token)).toEqual({ ok: false, reason: 'revoked' });
      expect(await refresh(thief.body.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
    });
    test('the grace path is allowed at most once per token', async () => {
      const { tokens, grant } = await connected(u1);
      await refresh(tokens.refresh_token);
      expect((await refresh(tokens.refresh_token)).ok).toBe(true); // grace, once
      expect(await refresh(tokens.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' }); // second replay
      expect((await grantRow(grant.id)).revoked_reason).toBe('reuse');
    });
    test('concurrent refreshes with the same token never revoke the grant and never both keep working tokens', async () => {
      const { tokens, grant } = await connected(u1);
      const [a, b] = await Promise.all([refresh(tokens.refresh_token), refresh(tokens.refresh_token)]);
      expect(a.ok && b.ok).toBe(true);
      expect((await grantRow(grant.id)).revoked_at).toBeNull();
      const alive = [a, b].filter((r) => r.body.refresh_token);
      const results = await Promise.all(alive.map((r) => repo.verifyAccessToken(r.body.access_token)));
      expect(results.filter((r) => r.ok)).toHaveLength(1);
    });
    test('30 days idle expiry; each rotation renews it', async () => {
      const { tokens } = await connected(u1);
      expect(await refresh(tokens.refresh_token, {}, at(31 * 24 * 3600 * 1000))).toMatchObject({ ok: false, error: 'invalid_grant' });
      const c = await connected(u1);
      const r1 = await refresh(c.tokens.refresh_token, {}, at(20 * 24 * 3600 * 1000));
      expect(r1.ok).toBe(true);
      expect((await refresh(r1.body.refresh_token, {}, at(45 * 24 * 3600 * 1000))).ok).toBe(true); // 25 days after the rotation
    });
    test('wrong client, other resource, access token as refresh token, garbage, suspended user, grant expiry', async () => {
      const { tokens } = await connected(u1);
      expect(await refresh(tokens.refresh_token, { clientId: 'https://claude.ai/oauth/other' })).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect(await refresh(tokens.refresh_token, { resource: 'https://other.example/api/mcp' })).toMatchObject({ ok: false, error: 'invalid_target' });
      expect(await refresh(tokens.access_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect(await refresh('garbage')).toMatchObject({ ok: false, error: 'invalid_grant' });
      expect(await refresh(undefined)).toMatchObject({ ok: false, error: 'invalid_grant' });
      const s = await db.user('susp3@x.co');
      const c = await connected(s);
      await db.pg.query("update users set status='suspended' where id=$1", [s.id]);
      expect(await refresh(c.tokens.refresh_token)).toMatchObject({ ok: false, error: 'invalid_grant' });
      const e = await connected(u1, { expiresAt: at(1000) });
      expect(await refresh(e.tokens.refresh_token, {}, at(5000))).toMatchObject({ ok: false, error: 'invalid_grant' });
    });
  });

  describe('grant lifecycle', () => {
    test('at most 10 active grants per user', async () => {
      const u = await db.user('many@x.co');
      for (let i = 0; i < 10; i += 1) await grantWithCode(u);
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
      await repo.bindAuthorization(rid, u.id);
      await expect(repo.approveAuthorization({ rid, userId: u.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' })).rejects.toMatchObject({ code: 'grant_limit' });
      const list = await repo.listGrants(u.id);
      expect(list).toHaveLength(10);
      await repo.revokeGrant(list[0].id, 'user', { onlyUserId: u.id });
      await expect(repo.approveAuthorization({ rid, userId: u.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'viewer' })).resolves.toBeTruthy();
    });
    test('creating requests runs cleanup (at most every 5 minutes) and a global cap on unbound requests applies', async () => {
      const mk = () => repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
      await mk();
      await db.pg.query("update oauth_authorizations set expires_at = now() - interval '1 hour' where user_id is null"); // stale unbound rows
      const before = (await db.pg.query('select count(*)::int n from oauth_authorizations')).rows[0].n;
      expect(before).toBeGreaterThan(0);
      repo.resetCleanupClock();
      await mk(); // triggers cleanup
      await new Promise((r) => setTimeout(r, 300));
      const stale = (await db.pg.query("select count(*)::int n from oauth_authorizations where user_id is null and expires_at < now()")).rows[0].n;
      expect(stale).toBe(0);
      // cap: pretend the table is full
      await db.pg.query("insert into oauth_authorizations (client_id,redirect_uri,code_challenge,resource,expires_at) select 'c','r',$1,'R',now()+interval '5 minutes' from generate_series(1,$2)", ['x'.repeat(43), repo.MAX_UNBOUND_AUTHORIZATIONS]);
      expect(await mk()).toBeNull();
      await db.pg.query("delete from oauth_authorizations where client_id='c'");
      expect(await mk()).toBeTruthy();
    });
    test('at most 20 pending requests per user', async () => {
      const u = await db.user('pending@x.co');
      for (let i = 0; i < 20; i += 1) {
        const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
        expect((await repo.bindAuthorization(rid, u.id)).ok).toBe(true);
      }
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: null });
      expect(await repo.bindAuthorization(rid, u.id)).toEqual({ ok: false, reason: 'limit' });
    });
    test('password reset revokes all of the user\'s connections and nobody else\'s', async () => {
      const u = await db.user('reset@x.co');
      const a = await connected(u); const b = await connected(u); const other = await connected(u2);
      expect(await repo.revokeAllGrantsForUser(u.id)).toBe(2);
      for (const c of [a, b]) {
        expect(await repo.verifyAccessToken(c.tokens.access_token)).toEqual({ ok: false, reason: 'revoked' });
        expect(await refresh(c.tokens.refresh_token)).toMatchObject({ ok: false });
      }
      expect((await repo.verifyAccessToken(other.tokens.access_token)).ok).toBe(true);
      expect((await grantRow(a.grant.id)).revoked_reason).toBe('password_reset');
      const audit = (await db.pg.query("select actor_type, on_behalf_of from audit_events where action='oauth.grants.revoke_all'")).rows;
      expect(audit.some((x) => x.on_behalf_of === u.id && x.actor_type === 'system')).toBe(true);
      expect(await repo.revokeAllGrantsForUser(u.id)).toBe(0);
    });
    test('create and consent audit events carry no secrets', async () => {
      const u = await db.user('aud@x.co');
      const { code, grant } = await grantWithCode(u, { cap: 'editor', diagramIds: [d1.id] });
      const rows = (await db.pg.query("select actor_user_id, target from audit_events where action='oauth.grant.create' and target->>'grantId'=$1", [grant.id])).rows;
      expect(rows).toHaveLength(1);
      expect(rows[0].actor_user_id).toBe(u.id);
      expect(rows[0].target).toMatchObject({ client: 'claude.ai', roleCap: 'editor', diagramCount: 1 });
      expect(JSON.stringify(rows)).not.toContain(code);
    });
    test('RFC 7009 revocation by a token revokes the grant; wrong client or unknown token is silent', async () => {
      const { tokens, grant } = await connected(u1);
      expect(await repo.revokeByToken({ token: tokens.access_token, clientId: 'https://claude.ai/oauth/other' })).toBe(false);
      expect(await repo.revokeByToken({ token: 'oga_' + 'z'.repeat(43), clientId: CLAUDE })).toBe(false);
      expect((await grantRow(grant.id)).revoked_at).toBeNull();
      expect(await repo.revokeByToken({ token: tokens.refresh_token, clientId: CLAUDE })).toBe(true);
      expect(await repo.verifyAccessToken(tokens.access_token)).toEqual({ ok: false, reason: 'revoked' });
    });
    test('cleanup removes only old rows', async () => {
      const keep = await connected(u1);
      await db.pg.query("update oauth_authorizations set created_at = now() - interval '2 days' where code_hash is null");
      await repo.cleanupExpired();
      expect((await repo.verifyAccessToken(keep.tokens.access_token)).ok).toBe(true);
      const old = await grantWithCode(u1);
      await repo.revokeGrant(old.grant.id, 'user');
      await db.pg.query("update oauth_grants set revoked_at = now() - interval '91 days' where id=$1", [old.grant.id]);
      await repo.cleanupExpired();
      expect(await grantRow(old.grant.id)).toBeUndefined();
      expect((await repo.verifyAccessToken(keep.tokens.access_token)).ok).toBe(true);
    });
  });
});

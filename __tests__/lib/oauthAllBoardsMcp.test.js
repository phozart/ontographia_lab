/**
 * @jest-environment node
 */
// ADR-0005 O2: OAuth access tokens through the MCP server with the REAL authz core and database (throwaway DB):
//  - authz parity between ogl_ personal tokens and oga_ OAuth tokens of equal cap;
//  - the admin-only "all boards I can edit" connection (owner decision 2026-10-21).
const crypto = require('crypto');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const R = 'https://lab.example.com/api/mcp';
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
const ADD = [{ op: 'add_element', ref: '@a', type: 'process-flow/task', label: 'New' }];

dbDescribe('OAuth tokens through the MCP server (throwaway database)', () => {
  let db; let repo; let verifyBearer; let apiTokens; let Client; let InMemoryTransport; let createMcpServer;
  let adm; let other; let stranger; let user;
  let admOwn; let sharedEdit; let sharedView; let strangerPrivate;

  beforeAll(async () => {
    db = await setupOauthDb('oauthmcp');
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    process.env.MCP_OAUTH_ENABLED = 'true';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER;
    repo = require('../../lib/oauth/repository');
    ({ verifyBearer } = require('../../lib/oauth/verify'));
    apiTokens = require('../../lib/apiTokens');
    ({ Client } = require('@modelcontextprotocol/sdk/client/index.js'));
    ({ InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js'));
    ({ createMcpServer } = require('../../lib/mcp/server'));
    adm = await db.user('adm@x.co', { role: 'admin' });
    other = await db.user('other@x.co');
    stranger = await db.user('stranger@x.co');
    user = await db.user('user@x.co');
    admOwn = await db.diagram(adm);
    sharedEdit = await db.diagram(other); await db.member(sharedEdit.id, adm.id, 'editor');
    sharedView = await db.diagram(other); await db.member(sharedView.id, adm.id, 'viewer');
    strangerPrivate = await db.diagram(stranger);
  });
  afterAll(() => db.teardown());

  async function oauthToken(u, { cap, diagramIds = null, allDiagrams = false }) {
    const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: 'diagrams:read offline_access' });
    await repo.bindAuthorization(rid, u.id);
    const { code, grant } = await repo.approveAuthorization({ rid, userId: u.id, clientLabel: 'claude.ai', scope: 'diagrams:read offline_access', roleCap: cap, diagramIds, allDiagrams });
    const t = await repo.exchangeAuthorizationCode({ code, clientId: CLAUDE, redirectUri: CB, codeVerifier: verifier, resource: R });
    return { token: t.body.access_token, grant };
  }
  // A client for whatever principal the bearer secret resolves to (the same path /api/mcp takes).
  async function clientFor(secret) {
    const auth = await verifyBearer(secret);
    if (!auth.ok) throw new Error(`token not accepted: ${auth.reason}`);
    const server = createMcpServer(auth.principal);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }
  const revisionOf = async (id) => Number((await db.pg.query('select revision from diagrams where id=$1', [id])).rows[0]?.revision ?? 0);
  const edit = async (client, id) => client.callTool({ name: 'diagram_apply_ops', arguments: { id, baseRevision: await revisionOf(id), ops: ADD } });
  const text = (r) => r.content.find((c) => c.type === 'text').text;
  const listIds = async (client) => {
    const r = await client.callTool({ name: 'diagram_list', arguments: {} });
    return JSON.parse(text(r)).items.map((i) => i.id).sort();
  };

  describe('authz parity: ogl_ personal token vs oga_ OAuth token of equal cap and scope', () => {
    test.each([
      ['viewer, no allowlist', 'viewer', null],
      ['commenter, with allowlist', 'commenter', 'own+view'],
      ['editor, with allowlist', 'editor', 'own+edit'],
    ])('%s', async (_name, cap, listKind) => {
      const ids = listKind === 'own+view' ? [admOwn.id, sharedView.id] : listKind === 'own+edit' ? [admOwn.id, sharedEdit.id] : null;
      const personal = (await apiTokens.createToken(adm.id, { name: 'p', roleCap: cap, diagramIds: ids, expiresAt: null })).token;
      const oauth = (await oauthToken(adm, { cap, diagramIds: ids })).token;
      const [pc, oc] = [await clientFor(personal), await clientFor(oauth)];
      expect(await listIds(oc)).toEqual(await listIds(pc));
      for (const d of [admOwn, sharedEdit, sharedView, strangerPrivate]) {
        const p = await pc.callTool({ name: 'diagram_get', arguments: { id: d.id } });
        const o = await oc.callTool({ name: 'diagram_get', arguments: { id: d.id } });
        expect(!!o.isError).toBe(!!p.isError);
        if (p.isError) expect(text(o)).toBe(text(p));
        const pe = await edit(pc, d.id);
        const oe = await edit(oc, d.id);
        expect(!!oe.isError).toBe(!!pe.isError);
        if (pe.isError) expect(text(oe)).toBe(text(pe));
      }
    });
  });

  describe('all boards I can edit (admin)', () => {
    test('writes owned and shared-as-editor diagrams, including ones created later', async () => {
      const { token } = await oauthToken(adm, { cap: 'editor', allDiagrams: true });
      const c = await clientFor(token);
      expect((await edit(c, admOwn.id)).isError).toBeFalsy();
      expect((await edit(c, sharedEdit.id)).isError).toBeFalsy();
      const later = await db.diagram(adm);
      expect((await edit(c, later.id)).isError).toBeFalsy();
      const laterShared = await db.diagram(other); await db.member(laterShared.id, adm.id, 'editor');
      expect((await edit(c, laterShared.id)).isError).toBeFalsy();
    });
    test('viewer-only and shared-as-viewer diagrams are denied; another user\'s private diagram is not found', async () => {
      const { token } = await oauthToken(adm, { cap: 'editor', allDiagrams: true });
      const c = await clientFor(token);
      const viewOnly = await edit(c, sharedView.id);
      expect(viewOnly.isError).toBe(true);
      expect(text(viewOnly)).toMatch(/does not permit/i);
      const priv = await edit(c, strangerPrivate.id);
      expect(priv.isError).toBe(true);
      expect(text(priv)).toMatch(/not found/i);
      const missing = await edit(c, '00000000-0000-4000-8000-000000000000');
      expect(text(missing)).toBe(text(priv)); // no existence oracle
      // admins have no implicit access: the private diagram is not even listed
      expect(await listIds(c)).toEqual(expect.arrayContaining([admOwn.id, sharedEdit.id, sharedView.id]));
      expect(await listIds(c)).not.toContain(strangerPrivate.id);
    });
    test('a demoted admin can no longer write, but the connection still reads', async () => {
      const a = await db.user('adm-demote@x.co', { role: 'admin' });
      const d = await db.diagram(a);
      const { token } = await oauthToken(a, { cap: 'editor', allDiagrams: true });
      const c = await clientFor(token);
      expect((await edit(c, d.id)).isError).toBeFalsy();
      await db.pg.query("update users set role='user' where id=$1", [a.id]);
      const c2 = await clientFor(token);
      const denied = await edit(c2, d.id);
      expect(denied.isError).toBe(true);
      expect((await c2.callTool({ name: 'diagram_get', arguments: { id: d.id } })).isError).toBeFalsy();
    });
    test('a non-admin with an all_diagrams grant (forged in the database) cannot write anything', async () => {
      const d = await db.diagram(user);
      const { token } = await oauthToken(adm, { cap: 'editor', allDiagrams: true });
      // move the grant to a non-admin to simulate a forged row (the consent path refuses to create one)
      await db.pg.query('update oauth_grants set user_id=$1 where id in (select grant_id from oauth_tokens where token_hash=$2)', [user.id, require('../../lib/oauth/crypto').sha256Hex(token)]);
      const c = await clientFor(token);
      const r = await edit(c, d.id);
      expect(r.isError).toBe(true);
      expect((await c.callTool({ name: 'diagram_get', arguments: { id: d.id } })).isError).toBeFalsy();
    });
    test('an allowlisted OAuth editor still cannot write outside its allowlist', async () => {
      const { token } = await oauthToken(adm, { cap: 'editor', diagramIds: [admOwn.id] });
      const c = await clientFor(token);
      expect((await edit(c, admOwn.id)).isError).toBeFalsy();
      expect((await edit(c, sharedEdit.id)).isError).toBe(true);
    });
    test('a personal editor token keeps requiring an allowlist (unchanged)', async () => {
      await expect(apiTokens.createToken(adm.id, { name: 'x', roleCap: 'editor', diagramIds: null, expiresAt: null })).rejects.toThrow();
    });
    test('agent edits are audited with the grant id and the credential type', async () => {
      const { token, grant } = await oauthToken(adm, { cap: 'editor', allDiagrams: true });
      const c = await clientFor(token);
      const d = await db.diagram(adm);
      expect((await edit(c, d.id)).isError).toBeFalsy();
      const row = (await db.pg.query("select target from audit_events where action='diagram.agent_edit' and diagram_id=$1", [d.id])).rows[0];
      expect(row.target).toMatchObject({ tokenId: grant.id, credential: 'oauth' });
    });
  });
});

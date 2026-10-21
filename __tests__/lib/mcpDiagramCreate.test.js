/**
 * @jest-environment node
 */
// diagram_create through the MCP protocol with the REAL authz core, creation path and database (throwaway DB).
// Owner request 2026-10-21: editor-capped principals create a private board owned by the user; restricted
// credentials get the new id on THEIR allowlist only, in the same transaction.
const crypto = require('crypto');
const { setupOauthDb, BASE_URL } = require('../helpers/oauthDb');

const dbDescribe = BASE_URL ? describe : describe.skip;
const CLAUDE = 'https://claude.ai/oauth/mcp-oauth-client-metadata';
const CB = 'https://claude.ai/api/mcp/auth_callback';
const R = 'https://lab.example.com/api/mcp';
const verifier = crypto.randomBytes(32).toString('base64url');
const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');

dbDescribe('diagram_create (throwaway database)', () => {
  let db; let repo; let verifyBearer; let apiTokens; let Client; let InMemoryTransport; let createMcpServer; let diagramRepository;
  let user; let adm; let own;

  beforeAll(async () => {
    db = await setupOauthDb('mcpcreate');
    process.env.NEXTAUTH_URL = 'https://lab.example.com';
    process.env.MCP_OAUTH_ENABLED = 'true';
    delete process.env.MCP_PUBLIC_URL; delete process.env.OAUTH_ISSUER;
    repo = require('../../lib/oauth/repository');
    ({ verifyBearer } = require('../../lib/oauth/verify'));
    apiTokens = require('../../lib/apiTokens');
    ({ diagramRepository } = require('../../lib/diagramRepository'));
    ({ Client } = require('@modelcontextprotocol/sdk/client/index.js'));
    ({ InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js'));
    ({ createMcpServer } = require('../../lib/mcp/server'));
    user = await db.user('user@x.co');
    adm = await db.user('adm@x.co', { role: 'admin' });
  });
  beforeEach(async () => { own = await fixture(user); });
  afterAll(() => db.teardown());

  // Fixture boards use a FIX- short id so they never collide with the LAB-n ids the creation path assigns.
  let fixSeq = 0;
  const fixture = async (owner) => {
    fixSeq += 1;
    return (await db.pg.query(
      "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,'{}') returning id, short_id",
      [`FIX-${fixSeq}`, owner.email, owner.id])).rows[0];
  };
  const personal = async (u, cap, ids) => (await apiTokens.createToken(u.id, { name: 'p', roleCap: cap, diagramIds: ids, expiresAt: null }));
  async function oauthToken(u, { cap, diagramIds = null, allDiagrams = false }) {
    const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: 'diagrams:read offline_access' });
    await repo.bindAuthorization(rid, u.id);
    const { code, grant } = await repo.approveAuthorization({ rid, userId: u.id, clientLabel: 'claude.ai', scope: 'diagrams:read offline_access', roleCap: cap, diagramIds, allDiagrams });
    const t = await repo.exchangeAuthorizationCode({ code, clientId: CLAUDE, redirectUri: CB, codeVerifier: verifier, resource: R });
    return { token: t.body.access_token, grant };
  }
  async function clientFor(secret, deps = {}) {
    const auth = await verifyBearer(secret);
    if (!auth.ok) throw new Error(`token not accepted: ${auth.reason}`);
    const server = createMcpServer(auth.principal, deps);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);
    return client;
  }
  const create = (client, args) => client.callTool({ name: 'diagram_create', arguments: args });
  const text = (r) => r.content.find((c) => c.type === 'text').text;
  const count = async () => Number((await db.pg.query('select count(*) n from diagrams')).rows[0].n);
  const allowlist = async (id) => (await db.pg.query('select diagram_ids from api_tokens where id=$1', [id])).rows[0].diagram_ids;
  const grantList = async (id) => (await db.pg.query('select diagram_ids from oauth_grants where id=$1', [id])).rows[0].diagram_ids;
  const mapOne = (client, id, rev) => client.callTool({
    name: 'map_structure',
    arguments: { id, baseRevision: rev, layout: 'tree', structure: { nodes: [{ key: 'a', label: 'Root' }, { key: 'b', label: 'Child' }], edges: [{ from: 'a', to: 'b' }] } },
  });

  test('is listed with a static description that says it creates a private board owned by the user', async () => {
    const client = await clientFor((await personal(user, 'viewer', null)).token);
    const tool = (await client.listTools()).tools.find((t) => t.name === 'diagram_create');
    expect(tool).toBeTruthy();
    expect(tool.description).toMatch(/private/i);
    expect(tool.description).toMatch(/owned by the user|you own|owned by you/i);
    expect(Object.keys(tool.inputSchema.properties).sort()).toEqual(['description', 'name']);
  });

  describe('role', () => {
    test.each(['viewer', 'commenter'])('%s token is denied and nothing is created', async (cap) => {
      const client = await clientFor((await personal(user, cap, cap === 'viewer' ? null : [own.id])).token);
      const before = await count();
      const r = await create(client, { name: 'Nope' });
      expect(r.isError).toBe(true);
      expect(text(r)).toMatch(/role does not permit/i);
      expect(await count()).toBe(before);
    });

    test.each(['viewer', 'commenter'])('OAuth %s grant is denied', async (cap) => {
      const { token } = await oauthToken(user, { cap, diagramIds: cap === 'viewer' ? null : [own.id] });
      const before = await count();
      const r = await create(await clientFor(token), { name: 'Nope' });
      expect(r.isError).toBe(true);
      expect(text(r)).toMatch(/role does not permit/i);
      expect(await count()).toBe(before);
    });

    test('a non-admin all_diagrams grant is downgraded (existing rule) and cannot create', async () => {
      const rid = await repo.createAuthorization({ clientId: CLAUDE, redirectUri: CB, state: null, codeChallenge: challenge, resource: R, requestedScope: 'diagrams:read' });
      await repo.bindAuthorization(rid, user.id);
      const { code } = await repo.approveAuthorization({ rid, userId: user.id, clientLabel: 'c', scope: 'diagrams:read', roleCap: 'editor', allDiagrams: true });
      const t = await repo.exchangeAuthorizationCode({ code, clientId: CLAUDE, redirectUri: CB, codeVerifier: verifier, resource: R });
      const before = await count();
      const r = await create(await clientFor(t.body.access_token), { name: 'Nope' });
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
    });
  });

  describe('editor personal token with an allowlist', () => {
    test('creates a private board owned by the user, appends the id to THIS token only, then map_structure works', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const other = await personal(user, 'editor', [own.id]);
      const client = await clientFor(t.token);
      const r = await create(client, { name: 'Journey map', description: 'Q4 research' });
      expect(r.isError).toBeFalsy();
      const out = r.structuredContent;
      expect(out.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(out.shortId).toMatch(/^LAB-\d+$/);
      expect(out.url).toBe(`https://lab.example.com/diagram/${out.shortId}`);
      expect(out.name).toBe('Journey map');
      expect(out.next).toMatch(/map_structure/);
      expect(out.next).toMatch(/baseRevision/);

      const row = (await db.pg.query('select * from diagrams where id=$1', [out.id])).rows[0];
      expect(row.owner_id).toBe(user.id);
      expect(row.created_by).toBe(user.email);
      expect(row.type).toBe('infinite-canvas');
      expect(row.description).toBe('Q4 research');
      expect(Number(row.revision)).toBe(out.revision);
      expect(row.content).toEqual({ elements: [], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });
      expect((await db.pg.query('select count(*) n from diagram_members where diagram_id=$1', [out.id])).rows[0].n).toBe('0'); // private

      expect(await allowlist(t.record.id)).toEqual([own.id, out.id]);
      expect(await allowlist(other.record.id)).toEqual([own.id]);

      const mapped = await mapOne(client, out.id, out.revision);
      expect(mapped.isError).toBeFalsy();
      expect(mapped.structuredContent.revision).toBeGreaterThan(out.revision);
      // A later request (fresh authentication) reads the stored allowlist and can edit the board too.
      const again = await mapOne(await clientFor(t.token), out.id, mapped.structuredContent.revision);
      expect(again.isError).toBeFalsy();
    });

    test('the dashboard lists the new board (owned scope)', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const r = await create(await clientFor(t.token), { name: 'On the dashboard' });
      const owned = await diagramRepository.findAll({}, user.id);
      expect(owned.map((d) => d.id)).toContain(r.structuredContent.id);
    });

    test('same name gets the normal auto-number; short ids are sequential LAB-n', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const client = await clientFor(t.token);
      const a = (await create(client, { name: 'Dup name' })).structuredContent;
      const b = (await create(client, { name: 'Dup name' })).structuredContent;
      expect(b.name).toBe('Dup name (1)');
      expect(Number(b.shortId.slice(4))).toBe(Number(a.shortId.slice(4)) + 1);
    });

    test('writes an agent audit event with no content', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const r = (await create(await clientFor(t.token), { name: 'Audited', description: 'secret words' })).structuredContent;
      const ev = (await db.pg.query("select * from audit_events where action='diagram.agent_create' and diagram_id=$1", [r.id])).rows;
      expect(ev).toHaveLength(1);
      expect(ev[0].actor_type).toBe('agent');
      expect(ev[0].on_behalf_of).toBe(user.id);
      expect(ev[0].actor_user_id).toBeNull();
      expect(ev[0].target.tokenId).toBe(t.record.id);
      expect(JSON.stringify(ev[0].target)).not.toMatch(/secret words|Audited/);
    });

    test('a token whose allowlist is full is refused and nothing is created', async () => {
      const ids = [own.id];
      for (let i = 0; i < 49; i += 1) ids.push(crypto.randomUUID());
      const t = await personal(user, 'editor', ids);
      const before = await count();
      const r = await create(await clientFor(t.token), { name: 'Too many' });
      expect(r.isError).toBe(true);
      expect(r.structuredContent.code).toBe('ALLOWLIST_FULL');
      expect(await count()).toBe(before);
    });
  });

  describe('OAuth allowlist grant', () => {
    test('appends to THIS grant only, then map_structure works', async () => {
      const g1 = await oauthToken(user, { cap: 'editor', diagramIds: [own.id] });
      const g2 = await oauthToken(user, { cap: 'editor', diagramIds: [own.id] });
      const pt = await personal(user, 'editor', [own.id]);
      const client = await clientFor(g1.token);
      const r = await create(client, { name: 'From claude.ai' });
      expect(r.isError).toBeFalsy();
      const out = r.structuredContent;
      expect(await grantList(g1.grant.id)).toEqual([own.id, out.id]);
      expect(await grantList(g2.grant.id)).toEqual([own.id]);
      expect(await allowlist(pt.record.id)).toEqual([own.id]);
      const mapped = await mapOne(client, out.id, out.revision);
      expect(mapped.isError).toBeFalsy();
      const ev = (await db.pg.query("select target from audit_events where action='diagram.agent_create' and diagram_id=$1", [out.id])).rows[0];
      expect(ev.target).toMatchObject({ tokenId: g1.grant.id, credential: 'oauth' });
    });
  });

  describe('admin all_diagrams grant', () => {
    test('creates and edits; no allowlist is touched', async () => {
      const g = await oauthToken(adm, { cap: 'editor', allDiagrams: true });
      const client = await clientFor(g.token);
      const r = await create(client, { name: 'Admin board' });
      expect(r.isError).toBeFalsy();
      const out = r.structuredContent;
      expect(await grantList(g.grant.id)).toBeNull();
      expect((await db.pg.query('select owner_id from diagrams where id=$1', [out.id])).rows[0].owner_id).toBe(adm.id);
      const mapped = await mapOne(client, out.id, out.revision);
      expect(mapped.isError).toBeFalsy();
    });

    test('an admin who lost the role can no longer create (per-request re-check)', async () => {
      const a2 = await db.user('adm2@x.co', { role: 'admin' });
      const g = await oauthToken(a2, { cap: 'editor', allDiagrams: true });
      const client = await clientFor(g.token);
      await db.pg.query("update users set role='user' where id=$1", [a2.id]);
      const before = await count();
      const r = await create(client, { name: 'Nope' });
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
    });
  });

  describe('credential no longer valid mid-request', () => {
    test('revoked personal token (revoked after authentication) is denied, nothing created', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const client = await clientFor(t.token);
      await db.pg.query('update api_tokens set revoked_at=now() where id=$1', [t.record.id]);
      const before = await count();
      const r = await create(client, { name: 'Late' });
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
    });
    test('disconnected OAuth grant is denied', async () => {
      const g = await oauthToken(user, { cap: 'editor', diagramIds: [own.id] });
      const client = await clientFor(g.token);
      await db.pg.query('update oauth_grants set revoked_at=now() where id=$1', [g.grant.id]);
      const before = await count();
      const r = await create(client, { name: 'Late' });
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
    });
    test('suspended user is denied (and fresh authentication fails)', async () => {
      const u = await db.user('susp@x.co');
      const o = await fixture(u);
      const t = await personal(u, 'editor', [o.id]);
      const client = await clientFor(t.token);
      await db.pg.query("update users set status='suspended' where id=$1", [u.id]);
      const before = await count();
      const r = await create(client, { name: 'Late' });
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
      await expect(clientFor(t.token)).rejects.toThrow(/not accepted/);
    });
  });

  describe('rate limit', () => {
    test('10 creates per hour per credential, 11th is RATE_LIMITED; another token is unaffected', async () => {
      const u = await db.user('rate@x.co');
      const o = await fixture(u);
      const t = await personal(u, 'editor', [o.id]);
      const t2 = await personal(u, 'editor', [o.id]);
      const client = await clientFor(t.token);
      for (let i = 0; i < 10; i += 1) {
        const r = await create(client, { name: `Rate ${i}` });
        expect(r.isError).toBeFalsy();
      }
      const before = await count();
      const r = await create(client, { name: 'Rate 11' });
      expect(r.isError).toBe(true);
      expect(r.structuredContent.code).toBe('RATE_LIMITED');
      expect(r.structuredContent.retryAfterSeconds).toBeGreaterThan(0);
      expect(await count()).toBe(before);
      expect((await create(await clientFor(t2.token), { name: 'Other token' })).isError).toBeFalsy();
    });

    test('also counts against the shared write limiter', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const writeLimiter = { consume: jest.fn(() => ({ success: false, remaining: 0, resetIn: 12 })) };
      const before = await count();
      const r = await create(await clientFor(t.token, { writeLimiter }), { name: 'Limited' });
      expect(writeLimiter.consume).toHaveBeenCalledWith(t.record.id);
      expect(r.structuredContent.code).toBe('RATE_LIMITED');
      expect(await count()).toBe(before);
    });
  });

  describe('input validation (same limits as the UI and POST /api/diagrams)', () => {
    test.each([
      ['empty name', { name: '' }],
      ['whitespace name', { name: '   ' }],
      ['name over 255', { name: 'x'.repeat(256) }],
      ['description over 2000', { name: 'ok', description: 'd'.repeat(2001) }],
    ])('%s is rejected and nothing is created', async (_n, args) => {
      const t = await personal(user, 'editor', [own.id]);
      const before = await count();
      const r = await create(await clientFor(t.token), args);
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
      expect(await allowlist(t.record.id)).toEqual([own.id]);
    });
    test('the name is trimmed; 255 characters are accepted', async () => {
      const t = await personal(user, 'editor', [own.id]);
      const r = await create(await clientFor(t.token), { name: `  ${'n'.repeat(255)}  ` });
      expect(r.isError).toBeFalsy();
      expect(r.structuredContent.name).toBe('n'.repeat(255));
    });
  });

  describe('atomicity', () => {
    test('if the allowlist update fails the diagram is not left behind', async () => {
      const t = await personal(user, 'editor', [own.id]);
      await db.pg.query("create or replace function fail_tok_update() returns trigger as $$ begin raise exception 'boom'; end $$ language plpgsql");
      await db.pg.query('create trigger fail_tok before update on api_tokens for each row execute function fail_tok_update()');
      const before = await count();
      const r = await create(await clientFor(t.token), { name: 'Orphan?' });
      await db.pg.query('drop trigger fail_tok on api_tokens');
      expect(r.isError).toBe(true);
      expect(await count()).toBe(before);
      expect((await db.pg.query("select count(*) n from audit_events where action='diagram.agent_create' and target->>'tokenId'=$1", [t.record.id])).rows[0].n).toBe('0');
    });
  });
});

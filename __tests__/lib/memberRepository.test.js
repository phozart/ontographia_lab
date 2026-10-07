// Slice 5: member repository, real authorization and audit trail against a THROWAWAY database
// (created and dropped here; migrations applied). Skipped when no Postgres is configured.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

dbDescribe('memberRepository + authorize + audit (throwaway database)', () => {
  const dbName = `diagram_studio_s5test_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let url; let pg; let dbMod; let repo; let authz; let audit; let listener;
  let owner; let ed; let cm; let vw; let stranger; let pendingUser; let diagramId; let notes = [];
  let seq = 0;

  const principal = (u) => ({ kind: 'user', userId: u.id, platformRole: 'user', status: 'active' });
  async function mkUser(email, status = 'active', role = 'user') {
    return (await pg.query('insert into users (email,name,status,role) values ($1,$2,$3,$4) returning id,email,name', [email, email.split('@')[0], status, role])).rows[0];
  }
  async function mkDiagram(o) {
    seq += 1;
    return (await pg.query("insert into diagrams (short_id,name,type,created_by,owner_id) values ($1,'D','infinite-canvas',$2,$3) returning id", [`LAB-${seq}`, o.email, o.id])).rows[0].id;
  }

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(BASE_URL); u.pathname = `/${dbName}`; url = u.toString();
    await migrate({ connectionString: url, dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    process.env.DATABASE_URL = url;
    pg = new Client({ connectionString: url });
    await pg.connect();
    listener = new Client({ connectionString: url });
    await listener.connect();
    await listener.query('LISTEN authz_changed');
    listener.on('notification', (m) => notes.push(JSON.parse(m.payload)));
    owner = await mkUser('owner@x.co'); ed = await mkUser('Ed@x.co'); cm = await mkUser('cm@x.co'); vw = await mkUser('vw@x.co');
    stranger = await mkUser('stranger@x.co'); pendingUser = await mkUser('pend@x.co', 'pending');
    dbMod = require('../../lib/db');
    repo = require('../../lib/memberRepository').memberRepository;
    authz = require('../../lib/authz/index');
    audit = require('../../lib/audit');
    diagramId = await mkDiagram(owner);
  });
  afterAll(async () => {
    try { await dbMod?.getPool().end(); } catch (_) { /* ignore */ }
    await listener?.end();
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });
  beforeEach(() => { notes = []; });
  const settle = () => new Promise((r) => setTimeout(r, 80));

  test('findActiveUserByEmail is case-insensitive and returns only active accounts', async () => {
    expect((await repo.findActiveUserByEmail('  ED@X.CO ')).id).toBe(ed.id);
    expect(await repo.findActiveUserByEmail('pend@x.co')).toBeNull();
    expect(await repo.findActiveUserByEmail('nobody@x.co')).toBeNull();
    expect(await repo.findActiveUserByEmail('')).toBeNull();
  });

  test('addMember grants, a second add of the same user is a no-op (null), and NOTIFY authz_changed fires', async () => {
    const m = await repo.addMember(diagramId, vw.id, 'viewer', owner.id);
    expect(m).toMatchObject({ userId: vw.id, role: 'viewer', grantedBy: owner.id });
    expect(await repo.addMember(diagramId, vw.id, 'editor', owner.id)).toBeNull();
    expect((await repo.getMember(diagramId, vw.id)).role).toBe('viewer'); // not escalated by the duplicate
    await settle();
    expect(notes).toEqual([{ diagramId, userId: vw.id, change: 'grant', role: 'viewer' }]);
  });

  test('owner role can never be stored as a member row', async () => {
    await expect(pg.query("insert into diagram_members (diagram_id,user_id,role) values ($1,$2,'owner')", [diagramId, stranger.id])).rejects.toThrow();
    await expect(repo.addMember(diagramId, stranger.id, 'owner', owner.id)).rejects.toThrow();
  });

  test('authorize: roles resolve from membership and revoke is immediate', async () => {
    await repo.addMember(diagramId, ed.id, 'editor', owner.id);
    await repo.addMember(diagramId, cm.id, 'commenter', owner.id);
    expect((await authz.authorize(principal(ed), diagramId, 'diagram.write')).source).toBe('member');
    await expect(authz.authorize(principal(vw), diagramId, 'diagram.write')).rejects.toMatchObject({ status: 403 });
    await expect(authz.authorize(principal(cm), diagramId, 'diagram.write')).rejects.toMatchObject({ status: 403 });
    await expect(authz.authorize(principal(cm), diagramId, 'comment.create')).resolves.toMatchObject({ role: 'commenter' });
    await expect(authz.authorize(principal(stranger), diagramId, 'diagram.read')).rejects.toMatchObject({ status: 404 });

    expect(await repo.removeMember(diagramId, cm.id, 'commenter')).toBe(true);
    await expect(authz.authorize(principal(cm), diagramId, 'diagram.read')).rejects.toMatchObject({ status: 404 });
    await settle();
    expect(notes).toEqual(expect.arrayContaining([{ diagramId, userId: cm.id, change: 'revoke', role: 'commenter' }]));
  });

  test('setRole is compare-and-set on the current role', async () => {
    const changed = await repo.setRole(diagramId, vw.id, 'viewer', 'commenter');
    expect(changed).toMatchObject({ role: 'commenter' });
    // A concurrent change already happened: the stale "from" no longer matches, nothing is written
    expect(await repo.setRole(diagramId, vw.id, 'viewer', 'editor')).toBeNull();
    expect((await repo.getMember(diagramId, vw.id)).role).toBe('commenter');
    expect(await repo.removeMember(diagramId, vw.id, 'viewer')).toBe(false); // stale role: not removed
    expect(await repo.removeMember(diagramId, vw.id, 'commenter')).toBe(true);
    expect(await repo.removeMember(diagramId, vw.id, 'commenter')).toBe(false);
    await repo.addMember(diagramId, vw.id, 'viewer', owner.id);
  });

  test('listAccess returns the owner and members with who granted them', async () => {
    const acc = await repo.listAccess(diagramId);
    expect(acc.owner).toMatchObject({ id: owner.id, email: 'owner@x.co' });
    const byEmail = Object.fromEntries(acc.members.map((m) => [m.user.email, m]));
    expect(byEmail['Ed@x.co']).toMatchObject({ role: 'editor', grantedBy: { id: owner.id } });
    expect(byEmail['vw@x.co'].role).toBe('viewer');
    expect(acc.members.some((m) => m.user.id === owner.id)).toBe(false);
  });

  test('listSharedWith: metadata only (no content), owner shown, filtered to the member', async () => {
    const other = await mkDiagram(owner); // not shared with ed
    const rows = await repo.listSharedWith(ed.id);
    expect(rows.map((r) => r.id)).toEqual([diagramId]);
    // member-facing: owner name (else e-mail local part), never the address
    expect(rows[0]).toMatchObject({ role: 'editor', owner: { id: owner.id, name: 'owner' } });
    expect(rows[0].owner).not.toHaveProperty('email');
    expect(rows[0]).not.toHaveProperty('content');
    expect(rows.find((r) => r.id === other)).toBeUndefined();
    expect(await repo.listSharedWith(stranger.id)).toEqual([]);
    expect(await repo.listSharedWith(owner.id)).toEqual([]); // own diagrams are not "shared with me"
  });

  test('grants made by an editor persist after that editor is removed (granted_by is informational)', async () => {
    const d3 = await mkDiagram(owner);
    const grantor = await mkUser('grantor@x.co');
    const grantee = await mkUser('grantee@x.co');
    await repo.addMember(d3, grantor.id, 'editor', owner.id);
    await repo.addMember(d3, grantee.id, 'viewer', grantor.id);
    expect(await repo.removeMember(d3, grantor.id, 'editor')).toBe(true);
    expect(await repo.getMember(d3, grantee.id)).toMatchObject({ role: 'viewer', grantedBy: grantor.id });
    expect((await authz.authorize({ kind: 'user', userId: grantee.id, platformRole: 'user', status: 'active' }, d3, 'diagram.read')).role).toBe('viewer');
    // even deleting the grantor account only nulls granted_by
    await pg.query('delete from users where id=$1', [grantor.id]);
    expect(await repo.getMember(d3, grantee.id)).toMatchObject({ role: 'viewer', grantedBy: null });
  });

  test('deleting a user or a diagram cascades the membership', async () => {
    const d2 = await mkDiagram(owner);
    const tmp = await mkUser('tmp@x.co');
    await repo.addMember(d2, tmp.id, 'viewer', owner.id);
    await pg.query('delete from users where id=$1', [tmp.id]);
    expect(await repo.getMember(d2, tmp.id)).toBeNull();
    await repo.addMember(d2, ed.id, 'viewer', owner.id);
    await pg.query('delete from diagrams where id=$1', [d2]);
    expect(await repo.getMember(d2, ed.id)).toBeNull();
  });

  test('audit: events are inserted and listed newest-first with actor refs; events outlive the diagram', async () => {
    const d3 = await mkDiagram(owner);
    await audit.recordAuditEvent({ action: 'share.grant', actorUserId: owner.id, diagramId: d3, target: { userId: ed.id, role: 'viewer' } });
    await audit.recordAuditEvent({ action: 'share.change', actorUserId: owner.id, diagramId: d3, target: { userId: ed.id, from: 'viewer', to: 'editor' } });
    await audit.recordAuditEvent({ action: 'share.revoke', actorType: 'agent', actorUserId: owner.id, onBehalfOf: owner.id, diagramId: d3, target: { userId: ed.id } });
    const page1 = await audit.listAuditEvents(d3, { limit: 2 });
    expect(page1.items.map((i) => i.action)).toEqual(['share.revoke', 'share.change']);
    expect(page1.items[0]).toMatchObject({ actorType: 'agent', actor: { email: 'owner@x.co' }, onBehalfOf: { id: owner.id } });
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await audit.listAuditEvents(d3, { limit: 2, cursor: page1.nextCursor });
    expect(page2.items.map((i) => i.action)).toEqual(['share.grant']);
    expect(page2.nextCursor).toBeNull();
    await pg.query('delete from diagrams where id=$1', [d3]);
    expect((await audit.listAuditEvents(d3)).items).toHaveLength(3);
    // deleting the actor keeps the event (actor becomes null)
    const gone = await mkUser('gone@x.co');
    await audit.recordAuditEvent({ action: 'share.grant', actorUserId: gone.id, diagramId: d3 });
    await pg.query('delete from users where id=$1', [gone.id]);
    expect((await audit.listAuditEvents(d3, { limit: 1 })).items[0]).toMatchObject({ action: 'share.grant', actor: null });
  });
});

// Slice 4: comment repository against a THROWAWAY database (created and dropped here; all migrations applied).
// Skipped when no Postgres is configured. Never touches the shared database.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

const content = (ids, conns = []) => ({
  elements: ids.map((id, i) => ({ id, x: i * 100, y: 0, width: 50, height: 30 })),
  connections: conns.map((id) => ({ id })), layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});
const canvas = { type: 'canvas', x: 5, y: 6 };
const onEl = (targetId) => ({ type: 'element', targetId, x: 3, y: 4, fallbackX: 103, fallbackY: 4 });

dbDescribe('commentRepository (throwaway database)', () => {
  const dbName = `diagram_studio_cmttest_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let url; let repo; let CommentError; let pg; let userA; let userB; let seq = 0;
  const actor = (u) => ({ userId: u.id, via: 'web' });

  async function newDiagram(c0 = content(['a', 'b'])) {
    seq += 1;
    return (await pg.query(
      "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,$4) returning id",
      [`LAB-${seq}`, userA.email, userA.id, JSON.stringify(c0)])).rows[0].id;
  }
  const setContent = (id, c) => pg.query('update diagrams set content=$2, revision=revision+1 where id=$1', [id, JSON.stringify(c)]);

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(BASE_URL); u.pathname = `/${dbName}`; url = u.toString();
    await migrate({ connectionString: url, dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    process.env.DATABASE_URL = url;
    pg = new Client({ connectionString: url });
    await pg.connect();
    const mk = async (email, name) => (await pg.query("insert into users (email,name,status) values ($1,$2,'active') returning id,email", [email, name])).rows[0];
    userA = await mk('a@x.co', 'Alice'); userB = await mk('b@x.co', 'Bob');
    jest.resetModules();
    const dbMod = require('../../lib/db');
    ({ commentRepository: repo, CommentError } = require('../../lib/commentRepository'));
    global.__dbMod = dbMod;
  });
  afterAll(async () => {
    if (global.__dbMod) await global.__dbMod.getPool().end();
    if (pg) await pg.end();
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`); await admin.end(); }
  });

  test('createThread stores thread + first comment with identity, revision, and fallback for canvas', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'first <b>x</b>' }, actor(userA));
    expect(t.anchor).toEqual({ type: 'canvas', x: 5, y: 6 });
    expect(t.anchorState).toBe('canvas');
    expect(t.status).toBe('open');
    expect(t.createdBy).toMatchObject({ id: userA.id, name: 'Alice' });
    expect(t.createdAtRevision).toBe(0);
    expect(t.commentCount).toBe(1);
    expect(t.comments[0]).toMatchObject({ body: 'first <b>x</b>', deleted: false, createdVia: 'web', author: { id: userA.id, name: 'Alice' } });
    const row = (await pg.query('select fallback_x, fallback_y from comment_threads where id=$1', [t.id])).rows[0];
    expect(row).toEqual({ fallback_x: 5, fallback_y: 6 });
  });

  test('createThread on a missing diagram -> null', async () => {
    expect(await repo.createThread('00000000-0000-4000-8000-000000000000', { anchor: canvas, body: 'x' }, actor(userA))).toBeNull();
  });

  test('threads are scoped to their diagram', async () => {
    const d1 = await newDiagram(); const d2 = await newDiagram();
    const t = await repo.createThread(d1, { anchor: canvas, body: 'x' }, actor(userA));
    expect(await repo.getThread(d2, t.id)).toBeNull();
    expect((await repo.listThreads(d2)).items).toEqual([]);
    expect(await repo.setStatus(d2, t.id, 'resolved', actor(userB))).toBeNull();
    expect(await repo.addComment(d2, t.id, 'x', actor(userB))).toBeNull();
    const c = t.comments[0];
    expect(await repo.editComment(d2, c.id, 'y', actor(userA))).toBeNull();
    expect(await repo.deleteComment(d2, c.id, { userId: userA.id, canDeleteAny: true })).toBe(false);
  });

  test('anchor state: attached -> detached when the element is deleted -> attached again on restore (read-time)', async () => {
    const c0 = content(['a', 'b'], ['k1']);
    const d = await newDiagram(c0);
    const te = await repo.createThread(d, { anchor: onEl('b'), body: 'on b' }, actor(userA));
    const tk = await repo.createThread(d, { anchor: { type: 'connection', targetId: 'k1', x: 0, y: 0, fallbackX: 9, fallbackY: 9 }, body: 'on k1' }, actor(userA));
    const tc = await repo.createThread(d, { anchor: canvas, body: 'free' }, actor(userA));
    const states = async () => Object.fromEntries((await repo.listThreads(d, { status: 'all' })).items.map((t) => [t.id, t.anchorState]));
    expect(await states()).toEqual({ [te.id]: 'attached', [tk.id]: 'attached', [tc.id]: 'canvas' });

    await setContent(d, content(['a'], [])); // element b and connection k1 deleted
    expect(await states()).toEqual({ [te.id]: 'detached', [tk.id]: 'detached', [tc.id]: 'canvas' });
    const detached = (await repo.getThread(d, te.id));
    expect(detached.status).toBe('open'); // never auto-resolved or deleted
    expect(detached.anchor).toMatchObject({ fallbackX: 103, fallbackY: 4 });

    await setContent(d, c0); // version restore brings them back
    expect(await states()).toEqual({ [te.id]: 'attached', [tk.id]: 'attached', [tc.id]: 'canvas' });
  });

  test('content without arrays does not break listing', async () => {
    const d = await newDiagram({});
    await repo.createThread(d, { anchor: onEl('zz'), body: 'x' }, actor(userA));
    expect((await repo.listThreads(d)).items[0].anchorState).toBe('detached');
  });

  test('reply, then resolve / reopen; a reply reopens a resolved thread (Q-C2)', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'q' }, actor(userA));
    const r = await repo.addComment(d, t.id, 'a', actor(userB));
    expect(r).toMatchObject({ body: 'a', author: { id: userB.id, name: 'Bob' }, threadId: t.id });

    const resolved = await repo.setStatus(d, t.id, 'resolved', actor(userB));
    expect(resolved.status).toBe('resolved');
    expect(resolved.resolvedBy.id).toBe(userB.id);
    expect(resolved.resolvedAt).toBeTruthy();
    expect((await repo.listThreads(d, { status: 'open' })).items).toHaveLength(0);
    expect((await repo.listThreads(d, { status: 'resolved' })).items).toHaveLength(1);

    await repo.addComment(d, t.id, 'still broken', actor(userA));
    const after = await repo.getThread(d, t.id);
    expect(after.status).toBe('open');
    expect(after.resolvedBy).toBeUndefined();
    expect(after.comments.map((c) => c.body)).toEqual(['q', 'a', 'still broken']);

    await repo.setStatus(d, t.id, 'resolved', actor(userA));
    expect((await repo.setStatus(d, t.id, 'open', actor(userB))).status).toBe('open');
  });

  test('edit: only the author; sets editedAt; deleted comments cannot be edited', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'orig' }, actor(userA));
    const c = t.comments[0];
    await expect(repo.editComment(d, c.id, 'hacked', actor(userB))).rejects.toMatchObject({ status: 403 });
    const e = await repo.editComment(d, c.id, 'fixed', actor(userA));
    expect(e.body).toBe('fixed');
    expect(e.editedAt).toBeTruthy();
    await repo.addComment(d, t.id, 'keep thread alive', actor(userB));
    await repo.deleteComment(d, c.id, { userId: userA.id });
    expect(await repo.editComment(d, c.id, 'zombie', actor(userA))).toBeNull();
  });

  test('delete: author or canDeleteAny; soft (placeholder kept, body cleared); idempotent', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'secret' }, actor(userA));
    const r = await repo.addComment(d, t.id, 'reply', actor(userB));
    await expect(repo.deleteComment(d, t.comments[0].id, { userId: userB.id, canDeleteAny: false })).rejects.toMatchObject({ status: 403 });
    expect(await repo.deleteComment(d, r.id, { userId: userA.id, canDeleteAny: true })).toBe(true); // owner moderation
    expect(await repo.deleteComment(d, r.id, { userId: userA.id, canDeleteAny: true })).toBe(true);
    const got = await repo.getThread(d, t.id);
    expect(got.comments[1]).toMatchObject({ deleted: true, body: '' });
    expect(got.commentCount).toBe(2);
    const raw = (await pg.query('select body, deleted_at from comments where id=$1', [r.id])).rows[0];
    expect(raw.body).toBe('');
    expect(raw.deleted_at).toBeTruthy();
    expect(await repo.deleteComment(d, '00000000-0000-4000-8000-000000000000', { userId: userA.id })).toBe(false);
  });

  test('a thread whose comments are all deleted is hidden everywhere and cannot be replied to', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'only' }, actor(userA));
    await repo.deleteComment(d, t.comments[0].id, { userId: userA.id });
    expect((await repo.listThreads(d, { status: 'all' })).items).toEqual([]);
    expect(await repo.getThread(d, t.id)).toBeNull();
    expect(await repo.addComment(d, t.id, 'x', actor(userB))).toBeNull();
    expect(await repo.setStatus(d, t.id, 'resolved', actor(userB))).toBeNull();
  });

  test('list: anchorTarget filter, newest 20 comments but full count, pagination by cursor', async () => {
    const d = await newDiagram();
    const big = await repo.createThread(d, { anchor: onEl('a'), body: 'c0' }, actor(userA));
    for (let i = 1; i <= 24; i++) await repo.addComment(d, big.id, `c${i}`, actor(userB));
    const listed = (await repo.listThreads(d, { anchorTarget: 'a' })).items;
    expect(listed).toHaveLength(1);
    expect(listed[0].commentCount).toBe(25);
    expect(listed[0].comments).toHaveLength(20);
    expect(listed[0].comments[19].body).toBe('c24'); // newest, chronological order
    expect((await repo.getThread(d, big.id)).comments).toHaveLength(25);
    expect((await repo.listThreads(d, { anchorTarget: 'nope' })).items).toEqual([]);

    for (let i = 0; i < 4; i++) await repo.createThread(d, { anchor: canvas, body: `t${i}` }, actor(userA));
    const p1 = await repo.listThreads(d, { limit: 2 });
    expect(p1.items).toHaveLength(2);
    expect(p1.nextCursor).toBeTruthy();
    const p2 = await repo.listThreads(d, { limit: 2, cursor: p1.nextCursor });
    const p3 = await repo.listThreads(d, { limit: 2, cursor: p2.nextCursor });
    const ids = [...p1.items, ...p2.items, ...p3.items].map((t) => t.id);
    expect(new Set(ids).size).toBe(5);
    expect(p3.nextCursor).toBeNull();
    await expect(repo.listThreads(d, { cursor: '!!!' })).rejects.toBeInstanceOf(CommentError);
  });

  test('comments are independent of content writes and cascade with the diagram', async () => {
    const d = await newDiagram();
    await repo.createThread(d, { anchor: canvas, body: 'x' }, actor(userA));
    await setContent(d, content([]));
    expect((await repo.listThreads(d)).items).toHaveLength(1);
    await pg.query('delete from diagrams where id=$1', [d]);
    expect((await pg.query('select count(*)::int n from comment_threads where diagram_id=$1', [d])).rows[0].n).toBe(0);
  });

  test('deleting a user keeps their comments (author becomes null)', async () => {
    const d = await newDiagram();
    const tmp = (await pg.query("insert into users (email,name,status) values ('tmp@x.co','Tmp','active') returning id")).rows[0];
    const t = await repo.createThread(d, { anchor: canvas, body: 'bye' }, { userId: tmp.id, via: 'web' });
    await pg.query('delete from users where id=$1', [tmp.id]);
    const got = await repo.getThread(d, t.id);
    expect(got.comments[0].author).toBeNull();
    expect(got.createdBy).toBeNull();
  });

  test('database constraints: body length and canvas/target pairing', async () => {
    const d = await newDiagram();
    const t = await repo.createThread(d, { anchor: canvas, body: 'x' }, actor(userA));
    await expect(pg.query('insert into comments (thread_id, body) values ($1, $2)', [t.id, 'x'.repeat(10001)])).rejects.toThrow();
    await expect(pg.query("insert into comment_threads (diagram_id, anchor_type, anchor_x, anchor_y) values ($1,'element',0,0)", [d])).rejects.toThrow();
  });
});

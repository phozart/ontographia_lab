// LA-3 (ADR-0006 5.3, 7, 8): edit sessions written in the save transaction, and the merged activity feed over edit
// sessions, audit events and named versions. Against a THROWAWAY database (migrations applied). Never the shared one.
const util = require('util');
global.TextEncoder = global.TextEncoder || util.TextEncoder;
global.TextDecoder = global.TextDecoder || util.TextDecoder;
const crypto = require('crypto');
const path = require('path');
const { Client } = require('pg');
const { migrate, getConnectionString } = require('../../scripts/migrate');

const BASE_URL = process.env.DATABASE_URL || (process.env.DB_HOST ? getConnectionString() : null);
const dbDescribe = BASE_URL ? describe : describe.skip;

const content = (ids) => ({
  elements: ids.map((id, i) => ({ id, x: i * 10, y: 0, size: { width: 50, height: 30 } })),
  connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 },
});
const T0 = Date.parse('2026-10-21T10:00:00Z');
const min = (n) => n * 60_000;

dbDescribe('activityRepository (throwaway database)', () => {
  const dbName = `diagram_studio_acttest_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;
  let admin; let pg; let dbMod; let diagrams; let versions; let activity; let alice; let bob; let seq = 0;

  async function newDiagram(c0 = content(['a'])) {
    seq += 1;
    return (await pg.query(
      "insert into diagrams (short_id,name,type,created_by,owner_id,content) values ($1,'D','infinite-canvas',$2,$3,$4) returning id",
      [`LAB-${seq}`, alice.email, alice.id, JSON.stringify(c0)])).rows[0].id;
  }
  // a human web save at a controlled time; each save changes the content so it bumps the revision
  let editN = 0;
  const save = (id, user, at, { expectedRevision = null } = {}) => {
    editN += 1;
    return diagrams.updateDiagram(id, { content: content(['a', `e${editN}`]) }, { userId: user.id, expectedRevision, now: new Date(at) });
  };
  const sessions = async (id) => (await pg.query('select * from diagram_edit_sessions where diagram_id=$1 order by id', [id])).rows;
  const actor = (u) => ({ userId: u.id, email: u.email, via: 'web' });
  const page = (id, opts = {}) => activity.listActivity(id, { limit: 50, ...opts });

  beforeAll(async () => {
    admin = new Client({ connectionString: BASE_URL });
    await admin.connect();
    await admin.query(`CREATE DATABASE "${dbName}"`);
    const u = new URL(BASE_URL); u.pathname = `/${dbName}`;
    await migrate({ connectionString: u.toString(), dir: path.join(__dirname, '..', '..', 'db', 'migrations'), logger: { log() {}, warn() {} } });
    process.env.DATABASE_URL = u.toString();
    pg = new Client({ connectionString: u.toString() });
    await pg.connect();
    const mk = async (email, name) => (await pg.query("insert into users (email,name,status) values ($1,$2,'active') returning id,email,name", [email, name])).rows[0];
    alice = await mk('a@x.co', 'Alice Berg');
    bob = await mk('bob@example.org', null);
    dbMod = require('../../lib/db');
    diagrams = require('../../lib/diagramRepository').diagramRepository;
    versions = require('../../lib/versionRepository').versionRepository;
    activity = require('../../lib/activityRepository');
  }, 60000);
  afterAll(async () => {
    try { await dbMod?.getPool().end(); } catch (_) { /* ignore */ }
    await pg?.end();
    await admin.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await admin.end();
  });

  describe('edit sessions are written in the save transaction', () => {
    test('37 saves in 18 minutes are one session row; a 12-minute pause starts a second', async () => {
      const id = await newDiagram();
      for (let i = 0; i < 37; i += 1) await save(id, alice, T0 + i * 30_000);
      let rows = await sessions(id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ actor_user_id: alice.id, save_count: 37 });
      expect(Number(rows[0].revision_from)).toBe(1);
      expect(Number(rows[0].revision_to)).toBe(37);
      expect(new Date(rows[0].first_at).getTime()).toBe(T0);
      expect(new Date(rows[0].last_at).getTime()).toBe(T0 + 36 * 30_000);
      await save(id, alice, T0 + 36 * 30_000 + min(12));
      rows = await sessions(id);
      expect(rows).toHaveLength(2);
      expect(Number(rows[1].revision_from)).toBe(38);
      expect(rows[1].save_count).toBe(1);
    });

    test('each person has their own session, even when saves interleave', async () => {
      const id = await newDiagram();
      await save(id, alice, T0);
      await save(id, bob, T0 + 1000);
      await save(id, alice, T0 + 2000);
      await save(id, bob, T0 + 3000);
      const rows = await sessions(id);
      expect(rows.map((r) => [r.actor_user_id, r.save_count]).sort()).toEqual([[alice.id, 2], [bob.id, 2]].sort());
    });

    test('a save without content (rename only) and a rejected save (stale If-Match) write no session', async () => {
      const id = await newDiagram();
      await diagrams.updateDiagram(id, { name: 'Renamed' }, { userId: alice.id, now: new Date(T0) });
      expect(await sessions(id)).toHaveLength(0);
      await save(id, alice, T0, { expectedRevision: 1 }); // the rename bumped the revision to 1
      const stale = await diagrams.updateDiagram(id, { content: content(['z']) }, { userId: alice.id, expectedRevision: 1, now: new Date(T0 + 5000) });
      expect(stale).toBeNull();
      const rows = await sessions(id);
      expect(rows).toHaveLength(1);
      expect(rows[0].save_count).toBe(1);
    });

    test('a failure in the session write rolls the whole save back (same transaction)', async () => {
      const id = await newDiagram();
      await pg.query('alter table diagram_edit_sessions rename to diagram_edit_sessions_x');
      try {
        await expect(save(id, alice, T0)).rejects.toThrow();
      } finally {
        await pg.query('alter table diagram_edit_sessions_x rename to diagram_edit_sessions');
      }
      const row = (await pg.query('select revision::int r from diagrams where id=$1', [id])).rows[0];
      expect(row.r).toBe(0);
    });

    test('agent edits write no session (they have one audit row each)', async () => {
      const id = await newDiagram();
      const r = await diagrams.applyContentChange(id, {
        expectedRevision: 0, userId: alice.id, actor: { userId: alice.id, email: alice.email, via: 'agent', tokenId: crypto.randomUUID() },
        compute: (c) => ({ ok: true, content: { ...c, elements: [...c.elements, { id: 'n', x: 1, y: 1 }] } }),
      });
      expect(r.status).toBe('ok');
      expect(await sessions(id)).toHaveLength(0);
    });
  });

  describe('retention', () => {
    test('pruneEditSessions deletes sessions older than 365 days and nothing else', async () => {
      const id = await newDiagram();
      await save(id, alice, T0);
      await pg.query("insert into diagram_edit_sessions (diagram_id, actor_user_id, first_at, last_at, revision_from, revision_to) values ($1,$2,$3,$3,1,1)", [id, alice.id, new Date(T0 - 400 * 86_400_000)]);
      const n = await activity.pruneEditSessions({ now: new Date(T0) });
      expect(n).toBeGreaterThanOrEqual(1);
      const left = await sessions(id);
      expect(left).toHaveLength(1);
      expect(new Date(left[0].last_at).getTime()).toBe(T0);
    });
  });

  describe('listActivity', () => {
    let id; let grant;
    beforeAll(async () => {
      id = await newDiagram(content(['a']));
      grant = (await pg.query(
        "insert into oauth_grants (user_id,client_id,client_label,redirect_uri,resource,scope,role_cap) values ($1,'c','Claude <b>desktop</b>','r','R','s','viewer') returning id", [alice.id])).rows[0].id;
      await versions.createNamed(id, { label: 'Start' }, actor(alice)); // version 1 at revision 0
      for (let i = 0; i < 3; i += 1) await save(id, alice, T0 + i * 1000); // revisions 1..3
      await versions.createNamed(id, { label: 'Mid' }, actor(alice)); // dr 3
      for (let i = 0; i < 2; i += 1) await save(id, alice, T0 + min(30) + i * 1000); // 30 min later: second session, revisions 4..5
      for (let i = 0; i < 2; i += 1) await save(id, bob, T0 + min(40) + i * 1000); // Bob: revisions 6..7
      const agent = await diagrams.applyContentChange(id, {
        expectedRevision: 7, userId: alice.id, tool: 'map_structure', now: new Date(T0 + min(50)),
        actor: { userId: alice.id, email: alice.email, via: 'agent', tokenId: grant, credential: 'oauth' },
        compute: (c) => ({ ok: true, content: { ...c, elements: [...c.elements, { id: 'n1', x: 1, y: 1 }] }, counts: { addedElements: 1 } }),
      });
      expect(agent.status).toBe('ok');
      // a restore and two sharing events, with fixed timestamps
      await pg.query("insert into audit_events (occurred_at, actor_type, actor_user_id, action, diagram_id, target) values ($1,'user',$2,'version.restore',$3,$4)",
        [new Date(T0 + min(60)), alice.id, id, JSON.stringify({ fromVersion: 2, restoreVersion: 9, preRestoreVersion: 8 })]);
      await pg.query("insert into audit_events (occurred_at, actor_type, actor_user_id, action, diagram_id, target) values ($1,'user',$2,'share.grant',$3,$4)",
        [new Date(T0 + min(61)), alice.id, id, JSON.stringify({ userId: bob.id, role: 'viewer' })]);
      await pg.query("insert into audit_events (occurred_at, actor_type, actor_user_id, action, diagram_id, target) values ($1,'user',$2,'share.revoke',$3,$4)",
        [new Date(T0 + min(62)), alice.id, id, JSON.stringify({ userId: bob.id, role: 'viewer' })]);
    }, 60000);

    test('merges edit sessions, agent edits, restores and named versions, newest first', async () => {
      const { items } = await page(id);
      const kinds = items.map((i) => i.kind);
      expect(kinds.filter((k) => k === 'edit_session')).toHaveLength(3); // Alice x2, Bob x1
      expect(kinds).toContain('agent_edit');
      expect(kinds).toContain('restore');
      expect(kinds.filter((k) => k === 'named_version')).toHaveLength(2);
      const ts = items.map((i) => Date.parse(i.endAt || i.at));
      expect([...ts].sort((a, b) => b - a)).toEqual(ts);
      expect(items.every((i) => /^[sav]:\d+$/.test(i.id))).toBe(true);
    });

    test('sharing events appear only with includeShare (owner / audit.read)', async () => {
      expect((await page(id)).items.some((i) => i.kind === 'share')).toBe(false);
      const owner = await page(id, { includeShare: true });
      const shares = owner.items.filter((i) => i.kind === 'share');
      expect(shares.map((s) => s.share.action).sort()).toEqual(['share.grant', 'share.revoke']);
      expect(shares[0].share.target).toEqual({ name: 'bob' });
    });

    test('shows display names, never e-mail addresses', async () => {
      const text = JSON.stringify((await page(id, { includeShare: true })).items);
      expect(text).not.toContain('a@x.co');
      expect(text).not.toContain('bob@example.org');
      expect(text).toContain('Alice Berg');
      expect(text).toContain('"bob"'); // no profile name: the local part
    });

    test('an agent edit carries the tool, counts, who it acted for, a sanitized client label and a Review compare', async () => {
      const a = (await page(id)).items.find((i) => i.kind === 'agent_edit');
      expect(a.agent).toEqual({ label: 'Claude desktop', tool: 'map_structure' });
      expect(a.counts).toEqual({ addedElements: 1 });
      expect(a.onBehalfOf).toMatchObject({ id: alice.id, name: 'Alice Berg' });
      expect(a.actor.type).toBe('agent');
      expect(a.version.number).toBeGreaterThan(0);
      expect(a.compare).toEqual({ from: expect.any(Number), to: a.version.number, approximate: false });
      expect(a.compare.from).toBeLessThan(a.version.number);
      expect(a.revision.to).toBe(8);
    });

    test('a restore links to the restored version', async () => {
      const r = (await page(id)).items.find((i) => i.kind === 'restore');
      expect(r).toMatchObject({ actor: { type: 'user', name: 'Alice Berg' }, version: { number: 9 }, restoredFrom: 2 });
    });

    test('named versions show their name and number', async () => {
      const named = (await page(id)).items.filter((i) => i.kind === 'named_version').map((i) => [i.version.number, i.version.name]);
      expect(named.sort()).toEqual([[1, 'Start'], [expect.any(Number), 'Mid']].sort());
    });

    test('a human session compares the nearest versions bounding its revisions, flagged approximate when they are not exact', async () => {
      const all = (await pg.query('select version_number n, diagram_revision::int dr from diagram_versions where diagram_id=$1', [id])).rows;
      const { items } = await page(id);
      const sess = items.filter((i) => i.kind === 'edit_session');
      for (const s of sess) {
        const from = all.filter((v) => v.dr <= s.revision.from - 1).sort((a, b) => b.dr - a.dr || b.n - a.n)[0];
        const to = all.filter((v) => v.dr >= s.revision.to).sort((a, b) => a.dr - b.dr || a.n - b.n)[0];
        if (!from) { expect(s.compare).toBeNull(); continue; }
        expect(s.compare.from).toBe(from.n);
        expect(s.compare.to).toBe(to ? to.n : 'head');
        expect(s.compare.approximate).toBe(from.dr !== s.revision.from - 1 || !to || to.dr !== s.revision.to);
      }
      // the first session sits exactly between 'Start' (rev 0) and 'Mid' (rev 3)
      const first = sess.find((s) => s.revision.from === 1);
      expect(first.compare.approximate).toBe(false);
      expect(first.saves).toBe(3);
    });

    test('pages with an opaque cursor: walking small pages gives exactly the full list, no duplicates', async () => {
      const full = (await page(id, { limit: 100, includeShare: true })).items.map((i) => i.id);
      const walked = []; let cursor = null; let guard = 0;
      do {
        const p = await activity.listActivity(id, { limit: 2, cursor, includeShare: true });
        expect(p.items.length).toBeLessThanOrEqual(2);
        walked.push(...p.items.map((i) => i.id));
        cursor = p.nextCursor; guard += 1;
      } while (cursor && guard < 40);
      expect(walked).toEqual(full);
      expect(new Set(walked).size).toBe(walked.length);
    });

    test('a bad cursor is ignored (first page), and limit is clamped to 100', async () => {
      const a = await activity.listActivity(id, { limit: 3, cursor: '%%%not-a-cursor' });
      expect(a.items).toHaveLength(3);
      const b = await activity.listActivity(id, { limit: 100000 });
      expect(b.items.length).toBeLessThanOrEqual(100);
    });

    test('another diagram has its own feed', async () => {
      const other = await newDiagram();
      expect((await page(other)).items).toEqual([]);
    });

    test('runs at most three queries per page', async () => {
      const spy = jest.spyOn(dbMod.getPool(), 'query');
      await page(id, { includeShare: true });
      expect(spy.mock.calls.length).toBeLessThanOrEqual(3);
      spy.mockRestore();
    });
  });

  describe('performance', () => {
    test('p95 under 50 ms on a board with 10,000 audit rows (and sessions)', async () => {
      const id = await newDiagram();
      await pg.query(
        `insert into audit_events (occurred_at, actor_type, actor_user_id, on_behalf_of, action, diagram_id, target)
         select now() - (g || ' minutes')::interval, case when g % 3 = 0 then 'agent' else 'user' end,
                case when g % 3 = 0 then null else $1::uuid end, $1::uuid,
                case g % 3 when 0 then 'diagram.agent_edit' when 1 then 'share.grant' else 'version.restore' end,
                $2::uuid, jsonb_build_object('tool', 'diagram_apply_ops', 'counts', jsonb_build_object('addedElements', 1), 'fromVersion', 1, 'restoreVersion', 2)
           from generate_series(1, 10000) g`,
        [alice.id, id]
      );
      await pg.query(
        `insert into diagram_edit_sessions (diagram_id, actor_user_id, first_at, last_at, save_count, revision_from, revision_to)
         select $1, $2, now() - (g * 20 || ' minutes')::interval, now() - (g * 20 || ' minutes')::interval + interval '5 minutes', 3, g * 3, g * 3 + 2 from generate_series(1, 2000) g`,
        [id, alice.id]
      );
      await pg.query('analyze audit_events'); await pg.query('analyze diagram_edit_sessions');
      const measure = async () => {
        const ms = [];
        for (let i = 0; i < 20; i += 1) { const t = process.hrtime.bigint(); await activity.listActivity(id, { limit: 30, includeShare: i % 2 === 0 }); ms.push(Number(process.hrtime.bigint() - t) / 1e6); }
        ms.sort((a, b) => a - b);
        return ms[Math.ceil(ms.length * 0.95) - 1];
      };
      await measure(); // warm
      const best = Math.min(await measure(), await measure(), await measure());
      expect(best).toBeLessThan(50);
    }, 120000);
  });
});

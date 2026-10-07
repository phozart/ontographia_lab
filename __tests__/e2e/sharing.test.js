/**
 * E2E: slice 5 - sharing matrix with five separate browser contexts (owner, editor, commenter, viewer, platform
 * admin without a grant). Opt-in: needs the app at TEST_BASE_URL and seeded accounts, so it only runs when
 * E2E_SHARING_USERS=1. Seed (active, same password in E2E_SHARING_PASSWORD, default below) in a THROWAWAY database:
 *   alice@s5.test (owner), bob@s5.test, carol@s5.test, dave@s5.test, pending@s5.test (status pending)
 * plus QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD from .env.qa.local as the platform admin.
 * Asserts: viewer cannot save (server 403, UI read-only), commenter can comment but not edit, editor can edit and
 * see the access list, revoke is immediate, admin gets no implicit access.
 */
const path = require('path');
const puppeteer = require('puppeteer');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

jest.setTimeout(240000);
const BASE = process.env.TEST_BASE_URL || 'http://localhost:3002';
const PW = process.env.E2E_SHARING_PASSWORD || 'S5-test-pass-1';
const maybe = process.env.E2E_SHARING_USERS === '1' ? describe : describe.skip;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const qa = { QA_ADMIN_EMAIL: process.env.QA_ADMIN_EMAIL, QA_ADMIN_PASSWORD: process.env.QA_ADMIN_PASSWORD };
const failures = [];
const check = (name, cond, extra = '') => { if (!cond) failures.push(`${name} ${extra}`); };
const shot = async () => {};

async function login(browser, email, password) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.setViewport({ width: 1400, height: 900 });
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle0' });
  await page.type('#email', email);
  await page.type('#password', password);
  await Promise.all([
    page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  return page;
}
const api = (page, method, url, body) => page.evaluate(async (method, url, body) => {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  let j = null; try { j = await r.json(); } catch (_) { /* empty */ }
  return { status: r.status, body: j };
}, method, url, body);

maybe('Sharing matrix (slice 5)', () => {
  let browser;
  afterAll(async () => { if (browser) await browser.close(); });

  it('enforces roles server-side and reflects them in the editor UI', async () => {
  browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const alice = await login(browser, 'alice@s5.test', PW);
    const bob = await login(browser, 'bob@s5.test', PW);
    const carol = await login(browser, 'carol@s5.test', PW);
    const dave = await login(browser, 'dave@s5.test', PW);
    const admin = await login(browser, qa.QA_ADMIN_EMAIL, qa.QA_ADMIN_PASSWORD);

    const content = { elements: [{ id: 'e1', type: 'process-flow/task', x: 200, y: 200, width: 140, height: 70, label: 'Hello' }], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
    const created = await api(alice, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: 'S5 Shared', content });
    check('owner creates diagram', created.status === 201, String(created.status));
    const id = created.body.id; const shortId = created.body.short_id;

    // Before sharing: nobody else can see it
    for (const [n, p] of [['bob', bob], ['carol', carol], ['admin', admin]]) {
      const r = await api(p, 'GET', `/api/diagrams/${id}`);
      check(`${n} has no access before sharing (404)`, r.status === 404, String(r.status));
    }

    // Owner shares through the dialog UI
    await alice.goto(`${BASE}/diagram/${shortId}`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    await alice.waitForSelector('button[title="Share"]');
    await alice.click('button[title="Share"]');
    await alice.waitForSelector('[data-testid="share-email"]');
    const addVia = async (email, role) => {
      await alice.click('[data-testid="share-email"]', { clickCount: 3 });
      await alice.type('[data-testid="share-email"]', email);
      await alice.select('[data-testid="share-role"]', role);
      await alice.click('[data-testid="share-add"]');
      await sleep(900);
    };
    await addVia('nobody@s5.test', 'viewer');
    const errText = await alice.$eval('[data-testid="share-error"]', (e) => e.textContent).catch(() => '');
    check('unknown email shows a clear error', /no active account/i.test(errText), errText);
    await addVia('pending@s5.test', 'viewer');
    const errText2 = await alice.$eval('[data-testid="share-error"]', (e) => e.textContent).catch(() => '');
    check('pending account cannot be shared with', /no active account/i.test(errText2), errText2);
    await addVia('bob@s5.test', 'editor');
    await addVia('carol@s5.test', 'commenter');
    await addVia('dave@s5.test', 'viewer');
    await sleep(500);
    const members = await alice.$$eval('[data-testid="share-members"] li', (els) => els.map((e) => e.textContent));
    check('dialog lists owner + 3 members', members.length === 4, JSON.stringify(members.map((m) => m.slice(0, 30))));
    const auditCount = await alice.$$eval('[data-testid="share-audit"] li', (els) => els.length);
    check('owner sees audit rows in the dialog', auditCount >= 3, String(auditCount));
    await shot(alice, '01-owner-share-dialog');
    await alice.keyboard.press('Escape');

    // Server matrix
    const put = (p) => api(p, 'PUT', `/api/diagrams/${id}`, { content: { ...content, elements: [...content.elements, { id: `n${Math.random().toString(36).slice(2, 6)}`, type: 'process-flow/task', x: 10, y: 10, width: 50, height: 50 }] } });
    check('editor can save (200)', (await put(bob)).status === 200);
    const cp = await put(carol); check('commenter cannot save (403)', cp.status === 403, JSON.stringify(cp.body));
    const dp = await put(dave); check('viewer cannot save (403)', dp.status === 403, JSON.stringify(dp.body));
    check('admin non-member cannot read (404)', (await api(admin, 'GET', `/api/diagrams/${id}`)).status === 404);
    check('viewer cannot create a version (403)', (await api(dave, 'POST', `/api/diagrams/${id}/versions`, { label: 'x' })).status === 403);
    check('viewer cannot restore (403)', (await api(dave, 'POST', `/api/diagrams/${id}/versions/1/restore`, {})).status === 403);
    check('commenter cannot restore (403)', (await api(carol, 'POST', `/api/diagrams/${id}/versions/1/restore`, {})).status === 403);
    check('viewer cannot see access list (403)', (await api(dave, 'GET', `/api/diagrams/${id}/access`)).status === 403);
    check('editor sees access list (200)', (await api(bob, 'GET', `/api/diagrams/${id}/access`)).status === 200);
    check('editor cannot read audit (403)', (await api(bob, 'GET', `/api/diagrams/${id}/audit`)).status === 403);
    check('editor cannot grant editor (403)', (await api(bob, 'POST', `/api/diagrams/${id}/shares`, { email: 'dave@s5.test', role: 'editor' })).status === 403);
    check('editor can add viewer is blocked only for existing member (409)', (await api(bob, 'POST', `/api/diagrams/${id}/shares`, { email: 'dave@s5.test', role: 'viewer' })).status === 409);
    const ownerId = (await api(alice, 'GET', `/api/diagrams/${id}/access`)).body.owner.id;
    check('owner cannot be removed (409)', (await api(alice, 'DELETE', `/api/diagrams/${id}/members/${ownerId}`)).status === 409);
    check('editor cannot delete diagram (403)', (await api(bob, 'DELETE', `/api/diagrams/${id}`)).status === 403);
    const thr = await api(carol, 'POST', `/api/diagrams/${id}/threads`, { body: 'Looks good', anchor: { type: 'canvas', x: 10, y: 10 } });
    check('commenter can comment (201)', thr.status === 201, JSON.stringify(thr.body).slice(0, 120));
    check('viewer cannot comment (403)', (await api(dave, 'POST', `/api/diagrams/${id}/threads`, { body: 'x', anchor: { type: 'canvas', x: 1, y: 1 } })).status === 403);
    const list = await api(dave, 'GET', `/api/diagrams/${id}/threads`);
    check('viewer can read comments', list.status === 200);
    const authorName = JSON.stringify(list.body).match(/Carol Commenter|carol/);
    check('comment author shows a display name', !!authorName && !/carol@s5\.test/.test(JSON.stringify(list.body)), authorName && authorName[0]);

    // UI: read-only editor for viewer / commenter, editable for editor
    await dave.goto(`${BASE}/diagram/${shortId}`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    const davePill = await dave.$eval('[data-testid="access-pill"]', (e) => e.textContent).catch(() => null);
    check('viewer sees "View only"', davePill === 'View only', String(davePill));
    check('viewer has no Share button', !(await dave.$('button[title="Share"]')));
    await shot(dave, '02-viewer-readonly');
    // drag attempt + autosave: nothing may be written
    const before = (await api(alice, 'GET', `/api/diagrams/${id}`)).body.revision;
    await dave.mouse.move(300, 300); await dave.mouse.down(); await dave.mouse.move(380, 360, { steps: 5 }); await dave.mouse.up();
    await dave.keyboard.press('Delete');
    await sleep(2500);
    const after = (await api(alice, 'GET', `/api/diagrams/${id}`)).body.revision;
    check('viewer UI interaction does not change revision', before === after, `${before}->${after}`);

    // Palette drop by a viewer: nothing is created locally and no contextual toolbar appears
    const nodesBefore = await dave.$$eval('[data-node-id]', (n) => n.length);
    await dave.evaluate(() => {
      const area = document.querySelector('.ds-canvas-area');
      const dt = new DataTransfer();
      dt.setData('application/json', JSON.stringify({ type: 'stencil', packId: 'process-flow', stencilId: 'task' }));
      const r = area.getBoundingClientRect();
      area.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt, clientX: r.left + 400, clientY: r.top + 300 }));
    });
    await sleep(500);
    check('viewer palette drop creates no element', (await dave.$$eval('[data-node-id]', (n) => n.length)) === nodesBefore);
    check('viewer palette drop shows no contextual toolbar', !(await dave.$('.ds-contextual-toolbar')));

    await carol.goto(`${BASE}/diagram/${shortId}`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    const carolPill = await carol.$eval('[data-testid="access-pill"]', (e) => e.textContent).catch(() => null);
    check('commenter sees "Can comment"', carolPill === 'Can comment', String(carolPill));
    await shot(carol, '03-commenter');

    await bob.goto(`${BASE}/diagram/${shortId}`, { waitUntil: 'networkidle0' });
    await sleep(2500);
    check('editor has no pill', !(await bob.$('[data-testid="access-pill"]')));
    check('editor has Share button', !!(await bob.$('button[title="Share"]')));
    await bob.click('button[title="Share"]');
    await bob.waitForSelector('[data-testid="share-members"]');
    const bobOptions = await bob.$$eval('[data-testid="share-role"] option', (o) => o.map((x) => x.value));
    check('editor can only pick viewer/commenter', JSON.stringify(bobOptions) === JSON.stringify(['viewer', 'commenter']), JSON.stringify(bobOptions));
    check('editor sees no audit section', !(await bob.$('[data-testid="share-audit"]')));
    await shot(bob, '04-editor-share-dialog');
    await bob.keyboard.press('Escape');

    // Dashboard "Shared with me"
    await dave.goto(`${BASE}/dashboard`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const sw = await dave.$eval('[data-testid="shared-with-me"]', (e) => e.textContent).catch(() => '');
    check('dashboard shows Shared with me with owner', /S5 Shared/.test(sw) && /Alice Owner/.test(sw) && /View only/.test(sw), sw.slice(0, 120));
    await shot(dave, '05-dashboard-shared');

    // Role change takes effect on the next request; revoke is immediate
    const daveUserId = (await api(alice, 'GET', `/api/diagrams/${id}/access`)).body.members.find((m) => m.user.email === 'dave@s5.test').user.id;
    check('owner promotes viewer to editor', (await api(alice, 'PUT', `/api/diagrams/${id}/members/${daveUserId}`, { role: 'editor' })).status === 200);
    check('promoted user can now save', (await put(dave)).status === 200);
    check('owner revokes', (await api(alice, 'DELETE', `/api/diagrams/${id}/members/${daveUserId}`)).status === 204);
    check('revoked user is denied on the very next request (404)', (await api(dave, 'GET', `/api/diagrams/${id}`)).status === 404);
    check('revoked user cannot save (404)', (await put(dave)).status === 404);
    await dave.goto(`${BASE}/diagram/${shortId}`, { waitUntil: 'networkidle0' });
    await sleep(1500);
    const txt = await dave.evaluate(() => document.body.innerText);
    check('revoked user sees not-found page', /not found|do not have access/i.test(txt));

    const audit = await api(alice, 'GET', `/api/diagrams/${id}/audit`);
    const actions = (audit.body.items || []).map((i) => i.action);
    check('audit has grant/change/revoke', ['share.grant', 'share.change', 'share.revoke'].every((a) => actions.includes(a)), actions.join(','));
  } finally {
    await browser.close();
    browser = null;
  }
    expect(failures).toEqual([]);
  });
});

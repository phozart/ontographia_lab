// LA-3: the Activity tab (ADR-0006 5.3): live agent row, grouped feed, Review / Compare, paging, states.
import { render, screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import ActivityTab from '../../../components/diagram-studio/activity/ActivityTab';
import { getCompare, setCompare } from '../../../components/diagram-studio/versions/compareStore';

const NOW = new Date('2026-10-21T15:00:00');
const iso = (h, m = 0) => new Date(`2026-10-21T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();

const agentEdit = (n, when, over = {}) => ({
  id: `a:${n}`, kind: 'agent_edit', at: when, actor: { type: 'agent', id: null, name: 'Claude' }, onBehalfOf: { id: 'u1', name: 'Peter' },
  agent: { label: 'Claude', tool: 'map_structure' }, counts: { addedElements: 12, updated: 3 }, revision: { to: 20 + n }, version: { number: 10 + n },
  compare: { from: 9 + n, to: 10 + n, approximate: false }, ...over,
});
const sess = { id: 's:1', kind: 'edit_session', at: iso(14, 2), endAt: iso(14, 20), actor: { type: 'user', id: 'u2', name: 'Anna Berg' }, saves: 37, revision: { from: 1, to: 37 }, compare: { from: 3, to: 4, approximate: true } };
const named = { id: 'v:7', kind: 'named_version', at: iso(9, 10), actor: { type: 'user', id: 'u1', name: 'Peter H.' }, version: { number: 7, name: 'Workshop end' } };
const restore = { id: 'a:5', kind: 'restore', at: iso(8, 0), actor: { type: 'user', id: 'u1', name: 'Peter H.' }, version: { number: 14 }, restoredFrom: 12 };
const share = { id: 'a:6', kind: 'share', at: iso(7, 0), actor: { type: 'user', id: 'u1', name: 'Peter H.' }, share: { action: 'share.grant', role: 'viewer', target: { name: 'Anna' } } };

let calls; let pages;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
function mockApi({ items = [agentEdit(1, iso(14, 31)), sess, named, restore, share], nextCursor = null, failFirst = false } = {}) {
  calls = []; pages = 0;
  global.fetch = jest.fn(async (url) => {
    calls.push(String(url));
    if (/\/activity\?/.test(url)) {
      pages += 1;
      if (failFirst && pages === 1) return res(500, { error: 'boom' });
      if (/cursor=next1/.test(url)) return res(200, { items: [{ ...named, id: 'v:1', version: { number: 1, name: 'Older version' }, at: iso(8, 30) }], nextCursor: null });
      return res(200, { items, nextCursor });
    }
    if (/\/diff\?/.test(url)) return res(200, { from: { number: 11 }, to: { number: 12 }, changes: [{ id: 'n1', kind: 'element', change: 'added', label: 'New box' }], summary: { added: 1, removed: 0, changed: 0 } });
    return res(404, {});
  });
}
beforeEach(() => { jest.useFakeTimers({ now: NOW }); jest.spyOn(console, 'error').mockImplementation(() => {}); setCompare(null); });
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });
const flush = async () => { await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); }); };
const renderTab = async (props = {}) => {
  const r = render(<ActivityTab diagramId="d1" headRevision={999} agents={[]} {...props} />);
  await flush();
  return r;
};

test('lists the feed grouped by day with a row per kind', async () => {
  mockApi();
  await renderTab();
  expect(calls[0]).toMatch(/\/api\/diagrams\/d1\/activity\?limit=30/);
  expect(screen.getByText('Today')).toBeTruthy();
  expect(screen.getByText(/Claude for Peter/)).toBeTruthy();
  expect(screen.getByText(/\+12 ~3/)).toBeTruthy();
  expect(screen.getByText(/map_structure/)).toBeTruthy();
  expect(screen.getByText(/Anna Berg/)).toBeTruthy();
  expect(screen.getByText(/37 saves/)).toBeTruthy();
  expect(screen.getByText(/Workshop end/)).toBeTruthy();
  expect(screen.getByText(/restored version 12/i)).toBeTruthy();
  expect(screen.getByText(/shared with Anna as viewer/)).toBeTruthy();
});

test('shows an agent edit run as one row: "Claude for Peter . 3 changes . tools"', async () => {
  mockApi({ items: [agentEdit(3, iso(14, 31)), agentEdit(2, iso(14, 28), { agent: { label: 'Claude', tool: 'diagram_apply_ops' } }), agentEdit(1, iso(14, 25))] });
  await renderTab();
  const row = screen.getByTestId('activity-agent-group');
  expect(row.textContent).toMatch(/3 changes/);
  expect(row.textContent).toMatch(/map_structure, diagram_apply_ops/); // oldest first
  expect(screen.getAllByRole('button', { name: /Review/ })).toHaveLength(1);
});

test('Review opens the right diff (previous version to the edit) and shows it inline', async () => {
  mockApi({ items: [agentEdit(1, iso(14, 31))] });
  await renderTab({ headRevision: 500 });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Review/ })); });
  await flush();
  expect(calls.some((u) => /\/versions\/10\/diff\?against=11$/.test(u))).toBe(true);
  expect(screen.getByRole('region', { name: 'Changes' })).toBeTruthy();
  expect(screen.getByText('New box')).toBeTruthy();
  expect(getCompare()).toBeNull(); // not the newest state: no canvas overlay
});

test('Review of the newest state compares against the live board and offers the canvas overlay', async () => {
  mockApi({ items: [agentEdit(1, iso(14, 31))] });
  const flushSave = jest.fn(async () => true);
  await renderTab({ headRevision: 21, flushSave });
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Review/ })); });
  await flush();
  expect(flushSave).toHaveBeenCalled();
  expect(calls.some((u) => /\/versions\/10\/diff\?against=head$/.test(u))).toBe(true);
  expect(getCompare()).toMatchObject({ to: 'head' });
});

test('a session offers Compare (approximate when the bounds are checkpoints)', async () => {
  mockApi({ items: [sess] });
  await renderTab();
  const btn = screen.getByRole('button', { name: /Compare/ });
  expect(btn.textContent).toMatch(/approximate/i);
  await act(async () => { fireEvent.click(btn); });
  await flush();
  expect(calls.some((u) => /\/versions\/3\/diff\?against=4$/.test(u))).toBe(true);
});

test('a session without a baseline version has no Compare button', async () => {
  mockApi({ items: [{ ...sess, compare: null }] });
  await renderTab();
  expect(screen.queryByRole('button', { name: /Compare/ })).toBeNull();
});

test('a failing compare shows an error, not a crash', async () => {
  mockApi({ items: [agentEdit(1, iso(14, 31))] });
  await renderTab({ headRevision: 500 });
  global.fetch.mockImplementationOnce(async () => res(500, { error: 'nope' }));
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Review/ })); });
  await flush();
  expect(screen.getByRole('alert').textContent).toMatch(/nope|Could not/);
});

test('restore and named version rows open that version in History', async () => {
  mockApi({ items: [named, restore] });
  const onOpenVersion = jest.fn();
  await renderTab({ onOpenVersion });
  fireEvent.click(screen.getByRole('button', { name: /Open version 7/ }));
  fireEvent.click(screen.getByRole('button', { name: /Open version 14/ }));
  expect(onOpenVersion.mock.calls.map((c) => c[0])).toEqual([7, 14]);
});

test('the live row shows the agent from the probe (to its own user: "(you)")', async () => {
  mockApi({ items: [] });
  await renderTab({ agents: [{ key: 'k', label: 'Claude', state: 'reading', tool: 'diagram_get', mine: true, ageMs: 1000, lastAt: 1 }] });
  const live = screen.getByTestId('activity-live');
  expect(live.textContent).toMatch(/Claude is reading/);
  expect(live.textContent).toMatch(/\(you\)/);
});

test('a live row for someone else\'s agent never says "(you)"', async () => {
  mockApi({ items: [] });
  await renderTab({ agents: [{ key: 'k', label: 'Agent for Anna', state: 'editing', tool: 'map_structure', mine: false, ageMs: 1000, lastAt: 1 }] });
  expect(screen.getByTestId('activity-live').textContent).toMatch(/Agent for Anna is editing/);
  expect(screen.getByTestId('activity-live').textContent).not.toMatch(/\(you\)/);
});

test('empty feed says so', async () => {
  mockApi({ items: [] });
  await renderTab();
  expect(screen.getByText(/No activity yet/)).toBeTruthy();
});

test('Load more fetches the next page with the cursor and appends', async () => {
  mockApi({ items: [sess], nextCursor: 'next1' });
  await renderTab();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Load more/ })); });
  await flush();
  expect(calls.some((u) => /cursor=next1/.test(u))).toBe(true);
  expect(screen.getByText(/Older version/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Load more/ })).toBeNull();
});

test('a failed load shows an error with Try again', async () => {
  mockApi({ failFirst: true });
  await renderTab();
  expect(screen.getByRole('alert').textContent).toMatch(/boom|Could not/);
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Try again/ })); });
  await flush();
  expect(screen.getByText(/Workshop end/)).toBeTruthy();
});

test('refetches the first page when the board revision moves', async () => {
  mockApi({ items: [sess] });
  const { rerender } = await renderTab({ headRevision: 5 });
  expect(pages).toBe(1);
  rerender(<ActivityTab diagramId="d1" headRevision={6} agents={[]} />);
  await flush();
  expect(pages).toBe(2);
  rerender(<ActivityTab diagramId="d1" headRevision={6} agents={[]} />);
  await flush();
  expect(pages).toBe(2);
});

test('hostile names are rendered as text', async () => {
  mockApi({ items: [{ ...named, actor: { type: 'user', id: 'x', name: '<img src=x onerror=alert(1)>' }, version: { number: 7, name: '<script>x</script>' } }] });
  const { container } = await renderTab();
  expect(container.querySelector('img')).toBeNull();
  expect(container.querySelector('script')).toBeNull();
  expect(within(container).getByText(/<script>x<\/script>/)).toBeTruthy();
});

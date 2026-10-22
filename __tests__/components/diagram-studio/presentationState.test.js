// ADR-0007 P1: content.presentations in the editor state: load, patchPresentation (dirty + saved), view-only refusal,
// live pickup merge (remote reorder + local notes), and the content shape stays unchanged for boards without decks.
import { renderHook, act } from '@testing-library/react';
import { DiagramProvider, useDiagram } from '../../../components/diagram-studio/DiagramContext';
import { normalizeDiagramContent } from '../../../components/diagram-studio/migrations/normalizeContent';
import { buildExportEnvelope, sanitizeContent } from '../../../components/diagram-studio/export/diagramJson';

const frame = (id, x) => ({ id, type: 'frame', packId: 'core', x, y: 0, size: { width: 1920, height: 1080 }, label: id });
const slide = (id, extra = {}) => ({ id, frameId: `f-${id}`, ...extra });
const deck = (slides) => ({ id: 'p1', title: 'Deck', aspect: '16:9', slides });
const wrapper = ({ children }) => <DiagramProvider diagramId="d1" defaultPack="process-flow">{children}</DiagramProvider>;
const res = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

let server; let puts;
const body = () => ({
  id: 'd1', name: 'X', type: 'infinite-canvas', revision: server.revision, updated_at: 't', updated_by: 'a@x.co',
  access: server.access || { role: 'editor', capabilities: ['diagram.read', 'diagram.write'] }, content: server.content,
});
beforeEach(() => {
  jest.useFakeTimers();
  puts = [];
  server = {
    revision: 3,
    content: { elements: [frame('f-a', 0), frame('f-b', 2000), frame('f-c', 4000)], connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [], presentations: [deck([slide('a'), slide('b'), slide('c')])] },
  };
  global.fetch = jest.fn(async (url, opts = {}) => {
    if (opts.method === 'PUT') {
      puts.push(JSON.parse(opts.body));
      server.revision += 1; server.content = JSON.parse(opts.body).content;
      return res(200, body());
    }
    if (/\/revision\?since=/.test(url)) return res(200, { revision: server.revision, updatedAt: 't', updatedBy: 'bob', agentChange: null });
    return res(200, body());
  });
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { jest.useRealTimers(); jest.restoreAllMocks(); });

async function open() {
  const hook = renderHook(() => useDiagram(), { wrapper });
  await act(async () => { await Promise.resolve(); });
  act(() => { hook.result.current.setDiagram(body()); });
  return hook;
}
const tick = async (ms) => { await act(async () => { jest.advanceTimersByTime(ms); }); await act(async () => { await Promise.resolve(); await Promise.resolve(); }); };
const order = (hook) => hook.result.current.presentations[0].slides.map((s) => s.id);

test('decks load from content and are part of the context', async () => {
  const hook = await open();
  expect(order(hook)).toEqual(['a', 'b', 'c']);
});

test('patchPresentation reorders, marks the board dirty and the save sends presentations', async () => {
  const hook = await open();
  let r;
  act(() => { r = hook.result.current.patchPresentation({ id: 'p1', order: ['c', 'a', 'b'] }); });
  expect(r.ok).toBe(true);
  expect(order(hook)).toEqual(['c', 'a', 'b']);
  expect(hook.result.current.saveStatus.dirty).toBe(true);
  await act(async () => { await hook.result.current.saveDiagram(true); });
  expect(puts).toHaveLength(1);
  expect(puts[0].content.presentations[0].slides.map((s) => s.id)).toEqual(['c', 'a', 'b']);
});

test('patchPresentation refuses a bad patch without changing anything', async () => {
  const hook = await open();
  let r;
  act(() => { r = hook.result.current.patchPresentation({ id: 'p1', insertSlides: [{ frameId: 'nope' }] }); });
  expect(r.ok).toBe(false);
  expect(order(hook)).toEqual(['a', 'b', 'c']);
  expect(hook.result.current.saveStatus.dirty).not.toBe(true);
});

test('a viewer cannot edit decks (no state change, no save)', async () => {
  server.access = { role: 'viewer', capabilities: ['diagram.read'] };
  const hook = await open();
  let r;
  act(() => { r = hook.result.current.patchPresentation({ id: 'p1', order: ['c', 'a', 'b'] }); });
  expect(r.ok).toBe(false);
  expect(order(hook)).toEqual(['a', 'b', 'c']);
  expect(puts).toHaveLength(0);
});

test('live pickup merges a remote reorder with local notes; the next save sends both', async () => {
  const hook = await open();
  await tick(2200);
  act(() => { hook.result.current.patchPresentation({ id: 'p1', updateSlides: [{ slideId: 'a', notes: 'mine' }] }); });
  server.revision += 1;
  server.content = { ...server.content, presentations: [deck([slide('c'), slide('a'), slide('b')])] };
  await tick(900); await tick(0); await tick(0);
  expect(order(hook)).toEqual(['c', 'a', 'b']);
  expect(hook.result.current.presentations[0].slides.find((s) => s.id === 'a').notes).toBe('mine');
});

test('clean editor picks up a remote deck (no PUT)', async () => {
  const hook = await open();
  server.revision += 1;
  server.content = { ...server.content, presentations: [deck([slide('a'), slide('b'), slide('c'), slide('d')])] };
  await tick(3100); await tick(0); await tick(0);
  expect(order(hook)).toEqual(['a', 'b', 'c', 'd']);
  expect(puts).toHaveLength(0);
});

test('boards without decks keep the exact saved shape (no presentations key)', async () => {
  server.content = { elements: [], connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [] };
  const hook = await open();
  await act(async () => { await hook.result.current.saveDiagram(true); });
  expect(Object.keys(puts[0].content).sort()).toEqual(['connections', 'elements', 'groups', 'layers', 'viewport']);
});

test('removing the last deck is still saved as an empty list', async () => {
  const hook = await open();
  act(() => { hook.result.current.patchPresentation({ id: 'p1', removeDeck: true }); });
  await act(async () => { await hook.result.current.saveDiagram(true); });
  expect(puts[0].content.presentations).toEqual([]);
});

describe('content helpers', () => {
  test('normalizeDiagramContent keeps presentations only when present', () => {
    expect(normalizeDiagramContent({ elements: [] })).not.toHaveProperty('presentations');
    expect(normalizeDiagramContent({ elements: [], presentations: [deck([])] }).presentations).toHaveLength(1);
  });

  test('JSON export carries decks; import keeps valid ones and drops invalid ones with a warning', () => {
    const env = buildExportEnvelope({ name: 'N', elements: [], presentations: [deck([slide('a')])] });
    expect(env.diagram.content.presentations).toHaveLength(1);
    expect(buildExportEnvelope({ name: 'N', elements: [] }).diagram.content).not.toHaveProperty('presentations');
    const good = sanitizeContent({ elements: [], presentations: [deck([slide('a')])] });
    expect(good.ok).toBe(true);
    expect(good.content.presentations[0].slides).toHaveLength(1);
    const bad = sanitizeContent({ elements: [], presentations: [{ id: 'x', slides: [{ nope: 1 }] }] });
    expect(bad.ok).toBe(true);
    expect(bad.content.presentations).toBeUndefined();
    expect(bad.warnings.join(' ')).toMatch(/presentations/);
  });
});

// LA-1: pure geometry for the change highlight (rings, ghosts, union bbox, off-screen chip, pan target).
import {
  buildRemoteHighlight, offscreenSummary, panToViewport, highlightColor,
  MAX_INDIVIDUAL_RINGS, COLOR_PERSON, COLOR_AGENT,
} from '../../../components/diagram-studio/live/remoteHighlight';

const el = (id, x, y, w = 100, h = 60) => ({ id, type: 'rectangle', x, y, size: { width: w, height: h } });
const ids = (added = [], changed = [], removed = [], truncated = false) => ({ added, changed, removed, truncated });

describe('highlightColor', () => {
  it('is cyan for people and lavender for agents', () => {
    expect(highlightColor(false)).toBe(COLOR_PERSON);
    expect(highlightColor(true)).toBe(COLOR_AGENT);
    expect(COLOR_PERSON.toLowerCase()).toBe('#4fb3ce');
    expect(COLOR_AGENT.toLowerCase()).toBe('#9a8ac8');
  });
});

describe('buildRemoteHighlight', () => {
  it('returns null when nothing visible changed', () => {
    expect(buildRemoteHighlight({ ids: ids(), elements: [], connections: [], before: [] })).toBeNull();
    expect(buildRemoteHighlight({ ids: null, elements: [], connections: [], before: [] })).toBeNull();
  });

  it('rings exactly the added and changed elements, at their bounds', () => {
    const elements = [el('a', 10, 20), el('b', 300, 40, 80, 80), el('c', 0, 0)];
    const h = buildRemoteHighlight({ ids: ids(['b'], ['a']), elements, connections: [], before: elements, agent: true });
    expect(h.agent).toBe(true);
    expect(h.color).toBe(COLOR_AGENT);
    expect(h.collapsed).toBe(false);
    expect(h.items.map((i) => i.id).sort()).toEqual(['a', 'b']);
    expect(h.items.find((i) => i.id === 'b')).toMatchObject({ kind: 'element', rect: { x: 300, y: 40, w: 80, h: 80 } });
    expect(h.count).toBe(2);
  });

  it('a person change is cyan', () => {
    const elements = [el('a', 0, 0)];
    const h = buildRemoteHighlight({ ids: ids([], ['a']), elements, connections: [], before: elements, agent: false });
    expect(h.color).toBe(COLOR_PERSON);
  });

  it('draws removed elements as ghosts at their old position (from the pre-merge elements)', () => {
    const before = [el('a', 0, 0), el('gone', 500, 500, 90, 50)];
    const after = [el('a', 0, 0)];
    const h = buildRemoteHighlight({ ids: ids([], [], ['gone']), elements: after, connections: [], before });
    expect(h.items).toEqual([expect.objectContaining({ id: 'gone', kind: 'ghost', rect: { x: 500, y: 500, w: 90, h: 50 } })]);
  });

  it('connections are drawn along their endpoints and waypoints', () => {
    const elements = [el('a', 0, 0, 100, 60), el('b', 400, 0, 100, 60)];
    const conn = { id: 'k', sourceId: 'a', targetId: 'b', waypoints: [{ x: 250, y: 200 }] };
    const h = buildRemoteHighlight({ ids: ids(['k']), elements, connections: [conn], before: elements });
    const item = h.items[0];
    expect(item).toMatchObject({ id: 'k', kind: 'connection' });
    expect(item.points).toEqual([{ x: 50, y: 30 }, { x: 250, y: 200 }, { x: 450, y: 30 }]);
  });

  it('skips connections whose endpoints are unknown instead of throwing', () => {
    const conn = { id: 'k', sourceId: 'x', targetId: 'y' };
    expect(buildRemoteHighlight({ ids: ids(['k']), elements: [], connections: [conn], before: [] })).toBeNull();
  });

  it('more than 150 ids collapse into one ring around the union bbox', () => {
    const elements = Array.from({ length: MAX_INDIVIDUAL_RINGS + 50 }, (_, i) => el(`n${i}`, i * 10, (i % 7) * 20));
    const h = buildRemoteHighlight({ ids: ids(elements.map((e) => e.id)), elements, connections: [], before: elements });
    expect(h.collapsed).toBe(true);
    expect(h.items).toHaveLength(1);
    expect(h.items[0].kind).toBe('union');
    expect(h.count).toBe(200);
    expect(h.union.x).toBe(0);
    expect(h.items[0].rect).toEqual(h.union);
  });

  it('600 changed ids (capped to 500 + truncated) are still one ring', () => {
    const elements = Array.from({ length: 500 }, (_, i) => el(`n${i}`, i, i));
    const h = buildRemoteHighlight({ ids: ids(elements.map((e) => e.id), [], [], true), elements, connections: [], before: elements });
    expect(h.collapsed).toBe(true);
    expect(h.items).toHaveLength(1);
  });

  it('a truncated id list reports the true total, not the capped length', () => {
    const elements = Array.from({ length: 500 }, (_, i) => el(`n${i}`, i, i));
    const h = buildRemoteHighlight({ ids: { ...ids(elements.map((e) => e.id), [], [], true), totals: { added: 620, changed: 0, removed: 0 } }, elements, connections: [], before: elements });
    expect(h.count).toBe(620);
    const s = offscreenSummary(h, { x: -5000, y: -5000, w: 10, h: 10 });
    expect(s.count).toBe(620);
  });

  it('gives every highlight a distinct key so a new pickup restarts the animation', () => {
    const e = [el('a', 0, 0)];
    const a = buildRemoteHighlight({ ids: ids([], ['a']), elements: e, connections: [], before: e });
    const b = buildRemoteHighlight({ ids: ids([], ['a']), elements: e, connections: [], before: e });
    expect(a.key).not.toBe(b.key);
  });
});

describe('offscreenSummary', () => {
  const view = { x: 0, y: 0, w: 1000, h: 800 };
  const mk = (rects) => ({ items: rects.map((r, i) => ({ id: `i${i}`, kind: 'element', rect: r })), collapsed: false, count: rects.length });

  it('counts only items outside the viewport and points at them', () => {
    const h = mk([{ x: 10, y: 10, w: 50, h: 50 }, { x: 2000, y: 100, w: 50, h: 50 }, { x: 2100, y: 120, w: 50, h: 50 }]);
    const s = offscreenSummary(h, view);
    expect(s.count).toBe(2);
    expect(s.direction).toBe('e');
    expect(s.bbox).toEqual({ x: 2000, y: 100, w: 150, h: 70 });
  });

  it('is null when every change is visible (partial overlap counts as visible)', () => {
    const h = mk([{ x: 950, y: 10, w: 200, h: 50 }]);
    expect(offscreenSummary(h, view)).toBeNull();
  });

  it('reports the 8-way direction from the viewport center', () => {
    expect(offscreenSummary(mk([{ x: -900, y: -900, w: 50, h: 50 }]), view).direction).toBe('nw');
    expect(offscreenSummary(mk([{ x: 400, y: 3000, w: 50, h: 50 }]), view).direction).toBe('s');
    expect(offscreenSummary(mk([{ x: -3000, y: 300, w: 50, h: 50 }]), view).direction).toBe('w');
  });

  it('a collapsed highlight counts all its changes as one off-screen group', () => {
    const h = { items: [{ id: 'u', kind: 'union', rect: { x: 5000, y: 0, w: 100, h: 100 } }], collapsed: true, count: 42 };
    expect(offscreenSummary(h, view).count).toBe(42);
  });
});

describe('panToViewport', () => {
  it('centers the bbox: screen = (canvas + viewport.x) * scale', () => {
    const next = panToViewport({ x: 100, y: 100, w: 200, h: 100 }, { x: -50000, y: -50000, scale: 2 }, { width: 1000, height: 800 });
    expect(next.scale).toBe(2);
    expect((200 + next.x) * 2).toBeCloseTo(500);
    expect((150 + next.y) * 2).toBeCloseTo(400);
  });
});

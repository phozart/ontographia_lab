/**
 * @jest-environment node
 */
// LA-2: the in-memory per-board agent activity register (ADR-0006 5.1): states, TTL, privacy, LRU, labels.
import { createAgentActivity, ACTIVE_MS, TTL_MS, MAX_KEYS, sanitizeLabel } from '../../lib/live/agentActivity';

const ME = 'user-me';
const OTHER = 'user-other';
let t; let reg;
const now = () => t;
const note = (over = {}) => reg.note({ diagramId: 'd1', tokenId: 'tok1', userId: ME, kind: 'read', tool: 'diagram_get', clientLabel: 'Claude', userName: 'Peter', ...over });

beforeEach(() => { t = 1_000_000; reg = createAgentActivity({ now }); });

describe('states', () => {
  it('a fresh read is "reading" for the acting user, a fresh write is "editing"', () => {
    note({ kind: 'read', tool: 'diagram_get' });
    expect(reg.agentsFor('d1', ME)).toEqual([expect.objectContaining({ state: 'reading', tool: 'diagram_get', mine: true, lastAt: t })]);
    t += 1000;
    note({ kind: 'write', tool: 'map_structure' });
    expect(reg.agentsFor('d1', ME)[0]).toMatchObject({ state: 'editing', tool: 'map_structure' });
  });

  it('reports the age relative to the server clock', () => {
    note({ kind: 'write' });
    t += 7000;
    expect(reg.agentsFor('d1', ME)[0].ageMs).toBe(7000);
  });

  it('turns "recent" after 20 s and disappears after 120 s', () => {
    note({ kind: 'write', tool: 'diagram_apply_ops' });
    t += ACTIVE_MS - 1;
    expect(reg.agentsFor('d1', ME)[0].state).toBe('editing');
    t += 2;
    expect(reg.agentsFor('d1', ME)[0].state).toBe('recent');
    t += TTL_MS - ACTIVE_MS;
    expect(reg.agentsFor('d1', ME)).toEqual([]);
  });

  it('the most recent visible event wins', () => {
    note({ kind: 'write', tool: 'diagram_apply_ops' });
    t += 5000;
    note({ kind: 'read', tool: 'board_read_region' });
    expect(reg.agentsFor('d1', ME)[0]).toMatchObject({ state: 'reading', tool: 'board_read_region' });
  });
});

describe('privacy (Q-LA1): writes visible to everyone with access, reads only to the user the agent acts for', () => {
  it("another user sees nothing for an agent's read", () => {
    note({ kind: 'read', tool: 'board_read_region', focus: { x: 1, y: 2, w: 3, h: 4 } });
    expect(reg.agentsFor('d1', OTHER)).toEqual([]);
  });

  it('another user sees "editing" for a write, labeled "Agent for <name>", without the user id or focus', () => {
    note({ kind: 'write', tool: 'map_structure' });
    const [a] = reg.agentsFor('d1', OTHER);
    expect(a).toMatchObject({ state: 'editing', mine: false, tool: 'map_structure', label: 'Agent for Peter', forUser: { name: 'Peter' } });
    expect(a.forUser.id).toBeUndefined();
    expect(a.focus).toBeUndefined();
  });

  it("after a write the other user sees the write, not the later read (the read stays private)", () => {
    note({ kind: 'write', tool: 'map_structure' });
    t += 2000;
    note({ kind: 'read', tool: 'diagram_get', focus: { x: 0, y: 0, w: 5, h: 5 } });
    const [a] = reg.agentsFor('d1', OTHER);
    expect(a.state).toBe('editing');
    expect(a.tool).toBe('map_structure');
    expect(a.lastAt).toBe(1_000_000);
    expect(a.focus).toBeUndefined();
  });

  it('the acting user sees their own label (client label) and the read focus', () => {
    note({ kind: 'read', tool: 'board_read_region', focus: { x: 10, y: 20, w: 300, h: 200 } });
    const [a] = reg.agentsFor('d1', ME);
    expect(a.label).toBe('Claude');
    expect(a.forUser).toEqual({ id: ME, name: 'Peter' });
    expect(a.focus).toEqual({ x: 10, y: 20, w: 300, h: 200 });
  });

  it('never leaks the token id or the key of the credential', () => {
    note({ kind: 'write', tool: 'x' });
    const [a] = reg.agentsFor('d1', OTHER);
    expect(JSON.stringify(a)).not.toMatch(/tok1/);
    expect(a.key).toMatch(/^[0-9a-f]{10}$/);
  });
});

describe('separation, labels and limits', () => {
  it('keeps boards and tokens apart', () => {
    note({ diagramId: 'd1', tokenId: 'a', kind: 'write' });
    note({ diagramId: 'd2', tokenId: 'a', kind: 'write' });
    note({ diagramId: 'd1', tokenId: 'b', kind: 'write', userId: OTHER, userName: 'Anna' });
    expect(reg.agentsFor('d1', ME)).toHaveLength(2);
    expect(reg.agentsFor('d2', ME)).toHaveLength(1);
    expect(reg.agentsFor('d3', ME)).toEqual([]);
  });

  it('personal tokens are labeled "Personal token"; labels are text-only and at most 40 chars', () => {
    note({ clientLabel: undefined, kind: 'write' });
    expect(reg.agentsFor('d1', ME)[0].label).toBe('Personal token');
    expect(sanitizeLabel('  <b>Evil</b>\u0000‮ name '.padEnd(200, 'x')).length).toBeLessThanOrEqual(40);
    expect(sanitizeLabel('<script>alert(1)</script>Claude')).not.toMatch(/[<>]/);
    expect(sanitizeLabel('')).toBe('');
  });

  it('an unnamed acting user shows plain "Agent" to others', () => {
    note({ kind: 'write', userName: undefined });
    expect(reg.agentsFor('d1', OTHER)[0].label).toBe('Agent');
  });

  it('setName fills in a name resolved later', () => {
    note({ kind: 'write', userName: undefined });
    expect(reg.needsName('d1', 'tok1')).toBe(true);
    reg.setName('d1', 'tok1', 'Peter');
    expect(reg.needsName('d1', 'tok1')).toBe(false);
    expect(reg.agentsFor('d1', OTHER)[0].label).toBe('Agent for Peter');
  });

  it('a name lookup in flight (or failed) is not retried on every call, only after a minute', () => {
    note({ kind: 'write', userName: undefined });
    expect(reg.needsName('d1', 'tok1')).toBe(true);
    reg.markNameLookup('d1', 'tok1');
    expect(reg.needsName('d1', 'tok1')).toBe(false);
    t += 61_000;
    note({ kind: 'write', userName: undefined });
    expect(reg.needsName('d1', 'tok1')).toBe(true);
  });

  it('sweeps expired entries of boards nobody polls once the register grows past the threshold', () => {
    const r2 = createAgentActivity({ now, sweepThreshold: 5 });
    for (let i = 0; i < 6; i += 1) r2.note({ diagramId: `old${i}`, tokenId: 't', userId: ME, kind: 'write', tool: 'x' });
    t += TTL_MS + 1;
    r2.note({ diagramId: 'fresh', tokenId: 't', userId: ME, kind: 'write', tool: 'x' });
    expect(r2.size()).toBe(1);
  });

  it('caps the register at MAX_KEYS, evicting the least recently used', () => {
    const small = createAgentActivity({ now, maxKeys: 3 });
    for (const id of ['a', 'b', 'c']) small.note({ diagramId: 'd1', tokenId: id, userId: ME, kind: 'write', tool: 'x' });
    small.note({ diagramId: 'd1', tokenId: 'a', userId: ME, kind: 'write', tool: 'x' }); // touch a
    small.note({ diagramId: 'd1', tokenId: 'd', userId: ME, kind: 'write', tool: 'x' });
    expect(small.size()).toBe(3);
    expect(MAX_KEYS).toBe(10000);
    const keys = new Set(small.agentsFor('d1', ME).map((x) => x.key));
    expect(keys.size).toBe(3); // b was evicted
  });

  it('sweeps expired entries on access', () => {
    note({ kind: 'write' });
    t += TTL_MS + 1;
    reg.agentsFor('d1', ME);
    expect(reg.size()).toBe(0);
  });

  it('maxAt is the newest visible event time for the viewer (for the ETag)', () => {
    note({ kind: 'write' });
    t += 3000;
    note({ kind: 'read' });
    expect(reg.maxAt('d1', ME)).toBe(t);
    expect(reg.maxAt('d1', OTHER)).toBe(1_000_000);
    expect(reg.maxAt('nope', ME)).toBe(0);
  });

  it('is a process-wide singleton that survives module reloads (dev HMR)', () => {
    let a; let b;
    jest.isolateModules(() => { a = require('../../lib/live/agentActivity').agentActivity; });
    jest.isolateModules(() => { b = require('../../lib/live/agentActivity').agentActivity; });
    expect(a).toBe(b);
  });
});

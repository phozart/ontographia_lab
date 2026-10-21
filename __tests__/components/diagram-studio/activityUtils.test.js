// LA-3: grouping and wording for the Activity tab (ADR-0006 5.3): by day, then consecutive items by the same actor;
// consecutive agent edits by the same agent within 10 minutes collapse into one row.
import {
  groupActivity, summarizeCounts, dayLabel, sessionTime, compareTarget, describeShare,
} from '../../../components/diagram-studio/activity/activityUtils';

const NOW = new Date('2026-10-21T15:00:00').getTime();
const at = (h, m = 0, day = 21) => new Date(`2026-10-${String(day).padStart(2, '0')}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`).toISOString();
const agentEdit = (n, when, over = {}) => ({
  id: `a:${n}`, kind: 'agent_edit', at: when, actor: { type: 'agent', name: 'Claude' }, onBehalfOf: { id: 'u1', name: 'Peter' },
  agent: { label: 'Claude', tool: 'map_structure' }, counts: { addedElements: 12, updated: 3 }, revision: { to: 10 + n }, version: { number: n }, compare: { from: n - 1, to: n, approximate: false }, ...over,
});
const session = (n, start, end, over = {}) => ({
  id: `s:${n}`, kind: 'edit_session', at: start, endAt: end, actor: { type: 'user', id: 'u2', name: 'Anna Berg' }, saves: 37, revision: { from: 1, to: 37 },
  compare: { from: 1, to: 2, approximate: false }, ...over,
});

describe('summarizeCounts', () => {
  it('+added ~changed -removed', () => {
    expect(summarizeCounts({ addedElements: 12, addedConnections: 2, updated: 3, removedElements: 1 })).toBe('+14 ~3 −1');
    expect(summarizeCounts({})).toBe('');
    expect(summarizeCounts(null)).toBe('');
    expect(summarizeCounts({ moved: 5 })).toBe('~5');
  });
});

describe('dayLabel', () => {
  it('Today, Yesterday, then a date', () => {
    expect(dayLabel(at(9), NOW)).toBe('Today');
    expect(dayLabel(at(23, 0, 20), NOW)).toBe('Yesterday');
    expect(dayLabel(at(9, 0, 15), NOW)).toMatch(/Oct/);
  });
});

describe('sessionTime', () => {
  it('shows a range for a session and a single time for one save', () => {
    expect(sessionTime(at(14, 2), at(14, 20))).toMatch(/\d.*–.*\d/);
    expect(sessionTime(at(14, 2), at(14, 2))).not.toMatch(/–/);
    expect(sessionTime(at(14, 2), null)).not.toMatch(/–/);
  });
});

describe('groupActivity', () => {
  it('groups by day, newest first, labelled', () => {
    const groups = groupActivity([session(2, at(9), at(9, 30)), session(1, at(9, 0, 20), at(9, 10, 20))], NOW);
    expect(groups.map((g) => g.day)).toEqual(['Today', 'Yesterday']);
    expect(groups[0].rows).toHaveLength(1);
  });

  it('collapses consecutive agent edits by the same agent within 10 minutes into one row', () => {
    const items = [agentEdit(4, at(14, 31)), agentEdit(3, at(14, 28)), agentEdit(2, at(14, 25), { agent: { label: 'Claude', tool: 'diagram_apply_ops' } }), agentEdit(1, at(13, 0))];
    const [{ rows }] = groupActivity(items, NOW);
    expect(rows).toHaveLength(2);
    expect(rows[0].type).toBe('agent_group');
    expect(rows[0].items.map((i) => i.id)).toEqual(['a:4', 'a:3', 'a:2']);
    expect(rows[0].tools).toEqual(['diagram_apply_ops', 'map_structure']); // oldest first
    expect(rows[0].count).toBe(3);
    expect(rows[0].summary).toBe('+36 ~9');
    expect(rows[1].type).toBe('item'); // 85 minutes earlier: its own row
  });

  it('does not collapse agent edits by different agents or on behalf of different people', () => {
    const rows = groupActivity([agentEdit(2, at(14, 31)), agentEdit(1, at(14, 30), { onBehalfOf: { id: 'u9', name: 'Anna' } })], NOW)[0].rows;
    expect(rows).toHaveLength(2);
    const rows2 = groupActivity([agentEdit(2, at(14, 31)), agentEdit(1, at(14, 30), { agent: { label: 'Personal token', tool: 'x' } })], NOW)[0].rows;
    expect(rows2).toHaveLength(2);
  });

  it('a person is not interleaved: a human item between two agent edits breaks the run', () => {
    const rows = groupActivity([agentEdit(2, at(14, 31)), session(1, at(14, 29), at(14, 30)), agentEdit(1, at(14, 28))], NOW)[0].rows;
    expect(rows.map((r) => r.type)).toEqual(['item', 'item', 'item']);
  });

  it('marks consecutive rows by the same actor so the list can show the name once', () => {
    const rows = groupActivity([session(2, at(14, 30), at(14, 40)), session(1, at(14, 0), at(14, 10))], NOW)[0].rows;
    expect(rows[0].sameActorAsPrevious).toBe(false);
    expect(rows[1].sameActorAsPrevious).toBe(true);
  });

  it('survives an empty list and junk', () => {
    expect(groupActivity([], NOW)).toEqual([]);
    expect(groupActivity(null, NOW)).toEqual([]);
    expect(groupActivity([{ id: 'x' }, null], NOW)).toBeTruthy();
  });
});

describe('compareTarget', () => {
  it('compares to the head (with the overlay) when the item is the newest state', () => {
    expect(compareTarget({ compare: { from: 4, to: 5, approximate: false }, revision: { to: 12 } }, 12)).toEqual({ from: 4, to: 'head', approximate: false });
  });
  it('keeps the version bound when the board moved on', () => {
    expect(compareTarget({ compare: { from: 4, to: 5, approximate: false }, revision: { to: 12 } }, 15)).toEqual({ from: 4, to: 5, approximate: false });
  });
  it('a session whose newest bound is "now" stays "head"', () => {
    expect(compareTarget({ compare: { from: 4, to: 'head', approximate: true }, revision: { from: 1, to: 3 } }, 9)).toEqual({ from: 4, to: 'head', approximate: true });
  });
  it('no compare data, no target', () => {
    expect(compareTarget({ compare: null }, 3)).toBeNull();
    expect(compareTarget({}, 3)).toBeNull();
  });
});

describe('describeShare', () => {
  it('words the owner-only sharing events', () => {
    expect(describeShare({ action: 'share.grant', role: 'viewer', target: { name: 'Anna' } })).toBe('shared with Anna as viewer');
    expect(describeShare({ action: 'share.change', role: 'editor', target: { name: 'Anna' } })).toBe('changed Anna to editor');
    expect(describeShare({ action: 'share.revoke', role: 'viewer', target: { name: 'Anna' } })).toBe('removed Anna');
    expect(describeShare({ action: 'share.grant', role: null, target: null })).toBe('shared the board');
  });
});

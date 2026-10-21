import { describeRemoteUpdate, emptyRemoteLog, appendRemoteDelta, rebaseSnapshot, stampSnapshot, REMOTE_LOG_LIMIT, contentFromDiagram } from '../../../components/diagram-studio/live/livePickup';

const el = (id, extra = {}) => ({ id, type: 'rectangle', x: 0, y: 0, label: id, ...extra });
const snap = (elements) => ({ elements, connections: [], timestamp: 1 });

describe('describeRemoteUpdate', () => {
  const base = { who: 'bob', agent: false, summary: { added: 0, removed: 0, changed: 0 }, conflicts: [] };
  it('names a person or an agent and lists counts', () => {
    expect(describeRemoteUpdate({ ...base, summary: { added: 3, changed: 1, removed: 0 } })).toEqual({ title: 'Updated by bob', detail: '3 added, 1 changed', conflictText: null });
    expect(describeRemoteUpdate({ ...base, agent: true, summary: { added: 1, changed: 0, removed: 2 } }).title).toBe('Updated by an agent');
    expect(describeRemoteUpdate({ ...base, who: null }).title).toBe('Updated by someone else');
  });
  it('explains kept edits and dropped connections', () => {
    const out = describeRemoteUpdate({ ...base, conflicts: [{ resolution: 'local-wins' }, { resolution: 'kept-local-edit' }, { resolution: 'dropped-dangling' }] });
    expect(out.conflictText).toBe('Your edits were kept on 2 items where you both changed the same thing; 1 connection to deleted shapes was removed.');
  });
});

describe('lazy undo rebasing', () => {
  const content = (elements) => ({ elements, connections: [] });
  it('a snapshot recorded before a pickup is merged forward only when reached', () => {
    const base = content([el('a')]);
    const theirs = content([el('a'), el('n')]);
    const log0 = emptyRemoteLog();
    const old = stampSnapshot(snap([el('a', { x: 9 })]), log0);
    const log1 = appendRemoteDelta(log0, base, theirs);
    const out = rebaseSnapshot(log1, old);
    expect(out.elements.map((e) => e.id)).toEqual(['a', 'n']);
    expect(out.elements[0].x).toBe(9);
    expect(out.timestamp).toBe(1);
    expect(out.epoch).toBe(1);
    expect(rebaseSnapshot(log1, out)).toBe(out); // current snapshots are returned as is
  });
  it('chains several pickups in order', () => {
    let log = emptyRemoteLog();
    const old = stampSnapshot(snap([el('a')]), log);
    log = appendRemoteDelta(log, content([el('a')]), content([el('a'), el('n1')]));
    log = appendRemoteDelta(log, content([el('a'), el('n1')]), content([el('a')])); // the agent deletes n1 again
    log = appendRemoteDelta(log, content([el('a')]), content([el('a'), el('n2')]));
    expect(rebaseSnapshot(log, old).elements.map((e) => e.id)).toEqual(['a', 'n2']);
  });
  it('appending is O(1) in history size: 50 snapshots x 2000 elements cost nothing at pickup time', () => {
    const big = Array.from({ length: 2000 }, (_, i) => el(`e${i}`, { x: i }));
    const log = emptyRemoteLog();
    const snaps = Array.from({ length: 50 }, () => stampSnapshot(snap(big.map((e) => ({ ...e }))), log));
    const t0 = performance.now();
    const next = appendRemoteDelta(log, content(big), content([...big, el('n')]));
    expect(performance.now() - t0).toBeLessThan(50);
    expect(next.epoch).toBe(1);
    expect(snaps).toHaveLength(50);
  });
  it('a snapshot older than the retained log cannot be rebased (null: the caller drops history)', () => {
    let log = emptyRemoteLog();
    const old = stampSnapshot(snap([el('a')]), log);
    for (let i = 0; i < REMOTE_LOG_LIMIT + 1; i += 1) log = appendRemoteDelta(log, content([el('a')]), content([el('a')]));
    expect(log.deltas).toHaveLength(REMOTE_LOG_LIMIT);
    expect(rebaseSnapshot(log, old)).toBeNull();
    expect(rebaseSnapshot(log, stampSnapshot(snap([el('a')]), { epoch: 2 }))).not.toBeNull();
  });
});

describe('contentFromDiagram', () => {
  it('reads content, and lets top-level collections win like setDiagram', () => {
    expect(contentFromDiagram({ content: { elements: [el('a')], connections: [] } }).elements.map((e) => e.id)).toEqual(['a']);
    expect(contentFromDiagram({ elements: [el('z')], content: { elements: [el('a')] } }).elements.map((e) => e.id)).toEqual(['z']);
  });
});

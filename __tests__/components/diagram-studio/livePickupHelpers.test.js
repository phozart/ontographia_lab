import { describeRemoteUpdate, rebaseHistory, REBASE_WORK_LIMIT, contentFromDiagram } from '../../../components/diagram-studio/live/livePickup';

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

describe('rebaseHistory', () => {
  it('applies the remote delta to every undo and redo snapshot', () => {
    const base = { elements: [el('a')], connections: [] };
    const theirs = { elements: [el('a'), el('n')], connections: [] };
    const out = rebaseHistory([snap([el('a')])], [snap([el('a', { x: 9 })])], base, theirs);
    expect(out.past[0].elements.map((e) => e.id)).toEqual(['a', 'n']);
    expect(out.future[0].elements.map((e) => e.id)).toEqual(['a', 'n']);
    expect(out.future[0].elements[0].x).toBe(9);
    expect(out.past[0].timestamp).toBe(1);
  });
  it('gives up (null) beyond the work limit so the caller clears history instead', () => {
    const big = snap(Array.from({ length: REBASE_WORK_LIMIT + 1 }, (_, i) => ({ id: `e${i}` })));
    expect(rebaseHistory([big], [], { elements: [], connections: [] }, { elements: [], connections: [] })).toBeNull();
  });
});

describe('contentFromDiagram', () => {
  it('reads content, and lets top-level collections win like setDiagram', () => {
    expect(contentFromDiagram({ content: { elements: [el('a')], connections: [] } }).elements.map((e) => e.id)).toEqual(['a']);
    expect(contentFromDiagram({ elements: [el('z')], content: { elements: [el('a')] } }).elements.map((e) => e.id)).toEqual(['z']);
  });
});

// Slice 0: pure, idempotent normalizer for stored diagram content.
import { normalizeDiagramContent, DEFAULT_VIEWPORT, DEFAULT_LAYER } from '../../../components/diagram-studio/migrations/normalizeContent';

const el = (id) => ({ id, type: 'rectangle', x: 1, y: 2 });
const cn = (id) => ({ id, sourceId: 'a', targetId: 'b' });

describe('normalizeDiagramContent', () => {
  test('canonical shape passes through unchanged', () => {
    const content = {
      elements: [el('a')], connections: [cn('c1')],
      layers: [{ id: 'l1', name: 'L' }], groups: [{ id: 'g1' }],
      viewport: { x: 5, y: 6, zoom: 2 },
    };
    expect(normalizeDiagramContent(content)).toEqual(content);
  });

  test('null / undefined / junk become an empty canonical document', () => {
    for (const bad of [null, undefined, 'x', 42, []]) {
      expect(normalizeDiagramContent(bad)).toEqual({
        elements: [], connections: [], layers: [DEFAULT_LAYER], groups: [], viewport: DEFAULT_VIEWPORT,
      });
    }
  });

  test('legacy nodes/edges are mapped to elements/connections', () => {
    const out = normalizeDiagramContent({ nodes: [el('n1')], edges: [cn('e1')], viewport: { x: 0, y: 0, zoom: 1 } });
    expect(out.elements).toEqual([el('n1')]);
    expect(out.connections).toEqual([cn('e1')]);
    expect(out).not.toHaveProperty('nodes');
    expect(out).not.toHaveProperty('edges');
  });

  test('empty layers array falls back to the default layer', () => {
    expect(normalizeDiagramContent({ layers: [] }).layers).toEqual([DEFAULT_LAYER]);
  });

  test('double-write shape: nested diagram copy is dropped, top-level data wins', () => {
    const stored = {
      elements: [el('a')], connections: [], layers: [DEFAULT_LAYER], groups: [],
      diagram: { id: 'd1', name: 'N', content: { elements: [el('a')], connections: [], viewport: { x: 9, y: 9, zoom: 3 } } },
    };
    const out = normalizeDiagramContent(stored);
    expect(out).not.toHaveProperty('diagram');
    expect(out.elements).toEqual([el('a')]);
    // viewport was dropped by the second write; recover it from the nested copy
    expect(out.viewport).toEqual({ x: 9, y: 9, zoom: 3 });
  });

  test('nested-only content (no top-level elements) is recovered from diagram.content', () => {
    const out = normalizeDiagramContent({ diagram: { content: { elements: [el('z')], connections: [cn('c')] } } });
    expect(out.elements).toEqual([el('z')]);
    expect(out.connections).toEqual([cn('c')]);
  });

  test('multiply nested copies are flattened', () => {
    const inner = { elements: [el('a')], diagram: { content: { elements: [el('old')] } } };
    const out = normalizeDiagramContent({ diagram: { content: inner } });
    expect(out.elements).toEqual([el('a')]);
    expect(JSON.stringify(out)).not.toMatch(/"diagram"/);
  });

  test('idempotent', () => {
    const inputs = [
      null,
      { nodes: [el('n')], edges: [] },
      { elements: [el('a')], diagram: { content: { elements: [el('a')], viewport: { x: 1, y: 1, zoom: 1 } } } },
      { elements: [el('a')], connections: [], layers: [], groups: [], viewport: { x: 1, y: 2, zoom: 1 } },
    ];
    for (const i of inputs) {
      const once = normalizeDiagramContent(i);
      expect(normalizeDiagramContent(once)).toEqual(once);
    }
  });

  test('does not mutate its input and returns fresh arrays', () => {
    const input = { nodes: [el('n')], diagram: { content: { elements: [] } } };
    const snapshot = JSON.parse(JSON.stringify(input));
    const out = normalizeDiagramContent(input);
    expect(input).toEqual(snapshot);
    expect(out.elements).not.toBe(input.nodes);
  });

  test('preserves ids exactly (existing ids stay valid)', () => {
    const ids = ['el-1700000000000-abc123xyz', 'el_1700000000000_3', 'frame_1700000000000', 'sticky-1'];
    const out = normalizeDiagramContent({ elements: ids.map(el) });
    expect(out.elements.map((e) => e.id)).toEqual(ids);
  });
});

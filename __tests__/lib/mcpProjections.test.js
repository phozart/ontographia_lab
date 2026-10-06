import {
  toCompact,
  toMermaid,
  toOutline,
  escapeMermaidLabel,
  sanitizeText,
} from '../../lib/mcp/projections';

const meta = { id: 'D1', name: 'Order fulfilment', type: 'process-flow', revision: '42' };

const content = {
  elements: [
    { id: 'f1', type: 'frame', packId: 'core', label: 'Warehouse', x: 0, y: 0, size: { width: 900, height: 400 }, createdAt: '2026-01-01T00:00:00Z' },
    { id: 'a', type: 'start-event', packId: 'process-flow', label: 'Order received', x: 40.4, y: 120.6, size: { width: 44, height: 44 }, parentFrameId: 'f1', createdAt: 'x' },
    { id: 'b', type: 'task', packId: 'process-flow', label: 'Check stock', x: 160, y: 105, size: { width: 999, height: 77 }, data: { assignee: 'Ops' }, parentFrameId: 'f1' },
    { id: 'c', type: 'exclusive-gateway', packId: 'process-flow', label: 'In stock?', x: 300, y: 105 },
    { id: 'd', type: 'task', packId: 'process-flow', label: 'Outside', x: 500, y: 105 },
  ],
  connections: [
    { id: 'k1', sourceId: 'a', targetId: 'b', label: '', lineStyle: 'step', sourcePort: 'right', targetPort: 'left', createdAt: 'x' },
    { id: 'k2', sourceId: 'b', targetId: 'c', label: 'ok', lineStyle: 'smart', connectionType: 'sequence' },
    { id: 'kx', sourceId: 'b', targetId: 'ghost' },
  ],
  layers: [{ id: 'l1', name: 'Default', visible: true }],
};

describe('toCompact', () => {
  test('keeps stable ids, namespaced types, rounded coordinates', () => {
    const c = toCompact(meta, content);
    expect(c.id).toBe('D1');
    expect(c.revision).toBe(42);
    const a = c.elements.find((e) => e.id === 'a');
    expect(a).toMatchObject({ t: 'process-flow/start-event', label: 'Order received', x: 40, y: 121, frame: 'f1' });
    expect(a.createdAt).toBeUndefined();
    expect(c.connections.find((k) => k.id === 'k2')).toMatchObject({ from: 'b', to: 'c', label: 'ok', style: 'smart', connType: 'sequence' });
  });

  test('omits sizes equal to the stencil default and keeps the rest', () => {
    const c = toCompact(meta, content);
    expect(c.elements.find((e) => e.id === 'a').w).toBeUndefined(); // start-event default size
    const b = c.elements.find((e) => e.id === 'b');
    expect(b).toMatchObject({ w: 999, h: 77, data: { assignee: 'Ops' } });
    expect(c.elements.find((e) => e.id === 'f1')).toMatchObject({ t: 'core/frame', w: 900, h: 400 });
  });

  test('drops dangling connections and lists the packs used', () => {
    const c = toCompact(meta, content);
    expect(c.connections.map((k) => k.id)).toEqual(['k1', 'k2']);
    expect(c.packs).toEqual(['core', 'process-flow']);
  });

  test('structure detail drops geometry', () => {
    const c = toCompact(meta, content, { detail: 'structure' });
    for (const e of c.elements) expect(e).not.toHaveProperty('x');
    for (const e of c.elements) expect(e).not.toHaveProperty('w');
  });

  test('elementIds and frameId restrict the output and connections to the subset', () => {
    const only = toCompact(meta, content, { elementIds: ['a', 'b'] });
    expect(only.elements.map((e) => e.id)).toEqual(['a', 'b']);
    expect(only.connections.map((k) => k.id)).toEqual(['k1']);
    const frame = toCompact(meta, content, { frameId: 'f1' });
    expect(frame.elements.map((e) => e.id).sort()).toEqual(['a', 'b', 'f1']);
  });

  test('caps the element count and reports truncation', () => {
    const many = { elements: Array.from({ length: 30 }, (_, i) => ({ id: `e${i}`, type: 'task', packId: 'process-flow', label: 'x', x: i, y: 0 })), connections: [] };
    const c = toCompact(meta, many, { maxElements: 10 });
    expect(c.elements).toHaveLength(10);
    expect(c.truncated).toEqual({ elements: 20 });
  });

  test('tolerates missing, malformed or legacy content', () => {
    expect(toCompact(meta, null).elements).toEqual([]);
    expect(toCompact(meta, { elements: 'x', connections: 5 }).elements).toEqual([]);
    expect(toCompact(meta, { nodes: [], edges: [] }).elements).toEqual([]);
    const odd = toCompact(meta, { elements: [null, 3, { id: 'ok', type: 'task', x: 'NaN', label: 7 }, { type: 'no-id' }] });
    expect(odd.elements.map((e) => e.id)).toEqual(['ok']);
    expect(odd.elements[0].label).toBe('7');
  });

  test('is at least 2.5x smaller than raw content on a 100-element flow', () => {
    const raw = {
      elements: Array.from({ length: 100 }, (_, i) => ({
        id: `el-${'0123456789abcdef'.repeat(2)}${i}`,
        type: 'task',
        packId: 'process-flow',
        label: `Step ${i}`,
        x: i * 160,
        y: 100,
        size: { width: 140, height: 60 },
        createdAt: '2026-10-06T12:00:00.000Z',
        updatedAt: '2026-10-06T12:00:00.000Z',
        layerId: 'layer-00000000-0000-0000-0000-000000000000',
        locked: false,
        visible: true,
        style: { fill: '#ffffff', stroke: '#4FB3CE', strokeWidth: 2, opacity: 1, fontSize: 14, fontWeight: 'normal' },
        data: {},
      })),
      connections: Array.from({ length: 99 }, (_, i) => ({
        id: `conn-${'0123456789abcdef'.repeat(2)}${i}`,
        sourceId: `el-${'0123456789abcdef'.repeat(2)}${i}`,
        targetId: `el-${'0123456789abcdef'.repeat(2)}${i + 1}`,
        sourcePort: 'right',
        targetPort: 'left',
        lineStyle: 'step',
        targetMarker: 'arrow',
        sourceMarker: 'none',
        createdAt: '2026-10-06T12:00:00.000Z',
        style: { stroke: '#64748b', strokeWidth: 2 },
      })),
    };
    const ratio = JSON.stringify(raw).length / JSON.stringify(toCompact(meta, raw)).length;
    expect(ratio).toBeGreaterThanOrEqual(2.5); // measured ~2.8 on this synthetic fixture; the 3x design target is re-measured on real data
  });
});

describe('escapeMermaidLabel', () => {
  test('neutralizes quotes, brackets, markup, pipes, backticks and newlines', () => {
    const e = escapeMermaidLabel('a"b <i>c</i> & d | `e` \\ f\ng #h');
    expect(e).not.toMatch(/["<>|`\\\n&]/);
    expect(e).toContain('#34;'); // quote as numeric entity
    expect(e).toContain('#35;h'); // '#' itself is escaped first so entities stay unambiguous
  });

  test('limits length and strips control characters', () => {
    const e = escapeMermaidLabel('x'.repeat(500) + '\u0000\u0007');
    expect(e.length).toBeLessThanOrEqual(201);
    expect(e).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe('sanitizeText', () => {
  test('coerces to a bounded plain string', () => {
    expect(sanitizeText(7)).toBe('7');
    expect(sanitizeText(null)).toBe('');
    expect(sanitizeText({})).toBe('');
    expect(sanitizeText('x'.repeat(5000), 100)).toHaveLength(100);
  });
});

describe('toMermaid', () => {
  const out = toMermaid(meta, content);

  test('is a flowchart with indexed node ids, never user ids', () => {
    expect(out.split('\n')[0]).toMatch(/^flowchart (LR|TB)/);
    expect(out).not.toContain('"f1"');
    expect(out).toMatch(/n\d+/);
  });

  test('maps shapes: events as circles, gateways as diamonds, frames as subgraphs', () => {
    expect(out).toMatch(/\(\("Order received"\)\)/);
    expect(out).toMatch(/\{"In stock\?"\}/);
    expect(out).toMatch(/subgraph s\d+ \["Warehouse"\]/);
    expect(out).toMatch(/\n\s*end/);
  });

  test('members go inside their frame; others outside; labelled edges use quoted labels', () => {
    const sub = out.slice(out.indexOf('subgraph'), out.indexOf('end'));
    expect(sub).toContain('Order received');
    expect(sub).toContain('Check stock');
    expect(sub).not.toContain('Outside');
    expect(out).toMatch(/-->\|"ok"\|/);
  });

  test('a hostile label cannot break out of the node or inject directives', () => {
    const evil = {
      elements: [
        { id: 'x', type: 'task', packId: 'process-flow', label: '"]; click x href "javascript:alert(1)" ["' },
        { id: 'y', type: 'task', packId: 'process-flow', label: 'end\nsubgraph pwn\n%%{init: {"securityLevel":"loose"}}%%' },
      ],
      connections: [{ id: 'c', sourceId: 'x', targetId: 'y', label: '|"> --- ' }],
    };
    const m = toMermaid(meta, evil);
    const lines = m.split('\n');
    expect(lines.filter((l) => /^\s*click\b/.test(l))).toHaveLength(0);
    expect(lines.filter((l) => /^\s*subgraph\b/.test(l))).toHaveLength(0);
    expect(m).not.toContain('%%{');
    expect(lines.length).toBe(1 + 2 + 1); // header, two nodes, one edge
    expect(m).not.toContain('"]; click');
  });

  test('cyclic frame parents do not loop forever', () => {
    const cyc = {
      elements: [
        { id: 'p', type: 'frame', packId: 'core', label: 'P', parentFrameId: 'q' },
        { id: 'q', type: 'frame', packId: 'core', label: 'Q', parentFrameId: 'p' },
      ],
      connections: [],
    };
    expect(() => toMermaid(meta, cyc)).not.toThrow();
  });

  test('empty diagram yields a valid flowchart', () => {
    expect(toMermaid(meta, { elements: [], connections: [] })).toMatch(/^flowchart/);
  });
});

describe('toOutline', () => {
  const out = toOutline(meta, content);

  test('indents frame members and lists edges with arrows', () => {
    expect(out).toContain('Warehouse');
    expect(out).toMatch(/\n {2}- Order received/);
    expect(out).toMatch(/Check stock .*→ In stock\? \(ok\)/);
  });

  test('flattens control characters so a label cannot fake an outline line', () => {
    const o = toOutline(meta, { elements: [{ id: 'z', type: 'task', packId: 'process-flow', label: 'x\n- injected' }], connections: [] });
    expect(o.split('\n').filter((l) => l.includes('injected'))).toHaveLength(1);
    expect(o).not.toMatch(/\n- injected/);
  });
});

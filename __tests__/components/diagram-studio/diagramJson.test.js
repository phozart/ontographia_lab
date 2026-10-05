import {
  FORMAT_ID,
  FORMAT_VERSION,
  MAX_IMPORT_BYTES,
  buildExportEnvelope,
  parseImportText,
  remapForMerge,
  sanitizeFilename,
} from '../../../components/diagram-studio/export/diagramJson';

const el = (id, x, y, extra = {}) => ({ id, type: 'rect', x, y, size: { width: 100, height: 50 }, label: id, ...extra });

describe('buildExportEnvelope', () => {
  it('wraps content in a versioned envelope', () => {
    const env = buildExportEnvelope(
      { name: 'My Diagram', type: 'mindmap', elements: [el('a', 0, 0)], connections: [], layers: [], groups: [] },
      new Date('2026-01-02T03:04:05.000Z')
    );
    expect(env.format).toBe(FORMAT_ID);
    expect(env.version).toBe(FORMAT_VERSION);
    expect(env.exportedAt).toBe('2026-01-02T03:04:05.000Z');
    expect(env.diagram.name).toBe('My Diagram');
    expect(env.diagram.type).toBe('mindmap');
    expect(env.diagram.content.elements).toHaveLength(1);
    expect(env.diagram.content.connections).toEqual([]);
  });
});

describe('sanitizeFilename', () => {
  it('replaces unsafe characters and trims', () => {
    expect(sanitizeFilename('  a/b:c*d?.. ')).toBe('a-b-c-d');
  });
  it('falls back for empty names', () => {
    expect(sanitizeFilename('')).toBe('diagram');
    expect(sanitizeFilename(null)).toBe('diagram');
    expect(sanitizeFilename('///')).toBe('diagram');
  });
  it('limits length', () => {
    expect(sanitizeFilename('x'.repeat(500)).length).toBeLessThanOrEqual(120);
  });
});

describe('parseImportText', () => {
  const envelope = (content, over = {}) => JSON.stringify({
    format: FORMAT_ID, version: 1, exportedAt: 'x',
    diagram: { name: 'N', type: 'cld', content }, ...over,
  });

  it('accepts a valid envelope', () => {
    const r = parseImportText(envelope({ elements: [el('a', 1, 2)], connections: [{ id: 'c', sourceId: 'a', targetId: 'a' }] }));
    expect(r.ok).toBe(true);
    expect(r.name).toBe('N');
    expect(r.type).toBe('cld');
    expect(r.content.elements).toHaveLength(1);
    expect(r.content.connections).toHaveLength(1);
  });

  it('accepts the raw saved content shape', () => {
    const r = parseImportText(JSON.stringify({ elements: [el('a', 1, 2)], connections: [], layers: [], groups: [] }));
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].id).toBe('a');
  });

  it('accepts the legacy 1.0 export shape', () => {
    const r = parseImportText(JSON.stringify({ version: '1.0', diagram: { name: 'L', type: 'erd', elements: [el('a', 0, 0)], connections: [] } }));
    expect(r.ok).toBe(true);
    expect(r.name).toBe('L');
    expect(r.type).toBe('erd');
  });

  it('rejects invalid JSON', () => {
    const r = parseImportText('{nope');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not valid JSON/i);
  });

  it('rejects files that are too large', () => {
    const r = parseImportText('x'.repeat(MAX_IMPORT_BYTES + 1));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too large/i);
  });

  it('rejects an unsupported newer envelope version', () => {
    const r = parseImportText(envelope({ elements: [] }, { version: 99 }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/version/i);
  });

  it('rejects arrays, primitives and objects without elements', () => {
    expect(parseImportText('[]').ok).toBe(false);
    expect(parseImportText('42').ok).toBe(false);
    expect(parseImportText('{"foo":1}').ok).toBe(false);
  });

  it('rejects when elements is not an array', () => {
    expect(parseImportText(JSON.stringify({ elements: {} })).ok).toBe(false);
  });

  it('drops elements with invalid geometry or missing ids and warns', () => {
    const r = parseImportText(JSON.stringify({ elements: [el('a', 0, 0), { id: 'b', x: 'zzz', y: 0 }, { x: 1, y: 1 }, null, 5] }));
    expect(r.ok).toBe(true);
    expect(r.content.elements.map(e => e.id)).toEqual(['a']);
    expect(r.warnings.length).toBeGreaterThan(0);
  });

  it('drops duplicate element ids', () => {
    const r = parseImportText(JSON.stringify({ elements: [el('a', 0, 0), el('a', 5, 5)] }));
    expect(r.content.elements).toHaveLength(1);
  });

  it('drops connections that reference unknown elements unless free-floating', () => {
    const r = parseImportText(JSON.stringify({
      elements: [el('a', 0, 0), el('b', 200, 0)],
      connections: [
        { id: 'ok', sourceId: 'a', targetId: 'b' },
        { id: 'bad', sourceId: 'a', targetId: 'ghost' },
        { id: 'free', sourceId: 'a', targetPos: { x: 5, y: 6 } },
      ],
    }));
    expect(r.content.connections.map(c => c.id)).toEqual(['ok', 'free']);
    expect(r.warnings.join(' ')).toMatch(/connection/i);
  });

  it('strips unknown top-level keys', () => {
    const r = parseImportText(JSON.stringify({ elements: [el('a', 0, 0)], evil: { x: 1 }, viewport: { x: 1, y: 2, scale: 1 } }));
    expect(r.content.evil).toBeUndefined();
    expect(Object.keys(r.content).every(k => ['elements', 'connections', 'layers', 'groups', 'viewport'].includes(k))).toBe(true);
  });

  it('does not pollute Object.prototype via nested keys', () => {
    const text = '{"elements":[{"id":"a","x":0,"y":0,"__proto__":{"polluted":true},"data":{"constructor":{"prototype":{"polluted2":true}}}}]}';
    const r = parseImportText(text);
    expect(r.ok).toBe(true);
    expect({}.polluted).toBeUndefined();
    expect({}.polluted2).toBeUndefined();
    const e = r.content.elements[0];
    expect(Object.prototype.hasOwnProperty.call(e, '__proto__')).toBe(false);
    expect(e.data && Object.prototype.hasOwnProperty.call(e.data, 'constructor')).toBeFalsy();
  });

  it('rejects an absurd number of elements', () => {
    const many = Array.from({ length: 5001 }, (_, i) => ({ id: `e${i}`, x: 0, y: 0 }));
    const r = parseImportText(JSON.stringify({ elements: many }));
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/too many/i);
  });

  it('falls back to infinite-canvas for unknown types', () => {
    const r = parseImportText(envelope({ elements: [] }, { diagram: { name: 'N', type: 'weird', content: { elements: [] } } }));
    expect(r.ok).toBe(true);
    expect(r.type).toBe('infinite-canvas');
  });
});

describe('remapForMerge', () => {
  const content = {
    elements: [
      el('a', 100, 100, { groupId: 'g1', layerId: 'l1', parentFrameId: 'f' }),
      el('f', 0, 0),
      el('b', 300, 100),
    ],
    connections: [
      { id: 'c1', sourceId: 'a', targetId: 'b', waypoints: [{ x: 200, y: 100 }], label: 'x' },
      { id: 'c2', sourceId: 'a', targetId: 'b', sourcePos: null, targetPos: { x: 10, y: 20 } },
    ],
  };
  let n = 0;
  const idGen = () => `new-${++n}`;

  it('assigns fresh ids and remaps connection endpoints', () => {
    n = 0;
    const out = remapForMerge(content, { center: { x: 0, y: 0 }, idGen });
    const ids = out.elements.map(e => e.id);
    expect(new Set(ids).size).toBe(3);
    expect(ids).not.toContain('a');
    const a = out.elements[0];
    const b = out.elements[2];
    expect(out.connections[0].sourceId).toBe(a.id);
    expect(out.connections[0].targetId).toBe(b.id);
    expect(out.connections[0].id).not.toBe('c1');
    expect(a.parentFrameId).toBe(out.elements[1].id);
  });

  it('removes group and layer membership', () => {
    n = 0;
    const out = remapForMerge(content, { center: { x: 0, y: 0 }, idGen });
    expect(out.elements[0].groupId).toBeUndefined();
    expect(out.elements[0].layerId).toBeUndefined();
  });

  it('centers the imported bounding box on the given point', () => {
    n = 0;
    const out = remapForMerge(content, { center: { x: 1000, y: 500 }, idGen });
    // bbox of content: x 0..400, y 0..150 => center (200, 75)
    const dx = 1000 - 200;
    const dy = 500 - 75;
    expect(out.elements[0].x).toBe(100 + dx);
    expect(out.elements[0].y).toBe(100 + dy);
    expect(out.connections[0].waypoints[0]).toEqual({ x: 200 + dx, y: 100 + dy });
    expect(out.connections[1].targetPos).toEqual({ x: 10 + dx, y: 20 + dy });
  });

  it('does not mutate its input', () => {
    n = 0;
    const copy = JSON.stringify(content);
    remapForMerge(content, { center: { x: 5, y: 5 }, idGen });
    expect(JSON.stringify(content)).toBe(copy);
  });
});

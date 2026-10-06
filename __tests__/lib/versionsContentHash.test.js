const { canonicalJson, contentHash, contentStats } = require('../../lib/versions/contentHash');

describe('canonicalJson', () => {
  test('is independent of object key order, at any depth', () => {
    expect(canonicalJson({ b: 1, a: { d: 1, c: [{ y: 1, x: 2 }] } })).toBe(canonicalJson({ a: { c: [{ x: 2, y: 1 }], d: 1 }, b: 1 }));
  });
  test('array order matters', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('contentHash', () => {
  const base = { elements: [{ id: 'a', x: 1 }], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
  test('64-char hex sha256', () => expect(contentHash(base)).toMatch(/^[0-9a-f]{64}$/));
  test('ignores viewport', () => {
    expect(contentHash({ ...base, viewport: { x: 500, y: 9, zoom: 2 } })).toBe(contentHash(base));
    const { viewport, ...noVp } = base;  
    expect(contentHash(noVp)).toBe(contentHash(base));
  });
  test('changes when an element changes', () => {
    expect(contentHash({ ...base, elements: [{ id: 'a', x: 2 }] })).not.toBe(contentHash(base));
  });
  test('stable across key order', () => {
    expect(contentHash({ elements: base.elements, connections: [], groups: [], layers: [] })).toBe(
      contentHash({ layers: [], groups: [], connections: [], elements: [{ x: 1, id: 'a' }] }));
  });
  test('tolerates null / non-objects without throwing', () => {
    expect(contentHash(null)).toMatch(/^[0-9a-f]{64}$/);
    expect(contentHash(undefined)).toBe(contentHash(null));
  });
});

describe('contentStats', () => {
  test('counts and byte size', () => {
    const c = { elements: [{ id: 'a' }, { id: 'b' }], connections: [{ id: 'c' }] };
    const s = contentStats(c);
    expect(s.elementCount).toBe(2);
    expect(s.connectionCount).toBe(1);
    expect(s.sizeBytes).toBe(Buffer.byteLength(JSON.stringify(c), 'utf8'));
  });
  test('missing arrays count as zero', () => {
    expect(contentStats({})).toMatchObject({ elementCount: 0, connectionCount: 0 });
  });
});

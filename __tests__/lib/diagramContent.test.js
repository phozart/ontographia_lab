import { validateDiagramContent } from '../../lib/diagramContent';
import { MAX_CONTENT_BYTES, MAX_ELEMENTS, MAX_CONNECTIONS, MAX_COLLECTION, MAX_DEPTH } from '../../lib/diagramLimits';

const el = (i) => ({ id: `el-${i}`, x: i, y: i });
const good = () => ({ elements: [el(1)], connections: [], layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } });

describe('validateDiagramContent', () => {
  test('accepts canonical content unchanged', () => {
    const r = validateDiagramContent(good());
    expect(r.ok).toBe(true);
    expect(r.content).toEqual(good());
    expect(r.warnings).toEqual([]);
  });

  test('accepts partial canonical content (any subset of the five keys)', () => {
    expect(validateDiagramContent({ elements: [] }).ok).toBe(true);
    expect(validateDiagramContent({}).ok).toBe(true);
  });

  test.each([null, [], 'str', 5, undefined])('non-object content %j -> 400', (v) => {
    const r = validateDiagramContent(v);
    expect(r).toMatchObject({ ok: false, status: 400, code: 'VALIDATION_FAILED' });
    expect(r.error).toMatch(/content/i);
  });

  test('unknown top-level keys -> 400 naming the key', () => {
    const r = validateDiagramContent({ ...good(), diagram: { content: {} } });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(/diagram/);
  });

  test.each(['elements', 'connections', 'layers', 'groups'])('%s must be an array', (k) => {
    const r = validateDiagramContent({ ...good(), [k]: { a: 1 } });
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(new RegExp(k));
  });

  test('viewport must be a plain object', () => {
    expect(validateDiagramContent({ ...good(), viewport: [1] }).ok).toBe(false);
    expect(validateDiagramContent({ ...good(), viewport: 'x' }).ok).toBe(false);
  });

  test('element / connection / layer-group count caps -> 400', () => {
    const many = (n) => Array.from({ length: n }, (_, i) => ({ id: `e${i}` }));
    expect(validateDiagramContent({ elements: many(MAX_ELEMENTS) }).ok).toBe(true);
    expect(validateDiagramContent({ elements: many(MAX_ELEMENTS + 1) })).toMatchObject({ ok: false, status: 400 });
    expect(validateDiagramContent({ connections: many(MAX_CONNECTIONS + 1) })).toMatchObject({ ok: false, status: 400 });
    expect(validateDiagramContent({ layers: many(MAX_COLLECTION + 1) })).toMatchObject({ ok: false, status: 400 });
    expect(validateDiagramContent({ groups: many(MAX_COLLECTION + 1) })).toMatchObject({ ok: false, status: 400 });
  });

  test('elements must be objects', () => {
    expect(validateDiagramContent({ elements: [1] })).toMatchObject({ ok: false, status: 400 });
    expect(validateDiagramContent({ elements: [null] })).toMatchObject({ ok: false, status: 400 });
  });

  test('size over the cap -> 413 PAYLOAD_TOO_LARGE', () => {
    const big = { elements: [{ id: 'a', x: 0, y: 0, text: 'x'.repeat(MAX_CONTENT_BYTES + 1) }] };
    expect(validateDiagramContent(big)).toMatchObject({ ok: false, status: 413, code: 'PAYLOAD_TOO_LARGE' });
  });

  test('size is measured in bytes, not characters', () => {
    const multi = { elements: [{ id: 'a', x: 0, y: 0, text: '€'.repeat(Math.ceil(MAX_CONTENT_BYTES / 3) + 10) }] };
    expect(validateDiagramContent(multi)).toMatchObject({ ok: false, status: 413 });
  });

  function nest(depth) {
    const root = { id: 'a', x: 0, y: 0 };
    let cur = root;
    for (let i = 0; i < depth; i++) { cur.n = {}; cur = cur.n; }
    return { elements: [root] };
  }
  test('nesting at the cap passes, beyond it -> 400', () => {
    expect(validateDiagramContent(nest(MAX_DEPTH - 3)).ok).toBe(true);
    expect(validateDiagramContent(nest(MAX_DEPTH + 5))).toMatchObject({ ok: false, status: 400 });
  });

  test('very deep nesting does not overflow the stack', () => {
    expect(validateDiagramContent(nest(50000))).toMatchObject({ ok: false, status: 400 });
  });

  test.each(['__proto__', 'constructor', 'prototype'])('forbidden key %s at depth -> 400', (key) => {
    const raw = `{"elements":[{"id":"a","x":0,"y":0,"data":{"deep":{"${key}":{"polluted":true}}}}]}`;
    const r = validateDiagramContent(JSON.parse(raw));
    expect(r).toMatchObject({ ok: false, status: 400 });
    expect(r.error).toMatch(new RegExp(key));
  });

  test('forbidden key inside arrays and viewport -> 400', () => {
    const raw = '{"viewport":{"__proto__":{"x":1}}}';
    expect(validateDiagramContent(JSON.parse(raw)).ok).toBe(false);
    const raw2 = '{"groups":[{"id":"g","list":[{"constructor":1}]}]}';
    expect(validateDiagramContent(JSON.parse(raw2)).ok).toBe(false);
  });

  test('unsafe URL values are stripped with a warning; safe ones kept', () => {
    const content = {
      elements: [{
        id: 'a', x: 0, y: 0,
        imageUrl: 'javascript:alert(1)',
        link: 'https://example.com/x',
        data: { href: 'data:text/html;base64,AAAA', src: 'data:image/png;base64,AAAA', notAUrlKey: 'javascript:1' },
      }],
      connections: [{ id: 'c', sourceId: 'a', targetId: 'a', url: 'ftp://x' }],
    };
    const r = validateDiagramContent(content);
    expect(r.ok).toBe(true);
    const e = r.content.elements[0];
    expect('imageUrl' in e).toBe(false);
    expect(e.link).toBe('https://example.com/x');
    expect('href' in e.data).toBe(false);
    expect(e.data.src).toBe('data:image/png;base64,AAAA');
    expect(e.data.notAUrlKey).toBe('javascript:1');
    expect('url' in r.content.connections[0]).toBe(false);
    expect(r.warnings.join(' ')).toMatch(/3 unsafe URL/);
    // input not mutated
    expect(content.elements[0].imageUrl).toBe('javascript:alert(1)');
  });

  test('empty URL strings are kept', () => {
    const r = validateDiagramContent({ elements: [{ id: 'a', imageUrl: '' }] });
    expect(r.content.elements[0].imageUrl).toBe('');
  });
});

import { isSafeUrl, cssUrl } from '../../../components/diagram-studio/export/safeUrl';
import { parseImportText } from '../../../components/diagram-studio/export/diagramJson';

describe('isSafeUrl', () => {
  it.each([
    ['https://example.com/a.png', true],
    ['http://example.com/a.png', true],
    ['data:image/png;base64,AAAA', true],
    ['data:image/svg+xml;base64,AAAA', true],
    ['data:text/html;base64,AAAA', false],
    ['javascript:alert(1)', false],
    ['//evil.com/x.png', false],
    ['ftp://x/y', false],
    ['/relative.png', false],
    ['', false],
    [42, false],
  ])('%s -> %s', (u, ok) => expect(isSafeUrl(u)).toBe(ok));
});

describe('cssUrl', () => {
  it('quotes and escapes', () => {
    expect(cssUrl('https://a.com/x"y).png')).toBe('url("https://a.com/x%22y%29.png")');
  });
  it('returns undefined for unsafe urls', () => {
    expect(cssUrl('javascript:1')).toBeUndefined();
  });
});

describe('import sanitizer url fields', () => {
  it('drops unsafe url-valued fields with a warning and keeps safe ones', () => {
    const r = parseImportText(JSON.stringify({ elements: [
      { id: 'a', x: 0, y: 0, data: { imageUrl: 'javascript:alert(1)', url: 'https://ok.com' } },
      { id: 'b', x: 0, y: 0, data: { imageUrl: 'data:image/png;base64,AAAA', href: 'ftp://x' } },
    ] }));
    expect(r.content.elements[0].data.imageUrl).toBeUndefined();
    expect(r.content.elements[0].data.url).toBe('https://ok.com');
    expect(r.content.elements[1].data.imageUrl).toBeDefined();
    expect(r.content.elements[1].data.href).toBeUndefined();
    expect(r.warnings.join(' ')).toMatch(/url/i);
  });
});

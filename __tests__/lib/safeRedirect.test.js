import { safeRedirectPath } from '../../lib/safeRedirect';

describe('safeRedirectPath', () => {
  const rejected = [
    '//evil.com',
    '///evil.com',
    '/\\evil.com',
    '/a\\b',
    '\\evil.com',
    '/%2F%2Fevil.com',
    '/%2f/evil.com',
    '/%5Cevil.com',
    'https://evil.com',
    'http://localhost:3000/account',
    'javascript:alert(1)',
    'JaVaScRiPt:alert(1)',
    'data:text/html,x',
    '\t/evil',
    ' /evil',
    '/\tevil.com',
    '/\nevil.com',
    '/\u0000evil',
    'evil.com',
    '',
    '   ',
    '/%E0%A4%A',
    null,
    undefined,
    42,
    ['/account'],
  ];
  test.each(rejected.map((v) => [JSON.stringify(v), v]))('rejects %s', (_l, v) => {
    expect(safeRedirectPath(v)).toBe('/');
  });

  test.each([
    ['/account', '/account'],
    ['/', '/'],
    ['/diagram/LAB-1?focus=a', '/diagram/LAB-1?focus=a'],
    ['/dashboard#x', '/dashboard#x'],
    ['/search?q=a%20b', '/search?q=a%20b'],
  ])('accepts %s', (input, out) => {
    expect(safeRedirectPath(input)).toBe(out);
  });

  test('custom fallback', () => {
    expect(safeRedirectPath('//evil.com', '/dashboard')).toBe('/dashboard');
    expect(safeRedirectPath(undefined, '/dashboard')).toBe('/dashboard');
  });
});

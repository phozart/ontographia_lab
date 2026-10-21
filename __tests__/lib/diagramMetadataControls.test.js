import { validateMetadata, validateName } from '../../lib/diagramMetadata';

describe('control characters', () => {
  test.each(['a\u0000b', 'a\u0007b', 'a\nb', 'a\tb', 'a\u007fb'])('name %j is refused', (n) => {
    expect(validateName(n)).toMatch(/control/i);
  });
  test('plain names pass', () => expect(validateName('Café ✓ 日本')).toBeNull());
  test('description refuses NUL and ESC but allows tab, newline, CR', () => {
    expect(validateMetadata({ description: 'a\u0000b' })).toMatch(/control/i);
    expect(validateMetadata({ description: 'a\u001bb' })).toMatch(/control/i);
    expect(validateMetadata({ description: 'a\tb\r\nc' })).toBeNull();
  });
  test('tags refuse control characters', () => {
    expect(validateMetadata({ tags: ['a\u0000'] })).toMatch(/tags/i);
  });
});

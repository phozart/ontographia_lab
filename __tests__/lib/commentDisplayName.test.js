jest.mock('../../lib/db', () => ({ query: jest.fn() }));
import { displayName } from '../../lib/commentRepository';

describe('comment author display name', () => {
  test('profile name wins', () => expect(displayName(' Alice ', 'a@x.co')).toBe('Alice'));
  test('falls back to the e-mail local part, never the full address', () => {
    expect(displayName(null, 'bob.smith@corp.example')).toBe('bob.smith');
    expect(displayName('', 'bob@corp.example')).not.toContain('@');
  });
  test('Unknown when nothing is known', () => {
    expect(displayName(null, null)).toBe('Unknown');
    expect(displayName(undefined, 'weird')).toBe('Unknown');
  });
});

/** @jest-environment node */
import { rateLimit } from '../../lib/rateLimit';

describe('rateLimit().consume (no HTTP response involved)', () => {
  test('allows up to the limit per key, then refuses with a retry hint; keys are independent', () => {
    const l = rateLimit({ interval: 60000, limit: 2, prefix: 'consume-test-a' });
    expect(l.consume('t1').success).toBe(true);
    expect(l.consume('t1').success).toBe(true);
    const over = l.consume('t1');
    expect(over.success).toBe(false);
    expect(over.resetIn).toBeGreaterThan(0);
    expect(l.consume('t2').success).toBe(true);
  });

  test('prefixes isolate limiters that share a key', () => {
    const a = rateLimit({ limit: 1, prefix: 'consume-test-b' });
    const b = rateLimit({ limit: 1, prefix: 'consume-test-c' });
    expect(a.consume('same').success).toBe(true);
    expect(b.consume('same').success).toBe(true);
  });
});

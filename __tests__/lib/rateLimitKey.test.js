import { rateLimit } from '../../lib/rateLimit';

const mkRes = () => {
  const res = { headers: {}, statusCode: 200, body: null };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (c) => { res.statusCode = c; return res; };
  res.json = (b) => { res.body = b; return res; };
  return res;
};
const req = { headers: {}, socket: { remoteAddress: '10.0.0.1' } };

describe('rateLimit explicit key', () => {
  test('buckets by the supplied key instead of the client address', async () => {
    const limiter = rateLimit({ limit: 2, interval: 60000, prefix: 'keytest-a' });
    expect((await limiter.check(req, mkRes(), 'token-1')).success).toBe(true);
    expect((await limiter.check(req, mkRes(), 'token-1')).success).toBe(true);
    const blocked = mkRes();
    expect((await limiter.check(req, blocked, 'token-1')).success).toBe(false);
    expect(blocked.statusCode).toBe(429);
    expect(blocked.headers['Retry-After']).toBeGreaterThan(0);
    // Same address, other token: independent bucket.
    expect((await limiter.check(req, mkRes(), 'token-2')).success).toBe(true);
  });

  test('without a key it still buckets by client address', async () => {
    const limiter = rateLimit({ limit: 1, interval: 60000, prefix: 'keytest-b' });
    expect((await limiter.check(req, mkRes())).success).toBe(true);
    expect((await limiter.check(req, mkRes())).success).toBe(false);
  });
});

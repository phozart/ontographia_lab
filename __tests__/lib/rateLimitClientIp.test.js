import { getClientId } from '../../lib/rateLimit';

const req = (xff, remote = '10.0.0.9') => ({
  headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  socket: { remoteAddress: remote },
});

describe('getClientId', () => {
  const prev = process.env.TRUST_PROXY_HOPS;
  afterEach(() => {
    if (prev === undefined) delete process.env.TRUST_PROXY_HOPS;
    else process.env.TRUST_PROXY_HOPS = prev;
  });

  test('default (1 hop) uses the rightmost entry', () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(getClientId(req('6.6.6.6, 203.0.113.5'))).toBe('203.0.113.5');
    expect(getClientId(req('203.0.113.5'))).toBe('203.0.113.5');
  });

  test('2 hops uses second from right', () => {
    process.env.TRUST_PROXY_HOPS = '2';
    expect(getClientId(req('6.6.6.6, 203.0.113.5, 172.16.0.2'))).toBe('203.0.113.5');
  });

  test('0 hops uses socket address and ignores X-Forwarded-For', () => {
    process.env.TRUST_PROXY_HOPS = '0';
    expect(getClientId(req('6.6.6.6', '198.51.100.7'))).toBe('198.51.100.7');
  });

  test('falls back to socket when header missing or shorter than hops', () => {
    delete process.env.TRUST_PROXY_HOPS;
    expect(getClientId(req(undefined, '198.51.100.7'))).toBe('198.51.100.7');
    process.env.TRUST_PROXY_HOPS = '3';
    expect(getClientId(req('1.1.1.1', '198.51.100.7'))).toBe('198.51.100.7');
  });

  test('invalid env value falls back to default of 1', () => {
    process.env.TRUST_PROXY_HOPS = 'abc';
    expect(getClientId(req('6.6.6.6, 203.0.113.5'))).toBe('203.0.113.5');
  });
});

import { isSameOriginRequest } from '../../lib/sameOrigin';

const r = (headers) => ({ headers });
const OLD = process.env.NEXTAUTH_URL;
afterEach(() => { process.env.NEXTAUTH_URL = OLD; if (OLD === undefined) delete process.env.NEXTAUTH_URL; });

describe('isSameOriginRequest', () => {
  test('no Origin header is allowed', () => expect(isSameOriginRequest(r({ host: 'app.test' }))).toBe(true));
  test('NEXTAUTH_URL origin is allowed', () => {
    process.env.NEXTAUTH_URL = 'https://app.example.com/some/path';
    expect(isSameOriginRequest(r({ origin: 'https://app.example.com', host: 'internal:3000' }))).toBe(true);
  });
  test('origin whose host matches the Host header is allowed', () => {
    delete process.env.NEXTAUTH_URL;
    expect(isSameOriginRequest(r({ origin: 'http://localhost:3236', host: 'localhost:3236' }))).toBe(true);
  });
  test('foreign, null, malformed and non-http origins are rejected', () => {
    process.env.NEXTAUTH_URL = 'https://app.example.com';
    for (const origin of ['https://evil.example', 'null', 'not a url', 'file://app.example.com', 'https://app.example.com.evil.io']) {
      expect(isSameOriginRequest(r({ origin, host: 'app.example.com' }))).toBe(false);
    }
  });
});

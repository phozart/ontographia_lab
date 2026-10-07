// listAll flags truncation when the page cap is hit with more pages remaining.
import { commentsApi } from '../../lib/comments/client';

afterEach(() => { delete global.fetch; });
const page = (n, next) => ({ ok: true, status: 200, json: async () => ({ items: Array(n).fill({}), nextCursor: next }) });

test('listAll reports truncated when the cap is reached with a cursor left', async () => {
  global.fetch = jest.fn(async () => page(100, 'more'));
  const items = await commentsApi.listAll('d1', { maxPages: 3 });
  expect(items).toHaveLength(300);
  expect(items.truncated).toBe(true);
});

test('listAll is not truncated when the last page has no cursor', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(page(100, 'c2')).mockResolvedValueOnce(page(5, null));
  const items = await commentsApi.listAll('d1');
  expect(items).toHaveLength(105);
  expect(items.truncated).toBe(false);
});

// useComments against a mocked comments client: server persistence, optimistic UI + rollback, anchors, import.
import { renderHook, act, waitFor } from '@testing-library/react';
import { render, screen } from '@testing-library/react';

jest.mock('../../../lib/comments/client', () => ({
  commentsApi: {
    listAll: jest.fn(), getThread: jest.fn(), createThread: jest.fn(), reply: jest.fn(),
    setStatus: jest.fn(), editComment: jest.fn(), deleteComment: jest.fn(),
  },
}));
import { commentsApi as api } from '../../../lib/comments/client';
import { useComments } from '../../../components/diagram-studio/ui/useComments';
import { CommentThread, DetachedComments } from '../../../components/diagram-studio/ui/CommentSystem';

const ME = { id: 'u1', name: 'Me', image: null };
const els = [{ id: 'a', x: 100, y: 100, width: 50, height: 50 }];
const thread = (extra = {}) => ({
  id: 't1', anchor: { type: 'element', targetId: 'a', x: 10, y: 10, fallbackX: 110, fallbackY: 110 }, anchorState: 'attached', status: 'open',
  createdAt: '2026-01-01T00:00:00Z', commentCount: 1,
  comments: [{ id: 'c1', body: 'hello', author: { id: 'u2', name: 'Bob', image: null }, createdAt: '2026-01-01T00:00:00Z', deleted: false }], ...extra,
});

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  api.listAll.mockResolvedValue([thread()]);
  window.localStorage.clear();
});

const setup = (props = {}) => renderHook((p) => useComments('d1', { elements: els, connections: [], currentUser: ME, ...p }), { initialProps: props });

test('loads threads from the API (no localStorage) with author identity', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  expect(api.listAll).toHaveBeenCalledWith('d1');
  expect(result.current.comments[0]).toMatchObject({ id: 't1', text: 'hello', user: { name: 'Bob' }, x: 110, y: 110, anchorState: 'attached' });
});

test('marker follows the element when it moves; detaches (faded fallback) when removed; re-attaches when it returns', async () => {
  const { result, rerender } = setup();
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  rerender({ elements: [{ ...els[0], x: 400, y: 500 }] });
  expect(result.current.comments[0]).toMatchObject({ x: 410, y: 510, detached: false });
  rerender({ elements: [] });
  expect(result.current.comments[0]).toMatchObject({ x: 110, y: 110, detached: true });
  expect(result.current.detachedComments).toHaveLength(1);
  rerender({ elements: els });
  expect(result.current.comments[0].detached).toBe(false);
  expect(result.current.detachedComments).toHaveLength(0);
});

test('addComment is optimistic, anchors to the element with an offset, and swaps in the server thread', async () => {
  const { result } = setup();
  await waitFor(() => expect(api.listAll).toHaveBeenCalled());
  let resolve;
  api.createThread.mockReturnValue(new Promise((r) => { resolve = r; }));
  let p;
  act(() => { p = result.current.addComment('new!', 120, 130, 'a'); });
  expect(api.createThread).toHaveBeenCalledWith('d1', { type: 'element', targetId: 'a', x: 20, y: 30, fallbackX: 120, fallbackY: 130 }, 'new!');
  expect(result.current.comments.some((c) => c.text === 'new!' && c.pending)).toBe(true);
  await act(async () => { resolve(thread({ id: 't2', comments: [{ id: 'c9', body: 'new!', author: ME, createdAt: 'x', deleted: false }] })); await p; });
  expect(result.current.comments.some((c) => c.id === 't2' && !c.pending)).toBe(true);
  expect(result.current.comments.some((c) => c.pending)).toBe(false);
});

test('a refused create rolls back, sets the error, and keeps the new-comment input open', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  act(() => result.current.startNewComment(500, 500));
  api.createThread.mockRejectedValue(Object.assign(new Error('Too many requests'), { status: 429 }));
  await act(async () => { await result.current.addComment('x', 500, 500, null); });
  expect(result.current.comments).toHaveLength(1);
  expect(result.current.error).toBe('Too many requests');
  expect(result.current.newCommentPosition).not.toBeNull();
});

test('startNewComment anchors to the element under the point', async () => {
  const { result } = setup();
  act(() => result.current.startNewComment(120, 120));
  expect(result.current.newCommentPosition).toEqual({ x: 120, y: 120, elementId: 'a' });
  act(() => result.current.startNewComment(0, 0));
  expect(result.current.newCommentPosition.elementId).toBeNull();
});

test('reply reopens, resolve toggles and rolls back on failure', async () => {
  const { result } = setup();
  await waitFor(() => expect(result.current.comments).toHaveLength(1));
  api.setStatus.mockResolvedValue(thread({ status: 'resolved' }));
  await act(async () => { await result.current.resolveComment('t1', true); });
  expect(result.current.comments[0].resolved).toBe(true);
  api.reply.mockResolvedValue({ id: 'c2', body: 'again', author: ME, createdAt: 'x', deleted: false });
  await act(async () => { await result.current.addReply('t1', 'again'); });
  expect(result.current.comments[0].resolved).toBe(false);
  expect(result.current.comments[0].replies[0]).toMatchObject({ id: 'c2', text: 'again' });
  api.setStatus.mockRejectedValue(new Error('nope'));
  await act(async () => { await result.current.resolveComment('t1', true); });
  expect(result.current.comments[0].resolved).toBe(false);
  expect(result.current.error).toBe('nope');
});

test('viewers (canComment=false) cannot create and get no import prompt', async () => {
  window.localStorage.setItem('comments-d1', JSON.stringify([{ text: 'old', x: 1, y: 1 }]));
  const { result } = setup({ canComment: false });
  await waitFor(() => expect(api.listAll).toHaveBeenCalled());
  expect(result.current.legacyCount).toBe(0);
  act(() => result.current.startNewComment(1, 1));
  expect(result.current.newCommentPosition).toBeNull();
  expect(await result.current.addComment('x', 1, 1)).toBeNull();
  expect(api.createThread).not.toHaveBeenCalled();
});

test('legacy localStorage comments: offered, imported through the API as the current user, then cleared', async () => {
  window.localStorage.setItem('comments-d1', JSON.stringify([
    { text: 'old one', x: 5, y: 6, resolved: true, replies: [{ text: 'old reply' }] }, { text: 'old two', x: 7, y: 8, replies: [] },
  ]));
  api.createThread.mockResolvedValue(thread({ id: 'tn' }));
  api.reply.mockResolvedValue({});
  api.setStatus.mockResolvedValue({});
  const { result } = setup();
  await waitFor(() => expect(result.current.legacyCount).toBe(2));
  await act(async () => { await result.current.importLegacy(); });
  expect(api.createThread).toHaveBeenCalledTimes(2);
  expect(api.createThread.mock.calls[0]).toEqual(['d1', { type: 'canvas', x: 5, y: 6 }, 'old one']);
  expect(api.reply).toHaveBeenCalledWith('d1', 'tn', 'old reply');
  expect(api.setStatus).toHaveBeenCalledWith('d1', 'tn', 'resolved');
  expect(window.localStorage.getItem('comments-d1')).toBeNull();
  expect(result.current.legacyCount).toBe(0);
});

test('a failed import keeps the key so it can be retried', async () => {
  window.localStorage.setItem('comments-d1', JSON.stringify([{ text: 'old', x: 1, y: 1 }]));
  api.createThread.mockRejectedValue(new Error('down'));
  const { result } = setup();
  await waitFor(() => expect(result.current.legacyCount).toBe(1));
  await act(async () => { await result.current.importLegacy(); });
  expect(window.localStorage.getItem('comments-d1')).not.toBeNull();
  expect(result.current.error).toBe('down');
});

describe('rendering', () => {
  const vm = (extra = {}) => ({ id: 't1', text: '<img src=x onerror=alert(1)> <b>bold</b>', user: { id: 'u2', name: 'Bob' }, createdAt: '2026-01-01T00:00:00Z', replies: [], resolved: false, ...extra });
  test('comment bodies render as text, never as HTML', () => {
    const { container } = render(<CommentThread comment={vm()} currentUser={ME} position={{ x: 0, y: 0 }} />);
    expect(container.querySelector('img[src="x"]')).toBeNull();
    expect(container.querySelector('.ds-comment-message-body b')).toBeNull();
    expect(screen.getByText(/<img src=x onerror=alert\(1\)> <b>bold<\/b>/)).toBeTruthy();
  });
  test('deleted comments show a placeholder; delete button only for author (or owner)', () => {
    const comment = vm({ replies: [{ id: 'r1', text: '', deleted: true, user: { id: 'u2', name: 'Bob' }, createdAt: '2026-01-01T00:00:00Z' }] });
    const { container, rerender } = render(<CommentThread comment={{ ...comment, commentId: 'c1', id: 't1' }} currentUser={ME} position={{ x: 0, y: 0 }} />);
    expect(screen.getByText('Comment deleted')).toBeTruthy();
    expect(container.querySelectorAll('.ds-comment-delete-btn')).toHaveLength(0);
    rerender(<CommentThread comment={comment} currentUser={ME} canDeleteAny position={{ x: 0, y: 0 }} />);
    expect(container.querySelectorAll('.ds-comment-delete-btn')).toHaveLength(1); // original only; deleted reply has none
  });
  test('detached group lists detached threads', () => {
    render(<DetachedComments comments={[vm({ id: 'd1', text: 'orphan' })]} onSelect={() => {}} />);
    expect(screen.getByText(/Detached comments \(1\)/)).toBeTruthy();
  });
});

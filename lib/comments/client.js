// lib/comments/client.js
// Thin browser client for the comment endpoints (api-contracts section 4). Errors carry `.status` / `.code`.

export class CommentsApiError extends Error {
  constructor(status, code, message) {
    super(message || code || 'Request failed');
    this.name = 'CommentsApiError';
    this.status = status;
    this.code = code;
  }
}

async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 204) return null;
  let data = null;
  try { data = await res.json(); } catch (_) { /* empty / non-JSON body */ }
  if (!res.ok) throw new CommentsApiError(res.status, data && data.code, (data && data.error) || `Request failed (${res.status})`);
  return data;
}

const base = (diagramId) => `/api/diagrams/${encodeURIComponent(diagramId)}`;

export const commentsApi = {
  /** All threads (open + resolved), following cursors; capped so a pathological diagram cannot loop forever. */
  async listAll(diagramId, { maxPages = 10 } = {}) {
    const items = [];
    let cursor = null;
    for (let i = 0; i < maxPages; i++) {
      const qs = `status=all&limit=100${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
      const page = await request('GET', `${base(diagramId)}/threads?${qs}`);
      items.push(...page.items);
      cursor = page.nextCursor;
      if (!cursor) break;
    }
    return items;
  },
  getThread: (diagramId, threadId) => request('GET', `${base(diagramId)}/threads/${threadId}`),
  createThread: (diagramId, anchor, body) => request('POST', `${base(diagramId)}/threads`, { anchor, body }),
  reply: (diagramId, threadId, body) => request('POST', `${base(diagramId)}/threads/${threadId}/comments`, { body }),
  setStatus: (diagramId, threadId, status) => request('PATCH', `${base(diagramId)}/threads/${threadId}`, { status }),
  editComment: (diagramId, commentId, body) => request('PATCH', `${base(diagramId)}/comments/${commentId}`, { body }),
  deleteComment: (diagramId, commentId) => request('DELETE', `${base(diagramId)}/comments/${commentId}`),
};

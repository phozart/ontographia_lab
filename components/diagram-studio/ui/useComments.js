// components/diagram-studio/ui/useComments.js
// Server-persisted comment threads for the canvas (ADR-0002, slice 4). Mutations are optimistic and roll back
// with `error` set when the server refuses. `elements` / `connections` drive anchor resolution at READ time:
// an element-anchored marker follows its element; deleting the element makes the thread `detached` (kept, drawn
// at its creation position, listed in the Detached group); a restore that brings the element id back re-attaches
// it with no write to the comment tables.

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { commentsApi } from '../../../lib/comments/client';
import { resolveMarker, elementAtPoint } from '../../../lib/comments/anchors';
import { readLegacyComments, clearLegacyComments, writeLegacyComments, planImport } from '../../../lib/comments/legacyImport';

const REFRESH_MS = 60 * 1000;
const tempId = (p) => `tmp_${p}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

// Thread (API shape) -> the view model the markers / popup render. x,y are absolute canvas coordinates.
export function toViewModel(thread, elements, connections) {
  const marker = resolveMarker(thread.anchor, { elements, connections });
  const [first, ...rest] = thread.comments;
  const msg = (c) => ({
    id: c.id,
    text: c.deleted ? '' : c.body,
    deleted: c.deleted,
    user: c.author ? { id: c.author.id, name: c.author.name, image: c.author.image } : null,
    createdAt: c.createdAt,
    editedAt: c.editedAt,
    createdVia: c.createdVia,
    read: true,
    pending: c.pending,
  });
  const firstMsg = first ? msg(first) : { id: null, text: '', user: null, createdAt: thread.createdAt, read: true };
  return {
    ...firstMsg,
    id: thread.id,
    commentId: firstMsg.id,
    x: marker.x,
    y: marker.y,
    elementId: thread.anchor.type === 'element' ? thread.anchor.targetId : null,
    anchorState: marker.state,
    detached: marker.state === 'detached',
    resolved: thread.status === 'resolved',
    replies: rest.map(msg),
    commentCount: thread.commentCount,
    hasMore: thread.commentCount > thread.comments.length,
    pending: thread.pending === true,
  };
}

export function useComments(diagramId, { elements = [], connections = [], currentUser = null, canComment = true } = {}) {
  const [threads, setThreads] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [newCommentPosition, setNewCommentPosition] = useState(null);
  const [error, setError] = useState(null);
  const [legacyCount, setLegacyCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importNotice, setImportNotice] = useState(null);
  const [truncated, setTruncated] = useState(false);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const load = useCallback(async () => {
    if (!diagramId) return;
    try {
      const items = await commentsApi.listAll(diagramId);
      setTruncated(items.truncated === true);
      // Keep optimistic rows that have not been confirmed yet; the server list is otherwise authoritative.
      setThreads((prev) => [...items, ...prev.filter((t) => t.pending)]);
    } catch (e) {
      if (e.status !== 404) setError(e.message || 'Could not load comments');
    }
  }, [diagramId]);

  // Initial load + refresh on focus and every 60 s (real-time updates arrive with a later slice).
  useEffect(() => {
    setThreads([]);
    setActiveId(null);
    load();
    const onFocus = () => load();
    const timer = setInterval(() => { if (typeof document === 'undefined' || !document.hidden) load(); }, REFRESH_MS);
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [load]);

  // Q-C1: offer the one-time import of browser-only comments to users who can comment.
  useEffect(() => {
    if (!diagramId || !canComment) { setLegacyCount(0); return; }
    setLegacyCount(planImport(readLegacyComments(window.localStorage, diagramId), []).length);
  }, [diagramId, canComment]);

  const comments = useMemo(
    () => threads.map((t) => toViewModel(t, elements, connections)),
    [threads, elements, connections]
  );
  const activeComment = useMemo(() => comments.find((c) => c.id === activeId) || null, [comments, activeId]);

  const mutate = useCallback((fn) => setThreads((prev) => fn(prev)), []);
  const fail = useCallback((e) => setError(e && e.message ? e.message : 'Something went wrong'), []);
  const optimisticAuthor = currentUser ? { id: currentUser.id, name: currentUser.name, image: currentUser.image || null } : null;

  const setActiveComment = useCallback((c) => {
    const id = c ? c.id : null;
    setActiveId(id);
    // The list ships the newest 20 comments; load the full thread when it is opened.
    if (c && c.hasMore && diagramId) {
      commentsApi.getThread(diagramId, id).then((full) => mutate((p) => p.map((t) => (t.id === id ? full : t)))).catch(() => {});
    }
  }, [diagramId, mutate]);

  // Add a new thread. Resolves to the thread id, or null when the server refused (error is set, thread removed).
  const addComment = useCallback(async (text, x, y, elementId = null) => {
    if (!diagramId || !canComment) return null;
    const el = elementId ? elementsRef.current.find((e) => e && e.id === elementId && Number.isFinite(Number(e.x)) && Number.isFinite(Number(e.y))) : null;
    const anchor = el
      ? { type: 'element', targetId: el.id, x: x - Number(el.x), y: y - Number(el.y), fallbackX: x, fallbackY: y }
      : { type: 'canvas', x, y };
    const id = tempId('t');
    const now = new Date().toISOString();
    mutate((p) => [...p, {
      id, anchor, status: 'open', pending: true, createdAt: now, commentCount: 1,
      comments: [{ id: tempId('c'), body: text, author: optimisticAuthor, createdAt: now, deleted: false, pending: true }],
    }]);
    setError(null);
    try {
      const created = await commentsApi.createThread(diagramId, anchor, text);
      setNewCommentPosition(null); // the input stays open (with the text) when the server refuses
      mutate((p) => p.map((t) => (t.id === id ? created : t)));
      setActiveId((cur) => (cur === id ? created.id : cur));
      return created.id;
    } catch (e) {
      mutate((p) => p.filter((t) => t.id !== id));
      fail(e);
      return null;
    }
  }, [diagramId, canComment, mutate, fail, optimisticAuthor]);

  // Reply (reopens a resolved thread).
  const addReply = useCallback(async (threadId, text) => {
    if (!diagramId || !canComment) return false;
    const cid = tempId('c');
    const now = new Date().toISOString();
    mutate((p) => p.map((t) => (t.id === threadId
      ? { ...t, status: 'open', commentCount: t.commentCount + 1, comments: [...t.comments, { id: cid, body: text, author: optimisticAuthor, createdAt: now, deleted: false, pending: true }] }
      : t)));
    setError(null);
    try {
      const saved = await commentsApi.reply(diagramId, threadId, text);
      mutate((p) => p.map((t) => (t.id === threadId ? { ...t, comments: t.comments.map((c) => (c.id === cid ? saved : c)) } : t)));
      return true;
    } catch (e) {
      mutate((p) => p.map((t) => (t.id === threadId ? { ...t, commentCount: t.commentCount - 1, comments: t.comments.filter((c) => c.id !== cid) } : t)));
      fail(e);
      return false;
    }
  }, [diagramId, canComment, mutate, fail, optimisticAuthor]);

  const resolveComment = useCallback(async (threadId, resolved) => {
    if (!diagramId || !canComment) return;
    const status = resolved ? 'resolved' : 'open';
    let before = null;
    mutate((p) => p.map((t) => { if (t.id !== threadId) return t; before = t.status; return { ...t, status }; }));
    setError(null);
    try {
      const saved = await commentsApi.setStatus(diagramId, threadId, status);
      mutate((p) => p.map((t) => (t.id === threadId ? saved : t)));
    } catch (e) {
      mutate((p) => p.map((t) => (t.id === threadId && before ? { ...t, status: before } : t)));
      fail(e);
    }
  }, [diagramId, canComment, mutate, fail]);

  // Soft-delete one comment (the original or a reply). A thread whose comments are all deleted disappears.
  const deleteComment = useCallback(async (threadId, commentId) => {
    if (!diagramId) return;
    let snapshot = null;
    mutate((p) => {
      snapshot = p;
      return p.flatMap((t) => {
        if (t.id !== threadId) return [t];
        const comments = t.comments.map((c) => (c.id === commentId ? { ...c, deleted: true, body: '' } : c));
        return t.commentCount <= comments.length && comments.every((c) => c.deleted) ? [] : [{ ...t, comments }];
      });
    });
    setError(null);
    try {
      await commentsApi.deleteComment(diagramId, commentId);
      load();
    } catch (e) {
      if (snapshot) setThreads(snapshot);
      fail(e);
    }
  }, [diagramId, mutate, fail, load]);

  // Start adding a new comment at a canvas position; a point inside an element anchors to that element.
  const startNewComment = useCallback((x, y, elementId = null) => {
    if (!canComment) return;
    const hit = elementId || (elementAtPoint(elementsRef.current, x, y) || {}).id || null;
    setNewCommentPosition({ x, y, elementId: hit });
    setActiveId(null);
  }, [canComment]);

  const cancelNewComment = useCallback(() => setNewCommentPosition(null), []);
  const clearError = useCallback(() => setError(null), []);

  // Q-C1: post the browser-only comments through the normal endpoints. Each item is removed from the stored
  // array once fully posted, so a retry (after a 429 or an error) resumes instead of duplicating threads.
  const importLegacy = useCallback(async () => {
    if (!diagramId || !canComment || importing) return;
    setImporting(true);
    setError(null);
    setImportNotice(null);
    const storage = window.localStorage;
    let remaining = readLegacyComments(storage, diagramId);
    const plan = planImport(remaining, elementsRef.current);
    const total = plan.length;
    let done = 0;
    const save = () => {
      writeLegacyComments(storage, diagramId, remaining);
      setLegacyCount(planImport(remaining, []).length);
    };
    try {
      for (const item of plan) {
        const src = item.source;
        let threadId = item.threadId;
        let replies = item.replies;
        try {
          if (!threadId) threadId = (await commentsApi.createThread(diagramId, item.anchor, item.body)).id;
          while (replies.length) {
            await commentsApi.reply(diagramId, threadId, replies[0]);
            replies = replies.slice(1);
          }
          if (item.resolved) await commentsApi.setStatus(diagramId, threadId, 'resolved');
        } catch (e) {
          // Remember how far this item got so the retry continues it rather than re-creating the thread.
          if (threadId) {
            const progressed = { ...src, _importedThreadId: threadId, replies: replies.map((text) => ({ text })) };
            remaining = remaining.map((r) => (r === src ? progressed : r));
            save();
          }
          throw e;
        }
        remaining = remaining.filter((r) => r !== src);
        save();
        done += 1;
      }
      clearLegacyComments(storage, diagramId);
      setLegacyCount(0);
    } catch (e) {
      if (e && e.status === 429) setImportNotice(`Imported ${done} of ${total} \u2014 continue in a minute`);
      else fail(e);
    } finally {
      setImporting(false);
      load();
    }
  }, [diagramId, canComment, importing, fail, load]);

  const discardLegacy = useCallback(() => {
    clearLegacyComments(window.localStorage, diagramId);
    setLegacyCount(0);
    setImportNotice(null);
  }, [diagramId]);

  const detachedComments = useMemo(() => comments.filter((c) => c.detached), [comments]);

  return {
    comments, detachedComments, activeComment, setActiveComment, newCommentPosition,
    addComment, addReply, resolveComment, deleteComment, startNewComment, cancelNewComment,
    error, clearError, legacyCount, importing, importNotice, truncated, importLegacy, discardLegacy, reload: load,
  };
}

export default useComments;

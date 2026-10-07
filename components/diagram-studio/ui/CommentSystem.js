// components/diagram-studio/ui/CommentSystem.js
// Comment system for canvas and elements

import { useState, useRef, useEffect } from 'react';
import { useComments } from './useComments';
import { createPortal } from 'react-dom';
import { formatDistanceToNow } from 'date-fns';

// Comment marker that appears on the canvas
export function CommentMarker({
  comment,
  isActive,
  onClick,
  viewport,
}) {
  // Convert canvas coordinates to container coordinates
  // The canvas uses transform: scale(s) translate(tx, ty)
  // So position = (canvasCoord + panOffset) * scale
  const screenX = (comment.x + viewport.x) * viewport.scale;
  const screenY = (comment.y + viewport.y) * viewport.scale;

  const unreadCount = comment.replies?.filter(r => !r.read).length || 0;
  const hasUnread = unreadCount > 0 || !comment.read;

  return (
    <div
      className={`ds-comment-marker ${isActive ? 'active' : ''} ${comment.resolved ? 'resolved' : ''} ${comment.detached ? 'detached' : ''}`}
      data-thread-id={comment.id}
      data-anchor-state={comment.anchorState}
      title={comment.detached ? 'Detached: the element this comment referred to was removed' : undefined}
      style={{
        position: 'absolute',
        left: screenX,
        top: screenY,
        transform: 'translate(-14px, -28px)',
        zIndex: 100,
      }}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(comment);
      }}
    >
      <div className="ds-comment-marker-icon">
        {hasUnread && <span className="ds-comment-marker-badge" />}
        <svg width="28" height="28" viewBox="0 0 28 28">
          <path
            d="M14 2C7.373 2 2 6.925 2 13c0 3.314 1.678 6.266 4.308 8.195L4 26l5.5-3.5C10.955 22.82 12.442 23 14 23c6.627 0 12-4.477 12-10S20.627 2 14 2z"
            fill={comment.resolved ? 'var(--text-muted)' : 'var(--accent)'}
          />
        </svg>
        {(comment.commentCount || 0) > 1 && (
          <span className="ds-comment-marker-count">
            {comment.commentCount}
          </span>
        )}
      </div>
    </div>
  );
}

// Comment thread popup
export function CommentThread({
  comment,
  currentUser,
  onClose,
  onAddReply,
  onResolve,
  onDelete,
  position,
  canComment = true,
  canDeleteAny = false,
}) {
  const [replyText, setReplyText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const threadRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (threadRef.current && !threadRef.current.contains(e.target)) {
        onClose?.();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onAddReply?.(comment.id, replyText.trim());
      setReplyText('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const allMessages = [
    { ...comment, id: comment.commentId ?? comment.id, isOriginal: true },
    ...(comment.replies || []).map(r => ({ ...r, isOriginal: false })),
  ];

  return (
    <div
      ref={threadRef}
      className="ds-comment-thread"
      style={{
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 200,
      }}
    >
      {/* Header */}
      <div className="ds-comment-thread-header">
        <span className="ds-comment-thread-title">
          {comment.detached ? 'Detached comment' : comment.elementId ? 'Comment on element' : 'Canvas comment'}
        </span>
        <div className="ds-comment-thread-actions">
          {!canComment ? null : !comment.resolved ? (
            <button
              className="ds-comment-resolve-btn"
              onClick={() => onResolve?.(comment.id, true)}
              title="Resolve"
            >
              <CheckIcon />
            </button>
          ) : (
            <button
              className="ds-comment-resolve-btn resolved"
              onClick={() => onResolve?.(comment.id, false)}
              title="Reopen"
            >
              <RefreshIcon />
            </button>
          )}
          <button
            className="ds-comment-close-btn"
            onClick={onClose}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="ds-comment-thread-messages">
        {allMessages.map((msg, idx) => (
          <div
            key={msg.id || idx}
            className={`ds-comment-message ${msg.isOriginal ? 'original' : 'reply'}`}
          >
            <div className="ds-comment-message-header">
              <div className="ds-comment-avatar">
                {msg.user?.image ? (
                  <img src={msg.user.image} alt={msg.user.name} />
                ) : (
                  <span>{msg.user?.name?.[0]?.toUpperCase() || 'U'}</span>
                )}
              </div>
              <div className="ds-comment-meta">
                <span className="ds-comment-author">{msg.user?.name || 'Unknown'}</span>
                <span className="ds-comment-time">
                  {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                </span>
              </div>
              {!msg.deleted && !msg.pending && (canDeleteAny || (msg.user?.id && msg.user.id === currentUser?.id)) && (
                <button
                  className="ds-comment-delete-btn"
                  onClick={() => onDelete?.(comment.id, msg.id)}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
            {/* Plain text only: React escapes it; never dangerouslySetInnerHTML (ADR-0002 decision 10). */}
            <div className="ds-comment-message-body" style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              {msg.deleted ? <em>Comment deleted</em> : msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      {canComment && (
        <form className="ds-comment-reply-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            maxLength={10000}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={comment.resolved ? 'Reply to reopen...' : 'Reply...'}
            disabled={isSubmitting}
          />
          <button
            type="submit"
            disabled={!replyText.trim() || isSubmitting}
            title="Send reply"
          >
            <SendIcon />
          </button>
        </form>
      )}

      <style jsx>{`
        .ds-comment-thread {
          width: 320px;
          background: var(--ds-surface-floating, var(--panel));
          backdrop-filter: blur(16px);
          border-radius: 12px;
          box-shadow: var(--ds-shadow-floating, 0 16px 48px rgba(0,0,0,0.15));
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .ds-comment-thread-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
          background: var(--bg);
        }

        .ds-comment-thread-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .ds-comment-thread-actions {
          display: flex;
          gap: 4px;
        }

        .ds-comment-resolve-btn,
        .ds-comment-close-btn,
        .ds-comment-delete-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-comment-resolve-btn:hover {
          background: var(--success-soft);
          color: var(--success);
        }

        .ds-comment-resolve-btn.resolved {
          color: var(--success);
        }

        .ds-comment-close-btn:hover,
        .ds-comment-delete-btn:hover {
          background: var(--error-soft);
          color: var(--error);
        }

        .ds-comment-thread-messages {
          max-height: 300px;
          overflow-y: auto;
          padding: 12px;
        }

        .ds-comment-message {
          margin-bottom: 12px;
        }

        .ds-comment-message:last-child {
          margin-bottom: 0;
        }

        .ds-comment-message.reply {
          padding-left: 16px;
          border-left: 2px solid var(--border);
        }

        .ds-comment-message-header {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 6px;
        }

        .ds-comment-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .ds-comment-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ds-comment-avatar span {
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .ds-comment-meta {
          flex: 1;
          min-width: 0;
        }

        .ds-comment-author {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        .ds-comment-time {
          font-size: 11px;
          color: var(--text-muted);
        }

        .ds-comment-message-body {
          font-size: 13px;
          color: var(--text);
          line-height: 1.5;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .ds-comment-reply-form {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-top: 1px solid var(--border);
          background: var(--bg);
        }

        .ds-comment-reply-form input {
          flex: 1;
          padding: 8px 12px;
          font-size: 13px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--panel);
          color: var(--text);
          outline: none;
        }

        .ds-comment-reply-form input:focus {
          border-color: var(--accent);
        }

        .ds-comment-reply-form button {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: var(--accent);
          color: white;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-comment-reply-form button:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        .ds-comment-reply-form button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}

// New comment input popup
export function NewCommentInput({
  position,
  currentUser,
  onSubmit,
  onCancel,
  error = null,
}) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  // Focus again after the originating mousedown finishes: the canvas's default focus
  // handling would otherwise steal it and typing would fire single-key shortcuts.
  useEffect(() => {
    inputRef.current?.focus();
    const raf = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, []);

  // Delay adding click-outside handler to prevent the initial click from closing the popup
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel?.();
      }
    };
    // Use setTimeout to skip the initial click event that opened this popup
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onCancel]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit?.(text.trim());
    } finally {
      setIsSubmitting(false);
    }
  };

  // Use portal to render at body level to avoid positioning issues
  const content = (
    <div
      ref={containerRef}
      className="ds-new-comment-input"
      data-suspend-shortcuts=""
      style={{
        position: 'fixed',
        left: position.x + 52, // Account for ShapeSidebar width (--ds-icon-bar-width: 52px)
        top: position.y + 48, // Account for TitleBar height
        zIndex: 10000,
      }}
    >
      <div className="ds-new-comment-header">
        <div className="ds-comment-avatar">
          {currentUser?.image ? (
            <img src={currentUser.image} alt={currentUser.name} />
          ) : (
            <span>{currentUser?.name?.[0]?.toUpperCase() || 'U'}</span>
          )}
        </div>
        <span className="ds-new-comment-label">Add comment</span>
      </div>
      <form onSubmit={handleSubmit}>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Write a comment..."
          rows={3}
          maxLength={10000}
          disabled={isSubmitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
            if (e.key === 'Escape') {
              onCancel?.();
            }
          }}
        />
        {error && <div role="alert" className="ds-comment-error">{error}</div>}
        <div className="ds-new-comment-actions">
          <button type="button" onClick={onCancel} className="cancel">
            Cancel
          </button>
          <button type="submit" disabled={!text.trim() || isSubmitting}>
            Comment
          </button>
        </div>
      </form>

      <style jsx>{`
        .ds-new-comment-input {
          width: 300px;
          background: var(--ds-surface-floating, var(--panel));
          backdrop-filter: blur(16px);
          border-radius: 12px;
          box-shadow: var(--ds-shadow-floating, 0 16px 48px rgba(0,0,0,0.15));
          border: 1px solid var(--border);
          overflow: hidden;
        }

        .ds-new-comment-header {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border);
        }

        .ds-comment-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent);
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .ds-comment-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ds-comment-avatar span {
          font-size: 12px;
          font-weight: 600;
          color: white;
        }

        .ds-new-comment-label {
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
        }

        form {
          padding: 12px;
        }

        textarea {
          width: 100%;
          padding: 10px 12px;
          font-size: 13px;
          font-family: inherit;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          resize: none;
          outline: none;
        }

        textarea:focus {
          border-color: var(--accent);
        }

        .ds-new-comment-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 10px;
        }

        button {
          padding: 8px 16px;
          font-size: 13px;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        button.cancel {
          background: transparent;
          color: var(--text-muted);
        }

        button.cancel:hover {
          background: var(--bg);
          color: var(--text);
        }

        button[type="submit"] {
          background: var(--accent);
          color: white;
        }

        button[type="submit"]:hover:not(:disabled) {
          background: var(--accent-hover);
        }

        button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );

  // Use portal to render at document body level for proper positioning
  return createPortal(content, document.body);
}

// Icons
function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M14 8A6 6 0 1 1 8 2M14 2v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M12 4L4 12M4 4l8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M2 4h10M5 4V2.5A.5.5 0 0 1 5.5 2h3a.5.5 0 0 1 .5.5V4M11 4v8a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M16 2L8 10M16 2l-5 14-3-6-6-3 14-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const floatingBase = {
  position: 'absolute',
  zIndex: 150,
  background: 'var(--ds-surface-floating, var(--panel))',
  border: '1px solid var(--border)',
  borderRadius: 12,
  boxShadow: 'var(--ds-shadow-floating, 0 16px 48px rgba(0,0,0,0.15))',
  color: 'var(--text)',
  fontSize: 13,
};

// "Detached" group (Q-C3): threads whose element was removed. They stay open and are never auto-resolved; a
// restore that brings the element back moves them out of this list again (anchor state is derived at read time).
export function DetachedComments({ comments, onSelect, activeId }) {
  const [open, setOpen] = useState(false);
  if (!comments || comments.length === 0) return null;
  return (
    <div className="ds-comment-detached" data-testid="detached-comments" style={{ ...floatingBase, left: 16, bottom: 16, maxWidth: 320 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ all: 'unset', cursor: 'pointer', padding: '8px 12px', display: 'block', fontWeight: 600 }}
      >
        Detached comments ({comments.length})
      </button>
      {open && (
        <ul style={{ listStyle: 'none', margin: 0, padding: '0 8px 8px', maxHeight: 240, overflowY: 'auto' }}>
          {comments.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onSelect?.(c)}
                style={{
                  all: 'unset', cursor: 'pointer', display: 'block', width: 'calc(100% - 16px)', padding: '6px 8px', borderRadius: 8,
                  background: activeId === c.id ? 'var(--bg)' : 'transparent',
                }}
              >
                <span style={{ fontWeight: 600 }}>{c.user?.name || 'Unknown'}</span>
                <span style={{ display: 'block', opacity: 0.75, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.deleted ? 'Comment deleted' : c.text}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// One-time import prompt for browser-only comments (Q-C1).
export function LegacyImportPrompt({ count, importing, notice, onImport, onDiscard }) {
  if (!count) return null;
  return (
    <div className="ds-comment-import" role="region" aria-label="Import local comments" style={{ ...floatingBase, left: '50%', top: 16, transform: 'translateX(-50%)', padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center' }}>
      <span>{notice || `${count} comment${count === 1 ? '' : 's'} saved only in this browser. Import ${count === 1 ? 'it' : 'them'} to this diagram?`}</span>
      <button type="button" onClick={onImport} disabled={importing}>{importing ? 'Importing...' : (notice ? 'Continue' : 'Import')}</button>
      <button type="button" onClick={onDiscard} disabled={importing}>Discard</button>
    </div>
  );
}

// Errors from comment mutations (the optimistic change has already been rolled back).
export function CommentErrorBanner({ error, onDismiss }) {
  if (!error) return null;
  return (
    <div className="ds-comment-error-banner" role="alert" style={{ ...floatingBase, right: 16, bottom: 16, padding: '10px 14px', display: 'flex', gap: 10, alignItems: 'center', borderColor: 'var(--danger, #c0392b)' }}>
      <span>{error}</span>
      <button type="button" onClick={onDismiss} aria-label="Dismiss">Dismiss</button>
    </div>
  );
}

export { useComments };

export default { CommentMarker, CommentThread, NewCommentInput, useComments };

// Shown when the thread list hit the client paging cap (10 x 100).
export function TruncatedNotice({ truncated }) {
  if (!truncated) return null;
  return (
    <div className="ds-comment-truncated" role="status" style={{ ...floatingBase, left: '50%', bottom: 16, transform: 'translateX(-50%)', padding: '8px 14px' }}>
      Showing the first 1000 threads
    </div>
  );
}

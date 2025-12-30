// components/diagram-studio/ui/CommentSystem.js
// Comment system for canvas and elements

import { useState, useCallback, useRef, useEffect } from 'react';
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
      className={`ds-comment-marker ${isActive ? 'active' : ''} ${comment.resolved ? 'resolved' : ''}`}
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
        {comment.replies?.length > 0 && (
          <span className="ds-comment-marker-count">
            {comment.replies.length + 1}
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
    { ...comment, isOriginal: true },
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
          {comment.elementId ? 'Comment on element' : 'Canvas comment'}
        </span>
        <div className="ds-comment-thread-actions">
          {!comment.resolved ? (
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
              {msg.user?.id === currentUser?.id && (
                <button
                  className="ds-comment-delete-btn"
                  onClick={() => onDelete?.(comment.id, msg.isOriginal ? null : msg.id)}
                  title="Delete"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
            <div className="ds-comment-message-body">
              {msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* Reply Input */}
      {!comment.resolved && (
        <form className="ds-comment-reply-form" onSubmit={handleSubmit}>
          <input
            ref={inputRef}
            type="text"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply..."
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
}) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
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

// Hook for managing comments
export function useComments(diagramId) {
  const [comments, setComments] = useState([]);
  const [activeComment, setActiveComment] = useState(null);
  const [newCommentPosition, setNewCommentPosition] = useState(null);

  // Load comments (would normally fetch from API)
  useEffect(() => {
    if (diagramId) {
      // Load from localStorage for now
      const stored = localStorage.getItem(`comments-${diagramId}`);
      if (stored) {
        try {
          setComments(JSON.parse(stored));
        } catch (e) {
          // Invalid JSON
        }
      }
    }
  }, [diagramId]);

  // Save comments
  const saveComments = useCallback((newComments) => {
    setComments(newComments);
    if (diagramId) {
      localStorage.setItem(`comments-${diagramId}`, JSON.stringify(newComments));
    }
  }, [diagramId]);

  // Add a new comment
  const addComment = useCallback((text, x, y, elementId = null, user) => {
    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      x,
      y,
      elementId,
      user,
      resolved: false,
      read: true,
      createdAt: new Date().toISOString(),
      replies: [],
    };
    saveComments([...comments, newComment]);
    setNewCommentPosition(null);
    return newComment;
  }, [comments, saveComments]);

  // Add a reply to a comment
  const addReply = useCallback((commentId, text, user) => {
    const reply = {
      id: `reply_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      text,
      user,
      read: true,
      createdAt: new Date().toISOString(),
    };
    const updated = comments.map(c =>
      c.id === commentId
        ? { ...c, replies: [...(c.replies || []), reply] }
        : c
    );
    saveComments(updated);
  }, [comments, saveComments]);

  // Resolve/unresolve a comment
  const resolveComment = useCallback((commentId, resolved) => {
    const updated = comments.map(c =>
      c.id === commentId ? { ...c, resolved } : c
    );
    saveComments(updated);
  }, [comments, saveComments]);

  // Delete a comment or reply
  const deleteComment = useCallback((commentId, replyId = null) => {
    if (replyId) {
      const updated = comments.map(c =>
        c.id === commentId
          ? { ...c, replies: c.replies.filter(r => r.id !== replyId) }
          : c
      );
      saveComments(updated);
    } else {
      saveComments(comments.filter(c => c.id !== commentId));
      if (activeComment?.id === commentId) {
        setActiveComment(null);
      }
    }
  }, [comments, activeComment, saveComments]);

  // Start adding a new comment at position
  const startNewComment = useCallback((x, y, elementId = null) => {
    console.log('[Comment Debug] startNewComment called with x:', x, 'y:', y, 'elementId:', elementId);
    setNewCommentPosition({ x, y, elementId });
    setActiveComment(null);
  }, []);

  // Cancel new comment
  const cancelNewComment = useCallback(() => {
    setNewCommentPosition(null);
  }, []);

  return {
    comments,
    activeComment,
    setActiveComment,
    newCommentPosition,
    addComment,
    addReply,
    resolveComment,
    deleteComment,
    startNewComment,
    cancelNewComment,
  };
}

export default { CommentMarker, CommentThread, NewCommentInput, useComments };

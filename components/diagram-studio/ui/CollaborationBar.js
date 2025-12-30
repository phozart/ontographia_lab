// components/diagram-studio/ui/CollaborationBar.js
// Top-right collaboration controls - share, users, etc.

import { useState, useRef, useEffect } from 'react';

// MUI Icons
import ShareIcon from '@mui/icons-material/Share';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import EmailIcon from '@mui/icons-material/Email';
import CheckIcon from '@mui/icons-material/Check';

export default function CollaborationBar({
  currentUser,
  collaborators = [],
  onShare,
  onInvite,
  diagramId,
}) {
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const shareMenuRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleCopyLink = async () => {
    const link = window.location.href;
    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

  // Get initials from name
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get avatar color based on name
  const getAvatarColor = (name, index = 0) => {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    if (!name) return colors[index % colors.length];
    const hash = name.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="ds-collab-bar">
      {/* Collaborator Avatars */}
      {collaborators.length > 0 && (
        <div className="ds-collab-avatars">
          {collaborators.slice(0, 3).map((user, index) => (
            <div
              key={user.id || index}
              className="ds-collab-avatar"
              style={{ backgroundColor: getAvatarColor(user.name, index) }}
              title={user.name || 'Collaborator'}
            >
              {user.image ? (
                <img src={user.image} alt={user.name} />
              ) : (
                getInitials(user.name)
              )}
            </div>
          ))}
          {collaborators.length > 3 && (
            <div className="ds-collab-avatar ds-collab-more">
              +{collaborators.length - 3}
            </div>
          )}
        </div>
      )}

      {/* Current User Avatar */}
      {currentUser && (
        <div
          className="ds-collab-avatar ds-collab-current"
          style={{ backgroundColor: getAvatarColor(currentUser.name) }}
          title={`${currentUser.name} (you)`}
        >
          {currentUser.image ? (
            <img src={currentUser.image} alt={currentUser.name} />
          ) : (
            getInitials(currentUser.name)
          )}
        </div>
      )}

      {/* Share Button */}
      <div className="ds-collab-share" ref={shareMenuRef}>
        <button
          className="ds-collab-share-btn"
          onClick={() => setShowShareMenu(!showShareMenu)}
        >
          <ShareIcon style={{ fontSize: 16 }} />
          <span>Share</span>
        </button>

        {showShareMenu && (
          <div className="ds-share-menu">
            <div className="ds-share-header">
              <span>Share diagram</span>
            </div>

            <div className="ds-share-content">
              {/* Copy Link */}
              <button
                className="ds-share-option"
                onClick={handleCopyLink}
              >
                {linkCopied ? (
                  <CheckIcon style={{ fontSize: 18, color: '#10b981' }} />
                ) : (
                  <LinkIcon style={{ fontSize: 18 }} />
                )}
                <span>{linkCopied ? 'Link copied!' : 'Copy link'}</span>
              </button>

              {/* Invite by Email */}
              <button
                className="ds-share-option"
                onClick={() => { onInvite?.(); setShowShareMenu(false); }}
              >
                <EmailIcon style={{ fontSize: 18 }} />
                <span>Invite by email</span>
              </button>

              {/* Add Collaborator */}
              <button
                className="ds-share-option"
                onClick={() => { onShare?.(); setShowShareMenu(false); }}
              >
                <PersonAddIcon style={{ fontSize: 18 }} />
                <span>Add collaborator</span>
              </button>
            </div>

            <div className="ds-share-footer">
              <span className="ds-share-access">
                Anyone with the link can view
              </span>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .ds-collab-bar {
          position: fixed;
          top: 12px;
          right: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 4px 6px;
          z-index: 200;
        }

        .ds-collab-avatars {
          display: flex;
          align-items: center;
        }

        .ds-collab-avatar {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          font-weight: 600;
          color: white;
          border: 2px solid white;
          margin-left: -8px;
          overflow: hidden;
        }

        .ds-collab-avatar:first-child {
          margin-left: 0;
        }

        .ds-collab-avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ds-collab-more {
          background: var(--text-muted, #6b7280);
          font-size: 10px;
        }

        .ds-collab-current {
          margin-left: 4px;
          border-color: var(--ds-active-color, #0e74a3);
        }

        .ds-collab-share {
          position: relative;
        }

        .ds-collab-share-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border: none;
          border-radius: 6px;
          background: var(--ds-active-color, #0e74a3);
          color: white;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-collab-share-btn:hover {
          background: #0a5f85;
        }

        .ds-share-menu {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          width: 260px;
          background: white;
          border-radius: 12px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04));
          overflow: hidden;
          animation: menuFadeIn 0.15s ease-out;
        }

        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ds-share-header {
          padding: 12px 16px;
          border-bottom: 1px solid rgba(0, 0, 0, 0.06);
          font-size: 14px;
          font-weight: 600;
          color: var(--text, #1f2937);
        }

        .ds-share-content {
          padding: 8px;
        }

        .ds-share-option {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .ds-share-option:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-share-footer {
          padding: 10px 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.06);
          background: var(--bg, #f9fafb);
        }

        .ds-share-access {
          font-size: 12px;
          color: var(--text-muted, #6b7280);
        }
      `}</style>
    </div>
  );
}

// components/diagram-studio/ui/KeyboardShortcutsOverlay.js
// Full-screen keyboard shortcuts overlay - appears on '?' key press

import { createPortal } from 'react-dom';
import { useEffect, useCallback, useState } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import { SHORTCUT_GROUPS, displayKey } from './shortcutKeymap';
import { isMac } from '../../../lib/platform';
import { shouldHandleShortcut } from '../hooks/interaction/keyboardFocus';

const MAC = isMac();

export default function KeyboardShortcutsOverlay({ isOpen, onClose }) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose?.();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Handle click outside to close
  const handleOverlayClick = useCallback((e) => {
    if (e.target === e.currentTarget) {
      onClose?.();
    }
  }, [onClose]);

  if (!isOpen) return null;

  const content = (
    <div className="keyboard-shortcuts-overlay" onClick={handleOverlayClick}>
      <div className="keyboard-shortcuts-modal" role="dialog" aria-modal="true" aria-label="Keyboard shortcuts">
        {/* Header */}
        <div className="keyboard-shortcuts-header">
          <div className="keyboard-shortcuts-title">
            <KeyboardIcon style={{ fontSize: 24 }} />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button
            className="keyboard-shortcuts-close"
            onClick={onClose}
            aria-label="Close shortcuts overlay"
          >
            <CloseIcon style={{ fontSize: 20 }} />
          </button>
        </div>

        {/* Shortcuts Grid */}
        <div className="keyboard-shortcuts-content">
          <div className="keyboard-shortcuts-grid">
            {SHORTCUT_GROUPS.map((group) => (
              <div key={group.name} className="keyboard-shortcuts-group">
                <h3 className="keyboard-shortcuts-group-title">{group.name}</h3>
                <div className="keyboard-shortcuts-list">
                  {group.shortcuts.map((shortcut, idx) => (
                    <div key={idx} className="keyboard-shortcut-item">
                      <kbd className="keyboard-shortcut-key">{shortcut.keys.map((k) => displayKey(k, MAC)).join(' + ')}</kbd>
                      <span className="keyboard-shortcut-description">
                        {shortcut.description}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="keyboard-shortcuts-footer">
          <span>Press <kbd>?</kbd> or <kbd>Esc</kbd> to close</span>
        </div>
      </div>

      <style jsx>{`
        .keyboard-shortcuts-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(var(--ds-blur, 8px));
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10100;
          padding: 24px;
          animation: fadeIn 0.2s ease-out;
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        .keyboard-shortcuts-modal {
          width: 100%;
          max-width: 720px;
          max-height: calc(100vh - 48px);
          background: var(--ds-surface-floating, #ffffff);
          border-radius: var(--ds-radius-xl, 24px);
          box-shadow: var(--ds-shadow-floating, 0 16px 48px rgba(0, 0, 0, 0.12));
          display: flex;
          flex-direction: column;
          overflow: hidden;
          animation: slideUp 0.25s var(--ds-spring, cubic-bezier(0.34, 1.56, 0.64, 1));
        }

        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        .keyboard-shortcuts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border, rgba(0, 0, 0, 0.08));
        }

        .keyboard-shortcuts-title {
          display: flex;
          align-items: center;
          gap: 12px;
          color: var(--text, #1a1a2e);
        }

        .keyboard-shortcuts-title h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }

        .keyboard-shortcuts-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: var(--ds-radius-sm, 8px);
          background: transparent;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          transition: all var(--ds-ease-in-out, 0.2s ease);
        }

        .keyboard-shortcuts-close:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1a1a2e);
        }

        .keyboard-shortcuts-content {
          flex: 1;
          overflow: auto;
          padding: 24px;
        }

        .keyboard-shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }

        @media (max-width: 700px) {
          .keyboard-shortcuts-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }

        @media (max-width: 400px) {
          .keyboard-shortcuts-grid {
            grid-template-columns: 1fr;
          }
        }

        .keyboard-shortcuts-group {
          min-width: 0;
        }

        .keyboard-shortcuts-group-title {
          font-size: 11px;
          font-weight: 700;
          color: var(--ds-active-color, #0e74a3);
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin: 0 0 12px 0;
        }

        .keyboard-shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .keyboard-shortcut-item {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 4px 10px;
        }

        .keyboard-shortcut-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 28px;
          height: 28px;
          padding: 0 8px;
          font-family: var(--ds-font-mono, 'SF Mono', Consolas, monospace);
          font-size: 11px;
          font-weight: 500;
          color: var(--text, #1a1a2e);
          background: var(--bg, #f8fafc);
          border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
          border-radius: 6px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .keyboard-shortcut-description {
          flex: 1 1 96px;
          min-width: 0;
          overflow-wrap: anywhere;
          font-size: 13px;
          color: var(--text-muted, #64748b);
        }

        .keyboard-shortcuts-footer {
          padding: 14px 24px;
          border-top: 1px solid var(--border, rgba(0, 0, 0, 0.08));
          text-align: center;
          font-size: 12px;
          color: var(--text-muted, #64748b);
        }

        .keyboard-shortcuts-footer kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          font-family: var(--ds-font-mono, 'SF Mono', Consolas, monospace);
          font-size: 10px;
          font-weight: 500;
          color: var(--text-muted, #64748b);
          background: var(--bg, #f8fafc);
          border: 1px solid var(--border, rgba(0, 0, 0, 0.1));
          border-radius: 4px;
          margin: 0 3px;
        }
      `}</style>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(content, document.body) : content;
}

// Hook to manage keyboard shortcuts overlay state
export function useKeyboardShortcutsOverlay() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((prev) => !prev), []);

  // Listen for '?' key (Shift + /)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // '?' toggles the sheet only when it is not being typed (single focus rule); the open sheet itself may close it
      if (!shouldHandleShortcut(e, { activeElement: document.activeElement }) ) return;

      // Check for '?' key (Shift + / on most keyboards)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        toggle();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return { isOpen, open, close, toggle };
}

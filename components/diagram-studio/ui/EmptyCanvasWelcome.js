// components/diagram-studio/ui/EmptyCanvasWelcome.js
// Empty canvas onboarding/welcome component
// Shows when canvas has no elements, provides quick actions for getting started

import { useState, useEffect, useCallback } from 'react';
import {
  CategoryOutlined,
  DescriptionOutlined,
  CloseOutlined,
  KeyboardOutlined,
} from '@mui/icons-material';

const STORAGE_KEY = 'ontographia-welcome-dismissed';

export default function EmptyCanvasWelcome({
  onAddShapes,
  onUseTemplate,
  onShowShortcuts,
  visible = true,
}) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(STORAGE_KEY);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, []);

  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, 'true');
    }
  }, []);

  // Don't render if not visible or dismissed
  if (!visible || isDismissed) {
    return null;
  }

  return (
    <div className="ds-empty-canvas-welcome">
      {/* Dismiss button */}
      <button
        className="ds-welcome-dismiss"
        onClick={handleDismiss}
        title="Dismiss"
        aria-label="Dismiss welcome message"
      >
        <CloseOutlined style={{ fontSize: 18 }} />
      </button>

      {/* Welcome heading */}
      <h2 className="ds-welcome-title">Welcome to your diagram</h2>

      {/* Quick action buttons */}
      <div className="ds-welcome-actions">
        <button
          className="ds-welcome-action-btn primary"
          onClick={onAddShapes}
        >
          <CategoryOutlined style={{ fontSize: 20 }} />
          <span>Add shapes</span>
        </button>
        <button
          className="ds-welcome-action-btn"
          onClick={onUseTemplate}
        >
          <DescriptionOutlined style={{ fontSize: 20 }} />
          <span>Use template</span>
        </button>
      </div>

      {/* Quick tips */}
      <div className="ds-welcome-tips">
        <h3 className="ds-tips-heading">Quick tips</h3>
        <ul className="ds-tips-list">
          <li>Drag stencils from left panel</li>
          <li>Press <kbd>V</kbd> for select, <kbd>C</kbd> for connect</li>
          <li>Double-click to edit text</li>
          <li>
            Press <kbd>?</kbd> for{' '}
            <button
              className="ds-tips-link"
              onClick={onShowShortcuts}
            >
              keyboard shortcuts
            </button>
          </li>
        </ul>
      </div>

      <style jsx>{`
        .ds-empty-canvas-welcome {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          background: var(--ds-surface-floating, rgba(255, 255, 255, 0.98));
          backdrop-filter: blur(var(--ds-blur, 16px));
          border-radius: var(--ds-radius-xl, 24px);
          box-shadow: var(--ds-shadow-elevated, 0 8px 24px rgba(0, 0, 0, 0.08));
          border: 1px solid rgba(0, 0, 0, 0.06);
          padding: 32px 40px;
          max-width: 400px;
          text-align: center;
          z-index: var(--ds-z-overlay, 300);
          animation: welcomeFadeIn 0.3s ease-out;
        }

        @keyframes welcomeFadeIn {
          from {
            opacity: 0;
            transform: translate(-50%, -50%) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%) scale(1);
          }
        }

        .ds-welcome-dismiss {
          position: absolute;
          top: 12px;
          right: 12px;
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: transparent;
          border: none;
          border-radius: var(--ds-radius-sm, 8px);
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-welcome-dismiss:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-welcome-title {
          margin: 0 0 24px 0;
          font-size: 20px;
          font-weight: 600;
          color: var(--text, #1f2937);
          letter-spacing: -0.01em;
        }

        .ds-welcome-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 28px;
        }

        .ds-welcome-action-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 12px 20px;
          background: var(--bg, #f9fafb);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: var(--ds-radius-md, 12px);
          color: var(--text, #1f2937);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .ds-welcome-action-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          border-color: var(--border-hover, #d1d5db);
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .ds-welcome-action-btn.primary {
          background: var(--ds-accent-gradient, linear-gradient(135deg, #0e74a3 0%, #0284c7 100%));
          border-color: transparent;
          color: white;
        }

        .ds-welcome-action-btn.primary:hover {
          background: var(--ds-accent-gradient-hover, linear-gradient(135deg, #0a5f85 0%, #0369a1 100%));
          box-shadow: var(--ds-accent-glow, 0 4px 20px rgba(14, 116, 163, 0.35));
        }

        .ds-welcome-tips {
          text-align: left;
          padding-top: 20px;
          border-top: 1px solid var(--border, #e5e7eb);
        }

        .ds-tips-heading {
          margin: 0 0 12px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .ds-tips-list {
          margin: 0;
          padding: 0 0 0 20px;
          list-style-type: disc;
        }

        .ds-tips-list li {
          margin-bottom: 8px;
          font-size: 13px;
          color: var(--text-secondary, #4b5563);
          line-height: 1.5;
        }

        .ds-tips-list li:last-child {
          margin-bottom: 0;
        }

        .ds-tips-list kbd {
          display: inline-block;
          padding: 2px 6px;
          font-size: 11px;
          font-family: var(--ds-font-mono, 'JetBrains Mono', monospace);
          background: var(--bg, #f9fafb);
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 4px;
          color: var(--text, #1f2937);
          box-shadow: 0 1px 0 rgba(0, 0, 0, 0.05);
        }

        .ds-tips-link {
          background: none;
          border: none;
          padding: 0;
          font-size: inherit;
          color: var(--ds-active-color, #0e74a3);
          text-decoration: underline;
          text-decoration-style: dotted;
          text-underline-offset: 2px;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .ds-tips-link:hover {
          color: var(--accent-hover, #0a5f85);
        }

        /* Dark mode support */
        [data-theme="dark"] .ds-empty-canvas-welcome {
          background: var(--ds-surface-floating, rgba(26, 26, 50, 0.98));
          border-color: rgba(255, 255, 255, 0.1);
        }
      `}</style>
    </div>
  );
}

// Hook for resetting the welcome state (useful for testing or user preference)
export function useResetWelcome() {
  return useCallback(() => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);
}

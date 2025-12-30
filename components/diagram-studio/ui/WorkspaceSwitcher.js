// components/diagram-studio/ui/WorkspaceSwitcher.js
// Quick workspace/diagram switcher dropdown

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

// MUI Icons
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import DashboardIcon from '@mui/icons-material/Dashboard';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DescriptionIcon from '@mui/icons-material/Description';

export default function WorkspaceSwitcher({ currentDiagramId, currentDiagramName }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [recentDiagrams, setRecentDiagrams] = useState([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef(null);

  // Fetch recent diagrams when dropdown opens
  useEffect(() => {
    if (isOpen && recentDiagrams.length === 0) {
      fetchRecentDiagrams();
    }
  }, [isOpen]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Alt+W to toggle workspace switcher
      if (e.altKey && e.key === 'w') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (isOpen && e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const fetchRecentDiagrams = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/diagrams?limit=5');
      if (response.ok) {
        const data = await response.json();
        // Filter out current diagram
        setRecentDiagrams(
          (data.diagrams || data || [])
            .filter(d => d.id !== currentDiagramId)
            .slice(0, 5)
        );
      }
    } catch (error) {
      console.error('Failed to fetch recent diagrams:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNew = useCallback(async () => {
    setIsOpen(false);
    try {
      const response = await fetch('/api/diagrams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Untitled Workspace',
          type: 'infinite-canvas',
          content: { elements: [], connections: [] }
        }),
      });
      if (response.ok) {
        const newDiagram = await response.json();
        router.push(`/diagram/${newDiagram.short_id || newDiagram.id}`);
      }
    } catch (error) {
      console.error('Failed to create diagram:', error);
    }
  }, [router]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return date.toLocaleDateString();
  };

  return (
    <div ref={dropdownRef} className="ds-workspace-switcher">
      {/* Trigger Button */}
      <button
        className="ds-workspace-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Switch workspace (Alt+W)"
      >
        <FolderIcon fontSize="small" />
        <span className="ds-workspace-name">
          {currentDiagramName || 'Untitled'}
        </span>
        <KeyboardArrowDownIcon
          fontSize="small"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s ease'
          }}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="ds-workspace-dropdown">
          {/* Current Workspace Header */}
          <div className="ds-workspace-section">
            <div className="ds-workspace-section-title">Current</div>
            <div className="ds-workspace-current">
              <DescriptionIcon fontSize="small" />
              <span>{currentDiagramName || 'Untitled'}</span>
            </div>
          </div>

          {/* Recent Diagrams */}
          <div className="ds-workspace-section">
            <div className="ds-workspace-section-title">
              <HistoryIcon fontSize="small" style={{ fontSize: 14 }} />
              Recent
            </div>
            {loading ? (
              <div className="ds-workspace-loading">Loading...</div>
            ) : recentDiagrams.length > 0 ? (
              <div className="ds-workspace-list">
                {recentDiagrams.map(diagram => (
                  <Link
                    key={diagram.id}
                    href={`/diagram/${diagram.short_id || diagram.id}`}
                    className="ds-workspace-item"
                    onClick={() => setIsOpen(false)}
                  >
                    <DescriptionIcon fontSize="small" />
                    <div className="ds-workspace-item-content">
                      <span className="ds-workspace-item-name">
                        {diagram.name || 'Untitled'}
                      </span>
                      <span className="ds-workspace-item-date">
                        {formatDate(diagram.updatedAt || diagram.createdAt)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="ds-workspace-empty">No recent diagrams</div>
            )}
          </div>

          {/* Actions */}
          <div className="ds-workspace-actions">
            <button className="ds-workspace-action" onClick={handleCreateNew}>
              <AddIcon fontSize="small" />
              <span>New Workspace</span>
            </button>
            <Link
              href="/dashboard"
              className="ds-workspace-action"
              onClick={() => setIsOpen(false)}
            >
              <DashboardIcon fontSize="small" />
              <span>View All Diagrams</span>
            </Link>
          </div>
        </div>
      )}

      <style jsx>{`
        .ds-workspace-switcher {
          position: relative;
        }

        .ds-workspace-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 12px;
          background: var(--ds-surface-floating, rgba(255, 255, 255, 0.95));
          border: 1px solid var(--border);
          border-radius: 8px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
          transition: all 0.15s ease;
          max-width: 200px;
        }

        .ds-workspace-trigger:hover {
          background: var(--accent-soft);
          border-color: var(--accent);
        }

        .ds-workspace-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 120px;
        }

        .ds-workspace-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 280px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
          overflow: hidden;
          z-index: 200;
        }

        .ds-workspace-section {
          padding: 12px;
          border-bottom: 1px solid var(--border);
        }

        .ds-workspace-section:last-child {
          border-bottom: none;
        }

        .ds-workspace-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 8px;
        }

        .ds-workspace-current {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          background: var(--accent-soft);
          border-radius: 8px;
          color: var(--accent);
          font-weight: 500;
          font-size: 13px;
        }

        .ds-workspace-list {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .ds-workspace-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          color: var(--text);
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .ds-workspace-item:hover {
          background: var(--bg);
        }

        .ds-workspace-item-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-width: 0;
        }

        .ds-workspace-item-name {
          font-size: 13px;
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .ds-workspace-item-date {
          font-size: 11px;
          color: var(--text-muted);
        }

        .ds-workspace-loading,
        .ds-workspace-empty {
          padding: 12px;
          text-align: center;
          color: var(--text-muted);
          font-size: 12px;
        }

        .ds-workspace-actions {
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          background: var(--bg);
        }

        .ds-workspace-action {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          cursor: pointer;
          text-decoration: none;
          transition: background 0.15s ease;
        }

        .ds-workspace-action:hover {
          background: var(--accent-soft);
          color: var(--accent);
        }
      `}</style>
    </div>
  );
}

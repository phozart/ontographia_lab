// components/diagram-studio/ui/TopBar.js
// Fixed top bar with tools and navigation

import { useCallback, useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useDiagram, useDiagramHistory, useDiagramViewport } from '../DiagramContext';

// Icons
import NearMeIcon from '@mui/icons-material/NearMe';
import TimelineIcon from '@mui/icons-material/Timeline';
import PanToolIcon from '@mui/icons-material/PanTool';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardIcon from '@mui/icons-material/Keyboard';

// Grid style icons
const GridDotsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
    <circle cx="4" cy="4" r="1.5" />
    <circle cx="10" cy="4" r="1.5" />
    <circle cx="16" cy="4" r="1.5" />
    <circle cx="4" cy="10" r="1.5" />
    <circle cx="10" cy="10" r="1.5" />
    <circle cx="16" cy="10" r="1.5" />
    <circle cx="4" cy="16" r="1.5" />
    <circle cx="10" cy="16" r="1.5" />
    <circle cx="16" cy="16" r="1.5" />
  </svg>
);

const GridLinesIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none">
    <line x1="0" y1="5" x2="20" y2="5" />
    <line x1="0" y1="10" x2="20" y2="10" />
    <line x1="0" y1="15" x2="20" y2="15" />
    <line x1="5" y1="0" x2="5" y2="20" />
    <line x1="10" y1="0" x2="10" y2="20" />
    <line x1="15" y1="0" x2="15" y2="20" />
  </svg>
);

const GridNoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none">
    <rect x="2" y="2" width="16" height="16" rx="2" strokeDasharray="4 2" />
  </svg>
);

export default function TopBar({
  profile,
  diagramName,
  onOpenCommandPalette,
  onOpenShortcuts,
}) {
  const {
    diagram,
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    gridStyle,
    setGridStyle,
    saveStatus,
    saveDiagram,
  } = useDiagram();

  const { canUndo, canRedo, undo, redo } = useDiagramHistory();

  const [showGridMenu, setShowGridMenu] = useState(false);
  const gridMenuRef = useRef(null);

  const readOnly = profile?.editingPolicy?.readOnly;

  // Close grid menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Get current grid icon
  const getGridIcon = () => {
    if (!showGrid) return <GridOffIcon fontSize="small" />;
    switch (gridStyle) {
      case 'dots': return <GridDotsIcon />;
      case 'lines': return <GridLinesIcon />;
      default: return <GridNoneIcon />;
    }
  };

  const handleSave = useCallback(() => {
    saveDiagram(true);
  }, [saveDiagram]);

  return (
    <div className="ds-topbar">
      {/* Left Section: Logo + Document Name */}
      <div className="ds-topbar-left">
        <Link href="/dashboard" className="ds-topbar-logo" title="Back to Dashboard">
          <div className="ds-logo-icon">
            <span>O</span>
          </div>
        </Link>

        <span className="ds-breadcrumb-sep">/</span>

        <div className="ds-doc-title">
          <span className="ds-doc-name">{diagram?.name || diagramName || 'Untitled'}</span>
        </div>

        {/* Save Status */}
        <div className={`ds-save-status ${saveStatus.dirty ? 'dirty' : ''} ${saveStatus.saving ? 'saving' : ''}`}>
          <span className="ds-save-status-dot" />
          <span>{saveStatus.saving ? 'Saving...' : saveStatus.dirty ? 'Unsaved' : 'Saved'}</span>
        </div>
      </div>

      {/* Center Section: Tools */}
      <div className="ds-topbar-center">
        <div className="ds-tool-group">
          <button
            className={`ds-toolbar-btn ${activeTool === 'select' ? 'active' : ''}`}
            onClick={() => setActiveTool('select')}
            title="Select (V)"
          >
            <NearMeIcon fontSize="small" />
          </button>
          <button
            className={`ds-toolbar-btn ${activeTool === 'connect' ? 'active' : ''}`}
            onClick={() => setActiveTool('connect')}
            title="Connect (C)"
          >
            <TimelineIcon fontSize="small" />
          </button>
          <button
            className={`ds-toolbar-btn ${activeTool === 'pan' ? 'active' : ''}`}
            onClick={() => setActiveTool('pan')}
            title="Pan (Space)"
          >
            <PanToolIcon fontSize="small" />
          </button>
          <button
            className={`ds-toolbar-btn ${activeTool === 'comment' ? 'active' : ''}`}
            onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
            title="Comment (M)"
          >
            <ChatBubbleOutlineIcon fontSize="small" />
          </button>
        </div>

        <div className="ds-tool-divider" />

        {/* Undo/Redo */}
        {!readOnly && (
          <div className="ds-tool-group">
            <button
              className="ds-toolbar-btn"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon fontSize="small" />
            </button>
            <button
              className="ds-toolbar-btn"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon fontSize="small" />
            </button>
          </div>
        )}

        <div className="ds-tool-divider" />

        {/* Grid Style */}
        <div className="ds-grid-picker" ref={gridMenuRef}>
          <button
            className={`ds-toolbar-btn ${showGrid ? 'active' : ''}`}
            onClick={() => setShowGridMenu(!showGridMenu)}
            title="Grid style (G)"
          >
            {getGridIcon()}
          </button>
          {showGridMenu && (
            <div className="ds-grid-dropdown">
              <button
                className={`ds-grid-option ${showGrid && gridStyle === 'dots' ? 'active' : ''}`}
                onClick={() => { setShowGrid(true); setGridStyle('dots'); setShowGridMenu(false); }}
              >
                <GridDotsIcon /> Dots
              </button>
              <button
                className={`ds-grid-option ${showGrid && gridStyle === 'lines' ? 'active' : ''}`}
                onClick={() => { setShowGrid(true); setGridStyle('lines'); setShowGridMenu(false); }}
              >
                <GridLinesIcon /> Lines
              </button>
              <button
                className={`ds-grid-option ${!showGrid ? 'active' : ''}`}
                onClick={() => { setShowGrid(false); setShowGridMenu(false); }}
              >
                <GridNoneIcon /> None
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Right Section: Actions */}
      <div className="ds-topbar-right">
        <button
          className="ds-toolbar-btn"
          onClick={onOpenCommandPalette}
          title="Search (Cmd+K)"
        >
          <SearchIcon fontSize="small" />
        </button>

        <button
          className="ds-toolbar-btn"
          onClick={onOpenShortcuts}
          title="Keyboard Shortcuts (?)"
        >
          <KeyboardIcon fontSize="small" />
        </button>

        {!readOnly && (
          <button
            className={`ds-toolbar-btn ds-save-btn ${saveStatus.dirty ? 'dirty' : ''}`}
            onClick={handleSave}
            disabled={saveStatus.saving}
            title={saveStatus.dirty ? 'Save (Ctrl+S) - Unsaved changes' : 'Saved'}
          >
            <SaveIcon fontSize="small" />
            {saveStatus.dirty && <span className="ds-unsaved-indicator" />}
          </button>
        )}
      </div>

      <style jsx>{`
        .ds-topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          height: 48px;
          padding: 0 12px;
          background: var(--panel, #ffffff);
          border-bottom: 1px solid var(--border, #e2e8f0);
          flex-shrink: 0;
          gap: 12px;
        }

        .ds-topbar-left {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 0;
        }

        .ds-topbar-logo {
          display: flex;
          align-items: center;
          text-decoration: none;
          flex-shrink: 0;
        }

        .ds-logo-icon {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: linear-gradient(135deg, #0e74a3 0%, #0284c7 100%);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }

        .ds-logo-icon span {
          color: white;
          font-weight: 700;
          font-size: 14px;
        }

        .ds-topbar-logo:hover .ds-logo-icon {
          transform: scale(1.05);
          box-shadow: 0 2px 8px rgba(14, 116, 163, 0.4);
        }

        .ds-breadcrumb-sep {
          color: var(--text-muted, #64748b);
          opacity: 0.5;
        }

        .ds-doc-title {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .ds-doc-name {
          font-size: 15px;
          font-weight: 600;
          color: var(--text, #0f172a);
        }

        .ds-save-status {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted, #64748b);
        }

        .ds-save-status.dirty {
          color: var(--accent, #0e74a3);
        }

        .ds-save-status.saving {
          color: #f59e0b;
        }

        .ds-save-status-dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: currentColor;
        }

        .ds-topbar-center {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ds-tool-group {
          display: flex;
          align-items: center;
          gap: 2px;
          background: var(--bg, #f8fafc);
          border-radius: 8px;
          padding: 4px;
        }

        .ds-tool-divider {
          width: 1px;
          height: 24px;
          background: var(--border, #e2e8f0);
          margin: 0 8px;
        }

        .ds-toolbar-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #64748b);
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .ds-toolbar-btn:hover:not(:disabled) {
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }

        .ds-toolbar-btn.active {
          background: var(--accent, #0e74a3);
          color: white;
        }

        .ds-toolbar-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .ds-toolbar-btn.dirty {
          color: var(--warning, #f59e0b);
        }

        .ds-unsaved-indicator {
          position: absolute;
          top: 4px;
          right: 4px;
          width: 6px;
          height: 6px;
          background: var(--warning, #f59e0b);
          border-radius: 50%;
        }

        .ds-topbar-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ds-save-btn.dirty {
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }

        .ds-grid-picker {
          position: relative;
        }

        .ds-grid-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: var(--panel, #ffffff);
          border: 1px solid var(--border, #e2e8f0);
          border-radius: 8px;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
          padding: 4px;
          min-width: 100px;
          z-index: 1000;
        }

        .ds-grid-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          border: none;
          border-radius: 4px;
          background: transparent;
          color: var(--text, #0f172a);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ds-grid-option:hover {
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
        }

        .ds-grid-option.active {
          background: var(--accent-soft, rgba(14, 116, 163, 0.1));
          color: var(--accent, #0e74a3);
        }
      `}</style>
    </div>
  );
}

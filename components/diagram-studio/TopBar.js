// components/diagram-studio/TopBar.js
// Top toolbar for DiagramStudio

import { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useDiagram, useDiagramHistory, useDiagramViewport } from './DiagramContext';
import { UserMenu } from '../ui/UserMenu';

// MUI Icons
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import GridOnIcon from '@mui/icons-material/GridOn';
import GridOffIcon from '@mui/icons-material/GridOff';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import PanToolIcon from '@mui/icons-material/PanTool';
import NearMeIcon from '@mui/icons-material/NearMe';
import TimelineIcon from '@mui/icons-material/Timeline';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import HomeIcon from '@mui/icons-material/Home';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

// ============ COMPONENT ============

export default function TopBar({
  profile,
  onExport,
  onOpenCommandPalette,
  modes = [],
  className = '',
}) {
  const {
    diagram,
    saveStatus,
    saveDiagram,
    showGrid,
    setShowGrid,
    activeTool,
    setActiveTool,
    activePack,
    setActivePack,
  } = useDiagram();

  const { canUndo, canRedo, undo, redo } = useDiagramHistory();
  const { viewport, zoomIn, zoomOut, resetZoom } = useDiagramViewport();

  const [docName, setDocName] = useState(diagram?.name || 'Untitled Diagram');
  const [isEditingName, setIsEditingName] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef(null);

  // Sync name with diagram
  useEffect(() => {
    if (diagram?.name) {
      setDocName(diagram.name);
    }
  }, [diagram?.name]);

  // Close export menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle name change
  const handleNameSubmit = useCallback(() => {
    setIsEditingName(false);
    if (docName !== diagram?.name) {
      // Update diagram name via context
      // This would trigger a save
    }
  }, [docName, diagram?.name]);

  // Handle save
  const handleSave = useCallback(() => {
    saveDiagram(true);
  }, [saveDiagram]);

  // Handle export
  const handleExport = useCallback((format) => {
    setShowExportMenu(false);
    onExport?.(format);
  }, [onExport]);

  // Check permissions
  const showTopBar = profile?.uiPolicy?.showTopBar !== false;
  const allowExport = profile?.uiPolicy?.allowExport !== false;
  const allowModeSwitch = profile?.uiPolicy?.allowModeSwitch !== false;
  const readOnly = profile?.editingPolicy?.readOnly;

  if (!showTopBar) return null;

  return (
    <div className={`ds-topbar ${className}`}>
      {/* Left Section: Logo, Breadcrumb, Document name */}
      <div className="ds-topbar-left">
        {/* Logo - links to dashboard */}
        <Link href="/dashboard" className="ds-topbar-logo" title="Go to Dashboard">
          <div className="ds-logo-icon">
            <span>O</span>
          </div>
        </Link>

        {/* Breadcrumb separator */}
        <ChevronRightIcon className="ds-breadcrumb-sep" fontSize="small" />

        {/* Document name */}
        <div className="ds-doc-title">
          {isEditingName ? (
            <input
              type="text"
              value={docName}
              onChange={(e) => setDocName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleNameSubmit();
                if (e.key === 'Escape') {
                  setDocName(diagram?.name || 'Untitled');
                  setIsEditingName(false);
                }
              }}
              autoFocus
            />
          ) : (
            <input
              type="text"
              value={docName}
              onClick={() => !readOnly && setIsEditingName(true)}
              readOnly
              style={{ cursor: readOnly ? 'default' : 'text' }}
            />
          )}
        </div>

        {/* Save Status */}
        <div className={`ds-save-status ${saveStatus.dirty ? 'dirty' : ''} ${saveStatus.saving ? 'saving' : ''}`}>
          <span className="ds-save-status-dot" />
          <span>
            {saveStatus.saving
              ? 'Saving...'
              : saveStatus.dirty
              ? 'Unsaved changes'
              : saveStatus.lastSaved
              ? `Saved ${formatTimeAgo(saveStatus.lastSaved)}`
              : 'Saved'}
          </span>
        </div>
      </div>

      {/* Center Section: Undo/Redo, Tools */}
      <div className="ds-topbar-center">
        {/* Mode Selector */}
        {allowModeSwitch && modes.length > 1 && (
          <select
            value={activePack}
            onChange={(e) => setActivePack(e.target.value)}
            className="ds-mode-select"
            style={{
              padding: '6px 12px',
              fontSize: 13,
              border: '1px solid var(--border)',
              borderRadius: 6,
              background: 'var(--bg)',
              color: 'var(--text)',
              cursor: 'pointer',
            }}
          >
            {modes.map(mode => (
              <option key={mode.id} value={mode.id}>{mode.name}</option>
            ))}
          </select>
        )}

        {!readOnly && (
          <>
            <div className="ds-toolbar-divider" />

            {/* Undo/Redo */}
            <button
              className="ds-toolbar-btn icon-only"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon fontSize="small" />
            </button>
            <button
              className="ds-toolbar-btn icon-only"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon fontSize="small" />
            </button>

            <div className="ds-toolbar-divider" />

            {/* Tools */}
            <button
              className={`ds-toolbar-btn icon-only ${activeTool === 'select' ? 'active' : ''}`}
              onClick={() => setActiveTool('select')}
              title="Select (V)"
            >
              <NearMeIcon fontSize="small" />
            </button>
            <button
              className={`ds-toolbar-btn icon-only ${activeTool === 'connect' ? 'active' : ''}`}
              onClick={() => setActiveTool('connect')}
              title="Connect (C) - Click and drag from one node to another"
            >
              <TimelineIcon fontSize="small" />
            </button>
            <button
              className={`ds-toolbar-btn icon-only ${activeTool === 'pan' ? 'active' : ''}`}
              onClick={() => setActiveTool('pan')}
              title="Pan (Space)"
            >
              <PanToolIcon fontSize="small" />
            </button>
            <button
              className={`ds-toolbar-btn icon-only ${activeTool === 'comment' ? 'active' : ''}`}
              onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
              title="Add Comment (M)"
            >
              <ChatBubbleOutlineIcon fontSize="small" />
            </button>
          </>
        )}
      </div>

      {/* Right Section: View controls, Export */}
      <div className="ds-topbar-right">
        {/* Command Palette */}
        <button
          className="ds-toolbar-btn ds-cmd-palette-btn"
          onClick={onOpenCommandPalette}
          title="Command Palette (Cmd+K)"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '4px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 6,
          }}
        >
          <SearchIcon fontSize="small" style={{ opacity: 0.6 }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Search...</span>
          <span style={{
            fontSize: 10,
            fontFamily: 'monospace',
            background: 'var(--border)',
            padding: '2px 6px',
            borderRadius: 4,
            color: 'var(--text-muted)',
          }}>
            ⌘K
          </span>
        </button>

        <div className="ds-toolbar-divider" />

        {/* Grid Toggle */}
        <button
          className={`ds-toolbar-btn icon-only ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGrid(!showGrid)}
          title={showGrid ? 'Hide Grid (G)' : 'Show Grid (G)'}
        >
          {showGrid ? <GridOnIcon fontSize="small" /> : <GridOffIcon fontSize="small" />}
        </button>

        {/* Zoom Controls */}
        <div className="ds-zoom-controls">
          <button onClick={zoomOut} title="Zoom Out (Ctrl+-)">
            <ZoomOutIcon fontSize="small" />
          </button>
          <span>{Math.round(viewport.scale * 100)}%</span>
          <button onClick={zoomIn} title="Zoom In (Ctrl++)">
            <ZoomInIcon fontSize="small" />
          </button>
          <button onClick={resetZoom} title="Reset Zoom">
            <FitScreenIcon fontSize="small" />
          </button>
        </div>

        {/* Save Button */}
        {!readOnly && (
          <button
            className="ds-toolbar-btn"
            onClick={handleSave}
            disabled={!saveStatus.dirty || saveStatus.saving}
            title="Save (Ctrl+S)"
          >
            <SaveIcon fontSize="small" />
            <span>Save</span>
          </button>
        )}

        {/* Export Menu */}
        {allowExport && (
          <div ref={exportMenuRef} style={{ position: 'relative' }}>
            <button
              className="ds-toolbar-btn"
              onClick={() => setShowExportMenu(!showExportMenu)}
              title="Export"
            >
              <FileDownloadIcon fontSize="small" />
              <span>Export</span>
            </button>
            {showExportMenu && (
              <div className="ds-export-menu">
                {(profile?.exportPolicy?.formats || ['svg', 'png', 'json']).map(format => (
                  <button
                    key={format}
                    className="ds-context-menu-item"
                    onClick={() => handleExport(format)}
                  >
                    Export as {format.toUpperCase()}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="ds-toolbar-divider" />

        {/* User Menu */}
        <UserMenu />
      </div>
    </div>
  );
}

// ============ HELPERS ============

function formatTimeAgo(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return date.toLocaleDateString();
}

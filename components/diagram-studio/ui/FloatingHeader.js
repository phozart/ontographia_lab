// components/diagram-studio/ui/FloatingHeader.js
// Floating header bar with hamburger menu, branding, and diagram info

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDiagram } from '../DiagramContext';
import { LogoIcon } from '../../ui/Logo';

// Header sizing constants
const HEADER_LOGO_SIZE = 28;
const HEADER_FONT_SIZE = '14px';
const HEADER_BTN_SIZE = 32;

// MUI Icons
import MenuIcon from '@mui/icons-material/Menu';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import HomeIcon from '@mui/icons-material/Home';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import InfoIcon from '@mui/icons-material/Info';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';

export default function FloatingHeader({
  diagramName = 'Untitled Diagram',
  onNameChange,
  onSave,
  onExport,
  onShowShortcuts,
  onGoHome,
  readOnly = false,
}) {
  const { saveStatus, saveDiagram } = useDiagram();
  const [showMainMenu, setShowMainMenu] = useState(false);
  const [showDiagramMenu, setShowDiagramMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(diagramName);
  const mainMenuRef = useRef(null);
  const diagramMenuRef = useRef(null);
  const nameInputRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (mainMenuRef.current && !mainMenuRef.current.contains(e.target)) {
        setShowMainMenu(false);
      }
      if (diagramMenuRef.current && !diagramMenuRef.current.contains(e.target)) {
        setShowDiagramMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus input when editing name
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameSubmit = useCallback(() => {
    if (editedName.trim() && editedName !== diagramName) {
      onNameChange?.(editedName.trim());
    } else {
      setEditedName(diagramName);
    }
    setIsEditingName(false);
  }, [editedName, diagramName, onNameChange]);

  const handleNameKeyDown = useCallback((e) => {
    if (e.key === 'Enter') {
      handleNameSubmit();
    } else if (e.key === 'Escape') {
      setEditedName(diagramName);
      setIsEditingName(false);
    }
  }, [handleNameSubmit, diagramName]);

  return (
    <div className="ds-floating-header">
      {/* Left Section: Hamburger + Logo + Name */}
      <div className="ds-header-left">
        {/* Hamburger Menu */}
        <div className="ds-header-menu" ref={mainMenuRef}>
          <button
            className={`ds-header-btn ${showMainMenu ? 'active' : ''}`}
            onClick={() => setShowMainMenu(!showMainMenu)}
            title="Menu"
          >
            <MenuIcon fontSize="small" />
          </button>

          {showMainMenu && (
            <div className="ds-header-dropdown">
              <button
                className="ds-dropdown-item"
                onClick={() => { onGoHome?.(); setShowMainMenu(false); }}
              >
                <HomeIcon fontSize="small" />
                <span>Dashboard</span>
              </button>
              <button
                className="ds-dropdown-item"
                onClick={() => { setShowMainMenu(false); }}
              >
                <FolderOpenIcon fontSize="small" />
                <span>Open diagram</span>
              </button>

              <div className="ds-dropdown-divider" />

              {!readOnly && (
                <button
                  className="ds-dropdown-item"
                  onClick={() => { saveDiagram?.(true); setShowMainMenu(false); }}
                >
                  <SaveIcon fontSize="small" />
                  <span>Save</span>
                  <span className="ds-dropdown-shortcut">⌘S</span>
                </button>
              )}

              <button
                className="ds-dropdown-item"
                onClick={() => setShowMainMenu(false)}
              >
                <FileDownloadIcon fontSize="small" />
                <span>Export</span>
                <span className="ds-dropdown-arrow">▸</span>
              </button>

              <div className="ds-dropdown-divider" />

              <button
                className="ds-dropdown-item"
                onClick={() => { onShowShortcuts?.(); setShowMainMenu(false); }}
              >
                <KeyboardIcon fontSize="small" />
                <span>Keyboard shortcuts</span>
                <span className="ds-dropdown-shortcut">?</span>
              </button>

              <button
                className="ds-dropdown-item"
                onClick={() => setShowMainMenu(false)}
              >
                <HelpOutlineIcon fontSize="small" />
                <span>Help</span>
              </button>

              <div className="ds-dropdown-divider" />

              <button
                className="ds-dropdown-item"
                onClick={() => { window.location.href = '/account'; setShowMainMenu(false); }}
              >
                <AccountCircleIcon fontSize="small" />
                <span>Account</span>
              </button>

              <button
                className="ds-dropdown-item"
                onClick={() => setShowMainMenu(false)}
              >
                <SettingsIcon fontSize="small" />
                <span>Settings</span>
              </button>
            </div>
          )}
        </div>

        {/* Logo + Brand */}
        <div className="ds-header-brand" onClick={onGoHome} title="Go to Dashboard">
          <LogoIcon size={HEADER_LOGO_SIZE} />
          <span className="ds-header-brand-name">Ontographia Lab</span>
        </div>

        {/* Diagram Name */}
        <div className="ds-header-diagram" ref={diagramMenuRef}>
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              className="ds-header-name-input"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSubmit}
              onKeyDown={handleNameKeyDown}
            />
          ) : (
            <button
              className="ds-header-name"
              onClick={() => !readOnly && setIsEditingName(true)}
              title={readOnly ? diagramName : 'Click to rename'}
            >
              <span>{diagramName}</span>
              {!readOnly && <EditIcon style={{ fontSize: 14, opacity: 0.5 }} />}
            </button>
          )}

          {/* More Options */}
          <button
            className={`ds-header-btn small ${showDiagramMenu ? 'active' : ''}`}
            onClick={() => setShowDiagramMenu(!showDiagramMenu)}
            title="More options"
          >
            <MoreVertIcon fontSize="small" />
          </button>

          {showDiagramMenu && (
            <div className="ds-header-dropdown ds-header-dropdown-right">
              <button
                className="ds-dropdown-item"
                onClick={() => { setIsEditingName(true); setShowDiagramMenu(false); }}
                disabled={readOnly}
              >
                <EditIcon fontSize="small" />
                <span>Rename</span>
              </button>
              <button
                className="ds-dropdown-item"
                onClick={() => setShowDiagramMenu(false)}
              >
                <InfoIcon fontSize="small" />
                <span>Diagram info</span>
              </button>
              <div className="ds-dropdown-divider" />
              <button
                className="ds-dropdown-item"
                onClick={() => { onExport?.('svg'); setShowDiagramMenu(false); }}
              >
                <FileDownloadIcon fontSize="small" />
                <span>Export as SVG</span>
              </button>
              <button
                className="ds-dropdown-item"
                onClick={() => { onExport?.('png'); setShowDiagramMenu(false); }}
              >
                <FileDownloadIcon fontSize="small" />
                <span>Export as PNG</span>
              </button>
              <button
                className="ds-dropdown-item"
                onClick={() => { onExport?.('json'); setShowDiagramMenu(false); }}
              >
                <FileDownloadIcon fontSize="small" />
                <span>Export as JSON</span>
              </button>
            </div>
          )}
        </div>

        {/* Save Status */}
        {saveStatus && (
          <div className={`ds-header-save-status ${saveStatus.saving ? 'saving' : saveStatus.dirty ? 'unsaved' : 'saved'}`}>
            {saveStatus.saving ? (
              <span className="ds-save-dot saving" />
            ) : saveStatus.dirty ? (
              <span className="ds-save-dot unsaved" />
            ) : (
              <CheckIcon style={{ fontSize: 14, color: '#10b981' }} />
            )}
          </div>
        )}
      </div>

      <style jsx>{`
        .ds-floating-header {
          position: fixed;
          top: 12px;
          left: 12px;
          display: flex;
          align-items: center;
          background: white;
          border-radius: 10px;
          box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 5px 10px;
          z-index: 250;
          gap: 6px;
        }

        .ds-header-left {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .ds-header-menu {
          position: relative;
        }

        .ds-header-btn {
          width: ${HEADER_BTN_SIZE}px;
          height: ${HEADER_BTN_SIZE}px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-header-btn.small {
          width: 32px;
          height: 32px;
        }

        .ds-header-btn:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .ds-header-btn.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-header-brand {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 4px 8px;
          border-radius: 6px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ds-header-brand:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-header-brand-name {
          font-size: ${HEADER_FONT_SIZE};
          font-weight: 600;
          color: var(--text, #1f2937);
          letter-spacing: -0.3px;
        }

        .ds-header-diagram {
          display: flex;
          align-items: center;
          gap: 2px;
          position: relative;
          padding-left: 8px;
          margin-left: 4px;
          border-left: 1px solid rgba(0, 0, 0, 0.08);
        }

        .ds-header-name {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 8px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ds-header-name:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-header-name-input {
          padding: 6px 8px;
          border: 1px solid var(--ds-active-color, #0e74a3);
          border-radius: 6px;
          background: white;
          color: var(--text, #1f2937);
          font-size: 13px;
          font-weight: 500;
          outline: none;
          min-width: 150px;
        }

        .ds-header-save-status {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0 4px;
        }

        .ds-save-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }

        .ds-save-dot.saving {
          background: var(--ds-active-color, #0e74a3);
          animation: pulse 1s infinite;
        }

        .ds-save-dot.unsaved {
          background: #f59e0b;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        /* Dropdown Menu */
        .ds-header-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 0;
          min-width: 200px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 4px;
          z-index: 1000;
          animation: menuFadeIn 0.15s ease-out;
        }

        .ds-header-dropdown-right {
          left: auto;
          right: 0;
        }

        @keyframes menuFadeIn {
          from { opacity: 0; transform: translateY(-4px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ds-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .ds-dropdown-item:hover:not(:disabled) {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-dropdown-item:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ds-dropdown-item span:first-of-type {
          flex: 1;
        }

        .ds-dropdown-shortcut {
          font-size: 11px;
          font-family: var(--ds-font-mono, monospace);
          color: var(--text-muted, #6b7280);
          background: var(--bg, #f9fafb);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ds-dropdown-arrow {
          font-size: 10px;
          color: var(--text-muted, #6b7280);
        }

        .ds-dropdown-divider {
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
          margin: 4px 0;
        }
      `}</style>
    </div>
  );
}

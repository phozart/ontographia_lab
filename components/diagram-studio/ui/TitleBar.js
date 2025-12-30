// components/diagram-studio/ui/TitleBar.js
// macOS-style title bar with traffic lights, tools, and actions

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDiagram, useDiagramHistory, useDiagramViewport } from '../DiagramContext';
import { LogoIcon } from '../../ui/Logo';

// Icons
import NearMeIcon from '@mui/icons-material/NearMe';
import TimelineIcon from '@mui/icons-material/Timeline';
import PanToolIcon from '@mui/icons-material/PanTool';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import CreateOutlinedIcon from '@mui/icons-material/CreateOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import ShareIcon from '@mui/icons-material/Share';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import VisibilityIcon from '@mui/icons-material/Visibility';
import SaveIcon from '@mui/icons-material/Save';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SettingsIcon from '@mui/icons-material/Settings';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import MoreVertIcon from '@mui/icons-material/MoreVert';

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

const GridLinesWideIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none">
    <line x1="0" y1="10" x2="20" y2="10" />
    <line x1="10" y1="0" x2="10" y2="20" />
  </svg>
);

const GridNoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="1.5" fill="none">
    <rect x="2" y="2" width="16" height="16" rx="2" strokeDasharray="4 2" />
  </svg>
);

export default function TitleBar({
  diagramName = 'Untitled Diagram',
  onClose,
  onPreview,
  onFullscreen,
  onGoHome,
  onSave,
  onExport,
  onShowShortcuts,
  onShare,
  onMenu,
  onNameChange,
  readOnly = false,
  isFullscreen = false,
  isPreviewMode = false,
  collaborators = [],
}) {
  const diagramContext = useDiagram() || {};
  const {
    activeTool = 'select',
    setActiveTool = () => {},
    saveStatus,
    showGrid = true,
    setShowGrid = () => {},
    gridStyle = 'lines',
    setGridStyle = () => {},
    drawingTool,
    setDrawingTool = () => {},
    elements = [],
    stickyNoteColor = '#fef08a',
    setStickyNoteColor = () => {},
  } = diagramContext;

  const historyContext = useDiagramHistory() || {};
  const { canUndo = false, canRedo = false, undo = () => {}, redo = () => {} } = historyContext;

  const viewportContext = useDiagramViewport() || {};
  const { viewport, zoomIn = () => {}, zoomOut = () => {}, resetZoom = () => {}, zoomToFitAll = () => {} } = viewportContext;

  const [showMenu, setShowMenu] = useState(false);
  const [showGridMenu, setShowGridMenu] = useState(false);
  const [showDrawingMenu, setShowDrawingMenu] = useState(false);
  const [showInteractionMenu, setShowInteractionMenu] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(diagramName);
  const [isCompact, setIsCompact] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const menuRef = useRef(null);
  const gridMenuRef = useRef(null);
  const drawingMenuRef = useRef(null);
  const interactionMenuRef = useRef(null);
  const stickyMenuRef = useRef(null);
  const toolsMenuRef = useRef(null);
  const nameInputRef = useRef(null);

  // Check if we need compact mode
  useEffect(() => {
    const checkCompact = () => {
      // Switch to compact when screen is narrow (tools would overlap with left/right)
      setIsCompact(window.innerWidth < 900);
    };
    checkCompact();
    window.addEventListener('resize', checkCompact);
    return () => window.removeEventListener('resize', checkCompact);
  }, []);

  // Sticky note colors
  const stickyColors = [
    { id: 'yellow', color: '#fef08a', name: 'Yellow' },
    { id: 'pink', color: '#f9a8d4', name: 'Pink' },
    { id: 'blue', color: '#93c5fd', name: 'Blue' },
    { id: 'green', color: '#86efac', name: 'Green' },
    { id: 'orange', color: '#fdba74', name: 'Orange' },
    { id: 'purple', color: '#c4b5fd', name: 'Purple' },
  ];

  // Sync edited name with prop
  useEffect(() => {
    setEditedName(diagramName);
  }, [diagramName]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  // Close menus on click outside
  useEffect(() => {
    let isMounted = true;
    const handleClickOutside = (e) => {
      if (!isMounted) return;
      // Use requestAnimationFrame to avoid race conditions with React
      requestAnimationFrame(() => {
        if (!isMounted) return;
        if (menuRef.current && !menuRef.current.contains(e.target)) {
          setShowMenu(false);
        }
        if (gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
          setShowGridMenu(false);
        }
        if (drawingMenuRef.current && !drawingMenuRef.current.contains(e.target)) {
          setShowDrawingMenu(false);
        }
        if (interactionMenuRef.current && !interactionMenuRef.current.contains(e.target)) {
          setShowInteractionMenu(false);
        }
        if (stickyMenuRef.current && !stickyMenuRef.current.contains(e.target)) {
          setShowStickyMenu(false);
        }
        if (toolsMenuRef.current && !toolsMenuRef.current.contains(e.target)) {
          setShowToolsMenu(false);
        }
      });
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      isMounted = false;
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Get current interaction tool icon
  const getInteractionIcon = () => {
    switch (activeTool) {
      case 'connect': return <TimelineIcon />;
      case 'pan': return <PanToolIcon />;
      default: return <NearMeIcon style={{ transform: 'scaleX(-1)' }} />;
    }
  };

  // Get current grid icon
  const getGridIcon = () => {
    if (!showGrid) return <GridNoneIcon />;
    switch (gridStyle) {
      case 'dots': return <GridDotsIcon />;
      case 'lines': return <GridLinesIcon />;
      case 'lines-wide': return <GridLinesWideIcon />;
      default: return <GridNoneIcon />;
    }
  };

  // Handle close click - go back to dashboard
  const handleClose = () => {
    if (onClose) {
      onClose();
    } else if (onGoHome) {
      onGoHome();
    } else if (typeof window !== 'undefined') {
      window.location.href = '/dashboard';
    }
  };

  // Handle name edit
  const handleNameClick = () => {
    if (!readOnly) {
      setIsEditingName(true);
    }
  };

  const handleNameSave = () => {
    const trimmedName = editedName.trim();
    if (trimmedName && trimmedName !== diagramName) {
      onNameChange?.(trimmedName);
    } else {
      setEditedName(diagramName);
    }
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      setEditedName(diagramName);
      setIsEditingName(false);
    }
  };

  return (
    <div className="ds-title-bar">
      {/* Left: Logo + Name */}
      <div className="ds-title-left">
        {/* Logo - goes home */}
        <div className="ds-title-logo" onClick={onGoHome} title="Go to Dashboard">
          <LogoIcon size={22} />
        </div>

        {/* Editable name */}
        <div className="ds-title-name-wrapper">
          {isEditingName ? (
            <input
              ref={nameInputRef}
              type="text"
              className="ds-title-name-input"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              onBlur={handleNameSave}
              onKeyDown={handleNameKeyDown}
            />
          ) : (
            <span
              className={`ds-title-name ${!readOnly ? 'editable' : ''}`}
              onClick={handleNameClick}
              title={!readOnly ? "Click to rename" : undefined}
            >
              {diagramName}
            </span>
          )}
        </div>
      </div>

      {/* Center: Tools */}
      <div className="ds-title-center">
        {isCompact ? (
          /* Compact mode - vertical floating menu */
          <div className="ds-title-tools ds-compact-tools" ref={toolsMenuRef}>
            {/* Just zoom controls visible inline */}
            <ToolButton
              icon={<ZoomOutIcon />}
              onClick={zoomOut}
              tooltip="Zoom Out (-)"
            />
            <button
              className="ds-zoom-display"
              onClick={resetZoom}
              title="Reset to 100%"
            >
              {Math.round((viewport?.scale || 1) * 100)}%
            </button>
            <ToolButton
              icon={<ZoomInIcon />}
              onClick={zoomIn}
              tooltip="Zoom In (+)"
            />

            <div className="ds-tools-divider" />

            {/* More button that opens vertical menu */}
            <ToolButton
              icon={<MoreVertIcon />}
              active={showToolsMenu}
              onClick={() => setShowToolsMenu(!showToolsMenu)}
              tooltip="More Tools"
            />

            {showToolsMenu && (
              <div className="ds-compact-menu">
                {/* Interaction Tools */}
                <div className="ds-compact-section">
                  <div className="ds-compact-section-label">Tools</div>
                  <button
                    className={`ds-compact-option ${activeTool === 'select' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('select'); setShowToolsMenu(false); }}
                  >
                    <NearMeIcon style={{ transform: 'scaleX(-1)', fontSize: 18 }} />
                    <span>Select</span>
                    <span className="ds-key-hint">V</span>
                  </button>
                  <button
                    className={`ds-compact-option ${activeTool === 'connect' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('connect'); setShowToolsMenu(false); }}
                  >
                    <TimelineIcon style={{ fontSize: 18 }} />
                    <span>Connect</span>
                    <span className="ds-key-hint">C</span>
                  </button>
                  <button
                    className={`ds-compact-option ${activeTool === 'pan' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('pan'); setShowToolsMenu(false); }}
                  >
                    <PanToolIcon style={{ fontSize: 18 }} />
                    <span>Pan</span>
                    <span className="ds-key-hint">H</span>
                  </button>
                  <button
                    className={`ds-compact-option ${activeTool === 'comment' ? 'active' : ''}`}
                    onClick={() => { setActiveTool(activeTool === 'comment' ? 'select' : 'comment'); setShowToolsMenu(false); }}
                  >
                    <ChatBubbleOutlineIcon style={{ fontSize: 18 }} />
                    <span>Comment</span>
                    <span className="ds-key-hint">K</span>
                  </button>
                </div>

                {!readOnly && (
                  <>
                    {/* Annotation Tools */}
                    <div className="ds-compact-section">
                      <div className="ds-compact-section-label">Annotations</div>
                      <button
                        className={`ds-compact-option ${activeTool === 'sticky' ? 'active' : ''}`}
                        onClick={() => { setActiveTool('sticky'); setShowToolsMenu(false); }}
                      >
                        <div className="ds-sticky-icon-small" style={{ backgroundColor: stickyNoteColor }} />
                        <span>Sticky Note</span>
                        <span className="ds-key-hint">N</span>
                      </button>
                      <button
                        className={`ds-compact-option ${activeTool === 'draw' ? 'active' : ''}`}
                        onClick={() => { setActiveTool('draw'); setDrawingTool?.('pen'); setShowToolsMenu(false); }}
                      >
                        <CreateOutlinedIcon style={{ fontSize: 18 }} />
                        <span>Drawing</span>
                        <span className="ds-key-hint">D</span>
                      </button>
                    </div>

                    {/* History */}
                    <div className="ds-compact-section">
                      <div className="ds-compact-section-label">History</div>
                      <button
                        className={`ds-compact-option ${!canUndo ? 'disabled' : ''}`}
                        onClick={() => { if (canUndo) { undo(); setShowToolsMenu(false); } }}
                        disabled={!canUndo}
                      >
                        <UndoIcon style={{ fontSize: 18 }} />
                        <span>Undo</span>
                        <span className="ds-key-hint">⌘Z</span>
                      </button>
                      <button
                        className={`ds-compact-option ${!canRedo ? 'disabled' : ''}`}
                        onClick={() => { if (canRedo) { redo(); setShowToolsMenu(false); } }}
                        disabled={!canRedo}
                      >
                        <RedoIcon style={{ fontSize: 18 }} />
                        <span>Redo</span>
                        <span className="ds-key-hint">⌘⇧Z</span>
                      </button>
                    </div>
                  </>
                )}

                {/* View */}
                <div className="ds-compact-section">
                  <div className="ds-compact-section-label">View</div>
                  <button
                    className={`ds-compact-option ${showGrid ? 'active' : ''}`}
                    onClick={() => { setShowGrid(!showGrid); }}
                  >
                    {getGridIcon()}
                    <span>Grid</span>
                    <span className="ds-key-hint">G</span>
                  </button>
                  <button
                    className="ds-compact-option"
                    onClick={() => {
                      if (elements?.length > 0) {
                        zoomToFitAll(elements, window.innerWidth - 300, window.innerHeight - 200, 80);
                      } else {
                        resetZoom();
                      }
                      setShowToolsMenu(false);
                    }}
                  >
                    <FitScreenIcon style={{ fontSize: 18 }} />
                    <span>Fit All</span>
                    <span className="ds-key-hint">0</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Full toolbar */
          <div className="ds-title-tools">
            {/* Interaction Tools Dropdown (Select/Connect/Pan) */}
            <div className="ds-tool-dropdown-wrapper" ref={interactionMenuRef}>
              <ToolButton
                icon={getInteractionIcon()}
                active={['select', 'connect', 'pan'].includes(activeTool)}
                onClick={() => setShowInteractionMenu(!showInteractionMenu)}
                tooltip="Tools (V/C/Space)"
              />
              {showInteractionMenu && (
                <div className="ds-tool-dropdown">
                  <button
                    className={`ds-dropdown-option ${activeTool === 'select' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('select'); setShowInteractionMenu(false); }}
                  >
                    <NearMeIcon style={{ transform: 'scaleX(-1)', fontSize: 18 }} /> Select
                    <span className="ds-key-hint">V</span>
                  </button>
                  <button
                    className={`ds-dropdown-option ${activeTool === 'connect' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('connect'); setShowInteractionMenu(false); }}
                  >
                    <TimelineIcon style={{ fontSize: 18 }} /> Connect
                    <span className="ds-key-hint">C</span>
                  </button>
                  <button
                    className={`ds-dropdown-option ${activeTool === 'pan' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('pan'); setShowInteractionMenu(false); }}
                  >
                    <PanToolIcon style={{ fontSize: 18 }} /> Pan
                    <span className="ds-key-hint">Space</span>
                  </button>
                </div>
              )}
            </div>

            <ToolButton
              icon={<ChatBubbleOutlineIcon />}
              active={activeTool === 'comment'}
              onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
              tooltip="Comment (K)"
            />

            <div className="ds-tools-divider" />

            {/* Group 2: Annotation Tools */}
            {!readOnly && (
              <>
                <div className="ds-tool-dropdown-wrapper" ref={stickyMenuRef}>
                  <button
                    className={`ds-tool-btn ${activeTool === 'sticky' ? 'active' : ''}`}
                    onClick={() => {
                      if (activeTool === 'sticky') {
                        setShowStickyMenu(!showStickyMenu);
                      } else {
                        setActiveTool('sticky');
                      }
                    }}
                    title="Sticky Note (N)"
                  >
                    <div
                      className="ds-sticky-icon"
                      style={{ backgroundColor: stickyNoteColor }}
                    />
                  </button>
                  {showStickyMenu && (
                    <div className="ds-tool-dropdown ds-color-dropdown">
                      <div className="ds-dropdown-header">Sticky Note Color</div>
                      <div className="ds-dropdown-hint">Click to select or drag to canvas</div>
                      <div className="ds-color-grid">
                        {stickyColors.map(({ id, color, name }) => (
                          <button
                            key={id}
                            className={`ds-color-option ${stickyNoteColor === color ? 'active' : ''}`}
                            style={{ backgroundColor: color }}
                            draggable
                            onClick={() => {
                              setStickyNoteColor(color);
                              setShowStickyMenu(false);
                            }}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('application/json', JSON.stringify({
                                type: 'sticky-note',
                                color: color,
                                stencilId: 'sticky-medium',
                                packId: 'sticky-notes',
                              }));
                              e.dataTransfer.effectAllowed = 'copy';
                              // Create a colored drag image
                              const dragImg = document.createElement('div');
                              dragImg.style.cssText = `
                                width: 80px; height: 80px; background: ${color};
                                border-radius: 4px; box-shadow: 2px 4px 8px rgba(0,0,0,0.2);
                                position: absolute; top: -1000px;
                              `;
                              document.body.appendChild(dragImg);
                              e.dataTransfer.setDragImage(dragImg, 40, 40);
                              setTimeout(() => dragImg.remove(), 0);
                            }}
                            title={`${name} - Drag to canvas`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="ds-tool-dropdown-wrapper" ref={drawingMenuRef}>
                  <ToolButton
                    icon={<CreateOutlinedIcon />}
                    active={activeTool === 'draw' && drawingTool}
                    onClick={() => {
                      if (drawingTool) {
                        setShowDrawingMenu(!showDrawingMenu);
                      } else {
                        setActiveTool('draw');
                        setDrawingTool?.('pen');
                        setShowDrawingMenu(true);
                      }
                    }}
                    tooltip="Drawing Tools (D)"
                  />
                  {showDrawingMenu && (
                    <div className="ds-tool-dropdown">
                      <div className="ds-dropdown-header">Drawing Tools</div>
                      <button
                        className={`ds-dropdown-option ${drawingTool === 'pen' ? 'active' : ''}`}
                        onClick={() => { setActiveTool('draw'); setDrawingTool?.('pen'); setShowDrawingMenu(false); }}
                      >
                        <span>✏️</span> Pen
                      </button>
                      <button
                        className={`ds-dropdown-option ${drawingTool === 'highlighter' ? 'active' : ''}`}
                        onClick={() => { setActiveTool('draw'); setDrawingTool?.('highlighter'); setShowDrawingMenu(false); }}
                      >
                        <span>🖍️</span> Highlighter
                      </button>
                      <button
                        className={`ds-dropdown-option ${drawingTool === 'eraser' ? 'active' : ''}`}
                        onClick={() => { setActiveTool('draw'); setDrawingTool?.('eraser'); setShowDrawingMenu(false); }}
                      >
                        <span>🧽</span> Eraser
                      </button>
                      <div className="ds-dropdown-divider" />
                      <button
                        className="ds-dropdown-option"
                        onClick={() => { setActiveTool('select'); setDrawingTool?.(null); setShowDrawingMenu(false); }}
                      >
                        <span>✖</span> Exit Drawing
                      </button>
                    </div>
                  )}
                </div>

                <div className="ds-tools-divider" />
              </>
            )}

            {/* History: Undo/Redo */}
            {!readOnly && (
              <>
                <ToolButton
                  icon={<UndoIcon />}
                  disabled={!canUndo}
                  onClick={undo}
                  tooltip="Undo (⌘Z)"
                />
                <ToolButton
                  icon={<RedoIcon />}
                  disabled={!canRedo}
                  onClick={redo}
                  tooltip="Redo (⌘⇧Z)"
                />

                <div className="ds-tools-divider" />
              </>
            )}

            {/* Group 4: Canvas View */}
            <div className="ds-tool-dropdown-wrapper" ref={gridMenuRef}>
              <ToolButton
                icon={getGridIcon()}
                active={showGrid}
                onClick={() => setShowGridMenu(!showGridMenu)}
                tooltip="Grid (G)"
              />
              {showGridMenu && (
                <div className="ds-tool-dropdown">
                  <button
                    className={`ds-dropdown-option ${showGrid && gridStyle === 'dots' ? 'active' : ''}`}
                    onClick={() => { setShowGrid(true); setGridStyle('dots'); setShowGridMenu(false); }}
                  >
                    <GridDotsIcon /> Dots
                  </button>
                  <button
                    className={`ds-dropdown-option ${showGrid && gridStyle === 'lines' ? 'active' : ''}`}
                    onClick={() => { setShowGrid(true); setGridStyle('lines'); setShowGridMenu(false); }}
                  >
                    <GridLinesIcon /> Lines (Small)
                  </button>
                  <button
                    className={`ds-dropdown-option ${showGrid && gridStyle === 'lines-wide' ? 'active' : ''}`}
                    onClick={() => { setShowGrid(true); setGridStyle('lines-wide'); setShowGridMenu(false); }}
                  >
                    <GridLinesWideIcon /> Lines (Wide)
                  </button>
                  <button
                    className={`ds-dropdown-option ${!showGrid ? 'active' : ''}`}
                    onClick={() => { setShowGrid(false); setShowGridMenu(false); }}
                  >
                    <GridNoneIcon /> None
                  </button>
                </div>
              )}
            </div>

            <ToolButton
              icon={<ZoomOutIcon />}
              onClick={zoomOut}
              tooltip="Zoom Out (-)"
            />
            <button
              className="ds-zoom-display"
              onClick={resetZoom}
              title="Reset to 100%"
            >
              {Math.round((viewport?.scale || 1) * 100)}%
            </button>
            <ToolButton
              icon={<ZoomInIcon />}
              onClick={zoomIn}
              tooltip="Zoom In (+)"
            />
            <ToolButton
              icon={<FitScreenIcon />}
              onClick={() => {
                if (elements?.length > 0) {
                  zoomToFitAll(elements, window.innerWidth - 300, window.innerHeight - 200, 80);
                } else {
                  resetZoom();
                }
              }}
              tooltip="Fit All (0)"
            />
          </div>
        )}
      </div>

      {/* Right: Actions */}
      <div className="ds-title-right">
        {/* Save status indicator */}
        {saveStatus && (
          <div className={`ds-save-indicator ${saveStatus.saving ? 'saving' : saveStatus.dirty ? 'dirty' : 'saved'}`}>
            {saveStatus.saving ? '•••' : saveStatus.dirty ? '●' : '✓'}
          </div>
        )}

        {/* Collaborators */}
        {collaborators.length > 0 && (
          <div className="ds-collaborators">
            {collaborators.slice(0, 3).map((user, i) => (
              <div key={i} className="ds-collaborator" title={user.name}>
                {user.image ? (
                  <img src={user.image} alt={user.name} />
                ) : (
                  <PersonIcon fontSize="small" />
                )}
              </div>
            ))}
            {collaborators.length > 3 && (
              <div className="ds-collaborator-more">+{collaborators.length - 3}</div>
            )}
          </div>
        )}

        {/* View controls */}
        <div className="ds-view-controls">
          <button
            className={`ds-title-btn ${isPreviewMode ? 'active' : ''}`}
            onClick={onPreview}
            title={isPreviewMode ? "Exit preview" : "Preview (hide UI)"}
          >
            {isPreviewMode ? <VisibilityIcon fontSize="small" /> : <VisibilityOffIcon fontSize="small" />}
          </button>
          <button
            className={`ds-title-btn ${isFullscreen ? 'active' : ''}`}
            onClick={onFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
          </button>
        </div>

        {/* Share button */}
        <button className="ds-title-action-btn" onClick={onShare} title="Share">
          <ShareIcon fontSize="small" />
          <span>Share</span>
        </button>

        {/* Menu button */}
        <div className="ds-title-menu-wrapper" ref={menuRef}>
          <button
            className={`ds-title-btn ${showMenu ? 'active' : ''}`}
            onClick={() => setShowMenu(!showMenu)}
            title="Menu"
          >
            <MenuIcon fontSize="small" />
          </button>

          {showMenu && (
            <div className="ds-title-dropdown">
              {!readOnly && (
                <button className="ds-dropdown-item" onClick={() => { onSave?.(); setShowMenu(false); }}>
                  <SaveIcon fontSize="small" />
                  <span>Save</span>
                  <span className="ds-shortcut">⌘S</span>
                </button>
              )}
              <button className="ds-dropdown-item" onClick={() => { onExport?.('png'); setShowMenu(false); }}>
                <FileDownloadIcon fontSize="small" />
                <span>Export as PNG</span>
              </button>
              <button className="ds-dropdown-item" onClick={() => { onExport?.('svg'); setShowMenu(false); }}>
                <FileDownloadIcon fontSize="small" />
                <span>Export as SVG</span>
              </button>
              <div className="ds-dropdown-divider" />
              <button className="ds-dropdown-item" onClick={() => { onShowShortcuts?.(); setShowMenu(false); }}>
                <KeyboardIcon fontSize="small" />
                <span>Keyboard shortcuts</span>
                <span className="ds-shortcut">?</span>
              </button>
              <button className="ds-dropdown-item" onClick={() => setShowMenu(false)}>
                <HelpOutlineIcon fontSize="small" />
                <span>Help</span>
              </button>
              <div className="ds-dropdown-divider" />
              <button className="ds-dropdown-item" onClick={() => setShowMenu(false)}>
                <SettingsIcon fontSize="small" />
                <span>Settings</span>
              </button>
              <div className="ds-dropdown-divider" />
              <button className="ds-dropdown-item ds-dropdown-close" onClick={() => { onGoHome?.(); setShowMenu(false); }}>
                <CloseIcon fontSize="small" />
                <span>Close</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .ds-title-bar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 48px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 16px;
          background: #1a1a2e;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          z-index: 500;
          -webkit-app-region: drag;
        }

        .ds-title-left {
          display: flex;
          align-items: center;
          gap: 8px;
          -webkit-app-region: no-drag;
        }

        .ds-title-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .ds-title-logo:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .ds-title-name-wrapper {
          display: flex;
          align-items: center;
        }

        .ds-title-name {
          font-size: 14px;
          font-weight: 500;
          color: rgba(255, 255, 255, 0.9);
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          padding: 6px 10px;
          border-radius: 6px;
          transition: background 0.15s ease;
        }

        .ds-title-name.editable {
          cursor: text;
        }

        .ds-title-name.editable:hover {
          background: rgba(255, 255, 255, 0.06);
        }

        .ds-title-name-input {
          font-size: 14px;
          font-weight: 500;
          color: white;
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          padding: 5px 10px;
          max-width: 200px;
          outline: none;
        }

        .ds-title-name-input:focus {
          border-color: var(--accent, #6EC5D8);
          box-shadow: 0 0 0 2px rgba(110, 197, 216, 0.2);
        }

        .ds-title-center {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          -webkit-app-region: no-drag;
        }

        .ds-title-tools {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ds-tools-divider {
          width: 1px;
          height: 20px;
          background: rgba(255, 255, 255, 0.1);
          margin: 0 6px;
        }

        /* Compact mode styles */
        .ds-compact-tools {
          position: relative;
        }

        .ds-compact-menu {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 200px;
          background: var(--ds-dropdown-bg, #252540);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 12px;
          padding: 8px;
          z-index: 1000;
          animation: dropdownIn 0.15s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
        }

        .ds-compact-section {
          padding: 4px 0;
        }

        .ds-compact-section:not(:last-child) {
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
          margin-bottom: 4px;
        }

        .ds-compact-section-label {
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.35);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 10px 6px;
        }

        .ds-compact-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .ds-compact-option:hover:not(.disabled) {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .ds-compact-option.active {
          background: var(--accent-soft, rgba(110, 197, 216, 0.15));
          color: var(--accent, #6EC5D8);
        }

        .ds-compact-option.disabled {
          opacity: 0.35;
          cursor: not-allowed;
        }

        .ds-compact-option span {
          flex: 1;
        }

        .ds-compact-option .ds-key-hint {
          font-size: 10px;
          font-family: var(--ds-font-mono, monospace);
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 5px;
          border-radius: 3px;
        }

        .ds-sticky-icon-small {
          width: 16px;
          height: 16px;
          border-radius: 2px;
          box-shadow: 1px 1px 2px rgba(0, 0, 0, 0.15);
        }

        .ds-tool-dropdown-wrapper {
          position: relative;
        }

        .ds-tool-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          min-width: 150px;
          background: var(--ds-dropdown-bg, #252540);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 6px;
          z-index: 1000;
          animation: dropdownIn 0.15s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        .ds-dropdown-header {
          font-size: 11px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.4);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 6px 10px 8px;
        }

        .ds-dropdown-hint {
          font-size: 11px;
          color: rgba(255, 255, 255, 0.35);
          padding: 0 10px 8px;
          font-style: italic;
        }

        .ds-dropdown-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 10px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .ds-dropdown-option:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .ds-dropdown-option.active {
          background: var(--accent-soft, rgba(110, 197, 216, 0.15));
          color: var(--accent, #6EC5D8);
        }

        .ds-dropdown-option span {
          font-size: 14px;
        }

        .ds-dropdown-option .ds-key-hint {
          margin-left: auto;
          font-size: 10px;
          font-family: var(--ds-font-mono, monospace);
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 5px;
          border-radius: 3px;
        }

        .ds-sticky-icon {
          width: 20px;
          height: 20px;
          border-radius: 3px;
          box-shadow:
            2px 2px 4px rgba(0, 0, 0, 0.15),
            inset -1px -1px 0 rgba(0, 0, 0, 0.1);
          position: relative;
        }

        .ds-sticky-icon::after {
          content: '';
          position: absolute;
          top: 0;
          right: 0;
          width: 6px;
          height: 6px;
          background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.1) 50%);
        }

        .ds-color-dropdown {
          min-width: 140px;
        }

        .ds-color-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
          padding: 8px;
        }

        .ds-color-option {
          width: 36px;
          height: 36px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        .ds-color-option:hover {
          transform: scale(1.1);
          box-shadow: 0 3px 8px rgba(0, 0, 0, 0.2);
        }

        .ds-color-option.active {
          border-color: white;
          box-shadow: 0 0 0 2px var(--accent, #6EC5D8);
        }

        .ds-zoom-display {
          min-width: 50px;
          height: 28px;
          padding: 0 8px;
          border: none;
          border-radius: 6px;
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
          text-align: center;
        }

        .ds-zoom-display:hover {
          background: rgba(255, 255, 255, 0.1);
          color: white;
        }

        .ds-title-right {
          display: flex;
          align-items: center;
          gap: 12px;
          -webkit-app-region: no-drag;
        }

        .ds-view-controls {
          display: flex;
          align-items: center;
          gap: 2px;
          padding: 2px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
        }

        .ds-save-indicator {
          font-size: 12px;
          padding: 4px 8px;
          border-radius: 4px;
          font-weight: 500;
        }

        .ds-save-indicator.saving {
          color: var(--accent, #6EC5D8);
          animation: pulse 1s infinite;
        }

        .ds-save-indicator.dirty {
          color: #fbbf24;
        }

        .ds-save-indicator.saved {
          color: #34d399;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }

        .ds-collaborators {
          display: flex;
          align-items: center;
        }

        .ds-collaborator {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: var(--accent, #6EC5D8);
          border: 2px solid #1a1a2e;
          margin-left: -8px;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
          color: white;
        }

        .ds-collaborator:first-child {
          margin-left: 0;
        }

        .ds-collaborator img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .ds-collaborator-more {
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.1);
          border: 2px solid #1a1a2e;
          margin-left: -8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.7);
        }

        .ds-title-action-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          background: var(--accent, #6EC5D8);
          border: none;
          border-radius: 8px;
          color: var(--ds-titlebar-bg, #1a1a2e);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-title-action-btn:hover {
          background: var(--accent-hover, #8cd4e5);
          transform: translateY(-1px);
        }

        .ds-title-menu-wrapper {
          position: relative;
        }

        .ds-title-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-title-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-title-btn.active {
          background: rgba(255, 255, 255, 0.12);
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-title-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          right: 0;
          min-width: 200px;
          background: var(--ds-dropdown-bg, #252540);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 6px;
          z-index: 1000;
          animation: dropdownIn 0.15s ease-out;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        }

        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .ds-dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.8);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
          text-align: left;
        }

        .ds-dropdown-item:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .ds-dropdown-item span {
          flex: 1;
        }

        .ds-shortcut {
          font-size: 11px;
          font-family: var(--ds-font-mono, monospace);
          color: rgba(255, 255, 255, 0.4);
          background: rgba(255, 255, 255, 0.06);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ds-dropdown-divider {
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 6px 0;
        }
      `}</style>
    </div>
  );
}

// Tool button component
function ToolButton({ icon, active, disabled, onClick, tooltip }) {
  return (
    <button
      className={`ds-tool-btn ${active ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
    >
      {icon}
      <style jsx>{`
        .ds-tool-btn {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: rgba(255, 255, 255, 0.6);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-tool-btn:hover:not(.disabled) {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-tool-btn.active {
          background: var(--accent-soft, rgba(110, 197, 216, 0.2));
          color: var(--accent, #6EC5D8);
        }

        .ds-tool-btn.disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .ds-tool-btn :global(svg) {
          font-size: 20px;
        }
      `}</style>
    </button>
  );
}

export { ToolButton };

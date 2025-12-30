// components/diagram-studio/ui/FloatingEditBar.js
// Floating toolbar for workspace editing tools - positioned top center

import { useState, useRef, useEffect, useCallback } from 'react';
import { useDiagram, useDiagramHistory, useDiagramViewport } from '../DiagramContext';

// Icons
import NearMeIcon from '@mui/icons-material/NearMe';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import TimelineIcon from '@mui/icons-material/Timeline';
import PanToolIcon from '@mui/icons-material/PanTool';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import CreateOutlinedIcon from '@mui/icons-material/CreateOutlined';
import FileDownloadIcon from '@mui/icons-material/FileDownload';

// Default sticky note color
const DEFAULT_STICKY_COLOR = '#fef08a'; // Yellow

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

export default function FloatingEditBar({
  readOnly = false,
  position = 'top',
  onPositionChange,
  onQuickExport,
  onAdvancedExport,
}) {
  const {
    activeTool,
    setActiveTool,
    showGrid,
    setShowGrid,
    gridStyle,
    setGridStyle,
    selectedStencil,
    setSelectedStencil,
    stickyNoteColor,
    setStickyNoteColor,
    drawingTool,
    setDrawingTool,
  } = useDiagram();

  const { canUndo, canRedo, undo, redo } = useDiagramHistory();
  const { viewport, zoomIn, zoomOut, resetZoom, zoomToFitAll } = useDiagramViewport();

  // Get elements for fit all functionality
  const { elements } = useDiagram();

  const [showGridMenu, setShowGridMenu] = useState(false);
  const [showStickyMenu, setShowStickyMenu] = useState(false);
  const [showDrawingMenu, setShowDrawingMenu] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [showCompactMenu, setShowCompactMenu] = useState(false);
  const gridMenuRef = useRef(null);
  const stickyMenuRef = useRef(null);
  const drawingMenuRef = useRef(null);
  const toolbarRef = useRef(null);
  const compactMenuRef = useRef(null);

  // Check if toolbar would overflow and switch to compact mode
  useEffect(() => {
    const checkOverflow = () => {
      // Switch to compact mode when screen is narrow enough that toolbar would overlap
      // with header (left ~180px) and collaboration bar (right ~150px)
      const availableWidth = window.innerWidth - 180 - 150; // Leave room for header and collab bar
      const toolbarWidth = 500; // Approximate width of full toolbar
      setIsCompact(availableWidth < toolbarWidth);
    };

    checkOverflow();
    window.addEventListener('resize', checkOverflow);
    return () => window.removeEventListener('resize', checkOverflow);
  }, []);

  // Selected sticky color state (local fallback if context doesn't have it)
  const [localStickyColor, setLocalStickyColor] = useState(DEFAULT_STICKY_COLOR);
  const currentStickyColor = stickyNoteColor || localStickyColor;
  const updateStickyColor = setStickyNoteColor || setLocalStickyColor;

  // Color picker ref for programmatic click
  const colorPickerRef = useRef(null);

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (gridMenuRef.current && !gridMenuRef.current.contains(e.target)) {
        setShowGridMenu(false);
      }
      if (stickyMenuRef.current && !stickyMenuRef.current.contains(e.target)) {
        setShowStickyMenu(false);
      }
      if (drawingMenuRef.current && !drawingMenuRef.current.contains(e.target)) {
        setShowDrawingMenu(false);
      }
      if (compactMenuRef.current && !compactMenuRef.current.contains(e.target)) {
        setShowCompactMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle sticky note tool selection
  const handleStickyClick = () => {
    if (activeTool === 'sticky') {
      setShowStickyMenu(!showStickyMenu);
    } else {
      setActiveTool('sticky');
      setShowStickyMenu(true);
    }
  };

  // Handle sticky color selection from color picker
  const handleStickyColorChange = (e) => {
    updateStickyColor(e.target.value);
    setActiveTool('sticky');
  };

  // Handle clicking the place button
  const handlePlaceStickyNote = () => {
    setActiveTool('sticky');
    setShowStickyMenu(false);
  };

  // Get current grid icon
  const getGridIcon = () => {
    if (!showGrid) return <GridNoneIcon />;
    switch (gridStyle) {
      case 'dots': return <GridDotsIcon />;
      case 'lines': return <GridLinesIcon />;
      default: return <GridNoneIcon />;
    }
  };

  // Get position class
  const positionClass = `floating-edit-bar position-${position}`;
  const isVertical = position === 'right' || position === 'left';

  // Compact toolbar for narrow screens
  if (isCompact) {
    return (
      <div className="floating-edit-bar compact-toolbar" ref={compactMenuRef}>
        {/* Essential tools always visible */}
        <button
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => { setActiveTool('select'); setShowCompactMenu(false); }}
          title="Select (V)"
        >
          <NearMeIcon fontSize="small" />
        </button>
        <button
          className={`tool-btn ${activeTool === 'connect' ? 'active' : ''}`}
          onClick={() => { setActiveTool('connect'); setShowCompactMenu(false); }}
          title="Connect (C)"
        >
          <TimelineIcon fontSize="small" />
        </button>

        <div className="tool-divider" />

        {/* Zoom display */}
        <button
          className="tool-btn zoom-percent"
          onClick={resetZoom}
          title="Click to reset to 100%"
        >
          <span className="zoom-display">{Math.round((viewport?.scale || 1) * 100)}%</span>
        </button>

        <div className="tool-divider" />

        {/* More menu button */}
        <button
          className={`tool-btn ${showCompactMenu ? 'active' : ''}`}
          onClick={() => setShowCompactMenu(!showCompactMenu)}
          title="More tools"
        >
          <MoreVertIcon fontSize="small" />
        </button>

        {/* Compact flyout menu */}
        {showCompactMenu && (
          <div className="compact-flyout">
            <div className="compact-section">
              <div className="compact-section-label">Tools</div>
              <button
                className={`compact-option ${activeTool === 'pan' ? 'active' : ''}`}
                onClick={() => { setActiveTool('pan'); setShowCompactMenu(false); }}
              >
                <PanToolIcon fontSize="small" />
                <span>Pan</span>
              </button>
              <button
                className={`compact-option ${activeTool === 'comment' ? 'active' : ''}`}
                onClick={() => { setActiveTool(activeTool === 'comment' ? 'select' : 'comment'); setShowCompactMenu(false); }}
              >
                <ChatBubbleOutlineIcon fontSize="small" />
                <span>Comment</span>
              </button>
              {!readOnly && (
                <>
                  <button
                    className={`compact-option ${activeTool === 'sticky' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('sticky'); setShowCompactMenu(false); }}
                  >
                    <StickyNote2OutlinedIcon fontSize="small" />
                    <span>Sticky Note</span>
                  </button>
                  <button
                    className={`compact-option ${activeTool === 'draw' ? 'active' : ''}`}
                    onClick={() => { setActiveTool('draw'); setDrawingTool?.('pen'); setShowCompactMenu(false); }}
                  >
                    <CreateOutlinedIcon fontSize="small" />
                    <span>Draw</span>
                  </button>
                </>
              )}
            </div>

            {!readOnly && (
              <div className="compact-section">
                <div className="compact-section-label">History</div>
                <button
                  className="compact-option"
                  onClick={() => { undo(); }}
                  disabled={!canUndo}
                >
                  <UndoIcon fontSize="small" />
                  <span>Undo</span>
                </button>
                <button
                  className="compact-option"
                  onClick={() => { redo(); }}
                  disabled={!canRedo}
                >
                  <RedoIcon fontSize="small" />
                  <span>Redo</span>
                </button>
              </div>
            )}

            <div className="compact-section">
              <div className="compact-section-label">View</div>
              <button
                className="compact-option"
                onClick={() => { zoomOut(); }}
              >
                <ZoomOutIcon fontSize="small" />
                <span>Zoom Out</span>
              </button>
              <button
                className="compact-option"
                onClick={() => { zoomIn(); }}
              >
                <ZoomInIcon fontSize="small" />
                <span>Zoom In</span>
              </button>
              <button
                className="compact-option"
                onClick={() => {
                  if (elements?.length > 0) {
                    zoomToFitAll(elements, window.innerWidth - 300, window.innerHeight - 200, 80);
                  } else {
                    resetZoom();
                  }
                  setShowCompactMenu(false);
                }}
              >
                <FitScreenIcon fontSize="small" />
                <span>Fit All</span>
              </button>
              <button
                className={`compact-option ${showGrid ? 'active' : ''}`}
                onClick={() => { setShowGrid(!showGrid); }}
              >
                {getGridIcon()}
                <span>Grid {showGrid ? 'On' : 'Off'}</span>
              </button>
            </div>

            {onAdvancedExport && (
              <div className="compact-section">
                <div className="compact-section-label">Export</div>
                <button
                  className="compact-option"
                  onClick={() => { onAdvancedExport(); setShowCompactMenu(false); }}
                >
                  <FileDownloadIcon fontSize="small" />
                  <span>Export</span>
                </button>
              </div>
            )}
          </div>
        )}

        <style jsx>{`
          .compact-toolbar {
            position: fixed;
            top: 12px;
            left: 50%;
            transform: translateX(-50%);
            display: flex;
            align-items: center;
            gap: 2px;
            background: white;
            border-radius: 8px;
            box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
            padding: 4px 6px;
            z-index: 200;
          }

          .tool-btn {
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: var(--text-muted, #6b7280);
            cursor: pointer;
            transition: all 0.15s ease;
          }

          .tool-btn:hover:not(:disabled) {
            background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
            color: var(--text, #1f2937);
          }

          .tool-btn.active {
            background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
            color: var(--ds-active-color, #0e74a3);
          }

          .tool-divider {
            width: 1px;
            height: 20px;
            background: rgba(0, 0, 0, 0.08);
            margin: 0 4px;
          }

          .zoom-percent {
            width: auto;
            padding: 0 4px;
          }

          .zoom-display {
            min-width: 36px;
            text-align: center;
            font-size: 11px;
            font-weight: 500;
            color: var(--text-muted, #6b7280);
          }

          .compact-flyout {
            position: absolute;
            top: calc(100% + 8px);
            right: 0;
            background: white;
            border-radius: 12px;
            box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
            padding: 8px;
            min-width: 180px;
            z-index: 1000;
          }

          .compact-section {
            padding: 4px 0;
          }

          .compact-section:not(:last-child) {
            border-bottom: 1px solid rgba(0, 0, 0, 0.06);
            margin-bottom: 4px;
          }

          .compact-section-label {
            font-size: 10px;
            font-weight: 600;
            color: var(--text-muted, #9ca3af);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            padding: 4px 12px 6px;
          }

          .compact-option {
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
            padding: 8px 12px;
            text-align: left;
            border: none;
            border-radius: 6px;
            background: transparent;
            color: var(--text, #1f2937);
            font-size: 13px;
            cursor: pointer;
            transition: background 0.15s ease;
          }

          .compact-option:hover:not(:disabled) {
            background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          }

          .compact-option.active {
            background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
            color: var(--ds-active-color, #0e74a3);
          }

          .compact-option:disabled {
            opacity: 0.4;
            cursor: not-allowed;
          }

          .compact-option :global(svg) {
            font-size: 18px;
            color: inherit;
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className={positionClass} ref={toolbarRef}>
      {/* Selection Tools */}
      <div className="tool-group">
        <button
          className={`tool-btn ${activeTool === 'select' ? 'active' : ''}`}
          onClick={() => setActiveTool('select')}
          title="Select (V)"
        >
          <NearMeIcon fontSize="small" />
        </button>
        <button
          className={`tool-btn ${activeTool === 'connect' ? 'active' : ''}`}
          onClick={() => setActiveTool('connect')}
          title="Connect (C)"
        >
          <TimelineIcon fontSize="small" />
        </button>
        <button
          className={`tool-btn ${activeTool === 'pan' ? 'active' : ''}`}
          onClick={() => setActiveTool('pan')}
          title="Pan (Space / Hold middle mouse)"
        >
          <PanToolIcon fontSize="small" />
        </button>
        <button
          className={`tool-btn ${activeTool === 'comment' ? 'active' : ''}`}
          onClick={() => setActiveTool(activeTool === 'comment' ? 'select' : 'comment')}
          title="Comment (M)"
        >
          <ChatBubbleOutlineIcon fontSize="small" />
        </button>
      </div>

      <div className="tool-divider" />

      {/* Annotation Tools - Sticky Notes & Drawing */}
      {!readOnly && (
        <>
          <div className="tool-group" ref={stickyMenuRef}>
            <button
              className={`tool-btn ${activeTool === 'sticky' ? 'active' : ''}`}
              onClick={handleStickyClick}
              title="Sticky Note (N)"
              style={{
                position: 'relative',
              }}
            >
              <StickyNote2OutlinedIcon fontSize="small" />
              <span
                className="color-indicator"
                style={{ backgroundColor: currentStickyColor }}
              />
            </button>
            {showStickyMenu && (
              <div className="sticky-dropdown">
                <div className="sticky-header">Sticky Note</div>
                <div className="color-picker-row">
                  <span className="color-label">Color</span>
                  <div className="color-picker-wrapper">
                    <input
                      ref={colorPickerRef}
                      type="color"
                      value={currentStickyColor}
                      onChange={handleStickyColorChange}
                      className="color-picker-input"
                    />
                    <div
                      className="color-preview"
                      style={{ backgroundColor: currentStickyColor }}
                      onClick={() => colorPickerRef.current?.click()}
                    />
                  </div>
                </div>
                <button
                  className="place-sticky-btn"
                  onClick={handlePlaceStickyNote}
                >
                  Click to place on canvas
                </button>
              </div>
            )}
          </div>

          <div className="tool-group" ref={drawingMenuRef}>
            <button
              className={`tool-btn ${activeTool === 'draw' || drawingTool ? 'active' : ''}`}
              onClick={() => {
                if (drawingTool) {
                  // Toggle menu if already in drawing mode
                  setShowDrawingMenu(!showDrawingMenu);
                } else {
                  // Enter drawing mode with pen as default
                  setActiveTool('draw');
                  setDrawingTool?.('pen');
                  setShowDrawingMenu(true);
                }
              }}
              title="Drawing Tools (D)"
            >
              <CreateOutlinedIcon fontSize="small" />
            </button>
            {showDrawingMenu && (
              <div className="drawing-dropdown">
                <div className="drawing-header">Drawing Tools</div>
                <button
                  className={`drawing-option ${drawingTool === 'pen' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTool('draw');
                    setDrawingTool?.('pen');
                    setShowDrawingMenu(false);
                  }}
                >
                  <span className="drawing-icon">✏️</span>
                  <span>Pen</span>
                </button>
                <button
                  className={`drawing-option ${drawingTool === 'highlighter' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTool('draw');
                    setDrawingTool?.('highlighter');
                    setShowDrawingMenu(false);
                  }}
                >
                  <span className="drawing-icon">🖍️</span>
                  <span>Highlighter</span>
                </button>
                <button
                  className={`drawing-option ${drawingTool === 'eraser' ? 'active' : ''}`}
                  onClick={() => {
                    setActiveTool('draw');
                    setDrawingTool?.('eraser');
                    setShowDrawingMenu(false);
                  }}
                >
                  <span className="drawing-icon">🧽</span>
                  <span>Eraser</span>
                </button>
                <div className="drawing-divider" />
                <button
                  className="drawing-option drawing-exit"
                  onClick={() => {
                    setActiveTool('select');
                    setDrawingTool?.(null);
                    setShowDrawingMenu(false);
                  }}
                >
                  <span className="drawing-icon">✖</span>
                  <span>Exit Drawing</span>
                </button>
              </div>
            )}
          </div>

          <div className="tool-divider" />
        </>
      )}

      {/* Undo/Redo */}
      {!readOnly && (
        <>
          <div className="tool-group">
            <button
              className="tool-btn"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
            >
              <UndoIcon fontSize="small" />
            </button>
            <button
              className="tool-btn"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
            >
              <RedoIcon fontSize="small" />
            </button>
          </div>

          <div className="tool-divider" />
        </>
      )}

      {/* Grid Style */}
      <div className="tool-group" ref={gridMenuRef}>
        <button
          className={`tool-btn ${showGrid ? 'active' : ''}`}
          onClick={() => setShowGridMenu(!showGridMenu)}
          title="Grid style (G)"
        >
          {getGridIcon()}
        </button>
        {showGridMenu && (
          <div className="grid-dropdown">
            <button
              className={`grid-option ${showGrid && gridStyle === 'dots' ? 'active' : ''}`}
              onClick={() => { setShowGrid(true); setGridStyle('dots'); setShowGridMenu(false); }}
            >
              <GridDotsIcon /> <span>Dots</span>
            </button>
            <button
              className={`grid-option ${showGrid && gridStyle === 'lines' ? 'active' : ''}`}
              onClick={() => { setShowGrid(true); setGridStyle('lines'); setShowGridMenu(false); }}
            >
              <GridLinesIcon /> <span>Lines</span>
            </button>
            <button
              className={`grid-option ${!showGrid ? 'active' : ''}`}
              onClick={() => { setShowGrid(false); setShowGridMenu(false); }}
            >
              <GridNoneIcon /> <span>None</span>
            </button>
          </div>
        )}
      </div>

      <div className="tool-divider" />

      {/* Zoom Controls - Simplified */}
      <div className="tool-group zoom-controls">
        <button
          className="tool-btn"
          onClick={zoomOut}
          title="Zoom Out (-)"
        >
          <ZoomOutIcon fontSize="small" />
        </button>
        <button
          className="tool-btn zoom-percent"
          onClick={resetZoom}
          title="Click to reset to 100%"
        >
          <span className="zoom-display">{Math.round((viewport?.scale || 1) * 100)}%</span>
        </button>
        <button
          className="tool-btn"
          onClick={zoomIn}
          title="Zoom In (+)"
        >
          <ZoomInIcon fontSize="small" />
        </button>
        <button
          className="tool-btn"
          onClick={() => {
            if (elements?.length > 0) {
              zoomToFitAll(elements, window.innerWidth - 300, window.innerHeight - 200, 80);
            } else {
              resetZoom();
            }
          }}
          title="Fit All (0)"
        >
          <FitScreenIcon fontSize="small" />
        </button>
      </div>

      {/* Export - Single button with advanced options */}
      {onAdvancedExport && (
        <>
          <div className="tool-divider" />
          <div className="tool-group">
            <button
              className="tool-btn"
              onClick={onAdvancedExport}
              title="Export (Ctrl+E)"
            >
              <FileDownloadIcon fontSize="small" />
            </button>
          </div>
        </>
      )}

      <style jsx>{`
        .floating-edit-bar {
          position: fixed;
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          align-items: center;
          gap: 2px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-toolbar, 0 2px 12px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 4px 6px;
          z-index: 200;
        }

        .tool-group {
          display: flex;
          align-items: center;
          gap: 1px;
          position: relative;
        }

        .tool-divider {
          width: 1px;
          height: 20px;
          background: rgba(0, 0, 0, 0.08);
          margin: 0 4px;
        }

        .tool-btn {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text-muted, #6b7280);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .tool-btn :global(svg) {
          font-size: 20px;
        }

        .tool-btn:hover:not(:disabled) {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
          color: var(--text, #1f2937);
        }

        .tool-btn.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .tool-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .grid-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 4px;
          min-width: 100px;
          z-index: 1000;
        }

        .grid-option {
          display: flex;
          align-items: center;
          gap: 8px;
          width: 100%;
          padding: 8px 12px;
          text-align: left;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .grid-option:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .grid-option.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .zoom-controls {
          display: flex;
          align-items: center;
        }

        .zoom-percent {
          width: auto;
          padding: 0 4px;
        }

        .zoom-percent:hover .zoom-display {
          color: var(--ds-active-color, #0e74a3);
        }

        .zoom-display {
          min-width: 36px;
          text-align: center;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted, #6b7280);
        }

        /* Position variants */
        .position-top {
          top: 12px;
          left: 50%;
          transform: translateX(-50%);
          flex-direction: row;
        }

        .position-bottom {
          bottom: 12px;
          top: auto;
          left: 50%;
          transform: translateX(-50%);
          flex-direction: row;
        }

        .position-right {
          right: 12px;
          left: auto;
          top: 50%;
          transform: translateY(-50%);
          flex-direction: column;
        }

        .position-right .tool-divider {
          width: 20px;
          height: 1px;
          margin: 4px 0;
        }

        .position-right .tool-group {
          flex-direction: column;
        }

        .position-right .zoom-controls {
          flex-direction: column;
        }

        .position-right .zoom-display {
          min-width: auto;
          padding: 2px 0;
        }

        /* Color indicator on sticky button */
        .color-indicator {
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 8px;
          height: 8px;
          border-radius: 2px;
          border: 1px solid rgba(0, 0, 0, 0.15);
        }

        /* Sticky note dropdown */
        .sticky-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 10px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 12px;
          min-width: 180px;
          z-index: 1000;
        }

        .sticky-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 12px;
        }

        .color-picker-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 12px;
        }

        .color-label {
          font-size: 13px;
          color: var(--text, #374151);
        }

        .color-picker-wrapper {
          position: relative;
        }

        .color-picker-input {
          position: absolute;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }

        .color-preview {
          width: 36px;
          height: 36px;
          border-radius: 8px;
          cursor: pointer;
          border: 2px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          transition: all 0.15s ease;
        }

        .color-preview:hover {
          transform: scale(1.05);
          box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
        }

        .place-sticky-btn {
          width: 100%;
          padding: 10px 12px;
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
          border: none;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .place-sticky-btn:hover {
          background: var(--ds-active-color, #0e74a3);
          color: white;
        }

        /* Drawing dropdown */
        .drawing-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 10px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 8px;
          min-width: 140px;
          z-index: 1000;
        }

        .drawing-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 8px 8px;
        }

        .drawing-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          text-align: left;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .drawing-option:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .drawing-option.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .drawing-icon {
          font-size: 16px;
        }

        .drawing-divider {
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
          margin: 6px 8px;
        }

        .drawing-exit {
          color: var(--text-muted, #6b7280);
        }

        .drawing-exit:hover {
          color: var(--text, #1f2937);
        }

        .drawing-hint {
          font-size: 10px;
          color: var(--text-muted, #9ca3af);
          text-align: center;
          padding: 6px 8px;
          font-style: italic;
        }

        /* Settings dropdown */
        .settings-dropdown {
          position: absolute;
          top: calc(100% + 8px);
          left: 50%;
          transform: translateX(-50%);
          background: white;
          border-radius: 10px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 8px;
          min-width: 130px;
          z-index: 1000;
        }

        .settings-header {
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted, #6b7280);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 4px 8px 8px;
        }

        .settings-option {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 12px;
          text-align: left;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text, #1f2937);
          font-size: 13px;
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .settings-option:hover {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .settings-option.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .position-icon {
          font-size: 14px;
          width: 18px;
          text-align: center;
        }

        /* Position-aware dropdown positions */
        .position-bottom .settings-dropdown,
        .position-bottom .grid-dropdown,
        .position-bottom .sticky-dropdown,
        .position-bottom .drawing-dropdown {
          bottom: calc(100% + 8px);
          top: auto;
        }

        .position-right .settings-dropdown,
        .position-right .grid-dropdown,
        .position-right .sticky-dropdown,
        .position-right .drawing-dropdown {
          left: auto;
          right: calc(100% + 8px);
          top: 50%;
          bottom: auto;
          transform: translateY(-50%);
        }
      `}</style>
    </div>
  );
}

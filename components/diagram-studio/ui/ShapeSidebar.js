// components/diagram-studio/ui/ShapeSidebar.js
// Fixed left sidebar for shape/stencil selection - matches macOS app design

import { useState, useRef, useEffect, forwardRef, useImperativeHandle, useCallback } from 'react';
import { useDiagram } from '../DiagramContext';

// Icons
import SquareOutlinedIcon from '@mui/icons-material/SquareOutlined';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import DataObjectOutlinedIcon from '@mui/icons-material/DataObjectOutlined';
import StorageOutlinedIcon from '@mui/icons-material/StorageOutlined';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import StickyNote2OutlinedIcon from '@mui/icons-material/StickyNote2Outlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import CropFreeOutlinedIcon from '@mui/icons-material/CropFreeOutlined';
import TextFieldsOutlinedIcon from '@mui/icons-material/TextFieldsOutlined';
import HistoryIcon from '@mui/icons-material/History';

// Map pack IDs to icons
const PACK_ICONS = {
  'core': <SquareOutlinedIcon />,
  'process-flow': <AccountTreeOutlinedIcon />,
  'cld': <CircleOutlinedIcon />,
  'uml-class': <DataObjectOutlinedIcon />,
  'mind-map': <HubOutlinedIcon />,
  'sticky-notes': <StickyNote2OutlinedIcon />,
  'erd': <StorageOutlinedIcon />,
  'togaf': <BusinessOutlinedIcon />,
};

// Simple shape icons for quick access - stencil data must match CorePack exactly
const QUICK_SHAPES = [
  {
    id: 'rectangle',
    icon: <SquareOutlinedIcon />,
    name: 'Rectangle',
    stencilId: 'rectangle',
    packId: 'core',
    // Full stencil data matching CorePack.js definition
    stencilData: {
      id: 'rectangle',
      name: 'Rectangle',
      description: 'A basic rectangle shape',
      group: 'Basic',
      shape: 'rect', // Must be 'rect' not 'rectangle' to match CorePack
      icon: '▭',
      color: '#3b82f6',
      defaultSize: { width: 120, height: 80 },
      ports: [
        { id: 'top', position: 'top' },
        { id: 'right', position: 'right' },
        { id: 'bottom', position: 'bottom' },
        { id: 'left', position: 'left' },
      ],
      isContainer: false,
    }
  },
  {
    id: 'circle',
    icon: <RadioButtonUncheckedIcon />,
    name: 'Circle',
    stencilId: 'circle',
    packId: 'core',
    stencilData: {
      id: 'circle',
      name: 'Circle',
      description: 'A basic circle shape',
      group: 'Basic',
      shape: 'circle',
      icon: '○',
      color: '#22c55e', // Match CorePack green, not purple
      defaultSize: { width: 80, height: 80 },
      ports: [
        { id: 'top', position: 'top' },
        { id: 'right', position: 'right' },
        { id: 'bottom', position: 'bottom' },
        { id: 'left', position: 'left' },
      ],
      isContainer: false,
    }
  },
  {
    id: 'diamond',
    icon: <ChangeHistoryIcon style={{ transform: 'rotate(180deg)' }} />,
    name: 'Diamond',
    stencilId: 'diamond',
    packId: 'core',
    stencilData: {
      id: 'diamond',
      name: 'Diamond',
      description: 'A diamond/rhombus shape',
      group: 'Basic',
      shape: 'diamond',
      icon: '◇',
      color: '#f59e0b',
      defaultSize: { width: 80, height: 80 },
      ports: [
        { id: 'top', position: 'top' },
        { id: 'right', position: 'right' },
        { id: 'bottom', position: 'bottom' },
        { id: 'left', position: 'left' },
      ],
      isContainer: false,
    }
  },
  {
    id: 'frame',
    icon: <CropFreeOutlinedIcon />,
    name: 'Frame',
    stencilId: 'frame',
    packId: 'core',
    stencilData: {
      id: 'frame',
      name: 'Frame',
      description: 'A visual frame for organizing related elements.',
      group: 'Organization',
      shape: 'frame',
      icon: '⬜',
      color: '#64748b',
      defaultSize: { width: 600, height: 400 },
      defaultData: { backgroundColor: '#ffffff', showTitle: true },
      ports: [],
      isContainer: true,
      isFrame: true,
      noConnections: true,
    }
  },
];

const ShapeSidebar = forwardRef(function ShapeSidebar({
  packRegistry,
  enabledPacks,
  onStencilDragStart,
  onStencilSelect,
  selectedStencil,
  onAddPack,
  onTogglePack,
  readOnly,
}, ref) {
  const { setActiveTool, setSelectedStencil } = useDiagram();
  const [activeShape, setActiveShape] = useState(null);
  const [showFlyout, setShowFlyout] = useState(false);
  const [flyoutPack, setFlyoutPack] = useState(null);
  const [lastUsedStencil, setLastUsedStencil] = useState(null);
  const sidebarRef = useRef(null);

  // Load last used stencil from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lastUsedStencil');
      if (saved) {
        setLastUsedStencil(JSON.parse(saved));
      }
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Save last used stencil to localStorage
  const saveLastUsedStencil = useCallback((stencil) => {
    if (!stencil) return;
    setLastUsedStencil(stencil);
    try {
      localStorage.setItem('lastUsedStencil', JSON.stringify(stencil));
    } catch (e) {
      // Ignore localStorage errors
    }
  }, []);

  // Expose methods to parent
  const openFirstPack = useCallback(() => {
    if (enabledPacks?.length > 0) {
      const firstPack = packRegistry?.get?.(enabledPacks[0]);
      if (firstPack) {
        setFlyoutPack(firstPack);
        setShowFlyout(true);
      }
    }
  }, [enabledPacks, packRegistry]);

  useImperativeHandle(ref, () => ({
    openFirstPack,
  }), [openFirstPack]);

  // Close flyout on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showFlyout && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
        setShowFlyout(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFlyout]);

  // Handle quick shape selection - uses stencil data directly for reliability
  const handleQuickShapeClick = (shape) => {
    if (activeShape?.id === shape.id) {
      // Toggle off - deselect
      setActiveShape(null);
      setSelectedStencil?.(null);
      setActiveTool('select');
    } else {
      // Select shape - use embedded stencil data for direct selection
      setActiveShape(shape);
      // Set the stencil directly with full data (doesn't rely on pack lookup)
      const stencilWithPack = { ...shape.stencilData, packId: shape.packId };
      setSelectedStencil(stencilWithPack);
      setActiveTool('draw');
      // Save as last used stencil
      saveLastUsedStencil(stencilWithPack);
      // Also call onStencilSelect for any parent tracking
      onStencilSelect?.(shape.packId, shape.stencilId);
    }
  };

  // Handle last used stencil click
  const handleLastUsedClick = () => {
    if (!lastUsedStencil) return;

    // Check if it's already selected
    if (selectedStencil?.id === lastUsedStencil.id && selectedStencil?.packId === lastUsedStencil.packId) {
      setSelectedStencil(null);
      setActiveTool('select');
      setActiveShape(null);
    } else {
      setSelectedStencil(lastUsedStencil);
      setActiveTool('draw');
      setActiveShape(null); // Clear quick shape selection
    }
  };

  // Handle drag start for quick shapes
  const handleQuickShapeDragStart = (e, shape) => {
    if (!e.dataTransfer) {
      e.preventDefault();
      return;
    }

    // Set drag data for the canvas drop handler
    const dragData = JSON.stringify({
      type: 'stencil',
      packId: shape.packId,
      stencilId: shape.stencilId,
    });
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.setData('text/plain', dragData);
    e.dataTransfer.effectAllowed = 'copy';

    // Notify parent of drag start
    onStencilDragStart?.(shape.packId, shape.stencilId);
  };

  // Handle pack icon click - opens flyout
  const handlePackClick = (packId) => {
    const pack = packRegistry?.get?.(packId);
    if (pack) {
      if (flyoutPack?.id === packId && showFlyout) {
        setShowFlyout(false);
      } else {
        setFlyoutPack(pack);
        setShowFlyout(true);
      }
    }
  };

  // Handle stencil selection from flyout
  const handleFlyoutStencilSelect = (packId, stencilId) => {
    // Look up full stencil data to save as last used
    const pack = packRegistry?.get?.(packId);
    const stencil = pack?.stencils?.find(s => s.id === stencilId);
    if (stencil) {
      const stencilWithPack = { ...stencil, packId };
      saveLastUsedStencil(stencilWithPack);
    }
    onStencilSelect?.(packId, stencilId);
    setShowFlyout(false);
    setActiveTool('draw');
  };

  // Handle stencil drag start from flyout
  // Note: dataTransfer is already set by StencilFlyout.handleDragStart
  // IMPORTANT: Do NOT close flyout on dragstart - it aborts the drag!
  // The flyout will close on dragend or when the drop completes.
  const handleFlyoutDragStart = (packId, stencilId) => {
    onStencilDragStart?.(packId, stencilId);
    // Don't close flyout here - it aborts the drag operation
  };

  // Handle stencil drag end from flyout - close flyout and save as last used
  const handleFlyoutDragEnd = (packId, stencilId) => {
    // Look up full stencil data to save as last used
    if (packId && stencilId) {
      const pack = packRegistry?.get?.(packId);
      const stencil = pack?.stencils?.find(s => s.id === stencilId);
      if (stencil) {
        const stencilWithPack = { ...stencil, packId };
        saveLastUsedStencil(stencilWithPack);
      }
    }
    setShowFlyout(false);
  };

  // Check if a shape is selected
  const isShapeActive = (shape) => {
    return selectedStencil?.packId === shape.packId && selectedStencil?.id === shape.stencilId;
  };

  return (
    <div className="ds-shape-sidebar" ref={sidebarRef}>
      {/* Last used stencil - always at top when available */}
      {lastUsedStencil && (
        <div className="ds-sidebar-section ds-last-used">
          <button
            className={`ds-sidebar-btn ds-last-used-btn ${
              selectedStencil?.id === lastUsedStencil.id &&
              selectedStencil?.packId === lastUsedStencil.packId ? 'active' : ''
            }`}
            onClick={handleLastUsedClick}
            draggable="true"
            onDragStart={(e) => {
              if (!e.dataTransfer) return;
              const dragData = JSON.stringify({
                type: 'stencil',
                packId: lastUsedStencil.packId,
                stencilId: lastUsedStencil.id,
              });
              e.dataTransfer.setData('application/json', dragData);
              e.dataTransfer.setData('text/plain', dragData);
              e.dataTransfer.effectAllowed = 'copy';
              onStencilDragStart?.(lastUsedStencil.packId, lastUsedStencil.id);
            }}
            title={`Last used: ${lastUsedStencil.name}`}
          >
            <HistoryIcon />
          </button>
        </div>
      )}

      {lastUsedStencil && <div className="ds-sidebar-divider" />}

      {/* Quick shapes - support both click-to-draw and drag-to-drop */}
      <div className="ds-sidebar-section">
        {QUICK_SHAPES.map(shape => (
          <button
            key={shape.id}
            className={`ds-sidebar-btn ${isShapeActive(shape) ? 'active' : ''}`}
            onClick={() => handleQuickShapeClick(shape)}
            draggable="true"
            onDragStart={(e) => handleQuickShapeDragStart(e, shape)}
            onDragEnd={() => {
              // Save as last used when drag completes
              const stencilWithPack = { ...shape.stencilData, packId: shape.packId };
              saveLastUsedStencil(stencilWithPack);
            }}
            title={shape.name}
          >
            {shape.icon}
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="ds-sidebar-divider" />

      {/* Pack shortcuts - show all enabled packs except core */}
      <div className="ds-sidebar-section ds-packs-section">
        {enabledPacks?.map(packId => {
          const pack = packRegistry?.get?.(packId);
          if (!pack || packId === 'core') return null;
          return (
            <button
              key={packId}
              className={`ds-sidebar-btn ${flyoutPack?.id === packId && showFlyout ? 'active' : ''}`}
              onClick={() => handlePackClick(packId)}
              title={pack.name}
            >
              {PACK_ICONS[packId] || <CategoryOutlinedIcon />}
            </button>
          );
        })}

        {!readOnly && (
          <button
            className="ds-sidebar-btn ds-sidebar-add"
            onClick={onAddPack}
            title="More stencil packs"
          >
            <AddOutlinedIcon />
          </button>
        )}
      </div>

      {/* Flyout panel */}
      {showFlyout && flyoutPack && (
        <StencilFlyout
          pack={flyoutPack}
          onClose={() => setShowFlyout(false)}
          onStencilSelect={handleFlyoutStencilSelect}
          onStencilDragStart={handleFlyoutDragStart}
          onStencilDragEnd={handleFlyoutDragEnd}
          selectedStencil={selectedStencil}
        />
      )}

      <style jsx>{`
        .ds-shape-sidebar {
          position: fixed;
          left: 0;
          top: 48px;
          bottom: 0;
          width: 56px;
          display: flex;
          flex-direction: column;
          padding: 12px 8px;
          background: var(--ds-sidebar-bg, #14142a);
          border-right: 1px solid var(--ds-sidebar-border, rgba(255, 255, 255, 0.06));
          z-index: 400;
        }

        .ds-sidebar-section {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .ds-sidebar-divider {
          width: 32px;
          height: 1px;
          background: rgba(255, 255, 255, 0.08);
          margin: 12px auto;
        }

        .ds-sidebar-btn {
          width: 40px;
          height: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 2px solid transparent;
          border-radius: 10px;
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          cursor: grab;
          transition: all 0.15s ease;
          -webkit-user-drag: element;
          user-select: none;
        }

        .ds-sidebar-btn:active {
          cursor: grabbing;
        }

        .ds-sidebar-btn:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(255, 255, 255, 0.8);
        }

        .ds-sidebar-btn.active {
          background: rgba(255, 255, 255, 0.08);
          border-color: var(--accent, #6EC5D8);
          color: var(--accent, #6EC5D8);
        }

        .ds-sidebar-btn :global(svg) {
          font-size: 22px;
        }

        /* Last used stencil button - special styling */
        .ds-last-used-btn {
          background: rgba(110, 197, 216, 0.1);
          border-color: rgba(110, 197, 216, 0.3);
          color: var(--accent, #6EC5D8);
        }

        .ds-last-used-btn:hover {
          background: rgba(110, 197, 216, 0.2);
          border-color: var(--accent, #6EC5D8);
        }

        /* Packs section - can scroll if many packs */
        .ds-packs-section {
          flex: 1;
          overflow-y: auto;
          overflow-x: hidden;
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
        }

        .ds-sidebar-add {
          border-style: dashed;
          border-color: rgba(255, 255, 255, 0.15);
        }

        .ds-sidebar-add:hover {
          border-color: rgba(255, 255, 255, 0.3);
        }
      `}</style>
    </div>
  );
});

// Stencil flyout panel
function StencilFlyout({ pack, onClose, onStencilSelect, onStencilDragStart, onStencilDragEnd, selectedStencil }) {
  const [searchTerm, setSearchTerm] = useState('');

  const stencils = pack.stencils || [];
  const filteredStencils = searchTerm
    ? stencils.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    : stencils;

  // Group stencils
  const groups = {};
  filteredStencils.forEach(stencil => {
    const group = stencil.group || 'Shapes';
    if (!groups[group]) groups[group] = [];
    groups[group].push(stencil);
  });

  const isSelected = (stencil) => {
    return selectedStencil?.packId === pack.id && selectedStencil?.id === stencil.id;
  };

  // Handle drag start - set dataTransfer data for drop handling
  const handleDragStart = (e, stencil) => {
    // Required: prevent default only if we're not handling the drag
    if (!e.dataTransfer) {
      e.preventDefault();
      return;
    }

    // Set the drag data - use 'text/plain' as fallback for broader compatibility
    const dragData = JSON.stringify({
      type: 'stencil',
      packId: pack.id,
      stencilId: stencil.id,
    });
    e.dataTransfer.setData('application/json', dragData);
    e.dataTransfer.setData('text/plain', dragData); // Fallback
    e.dataTransfer.effectAllowed = 'copy';

    // Create a custom drag image for better visual feedback
    const dragImage = e.currentTarget.cloneNode(true);
    dragImage.style.position = 'absolute';
    dragImage.style.top = '-1000px';
    dragImage.style.opacity = '0.8';
    dragImage.style.transform = 'scale(0.9)';
    dragImage.style.pointerEvents = 'none';
    document.body.appendChild(dragImage);
    e.dataTransfer.setDragImage(dragImage, 40, 40);

    // Clean up drag image after a short delay
    setTimeout(() => {
      if (dragImage.parentNode) {
        document.body.removeChild(dragImage);
      }
    }, 0);

    onStencilDragStart?.(pack.id, stencil.id);
  };

  return (
    <div className="ds-stencil-flyout">
      <div className="ds-flyout-header">
        <span className="ds-flyout-title">{pack.name}</span>
        <button className="ds-flyout-close" onClick={onClose}>×</button>
      </div>

      <div className="ds-flyout-search">
        <input
          type="text"
          placeholder="Search..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          autoFocus
        />
      </div>

      <div className="ds-flyout-content">
        {Object.entries(groups).map(([groupName, groupStencils]) => (
          <div key={groupName} className="ds-stencil-group">
            {Object.keys(groups).length > 1 && (
              <div className="ds-group-name">{groupName}</div>
            )}
            <div className="ds-stencil-grid">
              {groupStencils.map(stencil => (
                <div
                  key={stencil.id}
                  className={`ds-stencil-item ${isSelected(stencil) ? 'selected' : ''}`}
                  draggable="true"
                  onClick={() => onStencilSelect(pack.id, stencil.id)}
                  onDragStart={(e) => handleDragStart(e, stencil)}
                  onDragEnd={(e) => {
                    // Close flyout when drag ends and save as last used
                    e.stopPropagation();
                    onStencilDragEnd?.(pack.id, stencil.id);
                  }}
                  onMouseDown={(e) => {
                    // Prevent text selection during drag
                    e.stopPropagation();
                  }}
                  title={stencil.name}
                >
                  <div className="ds-stencil-icon">{stencil.icon}</div>
                  <div className="ds-stencil-name">{stencil.name}</div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {filteredStencils.length === 0 && (
          <div className="ds-flyout-empty">No stencils found</div>
        )}
      </div>

      <style jsx>{`
        .ds-stencil-flyout {
          position: fixed;
          left: 64px;
          top: 60px;
          width: 280px;
          max-height: calc(100vh - 80px);
          background: var(--ds-flyout-bg, #1e1e35);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
          z-index: 450;
          display: flex;
          flex-direction: column;
          animation: flyoutIn 0.15s ease-out;
        }

        @keyframes flyoutIn {
          from { opacity: 0; transform: translateX(-8px); }
          to { opacity: 1; transform: translateX(0); }
        }

        .ds-flyout-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 16px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .ds-flyout-title {
          font-weight: 600;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-flyout-close {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: rgba(255, 255, 255, 0.5);
          font-size: 18px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-flyout-close:hover {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-flyout-search {
          padding: 10px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.06);
        }

        .ds-flyout-search input {
          width: 100%;
          padding: 10px 14px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.9);
          font-size: 13px;
          outline: none;
          transition: all 0.15s ease;
        }

        .ds-flyout-search input::placeholder {
          color: rgba(255, 255, 255, 0.4);
        }

        .ds-flyout-search input:focus {
          border-color: var(--accent, #6EC5D8);
          background: rgba(255, 255, 255, 0.08);
        }

        .ds-flyout-content {
          flex: 1;
          overflow-y: auto;
          padding: 12px;
        }

        .ds-stencil-group {
          margin-bottom: 16px;
        }

        .ds-stencil-group:last-child {
          margin-bottom: 0;
        }

        .ds-group-name {
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: rgba(255, 255, 255, 0.4);
          margin-bottom: 10px;
          padding-left: 4px;
        }

        .ds-stencil-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .ds-stencil-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 14px 8px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.04);
          border: 2px solid transparent;
          cursor: grab;
          transition: all 0.15s ease;
          -webkit-user-drag: element;
          user-select: none;
        }

        .ds-stencil-item:active {
          cursor: grabbing;
        }

        .ds-stencil-item:hover {
          background: rgba(255, 255, 255, 0.08);
          transform: scale(1.02);
        }

        .ds-stencil-item.selected {
          background: var(--accent-soft, rgba(110, 197, 216, 0.15));
          border-color: var(--accent, #6EC5D8);
        }

        .ds-stencil-icon {
          font-size: 26px;
          margin-bottom: 6px;
          color: rgba(255, 255, 255, 0.7);
          pointer-events: none;
        }

        .ds-stencil-item:hover .ds-stencil-icon,
        .ds-stencil-item.selected .ds-stencil-icon {
          color: rgba(255, 255, 255, 0.9);
        }

        .ds-stencil-name {
          font-size: 10px;
          text-align: center;
          color: rgba(255, 255, 255, 0.5);
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          pointer-events: none;
        }

        .ds-flyout-empty {
          padding: 32px;
          text-align: center;
          color: rgba(255, 255, 255, 0.4);
          font-size: 13px;
        }

        /* Light mode */
        [data-theme="light"] .ds-stencil-flyout {
          --ds-flyout-bg: #ffffff;
          background: #ffffff;
          border-color: rgba(0, 0, 0, 0.1);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
        }

        [data-theme="light"] .ds-flyout-header {
          border-color: rgba(0, 0, 0, 0.08);
        }

        [data-theme="light"] .ds-flyout-title {
          color: #1f2937;
        }

        [data-theme="light"] .ds-flyout-close {
          color: rgba(0, 0, 0, 0.4);
        }

        [data-theme="light"] .ds-flyout-close:hover {
          background: rgba(0, 0, 0, 0.06);
          color: rgba(0, 0, 0, 0.8);
        }

        [data-theme="light"] .ds-flyout-search input {
          background: rgba(0, 0, 0, 0.04);
          border-color: rgba(0, 0, 0, 0.1);
          color: #1f2937;
        }

        [data-theme="light"] .ds-flyout-search input::placeholder {
          color: rgba(0, 0, 0, 0.4);
        }

        [data-theme="light"] .ds-group-name {
          color: rgba(0, 0, 0, 0.5);
        }

        [data-theme="light"] .ds-stencil-item {
          background: rgba(0, 0, 0, 0.03);
        }

        [data-theme="light"] .ds-stencil-item:hover {
          background: rgba(0, 0, 0, 0.06);
        }

        [data-theme="light"] .ds-stencil-item.selected {
          background: var(--accent-soft, rgba(79, 179, 206, 0.12));
          border-color: var(--accent, #4FB3CE);
        }

        [data-theme="light"] .ds-stencil-icon {
          color: rgba(0, 0, 0, 0.6);
        }

        [data-theme="light"] .ds-stencil-item:hover .ds-stencil-icon,
        [data-theme="light"] .ds-stencil-item.selected .ds-stencil-icon {
          color: rgba(0, 0, 0, 0.8);
        }

        [data-theme="light"] .ds-stencil-name {
          color: rgba(0, 0, 0, 0.5);
        }
      `}</style>
    </div>
  );
}

export default ShapeSidebar;
export { StencilFlyout };

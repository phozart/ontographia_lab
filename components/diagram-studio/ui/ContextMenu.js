// components/diagram-studio/ui/ContextMenu.js
// Right-click context menu for canvas and elements

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDiagram, useDiagramSelection } from '../DiagramContext';

// MUI Icons
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ContentPasteIcon from '@mui/icons-material/ContentPaste';
import ContentCutIcon from '@mui/icons-material/ContentCut';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import FlipToFrontIcon from '@mui/icons-material/FlipToFront';
import FlipToBackIcon from '@mui/icons-material/FlipToBack';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import EditIcon from '@mui/icons-material/Edit';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import FitScreenIcon from '@mui/icons-material/FitScreen';
import GridOnIcon from '@mui/icons-material/GridOn';
import SettingsIcon from '@mui/icons-material/Settings';
import TuneIcon from '@mui/icons-material/Tune';
import DashboardIcon from '@mui/icons-material/Dashboard';

export default function ContextMenu({
  position,
  targetElement,
  onClose,
  onAddComment,
  onStartConnect,
  onShowProperties,
  showContextualToolbar,
  onToggleContextualToolbar,
  showStencilPanel,
  onToggleStencilPanel,
}) {
  const menuRef = useRef(null);
  const {
    elements,
    selectAll,
    deleteSelected,
    duplicateSelected,
    updateElement,
    showGrid,
    setShowGrid,
    setActiveTool,
  } = useDiagram();
  const { selectedIds, clearSelection } = useDiagramSelection();

  // Adjust menu position to stay in viewport
  const [adjustedPosition, setAdjustedPosition] = useState(position);

  useEffect(() => {
    if (menuRef.current && position) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      let x = position.x;
      let y = position.y;

      // Adjust horizontal position
      if (x + rect.width > viewportWidth - 10) {
        x = viewportWidth - rect.width - 10;
      }

      // Adjust vertical position
      if (y + rect.height > viewportHeight - 10) {
        y = viewportHeight - rect.height - 10;
      }

      setAdjustedPosition({ x, y });
    }
  }, [position]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose();
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Handlers
  const handleCut = useCallback(() => {
    // Copy to clipboard then delete
    // Clipboard implementation would go here
    deleteSelected?.();
    onClose();
  }, [deleteSelected, onClose]);

  const handleCopy = useCallback(() => {
    // Copy to clipboard
    // Clipboard implementation would go here
    onClose();
  }, [onClose]);

  const handlePaste = useCallback(() => {
    // Paste from clipboard
    // Clipboard implementation would go here
    onClose();
  }, [onClose]);

  const handleDuplicate = useCallback(() => {
    duplicateSelected?.();
    onClose();
  }, [duplicateSelected, onClose]);

  const handleDelete = useCallback(() => {
    deleteSelected?.();
    onClose();
  }, [deleteSelected, onClose]);

  const handleSelectAll = useCallback(() => {
    selectAll?.();
    onClose();
  }, [selectAll, onClose]);

  const handleBringToFront = useCallback(() => {
    if (!selectedIds || selectedIds.length === 0) return;
    const maxZ = Math.max(...elements.map(el => el.zIndex || 0));
    selectedIds.forEach((id, i) => {
      updateElement(id, { zIndex: maxZ + i + 1 });
    });
    onClose();
  }, [selectedIds, elements, updateElement, onClose]);

  const handleSendToBack = useCallback(() => {
    if (!selectedIds || selectedIds.length === 0) return;
    const minZ = Math.min(...elements.map(el => el.zIndex || 0));
    selectedIds.forEach((id, i) => {
      updateElement(id, { zIndex: minZ - (selectedIds.length - i) });
    });
    onClose();
  }, [selectedIds, elements, updateElement, onClose]);

  const handleLock = useCallback(() => {
    if (targetElement) {
      updateElement(targetElement.id, { locked: !targetElement.locked });
    } else if (selectedIds) {
      selectedIds.forEach(id => {
        const el = elements.find(e => e.id === id);
        if (el) {
          updateElement(id, { locked: !el.locked });
        }
      });
    }
    onClose();
  }, [targetElement, selectedIds, elements, updateElement, onClose]);

  const handleAddComment = useCallback(() => {
    onAddComment?.(position);
    onClose();
  }, [position, onAddComment, onClose]);

  const handleConnect = useCallback(() => {
    if (targetElement) {
      setActiveTool('connect');
      onStartConnect?.(targetElement);
    }
    onClose();
  }, [targetElement, setActiveTool, onStartConnect, onClose]);

  const handleToggleGrid = useCallback(() => {
    setShowGrid(!showGrid);
    onClose();
  }, [showGrid, setShowGrid, onClose]);

  const handleToggleContextualToolbar = useCallback(() => {
    onToggleContextualToolbar?.();
    onClose();
  }, [onToggleContextualToolbar, onClose]);

  const handleToggleStencilPanel = useCallback(() => {
    onToggleStencilPanel?.();
    onClose();
  }, [onToggleStencilPanel, onClose]);

  const handleEdit = useCallback(() => {
    if (targetElement) {
      // Trigger edit mode for the element
      // This could be implemented through context
    }
    onClose();
  }, [targetElement, onClose]);

  const handleShowProperties = useCallback(() => {
    onShowProperties?.();
    onClose();
  }, [onShowProperties, onClose]);

  const handleToggleToolbar = useCallback(() => {
    onToggleContextualToolbar?.();
    onClose();
  }, [onToggleContextualToolbar, onClose]);

  if (!position) return null;

  const hasSelection = selectedIds && selectedIds.length > 0;
  const isElementTarget = !!targetElement;
  const isLocked = targetElement?.locked;

  return (
    <div
      ref={menuRef}
      className="ds-context-menu"
      style={{
        left: adjustedPosition.x,
        top: adjustedPosition.y,
      }}
    >
      {/* Element-specific actions */}
      {isElementTarget && (
        <>
          <button className="ds-context-item" onClick={handleEdit}>
            <EditIcon fontSize="small" />
            <span>Edit</span>
            <kbd>Enter</kbd>
          </button>
          <button className="ds-context-item" onClick={handleShowProperties}>
            <SettingsIcon fontSize="small" />
            <span>Properties</span>
            <kbd>P</kbd>
          </button>
          <button className="ds-context-item" onClick={handleToggleToolbar}>
            <TuneIcon fontSize="small" />
            <span>{showContextualToolbar ? 'Hide Toolbar' : 'Show Toolbar'}</span>
          </button>
          <button className="ds-context-item" onClick={handleConnect}>
            <span className="ds-context-icon">→</span>
            <span>Connect to...</span>
            <kbd>C</kbd>
          </button>
          <div className="ds-context-divider" />
        </>
      )}

      {/* Clipboard actions */}
      {hasSelection && (
        <>
          <button className="ds-context-item" onClick={handleCut}>
            <ContentCutIcon fontSize="small" />
            <span>Cut</span>
            <kbd>Ctrl+X</kbd>
          </button>
          <button className="ds-context-item" onClick={handleCopy}>
            <ContentCopyIcon fontSize="small" />
            <span>Copy</span>
            <kbd>Ctrl+C</kbd>
          </button>
        </>
      )}
      <button className="ds-context-item" onClick={handlePaste}>
        <ContentPasteIcon fontSize="small" />
        <span>Paste</span>
        <kbd>Ctrl+V</kbd>
      </button>
      {hasSelection && (
        <button className="ds-context-item" onClick={handleDuplicate}>
          <ContentCopyIcon fontSize="small" />
          <span>Duplicate</span>
          <kbd>Ctrl+D</kbd>
        </button>
      )}

      <div className="ds-context-divider" />

      {/* Selection actions */}
      <button className="ds-context-item" onClick={handleSelectAll}>
        <SelectAllIcon fontSize="small" />
        <span>Select All</span>
        <kbd>Ctrl+A</kbd>
      </button>

      {hasSelection && (
        <>
          <div className="ds-context-divider" />

          {/* Layer actions */}
          <button className="ds-context-item" onClick={handleBringToFront}>
            <FlipToFrontIcon fontSize="small" />
            <span>Bring to Front</span>
          </button>
          <button className="ds-context-item" onClick={handleSendToBack}>
            <FlipToBackIcon fontSize="small" />
            <span>Send to Back</span>
          </button>

          <div className="ds-context-divider" />

          {/* Lock/Unlock */}
          <button className="ds-context-item" onClick={handleLock}>
            {isLocked ? <LockOpenIcon fontSize="small" /> : <LockIcon fontSize="small" />}
            <span>{isLocked ? 'Unlock' : 'Lock'}</span>
          </button>

          <div className="ds-context-divider" />

          {/* Delete */}
          <button className="ds-context-item danger" onClick={handleDelete}>
            <DeleteOutlineIcon fontSize="small" />
            <span>Delete</span>
            <kbd>Del</kbd>
          </button>
        </>
      )}

      <div className="ds-context-divider" />

      {/* Canvas/view actions */}
      {!hasSelection && (
        <>
          <button className="ds-context-item" onClick={handleAddComment}>
            <ChatBubbleOutlineIcon fontSize="small" />
            <span>Add Comment</span>
            <kbd>M</kbd>
          </button>
          <button className="ds-context-item" onClick={handleToggleGrid}>
            <GridOnIcon fontSize="small" />
            <span>{showGrid ? 'Hide Grid' : 'Show Grid'}</span>
            <kbd>G</kbd>
          </button>
        </>
      )}
      {/* Style toolbar toggle - always visible so users can re-enable it */}
      <button className="ds-context-item" onClick={handleToggleContextualToolbar}>
        <TuneIcon fontSize="small" />
        <span>{showContextualToolbar ? 'Hide Style Toolbar' : 'Show Style Toolbar'}</span>
      </button>

      {/* View toggles - always visible */}
      <div className="ds-context-divider" />
      <button className="ds-context-item" onClick={handleToggleStencilPanel}>
        <DashboardIcon fontSize="small" />
        <span>{showStencilPanel ? 'Hide Stencil Panel' : 'Show Stencil Panel'}</span>
        <kbd>1</kbd>
      </button>

      <style jsx>{`
        .ds-context-menu {
          position: fixed;
          min-width: 200px;
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 10px;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
          padding: 6px;
          z-index: 300;
        }

        .ds-context-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 8px 12px;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--text);
          font-size: 13px;
          cursor: pointer;
          text-align: left;
          transition: background 0.15s ease;
        }

        .ds-context-item:hover {
          background: var(--accent-soft);
        }

        .ds-context-item.danger:hover {
          background: rgba(220, 38, 38, 0.1);
          color: #dc2626;
        }

        .ds-context-item span:first-of-type:not(.ds-context-icon) {
          flex: 1;
        }

        .ds-context-item kbd {
          font-family: inherit;
          font-size: 11px;
          color: var(--text-muted);
          background: var(--bg);
          padding: 2px 6px;
          border-radius: 4px;
          border: 1px solid var(--border);
        }

        .ds-context-icon {
          width: 20px;
          text-align: center;
        }

        .ds-context-divider {
          height: 1px;
          background: var(--border);
          margin: 4px 8px;
        }
      `}</style>
    </div>
  );
}

// Hook to manage context menu state
export function useContextMenu() {
  const [contextMenu, setContextMenu] = useState(null);

  const openContextMenu = useCallback((e, targetElement = null) => {
    e.preventDefault();
    setContextMenu({
      position: { x: e.clientX, y: e.clientY },
      targetElement,
    });
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  return {
    contextMenu,
    openContextMenu,
    closeContextMenu,
    isOpen: !!contextMenu,
  };
}

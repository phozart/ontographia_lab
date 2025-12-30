// components/diagram-studio/ui/CommandPalette.js
// Cmd+K command palette for quick actions and stencil search

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useDiagram } from '../DiagramContext';

// Action categories
const CATEGORIES = {
  add: { name: 'Add', icon: '+' },
  canvas: { name: 'Canvas', icon: '~' },
  selection: { name: 'Selection', icon: '[]' },
  view: { name: 'View', icon: '@' },
  file: { name: 'File', icon: '#' },
};

// Built-in commands
const COMMANDS = [
  // Canvas actions
  { id: 'zoom-in', name: 'Zoom In', category: 'view', shortcut: 'Cmd++', action: 'zoom-in' },
  { id: 'zoom-out', name: 'Zoom Out', category: 'view', shortcut: 'Cmd+-', action: 'zoom-out' },
  { id: 'zoom-fit', name: 'Zoom to Fit', category: 'view', shortcut: 'Cmd+0', action: 'zoom-fit' },
  { id: 'zoom-100', name: 'Zoom to 100%', category: 'view', shortcut: 'Cmd+1', action: 'zoom-100' },
  { id: 'toggle-grid', name: 'Toggle Grid', category: 'view', shortcut: 'Cmd+G', action: 'toggle-grid' },
  { id: 'toggle-minimap', name: 'Toggle Minimap', category: 'view', shortcut: 'Cmd+M', action: 'toggle-minimap' },

  // Selection actions
  { id: 'select-all', name: 'Select All', category: 'selection', shortcut: 'Cmd+A', action: 'select-all' },
  { id: 'deselect', name: 'Deselect All', category: 'selection', shortcut: 'Esc', action: 'deselect' },
  { id: 'delete-selected', name: 'Delete Selected', category: 'selection', shortcut: 'Delete', action: 'delete' },
  { id: 'duplicate', name: 'Duplicate', category: 'selection', shortcut: 'Cmd+D', action: 'duplicate' },
  { id: 'copy', name: 'Copy', category: 'selection', shortcut: 'Cmd+C', action: 'copy' },
  { id: 'paste', name: 'Paste', category: 'selection', shortcut: 'Cmd+V', action: 'paste' },

  // File actions
  { id: 'save', name: 'Save', category: 'file', shortcut: 'Cmd+S', action: 'save' },
  { id: 'export-svg', name: 'Export as SVG', category: 'file', action: 'export-svg' },
  { id: 'export-png', name: 'Export as PNG', category: 'file', action: 'export-png' },
  { id: 'export-json', name: 'Export as JSON', category: 'file', action: 'export-json' },

  // Canvas actions
  { id: 'focus-mode', name: 'Toggle Focus Mode', category: 'canvas', shortcut: 'F', action: 'focus-mode' },
  { id: 'toggle-left-panel', name: 'Toggle Left Panel', category: 'canvas', shortcut: '[', action: 'toggle-left' },
  { id: 'toggle-right-panel', name: 'Toggle Right Panel', category: 'canvas', shortcut: ']', action: 'toggle-right' },

  // Comment actions
  { id: 'add-comment', name: 'Add Comment', category: 'canvas', shortcut: 'K', action: 'add-comment' },
  { id: 'toggle-comments', name: 'Toggle Comment Visibility', category: 'canvas', shortcut: 'H', action: 'toggle-comments' },
];

export default function CommandPalette({
  isOpen,
  onClose,
  packRegistry,
  onAction,
}) {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef(null);
  const resultsRef = useRef(null);
  const { addElement, activePack } = useDiagram();

  // Get all stencils from pack registry
  const allStencils = useMemo(() => {
    if (!packRegistry?.getAll) return [];
    const stencils = [];
    packRegistry.getAll().forEach(pack => {
      if (pack?.stencils) {
        pack.stencils.forEach(stencil => {
          stencils.push({
            id: `add-${pack.id}-${stencil.id}`,
            name: stencil.name,
            category: 'add',
            description: `${pack.name} / ${stencil.group || 'Elements'}`,
            stencil: { ...stencil, packId: pack.id },
          });
        });
      }
    });
    return stencils;
  }, [packRegistry]);

  // Combine commands and stencils for search
  const allItems = useMemo(() => {
    return [...COMMANDS, ...allStencils];
  }, [allStencils]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!search) {
      // Show recent/common commands when no search
      return COMMANDS.slice(0, 10);
    }

    const term = search.toLowerCase();
    const matches = allItems.filter(item => {
      const nameMatch = item.name.toLowerCase().includes(term);
      const descMatch = item.description?.toLowerCase().includes(term);
      const categoryMatch = item.category.toLowerCase().includes(term);
      return nameMatch || descMatch || categoryMatch;
    });

    // Sort: exact matches first, then by category relevance
    matches.sort((a, b) => {
      const aExact = a.name.toLowerCase().startsWith(term);
      const bExact = b.name.toLowerCase().startsWith(term);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return 0;
    });

    return matches.slice(0, 20);
  }, [allItems, search]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setSearch('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev < filteredItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev =>
          prev > 0 ? prev - 1 : filteredItems.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        onClose();
        break;
    }
  }, [filteredItems, selectedIndex, onClose]);

  // Execute a command or add a stencil
  const executeItem = useCallback((item) => {
    if (item.stencil) {
      // Add stencil to canvas
      const stencil = item.stencil;
      addElement({
        type: stencil.id,
        packId: stencil.packId,
        name: stencil.name,
        label: stencil.name,
        x: 400 + Math.random() * 100,
        y: 300 + Math.random() * 100,
        size: stencil.defaultSize || { width: 120, height: 60 },
        color: stencil.color,
      });
    } else if (item.action) {
      onAction?.(item.action);
    }
    onClose();
  }, [addElement, onAction, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const container = resultsRef.current;
    const selected = container?.querySelector('.active');
    if (selected && container) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // This would need to be triggered from parent
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const content = (
    <div className="ds-command-palette-overlay" onClick={onClose}>
      <div
        className="ds-command-palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input */}
        <div className="ds-command-palette-header">
          <input
            ref={inputRef}
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search commands, stencils..."
            className="ds-command-palette-input"
          />
          <div className="ds-command-palette-hint">
            <span className="ds-command-palette-key">Esc</span>
            <span>to close</span>
          </div>
        </div>

        {/* Results */}
        <div className="ds-command-palette-results" ref={resultsRef}>
          {filteredItems.length === 0 ? (
            <div className="ds-command-palette-empty">
              No results for "{search}"
            </div>
          ) : (
            <>
              {/* Group by category */}
              {Object.entries(
                filteredItems.reduce((acc, item) => {
                  if (!acc[item.category]) acc[item.category] = [];
                  acc[item.category].push(item);
                  return acc;
                }, {})
              ).map(([category, items]) => (
                <div key={category} className="ds-command-palette-group">
                  <div className="ds-command-palette-category">
                    <span>{CATEGORIES[category]?.icon || '#'}</span>
                    <span>{CATEGORIES[category]?.name || category}</span>
                  </div>
                  {items.map((item, idx) => {
                    const globalIndex = filteredItems.indexOf(item);
                    return (
                      <div
                        key={item.id}
                        className={`ds-command-palette-item ${globalIndex === selectedIndex ? 'active' : ''}`}
                        onClick={() => executeItem(item)}
                        onMouseEnter={() => setSelectedIndex(globalIndex)}
                      >
                        <div className="ds-command-palette-item-icon">
                          {item.stencil?.icon || (
                            category === 'add' ? '+' :
                            category === 'view' ? '~' :
                            category === 'selection' ? '[]' :
                            category === 'file' ? '#' : '>'
                          )}
                        </div>
                        <div className="ds-command-palette-item-text">
                          <div className="ds-command-palette-item-name">{item.name}</div>
                          {item.description && (
                            <div className="ds-command-palette-item-description">
                              {item.description}
                            </div>
                          )}
                        </div>
                        {item.shortcut && (
                          <div className="ds-command-palette-shortcut">
                            {item.shortcut.split('+').map((key, i) => (
                              <span key={i} className="ds-command-palette-key">
                                {key === 'Cmd' ? '⌘' : key}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="ds-command-palette-footer">
          <div className="ds-command-palette-footer-hint">
            <span className="ds-command-palette-key">↑↓</span>
            <span>Navigate</span>
          </div>
          <div className="ds-command-palette-footer-hint">
            <span className="ds-command-palette-key">Enter</span>
            <span>Select</span>
          </div>
          <div className="ds-command-palette-footer-hint">
            <span className="ds-command-palette-key">Esc</span>
            <span>Close</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .ds-command-palette-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.4);
          backdrop-filter: blur(4px);
          z-index: var(--ds-z-command-palette, 600);
          display: flex;
          justify-content: center;
          padding-top: 15vh;
        }

        .ds-command-palette {
          width: 560px;
          max-width: 90vw;
          max-height: 70vh;
          background: var(--ds-surface-floating, var(--panel));
          backdrop-filter: blur(24px);
          border-radius: 16px;
          box-shadow: var(--ds-shadow-floating, 0 24px 48px rgba(0,0,0,0.2));
          border: 1px solid rgba(255, 255, 255, 0.1);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: commandPaletteIn 0.15s ease-out;
        }

        @keyframes commandPaletteIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        .ds-command-palette-header {
          display: flex;
          align-items: center;
          padding: 4px 16px;
          border-bottom: 1px solid var(--border);
        }

        .ds-command-palette-input {
          flex: 1;
          padding: 16px 0;
          font-size: 17px;
          background: transparent;
          border: none;
          color: var(--text);
          outline: none;
        }

        .ds-command-palette-input::placeholder {
          color: var(--text-muted);
        }

        .ds-command-palette-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }

        .ds-command-palette-results {
          flex: 1;
          overflow-y: auto;
          padding: 8px;
        }

        .ds-command-palette-empty {
          padding: 40px 20px;
          text-align: center;
          color: var(--text-muted);
        }

        .ds-command-palette-group {
          margin-bottom: 12px;
        }

        .ds-command-palette-category {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          font-size: 11px;
          font-weight: 600;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .ds-command-palette-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.1s ease;
        }

        .ds-command-palette-item:hover,
        .ds-command-palette-item.active {
          background: var(--accent-soft);
        }

        .ds-command-palette-item-icon {
          width: 32px;
          height: 32px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 8px;
          background: var(--bg);
          font-size: 14px;
          color: var(--text-muted);
        }

        .ds-command-palette-item.active .ds-command-palette-item-icon {
          background: var(--accent);
          color: white;
        }

        .ds-command-palette-item-text {
          flex: 1;
          min-width: 0;
        }

        .ds-command-palette-item-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
        }

        .ds-command-palette-item-description {
          font-size: 12px;
          color: var(--text-muted);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .ds-command-palette-shortcut {
          display: flex;
          gap: 4px;
        }

        .ds-command-palette-key {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 22px;
          height: 22px;
          padding: 0 6px;
          font-size: 11px;
          font-family: var(--ds-font-mono, monospace);
          background: var(--bg);
          border-radius: 4px;
          color: var(--text-muted);
        }

        .ds-command-palette-footer {
          display: flex;
          gap: 16px;
          padding: 10px 16px;
          border-top: 1px solid var(--border);
          background: var(--bg);
        }

        .ds-command-palette-footer-hint {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: var(--text-muted);
        }
      `}</style>
    </div>
  );

  // Render in portal
  if (typeof document !== 'undefined') {
    return createPortal(content, document.body);
  }
  return null;
}

// Hook for command palette management
export function useCommandPalette() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen(prev => !prev),
  };
}

// components/diagram-studio/ui/ShortcutsHelp.js
// Keyboard shortcuts help panel

import { useState, useEffect, useCallback } from 'react';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import SearchIcon from '@mui/icons-material/Search';

const SHORTCUT_CATEGORIES = [
  {
    name: 'Tools',
    shortcuts: [
      { keys: ['V'], description: 'Select tool' },
      { keys: ['C'], description: 'Connect tool' },
      { keys: ['Space'], description: 'Pan tool (hold)' },
      { keys: ['K'], description: 'Comment mode' },
      { keys: ['H'], description: 'Toggle comments visibility' },
    ],
  },
  {
    name: 'Selection',
    shortcuts: [
      { keys: ['Ctrl', 'A'], description: 'Select all' },
      { keys: ['Esc'], description: 'Deselect all / Cancel' },
      { keys: ['Tab'], description: 'Select next element' },
      { keys: ['Shift', 'Tab'], description: 'Select previous element' },
      { keys: ['Click'], description: 'Select element' },
      { keys: ['Shift', 'Click'], description: 'Add to selection' },
    ],
  },
  {
    name: 'Editing',
    shortcuts: [
      { keys: ['Delete'], description: 'Delete selected' },
      { keys: ['Backspace'], description: 'Delete selected' },
      { keys: ['Ctrl', 'D'], description: 'Duplicate selected' },
      { keys: ['Ctrl', 'C'], description: 'Copy' },
      { keys: ['Ctrl', 'V'], description: 'Paste' },
      { keys: ['Ctrl', 'X'], description: 'Cut' },
      { keys: ['Ctrl', 'Z'], description: 'Undo' },
      { keys: ['Ctrl', 'Y'], description: 'Redo' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: 'Redo' },
      { keys: ['T'], description: 'Connection toolbar' },
    ],
  },
  {
    name: 'View',
    shortcuts: [
      { keys: ['Ctrl', '+'], description: 'Zoom in' },
      { keys: ['Ctrl', '-'], description: 'Zoom out' },
      { keys: ['0'], description: 'Fit all to screen' },
      { keys: ['Ctrl', '0'], description: 'Zoom to selection' },
      { keys: ['F'], description: 'Fit all to screen' },
      { keys: ['G'], description: 'Toggle grid' },
    ],
  },
  {
    name: 'Panels',
    shortcuts: [
      { keys: ['['], description: 'Toggle left panel' },
      { keys: [']'], description: 'Toggle right panel' },
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['?'], description: 'Show keyboard shortcuts' },
    ],
  },
  {
    name: 'File',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: 'Save' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Save as...' },
      { keys: ['Ctrl', 'E'], description: 'Export' },
    ],
  },
  {
    name: 'Navigation',
    shortcuts: [
      { keys: ['Arrow keys'], description: 'Move selected elements' },
      { keys: ['Shift', 'Arrow'], description: 'Move by 10px' },
      { keys: ['Home'], description: 'Pan to origin' },
      { keys: ['Alt', 'W'], description: 'Workspace switcher' },
    ],
  },
];

export default function ShortcutsHelp({ isOpen, onClose }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredCategories, setFilteredCategories] = useState(SHORTCUT_CATEGORIES);

  // Filter shortcuts based on search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCategories(SHORTCUT_CATEGORIES);
      return;
    }

    const term = searchTerm.toLowerCase();
    const filtered = SHORTCUT_CATEGORIES.map(category => ({
      ...category,
      shortcuts: category.shortcuts.filter(shortcut =>
        shortcut.description.toLowerCase().includes(term) ||
        shortcut.keys.some(key => key.toLowerCase().includes(term))
      ),
    })).filter(category => category.shortcuts.length > 0);

    setFilteredCategories(filtered);
  }, [searchTerm]);

  // Handle Escape key to close panel
  // Note: '?' key handling moved to KeyboardShortcutsOverlay component
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset search when closing
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="ds-shortcuts-overlay" onClick={onClose}>
      <div className="ds-shortcuts-panel" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="ds-shortcuts-header">
          <div className="ds-shortcuts-title">
            <KeyboardIcon />
            <h2>Keyboard Shortcuts</h2>
          </div>
          <button className="ds-shortcuts-close" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>

        {/* Search */}
        <div className="ds-shortcuts-search">
          <SearchIcon className="ds-shortcuts-search-icon" />
          <input
            type="text"
            placeholder="Search shortcuts..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
          />
        </div>

        {/* Shortcuts List */}
        <div className="ds-shortcuts-content">
          {filteredCategories.length === 0 ? (
            <div className="ds-shortcuts-empty">
              No shortcuts found for "{searchTerm}"
            </div>
          ) : (
            <div className="ds-shortcuts-grid">
              {filteredCategories.map(category => (
                <div key={category.name} className="ds-shortcuts-category">
                  <h3>{category.name}</h3>
                  <div className="ds-shortcuts-list">
                    {category.shortcuts.map((shortcut, idx) => (
                      <div key={idx} className="ds-shortcut-item">
                        <span className="ds-shortcut-desc">
                          {shortcut.description}
                        </span>
                        <div className="ds-shortcut-keys">
                          {shortcut.keys.map((key, keyIdx) => (
                            <span key={keyIdx}>
                              <kbd>{key}</kbd>
                              {keyIdx < shortcut.keys.length - 1 && ' + '}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ds-shortcuts-footer">
          <span>Press <kbd>?</kbd> to toggle this panel</span>
        </div>
      </div>

      <style jsx>{`
        .ds-shortcuts-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 40px;
        }

        .ds-shortcuts-panel {
          width: 100%;
          max-width: 800px;
          max-height: calc(100vh - 80px);
          background: var(--panel);
          border-radius: 16px;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .ds-shortcuts-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 20px 24px;
          border-bottom: 1px solid var(--border);
        }

        .ds-shortcuts-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ds-shortcuts-title h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text);
        }

        .ds-shortcuts-close {
          width: 36px;
          height: 36px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--text-muted);
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .ds-shortcuts-close:hover {
          background: var(--bg);
          color: var(--text);
        }

        .ds-shortcuts-search {
          position: relative;
          padding: 16px 24px;
          border-bottom: 1px solid var(--border);
        }

        .ds-shortcuts-search-icon {
          position: absolute;
          left: 36px;
          top: 50%;
          transform: translateY(-50%);
          color: var(--text-muted);
          font-size: 20px;
        }

        .ds-shortcuts-search input {
          width: 100%;
          padding: 10px 12px 10px 40px;
          font-size: 14px;
          border: 1px solid var(--border);
          border-radius: 8px;
          background: var(--bg);
          color: var(--text);
          outline: none;
          transition: border-color 0.15s ease;
        }

        .ds-shortcuts-search input:focus {
          border-color: var(--accent);
        }

        .ds-shortcuts-content {
          flex: 1;
          overflow: auto;
          padding: 24px;
        }

        .ds-shortcuts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 24px;
        }

        .ds-shortcuts-category h3 {
          font-size: 12px;
          font-weight: 600;
          color: var(--accent);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin: 0 0 12px 0;
        }

        .ds-shortcuts-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ds-shortcut-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          background: var(--bg);
          border-radius: 8px;
          gap: 16px;
        }

        .ds-shortcut-desc {
          font-size: 13px;
          color: var(--text);
        }

        .ds-shortcut-keys {
          display: flex;
          align-items: center;
          gap: 4px;
          flex-shrink: 0;
        }

        .ds-shortcut-keys kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 24px;
          height: 24px;
          padding: 0 8px;
          font-family: inherit;
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted);
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 6px;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
        }

        .ds-shortcuts-empty {
          text-align: center;
          padding: 40px;
          color: var(--text-muted);
          font-size: 14px;
        }

        .ds-shortcuts-footer {
          padding: 16px 24px;
          border-top: 1px solid var(--border);
          text-align: center;
          font-size: 12px;
          color: var(--text-muted);
        }

        .ds-shortcuts-footer kbd {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          font-family: inherit;
          font-size: 11px;
          color: var(--text-muted);
          background: var(--bg);
          border: 1px solid var(--border);
          border-radius: 4px;
          margin: 0 4px;
        }
      `}</style>
    </div>
  );
}

// Hook to open shortcuts help
// Note: This hook no longer listens for '?' key - that is now handled by KeyboardShortcutsOverlay
export function useShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}

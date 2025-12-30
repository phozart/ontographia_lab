// components/diagram-studio/ui/DropdownMenu.js
// Reusable dropdown menu component

import { useState, useRef, useEffect, useCallback } from 'react';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * DropdownMenu - A clean, hierarchical dropdown menu component
 *
 * Usage:
 * <DropdownMenu
 *   trigger={<button>Open Menu</button>}
 *   items={[
 *     { id: 'item1', label: 'Item 1', icon: <Icon />, shortcut: 'Cmd+1', onClick: () => {} },
 *     { id: 'item2', label: 'Item 2', disabled: true },
 *     { type: 'divider' },
 *     { id: 'submenu', label: 'Submenu', items: [...] },
 *   ]}
 * />
 */
export default function DropdownMenu({
  trigger,
  items,
  align = 'left', // 'left', 'right', 'center'
  direction = 'down', // 'down', 'up'
  className = '',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);
  const triggerRef = useRef(null);

  // Close menu on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target) &&
          triggerRef.current && !triggerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close menu on Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleItemClick = useCallback((item) => {
    if (item.disabled || item.items) return;
    item.onClick?.();
    setIsOpen(false);
  }, []);

  return (
    <div className={`ds-dropdown ${className}`}>
      <div ref={triggerRef} onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>

      {isOpen && (
        <div
          ref={menuRef}
          className={`ds-dropdown-menu ds-dropdown-${align} ds-dropdown-${direction}`}
        >
          {items.map((item, index) => (
            <MenuItem
              key={item.id || `divider-${index}`}
              item={item}
              onItemClick={handleItemClick}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .ds-dropdown {
          position: relative;
          display: inline-block;
        }

        .ds-dropdown-menu {
          position: absolute;
          min-width: 180px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12), 0 0 0 1px rgba(0, 0, 0, 0.04));
          padding: 4px;
          z-index: 1000;
          animation: menuFadeIn 0.15s ease-out;
        }

        @keyframes menuFadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ds-dropdown-left {
          left: 0;
        }

        .ds-dropdown-right {
          right: 0;
        }

        .ds-dropdown-center {
          left: 50%;
          transform: translateX(-50%);
        }

        .ds-dropdown-down {
          top: calc(100% + 4px);
        }

        .ds-dropdown-up {
          bottom: calc(100% + 4px);
        }
      `}</style>
    </div>
  );
}

// Individual menu item component
function MenuItem({ item, onItemClick }) {
  const [showSubmenu, setShowSubmenu] = useState(false);
  const itemRef = useRef(null);

  // Divider
  if (item.type === 'divider') {
    return <div className="ds-menu-divider" />;
  }

  // Label/header
  if (item.type === 'label') {
    return (
      <div className="ds-menu-label">
        {item.label}
      </div>
    );
  }

  const hasSubmenu = item.items && item.items.length > 0;

  return (
    <div
      ref={itemRef}
      className={`ds-menu-item ${item.disabled ? 'disabled' : ''} ${item.active ? 'active' : ''}`}
      onClick={() => !hasSubmenu && onItemClick(item)}
      onMouseEnter={() => hasSubmenu && setShowSubmenu(true)}
      onMouseLeave={() => hasSubmenu && setShowSubmenu(false)}
    >
      {/* Icon */}
      {item.icon && (
        <span className="ds-menu-item-icon">
          {item.icon}
        </span>
      )}

      {/* Label */}
      <span className="ds-menu-item-label">
        {item.label}
      </span>

      {/* Shortcut or Submenu Arrow */}
      {item.shortcut && !hasSubmenu && (
        <span className="ds-menu-item-shortcut">
          {item.shortcut}
        </span>
      )}

      {hasSubmenu && (
        <span className="ds-menu-item-arrow">
          <ChevronRightIcon fontSize="small" />
        </span>
      )}

      {/* Submenu */}
      {hasSubmenu && showSubmenu && (
        <div className="ds-submenu">
          {item.items.map((subItem, index) => (
            <MenuItem
              key={subItem.id || `divider-${index}`}
              item={subItem}
              onItemClick={onItemClick}
            />
          ))}
        </div>
      )}

      <style jsx>{`
        .ds-menu-divider {
          height: 1px;
          background: rgba(0, 0, 0, 0.08);
          margin: 4px 0;
        }

        .ds-menu-label {
          padding: 6px 12px 4px;
          font-size: 10px;
          font-weight: 600;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: var(--text-muted, #6b7280);
        }

        .ds-menu-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 12px;
          border-radius: 6px;
          cursor: pointer;
          transition: all 0.15s ease;
          position: relative;
        }

        .ds-menu-item:hover:not(.disabled) {
          background: var(--ds-hover-bg, rgba(0, 0, 0, 0.04));
        }

        .ds-menu-item.active {
          background: var(--ds-active-bg, rgba(14, 116, 163, 0.1));
          color: var(--ds-active-color, #0e74a3);
        }

        .ds-menu-item.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .ds-menu-item-icon {
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted, #6b7280);
        }

        .ds-menu-item:hover:not(.disabled) .ds-menu-item-icon {
          color: inherit;
        }

        .ds-menu-item-label {
          flex: 1;
          font-size: 13px;
          color: var(--text, #1f2937);
        }

        .ds-menu-item.disabled .ds-menu-item-label {
          color: var(--text-muted, #6b7280);
        }

        .ds-menu-item-shortcut {
          font-size: 11px;
          font-family: var(--ds-font-mono, monospace);
          color: var(--text-muted, #6b7280);
          background: var(--bg, #f9fafb);
          padding: 2px 6px;
          border-radius: 4px;
        }

        .ds-menu-item-arrow {
          color: var(--text-muted, #6b7280);
        }

        .ds-submenu {
          position: absolute;
          left: 100%;
          top: 0;
          min-width: 160px;
          background: white;
          border-radius: 8px;
          box-shadow: var(--ds-shadow-flyout, 0 4px 24px rgba(0, 0, 0, 0.12));
          padding: 4px;
          margin-left: 4px;
        }
      `}</style>
    </div>
  );
}

// Export MenuItem for use in custom menus
export { MenuItem };

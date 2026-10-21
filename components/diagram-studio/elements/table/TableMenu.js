// components/diagram-studio/elements/table/TableMenu.js
// Small popover menu used by the table element (column, row and table options). Rendered inside the table node so it
// pans and zooms with the board. Closes on Escape, on an outside press and after a choice.

import React, { useEffect, useRef } from 'react';

/**
 * @param {{left: number, top: number, label: string, items: Array<{label?: string, onSelect?: () => void, disabled?: boolean, checked?: boolean, danger?: boolean, separator?: boolean}>, onClose: () => void}} props
 */
export default function TableMenu({ left, top, label, items, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); onClose(); }
    };
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    ref.current?.querySelector('button:not([disabled])')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [onClose]);

  const onMenuKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...ref.current.querySelectorAll('button:not([disabled])')];
    const i = buttons.indexOf(document.activeElement);
    const next = buttons[(i + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length];
    next?.focus({ preventScroll: true });
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <div
      ref={ref}
      className="ds-tbl-menu"
      role="menu"
      aria-label={label}
      data-testid="table-menu"
      style={{ left, top }}
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      onKeyDown={onMenuKey}
    >
      {items.map((it, i) =>
        it.separator ? (
          <div key={`sep-${i}`} className="ds-tbl-menu-sep" role="separator" />
        ) : (
          <button
            key={it.label}
            type="button"
            role={it.checked !== undefined ? 'menuitemradio' : 'menuitem'}
            aria-checked={it.checked}
            disabled={it.disabled}
            className={`ds-tbl-menu-item${it.danger ? ' danger' : ''}`}
            onClick={() => { onClose(); it.onSelect?.(); }}
          >
            <span className="ds-tbl-menu-check" aria-hidden="true">{it.checked ? '✓' : ''}</span>
            {it.label}
          </button>
        )
      )}
    </div>
  );
}

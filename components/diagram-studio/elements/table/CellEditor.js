// components/diagram-studio/elements/table/CellEditor.js
// Inline editor for one table cell (or column name). Keyboard contract (spreadsheet-like):
//   Enter / Shift+Enter  commit and move down / up       Tab / Shift+Tab  commit and move right / left
//   Alt+Enter or Ctrl+Enter  newline in a text cell      Escape           leave without committing
//   blur  commit in place (an invalid value is dropped with a notice)
// Pasting a spreadsheet range into the editor hands the text to the table (it fills cells from here).

import React, { useEffect, useRef, useState } from 'react';
import { looksTabular } from '../../../../lib/table/tableCsv';

/**
 * @param {{type: 'text'|'number'|'select'|'boolean'|'name', initial: string, options?: string[], invalidMessage?: string,
 *          onCommit: (raw: string, nav: 'down'|'up'|'right'|'left'|null) => boolean, onCancel: () => void,
 *          onPasteText?: (text: string) => void, label: string}} props
 */
export default function CellEditor({ type, initial, options = [], onCommit, onCancel, onPasteText, label }) {
  const [draft, setDraft] = useState(initial);
  const [invalid, setInvalid] = useState(false);
  const ref = useRef(null);
  const done = useRef(false);
  const listId = useRef(`tbl-opts-${Math.random().toString(36).slice(2, 8)}`).current;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    // renaming a column replaces its name; editing a cell keeps the text and puts the caret at the end
    if (type === 'name') el.select();
    else el.setSelectionRange?.(el.value.length, el.value.length);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const finish = (nav) => {
    if (done.current) return;
    done.current = true;
    const ok = onCommit(draft, nav);
    if (ok === false) {
      if (nav === null) { onCancel(); return; } // blur with an invalid value: drop it (the owner shows why)
      done.current = false;
      setInvalid(true);
    }
  };

  const onKeyDown = (e) => {
    e.stopPropagation(); // typing never reaches the board's single-key shortcuts
    if (e.key === 'Escape') {
      e.preventDefault();
      done.current = true;
      onCancel();
    } else if (e.key === 'Enter') {
      if ((e.altKey || e.ctrlKey || e.metaKey) && ref.current?.tagName === 'TEXTAREA') {
        e.preventDefault();
        const el = ref.current;
        const s = el.selectionStart;
        const t = el.selectionEnd;
        setDraft(`${draft.slice(0, s)}\n${draft.slice(t)}`);
        requestAnimationFrame(() => el.setSelectionRange(s + 1, s + 1));
      } else {
        e.preventDefault();
        finish(e.shiftKey ? 'up' : 'down');
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      finish(e.shiftKey ? 'left' : 'right');
    }
  };

  const onPaste = (e) => {
    const text = e.clipboardData?.getData('text/plain');
    if (onPasteText && looksTabular(text)) {
      e.preventDefault();
      done.current = true;
      onPasteText(text);
    }
  };

  const common = {
    ref,
    value: draft,
    'aria-label': label,
    'aria-invalid': invalid || undefined,
    className: `ds-tbl-editor${invalid ? ' invalid' : ''}`,
    onChange: (e) => { setDraft(e.target.value); setInvalid(false); },
    onKeyDown,
    onPaste,
    onBlur: () => finish(null),
    onMouseDown: (e) => e.stopPropagation(),
    onClick: (e) => e.stopPropagation(),
    onDoubleClick: (e) => e.stopPropagation(),
  };

  if (type === 'text') return <textarea {...common} rows={1} data-testid="table-cell-editor" />;
  return (
    <>
      <input
        {...common}
        type="text"
        inputMode={type === 'number' ? 'decimal' : undefined}
        list={type === 'select' && options.length ? listId : undefined}
        data-testid="table-cell-editor"
      />
      {type === 'select' && options.length > 0 && (
        <datalist id={listId}>{options.map((o) => <option key={o} value={o} />)}</datalist>
      )}
    </>
  );
}

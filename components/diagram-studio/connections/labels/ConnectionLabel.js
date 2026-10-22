// components/diagram-studio/connections/labels/ConnectionLabel.js
// Mid-section label component for connections (inline editable per CLAUDE.md spec)
//
// ADR-0008 5 / T2: the label is `auto` text (at most 200 px wide, wrapped, at most 3 lines): the background is the measured
// lines plus padding, the lines are pinned tspans from the shared layout (SvgTextBlock), and a clamped label ends in an
// ellipsis with the full text as its tooltip. The caller (Connection) keeps the label clear of nodes.

import React, { useState, useEffect, useRef, useMemo } from 'react';
import SvgTextBlock from '../../text/SvgTextBlock';
import { connectionLabelLayout } from '../../../../lib/text/connectionLabel';

const PLACEHOLDER = 'Double-click to label';

/**
 * Mid-section label for connections
 * - Displays at the center of the connection
 * - Inline editable via double-click
 * - This is the semantic core of the connection (per CLAUDE.md spec)
 * `labelBox` ({layout, width, height, textBox}) may be passed by the caller that already measured it (it needs the size to
 * place the label); otherwise it is measured here.
 */
export default function ConnectionLabel({
  value = '',
  position,
  isSelected = false,
  isEditing = false,
  onDoubleClick,
  onChange,
  onEditComplete,
  readOnly = false,
  labelBox,
  leader,
}) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  // Sync local value when prop changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const showPlaceholder = !value && isSelected && !readOnly;
  const text = value || (showPlaceholder ? PLACEHOLDER : '');
  const own = useMemo(() => (labelBox && value ? labelBox : connectionLabelLayout(text)), [labelBox, value, text]);

  if (!position) return null;

  // Prevent events from bubbling to canvas
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      onEditComplete?.(localValue);
    } else if (e.key === 'Escape') {
      setLocalValue(value); // Revert
      onEditComplete?.(value);
    }
  };

  const handleBlur = () => {
    onEditComplete?.(localValue);
  };

  // Editing mode - show input
  if (isEditing) {
    const editW = Math.max(120, own.width || 0);
    return (
      <foreignObject
        x={position.x - editW / 2}
        y={position.y - 12}
        width={editW}
        height={24}
      >
        <input
          ref={inputRef}
          type="text"
          className="ds-conn-label-input"
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            onChange?.(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          onKeyUp={stopPropagation}
          onBlur={handleBlur}
          onClick={stopPropagation}
          onMouseDown={stopPropagation}
          placeholder="Enter label..."
        />
      </foreignObject>
    );
  }

  // If no value and not selected, don't render anything
  if (!value && !isSelected) return null;

  const { layout, width, height, textBox } = own;
  // A selected empty label shows the placeholder in a dashed chip, a label shows its measured lines
  const w = width || 100;
  const h = height || 20;
  const x0 = position.x - w / 2;
  const y0 = position.y - h / 2;

  // Display mode - show label or placeholder
  return (
    <g
      className="connection-label"
      style={{ cursor: readOnly ? 'default' : 'text' }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (!readOnly) {
          onDoubleClick?.();
        }
      }}
      onClick={stopPropagation}
      onMouseDown={stopPropagation}
    >
      {/* Leader tick: a label that had to move clear of a node still points at its line */}
      {leader && (
        <line
          className="ds-conn-label-leader"
          x1={Math.min(Math.max(leader.x, x0), x0 + w)}
          y1={Math.min(Math.max(leader.y, y0), y0 + h)}
          x2={leader.x}
          y2={leader.y}
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="2 2"
        />
      )}
      {/* Background rectangle */}
      <rect
        x={x0}
        y={y0}
        width={w}
        height={h}
        rx={4}
        fill="var(--bg)"
        stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={isSelected ? 1.5 : 1}
        strokeDasharray={!value && isSelected ? '3,3' : undefined}
      />

      {/* Label text or placeholder: pinned lines of the shared layout */}
      <SvgTextBlock
        layout={layout}
        x={x0 + textBox.x}
        y={y0 + textBox.y}
        fill={value ? 'var(--text)' : 'var(--text-muted)'}
        testId="connection-label"
      />
    </g>
  );
}

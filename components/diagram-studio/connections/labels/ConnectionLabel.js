// components/diagram-studio/connections/labels/ConnectionLabel.js
// Mid-section label component for connections (inline editable per CLAUDE.md spec)

import React, { useState, useEffect, useRef } from 'react';

/**
 * Mid-section label for connections
 * - Displays at the center of the connection
 * - Inline editable via double-click
 * - This is the semantic core of the connection (per CLAUDE.md spec)
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
    return (
      <foreignObject
        x={position.x - 60}
        y={position.y - 12}
        width={120}
        height={24}
      >
        <input
          ref={inputRef}
          type="text"
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
          style={{
            width: '100%',
            height: '100%',
            textAlign: 'center',
            fontSize: 12,
            border: '2px solid var(--accent)',
            borderRadius: 4,
            background: 'var(--bg)',
            color: 'var(--text)',
            outline: 'none',
            padding: '0 4px',
            boxSizing: 'border-box',
          }}
        />
      </foreignObject>
    );
  }

  // If no value and not selected, don't render anything
  if (!value && !isSelected) return null;

  // Calculate label dimensions
  const labelWidth = value ? Math.max(48, value.length * 8) : 100;
  const labelHeight = 20;

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
      {/* Background rectangle */}
      <rect
        x={position.x - labelWidth / 2}
        y={position.y - labelHeight / 2}
        width={labelWidth}
        height={labelHeight}
        rx={4}
        fill="var(--bg)"
        stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={isSelected ? 1.5 : 1}
        strokeDasharray={!value && isSelected ? '3,3' : undefined}
      />

      {/* Label text or placeholder */}
      <text
        x={position.x}
        y={position.y + 4}
        textAnchor="middle"
        fontSize={value ? 12 : 10}
        fill={value ? 'var(--text)' : 'var(--text-muted)'}
        style={{ pointerEvents: 'none' }}
      >
        {value || (isSelected && !readOnly ? 'Double-click to label' : '')}
      </text>
    </g>
  );
}

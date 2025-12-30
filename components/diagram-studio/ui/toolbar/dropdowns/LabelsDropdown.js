// components/diagram-studio/ui/toolbar/dropdowns/LabelsDropdown.js

import React from 'react';
import { DropdownMenu, SectionLabel } from '../ToolbarPrimitives';

function LabelInput({ label, value, onChange, placeholder }) {
  // Stop all events from bubbling to prevent canvas actions (delete, deselect)
  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <label style={{ display: 'block', fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
        {label}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={stopPropagation}
        onKeyUp={stopPropagation}
        onMouseDown={stopPropagation}
        onClick={stopPropagation}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 32,
          padding: '0 8px',
          border: '1px solid #e5e7eb',
          borderRadius: 6,
          fontSize: 13,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export default function LabelsDropdown({ label, sourceLabel, targetLabel, onUpdate }) {
  return (
    <DropdownMenu style={{ minWidth: 200, padding: 12 }}>
      <SectionLabel>CONNECTION LABELS</SectionLabel>
      <LabelInput
        label="Source Label"
        value={sourceLabel}
        onChange={(val) => onUpdate({ sourceLabel: val })}
        placeholder="Start label..."
      />
      <LabelInput
        label="Middle Label"
        value={label}
        onChange={(val) => onUpdate({ label: val })}
        placeholder="Center label..."
      />
      <LabelInput
        label="Target Label"
        value={targetLabel}
        onChange={(val) => onUpdate({ targetLabel: val })}
        placeholder="End label..."
      />
      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
        Tip: Double-click labels on canvas to edit inline
      </div>
    </DropdownMenu>
  );
}

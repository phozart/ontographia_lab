// components/diagram-studio/ui/toolbar/dropdowns/ColorPickerDropdown.js

import React, { useState } from 'react';
import { DropdownMenu, SectionLabel, ColorSwatch, PresetTab } from '../ToolbarPrimitives';
import { COLOR_PRESETS } from '../ConnectionConfig';

export default function ColorPickerDropdown({ stroke, strokeOpacity = 1, onUpdate }) {
  const [activePreset, setActivePreset] = useState('vibrant');
  const presetKeys = Object.keys(COLOR_PRESETS);

  // Stop events from bubbling to prevent canvas actions (delete, deselect)
  const stopPropagation = (e) => e.stopPropagation();

  return (
    <DropdownMenu style={{ minWidth: 220, padding: 12 }}>
      {/* Preset tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {presetKeys.map((key) => (
          <PresetTab key={key} active={activePreset === key} onClick={() => setActivePreset(key)}>
            {key}
          </PresetTab>
        ))}
      </div>

      {/* Color grid */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {COLOR_PRESETS[activePreset].map((color) => (
          <ColorSwatch
            key={color.hex}
            color={color.hex}
            active={stroke === color.hex}
            onClick={() => onUpdate({ stroke: color.hex })}
            title={color.name}
          />
        ))}
      </div>

      {/* Custom color */}
      <SectionLabel>CUSTOM COLOR</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <input
          type="color"
          value={stroke || '#374151'}
          onChange={(e) => onUpdate({ stroke: e.target.value })}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
          style={{ width: 32, height: 32, border: 'none', borderRadius: 4, cursor: 'pointer' }}
        />
        <input
          type="text"
          value={stroke || '#374151'}
          onChange={(e) => onUpdate({ stroke: e.target.value })}
          onKeyDown={stopPropagation}
          onKeyUp={stopPropagation}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
          style={{
            flex: 1,
            height: 32,
            padding: '0 8px',
            border: '1px solid #e5e7eb',
            borderRadius: 6,
            fontSize: 13,
            fontFamily: 'monospace',
          }}
        />
      </div>

      {/* Opacity slider */}
      <SectionLabel>OPACITY</SectionLabel>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="range"
          min="0"
          max="100"
          value={Math.round((strokeOpacity || 1) * 100)}
          onChange={(e) => onUpdate({ strokeOpacity: parseInt(e.target.value) / 100 })}
          onMouseDown={stopPropagation}
          onClick={stopPropagation}
          style={{ flex: 1 }}
        />
        <span style={{ fontSize: 12, color: '#6b7280', minWidth: 36, textAlign: 'right' }}>
          {Math.round((strokeOpacity || 1) * 100)}%
        </span>
      </div>
    </DropdownMenu>
  );
}

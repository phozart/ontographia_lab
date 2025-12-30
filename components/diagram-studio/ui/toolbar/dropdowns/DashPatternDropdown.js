// components/diagram-studio/ui/toolbar/dropdowns/DashPatternDropdown.js

import React from 'react';
import { DropdownMenu, OptionRow } from '../ToolbarPrimitives';
import { DashPatternIcon } from '../ConnectionIcons';
import { DASH_PATTERNS } from '../ConnectionConfig';

export default function DashPatternDropdown({ dashPattern, onUpdate }) {
  return (
    <DropdownMenu style={{ minWidth: 160 }}>
      {DASH_PATTERNS.map((pattern) => (
        <OptionRow
          key={pattern.id}
          active={dashPattern === pattern.id}
          onClick={() => onUpdate({ dashPattern: pattern.id })}
          label={pattern.label}
        >
          <DashPatternIcon pattern={pattern.id} active={dashPattern === pattern.id} />
        </OptionRow>
      ))}
    </DropdownMenu>
  );
}

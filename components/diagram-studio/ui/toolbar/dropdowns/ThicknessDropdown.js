// components/diagram-studio/ui/toolbar/dropdowns/ThicknessDropdown.js

import React from 'react';
import { DropdownMenu, OptionRow } from '../ToolbarPrimitives';
import { ThicknessIcon } from '../ConnectionIcons';
import { STROKE_WIDTHS } from '../ConnectionConfig';

export default function ThicknessDropdown({ strokeWidth, onUpdate }) {
  return (
    <DropdownMenu style={{ minWidth: 140 }}>
      {STROKE_WIDTHS.map((width) => (
        <OptionRow
          key={width}
          active={strokeWidth === width}
          onClick={() => onUpdate({ strokeWidth: width })}
          label={`${width}px`}
        >
          <ThicknessIcon width={width} active={strokeWidth === width} />
        </OptionRow>
      ))}
    </DropdownMenu>
  );
}

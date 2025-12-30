// components/diagram-studio/ui/toolbar/dropdowns/LineStyleDropdown.js

import React from 'react';
import { DropdownMenu, OptionRow } from '../ToolbarPrimitives';
import { LineStyleIcon } from '../ConnectionIcons';
import { LINE_STYLES } from '../ConnectionConfig';

export default function LineStyleDropdown({ lineStyle, onUpdate }) {
  return (
    <DropdownMenu style={{ minWidth: 180 }}>
      {LINE_STYLES.map((style) => (
        <OptionRow
          key={style.id}
          active={lineStyle === style.id}
          onClick={() => onUpdate({ lineStyle: style.id })}
          label={style.label}
        >
          <LineStyleIcon type={style.id} active={lineStyle === style.id} />
        </OptionRow>
      ))}
    </DropdownMenu>
  );
}

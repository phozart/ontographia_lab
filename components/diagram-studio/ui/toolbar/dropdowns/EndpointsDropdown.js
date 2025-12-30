// components/diagram-studio/ui/toolbar/dropdowns/EndpointsDropdown.js

import React from 'react';
import { DropdownMenu, IconBtn, SectionLabel } from '../ToolbarPrimitives';
import { MarkerIcon } from '../ConnectionIcons';
import { MARKER_TYPES } from '../ConnectionConfig';

export default function EndpointsDropdown({ sourceMarker, targetMarker, onUpdate }) {
  return (
    <DropdownMenu style={{ minWidth: 200 }}>
      <SectionLabel>START ENDPOINT</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 12 }}>
        {MARKER_TYPES.map((m) => (
          <IconBtn
            key={`src-${m.id}`}
            active={sourceMarker === m.id}
            onClick={() => onUpdate({ sourceMarker: m.id })}
            title={m.label}
          >
            <MarkerIcon type={m.id} size={18} color={sourceMarker === m.id ? '#2563eb' : '#6b7280'} />
          </IconBtn>
        ))}
      </div>
      <SectionLabel>END ENDPOINT</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {MARKER_TYPES.map((m) => (
          <IconBtn
            key={`tgt-${m.id}`}
            active={targetMarker === m.id}
            onClick={() => onUpdate({ targetMarker: m.id })}
            title={m.label}
          >
            <MarkerIcon type={m.id} size={18} color={targetMarker === m.id ? '#2563eb' : '#6b7280'} />
          </IconBtn>
        ))}
      </div>
    </DropdownMenu>
  );
}

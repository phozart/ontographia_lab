// components/diagram-studio/ui/toolbar/ConnectionToolbar.js
// Main connection toolbar that composes all dropdown components

import React, { useState, useRef, useEffect } from 'react';
import { DropdownBtn, Divider } from './ToolbarPrimitives';
import { MarkerIcon, LineStyleIcon, DashPatternIcon, ThicknessIcon, LabelIcon, DeleteIcon } from './ConnectionIcons';
import EndpointsDropdown from './dropdowns/EndpointsDropdown';
import LineStyleDropdown from './dropdowns/LineStyleDropdown';
import DashPatternDropdown from './dropdowns/DashPatternDropdown';
import ThicknessDropdown from './dropdowns/ThicknessDropdown';
import ColorPickerDropdown from './dropdowns/ColorPickerDropdown';
import LabelsDropdown from './dropdowns/LabelsDropdown';

export default function ConnectionToolbar({ connection, position, onUpdate, onDelete, onClose }) {
  const [openDropdown, setOpenDropdown] = useState(null);
  const toolbarRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleDropdown = (name) => {
    setOpenDropdown(openDropdown === name ? null : name);
  };

  const handleUpdate = (updates) => {
    onUpdate(updates);
  };

  const {
    sourceMarker = 'none',
    targetMarker = 'arrow',
    lineStyle = 'straight',
    dashPattern = 'solid',
    strokeWidth = 2,
    stroke = '#374151',
    strokeOpacity = 1,
    label = '',
    sourceLabel = '',
    targetLabel = '',
  } = connection;

  return (
    <div
      ref={toolbarRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        transform: 'translate(-50%, 0)',
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: '4px 6px',
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        zIndex: 1000,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      onKeyUp={(e) => e.stopPropagation()}
    >
      {/* Endpoints */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('endpoints')}
          title="Endpoints"
          isOpen={openDropdown === 'endpoints'}
        >
          <MarkerIcon type={sourceMarker} size={14} />
          <span style={{ margin: '0 2px', color: '#d1d5db' }}>—</span>
          <MarkerIcon type={targetMarker} size={14} />
        </DropdownBtn>
        {openDropdown === 'endpoints' && (
          <EndpointsDropdown
            sourceMarker={sourceMarker}
            targetMarker={targetMarker}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      <Divider />

      {/* Line Style */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('style')}
          title="Connection Style"
          isOpen={openDropdown === 'style'}
        >
          <LineStyleIcon type={lineStyle} size={18} />
        </DropdownBtn>
        {openDropdown === 'style' && (
          <LineStyleDropdown lineStyle={lineStyle} onUpdate={handleUpdate} />
        )}
      </div>

      {/* Dash Pattern */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('dash')}
          title="Line Type"
          isOpen={openDropdown === 'dash'}
        >
          <DashPatternIcon pattern={dashPattern} size={18} />
        </DropdownBtn>
        {openDropdown === 'dash' && (
          <DashPatternDropdown dashPattern={dashPattern} onUpdate={handleUpdate} />
        )}
      </div>

      {/* Thickness */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('thickness')}
          title="Line Thickness"
          isOpen={openDropdown === 'thickness'}
        >
          <ThicknessIcon width={strokeWidth} size={18} />
        </DropdownBtn>
        {openDropdown === 'thickness' && (
          <ThicknessDropdown strokeWidth={strokeWidth} onUpdate={handleUpdate} />
        )}
      </div>

      <Divider />

      {/* Color */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('color')}
          title="Color"
          isOpen={openDropdown === 'color'}
        >
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: stroke,
              opacity: strokeOpacity,
              border: stroke === '#ffffff' ? '1px solid #e5e7eb' : 'none',
            }}
          />
        </DropdownBtn>
        {openDropdown === 'color' && (
          <ColorPickerDropdown
            stroke={stroke}
            strokeOpacity={strokeOpacity}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      <Divider />

      {/* Labels */}
      <div style={{ position: 'relative' }}>
        <DropdownBtn
          onClick={() => toggleDropdown('labels')}
          title="Labels"
          isOpen={openDropdown === 'labels'}
        >
          <LabelIcon size={16} color={label || sourceLabel || targetLabel ? '#2563eb' : '#6b7280'} />
        </DropdownBtn>
        {openDropdown === 'labels' && (
          <LabelsDropdown
            label={label}
            sourceLabel={sourceLabel}
            targetLabel={targetLabel}
            onUpdate={handleUpdate}
          />
        )}
      </div>

      <Divider />

      {/* Delete */}
      <button
        onClick={onDelete}
        title="Delete Connection"
        style={{
          width: 32,
          height: 32,
          border: 'none',
          borderRadius: 6,
          background: 'transparent',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#6b7280',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          e.currentTarget.style.color = '#ef4444';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = '#6b7280';
        }}
      >
        <DeleteIcon size={16} />
      </button>
    </div>
  );
}

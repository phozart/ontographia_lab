// components/diagram-studio/ui/toolbar/ToolbarPrimitives.js
// Base reusable toolbar components

import React from 'react';

// Dropdown button with chevron
export function DropdownBtn({ onClick, title, children, isOpen, style = {} }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        height: 32,
        padding: '0 8px',
        border: 'none',
        borderRadius: 6,
        background: isOpen ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        transition: 'all 0.15s ease',
        fontSize: 12,
        color: '#374151',
        ...style,
      }}
      onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = 'rgba(0,0,0,0.05)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = isOpen ? 'rgba(37, 99, 235, 0.1)' : 'transparent'; }}
    >
      {children}
      <svg width="10" height="10" viewBox="0 0 10 10" style={{ marginLeft: 2 }}>
        <path d="M2 4 L5 7 L8 4" fill="none" stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

// Dropdown menu container
export function DropdownMenu({ children, style = {} }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: '50%',
        transform: 'translateX(-50%)',
        marginTop: 8,
        background: 'white',
        borderRadius: 10,
        boxShadow: '0 4px 24px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05)',
        padding: 8,
        zIndex: 100,
        minWidth: 160,
        ...style,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

// Option row in dropdown
export function OptionRow({ active, onClick, children, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        padding: '8px 10px',
        border: 'none',
        borderRadius: 6,
        background: active ? 'rgba(37, 99, 235, 0.1)' : 'transparent',
        cursor: 'pointer',
        fontSize: 13,
        color: active ? '#2563eb' : '#374151',
        textAlign: 'left',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(0,0,0,0.04)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = active ? 'rgba(37, 99, 235, 0.1)' : 'transparent'; }}
    >
      {children}
      {label && <span style={{ flex: 1 }}>{label}</span>}
      {active && (
        <svg width="14" height="14" viewBox="0 0 14 14">
          <path d="M3 7 L6 10 L11 4" fill="none" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  );
}

// Toolbar divider
export function Divider() {
  return <div style={{ width: 1, height: 24, background: '#e5e7eb', margin: '0 4px' }} />;
}

// Icon button for grid selections
export function IconBtn({ active, onClick, title, children, size = 36 }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        border: active ? '2px solid #2563eb' : '2px solid #e5e7eb',
        borderRadius: 6,
        background: active ? 'rgba(37, 99, 235, 0.1)' : 'white',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = '#d1d5db'; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = '#e5e7eb'; }}
    >
      {children}
    </button>
  );
}

// Section label
export function SectionLabel({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', padding: '4px 8px', marginBottom: 4 }}>
      {children}
    </div>
  );
}

// Color swatch button
export function ColorSwatch({ color, active, onClick, title, size = 28 }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: active ? '2px solid #2563eb' : '2px solid transparent',
        background: color,
        cursor: 'pointer',
        boxShadow: color === '#ffffff' ? 'inset 0 0 0 1px #e5e7eb' : 'none',
      }}
    />
  );
}

// Preset tab button
export function PresetTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 8px',
        border: 'none',
        borderRadius: 4,
        background: active ? '#2563eb' : 'transparent',
        color: active ? 'white' : '#6b7280',
        fontSize: 11,
        fontWeight: 500,
        cursor: 'pointer',
        textTransform: 'capitalize',
      }}
    >
      {children}
    </button>
  );
}

// components/diagram-studio/ui/toolbar/ConnectionIcons.js
// SVG icons for connection toolbar

import React from 'react';

// Endpoint marker icons
export function MarkerIcon({ type, size = 16, color = '#6b7280' }) {
  const icons = {
    none: (
      <circle cx="8" cy="8" r="3" fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="2 2" />
    ),
    arrow: <path d="M4 4 L12 8 L4 12 Z" fill={color} />,
    circle: <circle cx="8" cy="8" r="4" fill={color} />,
    diamond: <path d="M8 2 L14 8 L8 14 L2 8 Z" fill={color} />,
    bar: <line x1="8" y1="3" x2="8" y2="13" stroke={color} strokeWidth="3" strokeLinecap="round" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      {icons[type] || null}
    </svg>
  );
}

// Line style icons
export function LineStyleIcon({ type, size = 20, active = false }) {
  const color = active ? '#2563eb' : '#6b7280';
  const paths = {
    straight: <line x1="3" y1="10" x2="17" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" />,
    step: <path d="M3 14 L3 10 Q3 6 7 6 L13 6 Q17 6 17 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />,
    'step-sharp': <path d="M3 14 L3 6 L17 6 L17 2" fill="none" stroke={color} strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" />,
    curved: <path d="M3 14 Q10 14 10 10 Q10 6 17 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />,
    arc: <path d="M3 14 Q17 14 17 6" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      {paths[type] || null}
    </svg>
  );
}

// Dash pattern icons
export function DashPatternIcon({ pattern, size = 20, active = false }) {
  const color = active ? '#2563eb' : '#6b7280';
  const dashArrays = { solid: 'none', dashed: '4 3', dotted: '2 3', 'dash-dot': '4 2 1 2' };
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <line x1="2" y1="10" x2="18" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"
        strokeDasharray={dashArrays[pattern] || 'none'} />
    </svg>
  );
}

// Thickness preview icon
export function ThicknessIcon({ width, size = 20, active = false }) {
  const color = active ? '#2563eb' : '#6b7280';
  return (
    <svg width={size} height={size} viewBox="0 0 20 20">
      <line x1="3" y1="10" x2="17" y2="10" stroke={color} strokeWidth={width * 1.5} strokeLinecap="round" />
    </svg>
  );
}

// Label icon
export function LabelIcon({ size = 16, color = '#6b7280' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16">
      <text x="2" y="12" fontSize="11" fontWeight="600" fill={color}>Aa</text>
    </svg>
  );
}

// Delete icon
export function DeleteIcon({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18">
      <path d="M5 5 L13 13 M13 5 L5 13" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

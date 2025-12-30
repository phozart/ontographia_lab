// components/diagram-studio/ui/toolbar/ConnectionConfig.js
// Configuration constants for connection toolbar

export const MARKER_TYPES = [
  { id: 'none', label: 'None' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'circle', label: 'Circle' },
  { id: 'diamond', label: 'Diamond' },
  { id: 'bar', label: 'Bar' },
];

export const LINE_STYLES = [
  { id: 'straight', label: 'Straight' },
  { id: 'step', label: 'Elbow Rounded' },
  { id: 'step-sharp', label: 'Elbow Sharp' },
  { id: 'curved', label: 'Curved' },
  { id: 'arc', label: 'Arc' },
];

export const DASH_PATTERNS = [
  { id: 'solid', label: 'Solid' },
  { id: 'dashed', label: 'Dashed' },
  { id: 'dotted', label: 'Dotted' },
  { id: 'dash-dot', label: 'Dash-dot' },
];

export const STROKE_WIDTHS = [1, 2, 3, 4, 5];

export const COLOR_PRESETS = {
  vibrant: [
    { hex: '#374151', name: 'Gray' },
    { hex: '#ef4444', name: 'Red' },
    { hex: '#f97316', name: 'Orange' },
    { hex: '#eab308', name: 'Yellow' },
    { hex: '#22c55e', name: 'Green' },
    { hex: '#3b82f6', name: 'Blue' },
    { hex: '#8b5cf6', name: 'Purple' },
    { hex: '#ec4899', name: 'Pink' },
    { hex: '#06b6d4', name: 'Cyan' },
    { hex: '#14b8a6', name: 'Teal' },
  ],
  neutral: [
    { hex: '#000000', name: 'Black' },
    { hex: '#374151', name: 'Gray 700' },
    { hex: '#6b7280', name: 'Gray 500' },
    { hex: '#9ca3af', name: 'Gray 400' },
    { hex: '#d1d5db', name: 'Gray 300' },
    { hex: '#e5e7eb', name: 'Gray 200' },
    { hex: '#f3f4f6', name: 'Gray 100' },
    { hex: '#ffffff', name: 'White' },
  ],
  pastel: [
    { hex: '#bfdbfe', name: 'Baby Blue' },
    { hex: '#bbf7d0', name: 'Mint' },
    { hex: '#fef08a', name: 'Butter' },
    { hex: '#fecdd3', name: 'Blush' },
    { hex: '#ddd6fe', name: 'Lavender' },
    { hex: '#fed7aa', name: 'Peach' },
    { hex: '#a5f3fc', name: 'Seafoam' },
    { hex: '#e9d5ff', name: 'Lilac' },
  ],
};

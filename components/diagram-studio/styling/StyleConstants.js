// components/diagram-studio/styling/StyleConstants.js
// Style variants, color palette, and default styling for stencils

// ============ STYLE VARIANTS ============
// Available visual treatments for rectangle-based stencils

export const STYLE_VARIANTS = {
  floating: {
    id: 'floating',
    name: 'Floating',
    description: 'White card with soft shadow',
    icon: 'floating',
  },
  accent: {
    id: 'accent',
    name: 'Accent Bar',
    description: 'Left colored bar',
    icon: 'accent',
  },
  filled: {
    id: 'filled',
    name: 'Filled',
    description: 'Solid background, white text',
    icon: 'filled',
  },
  tinted: {
    id: 'tinted',
    name: 'Tinted',
    description: 'Soft colored background',
    icon: 'tinted',
  },
  plain: {
    id: 'plain',
    name: 'Plain',
    description: 'Simple white with thin border',
    icon: 'plain',
  },
};

export const STYLE_VARIANT_ORDER = ['floating', 'accent', 'filled', 'tinted', 'plain'];

// ============ COLOR PALETTE ============
// Default palette - lighter, softer colors
export const COLOR_PALETTE = [
  { id: 'sky', hex: '#7dd3fc', name: 'Sky' },
  { id: 'emerald', hex: '#6ee7b7', name: 'Emerald' },
  { id: 'amber', hex: '#fcd34d', name: 'Amber' },
  { id: 'rose', hex: '#fda4af', name: 'Rose' },
  { id: 'violet', hex: '#c4b5fd', name: 'Violet' },
  { id: 'cyan', hex: '#67e8f9', name: 'Cyan' },
  { id: 'pink', hex: '#f9a8d4', name: 'Pink' },
  { id: 'slate', hex: '#94a3b8', name: 'Slate' },
  { id: 'peach', hex: '#fed7aa', name: 'Peach' },
  { id: 'mint', hex: '#99f6e4', name: 'Mint' },
];

// ============ COLOR PRESETS ============
// Pre-defined color palettes for different use cases

export const COLOR_PRESETS = {
  default: {
    id: 'default',
    name: 'Modern',
    colors: [
      { id: 'sky', hex: '#7dd3fc', name: 'Sky' },
      { id: 'emerald', hex: '#6ee7b7', name: 'Emerald' },
      { id: 'amber', hex: '#fcd34d', name: 'Amber' },
      { id: 'rose', hex: '#fda4af', name: 'Rose' },
      { id: 'violet', hex: '#c4b5fd', name: 'Violet' },
      { id: 'cyan', hex: '#67e8f9', name: 'Cyan' },
      { id: 'pink', hex: '#f9a8d4', name: 'Pink' },
      { id: 'slate', hex: '#94a3b8', name: 'Slate' },
      { id: 'peach', hex: '#fed7aa', name: 'Peach' },
      { id: 'mint', hex: '#99f6e4', name: 'Mint' },
    ],
  },
  business: {
    id: 'business',
    name: 'Business',
    colors: [
      { id: 'navy', hex: '#1e3a5f', name: 'Navy' },
      { id: 'steel', hex: '#4a5568', name: 'Steel' },
      { id: 'teal', hex: '#0d9488', name: 'Teal' },
      { id: 'burgundy', hex: '#7f1d1d', name: 'Burgundy' },
      { id: 'forest', hex: '#166534', name: 'Forest' },
      { id: 'charcoal', hex: '#374151', name: 'Charcoal' },
      { id: 'royal', hex: '#1d4ed8', name: 'Royal' },
      { id: 'slate', hex: '#64748b', name: 'Slate' },
      { id: 'copper', hex: '#b45309', name: 'Copper' },
      { id: 'plum', hex: '#7e22ce', name: 'Plum' },
    ],
  },
  corporate: {
    id: 'corporate',
    name: 'Corporate',
    colors: [
      { id: 'blue', hex: '#2563eb', name: 'Corporate Blue' },
      { id: 'gray', hex: '#6b7280', name: 'Neutral Gray' },
      { id: 'green', hex: '#16a34a', name: 'Success Green' },
      { id: 'red', hex: '#dc2626', name: 'Alert Red' },
      { id: 'orange', hex: '#ea580c', name: 'Warning Orange' },
      { id: 'purple', hex: '#9333ea', name: 'Accent Purple' },
      { id: 'indigo', hex: '#4f46e5', name: 'Indigo' },
      { id: 'darkblue', hex: '#1e40af', name: 'Dark Blue' },
      { id: 'teal', hex: '#0891b2', name: 'Teal' },
      { id: 'zinc', hex: '#71717a', name: 'Zinc' },
    ],
  },
  pastel: {
    id: 'pastel',
    name: 'Pastel',
    colors: [
      { id: 'baby-blue', hex: '#bfdbfe', name: 'Baby Blue' },
      { id: 'mint', hex: '#bbf7d0', name: 'Mint' },
      { id: 'butter', hex: '#fef08a', name: 'Butter' },
      { id: 'blush', hex: '#fecdd3', name: 'Blush' },
      { id: 'lavender', hex: '#ddd6fe', name: 'Lavender' },
      { id: 'peach', hex: '#fed7aa', name: 'Peach' },
      { id: 'seafoam', hex: '#a5f3fc', name: 'Seafoam' },
      { id: 'lilac', hex: '#e9d5ff', name: 'Lilac' },
      { id: 'cream', hex: '#fef3c7', name: 'Cream' },
      { id: 'sage', hex: '#d9f99d', name: 'Sage' },
    ],
  },
  vibrant: {
    id: 'vibrant',
    name: 'Vibrant',
    colors: [
      { id: 'blue', hex: '#3b82f6', name: 'Blue' },
      { id: 'green', hex: '#22c55e', name: 'Green' },
      { id: 'yellow', hex: '#eab308', name: 'Yellow' },
      { id: 'red', hex: '#ef4444', name: 'Red' },
      { id: 'purple', hex: '#a855f7', name: 'Purple' },
      { id: 'cyan', hex: '#06b6d4', name: 'Cyan' },
      { id: 'pink', hex: '#ec4899', name: 'Pink' },
      { id: 'orange', hex: '#f97316', name: 'Orange' },
      { id: 'lime', hex: '#84cc16', name: 'Lime' },
      { id: 'fuchsia', hex: '#d946ef', name: 'Fuchsia' },
    ],
  },
  neutral: {
    id: 'neutral',
    name: 'Neutral',
    colors: [
      { id: 'white', hex: '#ffffff', name: 'White' },
      { id: 'gray-50', hex: '#f9fafb', name: 'Gray 50' },
      { id: 'gray-100', hex: '#f3f4f6', name: 'Gray 100' },
      { id: 'gray-200', hex: '#e5e7eb', name: 'Gray 200' },
      { id: 'gray-300', hex: '#d1d5db', name: 'Gray 300' },
      { id: 'gray-400', hex: '#9ca3af', name: 'Gray 400' },
      { id: 'gray-500', hex: '#6b7280', name: 'Gray 500' },
      { id: 'gray-600', hex: '#4b5563', name: 'Gray 600' },
      { id: 'gray-700', hex: '#374151', name: 'Gray 700' },
      { id: 'gray-800', hex: '#1f2937', name: 'Gray 800' },
    ],
  },
};

export const COLOR_PRESET_ORDER = ['default', 'pastel', 'business', 'corporate', 'vibrant', 'neutral'];

// ============ FONT SIZES ============

export const FONT_SIZES = [
  { id: 'xs', value: 11, label: 'XS' },
  { id: 'sm', value: 13, label: 'S' },
  { id: 'md', value: 15, label: 'M' },
  { id: 'lg', value: 18, label: 'L' },
  { id: 'xl', value: 22, label: 'XL' },
];

// ============ BORDER STYLES ============

export const BORDER_STYLES = [
  { id: 'none', label: 'None', value: 'none' },
  { id: 'solid', label: 'Solid', value: 'solid' },
  { id: 'dashed', label: 'Dashed', value: 'dashed' },
  { id: 'dotted', label: 'Dotted', value: 'dotted' },
];

export const BORDER_WIDTHS = [
  { id: 'none', label: 'None', value: 0 },
  { id: 'thin', label: 'Thin', value: 1 },
  { id: 'medium', label: 'Medium', value: 2 },
  { id: 'thick', label: 'Thick', value: 3 },
  { id: 'bold', label: 'Bold', value: 4 },
];

export const CORNER_STYLES = [
  { id: 'rounded', label: 'Rounded', value: 8 },
  { id: 'slightly-rounded', label: 'Slightly Rounded', value: 4 },
  { id: 'square', label: 'Square', value: 0 },
  { id: 'pill', label: 'Pill', value: 999 },
];

// ============ VERTICAL ALIGNMENT ============

export const VERTICAL_ALIGNS = [
  { id: 'top', label: 'Top', value: 'flex-start' },
  { id: 'middle', label: 'Middle', value: 'center' },
  { id: 'bottom', label: 'Bottom', value: 'flex-end' },
];

// ============ DEFAULT STYLE ============

export const DEFAULT_STYLE = {
  color: '#3b82f6',
  styleVariant: 'floating',
  fontSize: 13,
  fontWeight: 'normal',
  fontStyle: 'normal',
  textDecoration: 'none',
  textAlign: 'center',
  verticalAlign: 'center',
  borderStyle: 'solid',
  borderWidth: 1,
  borderRadius: 8,
  borderColor: null, // null means use variant default
  showShadow: true,
  showAccentBar: false,
  opacity: 1,
};

// ============ UTILITY FUNCTIONS ============

/**
 * Darken a hex color by a percentage
 */
export function darkenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max((num >> 16) - amt, 0);
  const G = Math.max(((num >> 8) & 0x00ff) - amt, 0);
  const B = Math.max((num & 0x0000ff) - amt, 0);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Lighten a hex color by a percentage
 */
export function lightenColor(hex, percent) {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min((num >> 16) + amt, 255);
  const G = Math.min(((num >> 8) & 0x00ff) + amt, 255);
  const B = Math.min((num & 0x0000ff) + amt, 255);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

/**
 * Get contrasting text color (black or white) for a given background
 */
export function getContrastColor(hex) {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = num >> 16;
  const G = (num >> 8) & 0x00ff;
  const B = num & 0x0000ff;
  // Calculate luminance
  const luminance = (0.299 * R + 0.587 * G + 0.114 * B) / 255;
  return luminance > 0.5 ? '#1f2937' : '#ffffff';
}

/**
 * Convert hex to rgba with given opacity
 */
export function hexToRgba(hex, opacity) {
  const num = parseInt(hex.replace('#', ''), 16);
  const R = num >> 16;
  const G = (num >> 8) & 0x00ff;
  const B = num & 0x0000ff;
  return `rgba(${R}, ${G}, ${B}, ${opacity})`;
}

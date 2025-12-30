// components/diagram-studio/styling/StyledRectRenderer.js
// Generic styled rectangle renderer supporting multiple visual variants
// Uses CSS-based styling for better reliability and performance

import { darkenColor, hexToRgba } from './StyleConstants';

/**
 * Renders a rectangle stencil with the specified style variant
 * Uses CSS for all visual effects (shadows, borders, backgrounds)
 */
export function StyledRectRenderer({
  element,
  stencil,
  isSelected,
  children,
}) {
  const variant = element.styleVariant || 'floating';
  const color = element.color || stencil?.color || '#3b82f6';
  const bgOpacity = element.opacity ?? 1; // Opacity only affects background

  // Custom border properties
  const borderWidth = element.borderWidth ?? 1;
  const borderRadius = element.borderRadius ?? 8;
  const borderColor = element.borderColor; // If set, overrides variant default
  const borderStyle = element.borderStyle || 'solid';
  const showShadow = element.showShadow ?? true;

  // Vertical text alignment
  const verticalAlign = element.verticalAlign || 'center';

  const styles = getVariantStyles(variant, color, { borderWidth, borderRadius, borderColor, borderStyle, bgOpacity, verticalAlign, showShadow });

  return (
    <div style={styles.container}>
      {/* Accent bar for accent variant */}
      {variant === 'accent' && (
        <div style={styles.accentBar} />
      )}
      {/* Content */}
      <div style={styles.content}>
        {children}
      </div>
    </div>
  );
}

/**
 * Apply opacity to a color (works with hex, rgb, rgba)
 */
function applyOpacityToColor(colorStr, opacity) {
  if (opacity >= 1) return colorStr;
  if (colorStr === 'white') return `rgba(255, 255, 255, ${opacity})`;
  if (colorStr === 'transparent') return 'transparent';
  // If it's already rgba, parse and multiply
  if (colorStr.startsWith('rgba')) {
    const match = colorStr.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if (match) {
      const [, r, g, b, a = 1] = match;
      return `rgba(${r}, ${g}, ${b}, ${parseFloat(a) * opacity})`;
    }
  }
  // If it's a hex color, convert
  if (colorStr.startsWith('#')) {
    return hexToRgba(colorStr, opacity);
  }
  return colorStr;
}

/**
 * Get CSS styles for each variant
 */
function getVariantStyles(variant, color, options = {}) {
  const { borderWidth = 1, borderRadius = 8, borderColor, borderStyle = 'solid', bgOpacity = 1, verticalAlign = 'center', showShadow = true } = options;

  const baseContainer = {
    width: '100%',
    height: '100%',
    borderRadius,
    boxSizing: 'border-box',
    position: 'relative',
    overflow: 'hidden',
  };

  // Map vertical align to flexbox justify-content
  const justifyMap = {
    'top': 'flex-start',
    'flex-start': 'flex-start',
    'middle': 'center',
    'center': 'center',
    'bottom': 'flex-end',
    'flex-end': 'flex-end',
  };

  const baseContent = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: justifyMap[verticalAlign] || 'center',
    padding: '10px 12px',
    boxSizing: 'border-box',
  };

  // Determine final border color based on variant and override
  const getVariantBorderColor = () => {
    if (borderColor) return borderColor;
    switch (variant) {
      case 'floating': return hexToRgba(color, 0.3);
      case 'accent': return hexToRgba(color, 0.25);
      case 'filled': return 'transparent';
      case 'tinted': return hexToRgba(color, 0.25);
      case 'plain':
      default: return hexToRgba(color, 0.35);
    }
  };

  const finalBorderColor = getVariantBorderColor();

  // Helper to create border string (handles 'none' style)
  const makeBorder = (width, style, borderColorVal) => {
    if (style === 'none') return 'none';
    return `${width}px ${style} ${borderColorVal}`;
  };

  switch (variant) {
    case 'floating':
      return {
        container: {
          ...baseContainer,
          background: applyOpacityToColor('white', bgOpacity),
          border: makeBorder(borderWidth, borderStyle, finalBorderColor),
          boxShadow: showShadow ? `0 2px 8px ${hexToRgba(color, 0.1)}, 0 4px 16px rgba(0, 0, 0, 0.05)` : 'none',
        },
        content: {
          ...baseContent,
          color: '#1f2937',
        },
      };

    case 'accent':
      return {
        container: {
          ...baseContainer,
          background: applyOpacityToColor('white', bgOpacity),
          border: makeBorder(borderWidth, borderStyle, finalBorderColor),
          boxShadow: showShadow ? `0 1px 4px ${hexToRgba(color, 0.1)}, 0 2px 8px rgba(0, 0, 0, 0.05)` : 'none',
        },
        accentBar: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: color,
          borderRadius: `${borderRadius}px 0 0 ${borderRadius}px`,
        },
        content: {
          ...baseContent,
          paddingLeft: 16,
          color: '#1f2937',
        },
      };

    case 'filled':
      return {
        container: {
          ...baseContainer,
          background: applyOpacityToColor(color, bgOpacity),
          border: borderColor ? makeBorder(borderWidth, borderStyle, borderColor) : 'none',
          boxShadow: showShadow ? `0 2px 6px ${hexToRgba(color, 0.3)}` : 'none',
        },
        content: {
          ...baseContent,
          color: 'white',
        },
      };

    case 'tinted':
      return {
        container: {
          ...baseContainer,
          background: hexToRgba(color, 0.12 * bgOpacity),
          border: makeBorder(borderWidth, borderStyle, finalBorderColor),
          boxShadow: 'none',
        },
        content: {
          ...baseContent,
          color: darkenColor(color, 25),
        },
      };

    case 'plain':
    default:
      return {
        container: {
          ...baseContainer,
          background: applyOpacityToColor('white', bgOpacity),
          border: makeBorder(borderWidth, borderStyle, finalBorderColor),
          boxShadow: 'none',
        },
        content: {
          ...baseContent,
          color: '#374151',
        },
      };
  }
}

/**
 * Get just the text color for a given variant and color
 */
export function getVariantTextColor(variant, color) {
  switch (variant) {
    case 'filled':
      return 'white';
    case 'tinted':
      return darkenColor(color, 25);
    case 'floating':
    case 'accent':
    case 'plain':
    default:
      return '#1f2937';
  }
}

export default StyledRectRenderer;

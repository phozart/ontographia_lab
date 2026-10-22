// components/diagram-studio/connections/labels/EndpointLabel.js
// Endpoint label component for connections (source/target labels - toolbar only per CLAUDE.md spec)
// ADR-0008 T2: the lines come from the shared layout (11 px meta role); the background is the measured text plus padding.

import React, { useMemo } from 'react';
import { calculateEndpointLabelPosition } from '../geometry/labelPositioning';
import SvgTextBlock from '../../text/SvgTextBlock';
import { endpointLabelLayout } from '../../../../lib/text/connectionLabel';

/**
 * Endpoint label for connections (source or target)
 * - Displays near the connection endpoint
 * - NOT editable on canvas (toolbar only per CLAUDE.md spec)
 * - Smaller font, lower opacity than mid-label
 * - Can be shown/hidden based on selection state
 */
export default function EndpointLabel({
  value = '',
  position,
  port = 'right',
  type = 'source', // 'source' or 'target'
  isSelected = false,
  showOnHover = true,
  isHovered = false,
}) {
  const box = useMemo(() => endpointLabelLayout(value), [value]);

  // Don't render if no value
  if (!value) return null;

  if (!position) return null;

  // Calculate offset position based on port direction
  const offset = calculateEndpointLabelPosition(position, port, 12);

  // Measured label dimensions
  const { layout, width: labelWidth, height: labelHeight, textBox } = box;

  // Opacity based on selection/hover state
  // Per spec: 70-80% opacity when not selected
  const opacity = isSelected ? 0.95 : (isHovered && showOnHover) ? 0.85 : 0.7;
  const x0 = offset.x - labelWidth / 2;
  const y0 = offset.y - labelHeight / 2;

  return (
    <g
      className={`endpoint-label ${type}`}
      style={{ opacity }}
    >
      {/* Background rectangle */}
      <rect
        x={x0}
        y={y0}
        width={labelWidth}
        height={labelHeight}
        rx={3}
        fill="var(--bg)"
        stroke={isSelected ? 'var(--accent)' : 'var(--border)'}
        strokeWidth={1}
      />

      {/* Label text - smaller font than mid-label */}
      <SvgTextBlock
        layout={layout}
        x={x0 + textBox.x}
        y={y0 + textBox.y}
        fill={isSelected ? 'var(--accent)' : 'var(--text-muted)'}
        testId="endpoint-label"
      />
    </g>
  );
}

/**
 * Commonly used endpoint label configurations
 * For UML, ERD, and other diagram types
 */
export const ENDPOINT_LABEL_PRESETS = {
  // UML multiplicity
  '0..1': 'Zero or one',
  '1': 'Exactly one',
  '0..*': 'Zero or more',
  '1..*': 'One or more',
  '*': 'Many',

  // ERD cardinality
  '||': 'One and only one',
  '|o': 'Zero or one',
  '}|': 'One or more',
  '}o': 'Zero or more',
};

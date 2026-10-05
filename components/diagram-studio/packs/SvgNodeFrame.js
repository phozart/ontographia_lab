// components/diagram-studio/packs/SvgNodeFrame.js
// Wraps bare SVG node content (<g>, <rect>, <defs>...) in an <svg> root.
// The canvas mounts renderNode() output inside an HTML div, so SVG fragments
// without an <svg> ancestor are not rendered as SVG.

import React from 'react';

export default function SvgNodeFrame({ element, stencil, children }) {
  const width = element?.size?.width || stencil?.defaultSize?.width || 100;
  const height = element?.size?.height || stencil?.defaultSize?.height || 50;
  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      overflow="visible"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {children}
    </svg>
  );
}

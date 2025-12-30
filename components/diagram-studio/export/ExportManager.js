// components/diagram-studio/export/ExportManager.js
// Export diagrams to various formats: SVG, PNG, JSON

// ============ EXPORT MANAGER CLASS ============

export class ExportManager {
  constructor(options = {}) {
    this.includeDataAttributes = options.includeDataAttributes !== false;
    this.includeMetadata = options.includeMetadata !== false;
  }

  /**
   * Export diagram to specified format
   * @param {Object} diagram - Diagram data
   * @param {string} format - 'svg' | 'png' | 'jpeg' | 'json'
   * @param {Object} options - Export options
   */
  async export(diagram, format, options = {}) {
    switch (format.toLowerCase()) {
      case 'svg':
        return this.exportSVG(diagram, options);
      case 'png':
        return this.exportPNG(diagram, options);
      case 'jpeg':
      case 'jpg':
        return this.exportJPEG(diagram, options);
      case 'json':
        return this.exportJSON(diagram, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Calculate bounds based on scope
   * @param {string} scope - 'canvas' | 'viewport' | 'frame'
   * @param {Object} options - Scope options (viewport, frame, elements)
   */
  calculateScopeBounds(scope, options = {}) {
    const { elements = [], viewport, frame, padding = 40 } = options;

    switch (scope) {
      case 'viewport': {
        if (!viewport) {
          return this.calculateBounds(elements, padding);
        }
        // Viewport bounds in canvas coordinates
        const vx = -viewport.x / viewport.scale;
        const vy = -viewport.y / viewport.scale;
        const vw = (viewport.containerWidth || 1200) / viewport.scale;
        const vh = (viewport.containerHeight || 800) / viewport.scale;
        return {
          minX: vx,
          minY: vy,
          maxX: vx + vw,
          maxY: vy + vh,
          width: vw,
          height: vh,
        };
      }
      case 'frame': {
        if (!frame) {
          return this.calculateBounds(elements, padding);
        }
        const fx = frame.x || 0;
        const fy = frame.y || 0;
        const fw = frame.size?.width || 400;
        const fh = frame.size?.height || 300;
        return {
          minX: fx,
          minY: fy,
          maxX: fx + fw,
          maxY: fy + fh,
          width: fw,
          height: fh,
        };
      }
      case 'canvas':
      default:
        return this.calculateBounds(elements, padding);
    }
  }

  /**
   * Filter elements within bounds
   */
  filterElementsInBounds(elements, bounds) {
    return elements.filter(el => {
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.size?.width || 100;
      const h = el.size?.height || 50;

      // Element is at least partially within bounds
      return x + w > bounds.minX && x < bounds.maxX &&
             y + h > bounds.minY && y < bounds.maxY;
    });
  }

  /**
   * Filter connections within bounds (both endpoints must be in bounds)
   */
  filterConnectionsInBounds(connections, elements, bounds) {
    const elementIds = new Set(elements.map(e => e.id));
    return connections.filter(conn => {
      return elementIds.has(conn.sourceId) && elementIds.has(conn.targetId);
    });
  }

  /**
   * Export diagram as SVG string
   */
  exportSVG(diagram, options = {}) {
    const { elements = [], connections = [], settings = {} } = diagram;
    const {
      padding = 40,
      backgroundColor = 'transparent',
      includeGrid = false,
    } = options;

    // Calculate bounding box
    const bounds = this.calculateBounds(elements, padding);
    const { minX, minY, width, height } = bounds;

    // Build SVG content
    let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg"
     width="${width}"
     height="${height}"
     viewBox="${minX} ${minY} ${width} ${height}"
     data-diagram-type="${diagram.type || 'unknown'}"
     data-diagram-id="${diagram.id || ''}"
     data-exported-at="${new Date().toISOString()}">
`;

    // Definitions (markers, gradients)
    svg += this.generateDefs();

    // Background
    if (backgroundColor !== 'transparent') {
      svg += `  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="${backgroundColor}"/>\n`;
    }

    // Grid (optional)
    if (includeGrid) {
      svg += this.generateGrid(minX, minY, width, height);
    }

    // Connections layer
    svg += `  <g id="connections">\n`;
    for (const conn of connections) {
      svg += this.renderConnectionSVG(conn, elements, '    ');
    }
    svg += `  </g>\n`;

    // Elements layer
    svg += `  <g id="elements">\n`;
    for (const el of elements) {
      svg += this.renderElementSVG(el, '    ');
    }
    svg += `  </g>\n`;

    svg += `</svg>`;

    return {
      format: 'svg',
      content: svg,
      mimeType: 'image/svg+xml',
      filename: `${diagram.name || 'diagram'}.svg`,
    };
  }

  /**
   * Export diagram as PNG
   */
  async exportPNG(diagram, options = {}) {
    const { scale = 2, backgroundColor = '#ffffff' } = options;

    // First generate SVG
    const svgResult = this.exportSVG(diagram, { ...options, backgroundColor });

    // Convert SVG to PNG using canvas
    const png = await this.svgToPNG(svgResult.content, scale);

    return {
      format: 'png',
      content: png,
      mimeType: 'image/png',
      filename: `${diagram.name || 'diagram'}.png`,
    };
  }

  /**
   * Export diagram as JPEG
   */
  async exportJPEG(diagram, options = {}) {
    const { scale = 2, backgroundColor = '#ffffff', quality = 0.9 } = options;

    // First generate SVG with white background (JPEG doesn't support transparency)
    const svgResult = this.exportSVG(diagram, { ...options, backgroundColor });

    // Convert SVG to JPEG using canvas
    const jpeg = await this.svgToJPEG(svgResult.content, scale, quality);

    return {
      format: 'jpeg',
      content: jpeg,
      mimeType: 'image/jpeg',
      filename: `${diagram.name || 'diagram'}.jpg`,
    };
  }

  /**
   * Export with scope options (canvas, viewport, or frame)
   */
  async exportWithScope(diagram, format, options = {}) {
    const { scope = 'canvas', viewport, frame, padding = 40 } = options;
    let { elements = [], connections = [] } = diagram;

    // Calculate bounds based on scope
    const bounds = this.calculateScopeBounds(scope, { elements, viewport, frame, padding });

    // For frame scope, filter elements (exclude the frame itself)
    if (scope === 'frame' && frame) {
      elements = elements.filter(el => {
        if (el.id === frame.id) return false; // Exclude the frame
        const x = el.x || 0;
        const y = el.y || 0;
        const w = el.size?.width || 100;
        const h = el.size?.height || 50;
        // Must be fully inside frame
        return x >= bounds.minX && y >= bounds.minY &&
               (x + w) <= bounds.maxX && (y + h) <= bounds.maxY;
      });
      connections = this.filterConnectionsInBounds(connections, elements, bounds);
    } else if (scope === 'viewport') {
      elements = this.filterElementsInBounds(elements, bounds);
      connections = this.filterConnectionsInBounds(connections, elements, bounds);
    }

    // Create scoped diagram
    const scopedDiagram = {
      ...diagram,
      elements,
      connections,
    };

    // Override bounds in options
    const scopedOptions = {
      ...options,
      overrideBounds: bounds,
    };

    return this.export(scopedDiagram, format, scopedOptions);
  }

  /**
   * Export diagram as JSON
   */
  exportJSON(diagram, options = {}) {
    const { pretty = true, includeMetadata = true } = options;

    const exportData = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      diagram: {
        id: diagram.id,
        name: diagram.name,
        type: diagram.type,
        description: diagram.description,
        elements: diagram.elements || [],
        connections: diagram.connections || [],
        settings: diagram.settings || {},
      },
    };

    if (includeMetadata) {
      exportData.metadata = {
        elementCount: diagram.elements?.length || 0,
        connectionCount: diagram.connections?.length || 0,
      };
    }

    const content = pretty
      ? JSON.stringify(exportData, null, 2)
      : JSON.stringify(exportData);

    return {
      format: 'json',
      content,
      mimeType: 'application/json',
      filename: `${diagram.name || 'diagram'}.json`,
    };
  }

  /**
   * Calculate bounding box of all elements
   */
  calculateBounds(elements, padding = 0) {
    if (!elements || elements.length === 0) {
      return { minX: 0, minY: 0, maxX: 800, maxY: 600, width: 800, height: 600 };
    }

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const el of elements) {
      const x = el.x || 0;
      const y = el.y || 0;
      const w = el.size?.width || 100;
      const h = el.size?.height || 50;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: maxX - minX + padding * 2,
      height: maxY - minY + padding * 2,
    };
  }

  /**
   * Generate SVG defs (markers, patterns)
   */
  generateDefs() {
    return `  <defs>
    <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
    </marker>
    <marker id="arrow-end" viewBox="0 0 10 10" refX="10" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/>
    </marker>
    <marker id="diamond-empty" viewBox="0 0 12 12" refX="6" refY="6"
            markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 6 0 L 12 6 L 6 12 L 0 6 z" fill="white" stroke="currentColor" stroke-width="1"/>
    </marker>
    <marker id="diamond-filled" viewBox="0 0 12 12" refX="6" refY="6"
            markerWidth="8" markerHeight="8" orient="auto">
      <path d="M 6 0 L 12 6 L 6 12 L 0 6 z" fill="currentColor"/>
    </marker>
    <marker id="triangle-empty" viewBox="0 0 12 12" refX="12" refY="6"
            markerWidth="10" markerHeight="10" orient="auto">
      <path d="M 0 0 L 12 6 L 0 12 z" fill="white" stroke="currentColor" stroke-width="1"/>
    </marker>
    <marker id="circle" viewBox="0 0 10 10" refX="5" refY="5"
            markerWidth="6" markerHeight="6" orient="auto">
      <circle cx="5" cy="5" r="4" fill="white" stroke="currentColor" stroke-width="1"/>
    </marker>
  </defs>
`;
  }

  /**
   * Generate grid pattern
   */
  generateGrid(minX, minY, width, height, gridSize = 20) {
    let grid = `  <g id="grid" opacity="0.1">\n`;
    // Vertical lines
    for (let x = Math.floor(minX / gridSize) * gridSize; x <= minX + width; x += gridSize) {
      grid += `    <line x1="${x}" y1="${minY}" x2="${x}" y2="${minY + height}" stroke="#000" stroke-width="0.5"/>\n`;
    }
    // Horizontal lines
    for (let y = Math.floor(minY / gridSize) * gridSize; y <= minY + height; y += gridSize) {
      grid += `    <line x1="${minX}" y1="${y}" x2="${minX + width}" y2="${y}" stroke="#000" stroke-width="0.5"/>\n`;
    }
    grid += `  </g>\n`;
    return grid;
  }

  /**
   * Render element as SVG
   */
  renderElementSVG(el, indent = '') {
    const { id, type, label, x = 0, y = 0, size = {}, color = '#3b82f6' } = el;
    const w = size.width || 100;
    const h = size.height || 50;
    const shape = el.shape || this.inferShape(type);

    const dataAttrs = this.includeDataAttributes
      ? ` data-node-id="${id}" data-node-type="${type}"`
      : '';

    let svg = `${indent}<g${dataAttrs} transform="translate(${x}, ${y})">\n`;

    // Shape
    switch (shape) {
      case 'circle':
        const r = Math.min(w, h) / 2;
        svg += `${indent}  <circle cx="${w / 2}" cy="${h / 2}" r="${r}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>\n`;
        break;
      case 'diamond':
        svg += `${indent}  <polygon points="${w / 2},0 ${w},${h / 2} ${w / 2},${h} 0,${h / 2}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>\n`;
        break;
      case 'ellipse':
        svg += `${indent}  <ellipse cx="${w / 2}" cy="${h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>\n`;
        break;
      case 'sticky':
        svg += `${indent}  <rect width="${w}" height="${h}" rx="3" fill="${color}" fill-opacity="0.9"/>\n`;
        break;
      default: // rect
        svg += `${indent}  <rect width="${w}" height="${h}" rx="6" fill="${color}" fill-opacity="0.2" stroke="${color}" stroke-width="2"/>\n`;
    }

    // Label
    if (label) {
      const textY = h / 2;
      svg += `${indent}  <text x="${w / 2}" y="${textY}" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif" font-size="13" fill="#374151">${this.escapeXml(label)}</text>\n`;
    }

    svg += `${indent}</g>\n`;
    return svg;
  }

  /**
   * Render connection as SVG
   */
  renderConnectionSVG(conn, elements, indent = '') {
    const { id, sourceId, targetId, type, label, color = '#374151' } = conn;

    const source = elements.find(e => e.id === sourceId);
    const target = elements.find(e => e.id === targetId);
    if (!source || !target) return '';

    // Calculate connection points
    const sourceCenter = this.getElementCenter(source);
    const targetCenter = this.getElementCenter(target);

    // Simple straight line for now (can be enhanced with bezier curves)
    const path = `M ${sourceCenter.x} ${sourceCenter.y} L ${targetCenter.x} ${targetCenter.y}`;

    const dataAttrs = this.includeDataAttributes
      ? ` data-connection-id="${id}" data-source="${sourceId}" data-target="${targetId}"`
      : '';

    const markerEnd = this.shouldHaveArrow(type) ? ' marker-end="url(#arrow-end)"' : '';
    const strokeDasharray = this.getStrokeDasharray(type);

    let svg = `${indent}<g${dataAttrs}>\n`;
    svg += `${indent}  <path d="${path}" fill="none" stroke="${color}" stroke-width="2"${strokeDasharray}${markerEnd}/>\n`;

    // Connection label
    if (label) {
      const midX = (sourceCenter.x + targetCenter.x) / 2;
      const midY = (sourceCenter.y + targetCenter.y) / 2;
      svg += `${indent}  <text x="${midX}" y="${midY - 8}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="${color}">${this.escapeXml(label)}</text>\n`;
    }

    svg += `${indent}</g>\n`;
    return svg;
  }

  /**
   * Get element center point
   */
  getElementCenter(el) {
    const x = el.x || 0;
    const y = el.y || 0;
    const w = el.size?.width || 100;
    const h = el.size?.height || 50;
    return { x: x + w / 2, y: y + h / 2 };
  }

  /**
   * Infer shape from element type
   */
  inferShape(type) {
    if (!type) return 'rect';
    if (type.includes('circle') || type.includes('event') || type.includes('loop')) return 'circle';
    if (type.includes('diamond') || type.includes('gateway') || type.includes('decision')) return 'diamond';
    if (type.includes('ellipse') || type.includes('central')) return 'ellipse';
    if (type.includes('sticky')) return 'sticky';
    return 'rect';
  }

  /**
   * Check if connection type should have arrow
   */
  shouldHaveArrow(type) {
    if (!type) return true;
    const noArrowTypes = ['association', 'line', 'branch', 'dashed-line'];
    return !noArrowTypes.some(t => type.includes(t));
  }

  /**
   * Get stroke dasharray for connection type
   */
  getStrokeDasharray(type) {
    if (!type) return '';
    if (type.includes('dashed') || type.includes('delayed')) return ' stroke-dasharray="8,4"';
    if (type.includes('dotted') || type.includes('note')) return ' stroke-dasharray="2,2"';
    return '';
  }

  /**
   * Escape XML special characters
   */
  escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert SVG to PNG using canvas
   */
  async svgToPNG(svgString, scale = 2) {
    return new Promise((resolve, reject) => {
      // This runs in browser only
      if (typeof window === 'undefined') {
        reject(new Error('PNG export requires browser environment'));
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/png');
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG for PNG conversion'));
      };

      img.src = url;
    });
  }

  /**
   * Convert SVG to JPEG using canvas
   */
  async svgToJPEG(svgString, scale = 2, quality = 0.9) {
    return new Promise((resolve, reject) => {
      // This runs in browser only
      if (typeof window === 'undefined') {
        reject(new Error('JPEG export requires browser environment'));
        return;
      }

      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;

        // Fill with white background (JPEG doesn't support transparency)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0);
        URL.revokeObjectURL(url);

        canvas.toBlob((blob) => {
          resolve(blob);
        }, 'image/jpeg', quality);
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load SVG for JPEG conversion'));
      };

      img.src = url;
    });
  }
}

// ============ DOWNLOAD HELPER ============

export function downloadExport(exportResult) {
  const { content, mimeType, filename } = exportResult;

  let blob;
  if (content instanceof Blob) {
    blob = content;
  } else {
    blob = new Blob([content], { type: mimeType });
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ============ REACT HOOK ============

export function useExport(diagram) {
  const exportManager = new ExportManager();

  const exportAs = async (format, options = {}) => {
    const result = await exportManager.export(diagram, format, options);
    downloadExport(result);
    return result;
  };

  return {
    exportAs,
    exportSVG: (options) => exportAs('svg', options),
    exportPNG: (options) => exportAs('png', options),
    exportJSON: (options) => exportAs('json', options),
  };
}

// ============ DEFAULT EXPORT ============

export default ExportManager;

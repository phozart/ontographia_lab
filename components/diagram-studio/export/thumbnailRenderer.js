// components/diagram-studio/export/thumbnailRenderer.js
// Dashboard thumbnail from CONTENT, not from the live DOM: lib/render/diagramSvg builds one SVG string (cost grows with
// the number of elements, not with the number of DOM nodes and computed styles that html-to-image copied), which is then
// rasterized to a small PNG. Board-load performance: docs/architecture/investigations/board-load-performance.md.

import { THUMBNAIL_WIDTH } from '../../../lib/thumbnail';
import { renderDiagramSvg } from '../../../lib/render/diagramSvg'; // (static: one chunk to preload, not two to wait for)

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('thumbnail svg could not be decoded'));
    img.src = src;
  });
}

/**
 * @param {{elements: object[], connections: object[], theme?: object}} content
 * @returns {Promise<string|null>} a PNG data URL whose longer side is at most `maxSide` px, or null when there is nothing to draw
 */
export async function renderThumbnailPng(content, maxSide = THUMBNAIL_WIDTH) {
  const { svg, viewBox } = renderDiagramSvg(content, { maxElements: 5000, maxConnections: 10000, maxBytes: Infinity });
  if (!svg || !(viewBox.width > 0) || !(viewBox.height > 0)) return null;
  const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
  const k = maxSide / Math.max(viewBox.width, viewBox.height);
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewBox.width * k));
  canvas.height = Math.max(1, Math.round(viewBox.height * k));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

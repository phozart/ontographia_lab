// components/diagram-studio/export/exportRenderer.js
// Render the captured live canvas to PNG / JPEG / SVG / PDF blobs, plus a small preview.

import { buildExportHost } from './captureCanvas';
import { getFontEmbedCSS } from './fontEmbed';
import { clampPixelRatio, exportFilename, fitPdfPage } from './exportUtils';

const MIME = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

function resolveBackground(options, format) {
  const { background = 'white', backgroundColor } = options;
  const opaque = format === 'jpeg' || format === 'pdf';
  if (background === 'transparent') return opaque ? '#ffffff' : undefined;
  if (background === 'custom' && backgroundColor) return backgroundColor;
  // 'white' and 'grid' both sit on white
  return '#ffffff';
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const meta = dataUrl.slice(5, comma);
  const payload = dataUrl.slice(comma + 1);
  if (/;base64/.test(meta)) {
    const bin = atob(payload);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: meta.split(';')[0] });
  }
  return new Blob([decodeURIComponent(payload)], { type: meta.split(';')[0] });
}

/** Wait for the browser to paint after a state change (e.g. selection cleared). */
export function nextFrames(n = 2) {
  return new Promise(resolve => {
    const step = (left) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
}

async function withHost(options, fn) {
  const { host, bounds, cleanup } = buildExportHost(options);
  try {
    // Let fonts/images in the clone settle
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
    return await fn(host, bounds);
  } finally {
    cleanup();
  }
}

/**
 * Export the live canvas.
 * @param {'png'|'jpeg'|'svg'|'pdf'} format
 * @param {object} options see buildExportHost plus { scale, quality, name, pdf: { pageSize, orientation } }
 * @returns {Promise<{format, content: Blob, mimeType, filename, width, height}>}
 */
export async function exportFromCanvas(format, options = {}) {
  const { scale = 2, quality = 0.92, name = 'diagram', pdf = {} } = options;
  const htmlToImage = await import('html-to-image');

  return withHost(options, async (host, bounds) => {
    const backgroundColor = resolveBackground(options, format);
    const fontEmbedCSS = await getFontEmbedCSS();
    const common = { width: bounds.width, height: bounds.height, backgroundColor, cacheBust: false, fontEmbedCSS };
    let content;

    if (format === 'svg') {
      content = dataUrlToBlob(await htmlToImage.toSvg(host, common));
    } else if (format === 'png') {
      const pixelRatio = clampPixelRatio(bounds.width, bounds.height, scale);
      content = dataUrlToBlob(await htmlToImage.toPng(host, { ...common, pixelRatio }));
    } else if (format === 'jpeg') {
      const pixelRatio = clampPixelRatio(bounds.width, bounds.height, scale);
      content = dataUrlToBlob(await htmlToImage.toJpeg(host, { ...common, pixelRatio, quality }));
    } else if (format === 'pdf') {
      // Raster at high resolution embedded in a vector-free PDF page (html-in-svg cannot be vectorized client-side).
      const pixelRatio = clampPixelRatio(bounds.width, bounds.height, Math.max(scale, 3));
      const png = await htmlToImage.toPng(host, { ...common, pixelRatio });
      const { jsPDF } = await import('jspdf');
      const page = fitPdfPage({
        contentWidth: bounds.width,
        contentHeight: bounds.height,
        pageSize: pdf.pageSize || 'auto',
        orientation: pdf.orientation || 'auto',
        margin: pdf.margin ?? 24,
      });
      const doc = new jsPDF({
        orientation: page.orientation,
        unit: 'pt',
        format: [page.pageWidth, page.pageHeight],
        compress: true,
      });
      doc.setProperties({ title: name, creator: 'Ontographia Lab' });
      doc.addImage(png, 'PNG', page.x, page.y, page.width, page.height, undefined, 'FAST');
      content = doc.output('blob');
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }

    return {
      format,
      content,
      mimeType: MIME[format],
      filename: exportFilename(name, format),
      width: bounds.width,
      height: bounds.height,
    };
  });
}

/**
 * Small PNG preview (data URL) for the export dialog plus the natural export size.
 */
export async function renderPreview(options = {}, maxSide = 420) {
  const htmlToImage = await import('html-to-image');
  return withHost(options, async (host, bounds) => {
    const pixelRatio = Math.min(1, (maxSide * 2) / Math.max(bounds.width, bounds.height));
    const backgroundColor = resolveBackground(options, options.previewFormat || 'png');
    const fontEmbedCSS = await getFontEmbedCSS();
    const dataUrl = await htmlToImage.toPng(host, {
      fontEmbedCSS,
      width: bounds.width,
      height: bounds.height,
      pixelRatio,
      backgroundColor,
      cacheBust: false,
    });
    return { dataUrl, width: bounds.width, height: bounds.height, transparent: !backgroundColor };
  });
}

// components/diagram-studio/present/exportDeck.js
// Deck export (ADR-0007 section 8.2): PDF with one page per visible slide, and PNG of a single slide. Both capture the
// slide frame region of the LIVE canvas (the same clone the present mode shows, so present and export agree).
// Raster only: html in svg cannot be vectorized client-side (see exportRenderer.js). Runs one slide at a time and
// yields between slides so the UI stays responsive; an AbortSignal cancels between slides.

import { buildExportHost } from '../export/captureCanvas';
import { getFontEmbedCSS } from '../export/fontEmbed';
import { clampPixelRatio } from '../export/exportUtils';
import { sanitizeFilename } from '../export/diagramJson';
import { nextFrames } from '../export/exportRenderer';
import { pruneToFrame } from './slideClone';
import { frameBackground } from '../../../lib/present/themes';

export const PDF_WARN_SLIDES = 100; // the panel asks before exporting more than this

/** Pixel ratio by deck size: memory grows with slides x pixels (measured about 5.6 MB per slide at 2x), so big decks get less. */
export function scaleForSlides(count) {
  if (count <= 20) return 2;
  if (count <= 60) return 1.5;
  return 1;
}

export const PDF_PAGE_HEIGHT_PT = 540; // 16:9 -> 960 x 540 pt
const MAX_PAGE_WIDTH_PT = 1200;

/** PDF page size for a slide frame: 540 pt tall, as wide as its ratio needs (16:9 -> 960 x 540). */
export function pdfPageSize(frameWidth, frameHeight) {
  const ratio = frameWidth > 0 && frameHeight > 0 ? frameWidth / frameHeight : 16 / 9;
  const width = Math.min(MAX_PAGE_WIDTH_PT, Math.round(PDF_PAGE_HEIGHT_PT * ratio));
  return { width, height: Math.round(width / ratio) };
}

const backgroundOf = frameBackground;

async function captureSlide(htmlToImage, slide, { elements, connections, fontEmbedCSS, scale, theme }) {
  const { host, bounds, cleanup } = buildExportHost({ scope: 'frame', frame: slide.frame, elements, connections, padding: 0, background: 'white' });
  try {
    pruneToFrame(host, slide.frame);
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
    const pixelRatio = clampPixelRatio(bounds.width, bounds.height, scale);
    const dataUrl = await htmlToImage.toPng(host, {
      width: bounds.width, height: bounds.height, pixelRatio, backgroundColor: backgroundOf(slide.frame, theme), cacheBust: false, fontEmbedCSS,
    });
    return { dataUrl, width: bounds.width, height: bounds.height };
  } finally {
    cleanup();
  }
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const bin = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: 'image/png' });
}

/**
 * @param {{slides: Array<{slideId: string, frameId: string, frame: object}>, elements: object[], connections: object[],
 *          title: string, scale?: number, signal?: AbortSignal, onProgress?: (done: number, total: number) => void}} p
 * @returns {Promise<{format: 'pdf', content: Blob, mimeType: string, filename: string, pages: number}>}
 */
export async function exportDeckPdf({ slides, elements, connections, title, theme, scale = scaleForSlides(slides.length), signal, onProgress }) {
  if (!slides.length) throw new Error('There are no slides to export. Add slides, or show hidden ones.');
  const htmlToImage = await import('html-to-image');
  const { jsPDF } = await import('jspdf');
  const fontEmbedCSS = await getFontEmbedCSS();
  let doc = null;
  for (let i = 0; i < slides.length; i += 1) {
    if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
    onProgress?.(i, slides.length);
    const shot = await captureSlide(htmlToImage, slides[i], { elements, connections, fontEmbedCSS, scale, theme });
    const page = pdfPageSize(shot.width, shot.height);
    if (!doc) {
      doc = new jsPDF({ orientation: page.width >= page.height ? 'landscape' : 'portrait', unit: 'pt', format: [page.width, page.height], compress: true });
      doc.setProperties({ title, creator: 'Ontographia Lab' });
    } else {
      doc.addPage([page.width, page.height], page.width >= page.height ? 'landscape' : 'portrait');
    }
    doc.addImage(shot.dataUrl, 'PNG', 0, 0, page.width, page.height, undefined, 'FAST');
    shot.dataUrl = null; // the page holds its own copy: drop ours before the next slide is rendered
    await nextFrames(1);
    await new Promise((resolve) => setTimeout(resolve, 0)); // a full task break so the browser can collect the slide's canvas
  }
  onProgress?.(slides.length, slides.length);
  return { format: 'pdf', content: doc.output('blob'), mimeType: 'application/pdf', filename: `${sanitizeFilename(title, 'presentation')}.pdf`, pages: slides.length };
}

/** One slide as a PNG (2x by default, clamped like every export). */
export async function exportSlidePng({ slide, elements, connections, title, theme, scale = 2, number }) {
  const htmlToImage = await import('html-to-image');
  const fontEmbedCSS = await getFontEmbedCSS();
  const shot = await captureSlide(htmlToImage, slide, { elements, connections, fontEmbedCSS, scale, theme });
  const suffix = number ? `-slide-${number}` : '-slide';
  return { format: 'png', content: dataUrlToBlob(shot.dataUrl), mimeType: 'image/png', filename: `${sanitizeFilename(title, 'presentation')}${suffix}.png`, width: shot.width, height: shot.height };
}

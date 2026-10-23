// components/diagram-studio/present/exportPptx.js
// Deck export to PowerPoint (ADR-0007 section 8.3, slice P3), in the browser. This module is loaded on demand (the dialog
// imports it dynamically) and pptxgenjs is imported on the click of "Export", so neither is part of the editor route.
//
//   previewDeck(...)  : compile only (slide count, skipped slides, warnings, how many diagram pictures): no library loaded
//   exportDeckPptx(...): compile, capture one 2x PNG per connected group from the LIVE canvas (the same clone the PDF and PNG
//                        exports use), write the .pptx with pptxgenjs, return a download result for downloadExport
// Text, shapes, tables, docs and notes need no capture: they are written as native PowerPoint objects.

import { buildExportHost } from '../export/captureCanvas';
import { getFontEmbedCSS } from '../export/fontEmbed';
import { clampPixelRatio } from '../export/exportUtils';
import { nextFrames } from '../export/exportRenderer';
import { suspendCulling } from '../canvasCulling';
import { unionFrameRect } from './slideRect';
import { compileDeck } from '../../../lib/present/pptx/compile';
import { writeDeck } from '../../../lib/present/pptx/write';
import { pptxFilename } from '../../../lib/present/pptx/mapping';
import { resolveDeck } from '../../../lib/present/presentationModel';

export const PPTX_MIME = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
export const PICTURE_SCALE = 2; // diagrams are captured at 2x (ADR 8.3)

/** Slide count, skipped slides, warnings and picture count without loading pptxgenjs or touching the canvas. */
export function previewDeck({ content, presentationId, boardUrl }) {
  const ir = compileDeck(content, presentationId, { boardUrl });
  if (!ir) return null;
  return {
    title: ir.title,
    slides: ir.slides.length,
    skipped: ir.skipped,
    pictures: ir.pictures,
    warnings: ir.warnings,
    fonts: { heading: ir.theme.fonts.heading, body: ir.theme.fonts.body },
  };
}

/** The pptxgenjs constructor, from its own chunk (webpackChunkName keeps it out of every other bundle). */
async function loadPptxGenJS() {
  const mod = await import(/* webpackChunkName: "pptxgenjs" */ 'pptxgenjs');
  return mod.default || mod;
}

async function capturePicture(htmlToImage, item, { elements, connections, fontEmbedCSS }) {
  const pseudo = { id: `pptx-${item.key}`, x: item.world.x, y: item.world.y, size: { width: item.world.width, height: item.world.height } };
  const { host, bounds, cleanup } = buildExportHost({ scope: 'frame', frame: pseudo, elements, connections, padding: 0, background: 'white' });
  try {
    const keepNodes = new Set(item.elementIds);
    const keepConns = new Set(item.connectionIds);
    host.querySelectorAll('[data-connection-id]').forEach((n) => { if (n.isConnected && !keepConns.has(n.getAttribute('data-connection-id'))) n.remove(); });
    host.querySelectorAll('[data-node-id]').forEach((n) => { if (n.isConnected && !keepNodes.has(n.getAttribute('data-node-id'))) n.remove(); });
    if (typeof document !== 'undefined' && document.fonts?.ready) await document.fonts.ready;
    const pixelRatio = clampPixelRatio(bounds.width, bounds.height, PICTURE_SCALE);
    // transparent background: the slide's own background shows through
    const dataUrl = await htmlToImage.toPng(host, { width: bounds.width, height: bounds.height, pixelRatio, cacheBust: false, fontEmbedCSS });
    return dataUrl.replace(/^data:/, '');
  } finally {
    cleanup();
  }
}

/**
 * @param {{content: {elements: object[], connections: object[], presentations: object[], theme?: object}, presentationId: string,
 *          boardUrl?: string, officeSafeFonts?: boolean, signal?: AbortSignal, onProgress?: (p: {phase: string, done: number, total: number}) => void}} p
 * @returns {Promise<{format: 'pptx', content: Blob, mimeType: string, filename: string, slides: number, skipped: object, warnings: string[]}>}
 */
export async function exportDeckPptx({ content, presentationId, boardUrl, officeSafeFonts = true, signal, onProgress }) {
  const ir = compileDeck(content, presentationId, { boardUrl });
  if (!ir) throw new Error('That presentation was not found on this board.');
  if (!ir.slides.length) throw new Error('There are no slides to export. Add slides, or show hidden ones.');
  const pictures = ir.slides.flatMap((s) => s.items.filter((i) => i.kind === 'picture'));
  const images = {};
  if (pictures.length) {
    const htmlToImage = await import('html-to-image');
    const fontEmbedCSS = await getFontEmbedCSS();
    const resolved = resolveDeck(content, presentationId);
    const frames = resolved.playable.map((s) => s.frame);
    // the captures are clones of the live canvas, which mounts only what is near the viewport: keep the slides mounted
    const release = await suspendCulling(unionFrameRect(frames));
    try {
      for (let i = 0; i < pictures.length; i += 1) {
        if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
        onProgress?.({ phase: 'diagrams', done: i, total: pictures.length });
        const data = await capturePicture(htmlToImage, pictures[i], { elements: content.elements, connections: content.connections, fontEmbedCSS });
        images[pictures[i].key] = { data };
        await nextFrames(1);
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
    } finally {
      release();
    }
  }
  if (signal?.aborted) throw new DOMException('Export cancelled', 'AbortError');
  onProgress?.({ phase: 'writing', done: pictures.length, total: pictures.length });
  const PptxGenJS = await loadPptxGenJS();
  const { data, warnings } = await writeDeck(PptxGenJS, ir, { images, officeSafeFonts });
  return {
    format: 'pptx',
    content: new Blob([data], { type: PPTX_MIME }),
    mimeType: PPTX_MIME,
    filename: pptxFilename(ir.title),
    slides: ir.slides.length,
    skipped: ir.skipped,
    warnings: [...ir.warnings, ...warnings],
  };
}

// ADR-0007 P1 export: PDF has one page per visible slide at the slide's ratio (16:9 -> 960 x 540 pt), progress, cancel;
// a slide exports as a PNG. html-to-image and jsPDF are mocked (the e2e test checks a real PDF).

const mockPages = [];
const mockImages = [];
jest.mock('jspdf', () => ({
  jsPDF: class {
    constructor(opts) { mockPages.push(opts.format); this.out = { type: 'pdf' }; }
    setProperties() {}
    addPage(format) { mockPages.push(format); }
    addImage(...a) { mockImages.push(a); }
    output() { return new Blob(['%PDF'], { type: 'application/pdf' }); }
  },
}));
jest.mock('html-to-image', () => ({ toPng: jest.fn(async () => 'data:image/png;base64,iVBORw0KGgo=') }));
jest.mock('../../../components/diagram-studio/export/fontEmbed', () => ({ getFontEmbedCSS: jest.fn(async () => '') }));
jest.mock('../../../components/diagram-studio/export/captureCanvas', () => ({
  buildExportHost: jest.fn(({ frame }) => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const w = frame.size.width; const h = frame.size.height;
    return { host, bounds: { x: 0, y: 0, width: w, height: h }, cleanup: () => host.remove() };
  }),
}));

import { exportDeckPdf, exportSlidePng, pdfPageSize, scaleForSlides } from '../../../components/diagram-studio/present/exportDeck';
import { parsePresentQuery } from '../../../components/diagram-studio/present/PresentationHost';

const mk = (n, w = 1920, h = 1080) => ({ slideId: `s${n}`, frameId: `f${n}`, frame: { id: `f${n}`, x: n * 2000, y: 0, size: { width: w, height: h } } });

beforeEach(() => { mockPages.length = 0; mockImages.length = 0; });

describe('pdfPageSize', () => {
  test('540 pt tall, as wide as the ratio needs', () => {
    expect(pdfPageSize(1920, 1080)).toEqual({ width: 960, height: 540 });
    expect(pdfPageSize(1440, 1080)).toEqual({ width: 720, height: 540 });
    expect(pdfPageSize(1080, 1080)).toEqual({ width: 540, height: 540 });
    expect(pdfPageSize(0, 0)).toEqual({ width: 960, height: 540 });
    expect(pdfPageSize(10000, 100).width).toBe(1200);
  });
});

describe('exportDeckPdf', () => {
  test('one page per slide, 16:9 pages, each slide drawn full page, a Blob PDF named after the deck', async () => {
    const progress = [];
    const slides = Array.from({ length: 12 }, (_, i) => mk(i + 1));
    const r = await exportDeckPdf({ slides, elements: [], connections: [], title: 'Checkout review', onProgress: (d, t) => progress.push([d, t]) });
    expect(mockPages).toHaveLength(12); // the constructor's first page plus 11 added
    expect(mockPages.every((p) => p[0] === 960 && p[1] === 540)).toBe(true);
    expect(mockImages).toHaveLength(12);
    expect(mockImages[0].slice(1, 6)).toEqual(['PNG', 0, 0, 960, 540]);
    expect(r).toMatchObject({ format: 'pdf', pages: 12, mimeType: 'application/pdf', filename: 'Checkout review.pdf' });
    expect(r.content).toBeInstanceOf(Blob);
    expect(progress[0]).toEqual([0, 12]);
    expect(progress[progress.length - 1]).toEqual([12, 12]);
  });

  test('a slide of another shape gets its own page size', async () => {
    await exportDeckPdf({ slides: [mk(1), mk(2, 1440, 1080)], elements: [], connections: [], title: 'Mixed' });
    expect(mockPages).toEqual([[960, 540], [720, 540]]);
  });

  test('nothing to export: a clear error', async () => {
    await expect(exportDeckPdf({ slides: [], elements: [], connections: [], title: 'x' })).rejects.toThrow(/no slides to export/);
  });

  test('cancelling between slides rejects with AbortError and leaves no clone behind', async () => {
    const ctl = new AbortController();
    const slides = [mk(1), mk(2), mk(3)];
    const p = exportDeckPdf({ slides, elements: [], connections: [], title: 'x', signal: ctl.signal, onProgress: (d) => { if (d === 1) ctl.abort(); } });
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
    expect(document.body.children).toHaveLength(0);
  });
});

describe('exportDeckPdf memory discipline', () => {
  test('the pixel ratio shrinks with the deck: 2x up to 20 slides, 1.5x up to 60, 1x above', async () => {
    expect([1, 20, 21, 60, 61, 200].map(scaleForSlides)).toEqual([2, 2, 1.5, 1.5, 1, 1]);
    const { toPng } = require('html-to-image');
    for (const [n, ratio] of [[3, 2], [30, 1.5], [70, 1]]) {
      toPng.mockClear();
      await exportDeckPdf({ slides: Array.from({ length: n }, (_, i) => mk(i + 1)), elements: [], connections: [], title: 'x' });
      expect(toPng.mock.calls[0][1].pixelRatio).toBe(ratio);
    }
  });

  test('each slide clone and image is released before the next slide is rendered', async () => {
    const { buildExportHost } = require('../../../components/diagram-studio/export/captureCanvas');
    const { toPng } = require('html-to-image');
    const live = [];
    toPng.mockImplementation(async () => { live.push(document.body.children.length); return 'data:image/png;base64,iVBORw0KGgo='; });
    buildExportHost.mockClear();
    await exportDeckPdf({ slides: Array.from({ length: 30 }, (_, i) => mk(i + 1)), elements: [], connections: [], title: 'x' });
    expect(buildExportHost).toHaveBeenCalledTimes(30);
    expect(Math.max(...live)).toBe(1); // never more than one slide clone in the document at a time
    expect(document.body.children).toHaveLength(0);
    // each page got its image and the pipeline yielded a task between slides (progress is reported after every one)
    expect(mockImages).toHaveLength(30);
  });
});

describe('exportSlidePng', () => {
  test('returns a PNG blob named after the deck and slide number', async () => {
    const r = await exportSlidePng({ slide: mk(2), elements: [], connections: [], title: 'Review', number: 2 });
    expect(r).toMatchObject({ format: 'png', mimeType: 'image/png', filename: 'Review-slide-2.png', width: 1920, height: 1080 });
    expect(r.content).toBeInstanceOf(Blob);
    expect(r.content.type).toBe('image/png');
  });
});

describe('deep link', () => {
  test('?present=<id>&slide=<n> is 1-based; bad values fall back to the first slide; no param means no link', () => {
    expect(parsePresentQuery('?present=pres-1&slide=3')).toEqual({ presentationId: 'pres-1', index: 2 });
    expect(parsePresentQuery('?present=pres-1')).toEqual({ presentationId: 'pres-1', index: 0 });
    expect(parsePresentQuery('?present=pres-1&slide=0')).toEqual({ presentationId: 'pres-1', index: 0 });
    expect(parsePresentQuery('?present=pres-1&slide=abc')).toEqual({ presentationId: 'pres-1', index: 0 });
    expect(parsePresentQuery('?slide=2')).toBeNull();
    expect(parsePresentQuery('')).toBeNull();
  });
});

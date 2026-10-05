import {
  unionRects,
  rotatedBounds,
  fitPdfPage,
  exportFilename,
  clampPixelRatio,
  pickElementsForScope,
  viewportCenter,
} from '../../../components/diagram-studio/export/exportUtils';

describe('unionRects', () => {
  it('returns null for no rects', () => {
    expect(unionRects([])).toBeNull();
  });
  it('unions and pads', () => {
    expect(unionRects([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 30, width: 10, height: 10 }], 5))
      .toEqual({ x: -5, y: -5, width: 40, height: 50 });
  });
});

describe('rotatedBounds', () => {
  it('is identity at 0 degrees', () => {
    expect(rotatedBounds({ x: 0, y: 0, width: 100, height: 50 }, 0)).toEqual({ x: 0, y: 0, width: 100, height: 50 });
  });
  it('swaps extents at 90 degrees around the center', () => {
    const r = rotatedBounds({ x: 0, y: 0, width: 100, height: 50 }, 90);
    expect(r.width).toBeCloseTo(50);
    expect(r.height).toBeCloseTo(100);
    expect(r.x).toBeCloseTo(25);
    expect(r.y).toBeCloseTo(-25);
  });
});

describe('fitPdfPage', () => {
  it('auto page matches content size in points (96dpi -> 72dpi)', () => {
    const p = fitPdfPage({ contentWidth: 800, contentHeight: 400, pageSize: 'auto' });
    expect(p.pageWidth).toBeCloseTo(600);
    expect(p.pageHeight).toBeCloseTo(300);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
    expect(p.width).toBeCloseTo(600);
  });
  it('A4 landscape fits wide content within margins and centers it', () => {
    const p = fitPdfPage({ contentWidth: 2000, contentHeight: 500, pageSize: 'a4', orientation: 'landscape', margin: 20 });
    expect(p.pageWidth).toBeCloseTo(841.89, 1);
    expect(p.pageHeight).toBeCloseTo(595.28, 1);
    expect(p.width).toBeCloseTo(841.89 - 40, 1);
    expect(p.x).toBeCloseTo(20, 1);
    expect(p.y).toBeCloseTo((595.28 - p.height) / 2, 1);
    expect(p.width / p.height).toBeCloseTo(4);
  });
  it('letter portrait swaps dimensions', () => {
    const p = fitPdfPage({ contentWidth: 500, contentHeight: 500, pageSize: 'letter', orientation: 'portrait', margin: 0 });
    expect(p.pageWidth).toBeCloseTo(612);
    expect(p.pageHeight).toBeCloseTo(792);
    expect(p.width).toBeCloseTo(612);
  });
  it('orientation auto picks landscape for wide content', () => {
    const p = fitPdfPage({ contentWidth: 1000, contentHeight: 300, pageSize: 'a4', orientation: 'auto' });
    expect(p.pageWidth).toBeGreaterThan(p.pageHeight);
  });
  it('never upscales beyond the page', () => {
    const p = fitPdfPage({ contentWidth: 10, contentHeight: 10, pageSize: 'a4', orientation: 'portrait', margin: 20 });
    expect(p.width).toBeLessThanOrEqual(595.28);
  });
});

describe('viewportCenter', () => {
  it('converts the container center to canvas coordinates', () => {
    // inner transform: scale(s) translate(x, y) => canvas = screen / s - t
    expect(viewportCenter({ x: -1000, y: -500, scale: 2 }, { width: 800, height: 600 })).toEqual({ x: 1200, y: 650 });
  });
  it('defaults to scale 1 and a 1200x800 area', () => {
    expect(viewportCenter({ x: 0, y: 0 })).toEqual({ x: 600, y: 400 });
  });
});

describe('exportFilename', () => {
  it('uses the sanitized diagram name and extension', () => {
    expect(exportFilename('Q3 Plan: v2', 'pdf')).toBe('Q3 Plan- v2.pdf');
  });
  it('maps jpeg to jpg and falls back to diagram', () => {
    expect(exportFilename('', 'jpeg')).toBe('diagram.jpg');
  });
});

describe('clampPixelRatio', () => {
  it('keeps the requested ratio when small', () => {
    expect(clampPixelRatio(1000, 800, 3)).toBe(3);
  });
  it('reduces the ratio for huge outputs', () => {
    const r = clampPixelRatio(8000, 8000, 3);
    expect(r).toBeLessThan(3);
    expect(8000 * r).toBeLessThanOrEqual(16384);
  });
});

describe('pickElementsForScope', () => {
  const els = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  const conns = [
    { id: 'ab', sourceId: 'a', targetId: 'b' },
    { id: 'bc', sourceId: 'b', targetId: 'c' },
    { id: 'free', sourceId: 'a', targetPos: { x: 1, y: 1 } },
  ];
  it('all returns everything', () => {
    const r = pickElementsForScope('canvas', els, conns, { nodeIds: [], connectionIds: [] });
    expect(r.nodeIds.size).toBe(3);
    expect(r.connectionIds.size).toBe(3);
  });
  it('selection keeps selected nodes and connections between them', () => {
    const r = pickElementsForScope('selection', els, conns, { nodeIds: ['a', 'b'], connectionIds: [] });
    expect([...r.nodeIds].sort()).toEqual(['a', 'b']);
    expect([...r.connectionIds].sort()).toEqual(['ab']);
  });
  it('selection includes explicitly selected connections and their endpoints', () => {
    const r = pickElementsForScope('selection', els, conns, { nodeIds: [], connectionIds: ['bc'] });
    expect([...r.nodeIds].sort()).toEqual(['b', 'c']);
    expect([...r.connectionIds]).toEqual(['bc']);
  });
});

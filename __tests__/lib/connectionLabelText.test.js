/**
 * ADR-0008 5 / T2: connection labels are `auto` text, at most 200 px wide, wrapped. The background is the measured
 * lines plus padding (it replaces `chars x 8`) and the label is placed at the midpoint, moved clear of nodes when it
 * would overlap one (findNonOverlappingLabelPosition now gets the real size).
 */
import { connectionLabelLayout, endpointLabelLayout, CONN_LABEL } from '../../lib/text/connectionLabel';
import { findNonOverlappingLabelPosition } from '../../components/diagram-studio/connections/geometry/labelPositioning';
import { MIN_SIZE } from '../../lib/text/tokens';

const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';

describe('connectionLabelLayout', () => {
  test('a short label is one line, 12 px, with a measured (not chars x 8) background', () => {
    const l = connectionLabelLayout('Yes');
    expect(l.layout.lines.map((x) => x.text)).toEqual(['Yes']);
    expect(l.layout.fontSize).toBe(12);
    expect(l.width).toBeGreaterThanOrEqual(CONN_LABEL.minWidth);
    expect(connectionLabelLayout('iiiiiiiiii').width).toBeLessThan(Math.max(48, 10 * 8)); // the old chars x 8 estimate gave 80
    expect(l.height).toBe(Math.max(20, Math.ceil(l.layout.height) + 2 * CONN_LABEL.padY));
  });

  test('wide letters get a wide background, narrow letters a narrow one (real glyph widths)', () => {
    expect(connectionLabelLayout('WWWWWWWW').width).toBeGreaterThan(connectionLabelLayout('iiiiiiii').width);
  });

  test('never wider than 200 px; long text wraps at word boundaries to at most 3 lines and is flagged when cut', () => {
    const l = connectionLabelLayout(C140);
    expect(l.width).toBeLessThanOrEqual(CONN_LABEL.maxWidth);
    expect(l.layout.lines.length).toBeLessThanOrEqual(CONN_LABEL.maxLines);
    expect(l.layout.overflow).toBeTruthy();
    expect(l.layout.lines[l.layout.lines.length - 1].text.endsWith('…')).toBe(true);
    for (const ln of l.layout.lines) expect(ln.width).toBeLessThanOrEqual(l.width - 2 * CONN_LABEL.padX + 2);
  });

  test('a medium label wraps instead of being cut: no overflow, no broken word', () => {
    const l = connectionLabelLayout('Validate payment details before confirming');
    expect(l.layout.overflow).toBe(false);
    expect(l.layout.breaks.emergency).toBe(0);
    expect(l.layout.lines.length).toBeGreaterThan(1);
  });

  test('line breaks in the label are kept', () => {
    expect(connectionLabelLayout('yes\nno').layout.lines.map((x) => x.text)).toEqual(['yes', 'no']);
  });

  test('is at least 11 px for every label (CJK, Arabic, emoji)', () => {
    for (const t of ['\u{9867}\u{5BA2}\u{6E80}\u{8DB3}\u{5EA6}\u{5206}\u{6790}', '\u{062A}\u{062D}\u{0644}\u{064A}\u{0644} \u{0631}\u{0636}\u{0627}', '\u{1F680} go \u{2705}']) {
      const l = connectionLabelLayout(t);
      expect(l.layout.fontSize).toBeGreaterThanOrEqual(MIN_SIZE);
      expect(l.layout.overflow).toBe(false);
    }
  });

  test('deterministic', () => {
    expect(connectionLabelLayout(C140)).toEqual(connectionLabelLayout(C140));
  });

  test('an empty label has no lines', () => {
    expect(connectionLabelLayout('').layout.lines).toHaveLength(0);
  });
});

describe('endpointLabelLayout (multiplicity and cardinality)', () => {
  test('is the 11 px meta role with a measured width', () => {
    const l = endpointLabelLayout('0..*');
    expect(l.layout.fontSize).toBe(11);
    expect(l.width).toBeLessThan(40);
    expect(l.height).toBeGreaterThanOrEqual(16);
  });
});

describe('placement never collides with a node when there is room', () => {
  const rectsOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const rectAt = (p, s) => ({ x: p.x - s.width / 2, y: p.y - s.height / 2, width: s.width, height: s.height });

  test('a free midpoint stays where it is', () => {
    expect(findNonOverlappingLabelPosition({ x: 100, y: 100 }, [{ x: 400, y: 400, width: 50, height: 50 }], { width: 60, height: 20 })).toEqual({ x: 100, y: 100 });
  });

  test('a tall wrapped label that overlaps a node is moved clear of it (real size, not a 30 px nudge)', () => {
    const size = { width: 200, height: 56 };
    const node = { x: 40, y: 60, width: 160, height: 100 };
    const preferred = { x: 120, y: 110 };
    const p = findNonOverlappingLabelPosition(preferred, [node], size);
    expect(rectsOverlap(rectAt(p, size), node)).toBe(false);
  });

  test('moves to the nearest free spot among several nodes', () => {
    const size = { width: 120, height: 40 };
    const nodes = [{ x: 0, y: 0, width: 300, height: 60 }, { x: 0, y: 100, width: 300, height: 60 }];
    const p = findNonOverlappingLabelPosition({ x: 150, y: 30 }, nodes, size);
    expect(nodes.some((n) => rectsOverlap(rectAt(p, size), n))).toBe(false);
  });

  test('when nothing is free it falls back to the preferred position', () => {
    const size = { width: 100, height: 30 };
    const wall = { x: -5000, y: -5000, width: 10000, height: 10000 };
    expect(findNonOverlappingLabelPosition({ x: 5, y: 5 }, [wall], size)).toEqual({ x: 5, y: 5 });
  });
});

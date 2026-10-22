/**
 * ADR-0008 5 / T2: connection labels are `auto` text, at most 200 px wide, wrapped. The background is the measured
 * lines plus padding (it replaces `chars x 8`) and the label is placed at the midpoint, moved clear of nodes when it
 * would overlap one (findNonOverlappingLabelPosition now gets the real size).
 */
import { connectionLabelLayout, endpointLabelLayout, CONN_LABEL } from '../../lib/text/connectionLabel';
import { findNonOverlappingLabelPosition, placeEndpointLabel } from '../../components/diagram-studio/connections/geometry/labelPositioning';
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

describe('a tight gap narrows the mid label', () => {
  test('the room between the nodes caps the width (never below 76 px)', () => {
    expect(connectionLabelLayout('Validate payment details', 100).width).toBeLessThanOrEqual(92);
    expect(connectionLabelLayout('Validate payment details', 20).width).toBeLessThanOrEqual(76);
    expect(connectionLabelLayout('Validate payment details').width).toBeGreaterThan(92);
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

describe('endpoint labels never sit over a node (M1)', () => {
  const rectsOverlap = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  const rectAt = (p, s) => ({ x: p.x - s.width / 2, y: p.y - s.height / 2, width: s.width, height: s.height });

  test('the width is capped by the room along the line and wraps to up to 3 lines', () => {
    const l = endpointLabelLayout('exactly one customer', 56);
    expect(l.width).toBeLessThanOrEqual(56);
    expect(l.layout.lines.length).toBeLessThanOrEqual(3);
    expect(endpointLabelLayout('0..*', 56).width).toBeLessThan(40);
  });

  test('a long label in a 60 px gap is placed beside the line, outside both nodes', () => {
    const a = { x: 0, y: 0, width: 200, height: 160 };
    const b = { x: 260, y: 0, width: 200, height: 160 };
    const size = (() => { const l = endpointLabelLayout('exactly one customer', 52); return { width: l.width, height: l.height }; })();
    const end = { x: 260, y: 80 }; // the line arrives at the left side of b
    const other = { x: 200, y: 80 };
    const p = placeEndpointLabel(end, other, size, [a, b]);
    const r = rectAt(p, size);
    expect(rectsOverlap(r, a)).toBe(false);
    expect(rectsOverlap(r, b)).toBe(false);
    expect(Math.abs(p.y - end.y)).toBeGreaterThanOrEqual(size.height / 2); // beside the line, not on it
  });

  test('a short label next to its node stays close to the endpoint', () => {
    const b = { x: 260, y: 0, width: 200, height: 160 };
    const size = { width: 30, height: 16 };
    const p = placeEndpointLabel({ x: 260, y: 80 }, { x: 100, y: 80 }, size, [b]);
    expect(rectsOverlap(rectAt(p, size), b)).toBe(false);
    expect(Math.hypot(p.x - 260, p.y - 80)).toBeLessThan(40);
  });

  test('is deterministic and works for vertical lines', () => {
    const b = { x: 0, y: 200, width: 120, height: 80 };
    const size = { width: 40, height: 16 };
    const a = placeEndpointLabel({ x: 60, y: 200 }, { x: 60, y: 100 }, size, [b]);
    expect(a).toEqual(placeEndpointLabel({ x: 60, y: 200 }, { x: 60, y: 100 }, size, [b]));
    expect(rectsOverlap(rectAt(a, size), b)).toBe(false);
  });
});

describe('a long mid label stays near its line (L4)', () => {
  test('takes the smallest clear offset, not a far ring', () => {
    const size = { width: 120, height: 36 };
    const node = { x: 80, y: 100, width: 100, height: 20 };
    const p = findNonOverlappingLabelPosition({ x: 130, y: 110 }, [node], size);
    expect(Math.hypot(p.x - 130, p.y - 110)).toBeLessThanOrEqual(36 / 2 + 20 / 2 + 12 + 6);
  });

  test('reports a leader when the label had to move far from the line', () => {
    const { placeMidLabel } = require('../../components/diagram-studio/connections/geometry/labelPositioning');
    const size = { width: 160, height: 56 };
    const node = { x: 0, y: 60, width: 400, height: 100 };
    const r = placeMidLabel({ x: 200, y: 140 }, { x: 200, y: 155 }, [node], size);
    expect(r.leader).toEqual({ x: 200, y: 155 });
    const free = placeMidLabel({ x: 900, y: 900 }, { x: 900, y: 915 }, [node], size);
    expect(free.leader).toBeNull();
    expect(free.position).toEqual({ x: 900, y: 900 });
  });
});

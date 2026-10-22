/**
 * ADR-0008 5 / T2: connection labels are drawn from the shared layout (pinned tspans), sized by the measured lines, and a
 * clamped label carries the full text as its tooltip. Endpoint labels do the same at the 11 px meta size.
 */
import React from 'react';
import { render } from '@testing-library/react';
import ConnectionLabel from '../../../components/diagram-studio/connections/labels/ConnectionLabel';
import EndpointLabel from '../../../components/diagram-studio/connections/labels/EndpointLabel';
import { connectionLabelLayout, CONN_LABEL } from '../../../lib/text/connectionLabel';

const C140 = 'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review';
const draw = (ui) => render(<svg>{ui}</svg>);

describe('ConnectionLabel', () => {
  test('draws one text element with a tspan per laid-out line, never the browser wrapping', () => {
    const { container } = draw(<ConnectionLabel value="Validate payment details before confirming" position={{ x: 200, y: 100 }} />);
    const block = container.querySelector('text[data-text-block]');
    const expected = connectionLabelLayout('Validate payment details before confirming').layout.lines.map((l) => l.text);
    expect([...block.querySelectorAll('tspan')].map((t) => t.textContent)).toEqual(expected);
    expect(expected.length).toBeGreaterThan(1);
    expect(block.getAttribute('data-font-size')).toBe('12');
    expect(container.querySelectorAll('text')).toHaveLength(1); // one element per label
  });

  test('the background is the measured box centered on the position, not chars x 8', () => {
    const { container } = draw(<ConnectionLabel value="Yes" position={{ x: 200, y: 100 }} />);
    const rect = container.querySelector('rect');
    const m = connectionLabelLayout('Yes');
    expect(parseFloat(rect.getAttribute('width'))).toBe(m.width);
    expect(parseFloat(rect.getAttribute('height'))).toBe(m.height);
    expect(parseFloat(rect.getAttribute('x'))).toBeCloseTo(200 - m.width / 2, 5);
    expect(parseFloat(rect.getAttribute('y'))).toBeCloseTo(100 - m.height / 2, 5);
  });

  test('every tspan lies inside the background rectangle', () => {
    const { container } = draw(<ConnectionLabel value={C140} position={{ x: 300, y: 80 }} />);
    const rect = container.querySelector('rect');
    const x0 = parseFloat(rect.getAttribute('x'));
    const y0 = parseFloat(rect.getAttribute('y'));
    const w = parseFloat(rect.getAttribute('width'));
    const h = parseFloat(rect.getAttribute('height'));
    expect(w).toBeLessThanOrEqual(CONN_LABEL.maxWidth);
    const lay = connectionLabelLayout(C140).layout;
    [...container.querySelectorAll('tspan')].forEach((t, i) => {
      const x = parseFloat(t.getAttribute('x'));
      const y = parseFloat(t.getAttribute('y'));
      expect(x).toBeGreaterThanOrEqual(x0);
      expect(x + lay.lines[i].width).toBeLessThanOrEqual(x0 + w + 1);
      expect(y).toBeGreaterThan(y0);
      expect(y).toBeLessThanOrEqual(y0 + h);
    });
  });

  test('a clamped label ends in an ellipsis and carries the full text as its tooltip (never silent)', () => {
    const { container } = draw(<ConnectionLabel value={C140} position={{ x: 300, y: 80 }} />);
    const block = container.querySelector('text[data-text-block]');
    expect(block.getAttribute('data-overflow')).toBe('true');
    expect(block.querySelector('title').textContent).toBe(C140);
    const spans = [...block.querySelectorAll('tspan')];
    expect(spans[spans.length - 1].textContent.endsWith('…')).toBe(true);
  });

  test('a label that fits has no tooltip and no overflow flag', () => {
    const { container } = draw(<ConnectionLabel value="Yes" position={{ x: 0, y: 0 }} />);
    const block = container.querySelector('text[data-text-block]');
    expect(block.getAttribute('data-overflow')).toBeNull();
    expect(block.querySelector('title')).toBeNull();
  });

  test('an empty label draws nothing unless selected; selected shows the dashed placeholder chip', () => {
    expect(draw(<ConnectionLabel value="" position={{ x: 0, y: 0 }} />).container.querySelector('text')).toBeNull();
    const { container } = draw(<ConnectionLabel value="" isSelected position={{ x: 0, y: 0 }} />);
    expect(container.querySelector('rect').getAttribute('stroke-dasharray')).toBeTruthy();
    expect(container.querySelector('text').textContent).toMatch(/Double-click to label/);
  });

  test('no inline font size literal; the fonts come from the layout (12 px), the input style is a class', () => {
    const { container } = draw(<ConnectionLabel value="Yes" position={{ x: 0, y: 0 }} isEditing />);
    expect(container.querySelector('input.ds-conn-label-input')).not.toBeNull();
    expect(container.querySelector('input').getAttribute('style')).toBeNull();
  });

  test('a measured box passed by the caller is the one drawn', () => {
    const labelBox = connectionLabelLayout('Yes');
    const { container } = draw(<ConnectionLabel value="Yes" position={{ x: 50, y: 50 }} labelBox={labelBox} />);
    expect(parseFloat(container.querySelector('rect').getAttribute('width'))).toBe(labelBox.width);
  });
});

describe('EndpointLabel', () => {
  test('draws the multiplicity from the layout at 11 px inside a measured background', () => {
    const { container } = draw(<EndpointLabel value="0..*" position={{ x: 10, y: 10 }} port="right" />);
    expect(container.querySelector('text[data-text-block]').getAttribute('data-font-size')).toBe('11');
    expect(container.querySelector('tspan').textContent).toBe('0..*');
    expect(parseFloat(container.querySelector('rect').getAttribute('width'))).toBeLessThan(40);
  });

  test('renders nothing without a value', () => {
    expect(draw(<EndpointLabel value="" position={{ x: 1, y: 1 }} />).container.querySelector('text')).toBeNull();
  });
});

describe('review fixes (M1, L4)', () => {
  test('L4: a label moved away from its line draws a leader tick to the line point', () => {
    const { container } = draw(<ConnectionLabel value="Yes" position={{ x: 100, y: 20 }} leader={{ x: 100, y: 90 }} />);
    const line = container.querySelector('line.ds-conn-label-leader');
    expect(line).not.toBeNull();
    expect(line.getAttribute('x2')).toBe('100');
    expect(line.getAttribute('y2')).toBe('90');
    expect(draw(<ConnectionLabel value="Yes" position={{ x: 100, y: 20 }} />).container.querySelector('line')).toBeNull();
  });

  test('M1: an endpoint label next to a node is placed outside it and capped by the room along the line', () => {
    const node = { x: 260, y: 0, width: 200, height: 160 };
    const other = { x: 200, y: 80 };
    const { container } = draw(<EndpointLabel value="exactly one customer" position={{ x: 260, y: 80 }} otherPos={other} nodes={[node, { x: 0, y: 0, width: 200, height: 160 }]} port="left" />);
    const rect = container.querySelector('rect');
    const x = parseFloat(rect.getAttribute('x'));
    const w = parseFloat(rect.getAttribute('width'));
    const y = parseFloat(rect.getAttribute('y'));
    const h = parseFloat(rect.getAttribute('height'));
    expect(w).toBeLessThanOrEqual(60 - 8 + 0.5);
    const overlaps = (n) => x < n.x + n.width && x + w > n.x && y < n.y + n.height && y + h > n.y;
    expect(overlaps(node)).toBe(false);
    expect(overlaps({ x: 0, y: 0, width: 200, height: 160 })).toBe(false);
  });
});


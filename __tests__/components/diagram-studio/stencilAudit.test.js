/**
 * Stencil audit: every stencil in every registered pack renders at a usable
 * default size with its label visible (the model drives the rendering).
 */
import React from 'react';
import { render } from '@testing-library/react';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';

const MIN_W = 40;
const MIN_H = 30;
const registry = createDefaultRegistry();
const packs = registry.getAll();

// Notation primitives that are thin or tiny by definition (lines, UML pseudo-states,
// bars, brackets). They still need a visible longest edge of at least MIN_MARKER.
const MIN_MARKER = 30;
const MARKER_SIZE = new Set([
  'core/divider',
  'mind-map/summary',
  'uml-class/initial-node',
  'uml-class/final-node',
  'uml-class/flow-final',
  'uml-class/initial-state',
  'uml-class/final-state',
  'uml-class/history',
  'uml-class/fork-join',
  'uml-class/activation',
]);
const LABEL_EXEMPT = new Set([]);

const cases = packs.flatMap((p) => p.stencils.map((s) => [`${p.id}/${s.id}`, p, s]));

let errorSpy;
beforeEach(() => { errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {}); });
afterEach(() => errorSpy.mockRestore());

describe('stencil audit', () => {
  test('there are stencils to audit', () => expect(cases.length).toBeGreaterThan(50));

  test.each(cases)('%s has a usable default size', (n, _p, s) => {
    if (MARKER_SIZE.has(n)) {
      expect(Math.max(s.defaultSize.width, s.defaultSize.height)).toBeGreaterThanOrEqual(MIN_MARKER);
      return;
    }
    expect(s.defaultSize.width).toBeGreaterThanOrEqual(MIN_W);
    expect(s.defaultSize.height).toBeGreaterThanOrEqual(MIN_H);
  });

  test.each(cases)('%s renders its label', (n, p, s) => {
    if (LABEL_EXEMPT.has(n)) return;
    const el = { id: 'n1', type: s.id, label: 'UniqueLbl42', name: 'UniqueLbl42', x: 0, y: 0, size: { ...s.defaultSize } };
    const node = p.renderNode ? p.renderNode(el, s, false) : null;
    // null/undefined => the canvas falls back to its default label renderer
    if (node === null || node === undefined) return;
    const { container } = render(<div>{node}</div>);
    expect(container.textContent).toContain('UniqueLbl42');
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { parseFieldsText, entityMinHeight, visibleRows } from '../../../components/diagram-studio/packs/erdFields';
import ERDPack from '../../../components/diagram-studio/packs/ERDPack';
import ProcessFlowPack from '../../../components/diagram-studio/packs/ProcessFlowPack';
import CLDPack from '../../../components/diagram-studio/packs/CLDPack';
import TOGAFPack from '../../../components/diagram-studio/packs/TOGAFPack';
import { PackRegistry } from '../../../components/diagram-studio/packs/PackRegistry';

const mockUpdateElement = jest.fn();
const mockEndGesture = jest.fn();
let mockSelected = [];
jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({
    updateElement: (...a) => mockUpdateElement(...a),
    updateConnection: jest.fn(),
    removeElement: jest.fn(),
    removeConnection: jest.fn(),
    endGesture: () => mockEndGesture(),
  }),
  useDiagramSelection: () => ({ selectedElements: mockSelected, selectedConnections: [], clearSelection: jest.fn() }),
}));
import PropertiesPanel from '../../../components/diagram-studio/PropertiesPanel';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';

describe('erdFields parsing hardening', () => {
  test('inherited object keys are not key tokens', () => {
    const [a] = parseFieldsText('id constructor');
    expect(a.dataType).toBe('constructor');
    expect(a.constructor).toBe(Object);
    const [b] = parseFieldsText('id __proto__ PK');
    expect(b.dataType).toBe('__proto__');
    expect(b.isPrimaryKey).toBe(true);
    expect(Object.getPrototypeOf(b)).toBe(Object.prototype);
  });
  test('commas inside parentheses stay in the type', () => {
    const [r] = parseFieldsText('price decimal(10, 2) PK');
    expect(r).toEqual(expect.objectContaining({ name: 'price', dataType: 'decimal(10, 2)', isPrimaryKey: true }));
    const [r2] = parseFieldsText('price decimal(10,2), FK');
    expect(r2).toEqual(expect.objectContaining({ dataType: 'decimal(10,2)', isForeignKey: true }));
  });
});

describe('ERD row capacity', () => {
  test('entityMinHeight grows with rows and never below one row', () => {
    expect(entityMinHeight(10, 0)).toBeGreaterThan(entityMinHeight(5, 0));
    expect(entityMinHeight(0, 0)).toBe(entityMinHeight(1, 0));
  });
  test('visibleRows shows all when they fit, else reserves a "+N more" row', () => {
    const h = entityMinHeight(5, 0);
    expect(visibleRows(h, 5, 0)).toEqual({ shown: 5, hidden: 0 });
    const small = entityMinHeight(3, 0);
    const v = visibleRows(small, 8, 0);
    expect(v.shown + v.hidden).toBe(8);
    expect(v.hidden).toBeGreaterThan(0);
    expect(v.shown).toBeGreaterThanOrEqual(1);
  });

  const stencil = ERDPack.stencils.find((s) => s.id === 'entity');
  const fields = Array.from({ length: 9 }, (_, i) => ({ name: `f${i}`, dataType: 'INT' }));
  const el = (height) => ({ id: 'e', type: 'entity', label: 'T', size: { width: 200, height }, data: { fields } });

  test('renderer shows +N more when the entity is too small', () => {
    const { container } = render(<div>{ERDPack.renderNode(el(160), stencil, false)}</div>);
    expect(container.textContent).toMatch(/\+\d+ more/);
    expect(container.querySelectorAll('.erd-field').length).toBeLessThan(10);
  });
  test('no +N more when tall enough', () => {
    const { container } = render(<div>{ERDPack.renderNode(el(entityMinHeight(9, 0)), stencil, false)}</div>);
    expect(container.textContent).not.toMatch(/more/);
    expect(container.querySelectorAll('.erd-field').length).toBe(9);
  });
  test('long type has a tooltip and ellipsis; name cell keeps a min width', () => {
    const f = [{ name: 'id', dataType: 'x'.repeat(80) }];
    const { container } = render(<div>{ERDPack.renderNode({ ...el(160), data: { fields: f } }, stencil, false)}</div>);
    const type = container.querySelector('.erd-field-type');
    expect(type.getAttribute('title')).toBe('x'.repeat(80));
    expect(type.style.textOverflow).toBe('ellipsis');
    expect(container.querySelector('.erd-field-name').style.minWidth).not.toBe('');
  });
});

describe('Decision gateway on small sizes', () => {
  const stencil = ProcessFlowPack.stencils.find((s) => s.id === 'exclusive-gateway');
  test('palette icon is a diamond', () => expect(stencil.icon).toBe('◇'));
  test('50x50 stored decision renders label below (not clipped inside)', () => {
    const el = { id: 'd', type: 'exclusive-gateway', label: 'Decision', size: { width: 50, height: 50 } };
    const { container } = render(<div>{ProcessFlowPack.renderNode(el, stencil, false)}</div>);
    expect(container.querySelector('.ds-node-label-below')).not.toBeNull();
    expect(container.textContent).toContain('Decision');
  });
  test('default size keeps label inside', () => {
    const el = { id: 'd', type: 'exclusive-gateway', label: 'Decision', size: { ...stencil.defaultSize } };
    const { container } = render(<div>{ProcessFlowPack.renderNode(el, stencil, false)}</div>);
    expect(container.querySelector('.ds-node-label-below')).toBeNull();
    expect(container.textContent).toContain('Decision');
  });
});

describe('CLD loop default labels', () => {
  test('stencils declare R / B default labels used by createElementFromStencil', () => {
    const reg = new PackRegistry();
    reg.register(CLDPack);
    expect(reg.createElementFromStencil('reinforcing-loop', 'cld').label).toBe('R');
    expect(reg.createElementFromStencil('balancing-loop', 'cld').label).toBe('B');
    expect(reg.createElementFromStencil('variable', 'cld').label).toBe('Variable');
  });
});

describe('TOGAF Business Actor label vs icon', () => {
  test('label is inset away from the stick figure', () => {
    const stencil = TOGAFPack.stencils.find((s) => s.id === 'business-actor');
    const el = { id: 'a', type: 'business-actor', label: 'Customer', size: { ...stencil.defaultSize } };
    const { container } = render(<div>{TOGAFPack.renderNode(el, stencil, false)}</div>);
    expect([...container.querySelectorAll('div')].some((d) => d.style.paddingRight === '34px')).toBe(true);
  });
});

describe('Properties number inputs coalesce undo', () => {
  const registry = createDefaultRegistry();
  const el = { id: 'a', type: 'rectangle', packId: 'core', label: 'A', x: 50100, y: 50100, size: { width: 120, height: 80 }, color: '#3b82f6' };
  beforeEach(() => { mockUpdateElement.mockClear(); mockEndGesture.mockClear(); mockSelected = [el]; });

  test.each([['X'], ['Y'], ['Width'], ['Height'], ['Font size']])('%s edits share a coalesce key and end on blur', (label) => {
    render(<PropertiesPanel packRegistry={registry} />);
    const input = screen.getByLabelText(label);
    fireEvent.change(input, { target: { value: '33' } });
    fireEvent.change(input, { target: { value: '34' } });
    const calls = mockUpdateElement.mock.calls;
    expect(calls[0][2]).toEqual(expect.objectContaining({ coalesceKey: expect.any(String) }));
    expect(calls[0][2].coalesceKey).toBe(calls[1][2].coalesceKey);
    fireEvent.blur(input);
    expect(mockEndGesture).toHaveBeenCalled();
  });
});

describe('ERD entity auto-grow from the editor', () => {
  const registry = createDefaultRegistry();
  beforeEach(() => mockUpdateElement.mockClear());

  const entity = (rows, height) => ({
    id: 'e', type: 'entity', packId: 'erd', label: 'T', x: 50000, y: 50000,
    size: { width: 200, height }, data: { fields: rows },
  });

  test('adding a row grows the height in the same update', () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ name: `f${i}` }));
    mockSelected = [entity(rows, 160)];
    render(<PropertiesPanel packRegistry={registry} />);
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    const [, patch] = mockUpdateElement.mock.calls.at(-1);
    expect(patch.data.fields).toHaveLength(6);
    expect(patch.size.height).toBe(Math.max(160, entityMinHeight(6, 0)));
    expect(patch.size.height).toBeGreaterThanOrEqual(entityMinHeight(6, 0));
  });
  test('never shrinks a larger user height', () => {
    mockSelected = [entity([{ name: 'a' }], 400)];
    render(<PropertiesPanel packRegistry={registry} />);
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    const [, patch] = mockUpdateElement.mock.calls.at(-1);
    expect(patch.size?.height ?? 400).toBe(400);
  });
});

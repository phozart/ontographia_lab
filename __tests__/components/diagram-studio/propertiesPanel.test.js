import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { createDefaultRegistry } from '../../../components/diagram-studio/packs';

const mockUpdateElement = jest.fn();
let mockSelected = [];

jest.mock('../../../components/diagram-studio/DiagramContext', () => ({
  useDiagram: () => ({
    updateElement: (...a) => mockUpdateElement(...a),
    updateConnection: jest.fn(),
    removeElement: jest.fn(),
    removeConnection: jest.fn(),
  }),
  useDiagramSelection: () => ({
    selectedElements: mockSelected,
    selectedConnections: [],
    clearSelection: jest.fn(),
  }),
}));

import PropertiesPanel from '../../../components/diagram-studio/PropertiesPanel';
import {
  toDisplayCoord,
  fromDisplayCoord,
} from '../../../components/diagram-studio/properties/coordinates';

const registry = createDefaultRegistry();

function renderPanel(element, profile) {
  mockSelected = [element];
  return render(<PropertiesPanel packRegistry={registry} profile={profile} />);
}

beforeEach(() => {
  mockUpdateElement.mockClear();
});

describe('coordinates', () => {
  test('canvas origin is the 50000 offset', () => {
    expect(toDisplayCoord(50540)).toBe(540);
    expect(fromDisplayCoord(540)).toBe(50540);
    expect(toDisplayCoord(49000)).toBe(-1000);
    expect(fromDisplayCoord(-1000)).toBe(49000);
    expect(fromDisplayCoord(fromDisplayCoord(0) - 50000)).toBe(50000);
  });
});

describe('PropertiesPanel position', () => {
  const el = { id: 'a', type: 'rectangle', packId: 'core', label: 'A', x: 50540, y: 50210, size: { width: 120, height: 80 } };

  test('shows canvas-relative X/Y (same system as the status bar)', () => {
    renderPanel(el);
    expect(screen.getByLabelText('X').value).toBe('540');
    expect(screen.getByLabelText('Y').value).toBe('210');
  });

  test('editing X writes the internal coordinate back', () => {
    renderPanel(el);
    fireEvent.change(screen.getByLabelText('X'), { target: { value: '600' } });
    expect(mockUpdateElement).toHaveBeenCalledWith('a', { x: 50600 }, expect.objectContaining({ coalesceKey: expect.any(String) }));
    fireEvent.change(screen.getByLabelText('Y'), { target: { value: '-20' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { y: 49980 }, expect.objectContaining({ coalesceKey: expect.any(String) }));
  });
});

describe('PropertiesPanel style section', () => {
  const el = { id: 'a', type: 'rectangle', packId: 'core', label: 'A', x: 50000, y: 50000, size: { width: 120, height: 80 }, color: '#3b82f6' };

  test('has fill, stroke, stroke width, font size, font weight, text colour controls', () => {
    renderPanel(el);
    expect(screen.getByText('Style')).toBeTruthy();
    ['Fill color', 'Stroke color', 'Stroke width', 'Font size', 'Font weight', 'Text color'].forEach((l) => {
      expect(screen.getByLabelText(l)).toBeTruthy();
    });
  });

  test('controls edit the same element fields as the style toolbar', () => {
    renderPanel(el);
    fireEvent.change(screen.getByLabelText('Fill color'), { target: { value: '#ff0000' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { color: '#ff0000' }, expect.objectContaining({ coalesceKey: expect.any(String) }));
    fireEvent.change(screen.getByLabelText('Stroke color'), { target: { value: '#00ff00' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { borderColor: '#00ff00' }, expect.anything());
    fireEvent.change(screen.getByLabelText('Stroke width'), { target: { value: '3' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { borderWidth: 3 }, undefined);
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '18' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { fontSize: 18 }, expect.objectContaining({ coalesceKey: expect.any(String) }));
    fireEvent.change(screen.getByLabelText('Font weight'), { target: { value: 'bold' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { fontWeight: 'bold' }, undefined);
    fireEvent.change(screen.getByLabelText('Text color'), { target: { value: '#111111' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { textColor: '#111111' }, expect.anything());
  });

  test('font size is clamped to the toolbar range 8-72', () => {
    renderPanel(el);
    fireEvent.change(screen.getByLabelText('Font size'), { target: { value: '500' } });
    expect(mockUpdateElement).toHaveBeenLastCalledWith('a', { fontSize: 72 }, expect.objectContaining({ coalesceKey: expect.any(String) }));
  });

  test('read-only profile disables style controls', () => {
    renderPanel(el, { editingPolicy: { readOnly: true } });
    expect(screen.getByLabelText('Fill color').disabled).toBe(true);
  });
});

describe('PropertiesPanel ERD fields', () => {
  test('fieldList property renders the row editor and writes structured data', () => {
    const el = { id: 'e', type: 'entity', packId: 'erd', label: 'User', x: 50000, y: 50000, size: { width: 200, height: 160 }, data: { fields: 'id int PK' } };
    renderPanel(el);
    expect(screen.getByDisplayValue('id')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    const [, patch] = mockUpdateElement.mock.calls.at(-1);
    expect(Array.isArray(patch.data.fields)).toBe(true);
    expect(patch.data.fields).toHaveLength(2);
    expect(patch.data.fields[0]).toEqual(expect.objectContaining({ name: 'id', dataType: 'int', isPrimaryKey: true }));
  });
});

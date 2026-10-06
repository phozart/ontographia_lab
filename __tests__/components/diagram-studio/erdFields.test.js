import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import {
  parseFieldsText,
  normalizeFields,
  keyOf,
  withKey,
  moveRow,
} from '../../../components/diagram-studio/packs/erdFields';
import ERDPack from '../../../components/diagram-studio/packs/ERDPack';
import FieldListEditor from '../../../components/diagram-studio/properties/FieldListEditor';

describe('parseFieldsText', () => {
  test('parses "name type KEY" lines into structured rows', () => {
    const rows = parseFieldsText('id int PK\nuser_id bigint FK\nemail varchar(255)');
    expect(rows).toEqual([
      expect.objectContaining({ name: 'id', dataType: 'int', isPrimaryKey: true }),
      expect.objectContaining({ name: 'user_id', dataType: 'bigint', isForeignKey: true }),
      expect.objectContaining({ name: 'email', dataType: 'varchar(255)' }),
    ]);
    expect(rows[2].isPrimaryKey).toBeFalsy();
  });
  test('supports "name: type", comma separators and blank lines', () => {
    expect(parseFieldsText('id: int, PK\n\n  name text  ')).toEqual([
      expect.objectContaining({ name: 'id', dataType: 'int', isPrimaryKey: true }),
      expect.objectContaining({ name: 'name', dataType: 'text' }),
    ]);
  });
  test('type with spaces is kept, key is case-insensitive', () => {
    const [r] = parseFieldsText('created timestamp with time zone pk');
    expect(r).toEqual(expect.objectContaining({ name: 'created', dataType: 'timestamp with time zone', isPrimaryKey: true }));
  });
  test('name only', () => {
    expect(parseFieldsText('title')).toEqual([expect.objectContaining({ name: 'title', dataType: '' })]);
  });
  test('empty / non-string yields no rows', () => {
    expect(parseFieldsText('')).toEqual([]);
    expect(parseFieldsText(undefined)).toEqual([]);
  });
});

describe('normalizeFields', () => {
  test('passes structured arrays through, preserving extra flags', () => {
    const rows = [{ name: 'id', dataType: 'INT', isPrimaryKey: true, isAutoIncrement: true }];
    expect(normalizeFields(rows)).toEqual(rows);
  });
  test('parses a free-text string', () => {
    expect(normalizeFields('id int PK')).toEqual([expect.objectContaining({ name: 'id', isPrimaryKey: true })]);
  });
  test('arrays of strings (legacy list editor) are parsed per item', () => {
    expect(normalizeFields(['id int PK', 'name text'])).toHaveLength(2);
  });
  test('garbage gives []', () => {
    expect(normalizeFields(null)).toEqual([]);
    expect(normalizeFields(42)).toEqual([]);
  });
});

describe('keys', () => {
  test('keyOf / withKey round trip', () => {
    expect(keyOf({ isPrimaryKey: true })).toBe('PK');
    expect(keyOf({ isForeignKey: true })).toBe('FK');
    expect(keyOf({ isPrimaryKey: true, isForeignKey: true })).toBe('PK+FK');
    expect(keyOf({})).toBe('');
    expect(withKey({ name: 'a', isUnique: true }, 'FK')).toEqual({ name: 'a', isUnique: true, isPrimaryKey: false, isForeignKey: true });
    expect(withKey({ name: 'a', isPrimaryKey: true }, '')).toEqual({ name: 'a', isPrimaryKey: false, isForeignKey: false });
  });
  test('moveRow', () => {
    expect(moveRow(['a', 'b', 'c'], 1, -1)).toEqual(['b', 'a', 'c']);
    expect(moveRow(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveRow(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'b', 'c']);
  });
});

describe('ERD entity renders structured rows', () => {
  const stencil = ERDPack.stencils.find((s) => s.id === 'entity');
  const el = (fields) => ({ id: 'e1', type: 'entity', label: 'User', x: 0, y: 0, size: { ...stencil.defaultSize }, data: { fields } });

  test('shows name, type and key badges', () => {
    const { container } = render(
      <div>{ERDPack.renderNode(el([
        { name: 'id', dataType: 'INT', isPrimaryKey: true },
        { name: 'org_id', dataType: 'INT', isForeignKey: true },
        { name: 'email', dataType: 'TEXT' },
      ]), stencil, false)}</div>
    );
    expect(container.textContent).toContain('id');
    expect(container.textContent).toContain('INT');
    expect(container.textContent).toContain('email');
    expect(container.textContent).not.toContain('No fields defined');
    expect(container.textContent).toMatch(/PK/);
    expect(container.textContent).toMatch(/FK/);
  });

  test('legacy free-text fields string renders as rows, not "No fields defined"', () => {
    const { container } = render(<div>{ERDPack.renderNode(el('id int PK\nname text'), stencil, false)}</div>);
    expect(container.textContent).not.toContain('No fields defined');
    expect(container.querySelectorAll('.erd-field').length).toBe(2);
    expect(container.textContent).toMatch(/PK/);
  });

  test('empty still says no fields', () => {
    const { container } = render(<div>{ERDPack.renderNode(el([]), stencil, false)}</div>);
    expect(container.textContent).toContain('No fields defined');
  });
});

describe('FieldListEditor', () => {
  const setup = (value) => {
    const onChange = jest.fn();
    render(<FieldListEditor value={value} onChange={onChange} />);
    return onChange;
  };

  test('lists existing rows (parsing legacy strings)', () => {
    setup('id int PK');
    expect(screen.getByDisplayValue('id')).toBeTruthy();
    expect(screen.getByDisplayValue('int')).toBeTruthy();
    expect(screen.getByLabelText('Key for field 1').value).toBe('PK');
  });

  test('add row writes a structured array', () => {
    const onChange = setup([{ name: 'id', dataType: 'INT', isPrimaryKey: true }]);
    fireEvent.click(screen.getByRole('button', { name: /add field/i }));
    const next = onChange.mock.calls[0][0];
    expect(Array.isArray(next)).toBe(true);
    expect(next).toHaveLength(2);
    expect(next[0]).toEqual(expect.objectContaining({ name: 'id', isPrimaryKey: true }));
    expect(next[1]).toEqual(expect.objectContaining({ name: '', dataType: '' }));
  });

  test('editing name, type and key', () => {
    const onChange = setup([{ name: 'id', dataType: 'INT' }]);
    fireEvent.change(screen.getByLabelText('Name of field 1'), { target: { value: 'uid' } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ name: 'uid', dataType: 'INT' })]);
    fireEvent.change(screen.getByLabelText('Type of field 1'), { target: { value: 'BIGINT' } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ dataType: 'BIGINT' })]);
    fireEvent.change(screen.getByLabelText('Key for field 1'), { target: { value: 'FK' } });
    expect(onChange).toHaveBeenLastCalledWith([expect.objectContaining({ isForeignKey: true, isPrimaryKey: false })]);
  });

  test('remove and reorder', () => {
    const onChange = setup([{ name: 'a' }, { name: 'b' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Move field 2 up' }));
    expect(onChange.mock.calls[0][0].map((r) => r.name)).toEqual(['b', 'a']);
    fireEvent.click(screen.getByRole('button', { name: 'Remove field 1' }));
    expect(onChange.mock.calls[1][0].map((r) => r.name)).toEqual(['b']);
  });

  test('readOnly hides controls', () => {
    const onChange = jest.fn();
    render(<FieldListEditor value={[{ name: 'a' }]} onChange={onChange} readOnly />);
    expect(screen.queryByRole('button', { name: /add field/i })).toBeNull();
    expect(screen.getByLabelText('Name of field 1').disabled).toBe(true);
  });
});

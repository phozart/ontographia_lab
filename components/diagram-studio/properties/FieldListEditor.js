// components/diagram-studio/properties/FieldListEditor.js
// Row editor for ERD fields: name, type, key (PK/FK), add / remove / reorder.
// Writes structured rows ({ name, dataType, isPrimaryKey, isForeignKey, ...extra }).

import { normalizeFields, keyOf, withKey, moveRow } from '../packs/erdFields';

const KEY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'PK', label: 'PK' },
  { value: 'FK', label: 'FK' },
  { value: 'PK+FK', label: 'PK+FK' },
];

const iconBtn = {
  padding: '2px 6px',
  background: 'transparent',
  border: '1px solid var(--border)',
  borderRadius: 4,
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: 12,
  lineHeight: 1.2,
};

export default function FieldListEditor({ value, onChange, readOnly = false }) {
  const rows = normalizeFields(value);

  const update = (index, patch) => onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));

  return (
    <div className="ds-field-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.length === 0 && (
        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>No fields yet</div>
      )}
      {rows.map((row, i) => {
        const n = i + 1;
        return (
          <div key={i} className="ds-field-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
            <input
              type="text"
              className="ds-property-input"
              aria-label={`Name of field ${n}`}
              placeholder="name"
              value={row.name || ''}
              disabled={readOnly}
              onChange={(e) => update(i, { name: e.target.value })}
              style={{ flex: '1 1 70px', minWidth: 0, fontSize: 12, padding: '4px 8px' }}
            />
            <input
              type="text"
              className="ds-property-input"
              aria-label={`Type of field ${n}`}
              placeholder="type"
              value={row.dataType || ''}
              disabled={readOnly}
              onChange={(e) => update(i, { dataType: e.target.value })}
              style={{ flex: '1 1 70px', minWidth: 0, fontSize: 12, padding: '4px 8px' }}
            />
            <select
              className="ds-property-input"
              aria-label={`Key for field ${n}`}
              value={keyOf(row)}
              disabled={readOnly}
              onChange={(e) => onChange(rows.map((r, idx) => (idx === i ? withKey(r, e.target.value) : r)))}
              style={{ flex: '0 0 64px', fontSize: 12, padding: '4px 4px' }}
            >
              {KEY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {!readOnly && (
              <span style={{ display: 'flex', gap: 2 }}>
                <button type="button" aria-label={`Move field ${n} up`} title="Move up" disabled={i === 0} style={iconBtn} onClick={() => onChange(moveRow(rows, i, -1))}>↑</button>
                <button type="button" aria-label={`Move field ${n} down`} title="Move down" disabled={i === rows.length - 1} style={iconBtn} onClick={() => onChange(moveRow(rows, i, 1))}>↓</button>
                <button type="button" aria-label={`Remove field ${n}`} title="Remove" style={{ ...iconBtn, color: '#ef4444' }} onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>×</button>
              </span>
            )}
          </div>
        );
      })}
      {!readOnly && (
        <button
          type="button"
          onClick={() => onChange([...rows, { name: '', dataType: '', isPrimaryKey: false, isForeignKey: false }])}
          style={{
            alignSelf: 'flex-start',
            padding: '4px 10px',
            background: 'var(--accent)',
            color: 'white',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 500,
          }}
        >
          + Add field
        </button>
      )}
    </div>
  );
}

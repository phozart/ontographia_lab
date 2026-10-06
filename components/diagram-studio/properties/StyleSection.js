// components/diagram-studio/properties/StyleSection.js
// Fill / stroke / font controls for an element. Edits the same element fields as
// the contextual style toolbar: color, borderColor, borderWidth, fontSize,
// fontWeight, textColor.

import { parseColor } from '../packs/colorUtils';

const FONT_MIN = 8;
const FONT_MAX = 72;
const STROKE_WIDTHS = [0, 1, 2, 3, 4, 5, 6];

// <input type="color"> only accepts #rrggbb.
function toHex(value, fallback) {
  const rgb = parseColor(value);
  if (!rgb) return fallback;
  return '#' + rgb.map((v) => v.toString(16).padStart(2, '0')).join('');
}

const colorInput = (readOnly) => ({
  width: 40,
  height: 28,
  padding: 0,
  border: '1px solid var(--border)',
  borderRadius: 4,
  cursor: readOnly ? 'not-allowed' : 'pointer',
});

const autoBtn = (readOnly) => ({
  fontSize: 10,
  padding: '4px 8px',
  border: '1px solid var(--border)',
  borderRadius: 4,
  background: 'var(--bg)',
  color: 'var(--text)',
  cursor: readOnly ? 'not-allowed' : 'pointer',
});

function ColorRow({ label, value, fallback, field, onChange, readOnly, auto }) {
  return (
    <div className="ds-property-row">
      <label className="ds-property-label" htmlFor={`ds-style-${field}`}>{label}</label>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          id={`ds-style-${field}`}
          type="color"
          aria-label={label}
          value={toHex(value, fallback)}
          disabled={readOnly}
          onChange={(e) => onChange(field, e.target.value, { coalesce: true })}
          style={colorInput(readOnly)}
        />
        {auto && (
          <button type="button" disabled={readOnly} onClick={() => onChange(field, null)} style={autoBtn(readOnly)}>
            Auto
          </button>
        )}
      </div>
    </div>
  );
}

export default function StyleSection({ item, stencil, onChange, onEnd, readOnly }) {
  const fill = item.color || stencil?.color || '#3b82f6';
  return (
    <>
      <ColorRow label="Fill color" field="color" value={fill} fallback="#3b82f6" onChange={onChange} readOnly={readOnly} />
      <ColorRow label="Stroke color" field="borderColor" value={item.borderColor || fill} fallback="#3b82f6" onChange={onChange} readOnly={readOnly} auto />

      <div className="ds-property-row">
        <label className="ds-property-label" htmlFor="ds-style-borderWidth">Stroke width</label>
        <select
          id="ds-style-borderWidth"
          aria-label="Stroke width"
          className="ds-property-input"
          value={item.borderWidth ?? 1}
          disabled={readOnly}
          onChange={(e) => onChange('borderWidth', parseInt(e.target.value, 10))}
        >
          {STROKE_WIDTHS.map((w) => (
            <option key={w} value={w}>{w === 0 ? 'None' : `${w}px`}</option>
          ))}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label" htmlFor="ds-style-fontSize">Font size</label>
          <input
            id="ds-style-fontSize"
            aria-label="Font size"
            type="number"
            min={FONT_MIN}
            max={FONT_MAX}
            className="ds-property-input"
            value={item.fontSize || 13}
            disabled={readOnly}
            onBlur={onEnd}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (Number.isNaN(n)) return;
              onChange('fontSize', Math.min(FONT_MAX, Math.max(FONT_MIN, n)), { coalesce: true });
            }}
          />
        </div>
        <div className="ds-property-row" style={{ flex: 1 }}>
          <label className="ds-property-label" htmlFor="ds-style-fontWeight">Font weight</label>
          <select
            id="ds-style-fontWeight"
            aria-label="Font weight"
            className="ds-property-input"
            value={item.fontWeight || 'normal'}
            disabled={readOnly}
            onChange={(e) => onChange('fontWeight', e.target.value)}
          >
            <option value="normal">Normal</option>
            <option value="500">Medium</option>
            <option value="600">Semi bold</option>
            <option value="bold">Bold</option>
          </select>
        </div>
      </div>

      <ColorRow label="Text color" field="textColor" value={item.textColor} fallback="#1f2937" onChange={onChange} readOnly={readOnly} auto />
    </>
  );
}

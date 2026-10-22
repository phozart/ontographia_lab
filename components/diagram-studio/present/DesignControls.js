// components/diagram-studio/present/DesignControls.js
// The P2 "Design" controls of the Presentation panel (ADR-0007): theme picker, layout picker and text presets. Plain
// controlled components with callbacks, so they are testable without the editor context.

import { THEME_PRESETS, FONT_IDS, FONT_LABELS, resolveTheme } from '../../../lib/present/themes';
import { LAYOUT_NAMES, LAYOUT_LABELS } from '../../../lib/present/layouts';
import { TEXT_PRESETS, PRESET_SPECS } from '../../../lib/present/textPreset';

const SWATCHES = ['bg', 'surface', 'text', 'accent', 'accent2', 'accent3'];

/**
 * @param {{theme: object, onApply: (patch: object) => void, disabled?: boolean}} props theme = the resolved board theme
 */
export function ThemePicker({ theme, onApply, disabled }) {
  const current = resolveTheme(theme);
  return (
    <div className="dc-block" data-testid="theme-picker">
      <div className="dc-label" id="dc-theme-label">Theme</div>
      <div role="radiogroup" aria-labelledby="dc-theme-label" className="dc-themes">
        {Object.entries(THEME_PRESETS).map(([id, p]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={current.preset === id}
            disabled={disabled}
            className={`dc-theme${current.preset === id ? ' on' : ''}`}
            data-testid={`theme-${id}`}
            onClick={() => onApply({ preset: id })}
          >
            <span className="dc-swatches" aria-hidden="true">
              {SWATCHES.map((k) => <span key={k} className="dc-sw" style={{ background: p.palette[k] }} />)}
            </span>
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="dc-fonts">
        {['heading', 'body'].map((role) => (
          <label key={role} className="dc-font">
            <span>{role === 'heading' ? 'Heading font' : 'Body font'}</span>
            <select
              aria-label={role === 'heading' ? 'Heading font' : 'Body font'}
              value={current.fonts[role]}
              disabled={disabled}
              onChange={(e) => onApply({ fonts: { [role]: e.target.value } })}
            >
              {FONT_IDS.map((f) => <option key={f} value={f}>{FONT_LABELS[f]}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Styles />
    </div>
  );
}

/**
 * @param {{layout: string, onLayoutChange: (l: string) => void, onAddSlide: (layout: string) => void, onApplyLayout: (layout: string) => void,
 *          canApply: boolean, disabled?: boolean}} props
 */
export function LayoutPicker({ layout, onLayoutChange, onAddSlide, onApplyLayout, canApply, disabled }) {
  return (
    <div className="dc-block" data-testid="layout-picker">
      <label className="dc-label" htmlFor="dc-layout">Slide layout</label>
      <select id="dc-layout" value={layout} disabled={disabled} onChange={(e) => onLayoutChange(e.target.value)}>
        {LAYOUT_NAMES.map((l) => <option key={l} value={l}>{LAYOUT_LABELS[l]}</option>)}
      </select>
      <div className="dc-row">
        <button type="button" className="dc-btn" data-testid="layout-add-slide" disabled={disabled} onClick={() => onAddSlide(layout)}>Add slide with layout</button>
        <button type="button" className="dc-btn" data-testid="layout-apply" disabled={disabled || !canApply} title={canApply ? 'Arrange the selected slide on this layout' : 'Select a slide frame on the board first'} onClick={() => onApplyLayout(layout)}>Apply to selected slide</button>
      </div>
      <Styles />
    </div>
  );
}

/** @param {{onAdd: (preset: string) => void, disabled?: boolean, target: string}} props target: where the text goes, for the hint */
export function TextPresetBar({ onAdd, disabled, target }) {
  return (
    <div className="dc-block" data-testid="text-presets">
      <div className="dc-label" id="dc-text-label">Add text</div>
      <div className="dc-row" role="group" aria-labelledby="dc-text-label">
        {TEXT_PRESETS.map((p) => (
          <button key={p} type="button" className="dc-btn small" data-testid={`add-text-${p}`} disabled={disabled} onClick={() => onAdd(p)}>{PRESET_SPECS[p].label}</button>
        ))}
      </div>
      <p className="dc-hint">{target}</p>
      <Styles />
    </div>
  );
}

function Styles() {
  return (
    <style jsx global>{`
      .dc-block { display: flex; flex-direction: column; gap: 6px; }
      .dc-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #6b7280); }
      .dc-themes { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
      .dc-theme { display: flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 8px; border: 1px solid var(--border, #d1d5db); border-radius: 8px; background: transparent; color: inherit; font: inherit; cursor: pointer; text-align: left; }
      .dc-theme.on { border-color: var(--accent, #4fb3ce); box-shadow: 0 0 0 1px var(--accent, #4fb3ce) inset; font-weight: 600; }
      .dc-theme:disabled { opacity: 0.5; cursor: default; }
      .dc-swatches { display: flex; gap: 2px; }
      .dc-sw { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(0, 0, 0, 0.12); }
      .dc-fonts { display: flex; gap: 8px; }
      .dc-font { display: flex; flex-direction: column; gap: 2px; flex: 1; font-size: 11px; color: var(--text-muted, #6b7280); }
      .dc-block select { padding: 6px 8px; border: 1px solid var(--border, #d1d5db); border-radius: 6px; font: inherit; background: var(--surface, #fff); color: var(--text, #1f2937); }
      .dc-row { display: flex; gap: 6px; flex-wrap: wrap; }
      .dc-btn { padding: 6px 10px; border-radius: 8px; border: 1px solid var(--border, #d1d5db); background: transparent; color: inherit; font: inherit; font-weight: 500; cursor: pointer; }
      .dc-btn.small { padding: 4px 8px; font-size: 12px; }
      .dc-btn:hover:not(:disabled) { background: var(--bg-alt, #f3f4f6); }
      .dc-btn:disabled { opacity: 0.45; cursor: default; }
      .dc-btn:focus-visible, .dc-theme:focus-visible, .dc-block select:focus-visible { outline: 2px solid var(--accent, #4fb3ce); outline-offset: 1px; }
      .dc-hint { margin: 0; font-size: 11px; color: var(--text-muted, #6b7280); }
    `}</style>
  );
}

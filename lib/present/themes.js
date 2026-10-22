// lib/present/themes.js
// Board theme (ADR-0007 decision D4, slice P2). Pure: no React, no I/O. Shared by the editor, the exports, the MCP
// tools and the server SVG renderer.
//
//   content.theme = { preset, palette: {<token>: '#rrggbb', ...all tokens}, fonts: {heading, body} }   (absent = Ethereal Sky)
//
// Elements may store a TOKEN REFERENCE ("@accent") instead of a hex colour in their colour fields; the renderers
// resolve it against the board theme, so switching the theme restyles every token-coloured element and leaves
// hex-coloured ones alone. Colours are #rrggbb or a known @token, never free CSS. Font ids come from a closed list of
// self-hosted OFL fonts (public/fonts), never free text, because they feed CSS and PPTX.

import { parseColor, contrastRatio } from '../../components/diagram-studio/packs/colorUtils';

// The ADR palette plus two helper tokens so every theme can be checked for AA text contrast:
//   accentText: the accent darkened/lightened enough to be used as TEXT on @bg and @surface
//   onAccent:   the label colour for text placed on an @accent fill
export const TOKENS = Object.freeze(['bg', 'surface', 'text', 'muted', 'accent', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'accentText', 'onAccent']);
export const FONT_IDS = Object.freeze(['inter', 'source-serif-4', 'ibm-plex-sans', 'ibm-plex-mono', 'work-sans', 'montserrat']);
// ids that were removed (Lato carries an OFL Reserved Font Name that modified subsets must not reuse) and what they map to
export const LEGACY_FONT_IDS = Object.freeze({ lato: 'work-sans' });
const fontId = (v) => (Object.prototype.hasOwnProperty.call(LEGACY_FONT_IDS, v) ? LEGACY_FONT_IDS[v] : v);

const SANS = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
export const FONT_STACKS = Object.freeze({
  inter: `"Inter", ${SANS}`,
  'source-serif-4': '"Source Serif 4", Georgia, "Times New Roman", serif',
  'ibm-plex-sans': `"IBM Plex Sans", ${SANS}`,
  'ibm-plex-mono': '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  'work-sans': `"Work Sans", ${SANS}`,
  montserrat: `"Montserrat", ${SANS}`,
});
export const FONT_LABELS = Object.freeze({
  inter: 'Inter', 'source-serif-4': 'Source Serif 4', 'ibm-plex-sans': 'IBM Plex Sans', 'ibm-plex-mono': 'IBM Plex Mono', 'work-sans': 'Work Sans', montserrat: 'Montserrat',
});

export const DEFAULT_THEME_PRESET = 'ethereal-sky';

export const THEME_PRESETS = Object.freeze({
  'ethereal-sky': {
    label: 'Ethereal Sky',
    palette: { bg: '#ffffff', surface: '#f3f8fb', text: '#1e2a33', muted: '#556572', accent: '#4fb3ce', accent2: '#6a9fc9', accent3: '#e8a99a', accent4: '#f0d98a', accent5: '#9a8ac8', accent6: '#c490b0', accentText: '#1d7089', onAccent: '#0e2a33' },
    fonts: { heading: 'inter', body: 'inter' },
  },
  paper: {
    label: 'Paper',
    palette: { bg: '#faf7f2', surface: '#f0eadf', text: '#2a2622', muted: '#665d54', accent: '#cc7a5e', accent2: '#7a8f6b', accent3: '#d9a441', accent4: '#6e7f9b', accent5: '#a67c8e', accent6: '#8c6d4f', accentText: '#9a472c', onAccent: '#1f120c' },
    fonts: { heading: 'source-serif-4', body: 'source-serif-4' },
  },
  'slate-dark': {
    label: 'Slate dark',
    palette: { bg: '#18212b', surface: '#233041', text: '#f1f5f9', muted: '#aab7c6', accent: '#6ec5d8', accent2: '#8fb8e8', accent3: '#f0a98f', accent4: '#f0d98a', accent5: '#b7a6e8', accent6: '#e2a5cc', accentText: '#7fd0e2', onAccent: '#0c2530' },
    fonts: { heading: 'inter', body: 'inter' },
  },
  contrast: {
    label: 'Contrast',
    palette: { bg: '#ffffff', surface: '#efefef', text: '#000000', muted: '#3a3a3a', accent: '#0b57d0', accent2: '#b3261e', accent3: '#146c2e', accent4: '#7a4e00', accent5: '#6b2fa3', accent6: '#006a6a', accentText: '#0b4db8', onAccent: '#ffffff' },
    fonts: { heading: 'ibm-plex-sans', body: 'ibm-plex-sans' },
  },
});

const HEX6 = /^#[0-9a-f]{6}$/i;
const TOKEN_SET = new Set(TOKENS);
const THEME_KEYS = new Set(['preset', 'palette', 'fonts']);
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const err = (error, status = 400, code = 'VALIDATION_FAILED') => ({ ok: false, status, code, error });
const clip = (s) => String(s).replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ').slice(0, 40);

/** The colour keys of an element that may hold a token (top level; frames also keep a background in data). */
export const TOKEN_COLOR_KEYS = Object.freeze(['color', 'backgroundColor', 'borderColor', 'textColor', 'fillColor', 'strokeColor']);
export const TOKEN_DATA_COLOR_KEYS = Object.freeze(['backgroundColor']);

export const isToken = (v) => typeof v === 'string' && v.length > 1 && v[0] === '@' && TOKEN_SET.has(v.slice(1));

export function themeFromPreset(name) {
  const p = THEME_PRESETS[name] || THEME_PRESETS[DEFAULT_THEME_PRESET];
  const preset = THEME_PRESETS[name] ? name : DEFAULT_THEME_PRESET;
  return { preset, palette: { ...p.palette }, fonts: { ...p.fonts } };
}

/** The theme to draw with: a stored theme completed from its preset; anything invalid falls back per key. Never throws. */
export function resolveTheme(stored) {
  if (!isObj(stored)) return themeFromPreset(DEFAULT_THEME_PRESET);
  const base = themeFromPreset(stored.preset);
  if (isObj(stored.palette)) {
    for (const k of TOKENS) if (typeof stored.palette[k] === 'string' && HEX6.test(stored.palette[k])) base.palette[k] = stored.palette[k].toLowerCase();
  }
  if (isObj(stored.fonts)) {
    for (const k of ['heading', 'body']) if (FONT_IDS.includes(fontId(stored.fonts[k]))) base.fonts[k] = fontId(stored.fonts[k]);
  }
  return base;
}

/** '@accent' -> '#4fb3ce'; undefined for an unknown token or a non-token. */
export function resolveToken(value, theme) {
  if (!isToken(value)) return undefined;
  return (theme?.palette || THEME_PRESETS[DEFAULT_THEME_PRESET].palette)[value.slice(1)];
}

/** A stored colour for drawing: a token resolves through the theme, anything else is returned as is; `fallback` when empty/unknown token. */
export function resolveColorValue(value, theme, fallback) {
  if (typeof value === 'string' && value[0] === '@') return resolveToken(value, theme) ?? fallback;
  return value === undefined || value === null || value === '' ? fallback : value;
}

/** A copy of `el` with every token-valued colour key replaced by its hex; the same object when there is nothing to resolve. */
export function resolveElementTokens(el, theme) {
  if (!isObj(el)) return el;
  let out = el;
  for (const k of TOKEN_COLOR_KEYS) {
    const v = el[k];
    if (typeof v === 'string' && v[0] === '@') {
      if (out === el) out = { ...el };
      const r = resolveToken(v, theme);
      if (r === undefined) delete out[k]; else out[k] = r;
    }
  }
  if (isObj(el.data)) {
    for (const k of TOKEN_DATA_COLOR_KEYS) {
      const v = el.data[k];
      if (typeof v === 'string' && v[0] === '@') {
        if (out === el) out = { ...el };
        if (out.data === el.data) out.data = { ...el.data };
        const r = resolveToken(v, theme);
        if (r === undefined) delete out.data[k]; else out.data[k] = r;
      }
    }
  }
  return out;
}

function contrastWarnings(theme) {
  const p = theme.palette;
  const rgb = (h) => parseColor(h);
  const bad = [];
  for (const [fg, bgs] of [['text', ['bg', 'surface']], ['muted', ['bg', 'surface']], ['accentText', ['bg', 'surface']]]) {
    for (const bg of bgs) if (contrastRatio(rgb(p[fg]), rgb(p[bg])) < 4.5) bad.push(`${fg} on ${bg}`);
  }
  if (contrastRatio(rgb(p.onAccent), rgb(p.accent)) < 4.5) bad.push('onAccent on accent');
  return bad.length ? [`Low text contrast (below WCAG AA 4.5:1) for: ${bad.join(', ')}. Text on slides may be hard to read.`] : [];
}

/**
 * Validate a stored theme against the closed schema and return it expanded (every token, both fonts).
 * @returns {{ok: true, theme: object|undefined, warnings?: string[]} | {ok: false, status: number, code: string, error: string}}
 */
export function validateTheme(theme) {
  if (theme === undefined) return { ok: true, theme: undefined };
  if (!isObj(theme)) return err('content.theme must be an object');
  for (const k of Object.keys(theme)) if (!THEME_KEYS.has(k)) return err(`content.theme has an unsupported key "${clip(k)}"; allowed: ${[...THEME_KEYS].join(', ')}`);
  if (typeof theme.preset !== 'string' || !THEME_PRESETS[theme.preset]) return err(`content.theme.preset must be one of ${Object.keys(THEME_PRESETS).join(', ')}`);
  const out = themeFromPreset(theme.preset);
  if (theme.palette !== undefined) {
    if (!isObj(theme.palette)) return err('content.theme.palette must be an object');
    for (const [k, v] of Object.entries(theme.palette)) {
      if (!TOKEN_SET.has(k)) return err(`content.theme.palette has an unknown token "${clip(k)}"; allowed: ${TOKENS.join(', ')}`);
      if (typeof v !== 'string' || !HEX6.test(v)) return err(`content.theme.palette.${k} must be a #rrggbb colour`);
      out.palette[k] = v.toLowerCase();
    }
  }
  if (theme.fonts !== undefined) {
    if (!isObj(theme.fonts)) return err('content.theme.fonts must be an object');
    for (const [k, v] of Object.entries(theme.fonts)) {
      if (k !== 'heading' && k !== 'body') return err(`content.theme.fonts has an unsupported key "${clip(k)}"; allowed: heading, body`);
      if (!FONT_IDS.includes(fontId(v))) return err(`content.theme.fonts.${k} must be one of ${FONT_IDS.join(', ')}`);
      out.fonts[k] = fontId(v); // a stored "lato" is migrated to "work-sans"
    }
  }
  const warnings = contrastWarnings(out);
  return warnings.length ? { ok: true, theme: out, warnings } : { ok: true, theme: out };
}

/**
 * theme_apply: {preset?, palette?, fonts?}. A preset replaces the theme (palette and fonts reset to the preset);
 * palette / fonts override on top of it, or on the current theme when no preset is given.
 * @returns {{ok: true, theme: object, warnings: string[]} | {ok: false, error: string}}
 */
export function applyThemePatch(current, patch) {
  if (!isObj(patch)) return { ok: false, error: 'theme patch must be an object' };
  for (const k of Object.keys(patch)) if (!THEME_KEYS.has(k)) return { ok: false, error: `Unknown field "${clip(k)}" for theme_apply; allowed: preset, palette, fonts` };
  if (patch.preset === undefined && patch.palette === undefined && patch.fonts === undefined) return { ok: false, error: 'Give at least one of preset, palette, fonts' };
  if (patch.preset !== undefined && !THEME_PRESETS[patch.preset]) return { ok: false, error: `preset must be one of ${Object.keys(THEME_PRESETS).join(', ')}` };
  const base = patch.preset !== undefined ? themeFromPreset(patch.preset) : resolveTheme(current);
  const r = validateTheme({
    preset: base.preset,
    palette: { ...base.palette, ...(isObj(patch.palette) ? patch.palette : {}) },
    fonts: { ...base.fonts, ...(isObj(patch.fonts) ? patch.fonts : {}) },
  });
  if (!r.ok) return { ok: false, error: r.error };
  if (patch.palette !== undefined && !isObj(patch.palette)) return { ok: false, error: 'palette must be an object' };
  if (patch.fonts !== undefined && !isObj(patch.fonts)) return { ok: false, error: 'fonts must be an object' };
  return { ok: true, theme: r.theme, warnings: r.warnings || [] };
}

/** The ground a slide frame is drawn on: its (token or hex) background resolved through the theme, white when none or transparent. */
export function frameBackground(frame, theme) {
  const c = frame?.data?.backgroundColor;
  if (typeof c !== 'string' || !c || c === 'transparent') return '#ffffff';
  return resolveColorValue(c, resolveTheme(theme), '#ffffff');
}

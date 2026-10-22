/**
 * @jest-environment node
 */
// ADR-0007 P2: content.theme (palette tokens, closed font list, four presets), token references and contrast.
import { parseColor, contrastRatio } from '../../components/diagram-studio/packs/colorUtils';
import {
  TOKENS, THEME_PRESETS, DEFAULT_THEME_PRESET, FONT_IDS, FONT_STACKS, themeFromPreset, resolveTheme, resolveToken, resolveColorValue,
  validateTheme, applyThemePatch, isToken, TOKEN_COLOR_KEYS, resolveElementTokens,
} from '../../lib/present/themes';

const ratio = (a, b) => contrastRatio(parseColor(a), parseColor(b));

describe('theme presets', () => {
  test('four presets, Ethereal Sky is the default', () => {
    expect(Object.keys(THEME_PRESETS).sort()).toEqual(['contrast', 'ethereal-sky', 'paper', 'slate-dark']);
    expect(DEFAULT_THEME_PRESET).toBe('ethereal-sky');
    expect(THEME_PRESETS['ethereal-sky'].palette.accent).toBe('#4fb3ce');
  });

  test.each(Object.keys(THEME_PRESETS))('%s has every token as #rrggbb and fonts from the closed list', (name) => {
    const t = themeFromPreset(name);
    expect(t.preset).toBe(name);
    for (const k of TOKENS) expect(t.palette[k]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Object.keys(t.palette).sort()).toEqual([...TOKENS].sort());
    expect(FONT_IDS).toContain(t.fonts.heading);
    expect(FONT_IDS).toContain(t.fonts.body);
  });

  // WCAG 2.2 AA: 4.5:1 for normal text. Text presets use @text, @muted (subtitle, caption) and @accentText (number, links)
  // on @bg and @surface; @onAccent is the label colour on an @accent fill.
  test.each(Object.keys(THEME_PRESETS))('%s: text presets meet WCAG AA contrast', (name) => {
    const p = themeFromPreset(name).palette;
    for (const bg of [p.bg, p.surface]) {
      expect(ratio(p.text, bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.muted, bg)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(p.accentText, bg)).toBeGreaterThanOrEqual(4.5);
    }
    expect(ratio(p.onAccent, p.accent)).toBeGreaterThanOrEqual(4.5);
  });

  test('every font id has a CSS stack with a generic fallback', () => {
    for (const id of FONT_IDS) expect(FONT_STACKS[id]).toMatch(/(sans-serif|serif|monospace)\s*$/);
  });
});

describe('tokens', () => {
  const theme = themeFromPreset('ethereal-sky');
  test('isToken and resolveToken', () => {
    expect(isToken('@accent')).toBe(true);
    expect(isToken('@nope')).toBe(false);
    expect(isToken('#4FB3CE')).toBe(false);
    expect(resolveToken('@accent', theme)).toBe('#4fb3ce');
    expect(resolveToken('@nope', theme)).toBeUndefined();
  });
  test('resolveColorValue passes hex through, resolves tokens, drops unknown tokens', () => {
    expect(resolveColorValue('@text', theme)).toBe(theme.palette.text);
    expect(resolveColorValue('#112233', theme)).toBe('#112233');
    expect(resolveColorValue('@zzz', theme, '#000000')).toBe('#000000');
    expect(resolveColorValue(undefined, theme, '#abcdef')).toBe('#abcdef');
  });
  test('resolveElementTokens rewrites only token-valued colour keys and leaves hex ones alone', () => {
    const el = { id: 'a', color: '@accent', backgroundColor: '#112233', borderColor: '@accent2', textColor: '@text', label: '@accent', data: { backgroundColor: '@bg', x: '@accent' } };
    const out = resolveElementTokens(el, theme);
    expect(out.color).toBe('#4fb3ce');
    expect(out.backgroundColor).toBe('#112233');
    expect(out.borderColor).toBe(theme.palette.accent2);
    expect(out.textColor).toBe(theme.palette.text);
    expect(out.label).toBe('@accent'); // not a colour key
    expect(out.data.backgroundColor).toBe(theme.palette.bg);
    expect(out.data.x).toBe('@accent');
    expect(el.color).toBe('@accent'); // never mutates
  });
  test('resolveElementTokens returns the same object when nothing needs resolving', () => {
    const el = { id: 'a', color: '#fff', data: { backgroundColor: '#ffffff' } };
    expect(resolveElementTokens(el, theme)).toBe(el);
  });
  test('TOKEN_COLOR_KEYS covers the colour keys the renderers read', () => {
    for (const k of ['color', 'backgroundColor', 'borderColor', 'textColor']) expect(TOKEN_COLOR_KEYS).toContain(k);
  });
});

describe('resolveTheme', () => {
  test('absent theme is Ethereal Sky', () => {
    expect(resolveTheme(undefined)).toEqual(themeFromPreset('ethereal-sky'));
    expect(resolveTheme(null).preset).toBe('ethereal-sky');
  });
  test('a stored theme fills missing tokens from its preset', () => {
    const t = resolveTheme({ preset: 'paper', palette: { accent: '#112233' } });
    expect(t.palette.accent).toBe('#112233');
    expect(t.palette.bg).toBe(THEME_PRESETS.paper.palette.bg);
    expect(t.fonts).toEqual(THEME_PRESETS.paper.fonts);
  });
  test('garbage falls back to the default instead of throwing', () => {
    expect(resolveTheme('x').preset).toBe('ethereal-sky');
    expect(resolveTheme({ preset: 'nope', palette: { bg: 'url(x)' } }).palette.bg).toBe(THEME_PRESETS['ethereal-sky'].palette.bg);
  });
});

describe('validateTheme', () => {
  test('undefined is fine; a preset-only theme is expanded to the full palette', () => {
    expect(validateTheme(undefined)).toEqual({ ok: true, theme: undefined });
    const r = validateTheme({ preset: 'slate-dark' });
    expect(r.ok).toBe(true);
    expect(r.theme).toEqual(themeFromPreset('slate-dark'));
  });
  test('closed schema: unknown keys, tokens, presets and fonts are rejected', () => {
    expect(validateTheme({ preset: 'x' }).ok).toBe(false);
    expect(validateTheme({ preset: 'paper', extra: 1 }).ok).toBe(false);
    expect(validateTheme({ preset: 'paper', palette: { nope: '#ffffff' } }).ok).toBe(false);
    expect(validateTheme({ preset: 'paper', fonts: { heading: 'comic-sans' } }).ok).toBe(false);
    expect(validateTheme({ preset: 'paper', fonts: { heading: 'inter', body: 'inter', extra: 'x' } }).ok).toBe(false);
    expect(validateTheme([]).ok).toBe(false);
    expect(validateTheme('paper').ok).toBe(false);
  });
  test.each(['url(http://x)', 'red', '#fff', '#12345', 'rgb(0,0,0)', '#112233; background:url(x)', '@accent', 42, null])('rejects palette colour %p', (bad) => {
    const r = validateTheme({ preset: 'paper', palette: { accent: bad } });
    expect(r.ok).toBe(false);
    expect(r.status).toBe(400);
  });
  test('accepts #rrggbb in any case and normalizes to lower case', () => {
    const r = validateTheme({ preset: 'paper', palette: { accent: '#ABCDEF' } });
    expect(r.ok).toBe(true);
    expect(r.theme.palette.accent).toBe('#abcdef');
  });
  test('custom colours that fail AA text contrast are accepted but reported as warnings', () => {
    const r = validateTheme({ preset: 'ethereal-sky', palette: { text: '#dddddd' } });
    expect(r.ok).toBe(true);
    expect(r.warnings.join(' ')).toMatch(/contrast/i);
  });
});

describe('applyThemePatch (theme_apply)', () => {
  test('a preset replaces the theme', () => {
    const r = applyThemePatch(themeFromPreset('paper'), { preset: 'slate-dark' });
    expect(r.ok).toBe(true);
    expect(r.theme).toEqual(themeFromPreset('slate-dark'));
  });
  test('palette and fonts override the current theme and keep the rest', () => {
    const cur = themeFromPreset('paper');
    const r = applyThemePatch(cur, { palette: { accent: '#102030' }, fonts: { heading: 'montserrat' } });
    expect(r.ok).toBe(true);
    expect(r.theme.palette.accent).toBe('#102030');
    expect(r.theme.palette.bg).toBe(cur.palette.bg);
    expect(r.theme.fonts).toEqual({ heading: 'montserrat', body: cur.fonts.body });
  });
  test('a preset plus overrides applies the overrides on the new preset', () => {
    const r = applyThemePatch(undefined, { preset: 'contrast', palette: { accent: '#223344' } });
    expect(r.theme.preset).toBe('contrast');
    expect(r.theme.palette.accent).toBe('#223344');
    expect(r.theme.palette.bg).toBe(THEME_PRESETS.contrast.palette.bg);
  });
  test('needs at least one field and rejects unknown ones', () => {
    expect(applyThemePatch(undefined, {}).ok).toBe(false);
    expect(applyThemePatch(undefined, { preset: 'paper', scale: 2 }).ok).toBe(false);
    expect(applyThemePatch(undefined, { preset: 'nope' }).ok).toBe(false);
  });
});

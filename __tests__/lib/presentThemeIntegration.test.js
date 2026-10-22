/**
 * @jest-environment node
 */
// ADR-0007 P2: content.theme and preset text travel through normalize, JSON import/export, live pickup, diff and merge.
import { normalizeDiagramContent } from '../../components/diagram-studio/migrations/normalizeContent';
import { buildExportEnvelope, sanitizeContent } from '../../components/diagram-studio/export/diagramJson';
import { contentFromDiagram } from '../../components/diagram-studio/live/livePickup';
import { diffContent } from '../../lib/versions/diff';
import { mergeContent } from '../../lib/merge/threeWay';
import { themeFromPreset } from '../../lib/present/themes';

const paper = themeFromPreset('paper');
const text = (md, extra = {}) => ({ id: 't1', type: 'text-block', packId: 'core', x: 0, y: 0, size: { width: 400, height: 80 }, label: md, data: { text: { preset: 'body', markdown: md } }, ...extra });

describe('normalize / pickup / JSON', () => {
  test('normalizeDiagramContent keeps a theme and adds none when absent', () => {
    expect(normalizeDiagramContent({ elements: [], theme: paper }).theme).toEqual(paper);
    expect('theme' in normalizeDiagramContent({ elements: [] })).toBe(false);
  });
  test('contentFromDiagram carries the theme', () => {
    expect(contentFromDiagram({ content: { elements: [], theme: paper } }).theme).toEqual(paper);
    expect(contentFromDiagram({ content: { elements: [] } }).theme).toBeUndefined();
  });
  test('export envelope includes the theme; import validates it', () => {
    const env = buildExportEnvelope({ elements: [], theme: paper });
    expect(env.diagram.content.theme).toEqual(paper);
    const ok = sanitizeContent({ elements: [], theme: { preset: 'slate-dark' } });
    expect(ok.content.theme.preset).toBe('slate-dark');
    const bad = sanitizeContent({ elements: [], theme: { preset: 'x' } });
    expect(bad.content.theme).toBeUndefined();
    expect(bad.warnings.join(' ')).toMatch(/theme/i);
  });
});

describe('diff', () => {
  test('a theme change is reported as one "theme" change with field names', () => {
    const d = diffContent({ elements: [] }, { elements: [], theme: paper });
    expect(d.changes).toEqual([expect.objectContaining({ id: 'theme', kind: 'theme', change: 'added' })]);
    const d2 = diffContent({ elements: [], theme: paper }, { elements: [], theme: { ...paper, palette: { ...paper.palette, accent: '#102030' }, fonts: { heading: 'work-sans', body: paper.fonts.body } } });
    expect(d2.changes).toHaveLength(1);
    expect(d2.changes[0]).toMatchObject({ kind: 'theme', change: 'changed' });
    expect(d2.changes[0].fields).toEqual(['fonts', 'palette']);
    expect(d2.summary.changed).toBe(1);
  });
  test('no change, no entry', () => {
    expect(diffContent({ elements: [], theme: paper }, { elements: [], theme: paper }).changes).toEqual([]);
  });
  test('a preset text edit is reported as the field "text", not an anonymous data change', () => {
    const d = diffContent({ elements: [text('a')] }, { elements: [text('b', { label: 'b', data: { text: { preset: 'body', markdown: 'b' } } })] });
    expect(d.changes[0].fields).toEqual(expect.arrayContaining(['text']));
    expect(d.changes[0].fields).not.toContain('data');
  });
});

describe('merge', () => {
  const base = { elements: [], theme: paper };
  test('a remote theme change is adopted when we did not touch it', () => {
    const theirs = { elements: [], theme: themeFromPreset('slate-dark') };
    const r = mergeContent(base, base, theirs);
    expect(r.ok).toBe(true);
    expect(r.content.theme.preset).toBe('slate-dark');
  });
  test('palette colours merge per token; the same token changed on both sides: local wins', () => {
    const ours = { elements: [], theme: { ...paper, palette: { ...paper.palette, accent: '#111111' } } };
    const theirs = { elements: [], theme: { ...paper, palette: { ...paper.palette, accent: '#222222', accent2: '#333333' } } };
    const r = mergeContent(base, ours, theirs);
    expect(r.ok).toBe(true);
    expect(r.content.theme.palette.accent).toBe('#111111');
    expect(r.content.theme.palette.accent2).toBe('#333333');
  });
  test('different tokens and fonts edited on both sides both survive; the same token reports a local-wins conflict', () => {
    const ours = { elements: [], theme: { ...paper, palette: { ...paper.palette, accent: '#111111' }, fonts: { ...paper.fonts, heading: 'montserrat' } } };
    const theirs = { elements: [], theme: { ...paper, palette: { ...paper.palette, accent: '#222222', muted: '#444444' } } };
    const r = mergeContent(base, ours, theirs);
    expect(r.content.theme.palette).toMatchObject({ accent: '#111111', muted: '#444444' });
    expect(r.content.theme.fonts.heading).toBe('montserrat');
    expect(r.conflicts).toEqual([expect.objectContaining({ kind: 'theme', resolution: 'local-wins', fields: ['palette.accent'] })]);
    const clean = mergeContent(base, { elements: [], theme: { ...paper, palette: { ...paper.palette, bg: '#fafafa' } } }, { elements: [], theme: { ...paper, palette: { ...paper.palette, muted: '#444444' } } });
    expect(clean.conflicts).toEqual([]);
    expect(clean.content.theme.palette).toMatchObject({ bg: '#fafafa', muted: '#444444' });
  });
  test('content that never had a theme gets none', () => {
    const r = mergeContent({ elements: [] }, { elements: [] }, { elements: [] });
    expect('theme' in r.content).toBe(false);
  });
  test('two edits of the same preset text merge field by field (markdown changed on one side)', () => {
    const b = { elements: [text('a')] };
    const theirs = { elements: [text('b', { data: { text: { preset: 'body', markdown: 'b' } } })] };
    const ours = { elements: [text('a', { x: 50 })] };
    const r = mergeContent(b, ours, theirs);
    expect(r.ok).toBe(true);
    expect(r.content.elements[0].data.text.markdown).toBe('b');
    expect(r.content.elements[0].x).toBe(50);
  });
});

describe('legacy font ids', () => {
  const { validateTheme, resolveTheme } = require('../../lib/present/themes');
  test('a stored lato is migrated to work-sans (Lato has an OFL Reserved Font Name)', () => {
    expect(validateTheme({ preset: 'paper', fonts: { heading: 'lato', body: 'inter' } }).theme.fonts).toEqual({ heading: 'work-sans', body: 'inter' });
    expect(resolveTheme({ preset: 'paper', fonts: { heading: 'lato' } }).fonts.heading).toBe('work-sans');
  });
});

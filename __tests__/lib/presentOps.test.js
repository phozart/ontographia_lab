/**
 * @jest-environment node
 */
// ADR-0007 P2: ops compile for text presets, style (fill/stroke/radius/opacity), zIndex, theme_set and the internal paste_clones.
import { applyOps } from '../../lib/mcp/ops';

let n = 0;
const newId = (p) => `${p}-${(n += 1)}`;
const run = (content, ops, opts = {}) => applyOps(content, ops, { newId, ...opts });
const frame = { id: 'f1', type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, x: 0, y: 0, size: { width: 960, height: 540 }, label: 'S', data: { aspect: '16:9' } };
const base = () => ({ elements: [frame], connections: [] });

describe('add_element with text', () => {
  test('creates a preset text-block: data.text, synced label, materialized font size from the parent frame, estimated height', () => {
    const r = run(base(), [{ op: 'add_element', type: 'core/text-block', x: 50, y: 50, w: 600, parent: 'f1', text: { preset: 'title', markdown: 'Hello **world**' } }]);
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.type === 'text-block');
    expect(el.data.text).toEqual({ preset: 'title', markdown: 'Hello **world**' });
    expect(el.label).toBe('Hello world');
    expect(el.fontSize).toBe(36); // 72 x 540/1080
    expect(el.size.width).toBe(600);
    expect(el.size.height).toBeGreaterThan(30);
    expect(el.parentFrameId).toBe('f1');
  });
  test('text is only for core/text-block; preset must be known; unknown text keys are rejected', () => {
    expect(run(base(), [{ op: 'add_element', type: 'core/rectangle', text: { preset: 'body', markdown: 'x' } }]).ok).toBe(false);
    expect(run(base(), [{ op: 'add_element', type: 'core/text-block', text: { preset: 'giant', markdown: 'x' } }]).ok).toBe(false);
    expect(run(base(), [{ op: 'add_element', type: 'core/text-block', text: { preset: 'body', markdown: 'x', evil: 1 } }]).ok).toBe(false);
  });
  test('hostile markdown is neutralized', () => {
    const r = run(base(), [{ op: 'add_element', type: 'core/text-block', x: 0, y: 0, text: { preset: 'body', markdown: '[x](javascript:alert(1)) <script>x</script>' } }]);
    expect(r.ok).toBe(true);
    const md = r.content.elements.find((e) => e.type === 'text-block').data.text.markdown;
    expect(md).not.toMatch(/\]\(javascript:/i);
    expect(md).not.toMatch(/(^|[^\\])<script/);
  });
});

describe('style, aspect and zIndex', () => {
  test('add_element style maps to fill / border / text colour, radius and opacity (tokens allowed)', () => {
    const r = run(base(), [{ op: 'add_element', type: 'core/rectangle', x: 1, y: 2, label: 'K', style: { fill: '@surface', stroke: '#112233', textColor: '@text', radius: 24, opacity: 0.5 } }]);
    expect(r.ok).toBe(true);
    expect(r.content.elements.find((e) => e.label === 'K')).toMatchObject({ backgroundColor: '@surface', borderColor: '#112233', textColor: '@text', borderRadius: 24, opacity: 0.5 });
  });
  test('a frame style.fill is the slide background and add_element accepts aspect for frames', () => {
    const r = run({ elements: [], connections: [] }, [{ op: 'add_element', type: 'core/frame', x: 0, y: 0, w: 1920, h: 1080, label: 'T', aspect: '16:9', style: { fill: '@bg' } }]);
    expect(r.ok).toBe(true);
    const f = r.content.elements[0];
    expect(f.data).toMatchObject({ aspect: '16:9', backgroundColor: '@bg' });
    expect(f.membershipExplicit).toBe(true);
  });
  test.each([
    [{ fill: 'url(x)' }], [{ fill: '@nope' }], [{ radius: -1 }], [{ radius: 1000 }], [{ opacity: 2 }], [{ opacity: 'x' }], [{ evil: '#fff' }], ['x'],
  ])('rejects style %j', (style) => {
    expect(run(base(), [{ op: 'add_element', type: 'core/rectangle', x: 0, y: 0, style }]).ok).toBe(false);
  });
  test('update_element: style, zIndex and text; locked elements are still refused', () => {
    const c = run(base(), [{ op: 'add_element', ref: '@t', type: 'core/text-block', x: 5, y: 5, parent: 'f1', text: { preset: 'body', markdown: 'one' } }]);
    const id = c.elements[0].id;
    const r = run(c.content, [{ op: 'update_element', id, zIndex: 7, style: { textColor: '@accentText' }, text: { markdown: 'two', preset: 'heading' } }]);
    expect(r.ok).toBe(true);
    const el = r.content.elements.find((e) => e.id === id);
    expect(el.zIndex).toBe(7);
    expect(el.textColor).toBe('@accentText');
    expect(el.data.text).toMatchObject({ preset: 'heading', markdown: 'two' });
    expect(el.label).toBe('two');
    expect(el.fontSize).toBe(Math.round(48 * 540 / 1080));
    expect(run(c.content, [{ op: 'update_element', id, zIndex: 1.5 }]).ok).toBe(false);
    expect(run(c.content, [{ op: 'update_element', id, zIndex: 100000 }]).ok).toBe(false);
    const locked = { ...c.content, elements: c.content.elements.map((e) => (e.id === id ? { ...e, locked: true } : e)) };
    expect(run(locked, [{ op: 'update_element', id, zIndex: 3 }]).ok).toBe(false);
  });
  test('update_element text on a non-text element fails', () => {
    expect(run(base(), [{ op: 'update_element', id: 'f1', text: { markdown: 'x' } }]).ok).toBe(false);
  });
});

describe('theme_set', () => {
  test('sets the board theme (expanded) and reports it', () => {
    const r = run(base(), [{ op: 'theme_set', preset: 'slate-dark' }]);
    expect(r.ok).toBe(true);
    expect(r.content.theme.preset).toBe('slate-dark');
    expect(r.content.theme.palette.bg).toBe('#18212b');
    expect(r.theme.preset).toBe('slate-dark');
  });
  test('palette / fonts override the current theme', () => {
    const a = run(base(), [{ op: 'theme_set', preset: 'paper' }]);
    const b = run(a.content, [{ op: 'theme_set', palette: { accent: '#102030' }, fonts: { heading: 'montserrat' } }]);
    expect(b.content.theme.palette.accent).toBe('#102030');
    expect(b.content.theme.fonts.heading).toBe('montserrat');
    expect(b.content.theme.preset).toBe('paper');
  });
  test('rejects bad input and empty patches', () => {
    expect(run(base(), [{ op: 'theme_set', preset: 'neon' }]).ok).toBe(false);
    expect(run(base(), [{ op: 'theme_set' }]).ok).toBe(false);
    expect(run(base(), [{ op: 'theme_set', palette: { bg: 'red' } }]).ok).toBe(false);
  });
});

describe('paste_clones is internal', () => {
  const clone = { id: 'c1', type: 'rectangle', packId: 'core', x: 1, y: 1, size: { width: 10, height: 10 }, label: 'c', parentFrameId: 'f1' };
  test('rejected for callers (Claude cannot send prebuilt elements)', () => {
    const r = run(base(), [{ op: 'paste_clones', elements: [clone] }]);
    expect(r.ok).toBe(false);
    expect(r.errors[0].message).toMatch(/Unknown op/);
    expect(r.errors[0].message.replace(/Unknown op "[^"]*"/, '')).not.toMatch(/paste_clones/);
  });
  test('allowed for the deck compiler, validated like everything else', () => {
    const r = run(base(), [{ op: 'paste_clones', elements: [clone], connections: [] }], { internal: true });
    expect(r.ok).toBe(true);
    expect(r.content.elements.map((e) => e.id)).toContain('c1');
    const dup = run(base(), [{ op: 'paste_clones', elements: [{ ...clone, id: 'f1' }] }], { internal: true });
    expect(dup.ok).toBe(false);
  });
});

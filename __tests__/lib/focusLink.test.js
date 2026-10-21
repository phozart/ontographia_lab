/**
 * @jest-environment node
 */
import { buildFocusLink, parseFocusLink, FocusLinkError, MAX_FOCUS_IDS } from '../../lib/focusLink';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('buildFocusLink', () => {
  test('selection -> ?focus= with comma separated ids', () => {
    expect(buildFocusLink({ origin: 'https://lab.test/', diagramRef: 'LAB-12', ids: ['el-a', 'el-b'] })).toBe(
      'https://lab.test/diagram/LAB-12?focus=el-a,el-b'
    );
  });
  test('too many ids fall back to the bounding region', () => {
    const ids = Array.from({ length: MAX_FOCUS_IDS + 1 }, (_, i) => `e${i}`);
    expect(buildFocusLink({ origin: '', diagramRef: UUID, ids, bounds: { x: 10.04, y: -5, width: 300, height: 200.26 } })).toBe(
      `/diagram/${UUID}?region=10,-5,300,200.3`
    );
  });
  test('no selection and no bounds -> plain deep link; bad diagram ref throws', () => {
    expect(buildFocusLink({ origin: '', diagramRef: 'LAB-1' })).toBe('/diagram/LAB-1');
    expect(() => buildFocusLink({ diagramRef: '../x' })).toThrow(FocusLinkError);
  });
  test('ids that are not safe are dropped', () => {
    expect(buildFocusLink({ diagramRef: 'LAB-1', ids: ['ok', 'a b', 'x&y=1'] })).toBe('/diagram/LAB-1?focus=ok');
  });
});

describe('parseFocusLink', () => {
  test('round trips a built link and ignores the host', () => {
    const link = buildFocusLink({ origin: 'https://anything.example', diagramRef: 'LAB-12', ids: ['frame-1', 'el-b'] });
    expect(parseFocusLink(link)).toEqual({ diagramRef: 'LAB-12', focus: { elementIds: ['frame-1', 'el-b'] } });
  });
  test('accepts path-only and bare forms, uuid refs, de-duplicates ids', () => {
    expect(parseFocusLink(`/diagram/${UUID}?focus=a,a,b`).focus).toEqual({ elementIds: ['a', 'b'] });
    expect(parseFocusLink('LAB-7?focus=a')).toEqual({ diagramRef: 'LAB-7', focus: { elementIds: ['a'] } });
  });
  test('region links', () => {
    expect(parseFocusLink('/diagram/LAB-3?region=0,10.5,300,200').focus).toEqual({ bbox: { x: 0, y: 10.5, width: 300, height: 200 } });
  });
  test('no focus param -> focus null', () => {
    expect(parseFocusLink('https://h/diagram/LAB-3')).toEqual({ diagramRef: 'LAB-3', focus: null });
  });
  test.each([
    '',
    '   ',
    'https://h/dashboard',
    'https://h/diagram/not-an-id?focus=a',
    '/diagram/LAB-1?focus=a&region=0,0,1,1',
    '/diagram/LAB-1?region=0,0,0,10',
    '/diagram/LAB-1?region=0,0,10',
    '/diagram/LAB-1?region=a,b,c,d',
    '/diagram/LAB-1?region=0,0,,10',
    '/diagram/LAB-1?region=0,0,1e12,10',
    '/diagram/LAB-1?focus=bad%20id',
    '/diagram/LAB-1?focus=' + Array.from({ length: MAX_FOCUS_IDS + 1 }, (_, i) => `e${i}`).join(','),
    '/diagram/%E0%A4%A?focus=a',
    'x'.repeat(9000),
  ])('rejects %#', (bad) => {
    expect(() => parseFocusLink(bad)).toThrow(FocusLinkError);
  });
  test('non-strings are rejected', () => {
    expect(() => parseFocusLink(undefined)).toThrow(FocusLinkError);
    expect(() => parseFocusLink({})).toThrow(FocusLinkError);
  });
});

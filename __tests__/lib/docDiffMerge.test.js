/**
 * @jest-environment node
 */
// AI-5: a doc's markdown is a field for the slice-8 compare diff and the AI-2 three-way merge. Concurrent edits of the
// same doc follow the AI-2 rules (local wins on the same field, different fields both kept) and the merged content
// still passes server validation.

import { diffContent } from '../../lib/versions/diff';
import { mergeContent } from '../../lib/merge/threeWay';
import { validateDiagramContent } from '../../lib/diagramContent';

const docEl = (id, doc, extra = {}) => ({ id, type: 'doc', packId: 'core', x: 0, y: 0, size: { width: 320, height: 220 }, label: doc.title, layerId: 'default', properties: {}, data: { doc }, ...extra });
const content = (elements = []) => ({ elements, connections: [], layers: [{ id: 'default', name: 'Default' }], groups: [], viewport: { x: 0, y: 0, scale: 1 } });
const byId = (list, id) => list.find((e) => e.id === id);
const run = (b, o, t) => { const r = mergeContent(b, o, t); expect(r.ok).toBe(true); return r; };
const D = (markdown, title = 'Notes') => ({ title, markdown });

describe('compare diff', () => {
  test('a markdown edit is reported as the field "doc"', () => {
    const d = diffContent(content([docEl('d', D('# A\n\none'))]), content([docEl('d', D('# A\n\ntwo'))]));
    expect(d.changes).toEqual([expect.objectContaining({ id: 'd', kind: 'element', change: 'changed', fields: ['doc'] })]);
    expect(d.summary).toEqual({ added: 0, removed: 0, changed: 1 });
  });

  test('a doc move plus a text edit reports both; other data keys still report "data"', () => {
    const d = diffContent(content([docEl('d', D('x'))]), content([docEl('d', D('y'), { x: 100 })]));
    expect(d.changes[0].fields).toEqual(['doc', 'position']);
    const e = diffContent(content([docEl('d', D('x'), { data: { doc: D('x'), other: 1 } })]), content([docEl('d', D('x'), { data: { doc: D('x'), other: 2 } })]));
    expect(e.changes[0].fields).toEqual(['data']);
  });

  test('added and removed docs are listed with their titles', () => {
    const d = diffContent(content([]), content([docEl('d', D('x', 'New doc'))]));
    expect(d.changes[0]).toMatchObject({ change: 'added', label: 'New doc' });
    expect(diffContent(content([docEl('d', D('x', 'Old doc'))]), content([])).changes[0]).toMatchObject({ change: 'removed', label: 'Old doc' });
  });
});

describe('three-way merge', () => {
  const base = content([docEl('d', D('line one\n', 'Notes'))]);

  test('local edits the title, remote edits the markdown: both kept, no conflict', () => {
    const r = run(base, content([docEl('d', D('line one\n', 'Renamed'))]), content([docEl('d', D('line one\nline two\n', 'Notes'))]));
    expect(byId(r.content.elements, 'd').data.doc).toEqual({ title: 'Renamed', markdown: 'line one\nline two\n' });
    expect(r.conflicts).toEqual([]);
  });

  test('both edit the markdown: local wins and the conflict names the field', () => {
    const r = run(base, content([docEl('d', D('mine\n'))]), content([docEl('d', D('theirs\n'))]));
    expect(byId(r.content.elements, 'd').data.doc.markdown).toBe('mine\n');
    expect(r.conflicts).toEqual([expect.objectContaining({ kind: 'element', id: 'd', resolution: 'local-wins', fields: ['data.doc.markdown'] })]);
  });

  test('only the remote edits the markdown: adopted', () => {
    const r = run(base, base, content([docEl('d', D('agent summary\n'))]));
    expect(byId(r.content.elements, 'd').data.doc.markdown).toBe('agent summary\n');
    expect(r.summary.remote.changed).toBe(1);
  });

  test('remote deleted the doc while the local side edited it: the edited doc is kept', () => {
    const r = run(base, content([docEl('d', D('my edit\n'))]), content([]));
    expect(byId(r.content.elements, 'd').data.doc.markdown).toBe('my edit\n');
    expect(r.conflicts[0]).toMatchObject({ id: 'd', resolution: 'kept-local-edit' });
  });

  test('remote added a new doc while the local side moved another element: both survive', () => {
    const b = content([{ id: 'n', type: 'rectangle', x: 0, y: 0, size: { width: 10, height: 10 } }]);
    const r = run(b, content([{ id: 'n', type: 'rectangle', x: 50, y: 0, size: { width: 10, height: 10 } }]), content([...b.elements, docEl('d', D('summary'))]));
    expect(r.content.elements.map((e) => e.id).sort()).toEqual(['d', 'n']);
  });

  test('the merged content still passes server validation', () => {
    const r = run(base, content([docEl('d', D('mine [a](#el=n1)\n'))]), content([docEl('d', D('theirs\n'))]));
    expect(validateDiagramContent(r.content).ok).toBe(true);
  });
});

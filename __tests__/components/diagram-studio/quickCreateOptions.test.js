import { resolveQuickCreateOptions } from '../../../components/diagram-studio/hooks/interaction/quickCreateOptions';

describe('resolveQuickCreateOptions', () => {
  test('mind map: no forced stencil so the hierarchy applies', () => {
    const r = resolveQuickCreateOptions({ packId: 'mind-map', type: 'central-topic' }, { id: 'central-topic', name: 'Central Topic' });
    expect(r.stencil).toBeNull();
    expect(r.label).toBe('');
  });
  test('other packs clone the source stencil', () => {
    const r = resolveQuickCreateOptions({ packId: 'process-flow', type: 'task' }, { id: 'task', name: 'Task' });
    expect(r.stencil).toEqual({ id: 'task', name: 'Task', packId: 'process-flow' });
    expect(r.label).toBe('Task');
  });
  test('missing stencil falls back to default label', () => {
    expect(resolveQuickCreateOptions({ packId: 'x' }, undefined)).toEqual({ stencil: null, label: 'New Node' });
  });
});

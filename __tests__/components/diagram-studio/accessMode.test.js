import { accessMode, canWrite, applyAccessToProfile } from '../../../components/diagram-studio/sharing/accessMode';
import { PROFILE_INFINITE_CANVAS, isActionAllowed } from '../../../components/diagram-studio/DiagramProfile';

const caps = (...c) => ({ role: 'x', source: 'member', capabilities: c });

describe('accessMode', () => {
  test('write capability -> edit; comment only -> comment; read only -> view', () => {
    expect(accessMode(caps('diagram.read', 'diagram.write', 'comment.create'))).toBe('edit');
    expect(accessMode(caps('diagram.read', 'comment.create'))).toBe('comment');
    expect(accessMode(caps('diagram.read'))).toBe('view');
  });
  test('no access block (older payloads, new diagrams) -> edit: the server enforces the real policy', () => {
    expect(accessMode(null)).toBe('edit');
    expect(accessMode(undefined)).toBe('edit');
    expect(canWrite(undefined)).toBe(true);
  });
  test('malformed capabilities fail closed to view', () => {
    expect(accessMode({ role: 'viewer', capabilities: 'diagram.write' })).toBe('view');
    expect(canWrite({ capabilities: null, role: 'viewer' })).toBe(false);
  });
});

describe('applyAccessToProfile', () => {
  test('editors keep the profile object untouched', () => {
    expect(applyAccessToProfile(PROFILE_INFINITE_CANVAS, caps('diagram.write'))).toBe(PROFILE_INFINITE_CANVAS);
  });
  test('viewers and commenters get a read-only copy that blocks every editing action', () => {
    for (const a of [caps('diagram.read'), caps('diagram.read', 'comment.create')]) {
      const p = applyAccessToProfile(PROFILE_INFINITE_CANVAS, a);
      expect(p).not.toBe(PROFILE_INFINITE_CANVAS);
      expect(p.editingPolicy.readOnly).toBe(true);
      for (const act of ['create', 'delete', 'move', 'resize', 'connect', 'editProperties', 'editLabel']) {
        expect(isActionAllowed(p, act)).toBe(false);
      }
    }
    expect(PROFILE_INFINITE_CANVAS.editingPolicy.readOnly).toBeFalsy(); // original not mutated
  });
});

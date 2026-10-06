import { SHORTCUT_GROUPS, flattenShortcuts } from '../../../components/diagram-studio/ui/shortcutKeymap';
import { quickShapeAction, isStencilArmed } from '../../../components/diagram-studio/ui/shapeSidebarLogic';

const all = flattenShortcuts();
const find = (...keys) => all.find((s) => s.keys.join('+') === keys.join('+'));

describe('shortcut keymap describes actual behavior', () => {
  test('Tab adds a mind-map child, Enter adds a sibling', () => {
    expect(find('Tab').description).toMatch(/child/i);
    expect(find('Enter').description).toMatch(/sibling/i);
  });
  test('removes claims for keys that are not bound', () => {
    const text = all.map((s) => `${s.keys.join('+')} ${s.description}`).join('\n');
    expect(text).not.toMatch(/select next element/i);
    expect(text).not.toMatch(/select previous element/i);
    expect(find('Mod', 'X')).toBeUndefined();
    expect(find('Mod', 'E')).toBeUndefined();
    expect(find('Alt', 'W')).toBeUndefined();
    expect(find('Mod', 'Shift', 'S')).toBeUndefined();
    expect(find('G')).toBeUndefined();
    expect(find('[')?.description).not.toMatch(/panel/i);
  });
  test('documents the keys that are bound', () => {
    expect(find('N').description).toMatch(/sticky/i);
    expect(find('S')).toBeDefined();
    expect(find('1').description).toMatch(/left panel|shapes/i);
    expect(find('M').description).toMatch(/minimap/i);
  });
  test('has a note that single-key shortcuts pause while typing', () => {
    expect(JSON.stringify(SHORTCUT_GROUPS)).toMatch(/typing/i);
  });
});

describe('quick shape armed-tool state machine', () => {
  const rect = { id: 'rectangle', stencilId: 'rectangle', packId: 'core' };
  const ellipse = { id: 'ellipse', stencilId: 'ellipse', packId: 'core' };
  test('nothing armed: click arms', () => {
    expect(quickShapeAction(null, rect)).toBe('arm');
  });
  test('same shape armed: click disarms', () => {
    expect(quickShapeAction({ id: 'rectangle', packId: 'core' }, rect)).toBe('disarm');
  });
  test('another shape armed: click arms the new one', () => {
    expect(quickShapeAction({ id: 'rectangle', packId: 'core' }, ellipse)).toBe('arm');
  });
  test('after a placement clears the armed stencil, the same shape arms again (no stale state)', () => {
    let armed = null;
    armed = { id: 'rectangle', packId: 'core' }; // first click arms
    armed = null; // placement clears it
    expect(quickShapeAction(armed, rect)).toBe('arm');
  });
  test('isStencilArmed compares pack and id', () => {
    expect(isStencilArmed({ id: 'rectangle', packId: 'core' }, rect)).toBe(true);
    expect(isStencilArmed({ id: 'rectangle', packId: 'uml' }, rect)).toBe(false);
    expect(isStencilArmed(null, rect)).toBe(false);
  });
});

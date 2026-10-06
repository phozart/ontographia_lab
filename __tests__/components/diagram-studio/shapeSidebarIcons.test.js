import { PACK_ICONS } from '../../../components/diagram-studio/ui/ShapeSidebar';
import { PACK_IDS, MindMapPack } from '../../../components/diagram-studio/packs';

describe('shape sidebar pack icons', () => {
  test('every sidebar pack has its own distinct icon', () => {
    const ids = PACK_IDS.filter((id) => id !== 'core');
    const types = ids.map((id) => {
      expect(PACK_ICONS[id]).toBeTruthy();
      return PACK_ICONS[id].type;
    });
    expect(new Set(types).size).toBe(types.length);
    // and none equals the Core icon
    expect(types).not.toContain(PACK_ICONS.core.type);
  });

  test('mind-map colour topics carry their own colours and tint their tile icon', () => {
    const topics = MindMapPack.stencils.filter((s) => /^topic-/.test(s.id));
    expect(topics).toHaveLength(4);
    topics.forEach((t) => expect(t.tintIcon).toBe(true));
    expect(new Set(topics.map((t) => t.color)).size).toBe(4);
  });
});

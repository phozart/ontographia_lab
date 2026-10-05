import { ExportManager } from '../../../components/diagram-studio/export/ExportManager';
import { parseImportText } from '../../../components/diagram-studio/export/diagramJson';

jest.mock('../../../components/diagram-studio/export/exportRenderer', () => ({
  exportFromCanvas: jest.fn(async (format, options) => ({ format, content: new Blob(['x']), mimeType: 'x', filename: `${options.name}.${format}` })),
}));
const { exportFromCanvas } = require('../../../components/diagram-studio/export/exportRenderer');

const diagram = {
  id: 'd1',
  name: 'Plan / Q3',
  type: 'cld',
  elements: [{ id: 'a', type: 'rect', x: 0, y: 0, size: { width: 10, height: 10 } }],
  connections: [],
  layers: [],
  groups: [],
};

describe('ExportManager.exportJSON', () => {
  it('produces the versioned envelope that parseImportText accepts', () => {
    const res = new ExportManager().exportJSON(diagram);
    const parsed = JSON.parse(res.content);
    expect(parsed.format).toBe('ontographia-diagram');
    expect(parsed.version).toBe(1);
    expect(parsed.diagram.content.elements).toHaveLength(1);
    expect(res.filename).toBe('Plan - Q3.json');
    expect(parseImportText(res.content).ok).toBe(true);
  });
});

describe('ExportManager image formats', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div class="ds-canvas-inner"></div>';
    exportFromCanvas.mockClear();
  });

  it.each(['png', 'jpeg', 'svg', 'pdf'])('captures the live canvas for %s', async (format) => {
    const res = await new ExportManager().export(diagram, format, { scale: 2 });
    expect(exportFromCanvas).toHaveBeenCalledWith(format, expect.objectContaining({ name: 'Plan / Q3' }));
    expect(res.format).toBe(format);
  });

  it('rejects pdf without a live canvas', async () => {
    document.body.innerHTML = '';
    await expect(new ExportManager().export(diagram, 'pdf')).rejects.toThrow(/canvas/i);
  });
});

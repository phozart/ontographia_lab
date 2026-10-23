// scripts/perf/seedBoard.js
// Deterministic mixed board used by the board-load benchmark and its e2e test: a grid of frames, each followed by
// shapes, text presets, docs, tables and connections.
const O = 50000;

/** Deterministic mixed board: a grid of frames, each holding shapes, plus docs, tables, text presets and connections. */
function seedContent(n) {
  const elements = [];
  const connections = [];
  const cols = Math.ceil(Math.sqrt(n / 1.4));
  const SHAPES = ['rectangle', 'circle', 'diamond'];
  let i = 0;
  let frameId = null;
  while (elements.length < n) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = O + col * 260;
    const y = O + row * 190;
    const k = i % 20;
    const id = `e${i}`;
    if (k === 0) {
      frameId = id;
      elements.push({ id, type: 'frame', packId: 'core', isFrame: true, x, y, size: { width: 240, height: 170 }, label: `Frame ${i}`, color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '#ffffff', showTitle: true } });
    } else if (k === 5 || k === 15) {
      elements.push({ id, type: 'text-block', packId: 'core', x, y, size: { width: 220, height: 80 }, label: 'Heading', layerId: 'default', properties: {}, data: { text: { preset: k === 5 ? 'heading' : 'body', markdown: `Text block ${i} with a little body copy that wraps onto a second line.` } } });
    } else if (k === 9 && i / 20 < 150) { // the API caps docs at 200 per board
      elements.push({ id, type: 'doc', packId: 'core', x, y, size: { width: 220, height: 150 }, label: `Doc ${i}`, color: '#4FB3CE', layerId: 'default', properties: {}, data: { doc: { title: `Doc ${i}`, markdown: `## Notes ${i}\n\n- first point\n- second point\n\nSome **bold** text for the excerpt.` } } });
    } else if (k === 13) {
      const table = { headerRow: true, headerColumn: false, columns: [{ id: 'col-a', name: 'Name', type: 'text', width: 100 }, { id: 'col-b', name: 'Owner', type: 'text', width: 100 }], rows: [{ id: 'row-1', cells: { 'col-a': `Row ${i}`, 'col-b': 'Ops' } }, { id: 'row-2', cells: { 'col-a': 'Gateway', 'col-b': 'Edge' } }] };
      elements.push({ id, type: 'table', packId: 'core', x, y, size: { width: 200, height: 96 }, label: `Table ${i}`, color: '#4FB3CE', layerId: 'default', properties: {}, data: { table } });
    } else {
      elements.push({ id, type: SHAPES[i % 3], packId: 'core', x, y, size: { width: 140, height: 80 }, label: `Service ${i} handles orders`, color: ['#4FB3CE', '#E8A99A', '#F0D98A', '#6A9FC9'][i % 4], layerId: 'default', properties: {}, ...(frameId && k < 5 ? {} : {}) });
    }
    if (i > 0 && k !== 0 && elements.length < n) connections.push({ id: `c${i}`, lineStyle: 'step', sourceId: `e${i - 1}`, targetId: id, packId: 'core', layerId: 'default', properties: {} });
    i += 1;
  }
  return { elements, connections, layers: [], groups: [], viewport: { x: 0, y: 0, zoom: 1 } };
}

module.exports = { seedContent, O };

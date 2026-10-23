// Fixture decks for the PPTX export tests (ADR-0007 P3). Pure data builders: no DB, no browser.
const { planLayout } = require('../../lib/present/slideBuild');
const { newPresetTextElement } = require('../../lib/present/textPreset');
const { buildTableFromSpec } = require('../../lib/table/tablePatch');
const { tableElementSize } = require('../../lib/table/tableModel');

let seq = 0;
const idGen = (p) => `${p}-${(seq += 1)}`;

const FRAME_W = 1920;
const FRAME_H = 1080;

function frame(id, i, label, extra = {}) {
  return {
    id, type: 'frame', packId: 'core', isFrame: true, membershipExplicit: true, x: i * 2200, y: 0, size: { width: FRAME_W, height: FRAME_H }, label,
    color: '#64748b', layerId: 'default', properties: {}, data: { backgroundColor: '@bg', showTitle: true, aspect: '16:9', ...extra },
  };
}

function laidOut(f, layout, texts) {
  const plan = planLayout({ frame: f, elements: [], layout, title: texts.title, idGen });
  if (!plan.ok) throw new Error(plan.error);
  const out = plan.creates.map((el) => {
    const slot = el.origin && el.origin.slot;
    if (slot && texts[slot] !== undefined && el.data && el.data.text) {
      return { ...el, label: texts[slot], size: { ...el.size, height: Math.max(el.size.height, 60) }, data: { ...el.data, text: { ...el.data.text, markdown: texts[slot] } } };
    }
    return el;
  });
  return out;
}

const rect = (id, parent, x, y, w, h, label, extra = {}) => ({
  id, type: 'rectangle', packId: 'core', x, y, size: { width: w, height: h }, label, color: '#4FB3CE', layerId: 'default', properties: {}, parentFrameId: parent, ...extra,
});

/** The P2 style five-slide demo deck: cover, title+body, two columns, big number, title+visual (a rounded shape and a sticky). */
function demoDeck() {
  seq = 0;
  const frames = [0, 1, 2, 3, 4].map((i) => frame(`f${i}`, i, ['Cover', 'Findings', 'Two views', 'The number', 'Shapes'][i]));
  const elements = [
    ...frames,
    ...laidOut(frames[0], 'title', { title: 'Checkout review', subtitle: 'What we learned in October' }),
    ...laidOut(frames[1], 'title-body', { title: 'Findings', body: '- Checkout drops 40% on mobile\n- The payment form is the worst step\n- **Guest checkout** is hidden behind a link: [details](https://example.com/report)' }),
    ...laidOut(frames[2], 'two-column', { title: 'Two views', left: 'Customers want **speed**. Every extra field costs us orders, and the data shows it clearly.', right: 'Finance wants *control*. Fraud checks add steps, and each one has a cost we can measure.' }),
    ...laidOut(frames[3], 'big-number', { number: '40%', label: 'drop on the payment step', body: 'Measured over four weeks on mobile.' }),
    ...laidOut(frames[4], 'title-visual', { title: 'Shapes' }),
    rect('r1', 'f4', 2200 * 4 + 200, 400, 420, 200, 'Rounded blue', { borderRadius: 24, backgroundColor: '@accent', opacity: 0.8 }),
    { id: 's1', type: 'sticky-medium', packId: 'sticky-notes', x: 2200 * 4 + 800, y: 400, size: { width: 300, height: 300 }, label: 'Ship the guest checkout', color: '#fef08a', layerId: 'default', properties: {}, parentFrameId: 'f4' },
    { id: 'c1', type: 'circle', packId: 'core', x: 2200 * 4 + 1300, y: 400, size: { width: 240, height: 240 }, label: 'Round', color: '#E8A99A', layerId: 'default', properties: {}, parentFrameId: 'f4' },
    { id: 'd1', type: 'diamond', packId: 'core', x: 2200 * 4 + 1300, y: 700, size: { width: 240, height: 200 }, label: 'Choice', color: '#F0D98A', layerId: 'default', properties: {}, parentFrameId: 'f4' },
  ];
  const presentations = [{
    id: 'pres-demo', title: 'Checkout review - Oct', aspect: '16:9',
    slides: frames.map((f, i) => ({ id: `slide-${i}`, frameId: f.id, notes: i === 1 ? 'Say: this is the headline.\nPause for questions.' : '', hidden: false })),
  }];
  return { content: { elements, connections: [], layers: [], groups: [], presentations }, presentationId: 'pres-demo' };
}

/** A deck with a table, a doc, a text-heavy slide and a UML/connector group, plus a hidden and a missing slide. */
function mixedDeck() {
  seq = 100;
  const frames = [0, 1, 2, 3].map((i) => frame(`m${i}`, i, ['Table', 'Doc', 'Text heavy', 'UML'][i]));
  const x0 = (i) => i * 2200;
  const table = buildTableFromSpec({
    columns: [{ name: 'Step', type: 'text' }, { name: 'Users', type: 'number' }, { name: 'Status', type: 'select', options: ['ok', 'bad'] }, { name: 'Fixed', type: 'boolean' }],
    rows: [['Cart', 1200, 'ok', true], ['Payment', 480, 'bad', false], ['=1+1', 90, 'bad', false], ['Confirmation', 470, 'ok', true]],
  }, { newId: (p) => `${p}-${(seq += 1)}` });
  const tbl = table.table || table;
  const tableEl = {
    id: 'tbl1', type: 'table', packId: 'core', x: x0(0) + 160, y: 380, size: tableElementSize(tbl), label: 'Funnel', layerId: 'default', properties: {}, parentFrameId: 'm0', data: { table: tbl },
  };
  const docEl = {
    id: 'doc1', type: 'doc', packId: 'core', x: x0(1) + 160, y: 360, size: { width: 760, height: 420 }, label: 'Notes', layerId: 'default', properties: {}, parentFrameId: 'm1',
    data: { doc: { title: 'Research notes', markdown: '# Findings\n\nUsers abandon at the payment form.\n\n- Slow address lookup\n- Card errors are unclear\n\n' + 'More detail about the research, repeated to overflow the card. '.repeat(40) } },
  };
  const docFull = {
    id: 'doc2', type: 'doc', packId: 'core', x: x0(1) + 1000, y: 360, size: { width: 760, height: 420 }, label: 'Prose', layerId: 'default', properties: {}, parentFrameId: 'm1',
    data: { doc: { title: 'Prose', display: 'full', markdown: 'A paragraph shown as slide prose with **bold** and a [link](/diagram/LAB-9).\n\n1. First\n2. Second' } },
  };
  const heavy = newPresetTextElement({ id: 'th1', x: x0(2) + 120, y: 120, preset: 'heading', markdown: 'A text heavy slide with a rather long heading that has to wrap onto a second line', width: 1600, frameHeight: 1080 });
  const body = newPresetTextElement({
    id: 'th2', x: x0(2) + 120, y: 360, preset: 'body', width: 1600, frameHeight: 1080,
    markdown: Array.from({ length: 8 }, (_, i) => `- Point ${i + 1}: the quick brown fox jumps over the lazy dog while the customers wait for the page to load on a slow mobile connection`).join('\n'),
  });
  const cls = (id, x, y, name) => ({ id, type: 'class', packId: 'uml-class', x, y, size: { width: 240, height: 140 }, label: name, layerId: 'default', properties: {}, parentFrameId: 'm3', data: {} });
  const elements = [
    ...frames, tableEl, docEl, docFull, { ...heavy, parentFrameId: 'm2' }, { ...body, parentFrameId: 'm2' },
    cls('u1', x0(3) + 200, 300, 'Order'), cls('u2', x0(3) + 800, 300, 'Payment'), cls('u3', x0(3) + 1400, 300, 'Customer'),
    newPresetTextElement({ id: 'ut', x: x0(3) + 120, y: 100, preset: 'heading', markdown: 'Domain model', width: 1200, frameHeight: 1080 }),
  ];
  const connections = [
    { id: 'k1', sourceId: 'u1', targetId: 'u2', lineStyle: 'straight', label: 'pays with' },
    { id: 'k2', sourceId: 'u3', targetId: 'u1', lineStyle: 'step' },
  ];
  const presentations = [{
    id: 'pres-mixed', title: 'Mixed: table, doc, text & UML', aspect: '16:9',
    slides: [
      ...frames.map((f, i) => ({ id: `ms-${i}`, frameId: f.id, notes: i === 3 ? 'Walk through the model.' : '', hidden: false })),
      { id: 'ms-hidden', frameId: 'm0', notes: 'hidden copy', hidden: true },
      { id: 'ms-missing', frameId: 'gone', notes: '', hidden: false },
    ],
  }];
  return { content: { elements: [...elements.map((e) => (e.id === 'ut' ? { ...e, parentFrameId: 'm3' } : e))], connections, layers: [], groups: [], presentations }, presentationId: 'pres-mixed' };
}

module.exports = { demoDeck, mixedDeck };

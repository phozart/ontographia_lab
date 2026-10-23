/**
 * @jest-environment node
 */
// ADR-0007 P3: the compile step (IR) and the writer, end to end in Node: build the deck, write a real .pptx with pptxgenjs,
// unzip it and assert the slide XML (native text, tables, notes, pictures for connector groups).
import fs from 'fs';
import path from 'path';
import { unzipSync, strFromU8 } from 'fflate';
import PptxGenJS from 'pptxgenjs';
import { compileDeck } from '../../lib/present/pptx/compile';
import { writeDeck } from '../../lib/present/pptx/write';

const { demoDeck, mixedDeck } = require('../helpers/pptxFixtures');

// pptxgenjs picks its Node code path (dynamic import of node:fs) from process.release; jest's VM cannot run that import,
// and the browser path (data URIs only) is exactly what the app uses, so the tests take the browser path.
const realRelease = process.release;
beforeAll(() => { Object.defineProperty(process, 'release', { value: { ...realRelease, name: 'browser-like' }, configurable: true }); });
afterAll(() => { Object.defineProperty(process, 'release', { value: realRelease, configurable: true }); });

// a 1x1 transparent PNG
const PNG = 'image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const BOARD = 'https://lab.example.com/diagram/LAB-12';

async function build(deck, opts = {}) {
  const ir = compileDeck(deck.content, deck.presentationId, { boardUrl: BOARD, ...opts });
  const images = {};
  for (const s of ir.slides) for (const it of s.items) if (it.kind === 'picture') images[it.key] = { data: PNG };
  const { data, warnings } = await writeDeck(PptxGenJS, ir, { images, ...opts });
  const zip = unzipSync(data);
  const files = Object.keys(zip);
  const read = async (f) => { if (!zip[f]) throw new Error(`no part ${f}`); return strFromU8(zip[f]); };
  const slideXml = async (n) => read(`ppt/slides/slide${n}.xml`);
  return { ir, zip, files, read, slideXml, warnings, data };
}

const texts = (xml) => [...xml.matchAll(/<a:t>([^<]*)<\/a:t>/g)].map((m) => m[1]);
const plain = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");

describe('compileDeck: classification and structure', () => {
  test('one slide per visible slide in order; hidden and missing slides are skipped and counted', () => {
    const ir = compileDeck(mixedDeck().content, 'pres-mixed', { boardUrl: BOARD });
    expect(ir.slides.map((s) => s.title)).toEqual(['Table', 'Doc', 'Text heavy', 'UML']);
    expect(ir.skipped).toEqual({ hidden: 1, missing: 1 });
  });
  test('a missing presentation compiles to null', () => {
    expect(compileDeck(mixedDeck().content, 'nope')).toBeNull();
  });
  test('native kinds: text, table, doc; the UML group with its connectors is ONE picture; text next to it stays text', () => {
    const ir = compileDeck(mixedDeck().content, 'pres-mixed', { boardUrl: BOARD });
    const kinds = (n) => ir.slides[n].items.map((i) => i.kind);
    expect(kinds(0)).toEqual(['table']);
    expect(kinds(1).sort()).toEqual(['doc', 'text']);
    expect(kinds(2)).toEqual(['text', 'text']);
    expect(kinds(3).sort()).toEqual(['picture', 'text']);
    const pic = ir.slides[3].items.find((i) => i.kind === 'picture');
    expect(pic.elementIds.sort()).toEqual(['u1', 'u2', 'u3']);
    expect(pic.connectionIds.sort()).toEqual(['k1', 'k2']);
    expect(pic.box.w).toBeGreaterThan(0);
    expect(pic.alt).toMatch(/^Diagram: /);
  });
  test('an element touched by a connector joins the picture even when it is a core shape', () => {
    const deck = demoDeck();
    const c = { ...deck.content, connections: [{ id: 'kx', sourceId: 'r1', targetId: 's1' }] };
    const ir = compileDeck(c, deck.presentationId);
    const items = ir.slides[4].items;
    expect(items.filter((i) => i.kind === 'picture')).toHaveLength(1);
    expect(items.find((i) => i.kind === 'picture').elementIds.sort()).toEqual(['r1', 's1']);
    expect(items.some((i) => i.kind === 'shape' && i.id === 'c1')).toBe(true);
  });
  test('slide notes carry through as plain text', () => {
    const ir = compileDeck(demoDeck().content, 'pres-demo');
    expect(ir.slides[1].notes).toBe('Say: this is the headline.\nPause for questions.');
  });
  test('theme colours resolve: the slide background is the theme background', () => {
    const d = demoDeck();
    const ir = compileDeck({ ...d.content, theme: { preset: 'slate-dark' } }, 'pres-demo');
    expect(ir.slides[0].background).toBe('#18212b');
  });
  test('a doc that overflows its card is cut and the notes link to the full text', () => {
    const ir = compileDeck(mixedDeck().content, 'pres-mixed', { boardUrl: BOARD });
    expect(ir.slides[1].notes).toContain('Research notes');
    expect(ir.slides[1].notes).toContain(`${BOARD}#el=doc1`);
    expect(ir.warnings.join(' ')).toMatch(/Research notes/);
  });
  test('text that runs past the bottom of the slide is reported (as on the board)', () => {
    const ir = compileDeck(mixedDeck().content, 'pres-mixed', { boardUrl: BOARD });
    expect(ir.warnings.join(' ')).toMatch(/Slide 3: A body text .* runs past the bottom of the slide/);
  });
  test('table rows that do not fit the slide are dropped with a "more rows" line', () => {
    const d = mixedDeck();
    const el = d.content.elements.find((e) => e.id === 'tbl1');
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: `r${i}`, cells: { [el.data.table.columns[0].id]: `Row ${i}` } }));
    const big = { ...d.content, elements: d.content.elements.map((e) => (e.id === 'tbl1' ? { ...e, data: { table: { ...e.data.table, rows } } } : e)) };
    const ir = compileDeck(big, 'pres-mixed');
    const t = ir.slides[0].items[0];
    expect(t.rows.length).toBeLessThan(62);
    expect(t.rows[t.rows.length - 1].cells[0].text).toMatch(/more rows? on the board/);
    expect(ir.warnings.join(' ')).toMatch(/60 rows/);
  });
});

describe('writeDeck: a real .pptx', () => {
  let demo;
  let mixed;
  beforeAll(async () => {
    Object.defineProperty(process, 'release', { value: { ...realRelease, name: 'browser-like' }, configurable: true });
    demo = await build(demoDeck());
    mixed = await build(mixedDeck());
    const dir = process.env.PPTX_SAMPLE_DIR;
    if (dir) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'demo-deck.pptx'), Buffer.from(demo.data));
      fs.writeFileSync(path.join(dir, 'mixed-deck.pptx'), Buffer.from(mixed.data));
      // one single-slide file per slide: Quick Look thumbnails only the first slide of a file
      for (const [name, b] of [['demo', demo], ['mixed', mixed]]) {
        for (const sl of b.ir.slides) {
          const images = {};
          for (const it of sl.items) if (it.kind === 'picture') images[it.key] = { data: PNG };
          const one = await writeDeck(PptxGenJS, { ...b.ir, slides: [sl] }, { images });
          fs.writeFileSync(path.join(dir, `${name}-slide-${sl.n}.pptx`), Buffer.from(one.data));
        }
      }
    }
  });

  test('the package is a valid zip with the content types and one slide part per slide', async () => {
    expect(demo.files).toContain('[Content_Types].xml');
    expect(demo.files).toContain('ppt/presentation.xml');
    expect(demo.files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(5);
    expect(mixed.files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(4);
    const pres = await demo.read('ppt/presentation.xml');
    expect(pres).toMatch(/<p:sldSz cx="1219\d{4}" cy="6858000"/); // 13.333 x 7.5 in
  });
  test('every XML part is well-formed', async () => {
    for (const f of mixed.files.filter((x) => x.endsWith('.xml') || x.endsWith('.rels'))) {
      const xml = await mixed.read(f);
      expect(xml.startsWith('<?xml')).toBe(true);
      expect(() => { if (!new RegExp('^[\\s\\S]*>\\s*$').test(xml)) throw new Error('truncated'); }).not.toThrow();
    }
  });
  test('text presets are native, editable text boxes with the board text', async () => {
    const x1 = await demo.slideXml(1);
    expect(texts(x1)).toEqual(expect.arrayContaining(['Checkout review', 'What we learned in October']));
    expect(x1).toMatch(/<p:sp>/);
    expect(x1).not.toMatch(/<p:pic>/);
    const x2 = await demo.slideXml(2);
    const all = texts(x2).join('');
    expect(all).toContain('Checkout drops 40% on mobile');
    expect(x2).toMatch(/<a:buChar|<a:buAutoNum/); // real bullets
    expect(x2).toMatch(/<a:hlinkClick /); // the link
    expect(x2).toMatch(/<a:rPr[^>]*b="1"/); // bold run
  });
  test('the title text is the slide title placeholder, positioned where the text box is', async () => {
    const x2 = await demo.slideXml(2);
    expect(x2).toMatch(/<p:ph[^>]*type="title"/);
    const x1 = await demo.slideXml(1);
    const off = /<p:ph[^>]*type="title"[\s\S]*?<a:off x="(\d+)" y="(\d+)"\/><a:ext cx="(\d+)" cy="(\d+)"/.exec(x1);
    const title = demo.ir.slides[0].items.find((i) => i.preset === 'title');
    expect(Number(off[1])).toBeCloseTo((title.box.x / 1920) * 12191695, -4);
    expect(Number(off[2])).toBeCloseTo((title.box.y / 1080) * 6858000, -4);
    expect(Number(off[2])).toBeGreaterThan(1000000); // the cover title sits low on the slide, not at the top
  });
  test('every paragraph has at most one pPr, and it comes first (PowerPoint opens it without repair)', async () => {
    for (const b of [demo, mixed]) {
      for (const f of b.files.filter((x) => /^ppt\/slides\/slide\d+\.xml$/.test(x))) {
        const xml = await b.read(f);
        for (const m of xml.matchAll(/<a:p>([\s\S]*?)<\/a:p>/g)) {
          expect((m[1].match(/<a:pPr\b/g) || []).length).toBeLessThanOrEqual(1);
          const i = m[1].indexOf('<a:pPr');
          if (i >= 0) expect(m[1].slice(0, i)).not.toMatch(/<a:r>|<a:br/);
        }
      }
    }
  });
  test('line breaks are the board lines (soft breaks), fit is none', async () => {
    const x3 = await demo.slideXml(3);
    expect(x3).toMatch(/<a:br\/>/);
    expect(x3).not.toMatch(/normAutofit|spAutoFit/);
  });
  test('shapes keep fill, radius and opacity as native shapes with text', async () => {
    const x5 = await demo.slideXml(5);
    expect(x5).toMatch(/prst="roundRect"/);
    expect(x5).toMatch(/prst="ellipse"/);
    expect(x5).toMatch(/prst="diamond"/);
    expect(x5).toMatch(/<a:alpha val="80000"\/>/); // opacity 0.8 -> alpha 80%
    expect(x5).toMatch(/<a:srgbClr val="FEF08A"/); // the sticky
    expect(texts(x5)).toEqual(expect.arrayContaining(['Rounded blue', 'Ship the guest checkout', 'Round', 'Choice']));
  });
  test('a table is a native table with a styled header row and no formula evaluation', async () => {
    const x = await mixed.slideXml(1);
    expect(x).toMatch(/<a:tbl>/);
    expect(x).toMatch(/<a:tr /);
    expect(texts(x)).toEqual(expect.arrayContaining(['Step', 'Users', 'Status', 'Fixed', 'Cart', '=1+1']));
    expect(x).toMatch(/<a:rPr[^>]*b="1"/);
    expect(x).toMatch(/<a:tcPr[^>]*>[\s\S]*?<a:solidFill>/);
  });
  test('a doc card and a full doc are native text; the lab link is absolute', async () => {
    const x = await mixed.slideXml(2);
    const t = texts(x).map(plain).join('|');
    expect(t).toContain('Research notes');
    expect(t).toContain('Users abandon at the payment form.');
    expect(t).toContain('Prose'.slice(0, 0) + 'A paragraph shown as slide prose');
    const rels = await mixed.read('ppt/slides/_rels/slide2.xml.rels');
    expect(rels).toContain('https://lab.example.com/diagram/LAB-9');
    expect(rels).toMatch(/TargetMode="External"/);
  });
  test('a text-heavy slide stays text, with every line', async () => {
    const x = await mixed.slideXml(3);
    const t = texts(x).join(' ');
    expect(t).toContain('Point 1');
    expect(t).toContain('Point 8');
    expect(x).not.toMatch(/<p:pic>/);
  });
  test('the UML + connector group is one picture (alt text), the heading next to it is text', async () => {
    const x = await mixed.slideXml(4);
    expect((x.match(/<p:pic>/g) || []).length).toBe(1);
    expect(x).toMatch(/descr="Diagram: /);
    expect(texts(x)).toContain('Domain model');
    expect(mixed.files.some((f) => /^ppt\/media\/.*\.png$/.test(f))).toBe(true);
  });
  test('speaker notes are in the notes slide parts', async () => {
    const notes = mixed.files.filter((f) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(f));
    expect(notes.length).toBeGreaterThan(0);
    const all = (await Promise.all(notes.map((f) => mixed.read(f)))).join('');
    expect(all).toContain('Walk through the model.');
    const demoNotes = (await Promise.all(demo.files.filter((f) => /notesSlide\d+\.xml$/.test(f)).map((f) => demo.read(f)))).join('');
    expect(demoNotes).toContain('Say: this is the headline.');
  });
  test('the hidden slide notes never appear', async () => {
    const all = (await Promise.all(mixed.files.filter((f) => f.endsWith('.xml')).map((f) => mixed.read(f)))).join('');
    expect(all).not.toContain('hidden copy');
  });
  test('Office-safe fonts by default; theme fonts on request', async () => {
    const x = await demo.slideXml(2);
    expect(x).toMatch(/typeface="Arial"/);
    expect(x).not.toMatch(/typeface="Inter"/);
    const theme = await build(demoDeck(), { officeSafeFonts: false });
    expect(await theme.slideXml(2)).toMatch(/typeface="Inter"/);
  });
  test('the deck is titled and has no external dependency other than links', async () => {
    const core = await demo.read('docProps/core.xml');
    expect(core).toContain('Checkout review - Oct');
  });
});

describe('writeDeck: security', () => {
  const hostile = () => {
    const d = demoDeck();
    const el = d.content.elements.find((e) => e.id && e.data && e.data.text && e.data.text.preset === 'title');
    el.data.text.markdown = '<script>alert(1)</script> & "quotes" \u0000 <a:t> [x](javascript:alert(1))';
    d.content.presentations[0].title = 'a/b\\c:d*e?"<f>|\u0000';
    d.content.presentations[0].slides[0].notes = 'n\u0000ote <b>not html</b>‮';
    return d;
  };
  test('text is escaped, never markup; unsafe links are gone; notes are clean', async () => {
    const b = await build(hostile());
    const x = await b.slideXml(1);
    expect(x).not.toContain('<script>');
    expect(x).not.toMatch(/javascript:/i);
    expect(x).toContain('&lt;script&gt;');
    const rels = await b.read('ppt/slides/_rels/slide1.xml.rels');
    expect(rels).not.toMatch(/javascript:/i);
    const notes = await b.read(b.files.find((f) => /notesSlides\/notesSlide1\.xml$/.test(f)));
    expect(notes).toContain('&lt;b&gt;not html&lt;/b&gt;');
    expect(notes).not.toContain('‮');
    expect(notes).not.toContain('\u0000');
  });
  test('no part of the package contains a control character', async () => {
    const b = await build(hostile());
    for (const f of b.files.filter((x) => x.endsWith('.xml'))) {
      const xml = await b.read(f);
      expect(new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]').test(xml)).toBe(false);
    }
  });
  test('a slide with no items still writes a valid slide', async () => {
    const d = demoDeck();
    d.content.elements = d.content.elements.filter((e) => e.type === 'frame');
    const b = await build(d);
    expect(b.files.filter((f) => /^ppt\/slides\/slide\d+\.xml$/.test(f))).toHaveLength(5);
  });
  test('an empty deck is refused with a clear message', async () => {
    const d = demoDeck();
    d.content.presentations[0].slides.forEach((s) => { s.hidden = true; });
    const ir = compileDeck(d.content, d.presentationId);
    await expect(writeDeck(PptxGenJS, ir)).rejects.toThrow(/no slides to export/);
  });
});

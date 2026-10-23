// lib/present/pptx/write.js
// The PPTX writer (ADR-0007 section 8.3, slice P3): slide IR -> a .pptx through pptxgenjs. The library is INJECTED
// (`PptxGenJS` is a parameter), so this file never imports it: the browser loads it with a dynamic import on export only
// (its own chunk), and the unit tests pass the real package. Pure otherwise: no DOM, no network, no I/O.
//
// Everything user-authored goes in as TEXT (pptxgenjs escapes it into the XML; there is no HTML path), colours are
// re-emitted as RRGGBB, hyperlinks were already allow-listed by textRuns.js, fonts come from the closed theme list.

import { slideInches, unitScale, toInch, toPt, lineSpacing, hex6, fontFaceFor, xmlSafe } from './mapping';
import { LIST_INDENT } from './textRuns';
import { fixPackage } from './package';

const DEFAULT_BORDER_PT = 0.75;
const WIDTH_SLACK = 0.04; // text boxes are 4% wider than the board's (Arial vs the board font), so a pre-broken line does not wrap again
const HEIGHT_SLACK = 1.08;

const px = (v) => (Number.isFinite(v) ? v : 0);

function fitFor(frame, slide) {
  // one PPTX has one slide size: a slide of another shape is scaled to fit and centred
  const k = Math.min(slide.width / frame.width, slide.height / frame.height);
  return { k, offX: (slide.width - frame.width * k) / 2, offY: (slide.height - frame.height * k) / 2 };
}

function runOptions(run, base, fonts, k) {
  const o = { fontFace: run.code ? fonts.mono : base.fontFace, fontSize: base.fontSize, color: base.color };
  if (base.bold || run.bold) o.bold = true;
  if (base.italic || run.italic) o.italic = true;
  if (run.strike) o.strike = 'sngStrike';
  if (run.link) o.hyperlink = { url: run.link };
  if (run.breakBefore) o.softBreakBefore = true;
  return o;
}

/** IR paragraphs -> pptxgenjs text objects (one `breakLine` per paragraph). */
function paragraphObjects(paragraphs, base, fonts, k, align) {
  const out = [];
  paragraphs.forEach((p, pi) => {
    const sizePt = toPt(base.unitSize * (p.scale || 1), k);
    const baseP = { ...base, fontSize: sizePt, italic: base.italic || p.quote === true, bold: base.bold || p.scale > 1 };
    const level = p.bullet && p.indent > 0 ? Math.max(0, Math.round(p.indent / (LIST_INDENT * base.unitSize)) - 1) : 0;
    const hang = toPt(LIST_INDENT * base.unitSize, k);
    const paraOpts = { align, lineSpacingMultiple: base.lineSpacing };
    if (p.spaceBefore > 0) paraOpts.paraSpaceBefore = Math.round(toPt(p.spaceBefore, k) * 10) / 10;
    if (p.bullet) {
      paraOpts.bullet = p.bullet.kind === 'number'
        ? { type: 'number', indent: hang, ...(p.bullet.start ? { numberStartAt: p.bullet.start } : {}) }
        : { indent: hang };
      if (level > 0) paraOpts.indentLevel = level;
    }
    const runs = p.runs.length ? p.runs : [{ text: '' }];
    runs.forEach((r, ri) => {
      const opts = { ...runOptions(r, baseP, fonts, k), ...(ri === 0 ? paraOpts : {}) };
      if (ri === runs.length - 1 && pi < paragraphs.length - 1) opts.breakLine = true;
      out.push({ text: xmlSafe(r.text), options: opts });
    });
  });
  return out;
}

function lineObjects(lines, base) {
  return lines.map((t, i) => ({ text: xmlSafe(t), options: { ...base, ...(i > 0 ? { softBreakBefore: true } : {}) } }));
}

const SHAPES = (pres) => ({ rect: pres.ShapeType.rect, roundRect: pres.ShapeType.roundRect, ellipse: pres.ShapeType.ellipse, diamond: pres.ShapeType.diamond });

function boxOf(it, fit) {
  return { x: toInch(px(it.box.x), fit.k) + fit.offX, y: toInch(px(it.box.y), fit.k) + fit.offY, w: toInch(px(it.box.w), fit.k), h: toInch(px(it.box.h), fit.k) };
}

/** Position and body properties of a text box (also the geometry of the title placeholder, which pptxgenjs takes from the master). */
function textBoxOpts(it, fit) {
  const b = boxOf(it, fit);
  const slack = b.w * WIDTH_SLACK;
  const x = it.align === 'center' ? b.x - slack / 2 : it.align === 'right' ? b.x - slack : b.x;
  return {
    x, y: b.y, w: b.w + slack, h: b.h || 0.3, margin: 0, fit: 'none', valign: it.valign === 'middle' ? 'middle' : it.valign === 'bottom' ? 'bottom' : 'top',
  };
}

function writeText(pres, slide, it, fit, ctx) {
  const b = boxOf(it, fit);
  const base = {
    fontFace: ctx.face(it.fontId), color: hex6(it.color) || '000000', bold: it.bold, italic: it.italic, unitSize: it.fontSize,
    lineSpacing: lineSpacing(it.lineHeight), fontSize: toPt(it.fontSize, fit.k),
  };
  const opts = { ...textBoxOpts(it, fit), objectName: it.preset === 'doc' ? 'Doc text' : `Text ${it.preset || ''}`.trim() };
  const align = it.align === 'center' ? 'center' : it.align === 'right' ? 'right' : 'left';
  const runs = paragraphObjects(it.paragraphs, base, ctx.fonts, fit.k, align);
  if (ctx.titlePlaceholder === it) slide.addText(runs, { placeholder: 'title', objectName: 'Title' });
  else slide.addText(runs, opts);
  return b;
}

function writeShape(pres, slide, it, fit, ctx) {
  const b = boxOf(it, fit);
  const types = SHAPES(pres);
  const shapeType = it.shape === 'rect' && it.radius > 0 ? types.roundRect : types[it.shape] || types.rect;
  const common = { x: b.x, y: b.y, w: b.w, h: b.h, objectName: `Shape ${it.name || ''}`.trim() };
  if (it.fill) common.fill = { color: hex6(it.fill) || 'FFFFFF', ...(it.transparency > 0 ? { transparency: it.transparency } : {}) };
  else common.fill = { type: 'none' };
  common.line = it.line ? { color: hex6(it.line.color) || '64748B', width: Math.max(0.25, toPt(it.line.width, fit.k)) } : { type: 'none' };
  if (shapeType === types.roundRect) common.rectRadius = Math.max(0, Math.min(toInch(it.radius, fit.k), Math.min(b.w, b.h) / 2));
  if (!it.text || !it.text.lines.length) {
    slide.addShape(shapeType, common);
    return;
  }
  const t = it.text;
  const sizePt = toPt(t.fontSize, fit.k);
  const inset = it.shape === 'rect' ? t.inset : { l: 0, t: 0, r: 0, b: 0 };
  const run = { fontFace: ctx.face(t.fontId), fontSize: sizePt, color: hex6(t.color) || '000000', bold: t.bold, italic: t.italic };
  slide.addText(lineObjects(t.lines, run), {
    ...common, shape: shapeType, align: t.align, valign: t.valign, fit: 'none',
    margin: [inset.t, inset.r, inset.b, inset.l].map((v) => Math.round(toPt(v, fit.k) * 10) / 10),
    lineSpacingMultiple: 1,
  });
}

function writeDoc(pres, slide, it, fit, ctx) {
  const b = boxOf(it, fit);
  const types = SHAPES(pres);
  const base = { fontFace: ctx.face(it.fontId), color: hex6(it.color) || '334155', bold: false, italic: false, unitSize: it.fontSize, lineSpacing: lineSpacing(1.5), fontSize: toPt(it.fontSize, fit.k) };
  const title = { text: xmlSafe(it.title), options: { fontFace: base.fontFace, fontSize: toPt(it.titleSize, fit.k), bold: true, color: hex6(it.titleColor) || '0F172A', breakLine: it.paragraphs.length > 0, paraSpaceAfter: Math.round(toPt(10, fit.k) * 10) / 10 } };
  const body = paragraphObjects(it.paragraphs, base, ctx.fonts, fit.k, 'left');
  const pad = Math.round(toPt(it.pad, fit.k) * 10) / 10;
  slide.addText([title, ...body], {
    x: b.x, y: b.y, w: b.w, h: b.h, shape: types.roundRect, rectRadius: Math.min(toInch(10, fit.k), Math.min(b.w, b.h) / 2),
    fill: { color: hex6(it.fill) || 'FFFFFF' }, line: { color: hex6(it.line.color) || 'CBD5E1', width: Math.max(0.25, toPt(it.line.width, fit.k)) },
    margin: [pad, pad, pad, pad], valign: 'top', align: 'left', fit: 'none', objectName: 'Doc card',
  });
}

function writeTable(pres, slide, it, fit, ctx) {
  const b = boxOf(it, fit);
  const fontFace = ctx.face(it.fontId);
  const sizePt = Math.max(6, toPt(it.fontSize, fit.k));
  const border = { type: 'solid', pt: DEFAULT_BORDER_PT, color: hex6(it.border) || 'CBD5E1' };
  const rows = it.rows.map((r) => r.cells.map((c) => ({
    text: xmlSafe(c.text),
    options: {
      fontFace, fontSize: sizePt, bold: !!c.bold, color: hex6(c.color) || '000000', align: c.align || 'left', valign: 'middle', border,
      ...(c.fill ? { fill: { color: hex6(c.fill) || 'FFFFFF' } } : {}),
      ...(c.colSpan > 1 ? { colspan: c.colSpan } : {}),
      margin: [3, 6, 3, 6],
    },
  })));
  slide.addTable(rows, {
    x: b.x, y: b.y, w: toInch(it.colWidths.reduce((a, c) => a + c, 0), fit.k),
    colW: it.colWidths.map((w) => toInch(w, fit.k)), rowH: it.rows.map((r) => toInch(r.height, fit.k)),
    fontFace, fontSize: sizePt, border, autoPage: false, objectName: 'Table',
  });
}

/**
 * @param {Function} PptxGenJS the pptxgenjs constructor (injected)
 * @param {object} ir the result of compileDeck
 * @param {{images?: Record<string, {data: string}>, officeSafeFonts?: boolean}} [o]
 *   images: captured PNGs by picture key, as 'image/png;base64,....'
 * @returns {Promise<{data: Uint8Array, warnings: string[]}>} the .pptx bytes
 */
export async function writeDeck(PptxGenJS, ir, o = {}) {
  const officeSafe = o.officeSafeFonts !== false;
  const images = o.images || {};
  const warnings = [];
  if (!ir.slides.length) throw new Error('There are no slides to export. Add slides, or show hidden ones.');
  const pres = new PptxGenJS();
  const first = ir.slides[0].frame;
  const slideSize = slideInches(first.width, first.height);
  pres.defineLayout({ name: 'ONTOGRAPHIA', width: slideSize.width, height: slideSize.height });
  pres.layout = 'ONTOGRAPHIA';
  pres.title = xmlSafe(ir.title);
  pres.author = 'Ontographia Lab';
  pres.company = 'Ontographia Lab';
  // list numbers use the theme's major font (+mj-lt): make it the deck's body font, not PowerPoint's default
  pres.theme = { headFontFace: fontFaceFor(ir.theme.fonts.heading, { officeSafe }), bodyFontFace: fontFaceFor(ir.theme.fonts.body, { officeSafe }) };
  const fonts = { mono: fontFaceFor('ibm-plex-mono', { officeSafe }) };
  const ctx = { fonts, face: (id) => fontFaceFor(id, { officeSafe }) };
  const mismatched = ir.slides.some((s) => Math.abs(s.frame.width / s.frame.height - first.width / first.height) > 0.01);
  if (mismatched) warnings.push('The slides have different shapes; PowerPoint has one slide size, so the others are scaled to fit and centred.');

  for (const s of ir.slides) {
    const fit = fitFor(s.frame, slideSize);
    // the slide title (outline view, accessibility): the first title (else heading) text becomes the title placeholder. pptxgenjs
    // takes a placeholder's geometry from its master, so each titled slide gets a master whose title sits where the text box is.
    const titleItem = s.items.find((x) => x.kind === 'text' && x.preset === 'title') || s.items.find((x) => x.kind === 'text' && x.preset === 'heading') || null;
    let slide;
    if (titleItem) {
      const master = `LAB_SLIDE_${s.n}`;
      pres.defineSlideMaster({ title: master, objects: [{ placeholder: { options: { name: 'title', type: 'title', ...textBoxOpts(titleItem, fit) }, text: '' } }] });
      slide = pres.addSlide({ masterName: master });
    } else slide = pres.addSlide();
    slide.background = { color: hex6(s.background) || 'FFFFFF' };
    const c = { ...ctx, titlePlaceholder: titleItem };
    for (const it of s.items) {
      if (it.kind === 'text') writeText(pres, slide, it, fit, c);
      else if (it.kind === 'shape') writeShape(pres, slide, it, fit, c);
      else if (it.kind === 'doc') writeDoc(pres, slide, it, fit, c);
      else if (it.kind === 'table') writeTable(pres, slide, it, fit, c);
      else if (it.kind === 'line') {
        const b = boxOf(it, fit);
        slide.addShape(pres.ShapeType.line, { x: b.x, y: b.y, w: b.w, h: 0, line: { color: hex6(it.color) || '64748B', width: Math.max(0.25, toPt(it.width, fit.k)) } });
      } else if (it.kind === 'picture') {
        const img = images[it.key];
        if (!img || typeof img.data !== 'string') {
          warnings.push(`Slide ${s.n}: a diagram image was not captured and is left out`);
          continue;
        }
        const b = boxOf(it, fit);
        slide.addImage({ data: img.data, x: b.x, y: b.y, w: b.w, h: b.h, altText: xmlSafe(it.alt) });
      }
    }
    if (s.notes) slide.addNotes(xmlSafe(s.notes));
  }
  const bytes = await pres.write({ outputType: 'uint8array', compression: true });
  const data = fixPackage(bytes);
  return { data, warnings };
}

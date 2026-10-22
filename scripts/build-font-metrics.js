#!/usr/bin/env node
// scripts/build-font-metrics.js
// Generates lib/text/metrics/inter.json from the self-hosted Inter woff2 files (ADR-0008 3.2).
//
//   node scripts/build-font-metrics.js          write the tables
//   node scripts/build-font-metrics.js --check  exit 1 if the committed tables do not match the font files
//
// How: headless Chrome (puppeteer, a dev dependency) loads each woff2 as a FontFace and measures every candidate
// codepoint at 1000 px with canvas measureText; the advance (in 1/1000 em) goes into the table. The glyphs the font really has come from
// its cmap table (parsed from the woff2), so system fallback glyphs never leak into the table. It also calibrates the width classes for scripts the table does not cover (CJK,
// Hangul, emoji, Arabic ...) from the system fallback font, keeping the larger of the measured value and a floor.
// The output is deterministic for the same fonts and Chrome; the JSON carries the sha1 of the font files, and
// __tests__/lib/textMetrics.test.js fails when a font file changes without regenerating.

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'public', 'fonts');
const OUT = path.join(ROOT, 'lib', 'text', 'metrics', 'inter.json');
const WEIGHTS = [400, 500, 600, 700];
const SUBSETS = ['latin', 'latin-ext'];
// Candidate codepoints (the table keeps those the font really has).
const RANGES = [
  [0x20, 0x7e], [0xa0, 0x24f], [0x2b0, 0x2ff], [0x1e00, 0x1eff], [0x2010, 0x205e], [0x2070, 0x209f], [0x20a0, 0x20c0],
  [0x2100, 0x214f], [0x2150, 0x218f], [0x2190, 0x21ff], [0x2200, 0x22ff], [0x2300, 0x23ff], [0x25a0, 0x25ff], [0x2600, 0x26ff], [0xfb00, 0xfb06],
];
// Floors for the fallback classes in 1/1000 em (measured values below them are raised to them: roomy is the safe error).
const FLOORS = { cjk: 1000, hangul: 1000, emoji: 1150, arabic: 560, hebrew: 580, thai: 560, indic: 700, other: 620 };
const SAMPLES = {
  cjk: '顧客満足度分析サービス一二三四五六七八九十あいうえおアイウエオ',
  hangul: '고객만족도분석서비스한국어',
  emoji: ['🚀', '✅', '😀', '👍', '🎉', '❤️', '🔥', '⭐'],
  arabic: 'تحليل رضا العملاء خدمة الطلبات',
  hebrew: 'ניתוח שביעות רצון לקוחות',
  thai: 'การวิเคราะห์ความพึงพอใจ',
  indic: 'ग्राहक संतुष्टि विश्लेषण',
  other: 'Анализ удовлетворённости клиентов Ελληνικά',
};

function sha1(files) {
  const h = crypto.createHash('sha1');
  for (const f of files) h.update(fs.readFileSync(f));
  return h.digest('hex');
}


// ---- woff2 cmap coverage: which codepoints the font really has (no guessing from measurements) ----
function readBase128(buf, pos) {
  let v = 0;
  for (let i = 0; i < 5; i++) {
    const b = buf[pos.o++];
    v = (v << 7) | (b & 0x7f);
    if (!(b & 0x80)) return v >>> 0;
  }
  throw new Error('bad UIntBase128');
}
function woff2Cmap(file) {
  const zlib = require('zlib');
  const buf = fs.readFileSync(file);
  if (buf.toString('latin1', 0, 4) !== 'wOF2') throw new Error(`${file} is not woff2`);
  const numTables = buf.readUInt16BE(12);
  const totalCompressed = buf.readUInt32BE(20);
  const pos = { o: 48 };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = buf[pos.o++];
    const idx = flags & 0x3f;
    const ver = flags >> 6;
    if (idx === 63) pos.o += 4;
    const origLength = readBase128(buf, pos);
    const isGlyfLoca = idx === 10 || idx === 11;
    const transformed = isGlyfLoca ? ver === 0 : ver !== 0;
    const length = transformed ? readBase128(buf, pos) : origLength;
    tables.push({ idx, length });
  }
  const data = zlib.brotliDecompressSync(buf.subarray(pos.o, pos.o + totalCompressed));
  let off = 0;
  let cmap = null;
  for (const t of tables) {
    if (t.idx === 0) cmap = data.subarray(off, off + t.length);
    off += t.length;
  }
  if (!cmap) throw new Error('no cmap');
  const covered = new Set();
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const sub = cmap.readUInt32BE(4 + i * 8 + 4);
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(sub + 6);
      const seg = segX2 / 2;
      const endO = sub + 14;
      const startO = endO + segX2 + 2;
      const deltaO = startO + segX2;
      const rangeO = deltaO + segX2;
      for (let k = 0; k < seg; k++) {
        const end = cmap.readUInt16BE(endO + k * 2);
        const start = cmap.readUInt16BE(startO + k * 2);
        const delta = cmap.readInt16BE(deltaO + k * 2);
        const ro = cmap.readUInt16BE(rangeO + k * 2);
        for (let c = start; c <= end && c < 0xffff; c++) {
          let g;
          if (ro === 0) g = (c + delta) & 0xffff;
          else {
            const gi = rangeO + k * 2 + ro + (c - start) * 2;
            g = gi + 1 < cmap.length ? cmap.readUInt16BE(gi) : 0;
            if (g) g = (g + delta) & 0xffff;
          }
          if (g) covered.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let k = 0; k < groups; k++) {
        const o = sub + 16 + k * 12;
        const a = cmap.readUInt32BE(o);
        const b = cmap.readUInt32BE(o + 4);
        const g0 = cmap.readUInt32BE(o + 8);
        for (let c = a; c <= b; c++) if (g0 + (c - a) > 0) covered.add(c);
      }
    }
  }
  return covered;
}

const fontFiles = (w) => SUBSETS.map((s) => path.join(FONT_DIR, `inter-${s}-${w}-normal.woff2`));

async function generate() {
  const puppeteer = require('puppeteer');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=en-US'] });
  try {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    const faces = {};
    for (const w of WEIGHTS) {
      const data = SUBSETS.map((s) => fs.readFileSync(path.join(FONT_DIR, `inter-${s}-${w}-normal.woff2`)).toString('base64'));
      const coverage = SUBSETS.map((sub) => [...woff2Cmap(path.join(FONT_DIR, `inter-${sub}-${w}-normal.woff2`))].filter((cp) => RANGES.some(([a, b]) => cp >= a && cp <= b)));
      const res = await page.evaluate(async (weight, b64s, covers) => {
        const names = [];
        for (let i = 0; i < b64s.length; i++) {
          const name = `InterGen${weight}_${i}`;
          const face = new FontFace(name, `url(data:font/woff2;base64,${b64s[i]})`, { weight: String(weight) });
          await face.load();
          document.fonts.add(face);
          names.push(name);
        }
        const ctx = document.createElement('canvas').getContext('2d');
        const adv = new Map();
        covers.forEach((list, i) => {
          ctx.font = `${weight} 1000px "${names[i]}"`;
          for (const cp of list) if (!adv.has(cp)) adv.set(cp, Math.round(ctx.measureText(String.fromCodePoint(cp)).width));
        });
        ctx.font = `${weight} 1000px "${names[0]}"`;
        const m = ctx.measureText('Hx');
        const cap = ctx.measureText('H');
        return {
          adv: [...adv.entries()],
          ascender: Math.round(m.fontBoundingBoxAscent),
          descender: Math.round(m.fontBoundingBoxDescent),
          capHeight: Math.round(cap.actualBoundingBoxAscent),
        };
      }, w, data, coverage);
      // run-length encode: [[startCodepoint, [advances...]], ...]
      const runs = [];
      for (const [cp, a] of res.adv.sort((x, y) => x[0] - y[0])) {
        const last = runs[runs.length - 1];
        if (last && last[0] + last[1].length === cp) last[1].push(a);
        else runs.push([cp, [a]]);
      }
      faces[w] = { sha1: sha1(fontFiles(w)), ascender: res.ascender, descender: res.descender, capHeight: res.capHeight, ranges: runs };
    }

    // Fallback classes, measured with the production font stack (Inter first, then the system fallback).
    const fallback = await page.evaluate((samples, floors) => {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = '500 1000px "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
      const seg = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
      const out = {};
      for (const [k, s] of Object.entries(samples)) {
        const items = Array.isArray(s) ? s : [...seg.segment(s)].map((x) => x.segment).filter((g) => g.trim());
        let total = 0;
        for (const g of items) total += ctx.measureText(g).width;
        const measured = total / items.length;
        out[k] = Math.max(floors[k], Math.ceil(measured / 10) * 10);
      }
      return out;
    }, SAMPLES, FLOORS);

    const ua = await browser.version();
    return { family: 'Inter', unitsPerEm: 1000, generator: 1, chrome: ua, platform: process.platform, fallback, faces };
  } finally {
    await browser.close();
  }
}

function stable(tables) {
  // Compare everything except the volatile bits (Chrome version, platform, calibrated fallback) for --check.
  const copy = JSON.parse(JSON.stringify(tables));
  delete copy.chrome;
  delete copy.platform;
  delete copy.fallback;
  return copy;
}

async function main() {
  const check = process.argv.includes('--check');
  if (check) {
    const committed = JSON.parse(fs.readFileSync(OUT, 'utf8'));
    let bad = 0;
    for (const w of WEIGHTS) {
      if (committed.faces[w].sha1 !== sha1(fontFiles(w))) {
        console.error(`Inter ${w}: font files changed, regenerate with: node scripts/build-font-metrics.js`);
        bad++;
      }
    }
    process.exit(bad ? 1 : 0);
  }
  const tables = await generate();
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, `${JSON.stringify(tables)}\n`);
  const glyphs = Object.values(tables.faces).map((f) => f.ranges.reduce((n, r) => n + r[1].length, 0));
  console.log(`wrote ${path.relative(ROOT, OUT)} (${fs.statSync(OUT).size} bytes); glyphs per weight: ${glyphs.join(', ')}; fallback: ${JSON.stringify(tables.fallback)}`);
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
module.exports = { generate, stable, sha1, WEIGHTS };

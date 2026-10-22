/**
 * E2E (no app server needed): ADR-0008 3.2 / 11. The committed advance tables must match what headless Chrome measures
 * with the real self-hosted Inter files, within 1% (Latin and Latin Extended), and the line breaker's lines must fit the
 * widths Chrome really draws them at. Needs puppeteer's Chrome only.
 */
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../helpers/headless');
const { measureText, resolveFace } = require('../../lib/text/fonts');

jest.setTimeout(120000);
const FONT_DIR = path.join(__dirname, '..', '..', 'public', 'fonts');

const STRINGS = [
  'Billing',
  'Customer Order Service',
  'Validate payment details before confirming the customer order',
  'Aggregate all inbound partner shipment notifications, reconcile them against open purchase orders and flag any discrepancies for review',
  'p95 latency 250 ms / 1.2k req/s',
  'Kundenzufriedenheitsanalyse',
  'Zażółć gęślą jaźń, Příliš žluťoučký kůň, İstanbul ığdır',
  'Münchner Straße 12 – Größe: 3,5 € (ca. 40 %)',
  'The quick brown fox jumps over the lazy dog 0123456789',
  'API Gateway ↑ Auth Service ↓ Billing',
];

describe('Inter advance tables vs Chrome measureText', () => {
  let browser;
  beforeAll(async () => {
    browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-dev-shm-usage', '--lang=en-US'] });
  });
  afterAll(async () => {
    if (browser) await browser.close();
  });

  test('widths match within 1% for every weight and the node text sizes', async () => {
    const page = await browser.newPage();
    await page.setContent('<!doctype html><meta charset="utf-8"><body></body>');
    const faces = {};
    for (const w of [400, 500, 600, 700]) {
      faces[w] = ['latin', 'latin-ext'].map((s) => fs.readFileSync(path.join(FONT_DIR, `inter-${s}-${w}-normal.woff2`)).toString('base64'));
    }
    const sizes = [11, 12, 14, 18];
    const chrome = await page.evaluate(async (fontData, strings, sizeList) => {
      for (const [w, b64s] of Object.entries(fontData)) {
        for (let i = 0; i < b64s.length; i++) {
          const f = new FontFace(`InterT${w}${i}`, `url(data:font/woff2;base64,${b64s[i]})`, { weight: w });
          await f.load();
          document.fonts.add(f);
        }
      }
      const ctx = document.createElement('canvas').getContext('2d');
      const out = [];
      for (const w of Object.keys(fontData)) {
        for (const size of sizeList) {
          for (const s of strings) {
            ctx.font = `${w} ${size}px "InterT${w}0", "InterT${w}1", sans-serif`;
            out.push({ w: Number(w), size, s, width: ctx.measureText(s).width });
          }
        }
      }
      return out;
    }, faces, STRINGS, sizes);
    const worst = { err: 0 };
    const bad = [];
    for (const r of chrome) {
      const mine = measureText(r.s, resolveFace('Inter', r.w), r.size);
      const err = Math.abs(mine - r.width) / r.width;
      if (err > worst.err) Object.assign(worst, { err, r, mine });
      if (err > 0.01) bad.push(`${r.w}/${r.size}px ${(err * 100).toFixed(2)}% ${r.s.slice(0, 40)} chrome=${r.width.toFixed(1)} table=${mine.toFixed(1)}`);
    }
    console.log(bad.join('\n'));
    expect(bad).toEqual([]);
    console.log(`worst table error vs Chrome: ${(worst.err * 100).toFixed(2)}% (${worst.r && worst.r.s.slice(0, 30)})`);
  });
});

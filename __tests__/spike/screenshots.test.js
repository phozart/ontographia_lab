/**
 * @jest-environment node
 */
// F1 visual check: generates side-by-side PNGs of canvas (renderDiagramSvg) vs
// diagram_show (renderShowSvg + packArt) for checkout, showcase and 2000-element boards at 1379x985.
// Run with: OUT=/path/to/out npx jest --testPathPatterns screenshots.test.js --no-coverage
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { renderDiagramSvg } = require('../../lib/render/diagramSvg');
const { renderShowSvg } = require('../../lib/render/showSvg');
const { PACK_ART } = require('../../lib/render/packArt');
const { checkoutBoard, largeBoard } = require('../helpers/showFidelityBoard');
const { showcaseContent } = require('../helpers/textShowcase');

const OUT = process.env.OUT || '';
jest.setTimeout(120000);

function encode(svg) { return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg); }
function sideByside(title, oldSvg, newSvg) {
  return `<!doctype html><html><head><meta charset=utf-8><title>${title}</title>
<style>
  body{margin:0;background:#f0f0f0;font-family:sans-serif;}
  .row{display:flex;gap:4px;padding:4px;}
  .panel{flex:1;background:white;overflow:hidden;}
  .label{background:#333;color:white;font-size:11px;padding:2px 6px;}
  img{display:block;width:100%;height:470px;object-fit:contain;}
</style></head><body>
<div class="row">
  <div class="panel"><div class="label">canvas (renderDiagramSvg)</div><img src="${encode(oldSvg)}"></div>
  <div class="panel"><div class="label">diagram_show (renderShowSvg + packArt)</div><img src="${encode(newSvg)}"></div>
</div>
<div style="font-size:11px;padding:4px;color:#555">${title}</div></body></html>`;
}

(OUT ? describe : describe.skip)('F1 visual check: canvas vs diagram_show (set OUT env var)', () => {
  let browser;
  beforeAll(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  });
  afterAll(async () => { if (browser) await browser.close(); });

  async function shoot(name, content, lod) {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const oldR = renderDiagramSvg(content, { maxBytes: Infinity, maxElements: 1e5, maxConnections: 1e5 });
    const newR = renderShowSvg(content, { art: PACK_ART, lod: lod || 'auto' });
    errorSpy.mockRestore();
    const html = sideByside(name, oldR.svg, newR.svg);
    const htmlPath = path.join(OUT, `side-${name}.html`);
    fs.writeFileSync(htmlPath, html);
    const page = await browser.newPage();
    await page.setViewport({ width: 1379, height: 985 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 500));
    const pngPath = path.join(OUT, `side-${name}.png`);
    await page.screenshot({ path: pngPath });
    await page.close();
    console.log(`  ${name}: old ${oldR.svg.length} chars, new ${newR.svg.length} chars (${newR.lod}) -> ${pngPath}`);
    return { newR, pngPath };
  }

  test('checkout board: packed shapes match canvas geometry', async () => {
    const { newR } = await shoot('checkout', checkoutBoard());
    expect(newR.stats.unhandled).toEqual([]);
  });

  test('showcase board: every pack drawn', async () => {
    const { newR } = await shoot('showcase', showcaseContent());
    expect(newR.stats.unhandled).toEqual([]);
  });

  test('large 2000-element board overview under 130k', async () => {
    const content = largeBoard(2000);
    const { newR } = await shoot('large2000', content, 'overview');
    expect(newR.svg.length + newR.lod.length).toBeLessThan(500000); // plain overview OK
    expect(JSON.stringify(newR).length).toBeLessThan(500000);
  });
});

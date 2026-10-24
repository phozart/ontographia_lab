/**
 * @jest-environment node
 */
// Spike harness: the largest board (largeBoard mix: frames of 120 mixed stencils, a third connected, a ninth labelled) that fits the
// 110,000-character picture budget per transport and level of detail. Written to OUT/capacity.json.
import { renderShowSvg } from '../../lib/render/showSvg';
import { PACK_ART } from '../../lib/render/packArt';
import { largeBoard } from '../helpers/showFidelityBoard';

const zlib = require('zlib');
const fs = require('fs');

const OUT = process.env.OUT;
const MAX = 110000;
const gz = (s) => zlib.gzipSync(s, { level: 9 }).toString('base64').length;

(OUT ? test : test.skip)('capacity', () => {
  const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  const out = {};
  const search = (name, sizeOf, lo, hi) => {
    while (hi - lo > 50) {
      const mid = Math.round((lo + hi) / 2);
      if (sizeOf(mid) <= MAX) lo = mid; else hi = mid;
    }
    out[name] = lo;
  };
  search('fullRaw', (n) => renderShowSvg(largeBoard(n), { art: PACK_ART }).svg.length, 50, 1000);
  search('fullGzip', (n) => gz(renderShowSvg(largeBoard(n), { art: PACK_ART }).svg), 1000, 6000);
  search('overviewRaw', (n) => renderShowSvg(largeBoard(n), { lod: 'overview' }).svg.length, 100, 2000);
  search('overviewGzip', (n) => gz(renderShowSvg(largeBoard(n), { lod: 'overview' }).svg), 2000, 20000);
  const t0 = performance.now();
  renderShowSvg(largeBoard(3000), { art: PACK_ART });
  out.full3000ms = Math.round(performance.now() - t0);
  errorSpy.mockRestore();
  fs.writeFileSync(`${OUT}/capacity.json`, JSON.stringify(out, null, 2));
}, 600000);

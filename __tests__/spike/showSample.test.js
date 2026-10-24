/**
 * @jest-environment node
 */
// Spike harness (not part of the suite): renders the sample boards with the old renderer and the new one and writes the SVGs,
// the board JSON (to put on a real canvas) and a size report to OUT.
import { renderDiagramSvg } from '../../lib/render/diagramSvg';
import { renderShowSvg } from '../../lib/render/showSvg';
import { PACK_ART } from '../../lib/render/packArt';
import { showcaseContent } from '../helpers/textShowcase';
import { checkoutBoard, largeBoard } from '../helpers/showFidelityBoard';

const fs = require('fs');
const zlib = require('zlib');

const OUT = process.env.OUT;
const json = (s) => (s ? JSON.stringify(s).length : 0);
const gz = (s) => (s ? zlib.gzipSync(s, { level: 9 }).toString('base64').length : 0);

(OUT ? test : test.skip)('sample boards: old vs new, sizes', () => {
  const report = {};
  for (const [name, content] of [['showcase', showcaseContent()], ['checkout', checkoutBoard()]]) {
    const old = renderDiagramSvg(content, { maxBytes: Infinity });
    const t0 = performance.now();
    const neu = renderShowSvg(content, { art: PACK_ART });
    const ms = performance.now() - t0;
    const plain = renderShowSvg(content, {});
    fs.writeFileSync(`${OUT}/${name}-old.svg`, old.svg);
    fs.writeFileSync(`${OUT}/${name}-new.svg`, neu.svg);
    fs.writeFileSync(`${OUT}/${name}.json`, JSON.stringify(content));
    report[name] = {
      elements: content.elements.length, connections: content.connections.length,
      old: { chars: json(old.svg), gzb64: gz(old.svg) },
      compactGenericOnly: { chars: json(plain.svg) },
      neu: { chars: json(neu.svg), gzb64: gz(neu.svg), ms: Math.round(ms) },
      stats: neu.stats,
    };
  }
  for (const n of [2000, 6000]) fs.writeFileSync(`${OUT}/large${n}.json`, JSON.stringify(largeBoard(n)));
  report.large = [];
  for (const n of [100, 250, 500, 750, 1000, 1500, 2000, 5000]) {
    const content = largeBoard(n);
    const old = renderDiagramSvg(content, { maxBytes: Infinity, maxElements: 1e5, maxConnections: 1e5 });
    let t0 = performance.now();
    const full = renderShowSvg(content, { art: PACK_ART });
    const fullMs = performance.now() - t0;
    t0 = performance.now();
    const ov = renderShowSvg(content, { lod: 'overview' });
    const ovMs = performance.now() - t0;
    if (n === 2000) {
      fs.writeFileSync(`${OUT}/large2000-overview.svg`, ov.svg);
      fs.writeFileSync(`${OUT}/large2000-full.svg`, full.svg);
      fs.writeFileSync(`${OUT}/large2000-regions.json`, JSON.stringify(ov.regions, null, 1));
    }
    if (n === 250) fs.writeFileSync(`${OUT}/large250-full.svg`, full.svg);
    report.large.push({
      n, connections: content.connections.length,
      old: { chars: json(old.svg), gzb64: gz(old.svg) },
      full: { chars: json(full.svg), gzb64: gz(full.svg), ms: Math.round(fullMs), symbols: full.stats.symbols, uses: full.stats.uses, unhandled: full.stats.unhandled.length },
      overview: { chars: json(ov.svg), gzb64: gz(ov.svg), ms: Math.round(ovMs), regions: ov.regions.length },
    });
  }
  fs.writeFileSync(`${OUT}/size-report.json`, JSON.stringify(report, null, 2));
});

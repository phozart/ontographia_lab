// Browser-side helpers for the ADR-0008 T3 e2e suites (CommonJS, puppeteer). Reading the text a renderer drew:
//   canvasBlocks(page)        every [data-text-block] of every mounted node, as {id, kind, size, left, top, width, lines[]}
//   blocksOfSvgText(page, s)  the same records from an exported (foreignObject) SVG file's text
// Both give the lines the browser was told to draw (pinned, one text node per block) so renderers can be compared line by line.

/** In-page function: records of every text block under `root` (a Document or Element), keyed by node id. */
function readBlocksInPage(rootSelector) {
  const root = rootSelector ? document.querySelector(rootSelector) : document;
  const out = [];
  for (const n of root.querySelectorAll('[data-node-id]')) {
    const id = n.getAttribute('data-node-id');
    for (const block of n.querySelectorAll('[data-text-block]')) {
      const spans = [...block.querySelectorAll(':scope > .ds-text-line')];
      const text = spans.length
        ? spans.map((x) => x.textContent.replace(/\n$/, ''))
        : [...block.childNodes].filter((c) => c.nodeType === 3).map((c) => c.nodeValue).join('').split('\n');
      const st = block.style;
      out.push({
        id,
        kind: block.getAttribute('data-text-block'),
        size: parseFloat(block.getAttribute('data-font-size')),
        left: parseFloat(st.left) || 0,
        top: parseFloat(st.top) || 0,
        width: parseFloat(st.width) || 0,
        paddingTop: parseFloat(st.paddingTop) || 0,
        overflow: block.getAttribute('data-overflow') === 'true',
        badge: !!block.querySelector('.ds-text-badge'),
        lines: text.map((t) => t.trim()),
      });
    }
  }
  return out;
}

/** Records for the live canvas (only what is mounted: viewport culling). */
const canvasBlocks = (page) => page.evaluate(readBlocksInPage, '.ds-canvas-inner');

/** Records for the text of an exported SVG (the html-to-image foreignObject document). */
const blocksOfSvgText = (page, svgText) => page.evaluate((src, reader) => {
  const doc = new DOMParser().parseFromString(src, 'image/svg+xml');
  const host = document.createElement('div');
  host.id = '__svg_host';
  host.style.cssText = 'position:absolute;left:-99999px;top:0;';
  host.appendChild(document.importNode(doc.documentElement, true));
  document.body.appendChild(host);
   
  const records = new Function(`return (${reader})`)()('#__svg_host');
  host.remove();
  return records;
}, svgText, readBlocksInPage.toString());

/**
 * The lines a browser flowed for rich text (doc cards, text presets), read from the glyph positions: characters are grouped by
 * the top of their client rect. For text the renderer does not pin (those are flowed by the browser, not by lib/text).
 */
const flowedLines = (page, selector) => page.evaluate((sel) => {
  const root = document.querySelector(sel);
  if (!root) return null;
  const rows = [];
  const walker = document.createTreeWalker(root, 4);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = n.nodeValue;
    for (let i = 0; i < t.length; i += 1) {
      const r = document.createRange();
      r.setStart(n, i);
      r.setEnd(n, i + 1);
      const b = r.getBoundingClientRect();
      if (!b.width && !b.height) continue;
      const row = rows.find((x) => Math.abs(x.top - b.top) < 4);
      if (row) row.text += t[i];
      else rows.push({ top: b.top, text: t[i] });
    }
  }
  return rows.sort((a, b) => a.top - b.top).map((r) => r.text.replace(/\s+/g, ' ').trim()).filter(Boolean);
}, selector);

module.exports = { flowedLines, readBlocksInPage, canvasBlocks, blocksOfSvgText };

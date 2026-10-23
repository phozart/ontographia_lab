#!/usr/bin/env node
// Checks the production build for the lazy-loading promise of ADR-0007 P3: pptxgenjs (and its jszip) and the PPTX
// compile/write modules live in their own async chunks and are in no chunk the build manifest lists for a page, and not in
// the chunk that holds the export dialog. Run after `NODE_ENV=production npx next build --webpack`:
//   node scripts/check-pptx-bundle.js          (exit 1 and the reason when the promise is broken)
//
// Signatures survive minification because they are strings: the OOXML part name that only pptxgenjs writes, and the master
// name that only lib/present/pptx/write.js uses.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const LIB_SIGNATURE = 'ppt/presentation.xml'; // pptxgenjs
const WRITER_SIGNATURE = 'LAB_SLIDE_'; // lib/present/pptx/write.js
const DIALOG_SIGNATURE = 'Export PowerPoint'; // PptxExportDialog

function listJs(dir) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith('.js')) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function checkBundle(root = process.cwd()) {
  const next = path.join(root, '.next');
  const manifestPath = path.join(next, 'build-manifest.json');
  if (!fs.existsSync(manifestPath)) return { ok: false, errors: ['No production build found (.next/build-manifest.json). Run: NODE_ENV=production npx next build --webpack'] };
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const chunksDir = path.join(next, 'static', 'chunks');
  const files = listJs(chunksDir);
  const rel = (f) => path.relative(path.join(next), f).split(path.sep).join('/');
  const text = new Map(files.map((f) => [rel(f), fs.readFileSync(f, 'utf8')]));
  const having = (sig) => [...text.entries()].filter(([, t]) => t.includes(sig)).map(([f]) => f);
  const lib = having(LIB_SIGNATURE);
  const writer = having(WRITER_SIGNATURE);
  const dialog = having(DIALOG_SIGNATURE);
  const eager = new Set([...(manifest.polyfillFiles || []), ...(manifest.rootMainFiles || []), ...Object.values(manifest.pages || {}).flat()]);
  const errors = [];
  if (!lib.length) errors.push('pptxgenjs was not found in any chunk (is the export wired up?)');
  if (!writer.length) errors.push('the PPTX writer was not found in any chunk');
  for (const f of [...lib, ...writer]) if (eager.has(f)) errors.push(`${f} is listed in the build manifest for a page: it loads with the page`);
  for (const f of lib) if (dialog.includes(f)) errors.push(`${f} holds both the export dialog and pptxgenjs: the library is not lazy`);
  for (const f of writer) if (dialog.includes(f) && !lib.includes(f)) errors.push(`${f} holds both the export dialog and the PPTX writer: the writer is not lazy`);
  const size = (f) => ({ file: f, bytes: Buffer.byteLength(text.get(f)), gzip: zlib.gzipSync(text.get(f)).length });
  // pptxgenjs splits jszip into a named chunk of its own
  const named = [...text.keys()].filter((f) => /chunks\/pptxgenjs[.-]/.test(f));
  return { ok: errors.length === 0, errors, lib: lib.map(size), writer: writer.map(size), dialog: dialog.map(size), jszip: named.map(size), eagerChunks: eager.size };
}

module.exports = { checkBundle, LIB_SIGNATURE, WRITER_SIGNATURE, DIALOG_SIGNATURE };

if (require.main === module) {
  const r = checkBundle(process.cwd());
  console.log(JSON.stringify(r, null, 2));
  process.exit(r.ok ? 0 : 1);
}

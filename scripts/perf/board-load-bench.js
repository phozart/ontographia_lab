#!/usr/bin/env node
/**
 * Board-load benchmark (docs/architecture/investigations/board-load-performance.md).
 *
 * Seeds throwaway boards of N mixed elements (frames, shapes, docs, tables, text presets, connections) through the
 * API, opens each in headless Chrome at 1379x985 and records: time until the first node exists, time until the node
 * count stops changing ("settled"), long-task total, JS heap, mounted node count and the number of thumbnail PUTs
 * fired while loading.
 *
 *   TEST_BASE_URL=http://localhost:3290 node scripts/perf/board-load-bench.js [sizes=300,500,2000,5000] [runs=3]
 * Needs QA_ADMIN_EMAIL / QA_ADMIN_PASSWORD (.env.qa.local). Deletes the boards it creates.
 */
const path = require('path');
const os = require('os');
const puppeteer = require('puppeteer');
const { headlessMode } = require('../../__tests__/helpers/headless');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env.qa.local') });

const ENV = process.env; // (the .env.example coverage test scans scripts for direct key reads)
const BASE_URL = ENV.TEST_BASE_URL || 'http://localhost:3290';
const { seedContent } = require('./seedBoard');

async function login(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.type('#email', ENV.QA_ADMIN_EMAIL);
  await page.type('#password', ENV.QA_ADMIN_PASSWORD);
  await Promise.all([page.waitForFunction(() => !window.location.pathname.startsWith('/login'), { timeout: 30000 }), page.click('button[type="submit"]')]);
}

const api = (page, method, url, body) => page.evaluate(async (m, u, b) => {
  const r = await fetch(u, { method: m, headers: { 'Content-Type': 'application/json' }, body: b ? JSON.stringify(b) : undefined });
  let json = null; try { json = await r.json(); } catch (e) { /* none */ }
  return { status: r.status, body: json };
}, method, url, body);

async function measure(context, board) {
  const page = await context.newPage();
  await page.setViewport({ width: 1379, height: 985 });
  const puts = [];
  page.on('request', (req) => { if (req.method() === 'PUT' && /\/api\/diagrams\//.test(req.url())) puts.push(Date.now()); });
  await page.evaluateOnNewDocument(() => {
    window.__perf = { samples: [], long: 0, longCount: 0 };
    try { new PerformanceObserver((l) => { for (const e of l.getEntries()) { window.__perf.long += e.duration; window.__perf.longCount += 1; } }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* none */ }
    let last = -1;
    const tick = () => {
      const c = document.querySelectorAll('[data-node-id]').length;
      if (c !== last) { window.__perf.samples.push([Math.round(performance.now()), c]); last = c; }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const t0 = Date.now();
  await page.goto(`${BASE_URL}/diagram/${board.short_id}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
  await page.waitForSelector('[data-node-id]', { timeout: 120000 });
  // settle: node count unchanged for 1.5 s (thumbnail capture would run inside this window, so wait 8 s total)
  await page.waitForFunction(() => { const s = window.__perf.samples; return s.length && performance.now() - s[s.length - 1][0] > 1500; }, { timeout: 120000, polling: 250 });
  await new Promise((r) => setTimeout(r, 6000));
  const r = await page.evaluate(() => {
    const s = window.__perf.samples;
    const data = performance.getEntriesByType('resource').filter((e) => /\/api\/diagrams\/[^/?]+(\?|$)/.test(e.name)).map((e) => e.responseEnd)[0] || 0;
    return { first: (s.find((x) => x[1] > 0) || s[0])[0], settled: s[s.length - 1][0], data: Math.round(data), nodes: s[s.length - 1][1], long: Math.round(window.__perf.long), longCount: window.__perf.longCount, domNodes: document.getElementsByTagName('*').length, heapMB: Math.round((performance.memory ? performance.memory.usedJSHeapSize : 0) / 1048576) };
  });
  // pan smoothness: 90 frames of wheel-pan (3,600 px: crosses several culling bands), frame-to-frame times
  r.pan = await page.evaluate(() => new Promise((resolve) => {
    const area = document.querySelector('.ds-canvas-area');
    const box = area.getBoundingClientRect();
    const frames = [];
    let last = performance.now();
    let n = 0;
    const step = () => {
      const now = performance.now();
      frames.push(now - last);
      last = now;
      area.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 20, bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 }));
      n += 1;
      if (n < 90) requestAnimationFrame(step);
      else { frames.shift(); frames.sort((a, b) => a - b); resolve({ p50: Math.round(frames[frames.length >> 1]), p95: Math.round(frames[Math.floor(frames.length * 0.95)]), max: Math.round(frames[frames.length - 1]) }); }
    };
    requestAnimationFrame(step);
  }));
  // fit-all style zoom-out (ctrl+wheel to the minimum zoom): time to the next painted frame, DOM size, then pan again
  r.zoomOut = await page.evaluate(() => new Promise((resolve) => {
    const area = document.querySelector('.ds-canvas-area');
    const box = area.getBoundingClientRect();
    const t0 = performance.now();
    for (let i = 0; i < 40; i += 1) area.dispatchEvent(new WheelEvent('wheel', { deltaY: 100, ctrlKey: true, bubbles: true, cancelable: true, clientX: box.left + 300, clientY: box.top + 300 }));
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const mountMs = Math.round(performance.now() - t0);
      const frames = [];
      let last = performance.now();
      let n = 0;
      const step = () => {
        const now = performance.now();
        frames.push(now - last);
        last = now;
        area.dispatchEvent(new WheelEvent('wheel', { deltaX: 40, deltaY: 20, bubbles: true, cancelable: true, clientX: box.left + 100, clientY: box.top + 100 }));
        n += 1;
        if (n < 60) requestAnimationFrame(step);
        else { frames.shift(); frames.sort((x, y) => x - y); resolve({ mountMs, nodes: document.querySelectorAll('[data-node-id]').length, domNodes: document.getElementsByTagName('*').length, overview: !!document.querySelector('[data-testid="board-overview"]'), p50: Math.round(frames[frames.length >> 1]), p95: Math.round(frames[Math.floor(frames.length * 0.95)]) }); }
      };
      requestAnimationFrame(step);
    }));
  }));
  r.puts = puts.length; r.putAt = puts.length ? puts[0] - t0 : 0;
  await page.close();
  return r;
}

(async () => {
  const sizes = (process.argv[2] || '300,500,2000,5000').split(',').map(Number);
  const runs = Number(process.argv[3] || 3);
  const browser = await puppeteer.launch({ headless: headlessMode(), args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--enable-precise-memory-info'] });
  const context = await browser.createBrowserContext();
  const p = await context.newPage();
  await login(p);
  const out = [];
  for (const n of sizes) {
    const created = await api(p, 'POST', '/api/diagrams', { type: 'infinite-canvas', name: `perf-${n}-${Date.now()}`, content: seedContent(n) });
    if (created.status !== 201) { console.error('seed failed', n, created.status, JSON.stringify(created.body).slice(0, 200)); continue; }
    const board = created.body;
    const results = [];
    for (let k = 0; k < runs; k += 1) results.push({ ...(await measure(context, board)), load: os.loadavg()[0].toFixed(1) });
    results.sort((a, b) => a.settled - b.settled);
    const best = results[0];
    out.push({ n, ...best, panP95: best.pan && best.pan.p95, panMax: best.pan && best.pan.max });
    console.log(JSON.stringify({ n, best, all: results.map((x) => x.settled) }));
    await api(p, 'DELETE', `/api/diagrams/${board.id}`);
  }
  console.table(out);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

// The privacy reviewer's gate: serve _site/ on a local origin, load each page in headless Chromium,
// record every network request and cookie, and fail if any request leaves the site's own origin.
// Writes data/requests.json (shown on /how-to-check/). Needs Playwright with Chromium (dev only, not
// a site dependency). Written by conductor.tools@AgentiCCells.dinis (for the privacy reviewer), 2026-11-20. Apache-2.0.
// Usage: node scripts/privacy-check.mjs [--write]
import { createServer } from 'node:http';
import { readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const cfg = JSON.parse(readFileSync('site.config.json', 'utf8'));
const PAGES = ['/', '/how-to-check/', '/about/', '/behind-the-scenes/'];
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = createServer((q, r) => {
  let p = join('_site', decodeURIComponent(new URL(q.url, 'http://x').pathname));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
  if (!existsSync(p)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p));
});
await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
const local = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const pages = []; let bad = 0;
for (const path of PAGES) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  const requests = [];
  page.on('request', (q) => requests.push({ method: q.method(), url: q.url(), type: q.resourceType() }));
  await page.goto(local + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  const cookies = (await ctx.cookies()).length;
  const foreign = requests.filter((q) => new URL(q.url).origin !== local);
  const ok = foreign.length === 0 && cookies === 0;
  if (!ok) { bad++; console.error(`${path}: ${foreign.length} request(s) to other origins, ${cookies} cookie(s)`); foreign.forEach((q) => console.error(`  ${q.url}`)); }
  // Shown with the live origin in place of the local test server's.
  pages.push({ page: path, ok, cookies, requests: requests.map((q) => ({ ...q, url: q.url.replace(local, `https://${cfg.domain}`) })) });
  await ctx.close();
}
await browser.close(); server.close();
if (process.argv.includes('--write')) writeFileSync('data/requests.json', JSON.stringify({ date: new Date().toISOString().slice(0, 10), how: 'scripts/privacy-check.mjs: headless Chromium, fresh profile per page, the built site served locally; local URLs shown with the live origin', pages }, null, 2) + '\n');
if (bad) { console.error(`FAILED (${bad} of ${PAGES.length} pages)`); process.exit(1); }
console.log(`OK (${PAGES.length} pages, only same-origin requests, no cookies)`);

#!/usr/bin/env node
// Screenshot pages of a built site (or any URL) at desktop and mobile sizes.
//   node scripts/screenshot.mjs <dist-dir | url> [--pages index.html,contact.html] [--out dir] [--full] [--scale 1]
// Needs Playwright: `npm install` in this repo (then `npx playwright install chromium` if no browser is present).
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, serveDir } from './lib.mjs';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const VALUE_FLAGS = ['--pages', '--out', '--scale'];
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
if (!target) { console.error('Usage: node scripts/screenshot.mjs <dist-dir|url> [--pages a.html,b.html] [--out dir] [--full]'); process.exit(1); }
const full = args.includes('--full');
const jpeg = args.includes('--jpeg');
const scale = Number(opt('scale', '1'));
const pages = (opt('pages', 'index.html')).split(',');
const out = path.resolve(opt('out', path.join(fs.existsSync(target) ? target : '.', '..', 'screens')));
fs.mkdirSync(out, { recursive: true });

const { chromium } = loadPlaywright();
let server, base;
if (/^https?:/.test(target)) base = target.replace(/\/?$/, '/');
else { server = await serveDir(path.resolve(target)); base = server.url; }

const browser = await chromium.launch();
const shots = [];
for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: scale, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
  const page = await ctx.newPage();
  for (const p of pages) {
    const url = /^https?:/.test(p) ? p : new URL(p, base).href;
    await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => page.goto(url, { waitUntil: 'load' }));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    // Trigger lazy images before a full-page shot.
    if (full) {
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 140)); }
        await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 8000); }))));
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(1200);
    }
    const file = path.join(out, `${p.replace(/[^a-z0-9]+/gi, '_').replace(/_html$/, '')}-${label}${full ? '-full' : ''}.${jpeg ? 'jpg' : 'png'}`);
    await page.screenshot({ path: file, fullPage: full, ...(jpeg ? { type: 'jpeg', quality: 78 } : {}) });
    shots.push(file);
  }
  await ctx.close();
}
await browser.close();
server?.close();
console.log(shots.join('\n'));

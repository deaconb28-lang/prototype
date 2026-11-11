#!/usr/bin/env node
// Deslop audit: runs the automatic checks from deslop/indicators.json against a
// built site folder or a live URL, screenshots every page, and writes a run folder
// that the visual review, fixes, review page and apply step all build on.
//
//   node deslop/audit.mjs <site-dir | https://url> [--run <name>] [--pages 8] [--prototype] [--city "Boise"]
//
// --prototype  Placeholder-related checks (sample reviews, stock photos, missing
//              license) are listed as launch blockers instead of lowering the score.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDir } from '../scripts/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : d; };
const VALUE_FLAGS = ['--run', '--pages', '--city', '--out'];
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1])));
if (!target) { console.error('Usage: node deslop/audit.mjs <site-dir|url> [--run name] [--pages 8] [--prototype] [--city "Town"]'); process.exit(1); }
const isUrl = /^https?:\/\//i.test(target);
const prototypeMode = args.includes('--prototype');
const maxPages = Number(opt('pages', '8'));
const city = opt('city', '');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
const slug = (isUrl ? new URL(target).hostname : path.basename(path.resolve(target)) === 'dist' || path.basename(path.resolve(target)) === 'site' ? path.basename(path.dirname(path.resolve(target))) : path.basename(path.resolve(target))).replace(/[^a-z0-9.-]+/gi, '-');
const runName = opt('run', `${slug}-${stamp}`);
const runDir = path.resolve(opt('out', path.join(ROOT, '.deslop')), runName);
fs.mkdirSync(path.join(runDir, 'screens'), { recursive: true });

const catalog = JSON.parse(fs.readFileSync(path.join(HERE, 'indicators.json'), 'utf8'));
const byId = Object.fromEntries(catalog.indicators.map((i) => [i.id, i]));
const collect = fs.readFileSync(path.join(HERE, 'collect.js'), 'utf8');

// ---------- snapshot + page list ----------
let server, baseUrl, pages = [];
const skip = new Set(['node_modules', '.git', '.deslop']);
const copySite = (src, dst) => { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src, { withFileTypes: true })) { if (skip.has(f.name)) continue; const s = path.join(src, f.name), d = path.join(dst, f.name); if (f.isDirectory()) copySite(s, d); else fs.copyFileSync(s, d); } };
const htmlFiles = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((f) => { if (skip.has(f.name)) return []; const r = path.join(rel, f.name); return f.isDirectory() ? htmlFiles(dir, r) : f.name.endsWith('.html') ? [r] : []; });

const { chromium } = loadPlaywright();
const browser = await chromium.launch();

if (!isUrl) {
  const src = path.resolve(target);
  if (!fs.existsSync(path.join(src, 'index.html'))) { console.error(`No index.html in ${src}. Point the audit at a built site folder (e.g. sites/<slug>/dist).`); process.exit(1); }
  copySite(src, path.join(runDir, 'base'));
  const files = htmlFiles(src).filter((f) => !/^(404|thank-you)\.html$/.test(f));
  const rank = (f) => (f === 'index.html' ? 0 : /contact/.test(f) ? 1 : /^services\.html$/.test(f) ? 2 : /^services\//.test(f) ? 4 : 3);
  const svcPages = files.filter((f) => f.startsWith('services/')).slice(0, 1);
  pages = [...files.filter((f) => !f.startsWith('services/')), ...svcPages].sort((a, b) => rank(a) - rank(b)).slice(0, maxPages);
  server = await serveDir(path.join(runDir, 'base'));
  baseUrl = server.url;
} else {
  // Crawl same-origin links from the home page.
  const home = new URL(target);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  await p.goto(home.href, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => p.goto(home.href, { waitUntil: 'load' }));
  const hrefs = await p.$$eval('a[href]', (as) => as.map((a) => a.href));
  const same = [...new Set(hrefs.map((h) => { try { const u = new URL(h); u.hash = ''; return u.origin === location.origin ? u.href : null; } catch (_) { return null; } }).filter(Boolean))];
  const score = (u) => (/contact|quote|estimate/i.test(u) ? 0 : /service/i.test(u) ? 1 : /about|review|area/i.test(u) ? 2 : 3);
  pages = [home.href, ...same.filter((u) => u.replace(/\/$/, '') !== home.href.replace(/\/$/, '')).sort((a, b) => score(a) - score(b))].slice(0, maxPages);
  // Snapshot rendered HTML so fixes can be mocked up against it.
  fs.mkdirSync(path.join(runDir, 'base'), { recursive: true });
  for (const u of pages) {
    await p.goto(u, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    let html = await p.content();
    html = html.replace(/<head([^>]*)>/i, `<head$1><base href="${u}">`);
    fs.writeFileSync(path.join(runDir, 'base', pageFile(u)), html);
  }
  await ctx.close();
}

function pageFile(u) {
  if (!isUrl) return u;
  const url = new URL(u);
  const p = url.pathname.replace(/\/$/, '') || '/index';
  return `${p.slice(1).replace(/[^a-z0-9]+/gi, '-') || 'index'}.html`;
}

// ---------- collect ----------
const results = [];
for (const p of pages) {
  const url = isUrl ? p : new URL(p, baseUrl).href;
  const file = pageFile(p);
  const page = { file, url: isUrl ? p : file };
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
    const pg = await ctx.newPage();
    await pg.goto(url, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => pg.goto(url, { waitUntil: 'load' }).catch(() => {}));
    await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
    const data = await pg.evaluate(`(${collect})()`);
    // full-page screenshot after nudging lazy images
    await pg.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 90)); } await Promise.all([...document.images].map((im) => (im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; setTimeout(r, 5000); })))); window.scrollTo(0, 0); }).catch(() => {});
    await pg.waitForTimeout(400);
    const shot = path.join('screens', `${file.replace(/[\\/]/g, '__').replace(/\.html$/, '')}-${label}.jpg`);
    await pg.screenshot({ path: path.join(runDir, shot), fullPage: true, type: 'jpeg', quality: 72 }).catch(() => {});
    page[label] = data;
    page[`${label}Shot`] = shot;
    await ctx.close();
  }
  results.push(page);
  process.stderr.write(`  audited ${file}\n`);
}
await browser.close();
server?.close();

// ---------- rules ----------
const HYPE = ['elevate', 'elevated', 'unlock', 'unleash', 'seamless', 'seamlessly', 'cutting-edge', 'cutting edge', 'state-of-the-art', 'top-notch', 'second to none', 'one-stop shop', 'look no further', 'your trusted partner', "we've got you covered", 'revolutionize', 'revolutionary', 'empower', 'delve', 'tapestry', 'testament to', 'game-changer', 'game changer', 'unparalleled', 'world-class', 'premier', "in today's fast-paced", 'nestled', 'peace of mind', 'excellence', 'journey', 'your satisfaction is our priority', 'quality you can trust', 'transform your', 'next level', 'next-level', 'bespoke', 'curated', 'meticulous', 'meticulously', 'embark', 'realm', 'navigate the', 'hassle-free', 'stress-free', 'go above and beyond', 'unwavering', 'synergy', 'holistic'];
const JARGON = /\b(solutions?|leverag(e|ing)|utiliz(e|ing)|synerg(y|ies)|comprehensive|streamlin(e|ed|ing)|robust|innovative|dynamic)\b/gi;
const GENERIC_TITLES = /^(our services|services|why choose us\??|about us|testimonials|what our (clients|customers) say|our team|contact us|get in touch|our work|our projects|faq|frequently asked questions|how it works|features|our process)$/i;
const TRADE_WORDS = /roof|plumb|drain|water heater|hvac|heating|cooling|air condition|furnace|electric|wiring|panel|landscap|lawn|yard|garden|paint|pest|termite|rodent|clean|maid|remodel|renovat|kitchen|bath|garage door|contractor|repair|install/i;
const LIC_NUM = /\b(lic(ense|ence)?|reg(istration)?|contractor)\s*(no\.?|number|#)?\s*[:#]?\s*[A-Z]{0,4}[-\s]?\d{3,}[A-Z0-9-]*/i;
const thisYear = new Date().getFullYear();

const D = (r) => r.desktop || {}, Mo = (r) => r.mobile || {};
const allText = results.map((r) => D(r).text || '').join('\n');
const homeR = results[0] || {};
const findings = {};
const fail = (id, evidence, pagesHit = []) => { findings[id] = { status: 'fail', evidence: [].concat(evidence).filter(Boolean).slice(0, 8), pages: [...new Set(pagesHit)] }; };
const pass = (id) => { if (!findings[id]) findings[id] = { status: 'pass' }; };
const na = (id, why) => { findings[id] = { status: 'na', evidence: [why] }; };
const each = (fn) => results.flatMap((r) => { const v = fn(r); return v ? [{ page: r.file, v }] : []; });
const hitsOf = (re, text) => [...new Set((text.match(re) || []).map((s) => s.toLowerCase()))];

// Copy
{ const hits = HYPE.filter((w) => new RegExp(`\\b${w.replace(/[-']/g, '.')}\\b`, 'i').test(allText)); hits.length ? fail('C01', hits.map((h) => `"${h}"`), results.filter((r) => hits.some((h) => new RegExp(`\\b${h.replace(/[-']/g, '.')}\\b`, 'i').test(D(r).text))).map((r) => r.file)) : pass('C01'); }
{ const p = each((r) => { const n = (D(r).text.match(/—/g) || []).length; const words = D(r).text.split(/\s+/).length; return n > 2 || n > words / 150 ? `${n} em dashes` : null; }); p.length ? fail('C02', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('C02'); }
{ const p = each((r) => D(r).headings.find((h) => /\bwelcome to\b/i.test(h.text))?.text); p.length ? fail('C03', p.map((x) => `"${x.v}"`), p.map((x) => x.page)) : pass('C03'); }
{ const p = each((r) => D(r).headings.find((h) => /!/.test(h.text))?.text); p.length ? fail('C04', p.map((x) => `"${x.v}"`), p.map((x) => x.page)) : pass('C04'); }
{ const p = each((r) => D(r).emojiHeadings[0]); p.length ? fail('C05', p.map((x) => `"${x.v}"`), p.map((x) => x.page)) : pass('C05'); }
{ const re = /^(get started|learn more|submit|click here|read more|discover more|find out more|see more|explore|send)$/i; const p = each((r) => D(r).ctas.find((c) => re.test(c.text.trim()))?.text); p.length ? fail('C06', [...new Set(p.map((x) => `"${x.v}"`))], p.map((x) => x.page)) : pass('C06'); }
{ const m = allText.match(/whether you('re| are)\b[^.]{3,80}\bor\b[^.]{0,60}/i); m ? fail('C07', `"${m[0].slice(0, 90)}"`) : pass('C07'); }
{ const re = /\b[A-Z][a-z]+\.\s+[A-Z][a-z]+\.\s+[A-Z][a-z]+\./; const p = each((r) => D(r).headings.map((h) => h.text).find((t) => re.test(t))); p.length ? fail('C08', p.map((x) => `"${x.v}"`), p.map((x) => x.page)) : pass('C08'); }
{ const re = /lorem ipsum|your text here|\[(company|business)( name)?\]|\{\{\s*\w+\s*\}\}|insert [^.]{1,30} here|placeholder text|need some text here/i; const p = each((r) => (D(r).text.match(re) || [])[0]); p.length ? fail('C09', p.map((x) => `${x.page}: "${x.v}"`), p.map((x) => x.page)) : pass('C09'); }
{ const re = /\b(best in (town|the area|the business|class|the city)|#1\b|number one|highest[- ]quality|unmatched|unbeatable|second to none|top[- ]rated|the best [a-z]+ in)/gi; const h = hitsOf(re, allText); h.length ? fail('C10', h.map((x) => `"${x}"`)) : pass('C10'); }
{ const h = hitsOf(JARGON, allText); h.length >= 2 ? fail('C11', h.map((x) => `"${x}"`)) : pass('C11'); }
{ const fs1 = `${D(homeR).firstScreenText || ''} ${Mo(homeR).firstScreenText || ''}`; const trade = TRADE_WORDS.test(fs1); const place = city ? new RegExp(city, 'i').test(fs1) : /\b(in|serving|across|near)\s+[A-Z][a-z]+|,\s*[A-Z]{2}\b|·\s*[A-Z][a-z]+/.test(fs1); (!trade || !place) ? fail('C12', [`first screen ${trade ? 'names a trade' : 'names no trade or service'} and ${place ? 'a place' : 'no town or area'}`], [homeR.file]) : pass('C12'); }
{ const re = /^(looking for|are you|tired of|ready to|want to|searching for|in need of)\b/i; const p = each((r) => D(r).headings.find((h) => re.test(h.text))?.text); p.length ? fail('C13', p.map((x) => `"${x.v}"`), p.map((x) => x.page)) : pass('C13'); }
{ const sub = D(homeR).heroSub || ''; const n = sub.split(/\s+/).filter(Boolean).length; n > 35 ? fail('C14', `${n} words: "${sub.slice(0, 90)}..."`, [homeR.file]) : pass('C14'); }
{ const we = (allText.match(/\b(we|our|us)\b/gi) || []).length, you = (allText.match(/\b(you|your)\b/gi) || []).length; (we >= 15 && we > you * 2.5) ? fail('C15', `we/our/us: ${we}, you/your: ${you}`) : pass('C15'); }
{ const lowerSeen = new Set((allText.match(/\b[a-z][a-z'-]+\b/g) || [])); const small = /^(a|an|the|and|or|of|in|on|to|for|with|at|by|from)$/i; const tc = results.flatMap((r) => D(r).headings.filter((h) => h.tag !== 'h1').map((h) => h.text)).filter((t) => { const w = t.split(/\s+/).map((x) => x.replace(/[^A-Za-z'-]/g, '')).filter((x) => x && !small.test(x) && lowerSeen.has(x.toLowerCase())); if (w.length < 4) return false; const caps = w.filter((x) => /^[A-Z]/.test(x)).length; return caps / w.length >= 0.8 && t !== t.toUpperCase(); }); tc.length >= 3 ? fail('C16', tc.slice(0, 4).map((t) => `"${t}"`)) : pass('C16'); }
{ const g = results.flatMap((r) => D(r).headings.filter((h) => GENERIC_TITLES.test(h.text.trim())).map((h) => ({ page: r.file, t: h.text }))); g.length ? fail('C17', [...new Set(g.map((x) => `"${x.t}"`))], g.map((x) => x.page)) : pass('C17'); }
{ const h = hitsOf(/\b(act now|limited time|hurry|only \d+ (spots|slots|openings) left|offer ends|don't miss out|while supplies last)\b/gi, allText); h.length ? fail('C18', h.map((x) => `"${x}"`)) : pass('C18'); }

// Typography
{ const DEF = /^(inter|poppins|montserrat|roboto|open sans|lato|arial|helvetica|system-ui|-apple-system|segoe ui|sans-serif|nunito|raleway)$/i; const h = D(homeR); (DEF.test(h.fontH1 || '') && DEF.test(h.fontBody || '')) ? fail('T01', `headings: ${h.fontH1}, body: ${h.fontBody}`) : pass('T01'); }
{ const h = D(homeR); (h.h1Size && h.bodySize && h.h1Size < h.bodySize * 2.2) ? fail('T02', `H1 ${Math.round(h.h1Size)}px vs body ${Math.round(h.bodySize)}px`) : pass('T02'); }
{ const p = each((r) => D(r).gradientText[0]); p.length ? fail('T03', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('T03'); }
{ const p = each((r) => (Mo(r).bodySize && Mo(r).bodySize < 15.5 ? `${Mo(r).bodySize}px on mobile` : null)); p.length ? fail('T04', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('T04'); }
{ const p = each((r) => (D(r).longLines >= 3 ? `${D(r).longLines} paragraphs over ~90 characters wide` : null)); p.length ? fail('T05', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('T05'); }
{ const p = each((r) => (D(r).centeredLong >= 2 ? `${D(r).centeredLong} centered paragraphs over 3 lines` : null)); p.length ? fail('T06', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('T06'); }
{ const fams = new Set(results.flatMap((r) => D(r).families || []).filter((f) => !/^(system-ui|-apple-system|sans-serif|serif|monospace|arial|helvetica|times new roman)$/i.test(f))); const sup = new Set([...fams].map((f) => f.replace(/\s+(display|text|mono|condensed|narrow|sans|serif|slab|grotesk|caption|subhead|deck)$/i, '').trim())); sup.size > 3 ? fail('T08', [...fams].join(', ')) : pass('T08'); }
{ const l = D(homeR).bodyLeading; (l < 1.35 || l > 1.9) ? fail('T09', `body line-height ${l.toFixed(2)}`) : pass('T09'); }

// Color
{ const p = each((r) => D(r).purpleGradients[0]); p.length ? fail('K01', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('K01'); }
{ const p = each((r) => D(r).frameworkBlue); p.length ? fail('K02', 'buttons use Tailwind default blue', p.map((x) => x.page)) : pass('K02'); }
{ const p = each((r) => D(r).blobs[0]); p.length ? fail('K03', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('K03'); }
{ const lc = results.flatMap((r) => [...(D(r).lowContrast || []), ...(Mo(r).lowContrast || [])].map((x) => ({ ...x, page: r.file }))); const uniq = [...new Map(lc.map((x) => [x.sel + x.text, x])).values()]; uniq.length >= 2 ? fail('K04', uniq.slice(0, 6).map((x) => `${x.page}: "${x.text}" ${x.ratio}:1 (${x.sel})`), uniq.map((x) => x.page)) : pass('K04'); }
{ const n = Math.max(...results.map((r) => D(r).accentHues || 0)); n > 3 ? fail('K06', `${n} different saturated hues on buttons and links`) : pass('K06'); }

// Layout
{ const p = each((r) => D(r).iconCards[0]); p.length ? fail('L02', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('L02'); }
{ const p = each((r) => (D(r).shadowRound >= 8 ? `${D(r).shadowRound} rounded elements with drop shadows` : null)); p.length ? fail('L05', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('L05'); }
{ const p = each((r) => (D(r).statNumbers.length >= 2 ? D(r).statNumbers.join(', ') : null)); p.length ? fail('L06', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('L06'); }
{ const p = each((r) => D(r).logoCloud); p.length ? fail('L07', '"Trusted by" style logo row', p.map((x) => x.page)) : pass('L07'); }
{ const p = each((r) => Mo(r).horizontalOverflow); p.length ? fail('L08', p.map((x) => `${x.page} scrolls sideways at 390px`), p.map((x) => x.page)) : pass('L08'); }
{ const n = D(homeR).firstScreenButtons || 0; n > 3 ? fail('L09', `${n} buttons on the first screen`, [homeR.file]) : pass('L09'); }

// Imagery
{ const imgs = results.reduce((a, r) => a + (D(r).images || 0), 0), stock = results.reduce((a, r) => a + (D(r).stockImages || 0), 0); imgs === 0 ? fail('I01', 'no photos at all') : stock / imgs >= 0.6 ? fail('I01', `${stock} of ${imgs} photos are stock`) : pass('I01'); }
{ const n = results.reduce((a, r) => a + (D(r).noDims || 0), 0); n > 2 ? fail('I06', `${n} images without width/height`) : pass('I06'); }
{ const n = results.reduce((a, r) => a + (D(r).oversized || 0), 0); n >= 2 ? fail('I07', `${n} images far larger than displayed`) : pass('I07'); }
{ const n = results.reduce((a, r) => a + (D(r).noAlt || 0), 0); n > 0 ? fail('I08', `${n} images missing alt text`) : pass('I08'); }

// Decoration
{ const p = each((r) => D(r).sparkles); p.length ? fail('D01', 'sparkle/magic icons or emoji', p.map((x) => x.page)) : pass('D01'); }
{ const n = Math.max(...results.map((r) => D(r).tintedIcons || 0)); n >= 3 ? fail('D02', `${n} icons in tinted containers`) : pass('D02'); }
{ const n = results.reduce((a, r) => a + (D(r).emojiBullets || 0), 0); n >= 2 ? fail('D03', `${n} list items start with an emoji`) : pass('D03'); }
{ const p = each((r) => (D(r).glass.length >= 2 ? D(r).glass.join(', ') : null)); p.length ? fail('D04', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('D04'); }
{ const p = each((r) => (D(r).checkLists > (r === homeR ? 3 : 6) ? `${D(r).checkLists} checkmark lists` : null)); p.length ? fail('D06', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('D06'); }
{ const p = each((r) => (D(r).glow.length >= 2 ? D(r).glow.join(', ') : null)); p.length ? fail('D07', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('D07'); }
{ const p = each((r) => (D(r).shadowCount >= 14 ? `${D(r).shadowCount} elements with drop shadows` : null)); p.length ? fail('D08', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('D08'); }

// Components
{ const p = each((r) => D(r).pricingTiers); p.length ? fail('X01', 'monthly tiered pricing table', p.map((x) => x.page)) : pass('X01'); }
{ const total = results.reduce((a, r) => a + (D(r).reviews || 0), 0), anon = results.reduce((a, r) => a + (D(r).anonymousReviews || 0), 0); total === 0 ? na('X03', 'no testimonials found') : anon >= Math.max(1, total * 0.4) ? fail('X03', `${anon} of ${total} testimonials have no name or source`) : pass('X03'); }
{ const p = each((r) => D(r).carousel); p.length ? fail('X04', 'carousel/slider component', p.map((x) => x.page)) : pass('X04'); }
{ const forms = results.flatMap((r) => (D(r).forms || []).map((f) => ({ ...f, page: r.file }))); const q = forms.filter((f) => !f.newsletter); if (!q.length) { na('X05', 'no forms'); na('X06', 'no forms'); na('V06', 'no forms'); } else {
  const long = q.filter((f) => f.fields > 6); long.length ? fail('X05', long.map((f) => `${f.page}: ${f.fields} fields`), long.map((f) => f.page)) : pass('X05');
  const unl = q.filter((f) => f.unlabeled > 0); unl.length ? fail('X06', unl.map((f) => `${f.page}: ${f.unlabeled} fields without a visible label`), unl.map((f) => f.page)) : pass('X06');
  const nop = q.filter((f) => !f.promise); nop.length === q.length ? fail('V06', 'no "we call back within..." line near any form') : pass('V06');
} const nl = forms.filter((f) => f.newsletter); nl.length ? fail('X07', 'newsletter signup form', nl.map((f) => f.page)) : pass('X07'); }
{ const p = each((r) => (D(r).deadLinks + D(r).socialDead > 0 ? `${D(r).deadLinks} '#' links, ${D(r).socialDead} bare social links` : null)); p.length ? fail('X09', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('X09'); }
{ const p = each((r) => Mo(r).popups[0]); p.length ? fail('X10', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('X10'); }

// Motion
{ const p = each((r) => (D(r).revealCount >= 5 ? `${D(r).revealCount} scroll-reveal elements` : null)); p.length ? fail('M01', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('M01'); }
{ const p = each((r) => D(r).infiniteAnims > 0); p.length ? fail('M02', 'infinite animation (marquee/ticker)', p.map((x) => x.page)) : pass('M02'); }
{ const anim = results.some((r) => D(r).hasTransitionsOrKeyframes || D(r).animCount > 0 || D(r).revealCount > 0); const rm = results.some((r) => D(r).reducedMotion); anim && !rm ? fail('M03', 'animations without a prefers-reduced-motion rule') : pass('M03'); }

// Trust
{ const re = /(\b\d{1,3}(,\d{3})+\+?|\b\d{3,}\+)\s*(happy|satisfied)?\s*(customers|clients|homeowners|families|projects|jobs|roofs|homes)|\b(99|100)\s*%\s*(customer\s*)?(satisfaction|satisfied)|#1\s+(rated|in)|number one rated/gi; const h = hitsOf(re, allText); h.length ? fail('H01', h.map((x) => `"${x}"`)) : pass('H01'); }
{ const hasStars = /★|(\b[345]\.\d\b\s*(stars?|rating|\/\s*5|out of 5))/i.test(allText); const sourced = /\b\d[\d,]*\s+(google|facebook|yelp|homeadvisor|angi|bbb|trustpilot|houzz|nextdoor)?\s*reviews?\b/i.test(allText); hasStars && !sourced ? fail('H02', 'star rating shown without review count or platform') : pass('H02'); }
{ const h = hitsOf(/\baward[- ]winning\b|^\s*certified (professionals|experts|technicians)\s*$/gim, allText); h.length ? fail('H04', h.map((x) => `"${x}"`)) : pass('H04'); }
{ const lic = LIC_NUM.test(allText); const loc = /\b\d{2,6}\s+[A-Z][a-z]+(\s[A-Z][a-z]+)*\s+(st|street|ave|avenue|rd|road|blvd|dr|drive|ln|lane|way|ct|hwy|pkwy)\b/i.test(allText) || /service area|serving|areas we serve/i.test(allText); if (!lic) fail('H05', `no license number found${loc ? '' : '; no address or service area either'}`); else pass('H05'); }
{ const yrs = (allText.match(/(©|&copy;|copyright)\s*(\d{4})/gi) || []).map((m) => Number(m.match(/\d{4}/)[0])); yrs.length && Math.max(...yrs) < thisYear ? fail('H06', `copyright ${Math.max(...yrs)}`) : pass('H06'); }
{ const tags = results.reduce((a, r) => a + (D(r).sampleTags || 0), 0); const ex = hitsOf(/[\w.-]+@example\.(com|org)|\(\d{3}\)\s?555-01\d\d|\b\d{3}-555-01\d\d\b|sample review/gi, allText); (tags || ex.length) ? fail('H07', [tags ? `${tags} items tagged Sample/Stock photo` : null, ...ex.slice(0, 3).map((x) => `"${x}"`)]) : pass('H07'); }

// Conversion
{ const p = results.filter((r) => !Mo(r).phoneInFirstScreen || !D(r).phoneInFirstScreen).map((r) => r.file); p.includes(homeR.file) ? fail('V01', `phone not on the first screen of ${p.join(', ')}`, p) : pass('V01'); }
{ const tel = results.reduce((a, r) => a + (D(r).telLinks || 0), 0), txtN = results.reduce((a, r) => a + (D(r).phoneTextCount || 0), 0); txtN === 0 ? fail('V02', 'no phone number found at all') : tel === 0 ? fail('V02', `${txtN} phone numbers, none are tel: links`) : pass('V02'); }
{ (D(homeR).quoteInFirstScreen && Mo(homeR).quoteInFirstScreen) ? pass('V03') : fail('V03', `no quote/estimate action on the first screen (${D(homeR).quoteInFirstScreen ? 'mobile' : 'desktop'})`, [homeR.file]); }
{ const types = results.flatMap((r) => D(r).jsonldTypes || []); (/(service area|areas we serve|serving|we serve|proudly serving|locations)/i.test(allText) || city && new RegExp(city, 'i').test(allText)) ? pass('V04') : fail('V04', 'no service area or towns named'); void types; }
{ Mo(homeR).stickyCallBar ? pass('V05') : fail('V05', 'no fixed call bar at the bottom on mobile', [homeR.file]); }
{ /\b(mon(day)?|tue|wed|thu|fri|sat|sun)[a-z]*\.?\s*(-|–|to|through|thru)\s*(fri|sat|sun)|\b\d{1,2}(:\d\d)?\s*(am|pm)\s*(-|–|to)\s*\d{1,2}(:\d\d)?\s*(am|pm)|24\s*\/\s*7|open 24|by appointment/i.test(allText) ? pass('V09') : fail('V09', 'no opening hours found'); }
{ const c = results.find((r) => /contact|quote|estimate/i.test(r.file)); if (!c) na('V10', 'no contact page found'); else { const t = D(c).text; (D(c).telLinks > 0 && /(hours|mon|am|pm|24\/7|service area|serving)/i.test(t)) ? pass('V10') : fail('V10', `${c.file} lacks phone link, hours or area`, [c.file]); } }

// Tech
{ results.some((r) => D(r).outlineNone) ? fail('S01', 'outline removed without :focus-visible styles') : pass('S01'); }
{ const p = each((r) => (Mo(r).smallTargets.length >= 3 ? `${Mo(r).smallTargets.length} targets under 24px (${Mo(r).smallTargets.slice(0, 3).join(', ')})` : null)); p.length ? fail('S02', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('S02'); }
{ const p = each((r) => (D(r).h1Count !== 1 ? `${D(r).h1Count} H1s` : null)); p.length ? fail('S03', p.map((x) => `${x.page}: ${x.v}`), p.map((x) => x.page)) : pass('S03'); }
{ const titles = results.map((r) => D(r).title.trim()); const bad = titles.filter((t) => !t || /^(home|index|react app|vite( \+ react)?|untitled|document|my website|next\.js app)$/i.test(t)); const dup = titles.filter((t, i) => t && titles.indexOf(t) !== i); (bad.length || dup.length) ? fail('S04', [...bad.map((t) => `generic title "${t}"`), ...[...new Set(dup)].map((t) => `duplicate title "${t}"`)]) : pass('S04'); }
{ const p = results.filter((r) => !D(r).metaDescription).map((r) => r.file); p.length ? fail('S05', `missing on ${p.join(', ')}`, p) : pass('S05'); }
{ const LB = /LocalBusiness|HomeAndConstructionBusiness|Contractor|Plumber|Electrician|HVACBusiness|HousePainter|Locksmith|MovingCompany|ProfessionalService|AutoRepair|Store|LegalService|MedicalBusiness|Restaurant|ExterminatingService|EmergencyService/; results.some((r) => (D(r).jsonldTypes || []).some((t) => LB.test(t))) ? pass('S06') : fail('S06', 'no LocalBusiness JSON-LD'); }
{ const kb = Math.round(Math.max(...results.map((r) => D(r).jsBytes || 0)) / 1024); kb > 300 ? fail('S07', `${kb} KB of JavaScript`) : pass('S07'); }
{ results.some((r) => !D(r).viewport) ? fail('S08', 'no viewport meta tag') : pass('S08'); }
{ const fav = D(homeR).favicons || []; (!fav.length || fav.some((f) => /vite\.svg|react|next\.svg|vercel/i.test(f))) ? fail('S09', fav.length ? `default favicon ${fav[0]}` : 'no favicon') : pass('S09'); }

// ---------- prototype mode: placeholders are launch blockers, not slop ----------
const PLACEHOLDER_IDS = ['H07', 'I01', 'H05'];
const launchBlockers = [];
if (prototypeMode) for (const id of PLACEHOLDER_IDS) if (findings[id]?.status === 'fail') { launchBlockers.push({ id, name: byId[id].name, evidence: findings[id].evidence }); findings[id] = { status: 'deferred', evidence: findings[id].evidence }; }

// ---------- score ----------
const W = catalog.weights;
const visualIds = catalog.indicators.filter((i) => i.check === 'visual').map((i) => i.id);
for (const i of catalog.indicators) if (i.check === 'auto' && !findings[i.id]) findings[i.id] = { status: 'na', evidence: ['not checked'] };
const failed = catalog.indicators.filter((i) => findings[i.id]?.status === 'fail');
// Score: share of the checked weight that fails, squared, so a few misses cost little
// and a pile of them drops fast. Typical vibecoded sites land around 40-60.
const checked = catalog.indicators.filter((i) => ['fail', 'pass'].includes(findings[i.id]?.status));
const T = checked.reduce((a, i) => a + W[i.severity], 0) || 1;
const fw = failed.reduce((a, i) => a + W[i.severity], 0);
const score = Math.round(100 * (1 - fw / T) ** 2);
const audit = {
  version: 1, target: isUrl ? target : path.resolve(target), mode: isUrl ? 'url' : 'dir', prototype: prototypeMode, run: runName, created: new Date().toISOString(),
  pages: results.map((r) => ({ file: r.file, url: r.url, desktopShot: r.desktopShot, mobileShot: r.mobileShot, title: D(r).title })),
  findings, visualPending: visualIds, launchBlockers,
  score: { auto: score, failedWeight: fw, checkedWeight: T, failed: failed.map((i) => i.id) },
};
fs.writeFileSync(path.join(runDir, 'audit.json'), JSON.stringify(audit, null, 1));

// ---------- console summary ----------
const sevOrder = { high: 0, medium: 1, low: 2 };
console.log(`\nDeslop audit · ${isUrl ? target : path.relative(process.cwd(), path.resolve(target))}`);
console.log(`Run folder: ${path.relative(process.cwd(), runDir)}`);
console.log(`Automatic score: ${score}/100 (${failed.length} of 82 automatic checks failed; ${visualIds.length} visual checks still to judge)\n`);
failed.sort((a, b) => sevOrder[a.severity] - sevOrder[b.severity]).forEach((i) => console.log(`  ✗ ${i.id} [${i.severity}] ${i.name}: ${(findings[i.id].evidence || []).slice(0, 2).join('; ')}`));
if (launchBlockers.length) { console.log('\nLaunch blockers (placeholders to replace before going live):'); launchBlockers.forEach((b) => console.log(`  • ${b.id} ${b.name}: ${b.evidence.slice(0, 2).join('; ')}`)); }
console.log(`\nScreenshots: ${path.relative(process.cwd(), path.join(runDir, 'screens'))}`);
console.log('Next: judge the visual checks (deslop/indicators.json, check: "visual") from the screenshots and write visual.json in the run folder.');

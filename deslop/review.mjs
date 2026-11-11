#!/usr/bin/env node
// Build the review page for a deslop run: merges visual verdicts, turns every fix
// copy into a patch, screenshots before/after, and writes review/index.html.
//
//   node deslop/review.mjs <run>
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serveDir } from '../scripts/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const runArg = process.argv[2];
const runDir = runArg && fs.existsSync(runArg) ? path.resolve(runArg) : path.resolve('.deslop', runArg || '');
if (!runArg || !fs.existsSync(path.join(runDir, 'audit.json'))) { console.error('Usage: node deslop/review.mjs <run>'); process.exit(1); }

const audit = JSON.parse(fs.readFileSync(path.join(runDir, 'audit.json'), 'utf8'));
const catalog = JSON.parse(fs.readFileSync(path.join(HERE, 'indicators.json'), 'utf8'));
const byId = Object.fromEntries(catalog.indicators.map((i) => [i.id, i]));
const W = catalog.weights;

// ---------- merge visual verdicts ----------
const visualPath = path.join(runDir, 'visual.json');
let visual = [];
if (fs.existsSync(visualPath)) {
  const raw = JSON.parse(fs.readFileSync(visualPath, 'utf8'));
  visual = Array.isArray(raw) ? raw : Object.entries(raw).map(([id, v]) => ({ id, ...v }));
}
const findings = { ...audit.findings };
for (const v of visual) {
  if (!byId[v.id]) continue;
  const status = v.status || (v.pass === true ? 'pass' : v.pass === false ? 'fail' : 'na');
  findings[v.id] = { status, evidence: [].concat(v.evidence || v.note || []).filter(Boolean), pages: [].concat(v.page || v.pages || []) };
}
const pendingVisual = catalog.indicators.filter((i) => i.check === 'visual' && !visual.some((v) => v.id === i.id)).map((i) => i.id);
const failed = catalog.indicators.filter((i) => findings[i.id]?.status === 'fail');
const checkedW = catalog.indicators.filter((i) => ['fail', 'pass'].includes(findings[i.id]?.status)).reduce((a, i) => a + W[i.severity], 0) || 1;
const failW = failed.reduce((a, i) => a + W[i.severity], 0);
const scoreOf = (fw) => Math.round(100 * Math.max(0, 1 - fw / checkedW) ** 2);
const scoreNow = scoreOf(failW);

// ---------- fixes ----------
const fixesDir = path.join(runDir, 'fixes');
const fixIds = fs.existsSync(fixesDir) ? fs.readdirSync(fixesDir).filter((f) => fs.existsSync(path.join(fixesDir, f, 'fix.json'))).sort() : [];
const walk = (dir, rel = '') => fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((f) => { const r = path.join(rel, f.name); return f.isDirectory() ? walk(dir, r) : [r]; });
const TEXT = /\.(html?|css|js|mjs|json|svg|txt|md|xml)$/i;

const fixes = fixIds.map((id) => {
  const dir = path.join(fixesDir, id);
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'fix.json'), 'utf8'));
  const baseFiles = new Set(walk(path.join(runDir, 'base')));
  const fixFiles = new Set(walk(path.join(dir, 'site')));
  const changed = [];
  let patch = '';
  for (const rel of new Set([...baseFiles, ...fixFiles])) {
    const a = path.join(runDir, 'base', rel), b = path.join(dir, 'site', rel);
    const ea = fs.existsSync(a), eb = fs.existsSync(b);
    if (ea && eb && fs.readFileSync(a).equals(fs.readFileSync(b))) continue;
    if (!TEXT.test(rel)) { changed.push({ file: rel, binary: true }); continue; }
    let out = '';
    try { execFileSync('diff', ['-u', '--label', `a/${rel}`, '--label', `b/${rel}`, ea ? a : '/dev/null', eb ? b : '/dev/null']); }
    catch (err) { out = String(err.stdout || ''); }
    if (out) {
      patch += out.endsWith('\n') ? out : `${out}\n`;
      const add = (out.match(/^\+(?!\+\+)/gm) || []).length, del = (out.match(/^-(?!--)/gm) || []).length;
      changed.push({ file: rel, add, del });
    }
  }
  fs.writeFileSync(path.join(dir, 'fix.patch'), patch);
  const resolves = meta.indicators.filter((i) => findings[i]?.status === 'fail');
  const gain = resolves.reduce((a, i) => a + (byId[i] ? W[byId[i].severity] : 0), 0);
  return { ...meta, changed, patch, resolves, gain };
}).filter((f) => f.changed.length);

// ---------- screenshots ----------
const shotsDir = path.join(runDir, 'review', 'shots');
fs.rmSync(path.join(runDir, 'review'), { recursive: true, force: true });
fs.mkdirSync(shotsDir, { recursive: true });
if (fixes.length) {
  const { chromium } = loadPlaywright();
  const server = await serveDir(runDir);
  const browser = await chromium.launch();
  for (const [label, vp] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const ctx = await browser.newContext({ viewport: vp, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
    const pg = await ctx.newPage();
    for (const f of fixes) {
      for (const side of ['before', 'after']) {
        const rel = side === 'before' ? `base/${f.page}` : `fixes/${f.id}/site/${f.page}`;
        await pg.goto(server.url + rel.split('/').map(encodeURIComponent).join('/'), { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
        await pg.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
        const file = path.join(shotsDir, `${f.id}-${side}-${label}.jpg`);
        let done = false;
        if (f.selector) {
          const el = await pg.$(f.selector).catch(() => null);
          if (el) {
            await el.scrollIntoViewIfNeeded().catch(() => {});
            await pg.waitForTimeout(500);
            const box = await el.boundingBox();
            if (box && box.width > 10 && box.height > 10) {
              const pad = 24;
              const scrollY = await pg.evaluate(() => window.scrollY);
              const clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y + scrollY - pad), width: Math.min(vp.width, box.width + pad * 2), height: Math.min(2400, box.height + pad * 2) };
              await pg.screenshot({ path: file, type: 'jpeg', quality: 80, fullPage: true, clip }).catch(() => {});
              done = fs.existsSync(file);
            }
          }
        }
        if (!done) { await pg.evaluate(() => window.scrollTo(0, 0)); await pg.waitForTimeout(300); await pg.screenshot({ path: file, type: 'jpeg', quality: 80 }); }
      }
    }
    await ctx.close();
  }
  await browser.close();
  server.close();
}

// ---------- page ----------
const projected = scoreOf(failW - fixes.reduce((a, f) => a + f.gain, 0));
const data = {
  run: audit.run, target: audit.target, mode: audit.mode, prototype: audit.prototype, created: audit.created,
  scoreNow, failW, checkedW, projected, pendingVisual,
  categories: catalog.categories,
  findings: catalog.indicators.map((i) => ({ ...i, ...(findings[i.id] || { status: 'na' }) })),
  launchBlockers: audit.launchBlockers || [],
  fixes: fixes.map((f) => ({ id: f.id, title: f.title, why: f.why, page: f.page, indicators: f.indicators.map((i) => ({ id: i, name: byId[i]?.name || i, severity: byId[i]?.severity || 'low', failing: f.resolves.includes(i) })), gain: f.gain, changed: f.changed, patch: f.patch.slice(0, 60000) })),
  pages: audit.pages,
};
fs.writeFileSync(path.join(runDir, 'review', 'data.json'), JSON.stringify(data, null, 1));
fs.writeFileSync(path.join(runDir, 'review', 'index.html'), renderPage(data));

// Markdown report alongside, for sharing or pasting.
const md = [`# Deslop report: ${audit.mode === 'url' ? audit.target : path.basename(audit.target)}`, '', `Score now: **${scoreNow}/100**. With all ${fixes.length} proposed fixes: **${projected}/100**.`, ''];
for (const cat of Object.keys(catalog.categories)) {
  const fl = data.findings.filter((f) => f.category === cat && f.status === 'fail');
  if (!fl.length) continue;
  md.push(`## ${catalog.categories[cat]}`, '');
  fl.forEach((f) => md.push(`- **${f.id} ${f.name}** (${f.severity}). ${(f.evidence || []).slice(0, 3).join('; ')}. Fix: ${f.fix}`));
  md.push('');
}
if (data.launchBlockers.length) { md.push('## Before launch', ''); data.launchBlockers.forEach((b) => md.push(`- ${b.id} ${b.name}: ${b.evidence.slice(0, 2).join('; ')}`)); md.push(''); }
if (fixes.length) { md.push('## Proposed fixes', ''); fixes.forEach((f) => md.push(`- **${f.id} ${f.title}** (${f.indicators.join(', ')}, +${f.gain} pts): ${f.why}`)); }
fs.writeFileSync(path.join(runDir, 'report.md'), md.join('\n') + '\n');

console.log(JSON.stringify({ review: path.relative(process.cwd(), path.join(runDir, 'review', 'index.html')), scoreNow, projected, fixes: fixes.length, pendingVisual: pendingVisual.length }));

function renderPage(d) {
  const json = JSON.stringify(d).replace(/</g, '\\u003c');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Deslop review</title>
<style>
:root { --bg:#f6f5f2; --panel:#fff; --ink:#18181b; --ink2:#5b5b63; --line:#e4e2dc; --accent:#1f6f4a; --accent-ink:#fff; --bad:#b42318; --warn:#b54708; --low:#5b5b63; --chip:#f0eee8; --shadow:0 1px 0 rgba(0,0,0,.04), 0 8px 24px -16px rgba(0,0,0,.25); }
@media (prefers-color-scheme: dark) { :root { --bg:#111113; --panel:#19191c; --ink:#ededee; --ink2:#a1a1aa; --line:#2b2b30; --accent:#4ade80; --accent-ink:#06210f; --bad:#f97066; --warn:#fdb022; --low:#a1a1aa; --chip:#232327; } }
* { box-sizing: border-box; } body { margin:0; background:var(--bg); color:var(--ink); font:15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
.wrap { max-width:1180px; margin:0 auto; padding:0 20px; }
header.top { padding:28px 0 20px; border-bottom:1px solid var(--line); }
.kicker { font:600 12px/1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing:.08em; text-transform:uppercase; color:var(--ink2); }
h1 { font-size:26px; line-height:1.15; margin:8px 0 4px; letter-spacing:-.01em; }
.target { color:var(--ink2); word-break:break-all; }
.scores { display:flex; gap:12px; flex-wrap:wrap; margin-top:20px; }
.score { background:var(--panel); border:1px solid var(--line); border-radius:12px; padding:14px 18px; min-width:150px; box-shadow:var(--shadow); }
.score b { display:block; font-size:34px; line-height:1; letter-spacing:-.02em; font-variant-numeric:tabular-nums; }
.score span { color:var(--ink2); font-size:13px; }
.tabs { display:flex; gap:4px; margin:24px 0 16px; border-bottom:1px solid var(--line); overflow-x:auto; }
.tabs button { background:none; border:0; border-bottom:2px solid transparent; padding:10px 12px; font:inherit; font-weight:600; color:var(--ink2); cursor:pointer; white-space:nowrap; }
.tabs button[aria-selected="true"] { color:var(--ink); border-color:var(--ink); }
.panel[hidden] { display:none; }
.fix { background:var(--panel); border:1px solid var(--line); border-radius:14px; margin-bottom:18px; box-shadow:var(--shadow); overflow:hidden; }
.fix.accepted { border-color:color-mix(in srgb, var(--accent) 55%, var(--line)); }
.fix.rejected { opacity:.62; }
.fix-head { display:flex; gap:16px; justify-content:space-between; align-items:flex-start; padding:18px 18px 12px; flex-wrap:wrap; }
.fix-head h2 { font-size:18px; margin:2px 0 6px; }
.fix-head p { margin:0; color:var(--ink2); max-width:70ch; }
.chips { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
.chip { display:inline-flex; gap:6px; align-items:center; font-size:12.5px; background:var(--chip); border-radius:999px; padding:3px 10px; }
.dot { width:7px; height:7px; border-radius:50%; background:var(--low); } .dot.high { background:var(--bad); } .dot.medium { background:var(--warn); }
.gain { font:600 13px/1 ui-monospace, monospace; color:var(--accent); white-space:nowrap; }
.decide { display:inline-flex; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
.decide button { border:0; background:var(--panel); color:var(--ink); padding:9px 14px; font:inherit; font-weight:600; cursor:pointer; min-height:40px; }
.decide button + button { border-left:1px solid var(--line); }
.decide button[aria-pressed="true"].yes { background:var(--accent); color:var(--accent-ink); }
.decide button[aria-pressed="true"].no { background:var(--ink); color:var(--bg); }
.compare-bar { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:0 18px 10px; flex-wrap:wrap; }
.seg { display:inline-flex; background:var(--chip); border-radius:9px; padding:3px; }
.seg button { border:0; background:none; padding:6px 10px; border-radius:7px; font:inherit; font-size:13px; font-weight:600; color:var(--ink2); cursor:pointer; }
.seg button[aria-pressed="true"] { background:var(--panel); color:var(--ink); box-shadow:0 1px 2px rgba(0,0,0,.12); }
.compare { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line); border-top:1px solid var(--line); }
.compare.mobile { grid-template-columns:repeat(2, minmax(0, 340px)); justify-content:center; background:var(--chip); gap:24px; padding:18px; }
.compare figure { margin:0; background:var(--panel); position:relative; }
.compare figcaption { position:absolute; top:10px; left:10px; font:600 11px/1 ui-monospace, monospace; letter-spacing:.06em; text-transform:uppercase; background:rgba(0,0,0,.7); color:#fff; padding:5px 7px; border-radius:5px; }
.compare img { display:block; width:100%; height:auto; }
.slider { position:relative; border-top:1px solid var(--line); background:var(--chip); }
.slider .layer { position:relative; max-width:100%; margin:0 auto; }
.slider img { display:block; width:100%; height:auto; }
.slider .after { position:absolute; inset:0; overflow:hidden; clip-path:inset(0 0 0 var(--pos, 50%)); }
.slider input { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:ew-resize; }
.slider .handle { position:absolute; top:0; bottom:0; left:var(--pos, 50%); width:2px; background:#fff; box-shadow:0 0 0 1px rgba(0,0,0,.3); pointer-events:none; }
details.diff { border-top:1px solid var(--line); }
details.diff summary { padding:12px 18px; cursor:pointer; color:var(--ink2); font-weight:600; font-size:13.5px; }
details.diff pre { margin:0; padding:12px 18px 18px; overflow:auto; max-height:420px; font:12.5px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace; }
.add { color:#1a7f37; } .del { color:#cf222e; } .hunk { color:#8250df; }
@media (prefers-color-scheme: dark) { .add { color:#56d364; } .del { color:#ff7b72; } .hunk { color:#d2a8ff; } }
table { width:100%; border-collapse:collapse; background:var(--panel); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; font-size:14px; }
th { font-size:12px; text-transform:uppercase; letter-spacing:.06em; color:var(--ink2); }
.status { font:600 12px/1 ui-monospace, monospace; text-transform:uppercase; }
.status.fail { color:var(--bad); } .status.pass { color:var(--accent); } .status.na, .status.deferred { color:var(--ink2); }
.filters { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px; }
.empty { background:var(--panel); border:1px dashed var(--line); border-radius:12px; padding:28px; color:var(--ink2); }
.bar { position:sticky; bottom:0; background:color-mix(in srgb, var(--panel) 94%, transparent); backdrop-filter:blur(8px); border-top:1px solid var(--line); margin-top:28px; }
.bar .wrap { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px 20px; flex-wrap:wrap; }
.btn { border:0; border-radius:10px; padding:11px 16px; font:inherit; font-weight:700; cursor:pointer; min-height:44px; }
.btn.primary { background:var(--accent); color:var(--accent-ink); } .btn.ghost { background:var(--chip); color:var(--ink); }
.btn[disabled] { opacity:.5; cursor:not-allowed; }
.note { color:var(--ink2); font-size:13.5px; }
.toast { position:fixed; left:50%; bottom:84px; transform:translateX(-50%); background:var(--ink); color:var(--bg); padding:12px 16px; border-radius:10px; font-weight:600; box-shadow:var(--shadow); }
@media (max-width:720px) { .compare { grid-template-columns:1fr; } .compare.mobile { grid-template-columns:1fr; } h1 { font-size:22px; } }
</style>
</head>
<body>
<header class="top"><div class="wrap">
  <p class="kicker">Deslop review · run ${escapeHtml(d.run)}</p>
  <h1 id="title"></h1>
  <p class="target" id="target"></p>
  <div class="scores">
    <div class="score"><b id="now"></b><span>score now</span></div>
    <div class="score"><b id="proj"></b><span>with accepted fixes</span></div>
    <div class="score"><b id="failing"></b><span>indicators failing</span></div>
  </div>
</div></header>
<main class="wrap">
  <div class="tabs" role="tablist">
    <button role="tab" aria-selected="true" data-tab="fixes">Proposed fixes</button>
    <button role="tab" aria-selected="false" data-tab="findings">All 100 indicators</button>
    <button role="tab" aria-selected="false" data-tab="blockers">Before launch</button>
  </div>
  <section class="panel" id="panel-fixes"></section>
  <section class="panel" id="panel-findings" hidden></section>
  <section class="panel" id="panel-blockers" hidden></section>
</main>
<div class="bar"><div class="wrap">
  <p class="note" id="tally"></p>
  <div style="display:flex; gap:8px; flex-wrap:wrap">
    <button class="btn ghost" id="all-yes">Accept all</button>
    <button class="btn ghost" id="copy">Copy apply command</button>
    <button class="btn primary" id="apply">Apply accepted fixes</button>
  </div>
</div></div>
<script>
const D = ${json};
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const KEY = 'deslop:' + D.run;
let decisions = {};
try { decisions = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (_) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(decisions)); } catch (_) {} };

$('#title').textContent = D.mode === 'url' ? 'Live site audit' : 'Site audit';
$('#target').textContent = D.target;
$('#now').textContent = D.scoreNow;
$('#failing').textContent = D.findings.filter((f) => f.status === 'fail').length;

function render() {
  const accepted = D.fixes.filter((f) => decisions[f.id] === 'accept');
  const proj = Math.round(100 * Math.max(0, 1 - (D.failW - accepted.reduce((a, f) => a + f.gain, 0)) / D.checkedW) ** 2);
  $('#proj').textContent = proj;
  const rej = D.fixes.filter((f) => decisions[f.id] === 'reject').length;
  $('#tally').textContent = D.fixes.length ? accepted.length + ' accepted · ' + rej + ' rejected · ' + (D.fixes.length - accepted.length - rej) + ' undecided' : 'No fixes proposed yet';
  $('#apply').disabled = !accepted.length;
  D.fixes.forEach((f) => { const card = document.getElementById('fix-' + f.id); if (!card) return; card.classList.toggle('accepted', decisions[f.id] === 'accept'); card.classList.toggle('rejected', decisions[f.id] === 'reject'); card.querySelector('.yes').setAttribute('aria-pressed', decisions[f.id] === 'accept'); card.querySelector('.no').setAttribute('aria-pressed', decisions[f.id] === 'reject'); });
}

function diffHtml(p) { return esc(p).split('\\n').map((l) => l.startsWith('+') && !l.startsWith('+++') ? '<span class="add">' + l + '</span>' : l.startsWith('-') && !l.startsWith('---') ? '<span class="del">' + l + '</span>' : l.startsWith('@@') ? '<span class="hunk">' + l + '</span>' : l).join('\\n'); }

function compare(f, device, mode) {
  const b = 'shots/' + f.id + '-before-' + device + '.jpg', a = 'shots/' + f.id + '-after-' + device + '.jpg';
  if (mode === 'slider') return '<div class="slider"><div class="layer" style="max-width:' + (device === 'mobile' ? '390px' : '100%') + '"><img src="' + b + '" alt="Before"><div class="after"><img src="' + a + '" alt="After"></div><div class="handle"></div><input type="range" min="0" max="100" value="50" aria-label="Drag to compare before and after"></div></div>';
  return '<div class="compare ' + device + '"><figure><img src="' + b + '" alt="Before" loading="lazy"><figcaption>Before</figcaption></figure><figure><img src="' + a + '" alt="After" loading="lazy"><figcaption>After</figcaption></figure></div>';
}

const fp = $('#panel-fixes');
if (!D.fixes.length) fp.innerHTML = '<div class="empty">No fixes have been proposed for this run yet. Ask Claude to run /deslopify again, or read the full list under “All 100 indicators”.</div>';
D.fixes.forEach((f) => {
  const card = document.createElement('article');
  card.className = 'fix'; card.id = 'fix-' + f.id;
  card.innerHTML = '<div class="fix-head"><div><p class="kicker">' + esc(f.id) + ' · ' + esc(f.page) + '</p><h2>' + esc(f.title) + '</h2><p>' + esc(f.why) + '</p><div class="chips">' + f.indicators.map((i) => '<span class="chip"><span class="dot ' + i.severity + '"></span>' + esc(i.id) + ' ' + esc(i.name) + '</span>').join('') + '</div></div>' +
    '<div style="display:grid; gap:8px; justify-items:end"><span class="gain">clears ' + f.indicators.filter((i) => i.failing).length + ' failing</span><div class="decide"><button class="yes" aria-pressed="false">Accept</button><button class="no" aria-pressed="false">Reject</button></div></div></div>' +
    '<div class="compare-bar"><div class="seg" data-k="device"><button aria-pressed="true" data-v="desktop">Desktop</button><button aria-pressed="false" data-v="mobile">Mobile</button></div><div class="seg" data-k="mode"><button aria-pressed="true" data-v="side">Side by side</button><button aria-pressed="false" data-v="slider">Slider</button></div></div>' +
    '<div class="cmp"></div>' +
    '<details class="diff"><summary>Code changes · ' + f.changed.map((c) => esc(c.file) + (c.binary ? '' : ' (+' + c.add + ' −' + c.del + ')')).join(', ') + '</summary><pre>' + diffHtml(f.patch) + '</pre></details>';
  const state = { device: 'desktop', mode: 'side' };
  const draw = () => {
    card.querySelector('.cmp').innerHTML = compare(f, state.device, state.mode);
    const r = card.querySelector('.slider input'); if (r) r.addEventListener('input', () => card.querySelector('.slider .layer').style.setProperty('--pos', r.value + '%'));
  };
  card.querySelectorAll('.seg').forEach((seg) => seg.addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); state[seg.dataset.k] = b.dataset.v; draw(); }));
  card.querySelector('.yes').addEventListener('click', () => { decisions[f.id] = decisions[f.id] === 'accept' ? undefined : 'accept'; save(); render(); });
  card.querySelector('.no').addEventListener('click', () => { decisions[f.id] = decisions[f.id] === 'reject' ? undefined : 'reject'; save(); render(); });
  draw();
  fp.appendChild(card);
});

// findings table
const fl = $('#panel-findings');
const order = { fail: 0, deferred: 1, pass: 2, na: 3 };
const rows = [...D.findings].sort((a, b) => (order[a.status] ?? 4) - (order[b.status] ?? 4) || a.id.localeCompare(b.id));
fl.innerHTML = '<div class="filters seg" id="ff"><button aria-pressed="true" data-v="fail">Failing</button><button aria-pressed="false" data-v="all">All</button></div><table><thead><tr><th>ID</th><th>Indicator</th><th>Status</th><th>Evidence and fix</th></tr></thead><tbody></tbody></table>' + (D.pendingVisual.length ? '<p class="note" style="margin-top:10px">Visual checks not yet judged: ' + D.pendingVisual.join(', ') + '</p>' : '');
const tbody = fl.querySelector('tbody');
const drawRows = (which) => { tbody.innerHTML = rows.filter((r) => which === 'all' || r.status === 'fail').map((r) => '<tr><td><span class="dot ' + r.severity + '" style="display:inline-block;margin-right:6px"></span>' + r.id + '</td><td><strong>' + esc(r.name) + '</strong><br><span class="note">' + esc(D.categories[r.category]) + ' · ' + r.severity + ' · ' + r.check + '</span></td><td><span class="status ' + r.status + '">' + r.status + '</span></td><td>' + (r.evidence && r.evidence.length ? esc(r.evidence.slice(0, 3).join('; ')) + '<br>' : '') + '<span class="note">' + esc(r.status === 'fail' ? r.fix : r.why) + '</span></td></tr>').join(''); };
drawRows('fail');
$('#ff').addEventListener('click', (ev) => { const b = ev.target.closest('button'); if (!b) return; $('#ff').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); drawRows(b.dataset.v); });

const bl = $('#panel-blockers');
bl.innerHTML = D.launchBlockers.length ? '<table><thead><tr><th>ID</th><th>Replace before launch</th><th>Details</th></tr></thead><tbody>' + D.launchBlockers.map((b) => '<tr><td>' + b.id + '</td><td><strong>' + esc(b.name) + '</strong></td><td>' + esc(b.evidence.slice(0, 3).join('; ')) + '</td></tr>').join('') + '</tbody></table>' : '<div class="empty">Nothing flagged. Placeholder checks run when the audit uses --prototype.</div>';

document.querySelectorAll('[role="tab"]').forEach((t) => t.addEventListener('click', () => { document.querySelectorAll('[role="tab"]').forEach((x) => x.setAttribute('aria-selected', x === t)); document.querySelectorAll('.panel').forEach((p) => { p.hidden = p.id !== 'panel-' + t.dataset.tab; }); }));
$('#all-yes').addEventListener('click', () => { D.fixes.forEach((f) => { if (decisions[f.id] !== 'reject') decisions[f.id] = 'accept'; }); save(); render(); });
const cmd = () => 'node deslop/apply.mjs ' + D.run + ' --ids ' + D.fixes.filter((f) => decisions[f.id] === 'accept').map((f) => f.id).join(',');
const toast = (m) => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 3200); };
$('#copy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(cmd()); toast('Copied. Paste it to Claude or run it.'); } catch (_) { prompt('Copy this command', cmd()); } });
$('#apply').addEventListener('click', async () => {
  const body = { accepted: D.fixes.filter((f) => decisions[f.id] === 'accept').map((f) => f.id), rejected: D.fixes.filter((f) => decisions[f.id] === 'reject').map((f) => f.id), at: new Date().toISOString() };
  try {
    const r = await fetch('/api/decisions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error(r.status);
    toast('Saved ' + body.accepted.length + ' accepted fixes. Tell Claude “apply them”.');
  } catch (_) { try { await navigator.clipboard.writeText(cmd()); } catch (e) {} toast('Review server not running. Apply command copied instead.'); }
});
render();
</script>
</body>
</html>`;
}
function escapeHtml(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

#!/usr/bin/env node
// Prints what this toolkit contains. Runs as the SessionStart hook (with --hook)
// so Claude can open every session with an up-to-date status update.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const hook = process.argv.includes('--hook');
const read = (p, d) => { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch (_) { return d; } };
const ls = (p) => { try { return fs.readdirSync(path.join(ROOT, p)); } catch (_) { return []; } };

const sectionFiles = ls('library/sections').filter((f) => f.endsWith('.json'));
let refs = 0, newest = '';
const perSection = sectionFiles.map((f) => { const d = read(`library/sections/${f}`, {}); const n = (d.references || []).length; refs += n; if ((d.collected_at || '') > newest) newest = d.collected_at; return `${f.replace('.json', '')} ${n}`; });
const directions = read('library/styles-research/directions.json', { directions: [] }).directions.length;
const tp = read('library/trade-patterns.json', null);
const styles = ls('styles').filter((d) => fs.existsSync(path.join(ROOT, 'styles', d, 'style.json')));
const trades = ls('trades').filter((f) => f.endsWith('.json') && f !== 'photos.json').map((f) => f.replace('.json', ''));
const photos = Object.values(read('trades/photos.json', { trades: {} }).trades || {}).reduce((a, l) => a + l.length, 0);
const ind = read('deslop/indicators.json', { indicators: [] }).indicators;
const examples = ls('examples').filter((d) => fs.existsSync(path.join(ROOT, 'examples', d, 'site.json')));
const sites = ls('sites').filter((d) => fs.existsSync(path.join(ROOT, 'sites', d, 'site.json')));
const runs = ls('.deslop');
const ageDays = newest ? Math.floor((Date.now() - new Date(newest).getTime()) / 864e5) : null;

const lines = [];
const missing = sectionFiles.length < 5;
lines.push(`Prototype toolkit status (${new Date().toISOString().slice(0, 10)})`);
lines.push(missing
  ? '- Library: MISSING or incomplete. Run /refresh-library (needs the Mobbin MCP; see .mcp.json).'
  : `- Reference library: ${refs} references across ${sectionFiles.length} section types (Mobbin, collected ${newest}${ageDays != null ? `, ${ageDays} days ago` : ''}), ${directions} style directions${tp ? `, ${tp.sites?.length || 0} real trade sites and ${tp.conversion_patterns?.length || 0} conversion patterns` : ''}.`);
lines.push(`- Styles (${styles.length}): ${styles.join(', ')}`);
lines.push(`- Trade packs (${trades.length}): ${trades.join(', ')}; ${photos} placeholder photos`);
lines.push(`- Deslop checks: ${ind.length} indicators (${ind.filter((i) => i.check === 'auto').length} automatic, ${ind.filter((i) => i.check === 'visual').length} visual)`);
lines.push(`- Examples: ${examples.length} demo sites in examples/ · Your prototypes in sites/: ${sites.length ? sites.join(', ') : 'none yet'}${runs.length ? ` · ${runs.length} deslop runs in .deslop/` : ''}`);
lines.push('- Skills: /prototype (build a clickable site from a few details, a website or a Google listing), /deslopify (audit + fix with before/after review), /refresh-library (re-scrape Mobbin)');
if (ageDays != null && ageDays > 90) lines.push(`- Note: the library is ${ageDays} days old. Offer /refresh-library if the Mobbin MCP is connected.`);
if (!fs.existsSync(path.join(ROOT, 'node_modules', 'playwright'))) lines.push('- Screenshots and audits need Playwright: run `npm install` (and `npx playwright install chromium` if no browser is installed). Skip if it already works.');

if (hook) {
  console.log('<prototype-status>');
  console.log(lines.join('\n'));
  console.log('Open your first reply in this session with a short version of this status (see CLAUDE.md, "Start of every session"), unless the user has already asked for something specific; then answer that first and add one status line at the end.');
  console.log('</prototype-status>');
} else {
  console.log(lines.join('\n'));
  if (process.argv.includes('--verbose')) console.log(`\nLibrary sections: ${perSection.join(' · ')}`);
}

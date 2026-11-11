#!/usr/bin/env node
// Apply accepted fixes from a deslop run to the real site.
//
//   node deslop/apply.mjs <run>                 # uses decisions.json from the review page
//   node deslop/apply.mjs <run> --ids F01,F03   # explicit list
//   node deslop/apply.mjs <run> --all
//   node deslop/apply.mjs <run> --mockup        # URL audits: build a patched copy instead
//
// Each patch is dry-run first, then applied; a patch that no longer applies
// cleanly is skipped and reported so Claude can merge it by hand.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const runArg = args[0];
const runDir = runArg && fs.existsSync(runArg) ? path.resolve(runArg) : path.resolve('.deslop', runArg || '');
if (!runArg || !fs.existsSync(path.join(runDir, 'audit.json'))) { console.error('Usage: node deslop/apply.mjs <run> [--ids F01,F02 | --all] [--mockup]'); process.exit(1); }
const audit = JSON.parse(fs.readFileSync(path.join(runDir, 'audit.json'), 'utf8'));
const fixesDir = path.join(runDir, 'fixes');
const allIds = fs.existsSync(fixesDir) ? fs.readdirSync(fixesDir).filter((f) => fs.existsSync(path.join(fixesDir, f, 'fix.patch'))).sort() : [];

let ids;
if (args.includes('--all')) ids = allIds;
else if (args.includes('--ids')) ids = args[args.indexOf('--ids') + 1].split(',').map((s) => s.trim()).filter(Boolean);
else if (fs.existsSync(path.join(runDir, 'decisions.json'))) ids = JSON.parse(fs.readFileSync(path.join(runDir, 'decisions.json'), 'utf8')).accepted || [];
else { console.error('No decisions yet. Accept fixes on the review page, or pass --ids / --all.'); process.exit(1); }

const mockup = args.includes('--mockup') || audit.mode === 'url';
let target = audit.target;
if (mockup) {
  target = path.join(runDir, 'mockup');
  fs.rmSync(target, { recursive: true, force: true });
  fs.cpSync(path.join(runDir, 'base'), target, { recursive: true });
}
if (!fs.existsSync(target)) { console.error(`Target folder not found: ${target}`); process.exit(1); }

const applied = [], skipped = [];
for (const id of ids) {
  const patch = path.join(fixesDir, id, 'fix.patch');
  if (!fs.existsSync(patch) || !fs.statSync(patch).size) { skipped.push({ id, why: 'no patch (run deslop/review.mjs first, or the fix changed nothing)' }); continue; }
  const run = (extra) => execFileSync('patch', ['-p1', '--forward', '--batch', '-d', target, ...extra, '-i', patch], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  try { run(['--dry-run']); run([]); applied.push(id); }
  catch (err) { skipped.push({ id, why: (err.stdout || err.message).split('\n').filter(Boolean).slice(-2).join(' ') }); }
}
fs.writeFileSync(path.join(runDir, 'applied.json'), JSON.stringify({ target, mockup, applied, skipped, at: new Date().toISOString() }, null, 2));
console.log(JSON.stringify({ target: path.relative(process.cwd(), target) || '.', mockup, applied, skipped }, null, 1));
if (skipped.length) console.log('Skipped patches conflict with earlier changes: merge them by hand from fixes/<ID>/site.');
if (!mockup) console.log(`Re-audit: node deslop/audit.mjs ${path.relative(process.cwd(), target)}${audit.prototype ? ' --prototype' : ''}`);

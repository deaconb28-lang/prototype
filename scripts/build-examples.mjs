#!/usr/bin/env node
// Builds one fictional demo site per style into examples/<style>/ and screenshots it.
//   node scripts/build-examples.mjs [--no-shots] [--only <style>]
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT } from '../engine/util.mjs';

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const { demos } = JSON.parse(fs.readFileSync(path.join(ROOT, 'examples', 'demos.json'), 'utf8'));
const rows = [];
for (const d of demos) {
  if (only && d.style !== only) continue;
  const dir = path.join(ROOT, 'examples', d.style);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'site.json'), JSON.stringify({ style: d.style, business: d.business, copy: d.copy || {} }, null, 2) + '\n');
  execFileSync('node', [path.join(ROOT, 'engine', 'build.mjs'), dir, '--out', path.join(dir, 'site')], { stdio: 'inherit' });
  if (!args.includes('--no-shots')) {
    execFileSync('node', [path.join(ROOT, 'scripts', 'screenshot.mjs'), path.join(dir, 'site'), '--out', path.join(dir, 'screens'), '--jpeg'], { stdio: 'inherit' });
    execFileSync('node', [path.join(ROOT, 'scripts', 'screenshot.mjs'), path.join(dir, 'site'), '--out', path.join(dir, 'screens'), '--jpeg', '--full'], { stdio: 'inherit' });
    fs.rmSync(path.join(dir, 'screens', 'index-mobile-full.jpg'), { force: true });
  }
  rows.push(d);
}
console.log(`built ${rows.length} example(s)`);

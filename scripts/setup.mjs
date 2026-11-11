#!/usr/bin/env node
// One-time setup: installs Playwright + Chromium for screenshots and deslop audits.
// Installs into the toolkit folder when it's a writable git checkout, otherwise into
// a shared cache (~/.cache/prototype-toolkit) that every project and the plugin use.
//   node scripts/setup.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { KIT_ROOT, DEPS_DIR, loadPlaywright } from './lib.mjs';

if (loadPlaywright({ optional: true })) {
  console.log('Playwright is already available.');
} else {
  const inRepo = fs.existsSync(path.join(KIT_ROOT, '.git'));
  const prefix = inRepo ? KIT_ROOT : DEPS_DIR;
  fs.mkdirSync(prefix, { recursive: true });
  if (!inRepo && !fs.existsSync(path.join(prefix, 'package.json'))) fs.writeFileSync(path.join(prefix, 'package.json'), '{ "private": true }\n');
  console.log(`Installing Playwright into ${prefix} ...`);
  execSync(inRepo ? 'npm install --no-audit --no-fund' : 'npm install --no-audit --no-fund playwright@^1.48.0', { cwd: prefix, stdio: 'inherit' });
}
try {
  const { chromium } = loadPlaywright();
  const b = await chromium.launch(); await b.close();
  console.log('Chromium works. Setup done.');
} catch (_) {
  console.log('Installing Chromium for Playwright ...');
  const prefix = fs.existsSync(path.join(KIT_ROOT, 'node_modules', 'playwright')) ? KIT_ROOT : DEPS_DIR;
  execSync('npx --yes playwright install chromium', { cwd: prefix, stdio: 'inherit' });
  console.log('Setup done.');
}

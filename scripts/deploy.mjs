#!/usr/bin/env node
// Deploy a built prototype to Vercel and print a shareable link.
//
//   node scripts/deploy.mjs sites/<slug> [--preview] [--project <name>] [--scope <team-slug>]
//
// - Uses the `vercel` CLI if installed, otherwise `npx vercel@65`.
// - Auth: an existing `vercel login`, or a token in VERCEL_TOKEN (create one at
//   https://vercel.com/account/tokens).
// - Default target is production of a per-prospect project named "<slug>-preview",
//   so the link is https://<slug>-preview.vercel.app and opens without a Vercel login.
//   (--preview makes a preview deployment instead; on most accounts those sit behind
//   Vercel Authentication, so the business owner would see a login wall.)
// - The project link is kept in dist/.vercel, so redeploys after a rebuild reuse it.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && ['--project', '--scope'].includes(args[i - 1])));
if (!target) { console.error('Usage: node scripts/deploy.mjs sites/<slug> [--preview] [--project name] [--scope team]'); process.exit(1); }

const siteDir = path.resolve(target);
const dist = fs.existsSync(path.join(siteDir, 'dist', 'index.html')) ? path.join(siteDir, 'dist') : siteDir;
if (!fs.existsSync(path.join(dist, 'index.html'))) { console.error(`No built site at ${dist}. Run engine/build.mjs first.`); process.exit(1); }
const slug = path.basename(dist === siteDir ? path.dirname(siteDir) : siteDir).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'prototype';
const project = (opt('project') || `${slug}-preview`).toLowerCase();
const prod = !args.includes('--preview');

const hasGlobal = spawnSync(process.platform === 'win32' ? 'where' : 'which', ['vercel'], { encoding: 'utf8' }).status === 0;
const base = hasGlobal ? ['vercel'] : ['npx', '--yes', 'vercel@65'];
const extra = [];
if (process.env.VERCEL_TOKEN) extra.push('--token', process.env.VERCEL_TOKEN);
if (opt('scope')) extra.push('--scope', opt('scope'));
const run = (sub) => {
  const r = spawnSync(base[0], [...base.slice(1), ...sub, ...extra], { cwd: dist, encoding: 'utf8', env: { ...process.env, CI: '1' } });
  return { ok: r.status === 0, out: `${r.stdout || ''}`, err: `${r.stderr || ''}` };
};

const who = run(['whoami']);
if (!who.ok) {
  console.error([
    'Not logged in to Vercel. Either:',
    '  1. Run `npx vercel login` in your own terminal (or type `! npx vercel login` in Claude Code), then run this again, or',
    '  2. Create a token at https://vercel.com/account/tokens and set VERCEL_TOKEN for this session.',
  ].join('\n'));
  process.exit(4);
}

const link = run(['link', '--yes', '--project', project]);
if (!link.ok) { console.error(`vercel link failed:\n${link.err || link.out}`); process.exit(5); }

const dep = run(['deploy', '--yes', ...(prod ? ['--prod'] : [])]);
if (!dep.ok) { console.error(`vercel deploy failed:\n${dep.err || dep.out}`); process.exit(6); }
const urls = [...new Set(`${dep.out}\n${dep.err}`.match(/https:\/\/[a-z0-9.-]+\.vercel\.app/gi) || [])];
const deploymentUrl = (dep.out.match(/https:\/\/\S+/) || [])[0] || urls[0];
const alias = urls.find((u) => u.toLowerCase() === `https://${project}.vercel.app`) || urls.find((u) => !/-[a-z0-9]{9}-/.test(u)) || null;
console.log(JSON.stringify({ project, target: prod ? 'production' : 'preview', url: alias || deploymentUrl, deploymentUrl, account: who.out.trim().split('\n').pop() }, null, 1));

#!/usr/bin/env node
// Create or list fix candidates for a deslop run. Each fix is a full copy of the
// audited site that Claude edits; review.mjs diffs it against the base and
// screenshots before/after.
//
//   node deslop/fix.mjs new <run> <ID> --title "Plain headline" --indicators C01,C03 --page index.html [--selector ".hero"] [--why "..."]
//   node deslop/fix.mjs list <run>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const [cmd, runArg, id] = args;
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const runDir = fs.existsSync(runArg || '') ? path.resolve(runArg) : path.resolve('.deslop', runArg || '');
if (!cmd || !runArg || !fs.existsSync(path.join(runDir, 'audit.json'))) {
  console.error('Usage:\n  node deslop/fix.mjs new <run> <ID> --title "..." --indicators C01,C03 --page index.html [--selector ".hero"] [--why "..."]\n  node deslop/fix.mjs list <run>');
  process.exit(1);
}
const copy = (src, dst) => { fs.mkdirSync(dst, { recursive: true }); for (const f of fs.readdirSync(src, { withFileTypes: true })) { const s = path.join(src, f.name), d = path.join(dst, f.name); if (f.isDirectory()) copy(s, d); else fs.copyFileSync(s, d); } };

if (cmd === 'new') {
  if (!id || !/^[A-Za-z0-9_-]+$/.test(id)) { console.error('Give the fix an ID like F01.'); process.exit(1); }
  const dir = path.join(runDir, 'fixes', id);
  if (fs.existsSync(dir)) { console.error(`Fix ${id} already exists at ${dir}`); process.exit(1); }
  copy(path.join(runDir, 'base'), path.join(dir, 'site'));
  const meta = {
    id,
    title: opt('title', id),
    why: opt('why', ''),
    indicators: (opt('indicators', '') || '').split(',').map((s) => s.trim()).filter(Boolean),
    page: opt('page', 'index.html'),
    selector: opt('selector', ''),
    created: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(dir, 'fix.json'), JSON.stringify(meta, null, 2));
  console.log(`Created ${path.relative(process.cwd(), dir)}\nEdit files in ${path.relative(process.cwd(), path.join(dir, 'site'))} (only the parts this fix is about).`);
} else if (cmd === 'list') {
  const fixesDir = path.join(runDir, 'fixes');
  const ids = fs.existsSync(fixesDir) ? fs.readdirSync(fixesDir) : [];
  for (const f of ids) { const m = JSON.parse(fs.readFileSync(path.join(fixesDir, f, 'fix.json'), 'utf8')); console.log(`${m.id}\t${m.indicators.join(',')}\t${m.page}\t${m.title}`); }
  if (!ids.length) console.log('No fixes yet.');
} else {
  console.error(`Unknown command ${cmd}`); process.exit(1);
}

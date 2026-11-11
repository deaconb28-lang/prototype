#!/usr/bin/env node
// Serve a built site locally so it can be clicked through.
//   node scripts/serve.mjs sites/<slug>/dist [--port 4173] [--host 0.0.0.0]
import path from 'node:path';
import fs from 'node:fs';
import { serveDir } from './lib.mjs';

const args = process.argv.slice(2);
const dir = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
if (!fs.existsSync(path.join(dir, 'index.html'))) { console.error(`No index.html in ${dir}`); process.exit(1); }
const port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 4173);
const host = args.includes('--host') ? args[args.indexOf('--host') + 1] : '127.0.0.1';
const { url } = await serveDir(dir, { port, host });
console.log(`Serving ${path.relative(process.cwd(), dir) || '.'} at ${url}`);

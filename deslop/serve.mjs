#!/usr/bin/env node
// Serve a deslop run's review page. Clicking "Apply accepted fixes" in the page
// writes decisions.json into the run folder, which apply.mjs reads.
//
//   node deslop/serve.mjs <run> [--port 4321]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveDir, readBody } from '../scripts/lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const runArg = args[0];
const runDir = runArg && fs.existsSync(runArg) ? path.resolve(runArg) : path.resolve('.deslop', runArg || '');
if (!runArg || !fs.existsSync(path.join(runDir, 'review', 'index.html'))) { console.error('Usage: node deslop/serve.mjs <run>   (run deslop/review.mjs first)'); process.exit(1); }
const port = Number(args.includes('--port') ? args[args.indexOf('--port') + 1] : 4321);

const { url } = await serveDir(path.join(runDir, 'review'), {
  port,
  host: process.env.HOST || '127.0.0.1',
  routes: {
    'POST /api/decisions': async (req, res) => {
      try {
        const body = JSON.parse(await readBody(req));
        fs.writeFileSync(path.join(runDir, 'decisions.json'), JSON.stringify(body, null, 2));
        console.log(`decisions saved: accepted ${body.accepted.join(', ') || 'none'}; rejected ${body.rejected.join(', ') || 'none'}`);
        res.writeHead(200, { 'content-type': 'application/json' }); res.end('{"ok":true}');
      } catch (err) { res.writeHead(400); res.end(String(err.message)); }
    },
  },
});
console.log(`Review page: ${url}`);

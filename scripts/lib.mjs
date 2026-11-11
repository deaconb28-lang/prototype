// Shared helpers for scripts: Playwright loading and a tiny static file server.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const KIT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Shared install location so the plugin (whose folder is a versioned cache) and
// any project can use one Playwright. scripts/setup.mjs installs it here.
export const DEPS_DIR = process.env.PROTOTYPE_DEPS || path.join(os.homedir(), '.cache', 'prototype-toolkit');

export function loadPlaywright({ optional = false } = {}) {
  const bases = [KIT_ROOT, process.cwd(), DEPS_DIR].map((d) => path.join(d, 'noop.js'));
  for (const base of bases) {
    const req = createRequire(base);
    for (const name of ['playwright', '@playwright/test']) { try { return req(name); } catch (_) {} }
  }
  try { return createRequire(import.meta.url)('playwright'); } catch (_) {}
  if (optional) return null;
  console.error(`Playwright is not installed. Run: node "${path.join(KIT_ROOT, 'scripts', 'setup.mjs')}"`);
  process.exit(3);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain' };

// Serve a directory. `routes` lets callers add handlers (e.g. POST endpoints).
export function serveDir(dir, { port = 0, host = '127.0.0.1', routes = {} } = {}) {
  return new Promise((resolve) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url, 'http://x');
      const route = routes[`${req.method} ${url.pathname}`];
      if (route) return route(req, res, url);
      let p = path.join(dir, decodeURIComponent(url.pathname));
      if (!p.startsWith(dir)) { res.writeHead(403); return res.end(); }
      if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) {
        const nf = path.join(dir, '404.html');
        res.writeHead(404, { 'content-type': TYPES['.html'] });
        return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
      }
      res.writeHead(200, { 'content-type': TYPES[path.extname(p).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
      fs.createReadStream(p).pipe(res);
    });
    server.listen(port, host, () => {
      const { port: actual } = server.address();
      resolve({ server, url: `http://${host}:${actual}/`, port: actual, close: () => server.close() });
    });
  });
}

export const readBody = (req) => new Promise((resolve) => { let d = ''; req.on('data', (c) => { d += c; }); req.on('end', () => resolve(d)); });

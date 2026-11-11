// Small helpers shared by the generator. No dependencies.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export const readJSON = (p, fallback) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (err) { if (fallback !== undefined) return fallback; throw new Error(`Could not read ${p}: ${err.message}`); }
};

export const e = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const slugify = (s) => String(s || '').toLowerCase()
  .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const telHref = (phone) => {
  const digits = String(phone || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  if (digits.startsWith('+')) return `tel:${digits}`;
  if (digits.length === 10) return `tel:+1${digits}`; // NANP default; override with an explicit +country number
  return `tel:${digits}`;
};

// Replace {{placeholders}}. Sentences that still contain an unresolved placeholder are dropped,
// so we never print "{{years}}" or invent a value for it.
export function fill(text, vars) {
  if (text == null) return text;
  if (Array.isArray(text)) return text.map((t) => fill(t, vars)).filter((t) => t != null && t !== '');
  if (typeof text === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(text)) out[k] = fill(v, vars);
    return out;
  }
  if (typeof text !== 'string') return text;
  let s = text.replace(/\{\{\s*(\w+)\s*\}\}/g, (m, k) => (vars[k] != null && vars[k] !== '' ? String(vars[k]) : m));
  if (!/\{\{\s*\w+\s*\}\}/.test(s)) return s;
  const sentences = s.match(/[^.!?]+[.!?]*\s*/g) || [s];
  s = sentences.filter((x) => !/\{\{\s*\w+\s*\}\}/.test(x)).join('').trim();
  return s;
}

export const copyDir = (src, dst) => {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name), d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
};

export const pick = (arr, i) => (arr && arr.length ? arr[((i % arr.length) + arr.length) % arr.length] : undefined);

export const titleCase = (s) => String(s || '').replace(/\b\w/g, (c) => c.toUpperCase());

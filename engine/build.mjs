#!/usr/bin/env node
// Builds a static, multi-page site from sites/<slug>/site.json.
//   node engine/build.mjs sites/<slug> [--style <id>] [--final] [--out <dir>]
// Output goes to sites/<slug>/dist (plain HTML/CSS/JS, no build step needed to host it).
import fs from 'node:fs';
import path from 'node:path';
import { ROOT, readJSON, e, fill, slugify, telHref, copyDir, pick } from './util.mjs';
import { sampleReviews } from './samples.mjs';
import * as C from './components.mjs';
import { icon } from './icons.mjs';

// ---------- args ----------
const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : undefined; };
const VALUE_FLAGS = ['style', 'out'];
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALUE_FLAGS.includes(args[i - 1].replace(/^--/, ''))));
const siteDir = path.resolve(positional[0] || '');
if (!positional[0]) {
  console.error('Usage: node engine/build.mjs sites/<slug> [--style <id>] [--final] [--out <dir>]');
  process.exit(1);
}
const site = readJSON(path.join(siteDir, 'site.json'));
const final = Boolean(flag('final') || site.options?.final);
const styleId = flag('style') || site.style || 'fieldnote';
const outDir = path.resolve(typeof flag('out') === 'string' ? flag('out') : path.join(siteDir, 'dist'));

// ---------- load layers ----------
const b0 = site.business || {};
const tradeId = b0.trade || 'roofing';
const tradePath = fs.existsSync(path.join(siteDir, 'trade.json')) ? path.join(siteDir, 'trade.json') : path.join(ROOT, 'trades', `${tradeId}.json`);
if (!fs.existsSync(tradePath)) throw new Error(`No trade pack for "${tradeId}". Add trades/${tradeId}.json or sites/<slug>/trade.json.`);
const tradeRaw = readJSON(tradePath);
const styleDir = path.join(ROOT, 'styles', styleId);
if (!fs.existsSync(path.join(styleDir, 'style.json'))) throw new Error(`Unknown style "${styleId}". See styles/.`);
const style = readJSON(path.join(styleDir, 'style.json'));
const photosDb = readJSON(path.join(ROOT, 'trades', 'photos.json'), { trades: {} });

// ---------- business ----------
const areas = (b0.areas && b0.areas.length ? b0.areas : [b0.city]).filter(Boolean);
const b = {
  ...b0,
  name: b0.name || 'Your Business',
  city: b0.city || 'Your City',
  region: b0.region || b0.state || '',
  area: b0.area || (areas.length > 1 ? `${areas.slice(0, -1).join(', ')} and ${areas.at(-1)}` : areas[0]) || b0.city,
  areas,
  tel: telHref(b0.phone),
  confirmed: b0.confirmed || {},
};
const vars = { name: b.name, city: b.city, area: b.area, phone: b.phone, years: b.years, region: b.region, state: b.region };
const trade = fill(tradeRaw, vars);
trade.logo_icon = trade.logo_icon || (trade.services?.[0]?.icon) || 'home';

// ---------- photos ----------
const tmpl = photosDb.url_template || 'https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w={w}';
const fromDb = (p) => ({
  key: `px-${p.id}`,
  src: (w) => tmpl.replace(/\{id\}/g, p.id).replace('{w}', w),
  alt: p.alt, subject: p.subject, focal: p.focal, tone: p.tone, use: p.use, orientation: p.orientation, stock: true,
});
const fromBusiness = (p, i) => ({
  key: `biz-${i}`,
  src: () => p.url, srcset: false, alt: p.alt || `${b.name} project`, caption: p.caption, use: p.use || 'work', focal: p.focal, stock: false,
});
const bizPhotos = (site.photos || b0.photos || []).map(fromBusiness);
const stockPhotos = [...(photosDb.trades?.[tradeId] || []), ...(photosDb.trades?.generic || []).map((p) => ({ ...p, generic: true }))].map(fromDb);
const allPhotos = [...bizPhotos, ...stockPhotos];
const byUse = (...uses) => allPhotos.filter((p) => uses.includes(p.use));
const landscape = (list) => list.filter((p) => p.orientation !== 'portrait');
const photos = {
  hero: [...bizPhotos.filter((p) => p.use === 'hero'), ...landscape(stockPhotos.filter((p) => p.use === 'hero' && !p.generic)), ...landscape(byUse('result', 'work'))],
  work: byUse('work', 'detail').filter((p) => !p.generic || bizPhotos.length === 0).slice(0, 12),
  result: byUse('result'),
  team: byUse('team'),
};
if (!photos.work.length) photos.work = allPhotos.slice(0, 8);

// ---------- copy ----------
const sc = site.copy || {};
const promise = trade.quote_form?.promise || '';
const primaryCta = sc.primaryCta || trade.hero.primary_cta || 'Get a free quote';
const copy = {
  eyebrow: sc.eyebrow,
  heroHeadline: sc.heroHeadline || trade.hero.headlines[0],
  heroSub: sc.heroSub || trade.hero.subheads[0],
  primaryCta,
  navCta: sc.navCta || (primaryCta.length <= 16 ? primaryCta : 'Free estimate'),
  mobileCta: sc.mobileCta || 'Free quote',
  formCta: sc.formCta || 'Send my request',
  heroCard: sc.heroCard === false ? null : (sc.heroCard || { title: trade.quote_form?.title || 'Free estimate', detail: promise }),
  servicesTitle: sc.servicesTitle || `${trade.name} services in ${b.city}`,
  servicesIntro: sc.servicesIntro || '',
  processTitle: sc.processTitle || 'What happens after you call',
  workTitle: sc.workTitle || `Recent work around ${b.city}`,
  reviewsTitle: sc.reviewsTitle || `What customers in ${b.city} say`,
  aboutTitle: sc.aboutTitle || `About ${b.name}`,
  about: b0.about || sc.about || trade.about_default,
  areasTitle: sc.areasTitle || `Serving ${b.area}`,
  areasIntro: sc.areasIntro || `Based in ${b.city}. Nearby and don't see your town? Call and ask.`,
  faqTitle: sc.faqTitle || 'Common questions',
  ctaTitle: sc.ctaTitle || `Need a ${trade.noun}? Talk to one today.`,
  ctaSub: sc.ctaSub || promise,
  footerKicker: sc.footerKicker || 'Talk to a real person',
  tagline: sc.tagline || `${trade.name} for ${b.area}.`,
};

// ---------- services, reviews, faqs ----------
let svcList = trade.services;
if (site.services && site.services.length) {
  svcList = site.services.map((s) => {
    if (typeof s === 'string') return trade.services.find((t) => t.slug === s || t.name.toLowerCase() === s.toLowerCase()) || { slug: slugify(s), name: s, short: '', long: '', bullets: [], icon: 'check' };
    const base = trade.services.find((t) => t.slug === s.slug) || {};
    return { ...base, ...s, slug: s.slug || base.slug || slugify(s.name) };
  });
}
const servicesFull = fill(svcList, vars).map((s, i) => ({ ...s, slug: s.slug || slugify(s.name), photo: s.photo ? fromBusiness({ url: s.photo, alt: s.name }, `svc-${i}`) : pick(photos.work, i) }));

const realReviews = (b0.reviews || []).filter((r) => r && r.text);
const reviewsList = realReviews.length
  ? realReviews.map((r) => ({ ...r, author: r.author || 'Customer', sample: false }))
  : sampleReviews(tradeId).map((r, i) => ({ ...r, author: 'Homeowner', town: pick(areas, i), sample: true }));

const faqs = (site.faqs && site.faqs.length ? site.faqs : trade.faqs).map((f) => fill(f, vars));
const processSteps = site.process || trade.process;

const c = {
  b, trade, style, copy, photos, faqs,
  services: servicesFull,
  reviews: reviewsList,
  process: processSteps,
  opt: { sampleTags: final ? true : site.options?.sampleTags !== false },
  hasSamples: !(realReviews.length && bizPhotos.length && b0.license && b.confirmed.promise),
  nav: [
    { id: 'services', label: 'Services', href: 'services.html' },
    { id: 'work', label: 'Our work', href: 'work.html' },
    { id: 'reviews', label: 'Reviews', href: 'reviews.html' },
    { id: 'about', label: 'About', href: 'about.html' },
    { id: 'areas', label: 'Service area', href: 'areas.html' },
  ],
};

// ---------- head / schema ----------
const fontsHref = () => {
  const fams = Object.values(style.fonts || {}).map((f) => f.google).filter(Boolean);
  return fams.length ? `https://fonts.googleapis.com/css2?${[...new Set(fams)].map((f) => `family=${f}`).join('&')}&display=swap` : null;
};

function schema(extra) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': trade.schema_type || 'HomeAndConstructionBusiness',
    name: b.name,
    telephone: b.phone,
    areaServed: areas.map((a) => ({ '@type': 'City', name: a })),
    address: b.address && b.address.street
      ? { '@type': 'PostalAddress', streetAddress: b.address.street, addressLocality: b.address.city || b.city, addressRegion: b.address.region || b.region, postalCode: b.address.postal, addressCountry: b.address.country || 'US' }
      : { '@type': 'PostalAddress', addressLocality: b.city, addressRegion: b.region },
  };
  if (b.email) ld.email = b.email;
  if (b.website) ld.url = b.website;
  if (b.openingHours) ld.openingHours = b.openingHours;
  if (photos.hero[0]) ld.image = photos.hero[0].src(1280);
  // Only real ratings, never samples.
  if (b.rating && b.rating.value && b.rating.count) ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: b.rating.value, reviewCount: b.rating.count };
  if (b.social) ld.sameAs = Object.values(b.social).filter(Boolean);
  return `<script type="application/ld+json">${JSON.stringify(extra ? [ld, extra] : ld)}</script>`;
}

const favicon = () => {
  const accent = style.tokens['--accent'] || '#333';
  const ink = style.tokens['--accent-ink'] || '#fff';
  const letter = (b.name.match(/[A-Za-z0-9]/) || ['•'])[0].toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${accent}"/><text x="32" y="44" font-family="Arial,sans-serif" font-size="36" font-weight="700" text-anchor="middle" fill="${ink}">${letter}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
};

function page({ id, file, title, description, body, base = '', extraSchema }) {
  const ctx = { ...c, base, page: id };
  const fonts = fontsHref();
  const ogImg = photos.hero[0] ? photos.hero[0].src(1280) : '';
  const html = `<!doctype html>
<html lang="${e(site.lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${e(title)}</title>
<meta name="description" content="${e(description)}">
${final ? '' : '<meta name="robots" content="noindex, nofollow">'}
<meta property="og:type" content="website">
<meta property="og:title" content="${e(title)}">
<meta property="og:description" content="${e(description)}">
${ogImg ? `<meta property="og:image" content="${e(ogImg)}">` : ''}
<meta name="theme-color" content="${e(style.tokens['--bg'] || '#ffffff')}">
<link rel="icon" href="${favicon()}">
${fonts ? `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="${e(fonts)}">` : ''}
<link rel="stylesheet" href="${base}assets/site.css">
${schema(extraSchema)}
</head>
<body class="style-${e(style.id)} page-${e(id)}${ctx.opt.sampleTags ? '' : ' no-sample-tags'}">
<a class="skip" href="#main">Skip to content</a>
${C.banner(ctx)}
${C.nav(ctx)}
<main id="main">
${body(ctx)}
</main>
${C.footer(ctx)}
${C.mobileBar(ctx)}
<script src="${base}assets/site.js" defer></script>
</body>
</html>
`;
  const out = path.join(outDir, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, html.replace(/\n\s*\n+/g, '\n'));
  return out;
}

// ---------- pages ----------
const loc = `${b.city}${b.region ? `, ${b.region}` : ''}`;
const metaSub = (s) => (s.length > 155 ? `${s.slice(0, 152).replace(/\s+\S*$/, '')}...` : s);

// Clear the previous build but keep deploy links (.vercel, .netlify) so redeploys reuse the project.
if (fs.existsSync(outDir)) for (const f of fs.readdirSync(outDir)) { if (!f.startsWith('.')) fs.rmSync(path.join(outDir, f), { recursive: true, force: true }); }
fs.mkdirSync(path.join(outDir, 'assets'), { recursive: true });

const homeOrder = style.home || ['hero', 'trust', 'services', 'process', 'offers', 'gallery', 'reviews', 'about', 'areas', 'faq', 'cta'];
const homeSections = {
  hero: C.hero, trust: C.trust, services: (x) => C.services(x), process: C.process, offers: C.offers,
  gallery: (x) => C.gallery(x), reviews: (x) => C.reviews(x), about: C.aboutTeaser, areas: (x) => C.areas(x), faq: (x) => C.faq(x), cta: C.cta,
};
page({
  id: 'home', file: 'index.html',
  title: `${b.name} | ${trade.name} in ${loc}`,
  description: metaSub(copy.heroSub),
  body: (x) => homeOrder.map((s) => homeSections[s]?.(x) || '').join('\n'),
});

page({
  id: 'services', file: 'services.html',
  title: `${trade.name} services in ${loc} | ${b.name}`,
  description: metaSub(`${servicesFull.map((s) => s.name).slice(0, 5).join(', ')} in ${b.area}. ${promise}`),
  body: (x) => `
    ${C.pageHero(x, { kicker: 'Services', title: copy.servicesTitle, intro: `Everything we do, with what's included. Call ${b.phone} if you don't see your job here.`, crumbs: [{ href: 'index.html', label: 'Home' }, { label: 'Services' }] })}
    <section class="section svc-index"><div class="wrap">
      <ul class="svc-index-list">${servicesFull.map((s, i) => `<li id="${e(s.slug)}">
        ${C.img(x, s.photo, { sizes: '(min-width: 960px) 40vw, 100vw', ratio: '3 / 2' })}
        <div>
          <p class="svc-num">${String(i + 1).padStart(2, '0')}</p>
          <h2>${e(s.name)}</h2>
          <p>${e(s.long || s.short)}</p>
          ${s.bullets?.length ? `<ul class="ticks">${s.bullets.map((bl) => `<li>${e(bl)}</li>`).join('')}</ul>` : ''}
          <a class="text-link" href="services/${e(s.slug)}.html">More on ${e(s.name.toLowerCase())} ${icon('arrow-right', { size: 18 })}</a>
        </div>
      </li>`).join('')}</ul>
    </div></section>
    ${C.cta(x)}`,
});

for (const s of servicesFull) {
  const others = servicesFull.filter((o) => o.slug !== s.slug).slice(0, 5);
  const words = s.name.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const related = faqs.filter((f) => words.some((w) => (f.q + f.a).toLowerCase().includes(w)));
  const faqList = (related.length >= 2 ? related : faqs).slice(0, 4);
  page({
    id: 'services', file: `services/${s.slug}.html`, base: '../',
    title: `${s.name} in ${loc} | ${b.name}`,
    description: metaSub(`${s.short || s.name} ${promise}`),
    extraSchema: { '@context': 'https://schema.org', '@type': 'Service', name: s.name, serviceType: s.name, areaServed: areas, provider: { '@type': trade.schema_type || 'HomeAndConstructionBusiness', name: b.name, telephone: b.phone } },
    body: (x) => `
      ${C.pageHero(x, { kicker: `${trade.name} · ${b.city}`, title: `${s.name} in ${b.city}`, intro: s.short, photo: s.photo, crumbs: [{ href: '../index.html', label: 'Home' }, { href: '../services.html', label: 'Services' }, { label: s.name }] })}
      <section class="section svc-detail"><div class="wrap svc-detail-grid">
        <div class="prose">
          <h2>What to expect</h2>
          <p>${e(s.long || s.short)}</p>
          ${s.bullets?.length ? `<h3>What's included</h3><ul class="checks">${s.bullets.map((bl) => `<li>${icon('check', { size: 18, stroke: 2.25 })}<span>${e(bl)}</span></li>`).join('')}</ul>` : ''}
          <h3>Step by step</h3>
          <ol class="steps steps-compact">${processSteps.map((p, i) => `<li><span class="step-num">${String(i + 1).padStart(2, '0')}</span><div><strong>${e(p.title)}</strong><p>${e(p.detail)}</p></div></li>`).join('')}</ol>
        </div>
        <aside class="svc-aside"><div class="card sticky-card">${C.quoteForm(x, { compact: true, id: 'svc', title: `Ask about ${s.name.toLowerCase()}` })}</div></aside>
      </div></section>
      ${C.faq(x, { list: faqList, limit: 4 })}
      <section class="section-tight other-svcs"><div class="wrap"><p class="eyebrow">Other services</p><ul class="chip-list">${others.map((o) => `<li><a class="chip" href="${e(o.slug)}.html">${e(o.name)}</a></li>`).join('')}</ul></div></section>
      ${C.cta(x)}`,
  });
}

page({
  id: 'work', file: 'work.html',
  title: `Recent ${trade.name.toLowerCase()} projects in ${loc} | ${b.name}`,
  description: metaSub(`Photos of recent ${trade.name.toLowerCase()} work by ${b.name} around ${b.area}.`),
  body: (x) => `${C.pageHero(x, { kicker: 'Our work', title: copy.workTitle, intro: bizPhotos.length ? 'Real jobs, photographed by our crew.' : 'Project photos from the crew go here.', crumbs: [{ href: 'index.html', label: 'Home' }, { label: 'Our work' }] })}
    ${C.gallery({ ...x, style: { ...style, variants: { ...style.variants, gallery: 'grid' } } }, { limit: 12, heading: false })}
    ${C.reviews(x, { limit: 3 })}
    ${C.cta(x)}`,
});

page({
  id: 'reviews', file: 'reviews.html',
  title: `Reviews | ${b.name}, ${trade.name.toLowerCase()} in ${loc}`,
  description: metaSub(`What customers around ${b.area} say about ${b.name}.`),
  body: (x) => `${C.pageHero(x, { kicker: 'Reviews', title: copy.reviewsTitle, intro: realReviews.length ? `Straight from ${b.rating?.source || 'Google'}, unedited.` : 'Real reviews from Google, Facebook or Yelp go here.', crumbs: [{ href: 'index.html', label: 'Home' }, { label: 'Reviews' }] })}
    ${C.reviews(x, { all: true, heading: false })}
    ${C.cta(x)}`,
});

page({
  id: 'about', file: 'about.html',
  title: `About ${b.name} | ${trade.name} in ${loc}`,
  description: metaSub(copy.about || `${b.name} is a ${trade.noun} serving ${b.area}.`),
  body: (x) => {
    const certs = (b.certifications && b.certifications.length) ? b.certifications : trade.trust.certifications.slice(0, 4);
    const certSample = !(b.certifications && b.certifications.length);
    const guarantees = (b.guarantees && b.guarantees.length) ? b.guarantees : trade.trust.guarantees;
    return `${C.pageHero(x, { kicker: 'About', title: copy.aboutTitle, intro: copy.about, photo: photos.team[0] || photos.work[0], crumbs: [{ href: 'index.html', label: 'Home' }, { label: 'About' }] })}
    <section class="section values"><div class="wrap">
      ${'<div class="section-head"><p class="eyebrow">What we stand behind</p><h2>Our guarantees</h2></div>'}
      <ul class="value-list">${guarantees.map((g) => `<li${C.sampleAttr(x.opt.sampleTags && !(b.guarantees && b.guarantees.length))}>${icon('shield', { size: 24 })}<p>${e(g)}</p></li>`).join('')}</ul>
    </div></section>
    <section class="section-tight certs tone-alt"><div class="wrap">
      <p class="eyebrow">Licenses and certifications</p>
      <ul class="chip-list">${b.license ? `<li><span class="chip">${e(b.license)}</span></li>` : ''}${certs.map((ct) => `<li><span class="chip"${C.sampleAttr(x.opt.sampleTags && certSample, 'Example')}>${e(ct)}</span></li>`).join('')}</ul>
    </div></section>
    ${C.process(x)}
    ${C.reviews(x, { limit: 3 })}
    ${C.cta(x)}`;
  },
});

page({
  id: 'areas', file: 'areas.html',
  title: `Service area | ${trade.name} in ${b.area} | ${b.name}`,
  description: metaSub(`${b.name} serves ${b.area}. ${promise}`),
  body: (x) => `${C.pageHero(x, { kicker: 'Service area', title: copy.areasTitle, intro: copy.areasIntro, crumbs: [{ href: 'index.html', label: 'Home' }, { label: 'Service area' }] })}
    ${C.areas(x, { full: true })}
    <section class="section town-grid-wrap"><div class="wrap">
      <ul class="town-grid">${areas.map((a) => `<li class="card"><h3>${e(trade.name)} in ${e(a)}</h3><p>${e(servicesFull.slice(0, 3).map((s) => s.name).join(', '))} and more.</p>${b.tel ? `<a class="text-link" href="${e(b.tel)}">Call ${e(b.phone)}</a>` : ''}</li>`).join('')}</ul>
    </div></section>
    ${C.cta(x)}`,
});

page({
  id: 'contact', file: 'contact.html',
  title: `Contact ${b.name} | ${trade.quote_form.title}`,
  description: metaSub(`${trade.quote_form.title}. Call ${b.phone} or send a request. ${promise}`),
  body: (x) => `<section class="section contact-page"><div class="wrap split">
      <div class="contact-info">
        ${'<p class="eyebrow">Contact</p>'}
        <h1>${e(trade.quote_form.title)}</h1>
        <p class="lede">${e(promise)}</p>
        ${b.tel ? `<a class="contact-phone" href="${e(b.tel)}">${icon('phone', { size: 26 })}<span>${e(b.phone)}</span></a>` : ''}
        <dl class="contact-dl">
          ${b.email ? `<div><dt>Email</dt><dd><a href="mailto:${e(b.email)}">${e(b.email)}</a></dd></div>` : ''}
          ${b.hours ? `<div><dt>Hours</dt><dd>${e(b.hours)}</dd></div>` : ''}
          <div><dt>Service area</dt><dd>${e(b.area)}</dd></div>
          ${b.address?.street ? `<div><dt>Address</dt><dd>${e(b.address.street)}, ${e(b.address.city || b.city)}</dd></div>` : ''}
        </dl>
      </div>
      <div class="card contact-card">${C.quoteForm(x, { id: 'contact', title: false })}</div>
    </div></section>`,
});

page({
  id: 'thanks', file: 'thank-you.html',
  title: `Request received | ${b.name}`,
  description: `Thanks for contacting ${b.name}.`,
  body: (x) => `<section class="section thanks"><div class="wrap narrow center">
    <span class="thanks-icon">${icon('check-circle', { size: 40 })}</span>
    <h1 data-thanks-title>Thanks. We have your request.</h1>
    <p class="lede">${e(promise)} If it's urgent, call now.</p>
    <div class="cta-row center">${b.tel ? `<a class="btn btn-primary btn-lg" href="${e(b.tel)}">Call ${e(b.phone)}</a>` : ''}<a class="btn btn-secondary btn-lg" href="index.html">Back to home</a></div>
  </div></section>`,
});

page({
  id: '404', file: '404.html',
  title: `Page not found | ${b.name}`,
  description: 'Page not found.',
  body: () => `<section class="section thanks"><div class="wrap narrow center"><h1>That page isn't here.</h1><p class="lede">Try the home page, or call ${e(b.phone)}.</p><div class="cta-row center"><a class="btn btn-primary btn-lg" href="index.html">Home</a></div></div></section>`,
});

// ---------- assets ----------
const tokens = Object.entries(style.tokens || {}).map(([k, v]) => `  ${k}: ${v};`).join('\n');
const css = [
  `/* ${b.name} · style: ${style.name} · generated by prototype (engine/build.mjs) */`,
  `:root {\n${tokens}\n}`,
  fs.readFileSync(path.join(ROOT, 'engine', 'assets', 'base.css'), 'utf8'),
  fs.existsSync(path.join(styleDir, 'style.css')) ? fs.readFileSync(path.join(styleDir, 'style.css'), 'utf8') : '',
  site.css || '',
].join('\n\n');
fs.writeFileSync(path.join(outDir, 'assets', 'site.css'), css);
fs.copyFileSync(path.join(ROOT, 'engine', 'assets', 'site.js'), path.join(outDir, 'assets', 'site.js'));
copyDir(path.join(siteDir, 'photos'), path.join(outDir, 'photos'));
// Prototypes are for showing the business, not for Google: block indexing until a --final build.
fs.writeFileSync(path.join(outDir, 'robots.txt'), final ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nDisallow: /\n');

// ---------- sample check ----------
const samples = [];
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).forEach((f) => {
  const p = path.join(d, f.name);
  if (f.isDirectory()) return walk(p);
  if (!p.endsWith('.html')) return;
  const html = fs.readFileSync(p, 'utf8');
  const n = (html.match(/data-sample=/g) || []).length + (html.match(/class="ph-tag"/g) || []).length;
  if (n) samples.push({ file: path.relative(outDir, p), count: n });
});
walk(outDir);
const total = samples.reduce((a, s) => a + s.count, 0);
const summary = { out: path.relative(process.cwd(), outDir) || '.', style: style.id, trade: tradeId, pages: fs.readdirSync(outDir).filter((f) => f.endsWith('.html')).length + servicesFull.length, placeholders: total };
if (final && total) {
  console.error(`Refusing --final build: ${total} placeholder items still on the site (samples, stock photos, unconfirmed claims).`);
  samples.forEach((s) => console.error(`  ${s.file}: ${s.count}`));
  process.exit(2);
}
console.log(JSON.stringify(summary));

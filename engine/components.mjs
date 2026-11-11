// Section components. Each section has layout variants; a style picks one per section
// in styles/<id>/style.json -> "variants". Everything is static HTML + one CSS file.
import { e, pick } from './util.mjs';
import { icon } from './icons.mjs';

// ---------- primitives ----------

const SAMPLE_NOTE = 'Placeholder. Confirm with the business or replace before going live.';

export const sampleAttr = (on, label = 'Sample') => (on ? ` data-sample="${e(label)}" title="${e(SAMPLE_NOTE)}"` : '');

export function img(c, photo, { cls = '', sizes = '100vw', eager = false, ratio } = {}) {
  if (!photo) return `<div class="ph ph-empty ${cls}"${ratio ? ` style="aspect-ratio:${ratio}"` : ''}><span>Photo</span></div>`;
  const widths = [640, 960, 1280, 1920];
  const src = photo.src(1280);
  const srcset = photo.srcset === false ? '' : widths.map((w) => `${photo.src(w)} ${w}w`).join(', ');
  const focal = { left: '25% 50%', right: '75% 50%', top: '50% 25%', bottom: '50% 75%' }[photo.focal] || '50% 50%';
  const tag = photo.stock && c.opt.sampleTags ? `<span class="ph-tag" title="${e(SAMPLE_NOTE)}">Stock photo</span>` : '';
  return `<figure class="ph ${cls}"${ratio ? ` style="aspect-ratio:${ratio}"` : ''}><img src="${e(src)}"${srcset ? ` srcset="${e(srcset)}" sizes="${e(sizes)}"` : ''} alt="${e(photo.alt || '')}" width="1600" height="1067" style="object-position:${focal}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">${tag}</figure>`;
}

const btn = (href, label, kind = 'primary', extra = '') =>
  `<a class="btn btn-${kind}" href="${e(href)}"${extra}>${e(label)}</a>`;

const phoneLink = (c, { cls = 'phone-link', label } = {}) =>
  c.b.tel ? `<a class="${cls}" href="${e(c.b.tel)}">${icon('phone', { size: 18 })}<span>${e(label || c.b.phone)}</span></a>` : '';

// Headlines may mark one accent word with *asterisks*; styles decide how <em> looks.
export const rich = (t) => e(t).replace(/\*([^*]+)\*/g, '<em>$1</em>');
const plain = (t) => String(t ?? '').replace(/\*/g, '');

const eyebrow = (text, cls = '') => (text ? `<p class="eyebrow ${cls}">${e(text)}</p>` : '');

const sectionHead = (c, { kicker, title, intro, align = '', link } = {}) => `
  <div class="section-head ${align}">
    ${eyebrow(kicker)}
    <h2>${rich(title)}</h2>
    ${intro ? `<p class="lede">${e(intro)}</p>` : ''}
    ${link ? `<a class="text-link" href="${e(link.href)}">${e(link.label)} ${icon('arrow-right', { size: 18 })}</a>` : ''}
  </div>`;

const stars = (n = 5) => `<span class="stars" aria-hidden="true">${Array.from({ length: 5 }, (_, i) => icon('star', { size: 16, cls: `icon star${i < Math.round(n) ? ' on' : ''}` })).join('')}</span>`;

// Proof line under hero CTAs: real rating first, then real license, then a sample.
function proofLine(c) {
  const b = c.b;
  if (b.rating && b.rating.value) {
    return `<p class="proof">${stars(b.rating.value)}<span><strong>${e(b.rating.value)}</strong> from ${e(b.rating.count)} ${e(b.rating.source || 'Google')} reviews</span></p>`;
  }
  const bits = [];
  if (b.license) bits.push(`Licensed and insured · ${e(b.license)}`);
  if (b.years) bits.push(`${e(b.years)} years in ${e(b.city)}`);
  if (bits.length) return `<p class="proof">${icon('badge', { size: 18 })}<span>${bits.join(' · ')}</span></p>`;
  return `<p class="proof"${sampleAttr(c.opt.sampleTags)}>${icon('badge', { size: 18 })}<span>Licensed and insured · Free written estimates</span></p>`;
}

// ---------- quote form ----------

export function quoteForm(c, { compact = false, id = 'quote', title } = {}) {
  const qf = c.trade.quote_form;
  let fields = qf.fields;
  if (compact) fields = fields.filter((f) => f.required || f.type === 'select').slice(0, 4);
  const field = (f) => {
    const fid = `${id}-${f.name}`;
    const req = f.required ? ' required' : '';
    const label = `<label for="${fid}">${e(f.label)}${f.required ? '' : ' <span class="opt">optional</span>'}</label>`;
    if (f.type === 'select') {
      return `<div class="field">${label}<select id="${fid}" name="${e(f.name)}"${req}><option value="">Choose one</option>${(f.options || []).map((o) => `<option>${e(o)}</option>`).join('')}</select></div>`;
    }
    if (f.type === 'textarea') return `<div class="field field-wide">${label}<textarea id="${fid}" name="${e(f.name)}" rows="3"${req}></textarea></div>`;
    const auto = { name: 'name', phone: 'tel', email: 'email', zip: 'postal-code', address: 'street-address' }[f.name] || 'off';
    const mode = f.type === 'tel' ? ' inputmode="tel"' : f.name === 'zip' ? ' inputmode="numeric"' : '';
    return `<div class="field">${label}<input id="${fid}" name="${e(f.name)}" type="${e(f.type || 'text')}" autocomplete="${auto}"${mode}${req}></div>`;
  };
  const action = c.b.form_action || `${c.base}thank-you.html`;
  const method = c.b.form_action ? 'post' : 'get';
  return `
  <form class="quote-form${compact ? ' compact' : ''}" action="${e(action)}" method="${method}" data-quote-form data-thanks="${e(c.base)}thank-you.html">
    ${title !== false ? `<p class="form-title">${e(title || qf.title)}</p>` : ''}
    <div class="fields">${fields.map(field).join('')}</div>
    <button class="btn btn-primary btn-block" type="submit">${e(c.copy.formCta)}</button>
    <p class="form-note"${sampleAttr(c.opt.sampleTags && !c.b.confirmed?.promise)}>${icon('clock', { size: 16 })}<span>${e(qf.promise)}</span></p>
  </form>`;
}

// ---------- chrome ----------

export function banner(c) {
  const em = c.trade.emergency;
  if (!em || !em.enabled || c.b.emergency === false) return '';
  const sample = c.opt.sampleTags && c.b.emergency !== true;
  return `<div class="banner"${sampleAttr(sample)}><div class="wrap banner-inner">${icon('siren', { size: 18 })}<p><strong>${e(em.label)}</strong> <span>${e(em.detail)}</span></p>${phoneLink(c, { cls: 'banner-call', label: `Call ${c.b.phone}` })}</div></div>`;
}

function logo(c) {
  const b = c.b;
  if (b.logo) return `<a class="logo" href="${c.base}index.html"><img src="${e(b.logo)}" alt="${e(b.name)}" height="40"></a>`;
  return `<a class="logo wordmark" href="${c.base}index.html"><span class="logo-mark" aria-hidden="true">${icon(c.trade.logo_icon || 'home', { size: 20, stroke: 2 })}</span><span class="logo-name">${e(b.name)}</span></a>`;
}

export function nav(c) {
  const v = c.style.variants.nav || 'bar';
  const links = c.nav.map((l) => `<li><a href="${c.base}${l.href}"${l.id === c.page ? ' aria-current="page"' : ''}>${e(l.label)}</a></li>`).join('');
  const util = v === 'utility' ? `
    <div class="utility"><div class="wrap utility-inner">
      <p>${c.b.hours ? `${icon('clock', { size: 15 })}<span>${e(c.b.hours)}</span>` : ''}<span class="sep" aria-hidden="true"></span>${icon('pin', { size: 15 })}<span>Serving ${e(c.b.area)}</span></p>
      <p>${c.b.license ? `<span>${e(c.b.license)}</span>` : `<span${sampleAttr(c.opt.sampleTags)}>Licensed and insured</span>`}</p>
    </div></div>` : '';
  return `
  <header class="site-header nav-${v}" data-header>
    ${util}
    <div class="wrap nav-inner">
      ${logo(c)}
      <nav class="nav-links" aria-label="Main"><ul>${links}</ul></nav>
      <div class="nav-actions">
        ${phoneLink(c, { cls: 'nav-phone' })}
        ${btn(`${c.base}contact.html`, c.copy.navCta, 'primary', ' data-nav-cta')}
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="mobile-menu" data-nav-toggle>${icon('menu', { size: 22 })}<span class="sr">Menu</span></button>
      </div>
    </div>
    <div class="mobile-menu" id="mobile-menu" hidden data-mobile-menu>
      <ul>${links}</ul>
      <div class="mobile-menu-actions">${phoneLink(c, { cls: 'btn btn-secondary btn-block', label: `Call ${c.b.phone}` })}${btn(`${c.base}contact.html`, c.copy.navCta, 'primary btn-block')}</div>
    </div>
  </header>`;
}

export function mobileBar(c) {
  return `<div class="mobile-bar" data-mobile-bar>
    ${c.b.tel ? `<a class="mobile-bar-call" href="${e(c.b.tel)}">${icon('phone', { size: 18 })}<span>Call now</span></a>` : ''}
    <a class="mobile-bar-quote" href="${c.base}contact.html">${e(c.copy.mobileCta)}</a>
  </div>`;
}

export function footer(c) {
  const v = c.style.variants.footer || 'big';
  const b = c.b;
  const year = new Date().getFullYear();
  const svc = c.services.slice(0, 7).map((s) => `<li><a href="${c.base}services/${s.slug}.html">${e(s.name)}</a></li>`).join('');
  const company = c.nav.filter((l) => l.id !== 'services').map((l) => `<li><a href="${c.base}${l.href}">${e(l.label)}</a></li>`).join('');
  const addr = b.address && b.address.street ? `${e(b.address.street)}<br>${e(b.address.city || b.city)}, ${e(b.address.region || b.region || '')} ${e(b.address.postal || '')}` : `${e(b.city)}${b.region ? `, ${e(b.region)}` : ''}`;
  const top = v === 'big' ? `
      <div class="footer-cta">
        <p class="footer-kicker">${e(c.copy.footerKicker)}</p>
        ${c.b.tel ? `<a class="footer-phone" href="${e(b.tel)}">${e(b.phone)}</a>` : ''}
        ${btn(`${c.base}contact.html`, c.copy.primaryCta, 'primary')}
      </div>` : '';
  return `
  <footer class="site-footer footer-${v}">
    <div class="wrap">
      ${top}
      <div class="footer-grid">
        <div class="footer-brand">
          ${logo(c)}
          <p>${e(c.copy.tagline)}</p>
          ${b.license ? `<p class="footer-license">${e(b.license)}</p>` : ''}
        </div>
        <div><p class="footer-h">Services</p><ul>${svc}</ul></div>
        <div><p class="footer-h">Company</p><ul>${company}</ul></div>
        <div>
          <p class="footer-h">Contact</p>
          <ul class="footer-contact">
            ${b.tel ? `<li><a href="${e(b.tel)}">${e(b.phone)}</a></li>` : ''}
            ${b.email ? `<li><a href="mailto:${e(b.email)}">${e(b.email)}</a></li>` : ''}
            <li>${addr}</li>
            ${b.hours ? `<li>${e(b.hours)}</li>` : ''}
          </ul>
        </div>
      </div>
      <div class="footer-legal">
        <p>&copy; ${year} ${e(b.name)}. Serving ${e(b.area)}.</p>
        ${c.opt.sampleTags && c.hasSamples ? `<p class="sample-legend"><span class="sample-dot" aria-hidden="true"></span>Items tagged “Sample” or “Stock photo” are placeholders to confirm before launch.</p>` : ''}
      </div>
    </div>
  </footer>`;
}

// ---------- hero ----------

export function hero(c) {
  const v = c.style.variants.hero || 'split';
  const tone = c.style.variants.heroTone === 'dark' ? ' tone-dark hero-on-dark' : '';
  const h = c.copy;
  const photo = c.photos.hero[0];
  const where = `${c.trade.name} · ${c.b.city}${c.b.region ? `, ${c.b.region}` : ''}`;
  const ctas = `<div class="cta-row">${btn(`${c.base}contact.html`, h.primaryCta, 'primary btn-lg')}${phoneLink(c, { cls: 'btn btn-secondary btn-lg', label: `Call ${c.b.phone}` })}</div>`;
  const text = (cls = '') => `
      <div class="hero-text ${cls}">
        ${eyebrow(h.eyebrow || where)}
        <h1>${rich(h.heroHeadline)}</h1>
        <p class="hero-sub">${e(h.heroSub)}</p>
        ${ctas}
        ${proofLine(c)}
      </div>`;

  if (v === 'fullbleed') {
    return `<section data-place="${e(c.b.city)}${c.b.region ? `, ${e(c.b.region)}` : ''}" class="hero hero-fullbleed tone-dark">
      ${img(c, photo, { cls: 'hero-bg', eager: true })}
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="wrap hero-inner">${text()}</div>
    </section>`;
  }
  if (v === 'editorial') {
    return `<section data-place="${e(c.b.city)}${c.b.region ? `, ${e(c.b.region)}` : ''}" class="hero hero-editorial${tone}">
      <div class="wrap">
        ${eyebrow(h.eyebrow || where)}
        <h1>${rich(h.heroHeadline)}</h1>
        <div class="hero-editorial-row">
          <p class="hero-sub">${e(h.heroSub)}</p>
          <div>${ctas}${proofLine(c)}</div>
        </div>
      </div>
      <div class="wrap-wide">${img(c, photo, { cls: 'hero-photo', eager: true, ratio: '21 / 9' })}</div>
    </section>`;
  }
  if (v === 'form') {
    const bullets = c.services.slice(0, 3).map((s) => `<li>${icon('check', { size: 18, stroke: 2.25 })}<span>${e(s.name)}</span></li>`).join('');
    return `<section data-place="${e(c.b.city)}${c.b.region ? `, ${e(c.b.region)}` : ''}" class="hero hero-form tone-dark">
      ${img(c, photo, { cls: 'hero-bg', eager: true })}
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="wrap hero-inner">
        <div class="hero-text">
          ${eyebrow(h.eyebrow || where)}
          <h1>${rich(h.heroHeadline)}</h1>
          <p class="hero-sub">${e(h.heroSub)}</p>
          <ul class="hero-checks">${bullets}</ul>
          ${proofLine(c)}
        </div>
        <div class="hero-form-card card">${quoteForm(c, { compact: true, id: 'hero' })}</div>
      </div>
    </section>`;
  }
  if (v === 'contained') {
    return `<section data-place="${e(c.b.city)}${c.b.region ? `, ${e(c.b.region)}` : ''}" class="hero hero-contained">
      <div class="hero-frame tone-dark">
        ${img(c, photo, { cls: 'hero-bg', eager: true })}
        <div class="hero-scrim" aria-hidden="true"></div>
        <div class="wrap hero-inner">
          <div class="hero-panel">${text()}</div>
        </div>
      </div>
    </section>`;
  }
  // split (default)
  const card = c.copy.heroCard ? `<div class="hero-card"${sampleAttr(c.opt.sampleTags && !c.b.confirmed?.promise)}>${icon('calendar', { size: 20 })}<div><strong>${e(c.copy.heroCard.title)}</strong><span>${e(c.copy.heroCard.detail)}</span></div></div>` : '';
  return `<section data-place="${e(c.b.city)}${c.b.region ? `, ${e(c.b.region)}` : ''}" class="hero hero-split${tone}">
    <div class="wrap hero-inner">
      ${text()}
      <div class="hero-media">${img(c, photo, { cls: 'hero-photo', eager: true, sizes: '(min-width: 960px) 50vw, 100vw' })}${card}</div>
    </div>
  </section>`;
}

// ---------- trust strip ----------

export function trust(c) {
  const b = c.b;
  const items = [];
  if (b.rating && b.rating.value) items.push({ k: `${b.rating.value} rating`, v: `${b.rating.count} ${b.rating.source || 'Google'} reviews`, i: 'star' });
  if (b.years) items.push({ k: `${b.years} years`, v: `Working in ${b.city}`, i: 'calendar' });
  items.push(b.license ? { k: 'Licensed and insured', v: b.license, i: 'shield' } : { k: 'Licensed and insured', v: c.trade.trust.license_label || 'License on request', i: 'shield', sample: true });
  const g = (b.guarantees && b.guarantees[0]) || c.trade.trust.guarantees[0];
  if (g) items.push({ k: 'Warranty', v: g.replace(/^[^:]+:\s*/, ''), i: 'badge', sample: !(b.guarantees && b.guarantees.length) });
  items.push({ k: 'Free estimates', v: 'Written, before work starts', i: 'clipboard', sample: !b.confirmed?.estimates });
  const certs = (b.certifications || []).slice(0, 2);
  certs.forEach((cert) => items.push({ k: 'Certified', v: cert, i: 'award' }));
  const list = items.slice(0, 4).map((x) => `<li${sampleAttr(c.opt.sampleTags && x.sample)}>${icon(x.i, { size: 22 })}<div><strong>${e(x.k)}</strong><span>${e(x.v)}</span></div></li>`).join('');
  return `<section class="trust" aria-label="Why homeowners choose ${e(b.name)}"><div class="wrap"><ul class="trust-list">${list}</ul></div></section>`;
}

// ---------- services ----------

export function services(c, { limit = 6, heading = true } = {}) {
  const v = c.style.variants.services || 'cards';
  const list = c.services.slice(0, limit);
  const head = heading ? sectionHead(c, { kicker: 'Services', title: c.copy.servicesTitle, intro: c.copy.servicesIntro, link: { href: `${c.base}services.html`, label: 'All services' } }) : '';
  const href = (s) => `${c.base}services/${s.slug}.html`;
  let body = '';
  if (v === 'list') {
    body = `<ol class="svc-list">${list.map((s, i) => `<li><a href="${href(s)}"><span class="svc-num">${String(i + 1).padStart(2, '0')}</span><span class="svc-name">${e(s.name)}</span><span class="svc-short">${e(s.short)}</span>${icon('arrow-up-right', { size: 22, cls: 'icon svc-arrow' })}</a></li>`).join('')}</ol>`;
  } else if (v === 'tiles') {
    body = `<ul class="svc-tiles">${list.map((s, i) => `<li><a href="${href(s)}">${img(c, s.photo || pick(c.photos.work, i), { sizes: '(min-width: 960px) 33vw, 100vw' })}<div class="svc-tile-text"><h3>${e(s.name)}</h3><p>${e(s.short)}</p></div></a></li>`).join('')}</ul>`;
  } else if (v === 'split') {
    return `<section class="section services services-split"><div class="wrap split">
      <div class="split-aside">${head}${btn(`${c.base}contact.html`, c.copy.primaryCta, 'primary')}</div>
      <ul class="svc-rows">${list.map((s) => `<li><a href="${href(s)}"><div><h3>${e(s.name)}</h3><p>${e(s.short)}</p></div>${icon('arrow-right', { size: 20, cls: 'icon svc-arrow' })}</a></li>`).join('')}</ul>
    </div></section>`;
  } else {
    body = `<ul class="svc-cards">${list.map((s) => `<li class="card"><a href="${href(s)}">${icon(s.icon, { size: 28, cls: 'icon svc-icon' })}<h3>${e(s.name)}</h3><p>${e(s.short)}</p><span class="text-link">Details ${icon('arrow-right', { size: 16 })}</span></a></li>`).join('')}</ul>`;
  }
  return `<section class="section services services-${v}"><div class="wrap">${head}${body}</div></section>`;
}

// ---------- process ----------

export function process(c) {
  const v = c.style.variants.process || 'row';
  const steps = c.process.map((s, i) => `<li><span class="step-num">${String(i + 1).padStart(2, '0')}</span><h3>${e(s.title)}</h3><p>${e(s.detail)}</p></li>`).join('');
  return `<section class="section process process-${v} tone-alt"><div class="wrap${v === 'timeline' ? ' split' : ''}">
    ${sectionHead(c, { kicker: 'How it works', title: c.copy.processTitle })}
    <ol class="steps">${steps}</ol>
  </div></section>`;
}

// ---------- gallery ----------

export function gallery(c, { limit = 5, heading = true } = {}) {
  const v = c.style.variants.gallery || 'grid';
  const photos = [...c.photos.result, ...c.photos.work].filter(Boolean);
  const uniq = [...new Map(photos.map((p) => [p.key, p])).values()].slice(0, limit);
  if (!uniq.length) return '';
  const head = heading ? sectionHead(c, { kicker: 'Recent work', title: c.copy.workTitle, link: { href: `${c.base}work.html`, label: 'See more projects' } }) : '';
  const cap = (p) => (p.caption || p.subject ? `<figcaption>${e(p.caption || p.subject)}</figcaption>` : '');
  const items = uniq.map((p, i) => `<li class="g-item g-${i}">${img(c, p, { sizes: i === 0 ? '(min-width: 960px) 60vw, 100vw' : '(min-width: 960px) 30vw, 100vw' })}${cap(p)}</li>`).join('');
  return `<section class="section gallery gallery-${v}"><div class="wrap">${head}<ul class="g-list">${items}</ul></div></section>`;
}

// ---------- reviews ----------

export function reviews(c, { limit = 3, heading = true, all = false } = {}) {
  const v = all ? 'cards' : (c.style.variants.reviews || 'quote');
  const list = c.reviews.slice(0, all ? 50 : limit);
  const b = c.b;
  const summary = b.rating && b.rating.value
    ? `<p class="rating-summary">${stars(b.rating.value)}<span><strong>${e(b.rating.value)}</strong> average from ${e(b.rating.count)} ${e(b.rating.source || 'Google')} reviews</span>${b.rating.url ? ` <a class="text-link" href="${e(b.rating.url)}">Read them</a>` : ''}</p>`
    : '';
  const head = heading ? `${sectionHead(c, { kicker: 'Reviews', title: c.copy.reviewsTitle, link: all ? null : { href: `${c.base}reviews.html`, label: 'All reviews' } })}${summary}` : summary;
  const who = (r) => `<span class="who"><strong>${e(r.author)}</strong>${r.town ? `<span>${e(r.town)}</span>` : ''}${r.source && !r.sample ? `<span class="src">via ${e(r.source)}</span>` : ''}</span>`;
  if (v === 'quote' && list.length) {
    const [first, ...rest] = list;
    return `<section class="section reviews reviews-quote"><div class="wrap">
      ${head}
      <div class="quote-layout">
        <figure class="big-quote"${sampleAttr(c.opt.sampleTags && first.sample, 'Sample review')}>
          <blockquote><p>${e(first.text)}</p></blockquote>
          <figcaption>${stars(first.rating || 5)}${who(first)}</figcaption>
        </figure>
        <div class="small-quotes">${rest.map((r) => `<figure class="small-quote"${sampleAttr(c.opt.sampleTags && r.sample, 'Sample review')}><blockquote><p>${e(r.text)}</p></blockquote><figcaption>${who(r)}</figcaption></figure>`).join('')}</div>
      </div>
    </div></section>`;
  }
  return `<section class="section reviews reviews-cards"><div class="wrap">
    ${head}
    <ul class="review-cards">${list.map((r) => `<li class="card"${sampleAttr(c.opt.sampleTags && r.sample, 'Sample review')}>${stars(r.rating || 5)}<blockquote><p>${e(r.text)}</p></blockquote>${who(r)}</li>`).join('')}</ul>
  </div></section>`;
}

// ---------- about teaser ----------

export function aboutTeaser(c) {
  const photo = c.photos.team[0] || c.photos.work[1];
  const facts = [];
  if (c.b.years) facts.push(`<li><strong>${e(c.b.years)}</strong><span>years in business</span></li>`);
  if (c.b.rating && c.b.rating.count) facts.push(`<li><strong>${e(c.b.rating.count)}</strong><span>${e(c.b.rating.source || 'Google')} reviews</span></li>`);
  facts.push(`<li><strong>${e(c.b.areas.length)}</strong><span>towns served</span></li>`);
  return `<section class="section about-teaser"><div class="wrap split split-media">
    ${img(c, photo, { cls: 'about-photo', sizes: '(min-width: 960px) 45vw, 100vw', ratio: '4 / 5' })}
    <div class="about-text">
      ${eyebrow('About us')}
      <h2>${rich(c.copy.aboutTitle)}</h2>
      <p class="lede"${sampleAttr(c.opt.sampleTags && !c.b.about)}>${e(c.copy.about)}</p>
      <ul class="facts">${facts.join('')}</ul>
      <a class="text-link" href="${c.base}about.html">Meet the team ${icon('arrow-right', { size: 18 })}</a>
    </div>
  </div></section>`;
}

// ---------- financing / plan ----------

export function offers(c) {
  const cards = [];
  if (c.trade.financing) cards.push(`<div class="offer card"${sampleAttr(c.opt.sampleTags && c.b.financing !== true)}>${icon('coins', { size: 26 })}<div><h3>Financing available</h3><p>Spread the cost over monthly payments with approved credit. Ask for options when we quote.</p></div></div>`);
  const mp = c.trade.maintenance_plan;
  if (mp && mp.enabled) cards.push(`<div class="offer card"${sampleAttr(c.opt.sampleTags && !c.b.confirmed?.plan)}>${icon('calendar', { size: 26 })}<div><h3>${e(mp.name)}</h3><p>${e(mp.pitch)}</p></div></div>`);
  if (!cards.length) return '';
  return `<section class="section-tight offers"><div class="wrap offer-row">${cards.join('')}</div></section>`;
}

// ---------- areas ----------

export function areas(c, { full = false } = {}) {
  const list = c.b.areas.map((a) => `<li>${icon('pin', { size: 16 })}<span>${e(a)}</span></li>`).join('');
  const q = encodeURIComponent(`${c.b.mapQuery || c.b.address?.street || ''} ${c.b.city}${c.b.region ? `, ${c.b.region}` : ''}`.trim());
  const map = `<div class="map"><iframe title="Map of ${e(c.b.area)}" src="https://www.google.com/maps?q=${q}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`;
  return `<section class="section areas tone-alt"><div class="wrap split">
    <div>
      ${sectionHead(c, { kicker: 'Service area', title: c.copy.areasTitle, intro: c.copy.areasIntro, link: full ? null : { href: `${c.base}areas.html`, label: 'Full service area' } })}
      <ul class="area-list">${list}</ul>
    </div>
    ${map}
  </div></section>`;
}

// ---------- faq ----------

export function faq(c, { limit = 5, list } = {}) {
  const v = c.style.variants.faq || 'twocol';
  const items = (list || c.faqs).slice(0, limit).map((f, i) => `<details${i === 0 ? ' open' : ''}><summary><span>${e(f.q)}</span>${icon('chevron', { size: 20, cls: 'icon chev' })}</summary><div class="answer"><p>${e(f.a)}</p></div></details>`).join('');
  return `<section class="section faq faq-${v}"><div class="wrap${v === 'twocol' ? ' split' : ' narrow'}">
    ${sectionHead(c, { kicker: 'Questions', title: c.copy.faqTitle, intro: v === 'twocol' ? `Don't see yours? Call ${c.b.phone} and ask.` : null })}
    <div class="faq-list">${items}</div>
  </div></section>`;
}

// ---------- closing CTA ----------

export function cta(c) {
  const v = c.style.variants.cta || 'band';
  if (v === 'card') {
    return `<section class="section cta cta-card"><div class="wrap"><div class="cta-box tone-dark">
      ${img(c, c.photos.hero[1] || c.photos.work[0], { cls: 'cta-bg' })}
      <div class="hero-scrim" aria-hidden="true"></div>
      <div class="cta-inner">
        <h2>${rich(c.copy.ctaTitle)}</h2>
        <p>${e(c.copy.ctaSub)}</p>
        <div class="cta-row">${btn(`${c.base}contact.html`, c.copy.primaryCta, 'primary btn-lg')}${phoneLink(c, { cls: 'btn btn-secondary btn-lg', label: c.b.phone })}</div>
      </div>
    </div></div></section>`;
  }
  return `<section class="cta cta-band tone-accent"><div class="wrap cta-band-inner">
    <div><h2>${rich(c.copy.ctaTitle)}</h2><p>${e(c.copy.ctaSub)}</p></div>
    <div class="cta-row">${btn(`${c.base}contact.html`, c.copy.primaryCta, 'inverse btn-lg')}${phoneLink(c, { cls: 'btn btn-ghost btn-lg', label: c.b.phone })}</div>
  </div></section>`;
}

// ---------- page headers for inner pages ----------

export function pageHero(c, { kicker, title, intro, photo, crumbs } = {}) {
  const bc = crumbs ? `<nav class="crumbs" aria-label="Breadcrumb"><ol>${crumbs.map((cr, i) => (i === crumbs.length - 1 ? `<li aria-current="page">${e(cr.label)}</li>` : `<li><a href="${cr.href}">${e(cr.label)}</a></li>`)).join('')}</ol></nav>` : '';
  return `<section class="page-hero${photo ? ' has-photo' : ''}"><div class="wrap${photo ? ' split split-media' : ''}">
    <div>${bc}${eyebrow(kicker)}<h1>${rich(title)}</h1>${intro ? `<p class="lede">${e(intro)}</p>` : ''}</div>
    ${photo ? img(c, photo, { cls: 'page-hero-photo', eager: true, sizes: '(min-width: 960px) 45vw, 100vw', ratio: '4 / 3' }) : ''}
  </div></section>`;
}

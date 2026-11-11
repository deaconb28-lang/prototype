// Runs inside the page (Playwright page.evaluate). Collects everything the
// automatic deslop checks need. Keep it self-contained: no imports, no closures.
() => {
  const vw = window.innerWidth, vh = window.innerHeight;
  const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) > 0.05; };
  const inFirstScreen = (el) => { const r = el.getBoundingClientRect(); return vis(el) && r.top < vh && r.bottom > 0 && r.left < vw && r.right > 0; };
  const txt = (el) => (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim();
  const sel = (el) => { if (!el || !el.tagName) return ''; const id = el.id ? `#${el.id}` : ''; const cls = typeof el.className === 'string' && el.className.trim() ? `.${el.className.trim().split(/\s+/).slice(0, 2).join('.')}` : ''; return `${el.tagName.toLowerCase()}${id}${cls}`; };
  const parseRGB = (s) => { const m = String(s).match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2; if (mx !== mn) { const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; } return { h, s, l }; };
  const effectiveBg = (el) => { let n = el; while (n && n.nodeType === 1) { const s = getComputedStyle(n); if (s.backgroundImage && s.backgroundImage !== 'none') return null; const c = parseRGB(s.backgroundColor); if (c && c.a > 0.85) return c; n = n.parentElement; } return { r: 255, g: 255, b: 255, a: 1 }; };
  const hasImgBehind = (el) => { let n = el; while (n && n.nodeType === 1) { if (n.querySelector && n !== el && n.querySelector(':scope > figure img, :scope > img, :scope > video, :scope > picture')) return true; n = n.parentElement; } return false; };

  const all = [...document.querySelectorAll('body *')];
  const out = { url: location.href, vw, vh };
  out.title = document.title || '';
  out.lang = document.documentElement.lang || '';
  out.metaDescription = document.querySelector('meta[name="description"]')?.content || '';
  out.viewport = !!document.querySelector('meta[name="viewport"]');
  out.favicons = [...document.querySelectorAll('link[rel~="icon"]')].map((l) => l.getAttribute('href') || '');
  out.jsonldTypes = [];
  document.querySelectorAll('script[type="application/ld+json"]').forEach((s) => { try { const d = JSON.parse(s.textContent); const walk = (x) => { if (Array.isArray(x)) return x.forEach(walk); if (x && typeof x === 'object') { if (x['@type']) out.jsonldTypes.push(...[].concat(x['@type'])); if (x['@graph']) walk(x['@graph']); } }; walk(d); } catch (_) {} });
  out.text = txt(document.body);
  out.headings = [...document.querySelectorAll('h1, h2, h3')].filter(vis).map((h) => ({ tag: h.tagName.toLowerCase(), text: txt(h) }));
  out.h1Count = [...document.querySelectorAll('h1')].filter(vis).length;
  const ctaEls = [...document.querySelectorAll('a, button, input[type="submit"], [role="button"]')].filter(vis);
  const isButtony = (el) => { const s = getComputedStyle(el); const bg = parseRGB(s.backgroundColor); return el.tagName === 'BUTTON' || el.type === 'submit' || /btn|button|cta/i.test(el.className || '') || (bg && bg.a > 0.5 && parseFloat(s.paddingLeft) >= 10 && el.tagName === 'A'); };
  out.ctas = ctaEls.filter(isButtony).map((el) => ({ text: txt(el) || el.value || '', firstScreen: inFirstScreen(el), href: el.getAttribute('href') || '', bg: getComputedStyle(el).backgroundColor, sel: sel(el) }));
  out.links = [...document.querySelectorAll('a')].map((a) => ({ href: a.getAttribute('href'), text: txt(a).slice(0, 60), cls: String(a.className || '') }));
  out.telLinks = [...document.querySelectorAll('a[href^="tel:"]')].length;
  const phoneRe = /(\+?1[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b|\+\d{1,3}[\s\d-]{8,14}\d/;
  const firstScreenText = all.filter((el) => el.children.length === 0 && inFirstScreen(el)).map(txt).join(' ');
  out.firstScreenText = firstScreenText;
  out.phoneInFirstScreen = phoneRe.test(firstScreenText) || [...document.querySelectorAll('a[href^="tel:"]')].some(inFirstScreen);
  out.phoneTextCount = (out.text.match(new RegExp(phoneRe.source, 'g')) || []).length;
  out.quoteInFirstScreen = ctaEls.filter(inFirstScreen).some((el) => /quote|estimate|inspection|book|schedule|appointment|consult|request|free/i.test(txt(el) + ' ' + (el.getAttribute('href') || '')));
  out.firstScreenButtons = out.ctas.filter((c) => c.firstScreen && !/^tel:/.test(c.href)).length;

  // Typography
  const h1 = document.querySelector('h1');
  const ps = [...document.querySelectorAll('p')].filter((p) => vis(p) && txt(p).length > 60 && !p.closest('footer, header, nav, figcaption, form, [class*="note"], [class*="legal"], [class*="caption"], [class*="banner"]')).slice(0, 40);
  const fam = (el) => (el ? getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim() : '');
  out.fontH1 = fam(h1); out.fontBody = fam(ps[0] || document.body);
  out.h1Size = h1 ? parseFloat(getComputedStyle(h1).fontSize) : 0;
  // First paragraph after the H1 (the hero subheading).
  out.heroSub = '';
  if (h1) { const after = [...document.querySelectorAll('p')].find((p) => vis(p) && (h1.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING) && txt(p).split(/\s+/).length > 6); if (after) out.heroSub = txt(after); }
  const sizes = ps.map((p) => parseFloat(getComputedStyle(p).fontSize)).sort((a, b) => a - b);
  out.bodySize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : parseFloat(getComputedStyle(document.body).fontSize);
  const lh = ps.map((p) => { const s = getComputedStyle(p); const v = parseFloat(s.lineHeight); return Number.isFinite(v) ? v / parseFloat(s.fontSize) : 1.2; }).sort((a, b) => a - b);
  out.bodyLeading = lh.length ? lh[Math.floor(lh.length / 2)] : 1.5;
  out.longLines = ps.filter((p) => p.getBoundingClientRect().width / parseFloat(getComputedStyle(p).fontSize) > 46).length;
  out.centeredLong = ps.filter((p) => { const s = getComputedStyle(p); return s.textAlign === 'center' && p.getBoundingClientRect().height > parseFloat(s.lineHeight || 24) * 3.2; }).length;
  out.families = [...new Set(all.filter((el) => el.children.length === 0 && txt(el)).slice(0, 1500).map(fam))].filter(Boolean);
  out.gradientText = all.filter((el) => { const s = getComputedStyle(el); return (s.backgroundClip === 'text' || s.webkitBackgroundClip === 'text') && /gradient/.test(s.backgroundImage); }).map(sel).slice(0, 5);

  // Color
  const purple = [], blobs = [], glow = [], glass = [], shadowRound = [], shadows = [];
  for (const el of all) {
    const s = getComputedStyle(el); const r = el.getBoundingClientRect(); const area = r.width * r.height;
    if (/gradient/.test(s.backgroundImage) && area > 8000) {
      const cols = (s.backgroundImage.match(/rgba?\([^)]+\)/g) || []).map(parseRGB).filter(Boolean);
      if (cols.some((c) => { const h = hsl(c); return h.h >= 245 && h.h <= 295 && h.s > 0.35 && h.l > 0.2 && h.l < 0.8 && c.a > 0.3; })) purple.push(sel(el));
    }
    const blur = (s.filter.match(/blur\((\d+)/) || [])[1];
    const pr = el.parentElement && el.parentElement.getBoundingClientRect(); const overlay = pr && r.width >= pr.width * 0.9 && r.height >= pr.height * 0.9;
    if ((blur && Number(blur) >= 30 && !overlay) || (/radial-gradient/.test(s.backgroundImage) && (s.position === 'absolute' || s.position === 'fixed') && area > 20000 && !txt(el) && !overlay)) blobs.push(sel(el));
    if (s.backdropFilter && s.backdropFilter !== 'none' && !el.closest('header, nav, [data-mobile-bar], .mobile-bar')) glass.push(sel(el));
    if (/gradient/.test(s.borderImageSource || '') || (/rgba?\(/.test(s.boxShadow) && / 0px 0px \d{2,}px/.test(s.boxShadow) && (() => { const c = parseRGB(s.boxShadow); return c && hsl(c).s > 0.5 && c.a > 0.25; })())) glow.push(sel(el));
    const sh = s.boxShadow !== 'none' && (s.boxShadow.match(/(\d+)px (\d+)px (\d+)px/) || []);
    if (sh && Number(sh[3]) >= 8 && area > 2000) { shadows.push(sel(el)); if (parseFloat(s.borderTopLeftRadius) >= 12) shadowRound.push(sel(el)); }
  }
  out.purpleGradients = purple.slice(0, 5); out.blobs = blobs.slice(0, 5); out.glass = glass.slice(0, 5); out.glow = glow.slice(0, 5);
  out.shadowRound = shadowRound.length; out.shadowCount = shadows.length;
  const btnBgs = out.ctas.map((c) => parseRGB(c.bg)).filter((c) => c && c.a > 0.5);
  out.frameworkBlue = btnBgs.some((c) => ['37,99,235', '59,130,246', '29,78,216'].includes(`${c.r},${c.g},${c.b}`));
  const hues = new Set();
  [...btnBgs, ...[...document.querySelectorAll('a')].filter(vis).slice(0, 200).map((a) => parseRGB(getComputedStyle(a).color))].filter(Boolean).forEach((c) => { const h = hsl(c); if (h.s > 0.45 && h.l > 0.15 && h.l < 0.85) hues.add(Math.round(h.h / 30)); });
  out.accentHues = hues.size;
  const lowC = [];
  for (const el of all) {
    if (lowC.length > 12) break;
    if (!el.childNodes || ![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 2)) continue;
    if (!vis(el) || el.closest('[aria-hidden="true"]')) continue;
    const s = getComputedStyle(el); const fg = parseRGB(s.color); if (!fg) continue;
    const bg = effectiveBg(el); if (!bg || hasImgBehind(el)) continue;
    const size = parseFloat(s.fontSize); const bold = Number(s.fontWeight) >= 700;
    const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5;
    const ratio = contrast({ ...fg }, bg);
    if (ratio < need - 0.05) lowC.push({ sel: sel(el), text: txt(el).slice(0, 40), ratio: Math.round(ratio * 100) / 100 });
  }
  out.lowContrast = lowC;

  // Layout & components
  const iconCards = []; const tinted = [];
  for (const el of all) {
    const kids = [...el.children].filter(vis);
    if (kids.length < 3 || kids.length > 8) continue;
    const cardish = kids.filter((k) => k.querySelector('h3, h4, strong') && k.querySelector('p') && k.querySelector('svg, i, img'));
    if (cardish.length >= 3) {
      const wrapped = cardish.filter((k) => { const ic = k.querySelector('svg, i, img'); const box = ic.parentElement; const s = getComputedStyle(box); const r = box.getBoundingClientRect(); const bg = parseRGB(s.backgroundColor); return r.width <= 80 && r.height <= 80 && bg && bg.a > 0.1 && parseFloat(s.borderTopLeftRadius) >= 6; });
      if (wrapped.length >= 3) { iconCards.push(sel(el)); tinted.push(...wrapped.map(sel)); }
    }
  }
  out.iconCards = [...new Set(iconCards)].slice(0, 5); out.tintedIcons = tinted.length;
  out.statNumbers = all.filter((el) => el.children.length === 0 && /^\s*(\d[\d,.]*\s*(\+|%|k\+?|x)|#1)\s*$/i.test(txt(el))).map(txt).slice(0, 10);
  out.logoCloud = /trusted by|as seen (on|in)|featured in|our partners/i.test(out.text) && document.querySelectorAll('img').length > 4;
  out.horizontalOverflow = document.documentElement.scrollWidth > vw + 2;
  const imgs = [...document.querySelectorAll('img')].filter((i) => { const r = i.getBoundingClientRect(); return r.width >= 120 && r.height >= 80; });
  const stockRe = /unsplash|pexels|pixabay|shutterstock|istockphoto|gettyimages|freepik|stock\.adobe|depositphotos|dreamstime|123rf/i;
  out.images = imgs.length;
  out.stockImages = imgs.filter((i) => stockRe.test(i.currentSrc || i.src) || i.closest('figure')?.querySelector('.ph-tag')).length;
  out.noDims = imgs.filter((i) => !i.getAttribute('width') && !i.getAttribute('height') && getComputedStyle(i).aspectRatio === 'auto').length;
  out.oversized = imgs.filter((i) => i.naturalWidth > 1400 && i.naturalWidth > i.getBoundingClientRect().width * 2.6 * (window.devicePixelRatio || 1)).length;
  out.noAlt = [...document.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt') || (i.getAttribute('alt') === '' && i.getBoundingClientRect().width > 200)).length;
  out.sparkles = /✨|🪄/.test(out.text) || !!document.querySelector('svg[class*="sparkle"], svg[class*="wand"], [class*="sparkle"], i[class*="magic"]');
  const emojiRe = /\p{Extended_Pictographic}/u;
  out.emojiHeadings = [...out.headings.map((h) => h.text), ...out.ctas.map((c) => c.text)].filter((t) => emojiRe.test(t.replace(/[©®™]/g, ''))).slice(0, 5);
  out.emojiBullets = [...document.querySelectorAll('li')].filter((li) => emojiRe.test(txt(li).slice(0, 3).replace(/[©®™]/g, ''))).length;
  out.checkLists = [...document.querySelectorAll('ul, ol')].filter((l) => { const lis = [...l.children]; return lis.length >= 2 && lis.filter((li) => /^[✓✔☑✅]/.test(txt(li)) || li.querySelector('svg[class*="check"], .icon-check, [class*="check"] svg') || (li.querySelector('svg') && /check/i.test(li.querySelector('svg').outerHTML))).length >= lis.length * 0.6; }).length;
  out.pricingTiers = /\b(starter|basic|pro|premium|enterprise)\b/i.test(out.text) && /(\/mo\b|per month|\/month|monthly)/i.test(out.text) && document.querySelectorAll('[class*="pricing"], [class*="tier"], [class*="plan"]').length >= 3;
  const reviewEls = [...document.querySelectorAll('blockquote, [class*="testimonial"], [class*="review-card"], [class*="quote"]')].filter((el) => vis(el) && txt(el).length > 40);
  out.reviews = reviewEls.length;
  out.anonymousReviews = reviewEls.filter((el) => { const box = el.closest('figure, li, article, [class*="testimonial"], [class*="review"]') || el.parentElement; return !box.querySelector('cite, figcaption, .who, [class*="author"], [class*="name"], strong'); }).length;
  out.carousel = !!document.querySelector('.swiper, .slick-slider, .carousel, .embla, .splide, .glide, [data-carousel], [class*="carousel"]');
  const forms = [...document.querySelectorAll('form')].filter(vis);
  out.forms = forms.map((f) => {
    const fields = [...f.querySelectorAll('input, select, textarea')].filter((i) => vis(i) && !['hidden', 'submit', 'button', 'checkbox', 'radio'].includes(i.type));
    const unlabeled = fields.filter((i) => !(i.id && document.querySelector(`label[for="${CSS.escape(i.id)}"]`)) && !i.closest('label')).length;
    const around = txt(f.parentElement || f);
    return { fields: fields.length, unlabeled, newsletter: /newsletter|subscribe/i.test(txt(f)) && fields.some((i) => i.type === 'email') && fields.length <= 2, promise: /(call|get back|respond|reply|hear (back|from)|contact you)[^.]{0,50}(within|same[- ]day|in under|\d+\s*(minutes?|hours?|business))/i.test(around) };
  });
  out.deadLinks = out.links.filter((l) => l.href === '#' || l.href === '' || /^javascript:/i.test(l.href || '')).filter((l) => !/skip/i.test(l.cls)).length;
  out.socialDead = out.links.filter((l) => /^https?:\/\/(www\.)?(facebook|instagram|twitter|x|linkedin|youtube|tiktok)\.com\/?$/i.test(l.href || '')).length;
  out.popups = all.filter((el) => { const s = getComputedStyle(el); if (!['fixed'].includes(s.position) || !vis(el)) return false; if (el.closest('header, [data-header], [data-mobile-bar]')) return false; const r = el.getBoundingClientRect(); return r.width * r.height > vw * vh * 0.3; }).map(sel).slice(0, 3);
  out.revealCount = document.querySelectorAll('[data-aos], [data-animate], [data-sal], [data-scroll], .wow, .reveal, [class*="fade-up"], [class*="animate-"], [style*="opacity: 0"], [style*="opacity:0"]').length;
  let anims = []; try { anims = document.getAnimations(); } catch (_) {}
  out.infiniteAnims = anims.filter((a) => a.effect && a.effect.getComputedTiming && a.effect.getComputedTiming().iterations === Infinity).length;
  out.animCount = anims.length;
  let css = '';
  for (const sh of document.styleSheets) { try { for (const r of sh.cssRules) css += r.cssText + '\n'; } catch (_) {} }
  out.cssLen = css.length;
  out.reducedMotion = /prefers-reduced-motion/.test(css);
  out.outlineNone = /outline:\s*(none|0)(\s|;|!)/.test(css) && !/:focus-visible/.test(css);
  out.hasTransitionsOrKeyframes = /@keyframes/.test(css);
  // Mobile-relevant
  out.stickyCallBar = all.some((el) => { const s = getComputedStyle(el); if (!['fixed', 'sticky'].includes(s.position) || !vis(el)) return false; const r = el.getBoundingClientRect(); return r.bottom >= vh - 6 && r.top > vh * 0.6 && el.querySelector('a[href^="tel:"]'); });
  out.smallTargets = [...document.querySelectorAll('a, button, input, select, textarea')].filter((el) => { if (!vis(el) || el.closest('p, li p, .crumbs, .footer-legal, figcaption')) return false; const r = el.getBoundingClientRect(); return (r.width < 24 || r.height < 24) && r.width > 0 && !(el.tagName === 'A' && getComputedStyle(el).display === 'inline'); }).map((el) => sel(el)).slice(0, 12);
  // Scripts
  try { out.jsBytes = performance.getEntriesByType('resource').filter((r) => r.initiatorType === 'script').reduce((a, r) => a + (r.transferSize || r.encodedBodySize || 0), 0); } catch (_) { out.jsBytes = 0; }
  // Placeholder markers
  out.sampleTags = document.querySelectorAll('[data-sample], .ph-tag').length;
  return out;
}

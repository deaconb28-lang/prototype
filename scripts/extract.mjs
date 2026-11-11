#!/usr/bin/env node
// Pull business facts from a website or a Google Maps / Business Profile link so
// /prototype can start from what's already public.
//
//   node scripts/extract.mjs <url> [--out file.json] [--render]
//
// Website: reads JSON-LD, tel/mailto links, address, hours, license numbers,
// headings, nav, photos (with alt text), logo, social links and on-page reviews.
// Google link: uses the official Places API when GOOGLE_PLACES_API_KEY is set
// (name, phone, address, hours, rating, up to 5 reviews, website). Without a key
// it returns the place name from the link so Claude can find the website instead.
// It never scrapes Google Maps pages.
import fs from 'node:fs';
import { loadPlaywright } from './lib.mjs';

const args = process.argv.slice(2);
const url = args.find((a) => /^https?:\/\//i.test(a));
const out = args.includes('--out') ? args[args.indexOf('--out') + 1] : null;
if (!url) { console.error('Usage: node scripts/extract.mjs <website-or-google-maps-url> [--out file.json] [--render]'); process.exit(1); }

const TRADES = {
  roofing: /\broof(s|ing|er|ers)?\b|shingle|gutter/i,
  plumbing: /\bplumb(er|ing|ers)\b|drain|water heater|sewer|leak detection/i,
  hvac: /\bhvac\b|heating|air condition|\bac repair|furnace|heat pump|ductless/i,
  electrical: /\belectric(al|ian|ians)\b|panel upgrade|wiring|ev charger|generator/i,
  landscaping: /landscap|lawn|hardscap|irrigation|yard|tree service|mowing/i,
  painting: /\bpaint(er|ers|ing)\b|cabinet refinish|stain/i,
  'pest-control': /\bpest|termite|exterminat|rodent|bed bug|mosquito/i,
  cleaning: /\bclean(ing|ers)\b|maid|janitorial|house keeping|housekeeping/i,
  remodeling: /remodel|renovat|kitchen|bathroom|addition|general contractor/i,
  'garage-doors': /garage door|door opener|overhead door/i,
};
const LIC = /\b(lic(ense|ence)?|reg(istration)?|contractor|roc|cslb)\s*(no\.?|number|#)?\s*[:#]?\s*([A-Z]{0,4}[-\s]?\d{3,}[A-Z0-9-]*)/i;
const PHONE = /(\+?1[\s.-]?)?\(?\b(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})\b/;
const clean = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&#0?39;|&apos;|&rsquo;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

function guessTrade(text) {
  const scores = Object.entries(TRADES).map(([k, re]) => [k, (text.match(new RegExp(re.source, 'gi')) || []).length]).sort((a, b) => b[1] - a[1]);
  return scores[0][1] ? scores[0][0] : null;
}

async function fromGoogle(u) {
  let resolved = u;
  try { const r = await fetch(u, { redirect: 'follow' }); resolved = r.url || u; } catch (_) {}
  const m = resolved.match(/\/maps\/place\/([^/@?]+)/) || resolved.match(/[?&]q=([^&]+)/) || resolved.match(/[?&]query=([^&]+)/);
  const query = m ? decodeURIComponent(m[1].replace(/\+/g, ' ')) : null;
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    return { source: 'google-link', url: u, resolved, placeName: query, note: 'No GOOGLE_PLACES_API_KEY set. Search the web for the business website (name + town), then run this script on that website. Ask the user for the Google rating and review count if they want them shown.' };
  }
  if (!query) return { source: 'google-link', url: u, resolved, error: 'Could not read a place name from the link. Ask the user for the business name and town.' };
  const fields = 'places.id,places.displayName,places.formattedAddress,places.addressComponents,places.nationalPhoneNumber,places.internationalPhoneNumber,places.websiteUri,places.rating,places.userRatingCount,places.regularOpeningHours,places.reviews,places.googleMapsUri,places.primaryTypeDisplayName,places.location';
  const r = await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { 'content-type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields }, body: JSON.stringify({ textQuery: query }) });
  if (!r.ok) return { source: 'google-places', error: `Places API ${r.status}: ${(await r.text()).slice(0, 200)}` };
  const p = (await r.json()).places?.[0];
  if (!p) return { source: 'google-places', error: `No place found for "${query}"` };
  const comp = (t) => p.addressComponents?.find((c) => c.types.includes(t));
  return {
    source: 'google-places', url: u,
    name: p.displayName?.text, phone: p.nationalPhoneNumber, website: p.websiteUri,
    address: { full: p.formattedAddress, street: [comp('street_number')?.longText, comp('route')?.longText].filter(Boolean).join(' '), city: comp('locality')?.longText, region: comp('administrative_area_level_1')?.shortText, postal: comp('postal_code')?.longText, country: comp('country')?.shortText },
    city: comp('locality')?.longText, region: comp('administrative_area_level_1')?.shortText,
    hours: p.regularOpeningHours?.weekdayDescriptions?.join('; '),
    rating: p.rating ? { value: p.rating, count: p.userRatingCount, source: 'Google', url: p.googleMapsUri } : null,
    reviews: (p.reviews || []).map((rv) => ({ text: clean(rv.text?.text || rv.originalText?.text), author: rv.authorAttribution?.displayName?.split(' ')[0], rating: rv.rating, source: 'Google', date: rv.publishTime?.slice(0, 10) })).filter((rv) => rv.text),
    category: p.primaryTypeDisplayName?.text,
    trade_guess: guessTrade(`${p.displayName?.text} ${p.primaryTypeDisplayName?.text}`),
    note: 'Google reviews are shown with first name and source. Ask the business before publishing them on the live site.',
  };
}

async function fromWebsite(u, render) {
  let html = '';
  if (!render) { try { const r = await fetch(u, { redirect: 'follow' }); html = await r.text(); } catch (err) { html = ''; } }
  const thin = (h) => h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().length < 600;
  let pageData;
  if (render || !html || thin(html)) {
    const pw = loadPlaywright({ optional: true });
    if (pw) {
      const b = await pw.chromium.launch();
      const p = await b.newPage();
      await p.goto(u, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
      html = await p.content();
      await b.close();
    }
  }
  // Parse with a tiny DOM-free approach: regexes are enough for the facts we need.
  const get = (re) => (html.match(re) || [])[1];
  const text = clean(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&'));
  const ld = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)].flatMap((m) => { try { const d = JSON.parse(m[1].trim()); return Array.isArray(d) ? d : d['@graph'] || [d]; } catch (_) { return []; } });
  const biz = ld.find((x) => /LocalBusiness|Contractor|Plumber|Electrician|HVAC|HousePainter|HomeAndConstruction|Roofing|Organization/.test([].concat(x['@type']).join(' '))) || {};
  const abs = (s) => { try { return new URL(s, u).href; } catch (_) { return null; } };
  const tels = [...new Set([...html.matchAll(/href=["']tel:([^"']+)/gi)].map((m) => m[1].trim()))];
  const mails = [...new Set([...html.matchAll(/href=["']mailto:([^"'?]+)/gi)].map((m) => m[1].trim()))];
  const imgs = [...html.matchAll(/<img\b([^>]*)>/gi)].map((m) => {
    const attr = (n) => (m[1].match(new RegExp(`${n}=["']([^"']+)`, 'i')) || [])[1];
    const src = attr('data-src') || attr('src') || (attr('srcset') || '').split(',').pop()?.trim().split(' ')[0];
    return { url: abs(src), alt: clean(attr('alt')), w: Number(attr('width')) || null };
  }).filter((i) => i.url && !/\.svg(\?|$)|logo|icon|sprite|badge|pixel|spacer|gravatar|facebook|google|yelp|bbb|angi|avatar/i.test(i.url + i.alt) && (!i.w || i.w >= 300));
  const logo = abs(biz.logo?.url || biz.logo || get(/<img[^>]+(?:class|alt|src)=["'][^"']*logo[^"']*["'][^>]*src=["']([^"']+)/i) || get(/<img[^>]+src=["']([^"']+)["'][^>]*(?:class|alt)=["'][^"']*logo/i) || '');
  const headings = [...html.matchAll(/<h([1-3])[^>]*>([\s\S]*?)<\/h\1>/gi)].map((m) => clean(m[2].replace(/<[^>]+>/g, ' '))).filter(Boolean).slice(0, 40);
  const navLinks = [...(html.match(/<nav[\s\S]*?<\/nav>/gi) || []).join(' ').matchAll(/<a[^>]*>([\s\S]*?)<\/a>/gi)].map((m) => clean(m[1].replace(/<[^>]+>/g, ' '))).filter((t) => t && t.length < 40);
  const reviews = [...html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)].map((m) => clean(m[1].replace(/<[^>]+>/g, ' '))).filter((t) => t.length > 40 && t.length < 600).slice(0, 8);
  const addr = biz.address || {};
  const phoneMatch = (biz.telephone || tels[0] || (text.match(PHONE) || [])[0] || '').replace(/^tel:/, '');
  const yearsM = text.match(/\b(since|established|est\.?|founded( in)?)\s+(19\d\d|20[0-2]\d)\b/i) || text.match(/\b(\d{1,2})\+?\s+years\b/i);
  const social = [...new Set([...html.matchAll(/href=["'](https?:\/\/(?:www\.)?(?:facebook|instagram|youtube|linkedin|tiktok|x|twitter|nextdoor|yelp)\.com\/[^"']+)/gi)].map((m) => m[1]))].slice(0, 8);
  const ratingM = biz.aggregateRating ? { value: Number(biz.aggregateRating.ratingValue), count: Number(biz.aggregateRating.reviewCount || biz.aggregateRating.ratingCount), source: 'site schema (verify)' } : null;
  const services = [...new Set([...headings, ...navLinks].filter((t) => Object.values(TRADES).some((re) => re.test(t)) && t.split(' ').length <= 6))].slice(0, 12);
  return {
    source: 'website', url: u,
    name: biz.name || clean(get(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)/i)) || clean((get(/<title>([\s\S]*?)<\/title>/i) || '').split(/[|\-–]/)[0]),
    title: clean(get(/<title>([\s\S]*?)<\/title>/i)),
    description: clean(biz.description || get(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)/i)),
    phone: phoneMatch || null,
    email: biz.email || mails[0] || null,
    address: typeof addr === 'object' ? { street: addr.streetAddress, city: addr.addressLocality, region: addr.addressRegion, postal: addr.postalCode, country: addr.addressCountry } : { full: addr },
    city: addr.addressLocality || null, region: addr.addressRegion || null,
    areas_guess: [].concat(biz.areaServed || []).map((a) => (typeof a === 'string' ? a : a.name)).filter(Boolean),
    hours: [].concat(biz.openingHours || []).join('; ') || (text.match(/\b(mon(day)?[^.]{0,60}?(am|pm)[^.]{0,40}?(am|pm))/i) || [])[0] || null,
    openingHours: biz.openingHours || null,
    license: (text.match(LIC) || [])[0] || null,
    years: yearsM ? (yearsM[3] ? new Date().getFullYear() - Number(yearsM[3]) : Number(yearsM[1])) : null,
    rating: ratingM,
    trade_guess: guessTrade(`${headings.join(' ')} ${navLinks.join(' ')} ${text.slice(0, 4000)}`),
    services_guess: services,
    headings, nav: navLinks,
    photos: imgs.slice(0, 24),
    og_image: abs(get(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)/i) || ''),
    logo: logo || null,
    social,
    onsite_reviews: reviews,
    note: 'Facts were read from the public site. Confirm anything you put on the prototype (license, years, ratings) with the business. Photos are theirs: use them in the prototype, and ask before reusing them on a live site.',
  };
}

const isGoogle = /google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps|g\.page|business\.google\.com|maps\.google\./i.test(url);
const result = isGoogle ? await fromGoogle(url) : await fromWebsite(url, args.includes('--render'));
const json = JSON.stringify(result, null, 2);
if (out) fs.writeFileSync(out, json);
console.log(json);

---
name: prototype
description: Build a beautiful, fully clickable prototype website for a roofer or other local trade business in minutes, from a few details (name, trade, town, phone) or from the business's existing website or Google Business listing. Picks one of 10 styles, applies a trade content pack, writes specific local copy, runs /deslopify on its own output, and returns a live or local preview with screenshots. Use when the user asks for a website, mockup, prototype, spec site, demo site or redesign for a small business.
argument-hint: "<name, trade, town, phone> | <website URL> | <Google Maps link>  [style]"
---

# /prototype

Goal: in one pass, a 15-17 page clickable site a business owner would be proud of, with **nothing invented**. Speed matters: don't ask questions you can answer with a default.

Arguments: `$ARGUMENTS`

## 1. Gather the facts

Make a slug from the business name (`ridgeline-roofing`) and work in `sites/<slug>/` (gitignored, so client work never lands in this public repo).

- **Website URL**: `node scripts/extract.mjs <url> --out sites/<slug>/extract.json`. Add `--render` if the result is thin (JS-heavy sites).
- **Google Maps / Business Profile link**: run the same script. With `GOOGLE_PLACES_API_KEY` set it returns name, phone, address, hours, rating, review count and up to 5 reviews via the official Places API. Without a key it returns `placeName`: search the web for that name plus town to find the website, then extract from the website. Never scrape Google Maps pages.
- **Plain details**: parse name, trade, town/state and phone from the arguments.

The minimum is **name, trade, town (with state/region) and phone**. If something is still missing, ask once, naming only what's missing. If the user has no phone yet, use `(555) 010-01xx` and list it as a launch blocker.

## 2. Pick the trade pack

Map the business to one of `trades/*.json`: roofing, plumbing, hvac, electrical, landscaping, painting, pest-control, cleaning, remodeling, garage-doors. Close matches: gutters→roofing, AC/furnace→hvac, handyman/general contractor/kitchen and bath→remodeling, tree service/lawn care/irrigation/fencing→landscaping, pressure washing/window cleaning/maid service→cleaning, drain/sewer/water heater→plumbing, solar/generator/EV charger→electrical.

If none fits (e.g. a locksmith or an auto shop), copy the closest pack to `sites/<slug>/trade.json` and rewrite services, FAQs, process, quote form and hero for the real trade. Keep the same schema and the copy rules below. The engine prefers `sites/<slug>/trade.json` when it exists.

## 3. Pick the style

Use the style the user named. Otherwise use the default for the trade and mention the two alternatives. Read `styles/README.md` when the brand calls for something else (premium vs value, existing brand colors, the tone of their current site).

| Trade | Default | Also good |
|---|---|---|
| roofing | cinematic-horizon | heritage-ledger, jobsite-industrial |
| plumbing | heritage-ledger | market-fresh, blueprint-spec |
| hvac | blueprint-spec | wide-stance, jobsite-industrial |
| electrical | jobsite-industrial | blueprint-spec, nocturne-premium |
| landscaping | field-guide | editorial-warm, cinematic-horizon |
| painting | editorial-warm | poster-pop, field-guide |
| pest-control | poster-pop | market-fresh, field-guide |
| cleaning | market-fresh | poster-pop, editorial-warm |
| remodeling | nocturne-premium | editorial-warm, wide-stance |
| garage-doors | wide-stance | jobsite-industrial, blueprint-spec |

If the business has a real brand color, override the accent in `site.json` → `"css"`, for example `:root { --accent: #0b5d3b; --accent-hover: #094a2f; --accent-text: #0b5d3b; }`. Keep `--accent-ink` on `--accent` at 4.5:1 contrast or better; the audit checks it.

## 4. Write `sites/<slug>/site.json`

The full field reference is in [site-json.md](site-json.md). Copy `examples/<style>/site.json` as a starting point. Fill in:

- `business`: real facts only (name, trade, city, region, areas, phone, email, hours, address, license, years, rating, reviews, certifications, guarantees, logo, about). Leave out what you don't know: the engine shows a tagged sample instead of inventing it.
- `photos`: the business's own photos from extraction (`[{ "url", "alt", "use": "hero" | "work" | "team" }]`). Pick a wide, sharp, well-lit hero that shows the work or a house. With no photos, the engine uses the trade's curated stock set, labeled "Stock photo".
- `copy`: write the hero headline and subhead for this business. Specific beats clever: what they do, where, what happens next. You may mark one accent word in a headline with `*asterisks*`. Optional overrides: `eyebrow`, `primaryCta`, `servicesTitle`, `ctaTitle`, `aboutTitle`, `tagline`.
- `services`: reorder or trim the trade's services to what this business actually offers. Use slugs from the trade pack, or objects with your own `name`, `short`, `long` and `bullets`.

**Copy rules.** The audit enforces these, so write them right the first time:
- Plain, specific and local. Use numbers only when they're true (timelines, what's included).
- None of the words in deslop indicator C01: elevate, unlock, seamless, cutting-edge, top-notch, world-class, premier, peace of mind, excellence, journey, solutions, and the rest of that list.
- No em dashes, no exclamation marks in headings, no emoji, no "Welcome to".
- **Never invent** years in business, license numbers, ratings, review counts, reviews, certifications, awards or guarantees. Only use what the business published or the user told you.

## 5. Build

```bash
node engine/build.mjs sites/<slug>
```

This writes `sites/<slug>/dist/` as plain HTML, CSS and a tiny JS file, so it can be hosted anywhere. It includes the home page, services index, one page per service, work, reviews, about, service area, contact, thank-you and 404 pages, plus LocalBusiness schema, a sticky mobile call bar and working quote forms (prototype forms go to the thank-you page).

## 6. Deslopify it (automatic, no review UI)

```bash
node deslop/audit.mjs sites/<slug>/dist --prototype --city "<Town>" --run <slug>
```

- Fix every failing automatic check **at the source**: copy in `site.json`, styling in `site.json` → `css`. Then rebuild and re-audit. Stop at an automatic score of 90 or more, or after 3 rounds.
- Then read `.deslop/<slug>/screens/index-desktop.jpg` and `index-mobile.jpg` and judge the 18 visual indicators (`check: "visual"` in `deslop/indicators.json`). Fix what's in your control, such as a weak hero photo or a vague service list.
- `--prototype` turns placeholders (sample reviews, stock photos, missing license) into **launch blockers** instead of score penalties. Report them; don't hide them.

## 7. Preview and share

- Screenshots for the user:
  ```bash
  node scripts/screenshot.mjs sites/<slug>/dist --pages index.html,contact.html --out sites/<slug>/screens --scale 2
  ```
  Then show them.
- Local preview: run `node scripts/serve.mjs sites/<slug>/dist --port 4173` in the background and give the URL. In a cloud session, also report the port so the app can preview it.
- Live link: if the user asked for one, or a Vercel or Netlify tool or CLI is connected, offer to deploy `dist/` as a preview deployment. Deploy without asking only if the request already asked for a link. Say that the link is public to anyone who has it.

## 8. Report back (keep it short)

```
**<Business> prototype is ready**: <link or local URL>
- Style: <style> (<why, one clause>). Say "try <alt1>" or "try <alt2>" to switch.
- <N> pages: home, services (+<n> service pages), work, reviews, about, service area, contact.
- Deslop score: <score>/100; visual checks <passed>/18.
- Built from: <website / Google listing / your details>. Real info used: <phone, hours, 5 Google reviews, 12 photos...>
- Replace before launch: <launch blockers, e.g. 3 sample reviews, stock photos, license number, warranty terms>
```

Then show the screenshots.

## Follow-ups
- **"try <style>"**: change `style` in `site.json`, rebuild, re-screenshot. It takes seconds.
- **Edits**: change `site.json` and rebuild. Don't hand-edit `dist/`; the next build overwrites it.
- **Going live**: `node engine/build.mjs sites/<slug> --final` refuses to build while any sample, stock photo or unconfirmed claim remains.
- **Ideas for new styles or sections**: the reference library is in `library/`. `library/sections/*.json` has Mobbin references with notes, and `library/trade-patterns.json` has what converts on real trade sites.

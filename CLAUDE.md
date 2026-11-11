# Prototype: beautiful websites for roofers and other trades

This repo is a Claude Code toolkit. It turns a few facts about a local trade business into a beautiful, clickable website, and it strips "vibecoded" slop out of any site. It contains:

- **A design reference library** (`library/`): 177 Mobbin references across 15 section types with written notes, 13 style directions, and 35 real trade-business sites distilled into 38 conversion patterns. Links and notes only, no images (this repo is public).
- **10 styles × 10 trade packs** (`styles/`, `trades/`): any style works with any trade. Styles set typography, palette, shape and layout variants; trade packs supply services, FAQs, process, quote form, emergency and financing defaults, schema type and placeholder photos.
- **A static site engine** (`engine/`): `site.json` in, a 15-17 page site out (plain HTML/CSS, about 1 KB of JS), with LocalBusiness schema, tap-to-call everywhere, a sticky mobile call bar and working quote forms.
- **A deslop system** (`deslop/`): 100 indicators of AI-made or template-made sites (82 automatic, 18 visual), an audit, fix candidates, a before/after review page with accept/reject, and patch application.
- **Skills**: `/prototype`, `/deslopify`, `/refresh-library` (in `.claude/skills/`). The repo is also a Claude Code plugin and marketplace (`.claude-plugin/`), so the same skills install into any project with `/plugin install prototype --marketplace deaconb28-lang/prototype`.

## Start of every session

Before your first reply in a new session, run `node scripts/status.mjs` (skip it if a `<prototype-status>` block is already in context from the optional hook). Then open with a short update:

1. One line on what's here: library size and collection date, 10 styles, 10 trades, 100 deslop checks.
2. The skills, with one ready-to-run example each:
   - `/prototype Ridgeline Roofing, roofer in Boise ID, (208) 555-0142`, or `/prototype https://their-current-site.com`, or a Google Maps link
   - `/deslopify deslop/fixtures/vibecoded-roofer` to see the review flow on a deliberately sloppy demo page
3. Anything that needs attention from the status output: a missing or old library (offer `/refresh-library`), Playwright not installed (`npm install`), existing prototypes in `sites/`.

If the user's first message already asks for something, do that first and keep the update to one line at the end.

If the library is missing (`library/sections/` has fewer than 5 files), say so and start `/refresh-library` when the Mobbin MCP is connected. If it isn't, explain how to connect it: `claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp`, then `/mcp` → mobbin → Authenticate.

## Rules that apply to everything here

- **Never invent facts about a real business**: years, license numbers, ratings, review counts, reviews, certifications, awards, guarantees, response times. Use what the business published or the user said. The engine shows anything unconfirmed with a visible "Sample" or "Stock photo" tag, and `--final` builds refuse while any remain.
- **Copy**: plain, specific, local. No hype vocabulary (deslop C01 list), no em dashes, no exclamation marks in headings, no emoji, no "Welcome to". One `*accent word*` per headline at most.
- **Public repo**: client sites live in `sites/` and deslop runs in `.deslop/` (both gitignored). Never commit a client's site, photos or reviews. Never commit Mobbin images or image URLs.
- **Change the source, not the output**: edit `sites/<slug>/site.json` (or a style or trade pack) and rebuild. Don't hand-edit `dist/`.
- **Check your work visually**: after building or fixing, screenshot (`node scripts/screenshot.mjs`) and look at the result before reporting.

## Map

```
library/            reference library (sections/*.json, styles-research/directions.json, trade-patterns.json, SCHEMA.md)
styles/<id>/        style.json (tokens, fonts, layout variants, Mobbin references) + style.css (signature details)
trades/<id>.json    trade content packs; trades/photos.json = curated Pexels placeholders
engine/             build.mjs (site.json → dist), components.mjs (section variants), assets/base.css, assets/site.js
deslop/             indicators.json (100), audit.mjs, collect.js, fix.mjs, review.mjs, serve.mjs, apply.mjs, fixtures/
scripts/            status, setup (Playwright), extract (website or Google listing → facts), screenshot, serve, deploy (Vercel), build-examples
.claude-plugin/     plugin.json + marketplace.json + icon.png
examples/<style>/   one fictional demo business per style, built and screenshotted
sites/              your prototypes (gitignored)
```

## Common commands

```bash
node scripts/status.mjs --verbose                    # what's in the toolkit
node scripts/extract.mjs <url> --out facts.json      # facts from a website or Google link
node engine/build.mjs sites/<slug> [--style <id>]    # build a site
node scripts/serve.mjs sites/<slug>/dist             # click through it locally
node scripts/screenshot.mjs sites/<slug>/dist --pages index.html,contact.html --full
node deslop/audit.mjs <dir|url> [--prototype]        # 82 automatic checks + screenshots
node scripts/deploy.mjs sites/<slug>                 # share on Vercel: https://<slug>-preview.vercel.app
node scripts/build-examples.mjs                      # rebuild all 10 demo sites
claude plugin validate .                             # check the plugin + marketplace manifests
```

## Skills must work in two places

The same `SKILL.md` files run as project skills in this repo and as plugin skills in other people's projects. So:
- Reference toolkit files through `${CLAUDE_SKILL_DIR}/../../..` (the repo root, or the plugin root when installed). Never use bare relative paths like `engine/build.mjs`, and never `${CLAUDE_PLUGIN_ROOT}` (it isn't substituted in project skills).
- Write user output to the current project (`sites/`, `.deslop/`), never into the toolkit folder. The plugin's folder is a versioned cache that gets replaced on update.
- To release, bump `version` in `.claude-plugin/plugin.json` and in the plugin entry of `.claude-plugin/marketplace.json`, run `claude plugin validate .`, then merge to the default branch. Installed users get it with `/plugin update`.

## Extending

- **New style**: add `styles/<id>/style.json` (copy one; set tokens, fonts, `variants`, references) and `style.css`. Run `node scripts/build-examples.mjs --only <id>` after adding a demo to `examples/demos.json`, then audit it. Every text and button color pair must pass WCAG AA.
- **New trade**: add `trades/<id>.json` following an existing pack, plus photos in `trades/photos.json` (verify each URL and look at it).
- **New section variant**: add it to `engine/components.mjs`, style it in `engine/assets/base.css`, and let styles choose it via `variants`.

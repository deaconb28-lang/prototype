---
name: refresh-library
description: Re-scrape or extend the design reference library in library/ from the Mobbin MCP (website sections and whole-page style directions) plus web research on real trade-business sites. Use when the library is missing or older than about 90 days, when the user asks to refresh or extend it, or before designing a new style.
argument-hint: "[all | sections | directions | trade-patterns | <section-name>]"
---

# /refresh-library

Arguments: `$ARGUMENTS` (default: `all`)

## Before you start

1. Check that the Mobbin MCP is connected by running ToolSearch for `select:mcp__Mobbin__search_sections`.
   - If it isn't available: the repo's `.mcp.json` declares `mobbin` at `https://api.mobbin.com/mcp`. Ask the user to run `/mcp`, choose **mobbin**, then **Authenticate** (it needs a Mobbin account), or `claude mcp add mobbin --scope user --transport http https://api.mobbin.com/mcp`. On claude.ai, they can connect Mobbin under Settings → Connectors. Stop until it's connected. The committed library keeps working in the meantime.
2. **This repo is public.** Never save Mobbin images or their `image_url`s into the repo. Store Mobbin page links (`mobbin_url` with `utm_*` stripped) and your own written observations only. The format is in `library/SCHEMA.md`.
3. On every Mobbin call, pass exactly `output_destination: "reference_library"` and `task_intent: "Build a reference library of well-designed website sections to base small trade business website templates on."`. If a result includes `ai_usage_notice`, show its text to the user verbatim.

## Sections

`library/sections/` has 15 files: hero, navigation, announcement-banner, cta-band, services, process, pricing-financing, faq, testimonials, trust, about, footer, gallery, service-area, contact-form.

Run them in parallel as 4-5 background agents of 3-4 sections each. Image-heavy searches burn context, so keep each agent's scope small. Brief each agent with:

- The goal: references for a public toolkit that builds sites for roofers, plumbers, HVAC, electricians, landscapers, painters, pest control, cleaners, remodelers and garage-door companies.
- 3-5 `search_sections` queries per section, `limit` 15-20, `image_format: "jpg"`. Mix product contexts, because Mobbin has few actual trade businesses: home services, solar, construction, architecture, real estate, landscape studio, insurance, local business, plus one premium general query.
- Look at every image and keep the 8-12 strongest, most diverse and most adaptable. Skip SaaS look-alikes.
- Follow the schema in `library/SCHEMA.md`, with concrete measurements (approximate px and hex), `pattern` slugs, `trade_adaptation`, 5-8 `takeaways`, and an `avoid` list.
- Merge with the existing file: keep strong existing references, replace weaker ones, update `collected_at`.

## Style directions

`library/styles-research/directions.json`: 12-18 `search_screens` (`platform: "web"`) searches of whole homepages in adjacent categories. Group them into 12-15 clearly distinct directions, with typography (Google Fonts that match; avoid Inter, Poppins, Montserrat, Roboto, Open Sans, Lato, Playfair Display, Space Grotesk), palette, shape, layout personality, imagery, signature details and 2-4 cited references each.

## Trade patterns

`library/trade-patterns.json`: web research, not Mobbin. Study 25-35 strong real trade-business sites across the 10 trades, plus credible conversion sources, and catalog conversion patterns with prevalence, quote-form fields per trade, trust signals per trade, copy patterns, anti-patterns and schema.org types. Skip sites that block automated access; don't work around blocks.

## After the refresh

1. Validate every file you touched: `node -e "JSON.parse(require('fs').readFileSync('<file>'))"`.
2. Check for image URLs: `grep -rn "image_url\|mobbin.com/api" library/` must return nothing.
3. Run `node scripts/status.mjs --verbose` and report the counts to the user, with the 3 most useful new references per section and anything that should change in `styles/`.

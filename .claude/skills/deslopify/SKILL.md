---
name: deslopify
description: Audit a website against 100 indicators of vibecoded, AI-made "slop" (copy, typography, color, layout, imagery, decoration, trust, trade conversion, accessibility), then propose fixes as before/after mockups on a review page where the user accepts or rejects each one, and apply the accepted ones. Works on a site folder, local site code, or a live URL (audit plus mockups). Use when the user says deslop or deslopify, asks for an audit or critique, or wants a site to stop looking AI-generated or template-made.
argument-hint: "<site folder | URL> [--auto] [--prototype]"
---

# /deslopify

Arguments: `$ARGUMENTS`

The checklist is `deslop/indicators.json`: 100 indicators, each with id, category, severity, `check: "auto" | "visual"`, why it reads as slop, and the fix. 82 are checked by script; 18 need your eyes on screenshots.

## 0. Pick the target and mode

- **Built site folder** (has `index.html`), such as `sites/<slug>/dist` or any static site: the full flow below.
- **The demo fixture** `deslop/fixtures/vibecoded-roofer`: copy it to `sites/vibecoded-demo` first and audit the copy, so the fixture stays intact.
- **A project with source code** (React, Next, Astro...): build it to static output if possible (`npm run build`, then `dist/` or `out/`) and audit that, or run its dev server and audit the URL. The patches then show what to change; implement accepted fixes in the source files.
- **Sites built by /prototype** (`sites/<slug>/dist`): `dist/` is generated. After acceptance, carry the accepted changes into `sites/<slug>/site.json` (copy, `css`) and rebuild rather than patching `dist/`.
- **Live URL**: audit plus mockups. The audit snapshots the rendered pages, fixes are mocked up on the snapshots, and "apply" produces a patched mockup copy. It makes a strong sales asset: "your site scores 34; here it is at 88."
- `--auto` (used by /prototype): no review UI. Fix directly at the source, re-audit, stop at 90 or more.
- `--prototype`: placeholders (sample reviews, stock photos, missing license number) become launch blockers instead of score penalties.

## 1. Audit

```bash
node deslop/audit.mjs <folder-or-url> [--prototype] [--city "<Town>"] [--run <name>]
```

This prints the automatic score and the failures, and writes `.deslop/<run>/` containing `audit.json`, `base/` (the snapshot that fixes are made against) and `screens/` (full-page desktop and mobile shots of every audited page).

## 2. Visual pass

Read the desktop and mobile screenshots of the home page and one or two key pages (contact, a service page). Judge every `check: "visual"` indicator and write `.deslop/<run>/visual.json`:

```json
[
  { "id": "L01", "status": "fail", "page": "index.html", "evidence": "Centered headline and two buttons over a pastel gradient, no photo" },
  { "id": "I02", "status": "pass" },
  { "id": "I03", "status": "na" }
]
```

Be strict and specific. Evidence must point to something visible. Use `na` only when the indicator can't apply (for example, no photos at all for I02).

## 3. Plan fixes

Group the failing indicators into **3-10 fixes**, most impactful first. Each fix covers one section or one page-wide concern, so the user can accept them independently. Good fixes:

- "Say what, where and how to call in the hero" (C03, C12, T03, T07, V01, V03)
- "Replace the three icon cards with a real service list" (L02, D02, V07)
- "Swap invented stats for checkable facts" (L06, H01)
- "Make the phone a tap-to-call link everywhere and add a mobile call bar" (V02, V05)

Fixes that need facts you don't have (a license number, real reviews) go under "needs info from the business" in your summary. Never fill them with invented values; at most use an obvious placeholder like `Lic. #[number]`.

For each fix:

```bash
node deslop/fix.mjs new <run> F01 --title "Short imperative title" --indicators C03,C12,V01 --page index.html --selector ".hero" --why "One sentence: what changes and why it helps."
```

Then edit **only that fix's change** in `.deslop/<run>/fixes/F01/site/`. Keep fixes from overlapping where you can (different sections of a file are fine). Follow the copy rules: plain and specific, none of the C01 words, no em dashes, no exclamation marks, no invented facts. `--selector` sets the area the before/after mockup crops to.

## 4. Build the review page

```bash
node deslop/review.mjs <run>
```

This writes patches, before/after screenshots (desktop and mobile) and `.deslop/<run>/review/index.html`, plus a shareable `report.md`. Read one or two of the `review/shots/*-after-*.jpg` images to confirm the mockups look right before showing the user.

## 5. Let the user decide

Start the review server in the background:

```bash
node deslop/serve.mjs <run> --port 4321
```

Give the user the URL; in a cloud session, also report the port for preview. Tell them: open it, compare before and after (side by side or slider, desktop or mobile), accept or reject each fix, then press **Apply accepted fixes** and tell you "done".

If they can't open a browser, show each fix in chat with its before/after images and ask which to keep ("accept 1, 3 and 4").

## 6. Apply

```bash
node deslop/apply.mjs <run>              # reads decisions.json written by the review page
node deslop/apply.mjs <run> --ids F01,F03  # or explicit
```

Patches are dry-run first. One that no longer applies cleanly is skipped and reported; merge it by hand from `fixes/<ID>/site/`. Then re-audit and report the new score:

```
Deslop: <before> → <after>/100 · applied F01, F03, F04 · skipped F02 (rejected)
Still failing: <top remaining, with the one-line fix each>
Needs info from the business: <license number, real reviews...>
```

For live URLs, `apply` writes `.deslop/<run>/mockup/`, a patched copy for showing the owner, not a deploy.

## Scoring

Score = 100 × (1 − failing weight ÷ checked weight)², with weights high 5, medium 2.5 and low 1. A few misses cost little, and a pile of them drops the score fast. Typical vibecoded sites land around 30-60, careful sites in the 90s. Visual verdicts count once `visual.json` exists.

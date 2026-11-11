# Library schema

Every file in `library/sections/` follows this shape. The repo is public, so the
library stores **links and written observations only** - never Mobbin images or
their expiring `image_url`s. Open a reference's `url` on Mobbin to see it.

```jsonc
{
  "section": "hero",                       // slug, matches the filename
  "description": "What this section does on a trade website",
  "source": "Mobbin MCP (search_sections)",
  "collected_at": "YYYY-MM-DD",
  "queries": ["queries that were run"],
  "references": [
    {
      "id": "mobbin:<uuid>",
      "site": "Daylight",
      "url": "https://mobbin.com/sites/sections/<uuid>",   // utm params stripped
      "pattern": "fullbleed-photo",          // layout pattern slug (see vocabulary in README)
      "layout": "Where things sit and how big, in plain words",
      "type": "Typeface classification, weights, approximate sizes, case, tracking",
      "color": "Palette with approximate hex values (prefix with ~)",
      "details": ["Small, specific moves that make it feel crafted"],
      "why_it_works": "One or two sentences",
      "trade_adaptation": "How a roofer/plumber/etc. version would use it",
      "mood": ["editorial", "warm"],         // from: editorial, industrial, minimal, warm, bold, premium, friendly, technical, rustic, playful
      "quality": 4                           // 1-5, how strong a reference it is
    }
  ],
  "takeaways": ["Principles that recur across the best references"],
  "avoid": ["Patterns seen in results that read as generic or AI-made"]
}
```

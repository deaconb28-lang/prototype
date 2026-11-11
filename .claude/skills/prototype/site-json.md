# `site.json` reference

`engine/build.mjs` reads `sites/<slug>/site.json`. Each layer fills the gaps of the next: style (`styles/<id>`), trade pack (`trades/<trade>.json`, or `sites/<slug>/trade.json` if present), then your overrides.

```jsonc
{
  "style": "cinematic-horizon",            // folder name in styles/
  "business": {
    "name": "Ridgeline Roofing",           // required
    "trade": "roofing",                    // required: trade pack id
    "city": "Boise", "region": "ID",       // required
    "areas": ["Boise", "Meridian", "Nampa"],  // towns served; the first is the home town
    "area": "the Treasure Valley",         // optional phrase used in copy; defaults to the list of areas
    "phone": "(208) 555-0142",             // required; becomes tel: links everywhere
    "email": "office@ridgelineroofing.com",
    "hours": "Mon to Fri 7am to 6pm",      // shown in header utility bar, footer, contact
    "openingHours": ["Mo-Fr 07:00-18:00"], // optional schema.org format
    "address": { "street": "123 Main St", "city": "Boise", "region": "ID", "postal": "83702" },
    "mapQuery": "Ridgeline Roofing Boise", // optional: what the map embed searches
    "website": "https://...",              // used in schema.org url
    "license": "ID Contractor Reg. #RCE-12345",   // real only
    "years": 18,                           // real only; fills {{years}} in trade copy
    "about": "Two or three real sentences about the business.",
    "logo": "https://.../logo.png",        // or a path inside sites/<slug>/photos/
    "rating": { "value": 4.9, "count": 212, "source": "Google", "url": "https://maps.google.com/?cid=..." },  // real only
    "reviews": [ { "text": "...", "author": "Dana", "town": "Meridian", "source": "Google", "rating": 5 } ],  // real only
    "certifications": ["GAF Certified Contractor"],   // real only; otherwise the trade examples show tagged "Example"
    "guarantees": ["10-year workmanship warranty"],    // real only; otherwise tagged "Sample"
    "emergency": true,                     // true = confirmed urgent work; false = hide the emergency banner
    "financing": true,                     // true = confirmed; otherwise the financing card is tagged
    "confirmed": { "promise": true, "estimates": true, "plan": false },  // confirms trade-pack promises (callback time, free estimates, maintenance plan)
    "form_action": "https://formspree.io/f/xxxx",   // real form endpoint; omit in prototypes (the form goes to thank-you.html)
    "social": { "facebook": "https://facebook.com/..." }
  },
  "photos": [                              // the business's own photos; they replace the stock set
    { "url": "https://.../roof1.jpg", "alt": "New shingle roof on a two-story home in Meridian", "use": "hero" },
    { "url": "photos/crew.jpg", "alt": "The crew on a tear-off", "use": "team" },
    { "url": "...", "alt": "...", "use": "work", "caption": "Meridian · full replacement" }
  ],
  "copy": {
    "heroHeadline": "Roofs replaced in two days, *not two weeks.*",   // *one accent word or phrase*
    "heroSub": "One or two sentences: what, where, what happens next.",
    "eyebrow": "Roofing · Treasure Valley, Idaho",
    "primaryCta": "Get a free inspection",
    "navCta": "Free inspection",
    "mobileCta": "Free quote",
    "formCta": "Send my request",
    "heroCard": { "title": "Free roof inspection", "detail": "We call back within 2 business hours." },  // or false
    "servicesTitle": "...", "servicesIntro": "...", "processTitle": "...", "workTitle": "...",
    "reviewsTitle": "...", "aboutTitle": "...", "areasTitle": "...", "areasIntro": "...",
    "faqTitle": "...", "ctaTitle": "...", "ctaSub": "...", "footerKicker": "...", "tagline": "..."
  },
  "services": ["roof-replacement", "roof-repair", { "name": "Solar panel removal", "short": "...", "long": "...", "bullets": ["..."], "icon": "sun" }],
  "faqs": [ { "q": "...", "a": "..." } ],   // replaces the trade FAQs
  "process": [ { "title": "...", "detail": "..." } ],
  "css": ":root { --accent: #0b5d3b; }",   // appended last: brand color tweaks
  "options": { "sampleTags": true }         // false hides the Sample/Stock tags (presentation only; --final still checks)
}
```

Unknown facts stay out. The engine never prints an unresolved `{{placeholder}}`: a sentence that needs a missing fact is dropped, and claims it can't verify are rendered with a visible **Sample** tag.

Icon keys for services: roof, home, droplet, pipe, drain, flame, snowflake, fan, bolt, plug, outlet, light, panel, leaf, tree, sprinkler, shovel, fence, brush, roller, paint, bug, shield, broom, spray, hammer, ruler, door, wrench, sun, clock, phone, check, gauge, tools, ladder, window, gutter, heater, thermometer, key, calendar, star, award, badge, hardhat, truck, siren, umbrella, wind, vent, bath, shower, toilet, layers, coins, receipt, search, clipboard, timer, flower, axe, brick, warehouse, storm.

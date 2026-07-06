# TODO

## Critical (blocks production)

- [ ] Vercel: confirm calculator endpoints return JSON on production. Repo pushed to github.com/miceli583/astro-calculator and connected to Vercel. Endpoints currently return HTML. Check function logs in Vercel dashboard — if "Ephemeris data directory not found" appears, the new error message lists every path tried. If sweph fails to load, may need a Vercel-specific build hook to rebuild the native module.

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] Additional strict-lint pass — current setup enforces zero warnings; consider narrower ESLint overrides file-by-file if needed.

## Enhancements (nice to have)

- [ ] Remove vestigial prose scaffolding (`src/lib/constants/transit-themes.json` placeholder and `GET /api/v1/transit/theme` route) — prose is out of scope for this API; consumers own their own theming layer.
- [ ] Composite / Davison midpoint chart endpoint — deferred.
- [ ] Client-side test coverage for new UI (Transits tab, Sky page, Synastry sub-tab, planet/aspect filter chips).
- [ ] HD PHS sub-labels — MyBodyGraph shows Digestion labels like "Buzzing (Nervous Touch)" and directional labels like "Direct"/"InDirect". Map color+tone+base sub-classifications; needs lookup tables per variable.
- [ ] Verify J (Juxtaposition) cross names against MyBodyGraph — RA and LA are structurally verified via quaternary invariants; J entries are single-source only.
- [ ] Sabian Symbols — 360-degree symbolic image per zodiac degree (Marc Edmund Jones / Elsie Wheeler). Needs the canonical 360-entry table.
- [ ] Cards of Destiny Planetary Ruling Card + Karma Cards (needs verified lookup tables)
- [ ] Topocentric flag — design concurrency for sweph's global `set_topo` state. Mainly affects Moon (~1°)
- [ ] Sidereal zodiac with selectable ayanamsa (Lahiri / Krishnamurti / Fagan-Bradley)
- [ ] Caching layer (in-memory LRU + Vercel Runtime Cache)
- [ ] Rate limiting via Vercel Firewall WAF rules
- [ ] SDK packages (`@astro-calculator/client-ts`, Python)
- [ ] Render astrocartography lines on an interactive world map in `/chart`
- [ ] Cross-validate Mandela fixture values against Astrodienst once its Cloudflare gate is passable (currently seeded from our sweph-based calculator).

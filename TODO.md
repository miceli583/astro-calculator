# TODO

## Critical (blocks production)

- [x] Vercel: confirm calculator endpoints return JSON on production — **verified 2026-07-08**: all 15 endpoints swept on astro-calculator-design.vercel.app; every one returns `application/json` (incl. sweph-powered natal/transits/HD). The `serverExternalPackages` + `outputFileTracingIncludes: "**/*"` fix in next.config.ts resolved it. Evidence in GitHub issue #1 (closed).

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] Additional strict-lint pass — current setup enforces zero warnings; consider narrower ESLint overrides file-by-file if needed.

## Enhancements (nice to have)

- [ ] Davison chart endpoint (time/space-midpoint variant; midpoint composite shipped 2026-07-24).
- [ ] Aspect-pattern detection (grand trine, T-square, yod, stellium) — needed as a transit-context factor; not yet modeled anywhere.
- [ ] Chart-ruler derivation (ruler of the ASC sign; needs an agreed rulership table — traditional vs modern) — needed as a transit-context factor.
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

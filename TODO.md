# TODO

## Critical (blocks production)

- [ ] Vercel: confirm calculator endpoints return JSON on production. Repo pushed to github.com/miceli583/astro-calculator and connected to Vercel. Endpoints currently return HTML. Check function logs in Vercel dashboard — if "Ephemeris data directory not found" appears, the new error message lists every path tried. If sweph fails to load, may need a Vercel-specific build hook to rebuild the native module.

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] Migrate from `next lint` (deprecated in Next 16) to direct `eslint .` command
- [ ] Add CI workflow (`.github/workflows/`) running typecheck + test + lint on PR
- [ ] Add CHANGELOG.md before public launch
- [ ] Extract shared constants (`0.9856` solar mean motion, `88°` design arc) used in 3+ calculators

## Enhancements (nice to have)

- [ ] HD PHS sub-labels — MyBodyGraph shows Digestion labels like "Buzzing (Nervous Touch)" and directional labels like "Direct"/"InDirect" for the arrows. These map to color+tone+base sub-classifications; would need lookup tables per variable.
- [ ] Verify J (Juxtaposition) cross names against MyBodyGraph — RA and LA names are structurally cross-verified via quaternary invariants; J entries are per-source only (some sources had errors we caught for gates 59-64, others may exist).
- [ ] Sabian Symbols — 360-degree symbolic image per zodiac degree (Marc Edmund Jones / Elsie Wheeler). Map every planet position to its Sabian symbol; needs the canonical 360-entry table.
- [ ] Cards of Destiny Planetary Ruling Card + Karma Cards (needs verified lookup tables)
- [ ] Topocentric flag — design concurrency for sweph's global `set_topo` state. Mainly affects Moon (~1°)
- [ ] Sidereal zodiac with selectable ayanamsa (Lahiri / Krishnamurti / Fagan-Bradley)
- [ ] Synastry / composite chart endpoints
- [ ] Solar return chart endpoint — DONE 2026-06-09
- [ ] Progressed chart endpoint — DONE 2026-06-09
- [ ] Returns for Venus, Mercury, Jupiter, Saturn
- [ ] Caching layer (in-memory LRU + Vercel Runtime Cache)
- [ ] Rate limiting via Vercel Firewall WAF rules
- [ ] SDK packages (`@astro-calculator/client-ts`, Python)
- [ ] Add a 4th reference birth chart fixture (current: Diana, Einstein, Jobs)
- [ ] Render astrocartography lines on an interactive world map in `/chart`

# Status

**Last updated:** 2026-07-02
**Last updated by:** Matthew Miceli

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- **15 REST endpoints live** at `/api/v1/*` with Zod validation, including transit, synastry, and sky-weather suites
- Calculators (all verified end-to-end against external references):
  - **Astrology** — natal positions, house cusps (7 systems), aspects, **Part of Fortune**, **South Node** (verified ±2' vs Astrodienst)
  - **Astrocartography** — MC/IC/AC/DC lines per planet, **parans (line-crossing points)** (verified via independent spherical-astronomy math)
  - **Human Design** — type, profile, gates, channels, defined centers, authority, incarnation cross with correct angle classification, **Variables (4 arrows)** (gate-wheel anchored to Rave Mandala)
  - **Gene Keys (Hologenetic Profile)** — all 11 official spheres across Activation/Venus/Pearl sequences (verified against genekeys.com)
  - **Life Path** — Pythagorean numerology
  - **Destiny Card** — Robert Lee Camp Solar Spread (verified against published chart)
  - **Solar Return** — cast for any year, optionally relocated
  - **Secondary Progressions** — "day for a year" for inner planets
  - **Transits** — sky snapshot, transit-to-natal overlay, and multi-year event scanner with retrograde-loop detection
  - **Synastry** — chart-to-chart compatibility built on the shared `computeOverlay` core
  - **Sky weather** — birth-chart-independent feed of retrograde stations, moon phases, sign ingresses, and eclipses (up to 20-year horizon)
- **`/chart` UI page** — interactive form that fires all calculators and renders a full chart
- Swagger UI at `/docs`, OpenAPI 3.1 spec at `/api/openapi.json`
- **382/382 unit tests passing** including:
  - 25 planet-position accuracy tests vs Astrodienst (Diana + Jobs)
  - 11 Sun-position cross-checks via independent Meeus VSOP (1879–2024)
  - 45 house-cusp tests across 7 systems
  - 51 astrocartography tests (line accuracy + paran intersection verification)
  - 38 HD structural tests + gate-wheel anchor + variables + cross-angle mapping
  - 12 Gene Keys Hologenetic Profile structure tests
  - 18 Destiny Card anchors covering every month + verified Apr 8 = K♦
  - 4 progressions + solar-return tests
- High-latitude warning for ≥66.5° lat with quadrant house systems

## In progress

- (none)

## Next

- Vercel deploy + ephemeris bundle verification (blocker before public launch)
- Cards of Destiny Planetary Ruling Card + Karma Cards (needs reference table)
- Topocentric flag (Moon precision; concurrency design needed for sweph's global `set_topo`)
- Sidereal zodiac with selectable ayanamsa
- Synastry / composite chart endpoints

## Recent changes

| Date       | Author          | Change                                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-02 | Matthew Miceli  | Transits & synastry suite: shared computeOverlay core, /api/v1/transit + /transit/natal + /transit/events (retrograde loops) + /synastry + /transit/theme scaffolding, 4,536-entry combinations manifest, spec doc |
| 2026-07-02 | Matthew Miceli  | HD Variables fix (Environment/Perspective/Motivation sourcing), added Cognition/Signature/Not-Self, full 192-entry Incarnation Cross name lookup |
| 2026-06-09 | Matthew Miceli  | Push to GitHub (miceli583/astro-calculator); city autocomplete with Nominatim + tz-lookup; geocoder endpoint; Einstein default sample; Vercel deploy fixes in progress |
| 2026-06-09 | Matthew Miceli  | Add parans, Solar Return, Progressions, Part of Fortune, South Node, Black Moon Lilith, HD Variables; fix IC angle + Gene Keys + Destiny Cards; new /chart UI page; quality audit sweep |
| 2026-05-22 | Matthew Miceli  | Astrocartography AC/DC swap fix; Jobs fixture; high-latitude warnings; full JSDoc; 200→289 tests                                                  |
| 2026-05-22 | Matthew Miceli  | Comprehensive accuracy test suite (13→200 tests); HD gate offset fixed                                                                            |
| 2026-05-15 | Matthew Miceli  | Initial scaffold; all endpoints live                                                                                                              |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators

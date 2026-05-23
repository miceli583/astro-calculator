# Status

**Last updated:** 2026-05-22
**Last updated by:** Matthew Miceli

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- Calculators (verified):
  - Astrology — natal positions, house cusps, aspects (✓ verified against Astrodienst to ±2' on 2 reference charts: Princess Diana + Steve Jobs)
  - Astrocartography — MC/IC/AC/DC lines per planet (✓ verified via independent spherical-astronomy math; AC/DC swap bug fixed)
  - Human Design — type, profile, gates, channels, defined centers, authority, incarnation cross (✓ gate-wheel offset anchored to Rave Mandala: Gate 41 at 2° Aquarius)
  - Gene Keys — Activation, Venus, and Pearl Sequences (✓ shares verified HD wheel)
  - Life Path — Pythagorean numerology (✓)
  - Destiny Card — Birth Card lookup (✓)
- High-latitude warning: charts at ≥66.5° lat with Placidus/Koch/Regiomontanus/Campanus include a `warnings[]` entry noting cusp degeneracy
- REST API at `/api/v1/*` with Zod validation, 7 endpoints live
- OpenAPI 3.1 spec served at `/api/openapi.json`
- Swagger UI at `/docs`
- **289/289 unit tests passing** including:
  - 25 planet-position accuracy tests vs Astrodienst (Diana + Jobs, ±2')
  - 11 Sun-position cross-checks via independent Meeus VSOP formula (1879–2024)
  - 45 house-cusp tests across 7 house systems
  - 40 chart-invariant tests (ASC↔DSC 180°, every planet in exactly one house, etc.)
  - 45 astrocartography tests (MC/IC via hour-angle math, AC/DC via altitude+azimuth)
  - 37 HD structural + invariance tests + gate-wheel anchor (Gate 41 at 2° Aquarius)
  - 16 Gene Keys structural tests
- JSDoc on every public calculator entry point
- End-to-end dev server verified against real birth chart

## In progress

- (none)

## Next

- Test Vercel deployment to confirm ephemeris file bundling works
- Topocentric flag (design: how to handle sweph's global `set_topo` state under concurrent requests)
- Sidereal zodiac with selectable ayanamsa (design: default ayanamsa, schema additions)

## Recent changes

| Date       | Author          | Change                                                                                                          |
| ---------- | --------------- | --------------------------------------------------------------------------------------------------------------- |
| 2026-05-22 | Matthew Miceli  | Astrocartography AC/DC swap fix; Jobs fixture added; high-latitude warnings; full JSDoc; 200→289 tests          |
| 2026-05-22 | Matthew Miceli  | Comprehensive accuracy test suite (13→200 tests); HD gate offset fixed                                          |
| 2026-05-16 | Matthew Miceli  | Session handoff — testing prep                                                                                  |
| 2026-05-15 | Matthew Miceli  | Initial scaffold (a1fabfb), all endpoints live                                                                  |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF rules)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Astrocartography parans not implemented
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric flag deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators

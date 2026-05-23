# Status

**Last updated:** 2026-05-22
**Last updated by:** Matthew Miceli

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- Calculators (verified):
  - Astrology — natal positions, house cusps, aspects (✓ verified against Astrodienst to ±2')
  - Astrocartography — MC/IC/AC/DC lines per planet (verified, structural only)
  - Human Design — type, profile, gates, channels, defined centers, authority, incarnation cross (✓ gate wheel offset verified against canonical Rave Mandala)
  - Gene Keys — Activation, Venus, and Pearl Sequences (✓ shares verified HD wheel)
  - Life Path — Pythagorean numerology (✓)
  - Destiny Card — Birth Card lookup (✓)
- REST API at `/api/v1/*` with Zod validation, 7 endpoints live
- OpenAPI 3.1 spec served at `/api/openapi.json`
- Swagger UI at `/docs`
- **200/200 unit tests passing**, including:
  - 14 planet-position accuracy tests vs Astrodienst (Princess Diana reference chart, ±2')
  - 11 Sun-position cross-checks via independent Meeus VSOP formula (1879–2024)
  - 31 house-cusp tests across 7 house systems
  - 29 chart-invariant tests (ASC↔DSC 180°, every planet in exactly one house, etc.)
  - 36 HD structural tests + gate-wheel anchor verification (Gate 41 at 2° Aquarius)
  - 16 Gene Keys structural tests
- End-to-end dev server verified against real birth chart

## In progress

- (none)

## Next

- Verify Astrocartography line equations against Astrodienst's published lines for a known chart
- Add reference test fixture for a 3rd birth chart (current: Diana + Einstein)
- Test Vercel deployment to confirm ephemeris file bundling works
- Sidereal zodiac support (currently tropical only)

## Recent changes

| Date       | Author          | Change                                                                  |
| ---------- | --------------- | ----------------------------------------------------------------------- |
| 2026-05-22 | Matthew Miceli  | Comprehensive accuracy test suite (13→200 tests); HD gate offset fixed  |
| 2026-05-16 | Matthew Miceli  | Session handoff — testing prep                                          |
| 2026-05-15 | Matthew Miceli  | Initial scaffold (a1fabfb), all endpoints live                          |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF rules)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Astrocartography parans not implemented
- Sidereal zodiac not yet supported (tropical only)
- HD/GK output for very high northern/southern latitudes inherits Placidus
  cusp distortion above ~66°N/S; the API should warn or fall back to
  Whole-Sign for those locations

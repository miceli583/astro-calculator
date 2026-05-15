# Status

_Last updated: 2026-05-15_

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- Calculators (initial implementation):
  - Astrology — natal positions, house cusps, aspects
  - Astrocartography — MC/IC/AC/DC lines per planet
  - Human Design — type, profile, gates, channels, defined centers, authority, incarnation cross
  - Gene Keys — Activation, Venus, and Pearl Sequences
  - Life Path — Pythagorean numerology
  - Destiny Card — Birth Card lookup
- REST API at `/api/v1/*` with Zod validation
- OpenAPI 3.1 spec served at `/api/openapi.json`
- Swagger UI at `/docs`

## In progress

- Reference fixtures for accuracy tests (need 3–5 known charts)
- Astrocartography: parans not yet implemented
- Human Design: cross-check against hdkit reference data

## Next

- Add rate limiting (Vercel Firewall or in-app token bucket)
- Add caching layer for repeated queries (lat/lon rounding + birth data hash)
- Solar return / progressed chart endpoints
- Composite / synastry endpoints

# Status

**Last updated:** 2026-05-16
**Last updated by:** Matthew Miceli

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- Calculators (initial implementation):
  - Astrology — natal positions, house cusps, aspects (verified ✓)
  - Astrocartography — MC/IC/AC/DC lines per planet (verified ✓)
  - Human Design — type, profile, gates, channels, defined centers, authority, incarnation cross (verified, accuracy unverified)
  - Gene Keys — Activation, Venus, and Pearl Sequences (verified, accuracy unverified)
  - Life Path — Pythagorean numerology (verified ✓)
  - Destiny Card — Birth Card lookup (verified ✓)
- REST API at `/api/v1/*` with Zod validation, 7 endpoints live
- OpenAPI 3.1 spec served at `/api/openapi.json`
- Swagger UI at `/docs`
- 13/13 unit tests passing
- End-to-end dev server verified against real birth chart

## In progress

- Reference fixtures for accuracy tests (HD/GK gate output to verify against authoritative charts)

## Next

- @Matt: Validate calculator output against known reference charts (next session)
- Confirm HD `GATE_WHEEL_OFFSET` is correct (currently 3.875°)
- Test Vercel deployment to confirm ephemeris file bundling works

## Recent changes

| Date       | Author          | Change                                         |
| ---------- | --------------- | ---------------------------------------------- |
| 2026-05-16 | Matthew Miceli  | Session handoff — testing prep                 |
| 2026-05-15 | Matthew Miceli  | Initial scaffold (a1fabfb), all endpoints live |

## Known limitations

- HD gate wheel offset and GK sequence mappings need verification against authoritative sources
- No rate limiting yet (planned: Vercel Firewall WAF rules)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Astrocartography parans not implemented
- Sidereal zodiac not yet supported (tropical only)

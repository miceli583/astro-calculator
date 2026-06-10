# CLAUDE.md — Astro Calculator

## What this project is

A public, AGPL-licensed HTTP API that calculates astrology, astrocartography,
Human Design, Gene Keys, Life Path numerology, and Destiny Cards from birth
data. Designed to be consumed by other applications (private or public) over
the network, so those applications don't have to link to AGPL code themselves.

## Why AGPL

The Swiss Ephemeris library (`sweph`) is AGPL-3.0. Any software that *links*
to it and is exposed as a network service must also be AGPL. By isolating the
ephemeris dependency here and making this API public, downstream apps can
remain closed-source — they consume the API, they don't link the library.

**Never** copy ephemeris-using code from this repo into a closed-source app
without first replacing `sweph` with your own implementation or buying a
commercial Swiss Ephemeris license.

## Architecture

- Next.js 16 App Router on Node.js runtime (NOT Edge — `sweph` is a native module)
- REST API at `/api/v1/*`, no GraphQL, no tRPC (consumers may not be TS)
- Stateless: no DB, no auth (public calculator)
- Validation: Zod
- Docs: OpenAPI 3.1 spec at `/api/openapi.json` + Swagger UI at `/docs`
- Interactive chart UI at `/chart` (client-side React, hits the API)

### Module layout

```
src/
├── app/
│   ├── api/v1/...           # Route handlers, thin wrappers around lib/calculators (9 endpoints)
│   ├── chart/page.tsx       # Interactive client UI: birth form → all calculators → rendered chart
│   ├── docs/                # Swagger UI mount
│   └── page.tsx             # API docs landing page
├── lib/
│   ├── ephemeris/           # sweph wrapper, julian day helpers
│   ├── calculators/         # One file per system (astrology, hd, gk, life-path, destiny-card, astrocartography)
│   ├── constants/           # Gate mappings, card mappings, planet IDs
│   ├── validation/          # Zod schemas (input + output)
│   └── openapi/             # Spec generation
ephemeris/                   # Downloaded SE data files (gitignored)
scripts/                     # Postinstall ephemeris downloader
tests/                       # Vitest with reference birth charts
```

## Key commands

```bash
npm run dev              # Dev server
npm run typecheck        # tsc --noEmit
npm run test             # Vitest
npm run ephe:download    # Re-download Swiss Ephemeris files
EPHE_RANGE=full npm run ephe:download   # Extended historical range
```

## Conventions

- Inputs: ISO 8601 datetime + IANA timezone + lat/lon. Always those fields.
- Outputs: zodiac longitudes in degrees (0–360), house cusps in same.
- Errors: `{ error: { code, message, details? } }` with appropriate HTTP status.
- Calculators are pure functions of birth data; no I/O outside the ephemeris client.

## Known design decisions

- **REST not tRPC** — consumers may be Python, Swift, or Go services.
- **No DB** — calculations are deterministic; cache at the consumer if needed.
- **Default house system = Placidus** — most common. All major systems supported.
- **Topocentric vs geocentric** — geocentric by default; topocentric flag available.
- **Tropical vs sidereal** — tropical by default; sidereal flag with ayanamsa option.

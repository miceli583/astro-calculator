# Astro Calculator

Open-source HTTP API for calculating astrological and esoteric birth-data systems:

| Endpoint                                | What it returns                                                                                                                  |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/v1/astrology/natal`          | Natal chart: planet positions (incl. Lilith, South Node), house cusps, aspects, Part of Fortune                                  |
| `POST /api/v1/astrology/transits`       | Current planet positions and aspects to a natal chart                                                                            |
| `POST /api/v1/astrology/progressions`   | Secondary-progressed inner-planet positions for any age ("day for a year")                                                       |
| `POST /api/v1/astrology/solar-return`   | Solar Return chart for a given year, optionally relocated                                                                        |
| `POST /api/v1/astrocartography`         | MC/IC/AC/DC lines per planet + parans (line-crossing points)                                                                     |
| `POST /api/v1/human-design/chart`       | Type, profile, authority, defined centers, channels, gates, incarnation cross, Variables (4 arrows)                              |
| `POST /api/v1/gene-keys/profile`        | Hologenetic Profile: 11 spheres across Activation, Venus, and Pearl sequences                                                    |
| `POST /api/v1/life-path`                | Life Path number, Birthday number, with reduction trace                                                                          |
| `POST /api/v1/destiny-card`             | Birth Card per Robert Lee Camp's Solar Spread                                                                                    |

Interactive chart UI: `GET /chart` — fills in a form, hits all calculators in parallel, renders the full chart.

API documentation: `GET /docs` (Swagger UI). OpenAPI spec: `GET /api/openapi.json`.

## Why this exists

This project is a public, AGPL-licensed calculator engine designed to be called
by other applications. It encapsulates the Swiss Ephemeris dependency (which is
AGPL-licensed) so that consuming applications can remain closed-source by
calling this service over the network rather than linking to the library
directly.

## Quick start

```bash
npm install              # also downloads ~5 MB of ephemeris data files
npm run dev              # http://localhost:3000
```

Try a natal chart:

```bash
curl -X POST http://localhost:3000/api/v1/astrology/natal \
  -H "Content-Type: application/json" \
  -d '{
    "datetime": "1980-07-15T14:30:00",
    "timezone": "America/New_York",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "house_system": "placidus"
  }'
```

## Tech

- Next.js 16 (App Router) on Node.js runtime
- TypeScript strict mode
- Swiss Ephemeris via [`sweph`](https://github.com/timotejroiko/sweph) (AGPL-3.0)
- Zod for input validation, OpenAPI 3.1 spec for the docs

## Accuracy

Position data is derived from the JPL DE441 ephemeris via Swiss Ephemeris,
the reference implementation used by professional astrology software. Default
range: 1800–2399 CE. Set `EPHE_RANGE=full` before `npm install` to extend to
−1300 to 3000 CE.

## License

[AGPL-3.0-or-later](./LICENSE). See [`docs/LICENSING.md`](./docs/LICENSING.md)
for what this means if you want to use this code in a closed-source product.

## Status & roadmap

- [`STATUS.md`](./STATUS.md) — what works today
- [`TODO.md`](./TODO.md) — known gaps
- [`ROADMAP.md`](./ROADMAP.md) — phased build plan
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — how the calculators work

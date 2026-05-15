# Architecture

## Request flow

```
HTTP request
  → Next.js route handler (src/app/api/v1/<system>/route.ts)
    → Zod input validation (src/lib/validation/schemas.ts)
    → Calculator (src/lib/calculators/<system>.ts)
      → Ephemeris client (src/lib/ephemeris/client.ts) [if needed]
        → sweph (native Swiss Ephemeris bindings)
    → JSON response
```

Route handlers stay thin: parse, validate, call calculator, format response.
All real logic lives in `src/lib/calculators/`. Calculators are pure functions
of birth data — no I/O beyond the ephemeris client.

## The ephemeris client

`src/lib/ephemeris/client.ts` wraps `sweph` and:

1. Initializes the SE data path once per process (lazy, cached)
2. Converts ISO datetime + IANA timezone → Julian Day (UT)
3. Provides typed wrappers for `swe_calc_ut`, `swe_houses_ex`, `swe_calc` etc.
4. Returns ecliptic longitude/latitude/distance/speed for any body

`sweph` is a CommonJS native module. We mark it as a server-external package
in `next.config.ts` so Next.js doesn't try to bundle it.

## How each system uses the ephemeris

| System            | Ephemeris-dependent | What it needs                                                                |
| ----------------- | ------------------- | ---------------------------------------------------------------------------- |
| Astrology         | Yes                 | Planet positions + house cusps from `swe_calc_ut` and `swe_houses_ex`        |
| Astrocartography  | Yes                 | Right ascension and declination of planets at birth moment                   |
| Human Design      | Yes                 | Two charts: birth (Personality) and ~88 days prior (Design = 88° solar arc) |
| Gene Keys         | Yes                 | Same astro data as Human Design, mapped to four prime gifts + sequences      |
| Life Path         | No                  | Date math only                                                               |
| Destiny Card      | No                  | Birth date lookup against a fixed 365-card mapping                           |

## Human Design specifics

- "Personality" chart = planet positions at birth (UT)
- "Design" chart = planet positions when the Sun was 88° behind its birth position
  (~88 days before birth). Computed via `swe_solcross_ut` to find the exact moment.
- 64 gates correspond to 64 zodiac arcs of 5°37'30" each, starting at 2°Aries.
  Gate sequence is fixed (the "Mandala wheel"), defined in `src/lib/constants/hd-gates.ts`.
- Lines: each gate divided into 6 lines of 56'15" each.
- Type/authority/profile derived from gate activations, not directly from positions.

## Gene Keys specifics

- Same 64-gate mapping as Human Design (the systems share the I-Ching encoding).
- Activation Sequence: 4 spheres = Sun (Life's Work), Earth opposition, etc.
- Venus and Pearl sequences add additional planetary mappings.

## Astrocartography specifics

For each planet, the four lines are computed from RA/Dec:

- **MC line** (longitude where the planet is on the meridian at birth moment)
- **IC line** (180° from MC)
- **AC / DC lines** (where the planet rises/sets — sinusoidal curves on the map)

We sample latitudes at 0.5° steps and compute the longitude offset for each.

## Module boundaries

```
calculators/  ── pure logic, depends on ephemeris/ + constants/
ephemeris/    ── sweph wrapper, no domain logic
constants/    ── static data (gates, cards, planet IDs)
validation/   ── Zod schemas, no logic
openapi/      ── OpenAPI 3.1 spec generated from Zod
```

If you find yourself adding I/O to a calculator, you're doing it wrong.

## Deploy notes

- `sweph` requires native compilation but ships prebuilds for common platforms.
  Vercel's Node.js runtime supports native modules; Edge runtime does not.
- Ephemeris files (`*.se1`) are downloaded by `scripts/download-ephemeris.mjs`
  during `npm install`. Default ~5 MB; `EPHE_RANGE=full` ~50 MB.
- `outputFileTracingIncludes` in `next.config.ts` ensures the `ephemeris/`
  directory is bundled with serverless function deployments.

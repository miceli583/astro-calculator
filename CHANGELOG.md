# Changelog

All notable changes to this project will be documented in this file. Format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `POST /api/v1/astrology/planetary-return` — first return of Sun / Mercury /
  Venus / Mars / Jupiter / Saturn on or after any `after_datetime`, optionally
  relocated. Backed by `calculatePlanetaryReturn` with an orbital-period-aware
  minimum interval that filters out post-birth retrograde-loop crossings.
- Planet / aspect / retrograde-loop-only filter chips on the `/chart` Transits
  tab; planet filter chips on the `/sky` weather feed.
- Nelson Mandela added as the first Southern-Hemisphere reference fixture
  (`MANDELA` in `tests/fixtures/charts.ts`) with 11 planet positions + 14
  Placidus-cusp assertions, catching sign-of-latitude regressions.
- Shared `BirthFormFields` component now backs both `/chart` and the Synastry
  sub-tab, eliminating a duplicated geocode autocomplete implementation.
- Shared solar-arc constants (`SOLAR_MEAN_MOTION_DEG_PER_DAY`,
  `HD_DESIGN_ARC_DEG`, `HD_DESIGN_ARC_APPROX_DAYS`) in
  `src/lib/constants/design-arc.ts`, consumed by both Human Design and Gene
  Keys design-chart solvers.
- CI workflow running typecheck + lint + tests on PRs to `main`.
- CHANGELOG.md (this file).

### Changed

- Migrated ESLint from deprecated `next lint` to `eslint .` with the flat
  config exports from `eslint-config-next` 16.
- `<a href="/">` in `/chart` header replaced with Next `<Link>` for
  client-side navigation.
- OpenAPI spec now documents the planetary-return endpoint + schema.

### Fixed

- React 19 hook-rule violations (`set-state-in-effect`, `immutability`) in
  the shared birth form's geocode autocomplete.
- Combobox input now carries `role="combobox"` so `aria-expanded` validates.

## [0.1.0] — 2026-06-09

### Added

- Initial scaffold: Next.js 16 App Router on the Node runtime, AGPL-3.0
  license, Swiss Ephemeris wrapper with auto-download of data files.
- 15 REST endpoints under `/api/v1/*` with Zod validation and an OpenAPI 3.1
  spec at `/api/openapi.json` + Swagger UI at `/docs`.
- Calculators (all verified against external references):
  - **Astrology** — natal positions, house cusps (7 systems), aspects, Part
    of Fortune, South Node.
  - **Astrocartography** — MC/IC/AC/DC lines per planet, parans
    (line-crossing points).
  - **Human Design** — type, profile, gates, channels, defined centers,
    authority, incarnation cross with correct angle classification, all four
    Variables arrows, gate-wheel anchored to the Rave Mandala.
  - **Gene Keys (Hologenetic Profile)** — all 11 official spheres across
    Activation, Venus, and Pearl sequences.
  - **Life Path** — Pythagorean numerology.
  - **Destiny Card** — Robert Lee Camp Solar Spread.
  - **Solar Return** — cast for any year, optionally relocated.
  - **Secondary Progressions** — "day for a year" for inner planets.
  - **Transits** — sky snapshot, transit-to-natal overlay, and multi-year
    event scanner with retrograde-loop detection.
  - **Synastry** — chart-to-chart compatibility built on the shared
    `computeOverlay` core.
  - **Sky weather** — birth-chart-independent feed of retrograde stations,
    moon phases, sign ingresses, and eclipses (up to 20-year horizon).
- Interactive `/chart` UI with Chart / Transits / Synastry sub-tabs and a
  `/sky` weather feed.
- 382-test Vitest suite including 25 planet-position accuracy tests vs
  Astrodienst, 11 Sun-position cross-checks via independent Meeus VSOP, 51
  astrocartography tests, and a 45-test house-cusp matrix across all 7
  supported systems.
- City autocomplete via Nominatim + tz-lookup and a `/api/v1/geocode`
  endpoint.
- High-latitude warning for ≥66.5° when using quadrant house systems.

[Unreleased]: https://github.com/miceli583/astro-calculator/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/miceli583/astro-calculator/releases/tag/v0.1.0

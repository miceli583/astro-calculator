# Status

**Last updated:** 2026-07-06
**Last updated by:** Matthew Miceli

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- **15 REST endpoints live** at `/api/v1/*` with Zod validation, including transit, synastry, sky-weather, and planetary-return suites
- Calculators (all verified end-to-end against external references):
  - **Astrology** — natal positions, house cusps (7 systems), aspects, **Part of Fortune**, **South Node** (verified ±2' vs Astrodienst)
  - **Astrocartography** — MC/IC/AC/DC lines per planet, **parans (line-crossing points)** (verified via independent spherical-astronomy math)
  - **Human Design** — type, profile, gates, channels, defined centers, authority, incarnation cross with correct angle classification, **Variables (4 arrows)** (gate-wheel anchored to Rave Mandala)
  - **Gene Keys (Hologenetic Profile)** — all 11 official spheres across Activation/Venus/Pearl sequences (verified against genekeys.com)
  - **Life Path** — Pythagorean numerology
  - **Destiny Card** — Robert Lee Camp Solar Spread (verified against published chart)
  - **Solar Return** — cast for any year, optionally relocated
  - **Planetary Returns** — Sun/Mercury/Venus/Mars/Jupiter/Saturn, first return on-or-after any datetime, optionally relocated
  - **Secondary Progressions** — "day for a year" for inner planets
  - **Transits** — sky snapshot, transit-to-natal overlay, and multi-year event scanner with retrograde-loop detection
  - **Synastry** — chart-to-chart compatibility built on the shared `computeOverlay` core
  - **Sky weather** — birth-chart-independent feed of retrograde stations, moon phases, sign ingresses, and eclipses (up to 20-year horizon)
- **`/chart` UI page** — interactive form that fires all calculators and renders a full chart
- Swagger UI at `/docs`, OpenAPI 3.1 spec at `/api/openapi.json`
- **415/415 unit tests passing** including:
  - 25 planet-position accuracy tests vs Astrodienst (Diana + Jobs) + 11 for Mandela (southern-hemisphere fixture)
  - 11 Sun-position cross-checks via independent Meeus VSOP (1879–2024)
  - 45 house-cusp tests across 7 systems + 14 Southern-Hemisphere Placidus cusp tests (Mandela)
  - 51 astrocartography tests (line accuracy + paran intersection verification)
  - 38 HD structural tests + gate-wheel anchor + variables + cross-angle mapping
  - 12 Gene Keys Hologenetic Profile structure tests
  - 18 Destiny Card anchors covering every month + verified Apr 8 = K♦
  - 12 progressions + solar/planetary-return tests
- High-latitude warning for ≥66.5° lat with quadrant house systems

## In progress

- (none)

## Next

- Vercel deploy + ephemeris bundle verification (blocker before public launch)
- Composite / Davison midpoint chart endpoint (deferred)
- Cards of Destiny Planetary Ruling Card + Karma Cards (needs reference table)
- Topocentric flag (Moon precision; concurrency design needed for sweph's global `set_topo`)
- Sidereal zodiac with selectable ayanamsa

## Recent changes

| Date       | Author          | Change                                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-06 | Matthew Miceli  | Public-repo hygiene pass: moved internal product-strategy docs to SoulMapCalculator; stripped transits-spec.md §7/§8/§10/§11 (cost tables, client-decision log, engineering rollout); removed vestigial `/transit/theme` route + `transit-themes.json` placeholder + calculator + test (endpoint count 16→15); typecheck clean, 412/412 tests pass |
| 2026-07-03 | Matthew Miceli  | Tech-debt + polish sweep: ESLint flat config (drop deprecated `next lint`), extracted HD/GK design-arc constants, CHANGELOG + CI workflow, consolidated primary `/chart` form onto shared `BirthFormFields`, planet/aspect filter chips on Transits + Sky, `calculatePlanetaryReturn` (Sun/Mercury/Venus/Mars/Jupiter/Saturn) with new `/api/v1/astrology/planetary-return` endpoint, Nelson Mandela added as first Southern-Hemisphere reference fixture (33 new tests) |
| 2026-07-03 | Matthew Miceli  | UI: site nav (Chart/Sky/API), Chart tab bar (Chart/Transits/Synastry), /sky feed page, Synastry sub-tab with Person B form + results; extracted shared BirthFormFields + `.birth-input` CSS class |
| 2026-07-03 | Matthew Miceli  | Sky-weather calculator + `/api/v1/sky/events` — retrograde stations, moon phases, sign ingresses, eclipse detection (18.5°/12.25° node limits) |
| 2026-07-03 | Matthew Miceli  | Transits/synastry suite: shared `computeOverlay` core, `/transit`, `/transit/natal`, `/transit/events` (retrograde loops), `/synastry`, 4,536-entry combinations manifest, spec doc |
| 2026-07-03 | Matthew Miceli  | HD Variables fix (Environment/Perspective/Motivation sourcing), added Cognition/Signature/Not-Self, full 192-entry Incarnation Cross name lookup with structural invariant tests |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators

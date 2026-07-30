# Status

**Last updated:** 2026-07-30
**Last updated by:** Claude PM (v0.3.0 post-release contract audit)

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0
- Swiss Ephemeris wrapper with auto-download of data files
- **16 REST endpoints live** at `/api/v1/*` with Zod validation, including transit, synastry, composite, sky-weather, and planetary-return suites
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
  - **Composite** — midpoint chart from 2–10 births (circular-mean planets, houses derived from composite MC, PoF, internal aspects)
  - **Full transit combination matrix** — 13 transit × 19 natal points × 6 aspects with sign/house context on both sides; every aspect hit carries a stable `comboKey`; 17,784-key manifest (v2) + canonical `transit-matrix.ts` module
  - **Sky weather** — birth-chart-independent feed of retrograde stations, moon phases, sign ingresses, and eclipses (up to 20-year horizon)
  - **Aspect patterns** — stellium (sign/house), grand trine, T-square, grand cross, yod, kite, mystic rectangle on every natal-style chart and the sky snapshot (element/modality + apex annotated; anchored to Diana/Einstein/Jobs/Mandela geometry and the 5 Feb 1962 seven-planet Aquarius stellium)
  - **Chart ruler** — ruler of the ASC sign with placement + aspects; modern rulerships default, traditional per-request; both rulers always reported
- **`/chart` UI page** — interactive form that fires all calculators and renders a full chart
- Swagger UI at `/docs`, OpenAPI 3.1 spec at `/api/openapi.json`
- **491/491 unit tests passing** including:
  - 25 planet-position accuracy tests vs Astrodienst (Diana + Jobs) + 11 for Mandela (southern-hemisphere fixture)
  - 11 Sun-position cross-checks via independent Meeus VSOP (1879–2024)
  - 45 house-cusp tests across 7 systems + 14 Southern-Hemisphere Placidus cusp tests (Mandela)
  - 51 astrocartography tests (line accuracy + paran intersection verification)
  - 38 HD structural tests + gate-wheel anchor + variables + cross-angle mapping
  - 12 Gene Keys Hologenetic Profile structure tests
  - 18 Destiny Card anchors covering every month + verified Apr 8 = K♦
  - 12 progressions + solar/planetary-return tests
  - 21 composite tests (circular-midpoint math incl. wraparound/degenerate/rotation-invariance, pair-midpoint equivalence, N-identical-chart identity, 10-chart group, wheel coherence) + 16 transit-matrix tests (full matrix sizes asserted at every level, six-aspect limit, manifest↔module consistency)
- High-latitude warning for ≥66.5° lat with quadrant house systems

## In progress

- (none)

## Next

- ~~Vercel deploy + ephemeris bundle verification~~ — verified 2026-07-08, all endpoints return JSON in production
- ~~Composite midpoint chart endpoint~~ — shipped 2026-07-24 (2–10 charts); Davison variant still deferred
- Cards of Destiny Planetary Ruling Card + Karma Cards (needs reference table)
- Topocentric flag (Moon precision; concurrency design needed for sweph's global `set_topo`)
- Sidereal zodiac with selectable ayanamsa

## Recent changes

| Date       | Author          | Change                                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-07-30 | Claude PM       | **v0.3.0 post-release contract audit** (audit-only, no code): verdict clean — all changes additive/backward-compatible; new response fields (`patterns`, `chartRuler` with nullable `placement`, `referenceLatitudeSource`) and optional inputs (`rulership`, `reference_latitude`) confirmed non-breaking; pattern orbs verified identical to natal aspect table; prod `/api/health` confirmed reporting 0.3.0; 491/491 tests, lint + typecheck clean; 2 low-priority OpenAPI doc gaps filed to TODO (synastry input $ref wrong, no response schemas) |
| 2026-07-29 | Claude PM       | **v0.3.0 released to production**: aspect-pattern detection (7 pattern types, natal-style charts + sky snapshot), chart ruler (modern default / traditional flag, placement + aspects), composite `reference_latitude` — the three approved arsenal additions; 42 new tests (491 total); PR #9 → dev, release PR #10 → main (merge commits), live prod verification incl. the 5 Feb 1962 seven-planet Aquarius stellium |
| 2026-07-29 | Claude PM       | **v0.2.0 released to production**: verified full transit-combo coverage (old 4,536-key manifest had excluded Sun/Moon/Mercury/Venus/Mars + South Node on the transit side — PR #7's 17,784-key manifest v2 is the corrected full arsenal, counts re-verified from generator + live endpoints), reviewed + merged PR #7 into dev, reconciled dev/main histories (July 18 release was squash-merged, forking main — resolved by merging main back into dev; use merge commits for release PRs from now on), released dev→main (PR #8, merge commit), Vercel production deploy verified with live smoke tests |
| 2026-07-24 | Claude PM       | Composite charts (`POST /api/v1/composite`, 2–10 births, circular-mean midpoints + MC-derived houses) and full transit combination matrix: canonical `transit-matrix.ts` (13×19×6 core, counts asserted in tests), context factors (`transitSign`/`transitHouse`/`transitRetrograde`/`comboKey`) on all overlay aspect hits, all 19 natal points exposed in transit/synastry/event-scanner, manifest v2 regenerated (17,784 keys, dimension-based format, 667KB vs 13.7MB naive), landing/OpenAPI/docs updated; 449 tests |
| 2026-07-08 | Claude          | Framework standard: dev branch + CI on dev, Sentry (client/server/edge + global-error), favicon set (icon.svg + apple-icon), OG image, sitemap/robots, twitter metadata; production JSON bug verified fixed (issue #1) |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators

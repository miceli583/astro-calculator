# Status

**Last updated:** 2026-08-13
**Last updated by:** Claude PM (accuracy harness — three oracle tiers, 11 findings, 5 fixed)

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
- **UI verified by a deterministic browser render check** — 7 rendered states (`/`, `/chart` empty
  + results + transits + synastry, `/sky`, `/docs`) × 390/768/1440 = 21 cells, zero text-overlap /
  overflow / clipping findings, zero console errors, in local dev and on production
- **Accuracy anchored to an independent oracle, in four layers** — each with a normative doc
  stating the convention and the reason for it, so a future change is a deliberate edit rather
  than a drift:
  - **L1 ephemeris** (`docs/accuracy.md`) — positions checked against **JPL Horizons**, which does
    not run Swiss Ephemeris, so this is the project's first genuinely *independent* check rather
    than a consistency one. 20 hostile fixtures (arctic/antarctic, antimeridian, DST gaps and
    ambiguities, 45-minute and 30-minute zones, pre-Gregorian clocks) harvested **offline** into
    `tests/fixtures/horizons/` — no CI job depends on a live third-party API. All eight
    well-determined bodies agree to **0.005″ RMS** over 1800–2005
  - **L2 time and houses** (`docs/time-conventions.md`, `docs/chart-conventions.md`) — house cusps
    checked against their *defining geometry* rather than against another implementation, and the
    local-time → UT → JD pipeline audited end to end
  - **L3 interpretive conventions** (`docs/aspect-conventions.md`) — orb tables, rulerships,
    aspect-window non-overlap, and the pattern set pinned as goldens. There is no external truth
    at this layer, so the doc is the contract and the tests enforce it
- **1314/1314 unit tests passing** across 31 files, including:
  - 25 planet-position accuracy tests vs Astrodienst (Diana + Jobs) + 11 for Mandela (southern-hemisphere fixture)
  - 11 Sun-position cross-checks via independent Meeus VSOP (1879–2024)
  - 45 house-cusp tests across 7 systems + 14 Southern-Hemisphere Placidus cusp tests (Mandela)
  - 51 astrocartography tests (line accuracy + paran intersection verification)
  - 38 HD structural tests + gate-wheel anchor + variables + cross-angle mapping
  - 12 Gene Keys Hologenetic Profile structure tests
  - 18 Destiny Card anchors covering every month + verified Apr 8 = K♦
  - 12 progressions + solar/planetary-return tests
  - 21 composite tests (circular-midpoint math incl. wraparound/degenerate/rotation-invariance, pair-midpoint equivalence, N-identical-chart identity, 10-chart group, wheel coherence) + 16 transit-matrix tests (full matrix sizes asserted at every level, six-aspect limit, manifest↔module consistency)
  - 459 L1 ephemeris tests vs JPL Horizons, 250 L2 house-definition tests, 64 L2 time-layer tests,
    42 L3 convention tests, 7 version single-source tests
- High-latitude warning for ≥66.5° lat with quadrant house systems

## In progress

- (none)

## Open findings

The accuracy harness produced 11 findings (F1–F11). Five are fixed; four are carded and ready
for a fresh seat; two need no action. Full write-ups live in the docs cited below — TODO.md
carries the short form.

| | Finding | State |
|---|---|---|
| F1 | Every birth date before 1800 returns a 500 — `calcPlanet` throws on sweph *warnings*, not just failures | **Carded `t_d0498a77`.** Dispositioned: do **not** ship `sepl_12.se1`; gate on `flag < 0`, serve Moshier, and report in the response which ephemeris answered. Repo weight is a real cost and a labelled fallback is not a downgrade in disguise |
| F2 | Chiron genuinely has no ephemeris before 1800 | **Carded `t_d0498a77`** (with F1). Not a decision — sweph refuses it; the fix is to say so rather than 500 |
| F3 | Horizons has no Neptune/Pluto at 1750/1799 | No action. Oracle-side gap, recorded in the affected fixtures' `notes`; the suite fails if a body vanishes without one |
| F4 | `SE_TRUE_NODE` is not the osculating node (≤0.36° in the 18th c.) | No action — **not a bug**. It is the Swiss Ephemeris convention other astrology software also reports; a documentation matter only |
| F5 | Polar charts return Porphyry cusps labelled as the requested system | **Carded `t_9a1538d0`.** Dispositioned: don't label Porphyry cusps `placidus`. Read `result.flag`, which the wrapper currently discards, and take the polar boundary from it rather than our 66.5° constant |
| F6 | A collapsed polar wheel puts every body in house 1 | **Carded `t_9a1538d0`** (with F5). Not a decision — the cusps are exact to 1e-10″; it is our ordering assumption in `houseFor` that is wrong |
| F7 | Sect read off the Sun's house number → PoF moved 135° on house system | **Fixed** — PR #18 |
| F8 | Part of Fortune fabricated when a luminary was absent | **Fixed** — PR #18 |
| F9 | `/api/v1/astrology/transits` used natal orbs; transit/natal used transit orbs (54 hits vs 18) | **Fixed** — PR #19 |
| F10 | `/api/v1/astrology/transits` hardcoded `applying: false` (0 of 54) | **Fixed** — PR #19 |
| F11 | Every chart carried a tautological node–node opposition at orb 0.00 | **Fixed** — PR #17 |

## Next

- ~~Vercel deploy + ephemeris bundle verification~~ — verified 2026-07-08, all endpoints return JSON in production
- ~~Composite midpoint chart endpoint~~ — shipped 2026-07-24 (2–10 charts); Davison variant still deferred
- Cards of Destiny Planetary Ruling Card + Karma Cards (needs reference table)
- Topocentric flag (Moon precision; concurrency design needed for sweph's global `set_topo`)
- Sidereal zodiac with selectable ayanamsa

## Recent changes

| Date       | Author          | Change                                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-13 | Claude PM       | **Escalation fixes F7–F11 (PRs #17, #18, #19 → dev; main untouched)**: sect now computed from the horizon (`(ASC − Sun) mod 360 < 180`) rather than the Sun's house number, so it no longer varies with `house_system` — before the fix, Placidus said day and whole-sign said night for the same Kolkata 1972 birth and the Part of Fortune moved **135°** (F7); `partOfFortune` is now **omitted entirely** (key absent, not `null`, not present-and-undefined) when the `planets` subset excludes a luminary, instead of silently returning the Ascendant's longitude (F8); both transit paths now read the same orb table — `/api/v1/astrology/transits` went **54 hits → 18**, matching `/api/v1/transit/natal` exactly, the root cause being an import cycle that put `DEFAULT_TRANSIT_ORBS` out of reach, so both tables moved to `src/lib/constants/orbs.ts` (F9); `applying` is now computed from relative motion and the representation is three-valued — `motion` is `applying`/`separating`/`stationary` and the boolean is **omitted** when stationary, with the tolerance (1e-4°/day) measured over 1304 aspecting pairs rather than chosen by feel (F10); the tautological `true_node`/`south_node` opposition at orb 0.00 is suppressed narrowly, with every other South Node aspect kept (F11). Every fix was proven **red-first** by swapping the changed sources for their `dev` versions with the new tests kept — exactly the intended failures, nothing else moving. Conventions promoted to `docs/aspect-conventions.md` §1.3/§1.5/§1.7/§4.2; OpenAPI response prose updated (the spec carries no response schemas, so prose is the only contract surface). Three factual corrections to the original filings recorded inline, since they were claims a public doc made about a public API. 1314/1314, no fixture rewritten |
| 2026-08-13 | Claude PM       | **Accuracy harness — three oracle tiers (PRs #15, #16 → dev)**: L1 anchors ephemeris positions to **JPL Horizons**, the project's first oracle that does not itself run Swiss Ephemeris; 20 hostile fixtures (arctic, antimeridian, DST gaps/ambiguities, 45- and 30-minute zones, pre-Gregorian clocks) harvested **offline** so no CI job depends on a live third-party API; all eight well-determined bodies agree to **0.005″ RMS** over 1800–2005, with the residual floor traced to a frame rotation rather than per-body error. L2 checks house cusps against their defining geometry and audits the local-time → UT → JD pipeline; L3 pins the interpretive conventions (orb tables, rulerships, aspect-window non-overlap, pattern set) as goldens. Four normative docs added: `accuracy.md`, `time-conventions.md`, `chart-conventions.md`, `aspect-conventions.md`. Produced findings **F1–F11**. Separately, `info.version` in the OpenAPI spec and `/api/health` were hard-coded and had drifted two releases behind `package.json`; both now import `API_VERSION` from `src/lib/version.ts`, with a test rejecting a semver literal reappearing on any surface. 491 → 1314 tests |
| 2026-08-12 | Claude PM       | **UI render-check pass (PR #12 → dev, PR #13 → main)**: fixed `/sky` event-row text overlap (123 rows, all viewports — reported by Matthew) and the same class of defect on `/chart` → Transits at 390px (48 rows), both caused by a `white-space: nowrap` grid track starving its `1fr` sibling; replaced both with explicit `.sky-event-row` / `.transit-event-row` grids that re-flow ≤600px. Fixed `/docs`: **every operation was rendering as an empty shell in production** (no parameters, request body, or responses on all 18 endpoints) — the bundler elided apidom's side-effect refractor registration, so `OpenApi3_1Element.refract` was undefined and swagger-client's `resolveSubtree` threw; fixed by awaiting `import("@swagger-api/apidom-ns-openapi-3-1")` inside the existing `dynamic()`. Also fixed 2 dead `var(--text)` references. Verified by a deterministic 21-cell render check, green in dev and prod; 491/491 tests, lint + typecheck clean |
| 2026-07-30 | Claude PM       | **v0.3.0 post-release contract audit** (audit-only, no code): verdict clean — all changes additive/backward-compatible; new response fields (`patterns`, `chartRuler` with nullable `placement`, `referenceLatitudeSource`) and optional inputs (`rulership`, `reference_latitude`) confirmed non-breaking; pattern orbs verified identical to natal aspect table; prod `/api/health` confirmed reporting 0.3.0; 491/491 tests, lint + typecheck clean; 2 low-priority OpenAPI doc gaps filed to TODO (synastry input $ref wrong, no response schemas) |
| 2026-07-29 | Claude PM       | **v0.3.0 released to production**: aspect-pattern detection (7 pattern types, natal-style charts + sky snapshot), chart ruler (modern default / traditional flag, placement + aspects), composite `reference_latitude` — the three approved arsenal additions; 42 new tests (491 total); PR #9 → dev, release PR #10 → main (merge commits), live prod verification incl. the 5 Feb 1962 seven-planet Aquarius stellium |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators
- **Pre-1800 births return a 500** (F1) and Chiron has no ephemeris there at all (F2) — carded `t_d0498a77`
- **Polar charts** can return Porphyry cusps under another system's name (F5) and can collapse the
  whole wheel into house 1 (F6) — carded `t_9a1538d0`
- `/api/v1/astrology/transits` accepts no `orbs` override where `/api/v1/transit/natal` and
  `/api/v1/synastry` do — parity gap found while fixing F9, deliberately not folded into that fix
  since adding a request field is a contract change rather than a correction

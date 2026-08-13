# Status

**Last updated:** 2026-08-13
**Last updated by:** Claude PM (accuracy harness — 11 findings, all 9 actionable ones fixed)

## What works

- Project scaffold: Next.js 16, TypeScript strict, AGPL-3.0; Swiss Ephemeris wrapper with auto-download of data files
- **16 REST endpoints live** at `/api/v1/*` with Zod validation, including transit, synastry, composite, sky-weather, and planetary-return suites
- Calculators (all verified end-to-end against external references):
  - **Astrology** — natal positions, house cusps (7 systems), aspects, **Part of Fortune**, **South Node** (verified ±2' vs Astrodienst)
  - **Astrocartography** — MC/IC/AC/DC lines per planet, **parans (line-crossing points)** (verified via independent spherical-astronomy math)
  - **Human Design** — type, profile, gates, channels, defined centers, authority, incarnation cross with correct angle classification, **Variables (4 arrows)** (gate-wheel anchored to Rave Mandala)
  - **Gene Keys (Hologenetic Profile)** — all 11 official spheres across Activation/Venus/Pearl sequences (verified against genekeys.com)
  - **Life Path** (Pythagorean numerology) and **Destiny Card** (Robert Lee Camp Solar Spread, verified against the published chart)
  - **Returns** — solar return for any year, plus Sun/Mercury/Venus/Mars/Jupiter/Saturn first-return-on-or-after any datetime, both optionally relocated; **secondary progressions** ("day for a year") for inner planets
  - **Transits** — sky snapshot, transit-to-natal overlay, and multi-year event scanner with retrograde-loop detection
  - **Synastry** — chart-to-chart compatibility built on the shared `computeOverlay` core
  - **Composite** — midpoint chart from 2–10 births (circular-mean planets, houses derived from composite MC, PoF, internal aspects)
  - **Full transit combination matrix** — 13 transit × 19 natal points × 6 aspects with sign/house context on both sides; every aspect hit carries a stable `comboKey`; 17,784-key manifest (v2) + canonical `transit-matrix.ts` module
  - **Sky weather** — birth-chart-independent feed of retrograde stations, moon phases, sign ingresses, and eclipses (up to 20-year horizon)
  - **Aspect patterns** — stellium (sign/house), grand trine, T-square, grand cross, yod, kite, mystic rectangle on every natal-style chart and the sky snapshot (element/modality + apex annotated; anchored to Diana/Einstein/Jobs/Mandela geometry and the 5 Feb 1962 seven-planet Aquarius stellium)
  - **Chart ruler** — ruler of the ASC sign with placement + aspects; modern rulerships default, traditional per-request; both rulers always reported
- **`/chart` UI page** — interactive form that fires all calculators and renders a full chart; Swagger UI at `/docs`, OpenAPI 3.1 spec at `/api/openapi.json`
- **UI verified by a deterministic browser render check** — 7 rendered states × 390/768/1440 = 21 cells, zero text-overlap / overflow / clipping findings and zero console errors, in local dev and on production
- **Accuracy anchored to an independent oracle, in three layers**, each with a normative doc stating the convention and the reason for it, so a future change is a deliberate edit not a drift:
  - **L1 ephemeris** (`docs/accuracy.md`) — positions vs **JPL Horizons**, which does not run Swiss Ephemeris,
    so this is a genuinely *independent* check. 20 hostile fixtures (arctic/antarctic, antimeridian, DST gaps
    and ambiguities, 45- and 30-minute zones, pre-Gregorian clocks) harvested **offline** — no CI job depends
    on a live third-party API. All eight well-determined bodies agree to **0.005″ RMS** over 1800–2005
  - **L2 time and houses** (`docs/time-conventions.md`, `docs/chart-conventions.md`) — cusps checked
    against their *defining geometry*, not another implementation; local time → UT → JD audited end to end
  - **L3 interpretive conventions** (`docs/aspect-conventions.md`) — orb tables, rulerships, aspect-window
    non-overlap and the pattern set pinned as goldens. No external truth exists here, so the doc is the contract
- **1355/1355 unit tests passing** across 33 files: 459 L1 ephemeris vs JPL Horizons; 253 L2 house-definition
  plus a 20-test polar-wheel suite sweeping ARMC through a full sidereal day; 64 L2 time-layer, 43 L3
  convention, 17 ephemeris-fallback, 7 version single-source; 36 planet-position vs Astrodienst (Diana, Jobs,
  Mandela) and 11 Sun cross-checks vs independent Meeus VSOP; 51 astrocartography, 38 HD structural, 12 Gene
  Keys, 18 Destiny Card, 12 progression/return, 21 composite, 16 transit-matrix
- **Polar charts are honest about their houses** — `houses.system` names the system that actually
  produced the cusps (Swiss Ephemeris substitutes Porphyry for Placidus/Koch inside the polar
  circles) with `houses.requestedSystem` recording the ask; a wheel that runs retrograde is read in
  its true direction and the caller is told
- **Pre-1800 births are served, not refused** — answered from the Moshier theory and labelled
  `ephemeris: "moshier"`; a body with no ephemeris at all (Chiron) is reported in `unavailableBodies`

## In progress

- (none)

## Open findings

The accuracy harness produced 11 findings (F1–F11). **All nine actionable ones are now fixed**; two need no action. Full write-ups live in the docs cited below; TODO.md carries the short form.

| | Finding | State |
|---|---|---|
| F1 | Every birth date before 1800 returned a 500 — `calcPlanet` threw on sweph *warnings*, not just failures | **Fixed** — PR #20 (`t_d0498a77`). Gated on `flag < 0`; pre-1800 served from Moshier and labelled via a new `ephemeris` field. `sepl_12.se1` deliberately not shipped |
| F2 | Chiron genuinely has no ephemeris before 1800 | **Fixed** — PR #20 (with F1). One refused body no longer takes the chart down; it is reported in an optional `unavailableBodies` array |
| F3 | Horizons has no Neptune/Pluto at 1750/1799 | No action. Oracle-side gap, recorded in the affected fixtures' `notes`; the suite fails if a body vanishes without one |
| F4 | `SE_TRUE_NODE` is not the osculating node (≤0.36° in the 18th c.) | No action — **not a bug**. It is the Swiss Ephemeris convention other astrology software also reports; a documentation matter only |
| F5 | Polar charts returned Porphyry cusps labelled as the requested system | **Fixed** — PR #21 (`t_9a1538d0`). `houses.system` now names what produced the cusps; the 66.5° constant was removed from the decision rather than corrected, since the true boundary tracks the obliquity |
| F6 | A degenerate polar wheel put every body in house 1 | **Fixed** — PR #21 (with F5). The wheel runs *retrograde* in those windows, not merely collapsed; `houseSpans` measures which direction closes the circle instead of assuming forward |
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
| 2026-08-13 | Claude PM       | **Escalation fixes F1/F2 and F5/F6 (PRs #20, #21 → dev; main untouched)** — closes the last four actionable accuracy findings. Pre-1800 births returned a 500 because `calcPlanet` threw on any non-empty `out.error`, but sweph uses that field for *warnings* too and signals real failure via `flag < 0`; now gated on the flag, and every response naming positions carries **`ephemeris`** (`swiss`/`moshier`/`jpl`/`mixed`). `sepl_12.se1` deliberately not shipped — a labelled fallback is not a downgrade in disguise (F1). Chiron, which genuinely has no ephemeris before 1800, is reported in an optional **`unavailableBodies`** array instead of taking the whole chart down (F2). `calcHouses` discarded sweph's return flag, so Porphyry cusps substituted inside the polar circles came back labelled `placidus`; responses now carry **`houses.system`** and, on a substitution, `houses.requestedSystem`. The 66.5° constant was **removed from the decision** rather than corrected: the true boundary tracks the obliquity (66.532697° in 1800 → 66.577351° in ≈2333), so no constant can be right (F5). The wheel that put all 13 bodies in house 1 turned out to be running **retrograde**, not merely collapsed — measured across a full sidereal day at 7 latitudes × 7 systems, all 4186 degenerate instants close to exactly 360° read backwards; `houseSpans` now measures direction instead of assuming it, and two plausible alternative fixes were rejected with measurements rather than argument (F6). Both PRs proven **red-first**; each fix broke the characterization test that had been written to assert the defect, exactly as designed. `houseFor` existed in two files and was consolidated. 1314 → 1355 tests, no fixture rewritten |
| 2026-08-13 | Claude PM       | **Escalation fixes F7–F11 (PRs #17, #18, #19 → dev; main untouched)**: sect now computed from the horizon (`(ASC − Sun) mod 360 < 180`) rather than the Sun's house number, so it no longer varies with `house_system` — before the fix, Placidus said day and whole-sign said night for the same Kolkata 1972 birth and the Part of Fortune moved **135°** (F7); `partOfFortune` is now **omitted entirely** (key absent, not `null`, not present-and-undefined) when the `planets` subset excludes a luminary, instead of silently returning the Ascendant's longitude (F8); both transit paths now read the same orb table — `/api/v1/astrology/transits` went **54 hits → 18**, matching `/api/v1/transit/natal` exactly, the root cause being an import cycle that put `DEFAULT_TRANSIT_ORBS` out of reach, so both tables moved to `src/lib/constants/orbs.ts` (F9); `applying` is now computed from relative motion and the representation is three-valued — `motion` is `applying`/`separating`/`stationary` and the boolean is **omitted** when stationary, with the tolerance (1e-4°/day) measured over 1304 aspecting pairs rather than chosen by feel (F10); the tautological `true_node`/`south_node` opposition at orb 0.00 is suppressed narrowly, with every other South Node aspect kept (F11). Every fix was proven **red-first** by swapping the changed sources for their `dev` versions with the new tests kept — exactly the intended failures, nothing else moving. Conventions promoted to `docs/aspect-conventions.md` §1.3/§1.5/§1.7/§4.2; OpenAPI response prose updated (the spec carries no response schemas, so prose is the only contract surface). Three factual corrections to the original filings recorded inline, since they were claims a public doc made about a public API. 1314/1314, no fixture rewritten |
| 2026-08-13 | Claude PM       | **Accuracy harness — three oracle tiers (PRs #15, #16 → dev)**: L1 anchors ephemeris positions to **JPL Horizons**, the project's first oracle that does not itself run Swiss Ephemeris; 20 hostile fixtures (arctic, antimeridian, DST gaps/ambiguities, 45- and 30-minute zones, pre-Gregorian clocks) harvested **offline** so no CI job depends on a live third-party API; all eight well-determined bodies agree to **0.005″ RMS** over 1800–2005, with the residual floor traced to a frame rotation rather than per-body error. L2 checks house cusps against their defining geometry and audits the local-time → UT → JD pipeline; L3 pins the interpretive conventions (orb tables, rulerships, aspect-window non-overlap, pattern set) as goldens. Four normative docs added: `accuracy.md`, `time-conventions.md`, `chart-conventions.md`, `aspect-conventions.md`. Produced findings **F1–F11**. Separately, `info.version` in the OpenAPI spec and `/api/health` were hard-coded and had drifted two releases behind `package.json`; both now import `API_VERSION` from `src/lib/version.ts`, with a test rejecting a semver literal reappearing on any surface. 491 → 1314 tests |
| 2026-08-12 | Claude PM       | **UI render-check pass (PR #12 → dev, PR #13 → main)**: fixed `/sky` event-row text overlap (123 rows, all viewports — reported by Matthew) and the same class of defect on `/chart` → Transits at 390px (48 rows), both caused by a `white-space: nowrap` grid track starving its `1fr` sibling; replaced both with explicit `.sky-event-row` / `.transit-event-row` grids that re-flow ≤600px. Fixed `/docs`: **every operation was rendering as an empty shell in production** (no parameters, request body, or responses on all 18 endpoints) — the bundler elided apidom's side-effect refractor registration, so `OpenApi3_1Element.refract` was undefined and swagger-client's `resolveSubtree` threw; fixed by awaiting `import("@swagger-api/apidom-ns-openapi-3-1")` inside the existing `dynamic()`. Also fixed 2 dead `var(--text)` references. Verified by a deterministic 21-cell render check, green in dev and prod; 491/491 tests, lint + typecheck clean |

## Known limitations

- No rate limiting yet (planned: Vercel Firewall WAF)
- No caching layer (planned: in-memory LRU + Vercel Runtime Cache)
- Sidereal zodiac not yet supported (tropical only)
- Geocentric only (topocentric deferred pending concurrency design)
- HD/GK ignore lat/lon (documented in JSDoc); only the UT instant matters for those calculators
- Pre-1800 positions come from the Moshier theory, not the Swiss files — arc-second agreement for
  the Sun and planets, coarser for the Moon; Chiron is unavailable there at any accuracy
- Above the polar circles, Placidus and Koch are undefined and Regiomontanus/Campanus wheels can run
  retrograde — both now reported rather than hidden, but `equal` and `whole_sign` are the only systems
  that stay ordered at every latitude
- `/api/v1/astrology/transits` accepts no `orbs` override where `/api/v1/transit/natal` and
  `/api/v1/synastry` do — parity gap found while fixing F9, deliberately not folded into that fix
  since adding a request field is a contract change rather than a correction

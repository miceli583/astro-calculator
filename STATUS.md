# Status

**Last updated:** 2026-08-13
**Last updated by:** Claude PM (`.worktrees/` no longer breaks `npm run lint`; session closed out — see Recent changes)

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
  - **Transits** — sky snapshot, transit-to-natal overlay, and multi-year event scanner with retrograde-loop detection; all three take a per-aspect `orbs` override, **merged over** the defaults rather than replacing the table
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
- **1381/1381 unit tests passing** across 34 files: 459 L1 ephemeris vs JPL Horizons; 253 L2 house-definition
  plus a 20-test polar-wheel suite sweeping ARMC through a full sidereal day; 64 L2 time-layer, 47 L3
  convention, 17 ephemeris-fallback, 7 version single-source; 36 planet-position vs Astrodienst (Diana, Jobs,
  Mandela) and 11 Sun cross-checks vs independent Meeus VSOP; 51 astrocartography, 38 HD structural, 12 Gene
  Keys, 18 Destiny Card, 12 progression/return, 21 composite, 16 transit-matrix, 19 OpenAPI
  request-body contract (documented fields vs the Zod schema each route parses)
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

- Davison chart variant (midpoint composite shipped 2026-07-24)
- Cards of Destiny Planetary Ruling Card + Karma Cards (needs reference table)
- Topocentric flag (Moon precision; concurrency design needed for sweph's global `set_topo`)
- Sidereal zodiac with selectable ayanamsa

## Recent changes

| Date       | Author          | Change                                                                                                                                           |
| ---------- | --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2026-08-13 | Claude PM       | **`npm run lint` no longer breaks on a git worktree (PR #28 → dev, PR #29 → main)** — the card (`t_03b970e2`, filed by me while closing `t_3176e10d`) said lint blows up "whenever a `.worktrees/` dir exists". Trying to reproduce it showed that premise is wrong: a **freshly added** worktree lints clean. The real trigger is a **built** one. `eslint-config-next` supplies the `.next/**` ignore, and flat-config ignore patterns are anchored at the config root — so it matches the root build output but **not** `.worktrees/<name>/.next/**`; once a worktree has been built or dev-served, its generated tree gets pulled into the root lint run. That also explains the original numbers, since all 42 files in the first failing run were under `.worktrees/*/.next/dev`. Fix is one entry in the global `ignores` array. Proven **with the directory still on disk**, because deleting it was the workaround already in use and proves nothing: a real worktree plus the root `.next/` copied in gives **exit 1** — 2446 errors across 418 files, every one under `.worktrees/`, so no source regression was hiding in the noise — and the same tree with the ignore added gives **exit 0**. Checked the ignore is not over-broad by planting an `any` in `src/lib/api/respond.ts`: still reported. Worktree source needs no coverage here; it is the same repo, linted from its own checkout. 1381/1381 |
| 2026-08-13 | Claude PM       | **OpenAPI request bodies corrected on nine endpoints + a contract test (PR #26 → dev, PR #27 → main; live on prod)** — the spec is hand-authored, which buys prose and examples a generator can't produce and costs the one guarantee a generator gives free: nothing kept the documented bodies in step with the Zod schemas the routes parse. Card `t_3176e10d` named two endpoints; **nine of sixteen** had drifted. Five advertised `BirthData` for an entirely different shape, so a consumer who read `/docs` and sent the documented body got a **422** from every one — `/api/v1/transit` most starkly, which takes *no coordinates at all* (it reads the sky; there is no observer to raise houses for). `/api/v1/sky/events` documented **no `requestBody` key whatsoever**, so Swagger UI rendered no body field for an endpoint requiring two. `/api/v1/geocode` `$ref`'d a `GeocodeInput` component that **was never written** — a dangling ref the spec had always carried, which nobody had noticed and which the new test found rather than I did. Three more pointed nested `natal` at `NatalInput`, advertising `planets`/`rulership` options those endpoints silently ignore. The natal shapes are now the three-level hierarchy the Zod schemas already have (`NatalHouseOptions` ⊂ `NatalChartOptions` ⊂ `NatalInput`) — not tidiness: the narrow shape doesn't *reject* `rulership`, it **ignores** it, so publishing the widest shape everywhere claims those options do something. `tests/openapi-request-bodies.test.ts` (19 tests) resolves each body through `$ref`/`allOf` the way a spec reader does and asserts documented fields + required set equal the Zod schema's, for every POST path *and every nested object*, plus that its endpoint list equals the spec's POST paths so nothing can be added undocumented-and-unchecked. **Seen failing first**: 10 of 19 assertions fail against the spec as it stood. Verified on prod by building each request *from the newly published spec* — `sky/events`/`synastry`/`transit`/`geocode` all **200**, while the body the **old** spec documented for synastry returns **422**. Scope deviation (nine, not two) flagged in the PR rather than folded in silently; the one unrelated gap found on the way (`npm run lint` breaks when a `.worktrees/` dir exists) filed as `t_03b970e2`. 1362 → 1381 tests |
| 2026-08-13 | Claude PM       | **Synastry orb-override test proven empty, then made able to fail (PR #24 → dev, PR #25 → main; live on prod)** — `expect(tightConj).toBeLessThanOrEqual(wideConj)` compares two *measured* values and calls it a direction, so equality satisfies it and a calculator ignoring `input.orbs` outright passes. Demonstrated rather than argued: stubbing `calculateSynastry` to drop `...input.orbs` left the assertion **green**, and the fixed assertions go red against the same stub. Replaced with strict inequalities in both directions off the default baseline, the superset check that widening never drops a hit, and a partial-override test pinning merge-not-replace. Recorded because it cuts against the intuition: the **superset check does not catch the no-op on its own** — identical sets are supersets, and it passed under the stub — so only the strict inequalities carry the proof. The suggested orb values (1° and 8°) were already 5 vs 19 hits, so the values were never the problem; the operator was the entire defect. All 114 `OrEqual` assertions in `tests/` swept and classified: one genuinely adjacent vacuous assertion in the same file (`toBeGreaterThanOrEqual(0)` on an array length) fixed alongside, the rest legitimate (measured value vs *declared constant* bound, or sorts where ties are legal). 1359 → 1362 tests |
| 2026-08-13 | Claude PM       | **`orbs` override on `/api/v1/astrology/transits` (PR #22 → dev, PR #23 → main; live on prod)** — closes the parity gap carved out of the F9 fix, since adding a request field is a contract change rather than a correction. `transitInputSchema` gains `orbs`, and `calculateTransits` merges it over `DEFAULT_TRANSIT_ORBS` exactly as `computeOverlay` does for `/transit/natal` and `/synastry` — the two parity references agree with each other, differing only in which default table they merge over, so no third shape had to be adjudicated. **Merge, not replace**: `{conjunction: 9}` widens conjunctions and leaves the other five aspects on their defaults. Shipped red-first: the acceptance test asserts a custom table actually *changes the hit count* in both directions and that widening never drops a hit, because a test that only proves the field is accepted proves nothing. Measured on prod (Diana natal / 2026-08-12): default **18** hits, all-9° **86**, all-0.5° **2**, `{conjunction: 9}` **25** (conjunctions 3→10, others unchanged); orb 16 and −1 both `422`. Two latent problems found on the way: `orbOverrideSchema` was declared *below* `transitInputSchema`, so referencing it would have been a module-load TDZ error, not a forward reference (hoisted with a comment saying why); and the two transit paths scan the aspect table in different orders and both `break` on first match, which is only safe because the schema's 15° cap is exactly half the 30° minimum gap between exact aspect angles — that property is now pinned by a test rather than left as a coincidence. Two out-of-scope gaps filed as cards (`t_3176e10d`, `t_a02c9654`) instead of folded in. 1355 → 1359 tests |
| 2026-08-13 | Claude PM       | **Escalation fixes F1/F2 and F5/F6 (PRs #20, #21 → dev; main untouched)** — closes the last four actionable accuracy findings. Pre-1800 births returned a 500 because `calcPlanet` threw on any non-empty `out.error`, but sweph uses that field for *warnings* too and signals real failure via `flag < 0`; now gated on the flag, and every response naming positions carries **`ephemeris`** (`swiss`/`moshier`/`jpl`/`mixed`). `sepl_12.se1` deliberately not shipped — a labelled fallback is not a downgrade in disguise (F1). Chiron, which genuinely has no ephemeris before 1800, is reported in an optional **`unavailableBodies`** array instead of taking the whole chart down (F2). `calcHouses` discarded sweph's return flag, so Porphyry cusps substituted inside the polar circles came back labelled `placidus`; responses now carry **`houses.system`** and, on a substitution, `houses.requestedSystem`. The 66.5° constant was **removed from the decision** rather than corrected: the true boundary tracks the obliquity (66.532697° in 1800 → 66.577351° in ≈2333), so no constant can be right (F5). The wheel that put all 13 bodies in house 1 turned out to be running **retrograde**, not merely collapsed — measured across a full sidereal day at 7 latitudes × 7 systems, all 4186 degenerate instants close to exactly 360° read backwards; `houseSpans` now measures direction instead of assuming it, and two plausible alternative fixes were rejected with measurements rather than argument (F6). Both PRs proven **red-first**; each fix broke the characterization test that had been written to assert the defect, exactly as designed. `houseFor` existed in two files and was consolidated. 1314 → 1355 tests, no fixture rewritten |

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

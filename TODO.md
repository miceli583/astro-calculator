# TODO

## Critical (blocks production)

- [x] Vercel: confirm calculator endpoints return JSON on production — **verified 2026-07-08**: all 15 endpoints swept on astro-calculator-design.vercel.app; every one returns `application/json` (incl. sweph-powered natal/transits/HD). The `serverExternalPackages` + `outputFileTracingIncludes: "**/*"` fix in next.config.ts resolved it. Evidence in GitHub issue #1 (closed).

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] OpenAPI: `/api/v1/synastry` requestBody `$ref`s `BirthData` but the real input is `{personA, personB, aspects?, orbs?}` — add a proper `SynastryInput` component in `src/lib/openapi/spec.ts` (also the only place the new `rulership` option is undocumented; other endpoints get it via the `NatalInput` $ref). Found in v0.3.0 contract audit, pre-existing.
- [ ] OpenAPI: `info.version` is hard-coded `"0.1.0"` in `src/lib/openapi/spec.ts` while `package.json` is `0.3.0` — the live docs page reads "Astro Calculator API 0.1.0". Same class of bug as f78f231 (health endpoint) and wants the same fix: read the real package version. Metadata only, no contract shape change.
- [ ] Independent accuracy oracle — every position/house test is anchored to Astrodienst, which runs the same Swiss Ephemeris we do, so those are **consistency** checks, not accuracy ones. The only genuinely independent check is `tests/sun-position-meeus.test.ts` (Meeus 1998 ch.25). The Moon, all planets, the nodes, Chiron, and every house system have no external anchor; the local-time → UT → JD pipeline is the highest-risk untested path. Candidate oracle: JPL Horizons.
- [x] `tests/human-design-snapshot.test.ts` header was stale — claimed `GATE_WHEEL_OFFSET` is `3.875°` and "not yet verified", and the describe block said `PROVISIONAL`. The offset is `358.25°`, anchored to the Rave Mandala convention (Gate 41 at 2°00′ Aquarius = 302.00°) and asserted in `tests/hd-gates.test.ts`. Header rewritten 2026-08-12; the file's assertions are range/enum invariants, not captured goldens.
- [ ] Additional strict-lint pass — current setup enforces zero warnings; consider narrower ESLint overrides file-by-file if needed.

## Enhancements (nice to have)

- [ ] Davison chart endpoint (time/space-midpoint variant; midpoint composite shipped 2026-07-24).
- [ ] Client-side test coverage for new UI (Transits tab, Sky page, Synastry sub-tab, planet/aspect filter chips).
- [ ] HD PHS sub-labels — MyBodyGraph shows Digestion labels like "Buzzing (Nervous Touch)" and directional labels like "Direct"/"InDirect". Map color+tone+base sub-classifications; needs lookup tables per variable.
- [ ] Verify J (Juxtaposition) cross names against MyBodyGraph — RA and LA are structurally verified via quaternary invariants; J entries are single-source only.
- [ ] Sabian Symbols — 360-degree symbolic image per zodiac degree (Marc Edmund Jones / Elsie Wheeler). Needs the canonical 360-entry table.
- [ ] Cards of Destiny Planetary Ruling Card + Karma Cards (needs verified lookup tables)
- [ ] Topocentric flag — design concurrency for sweph's global `set_topo` state. Mainly affects Moon (~1°)
- [ ] Sidereal zodiac with selectable ayanamsa (Lahiri / Krishnamurti / Fagan-Bradley)
- [ ] Caching layer (in-memory LRU + Vercel Runtime Cache)
- [ ] Rate limiting via Vercel Firewall WAF rules
- [ ] OpenAPI response schemas — responses are currently description-only, so consumers can't codegen response types (`patterns`, `chartRuler`, `referenceLatitudeSource` documented only in prose); ideally derive from Zod output schemas. Found in v0.3.0 contract audit.
- [ ] SDK packages (`@astro-calculator/client-ts`, Python)
- [ ] Render astrocartography lines on an interactive world map in `/chart`
- [ ] Cross-validate Mandela fixture values against Astrodienst once its Cloudflare gate is passable (currently seeded from our sweph-based calculator).

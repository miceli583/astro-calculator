# CLAUDE.md — Astro Calculator

## What this project is

A **public, AGPL-licensed HTTP API** that calculates astrology (natal, transits,
synastry, progressions, solar/planetary returns), astrocartography, Human Design,
Gene Keys, Life Path numerology, Destiny Cards, and sky weather from birth data.

**This is a PUBLIC SERVICE consumed by client projects** (e.g. SoulMapCalculator
and other apps in this ecosystem). Treat every doc, endpoint, and commit as
public-facing: no internal product strategy, client names, or cost tables in
this repo. Breaking API changes ripple into downstream consumers.

## Why AGPL

The Swiss Ephemeris library (`sweph`) is AGPL-3.0. Any software that *links* to
it and is exposed as a network service must also be AGPL. By isolating the
ephemeris dependency here and making this API public, downstream apps remain
closed-source — they consume the API over HTTP, they don't link the library.

**Never** copy ephemeris-using code from this repo into a closed-source app
without first replacing `sweph` or buying a commercial Swiss Ephemeris license.
See `docs/LICENSING.md`.

## Architecture

- Next.js 16 App Router on Node.js runtime (NOT Edge — `sweph` is a native module)
- REST API: **16 calculator endpoints + a geocode helper** at `/api/v1/*`,
  no GraphQL/tRPC (consumers may not be TS)
- Stateless: no DB, no auth (public calculator)
- Validation: Zod. Errors: `{ error: { code, message, details? } }` via `lib/api/respond.ts`
- Observability: **Sentry** (`@sentry/nextjs`) — `src/instrumentation.ts`,
  `src/instrumentation-client.ts`, `sentry.server.config.ts`,
  `sentry.edge.config.ts`, plus `app/global-error.tsx`
- Docs: OpenAPI 3.1 at `/api/openapi.json` + Swagger UI at `/docs`
- UI pages (client-side React hitting the API): `/chart` (Chart | Transits |
  Synastry tabs), `/sky` (birth-independent sky-weather feed), shared site nav
- SEO/meta: sitemap.ts, robots.ts, OG image, favicon set
- Deployed on Vercel; `next.config.ts` uses `serverExternalPackages` +
  `outputFileTracingIncludes` so sweph + ephemeris files ship in the bundle

### Module layout

```
src/
├── app/
│   ├── api/v1/...           # 16 route handlers (astrology, astrocartography,
│   │                        #   human-design, gene-keys, life-path, destiny-card,
│   │                        #   transit{,/natal,/events}, synastry, composite,
│   │                        #   sky/events, geocode)
│   ├── chart/page.tsx       # Interactive chart UI (tabs: Chart | Transits | Synastry)
│   ├── sky/page.tsx         # Sky-weather feed page
│   ├── _nav.tsx, _birth-form.tsx   # Shared nav + BirthFormFields
│   ├── docs/                # Swagger UI mount
│   └── page.tsx             # API landing page
├── lib/
│   ├── ephemeris/           # sweph wrapper, julian day helpers
│   ├── calculators/         # Pure functions, one file per system (incl.
│   │                        #   overlay.ts shared by transit + synastry,
│   │                        #   composite.ts midpoint charts)
│   ├── constants/           # Gate mappings, card mappings, planet IDs,
│   │                        #   transit-matrix.ts (canonical combo dimensions)
│   ├── services/            # geocode, tz-lookup
│   ├── validation/          # Zod schemas (input + output)
│   ├── openapi/             # Spec generation
│   ├── api/                 # Response helpers
│   └── types/               # Shared types
ephemeris/                   # Downloaded SE data files (gitignored, ~5MB)
scripts/                     # Postinstall ephemeris downloader + transit combos generator
tests/                       # 24 Vitest files, ~450 tests, reference fixtures in tests/fixtures/
docs/                        # ARCHITECTURE.md, LICENSING.md, transits-spec.md
```

## Key commands

```bash
npm run dev              # Dev server
npm run typecheck        # tsc --noEmit
npm run lint             # eslint . (CI enforces --max-warnings=0)
npm run test             # Vitest (run once); test:watch for watch mode
npm run ephe:download    # Re-download Swiss Ephemeris files
EPHE_RANGE=full npm run ephe:download   # Extended historical range
```

## Branching & CI

- Work branches → PR into **dev** → dev merges into **main** via PR
- GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR to main and dev:
  typecheck, lint (zero warnings), full test suite; ephemeris files cached
- CI is the merge gate — verify green with `gh run list` after pushing

## Testing

- 24 test files under `tests/`, all passing (~450 tests)
- Accuracy anchored to external references: Astrodienst (Diana, Jobs), Nelson
  Mandela (Southern-Hemisphere fixture), independent Meeus VSOP Sun positions,
  genekeys.com, Robert Lee Camp's published Destiny Card spreads
- Structural invariants for HD gate wheel, incarnation crosses, Gene Keys spheres

## Conventions

- Inputs: ISO 8601 datetime + IANA timezone + lat/lon. Always those fields.
- Outputs: zodiac longitudes in degrees (0–360), house cusps in same.
- Calculators are pure functions of birth data; no I/O outside the ephemeris client.
- Update STATUS.md / TODO.md at session handoff; CHANGELOG.md for releases.

## Known design decisions

- **REST not tRPC** — consumers may be Python, Swift, or Go services.
- **No DB** — calculations are deterministic; cache at the consumer if needed.
- **Default house system = Placidus** — most common; 7 systems supported.
- **Tropical + geocentric only for now** — sidereal (ayanamsa option) and
  topocentric flag are deferred (see TODO.md).
- **High-latitude warning** at ≥66.5° for quadrant house systems.
- **HD/GK ignore lat/lon** — only the UT instant matters (documented in JSDoc).
- **Composite = circular-mean midpoints, houses derived from composite MC**
  (Astrodienst method) at the mean birth latitude; 2–10 charts. Davison deferred.
- **Transit combination space is factored, not materialized** — canonical
  dimensions in `lib/constants/transit-matrix.ts` (13 transit × 19 natal
  points × 6 aspects); sign-keyed manifest generated to
  `transit-combinations.json`; house/transit-side context annotated at runtime
  on every aspect hit (`comboKey`).

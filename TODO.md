# TODO

## Critical (blocks production)

- [ ] @Matt: Validate calculator output against reference charts — pick 2-3 known birth charts (e.g. from jovianarchive.com, Richard Rudd's site, AstroDienst) and compare:
  - Astrology natal positions (should match Astro.com to within 1')
  - HD type / profile / channels (should match jovianarchive.com)
  - Gene Keys Activation Sequence gates (should match Richard Rudd profile)
- [ ] Tune `GATE_WHEEL_OFFSET` in `src/lib/constants/hd-gates.ts` if HD output doesn't match reference
- [ ] Verify Swiss Ephemeris file paths resolve when deployed to Vercel (test preview deploy)

## Bugs (broken functionality)

- [ ] None known (pre-validation)

## Tech Debt (code quality)

- [ ] Extract magic numbers in HD calculator (88° solar arc, gate boundaries) into named constants
- [ ] Add JSDoc on public calculator entry points
- [ ] `vercel.ts` imports `@vercel/config` — confirm Vercel's build picks this up (it's a devDep)

## Enhancements (nice to have)

- [ ] Astrocartography parans (planetary line crossings)
- [ ] Sidereal zodiac with selectable ayanamsa
- [ ] Topocentric flag (currently geocentric only)
- [ ] Solar return chart endpoint
- [ ] Synastry / composite chart endpoints
- [ ] Progressed chart endpoint
- [ ] Returns for Venus, Mercury, etc.
- [ ] Caching layer (in-memory LRU + Vercel Runtime Cache)
- [ ] Rate limiting via Vercel Firewall WAF rules
- [ ] SDK packages (@astro-calculator/client-ts, py)

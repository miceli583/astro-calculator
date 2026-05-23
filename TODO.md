# TODO

## Critical (blocks production)

- [ ] Verify Swiss Ephemeris file paths resolve when deployed to Vercel (test preview deploy)
- [ ] Verify Astrocartography line latitudes match Astrodienst's published map lines for at least 1 reference chart

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] Add JSDoc on public calculator entry points
- [ ] `vercel.ts` imports `@vercel/config` — confirm Vercel's build picks this up (it's a devDep)
- [ ] HD/GK warning for latitudes above ~66°N/S where Placidus cusps become undefined

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
- [ ] Add a 3rd reference birth chart (current: Princess Diana + Einstein)
- [ ] Verify Chiron output for Diana against an authoritative source (Chiron varies by ephemeris)

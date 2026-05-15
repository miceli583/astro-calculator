# TODO

## Critical (blocks production)

- [ ] Verify Swiss Ephemeris file paths resolve correctly when deployed to Vercel
- [ ] Add reference test fixtures (known birth charts with verified output)
- [ ] Confirm Human Design gate calculation matches hdkit / official references

## Bugs (broken functionality)

- [ ] None known yet (pre-test)

## Tech Debt (code quality)

- [ ] Extract magic numbers in HD calculator (88° solar arc, gate boundaries) into constants
- [ ] Add JSDoc comments on public calculator entry points

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

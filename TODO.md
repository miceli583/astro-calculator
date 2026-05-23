# TODO

## Critical (blocks production)

- [ ] Verify Swiss Ephemeris file paths resolve when deployed to Vercel (test preview deploy)

## Bugs (broken functionality)

- [ ] None known

## Tech Debt (code quality)

- [ ] `vercel.ts` imports `@vercel/config` — confirm Vercel's build picks this up (it's a devDep)

## Enhancements (nice to have)

- [ ] Topocentric flag — design concurrency: `swe.set_topo` is global state; needs
      either per-request reset, mutex, or a wrapper that always sets before calc.
      Mainly affects Moon (~1°) and asteroids; negligible for other planets.
- [ ] Sidereal zodiac with selectable ayanamsa — needs default ayanamsa choice
      (Lahiri vs Krishnamurti vs Fagan-Bradley), schema additions, output marker
- [ ] Astrocartography parans (planetary line crossings)
- [ ] Solar return chart endpoint
- [ ] Synastry / composite chart endpoints
- [ ] Progressed chart endpoint
- [ ] Returns for Venus, Mercury, etc.
- [ ] Caching layer (in-memory LRU + Vercel Runtime Cache)
- [ ] Rate limiting via Vercel Firewall WAF rules
- [ ] SDK packages (@astro-calculator/client-ts, py)
- [ ] Add a 4th reference birth chart (current: Diana, Einstein, Jobs)

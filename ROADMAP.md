# Roadmap

## Phase 1 — MVP (current)

Foundational calculator API. Goal: every system has a working endpoint.

- [x] Project scaffold and license
- [x] Swiss Ephemeris client + data download
- [x] Astrology natal calculator
- [x] Astrocartography (lines only, no parans)
- [x] Human Design (type, profile, gates, channels, centers, authority)
- [x] Gene Keys (Activation, Venus, Pearl)
- [x] Life Path numerology
- [x] Destiny Cards
- [x] OpenAPI 3.1 spec + Swagger UI
- [ ] Reference test fixtures
- [ ] Deploy to Vercel

## Phase 2 — Production hardening

- [ ] Caching layer (request-level + Vercel Runtime Cache)
- [ ] Rate limiting (Vercel Firewall WAF rules)
- [ ] Comprehensive test suite (≥10 reference charts per system)
- [ ] Error tracking (Sentry)
- [ ] Usage analytics (PostHog)
- [ ] Status page

## Phase 3 — Expanded astrology

- [ ] Astrocartography parans
- [ ] Synastry / composite charts
- [ ] Solar / lunar / planetary returns
- [ ] Secondary progressions
- [ ] Sidereal zodiac (multiple ayanamsa options)
- [ ] Asteroids beyond the main four (Chiron, Juno, Vesta, Pallas, Ceres are MVP)
- [ ] Fixed stars and Arabic parts

## Phase 4 — SDKs and dev experience

- [ ] TypeScript client SDK (`@astro-calculator/client-ts`)
- [ ] Python client SDK
- [ ] Postman collection
- [ ] Hosted playground page
- [ ] Webhook callbacks for long-running batch chart calculations

## Phase 5 — Adjacent systems (research)

- [ ] Vedic / Jyotish chart with dashas
- [ ] Chinese astrology (BaZi pillars)
- [ ] Mayan calendar (Tzolkin, Haab)
- [ ] Numerology beyond Pythagorean (Chaldean)

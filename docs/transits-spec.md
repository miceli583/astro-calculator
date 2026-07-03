# Transits & Chart Comparison — Feature Specification

**Status:** Proposal, awaiting client decisions on §7 and §11.
**Author:** AstroCalculator team
**Scope:** Astrology transits, natal-vs-transit overlays, synastry (compatibility), event scanning, prose theming strategy.

---

## 1. Overview

Transits are the same core operation as compatibility (synastry) — both compare two sets of planetary positions and surface the meaningful angular relationships (aspects) between them. This proposal builds one shared **overlay calculator** and layers three endpoints on top:

- Snapshot transits ("what's happening right now vs. my chart")
- Time-range transit events ("what themes are active for me this month/year/decade")
- Synastry / compatibility ("how do I stack up against another person")

A composite chart endpoint (a synthesized third chart from two people's midpoints) is scoped as a follow-up.

---

## 2. Core concepts

**Aspect.** An angular relationship between two chart points. Six aspects are supported in v1:

| Aspect | Angle | Meaning (short) |
|---|---|---|
| Conjunction | 0° | Merging, fusion, intensity |
| Sextile | 60° | Opportunity, ease of flow |
| Square | 90° | Tension, growth through friction |
| Trine | 120° | Harmony, natural talent |
| Quincunx | 150° | Adjustment, awkward integration |
| Opposition | 180° | Polarization, confrontation |

**Orb.** The tolerance (in degrees) within which an aspect is considered active. Tighter orbs = fewer, more significant events. For transits specifically (a tighter regime than natal interpretation):

| Aspect | Default orb (± °) |
|---|---|
| Conjunction | 3.0 |
| Opposition | 3.0 |
| Square | 3.0 |
| Trine | 2.0 |
| Sextile | 2.0 |
| Quincunx | 1.5 |

Orbs are configurable per request.

**Retrograde loop.** Outer planets frequently retrograde, causing a single transit aspect to become exact three times (direct pass → retrograde back → direct again) over ~12–18 months. The event scanner treats these as a single event with multiple peaks — this is the canonical astrological framing and matches how apps like The Pattern surface long themes.

**Overlay.** Given two charts A and B, the overlay function returns:
- Aspect list (every pair of points from A × B within orb)
- HD gate co-activations (which of B's gates fall on A's activated positions — powers HD synastry and daily transit activations)
- House overlays (which of A's houses each of B's planets falls into)

---

## 3. Modes

| Mode | Chart A | Chart B | Endpoint |
|---|---|---|---|
| Momentary transit | Natal | Sky at a datetime | `POST /api/v1/transit/natal` |
| Pure sky snapshot | *(none)* | Sky at a datetime | `POST /api/v1/transit` |
| Transit events | Natal | Sky, swept over a date range | `POST /api/v1/transit/events` |
| Synastry | Person A natal | Person B natal | `POST /api/v1/synastry` |
| Composite | *(midpoint of A + B)* | *(none — treated as a third chart)* | `POST /api/v1/composite` *(deferred)* |

All five modes share one core function, `computeOverlay(chartA, chartB, options)`.

---

## 4. API surface (v1)

### 4.1 `POST /api/v1/transit`

Returns planetary positions for a specific moment.

**Request**
```json
{
  "datetime": "2026-03-14T14:30:00",
  "timezone": "America/Los_Angeles"
}
```

**Response**
```json
{
  "datetime_ut": "2026-03-14T21:30:00Z",
  "planets": [
    { "name": "sun", "longitude": 354.1, "retrograde": false, "sign": "Pisces", "gate": 36, "line": 4 },
    { "name": "moon", "longitude": 82.5, "retrograde": false, "sign": "Gemini", "gate": 20, "line": 2 }
  ]
}
```

### 4.2 `POST /api/v1/transit/natal`

Overlay of sky-at-datetime against a natal chart.

**Request**
```json
{
  "natal": { "datetime": "1998-04-08T06:30:00", "timezone": "America/Chicago", "latitude": 29.95, "longitude": -90.07 },
  "transitDatetime": "2026-03-14T14:30:00",
  "transitTimezone": "America/Los_Angeles",
  "aspects": ["conjunction", "square", "opposition", "trine", "sextile", "quincunx"],
  "orbs": { "conjunction": 3.0 }
}
```

**Response**
```json
{
  "aspects": [
    {
      "transitPlanet": "saturn",
      "natalPoint": "sun",
      "aspect": "conjunction",
      "orb": 0.8,
      "applying": true,
      "exact": false,
      "natalSign": "Aries",
      "natalHouse": 10
    }
  ],
  "hdActivations": [
    { "transitPlanet": "venus", "gate": 20, "line": 3, "activatesNatalChannel": "20-34" }
  ],
  "houseOverlays": [
    { "transitPlanet": "jupiter", "inNatalHouse": 5 }
  ]
}
```

### 4.3 `POST /api/v1/transit/events`

Scan a date range and return sorted events. This is the "life themes" endpoint.

**Request**
```json
{
  "natal": { "datetime": "...", "timezone": "...", "latitude": ..., "longitude": ... },
  "startDate": "2026-01-01",
  "endDate": "2027-01-01",
  "transitPlanets": ["jupiter", "saturn", "chiron", "uranus", "neptune", "pluto", "true_node"],
  "aspects": ["conjunction", "square", "opposition", "trine", "sextile", "quincunx"]
}
```

**Response**
```json
{
  "events": [
    {
      "id": "saturn-sun-conj-2026",
      "transitPlanet": "saturn",
      "natalPoint": "sun",
      "aspect": "conjunction",
      "natalSign": "Aries",
      "natalHouse": 10,
      "orbEnter": "2026-02-14",
      "orbLeave": "2027-01-08",
      "peaks": ["2026-03-22", "2026-08-11", "2026-12-04"],
      "isRetrogradeLoop": true
    }
  ]
}
```

The client is responsible for enriching events with prose (see §7).

### 4.4 `POST /api/v1/synastry`

Same shape as `transit/natal` but takes two natal births instead of natal + datetime.

```json
{
  "personA": { "datetime": "...", "timezone": "...", "latitude": ..., "longitude": ... },
  "personB": { "datetime": "...", "timezone": "...", "latitude": ..., "longitude": ... }
}
```

Returns the same overlay structure. HD activations become "connection chart" data (whose gates co-activate whose, forming defined channels between the two people).

### 4.5 `POST /api/v1/composite` *(deferred, phase F)*

Computes the midpoint chart from two natal births and returns it as a standalone natal-shaped chart.

---

## 5. Scanned bodies and points

**Transit planets (v1 default):** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Chiron, Uranus, Neptune, Pluto, True Node. Meaningful "life theme" planets are Jupiter and slower (Saturn, Chiron, Uranus, Neptune, Pluto, Nodes). Fast planets (Sun, Moon, Mercury, Venus, Mars) generate short-duration transits — hours to days.

**Natal points aspected:** Sun, Moon, Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto, Chiron, Nodes, Ascendant, Midheaven, IC, Descendant, Part of Fortune, Black Moon Lilith.

Configurable per request; defaults ship with all of the above enabled.

---

## 6. Event detection algorithm

For each `(transitPlanet, natalPoint, aspect)` combination:

1. Sample the transit planet's ecliptic longitude at daily resolution across the requested date range.
2. Compute the angular offset from the exact aspect angle (e.g. exactly 180° from the natal point for opposition).
3. Identify contiguous windows where `|offset| < orb`. These are event windows.
4. Detect **retrograde loops**: if the planet exits orb and re-enters within ~18 months (upper bound for outer-planet retrograde period), merge into one event.
5. Within each window, use Newton's method on the longitude difference to find the exact moment(s) the aspect is perfected. Report these as the event's `peaks[]` array.
6. Deduplicate and sort by `orbEnter` date.

Complexity: O(range_in_days × transit_planet_count × natal_point_count). For a 10-year range with defaults, that's ~3,650 × 12 × 18 × 6 aspects ≈ 4.7M cheap sampling operations — well under 5 seconds server time.

---

## 7. Prose / theme generation — **client decision needed**

Events return **structured data only**. Human-readable prose ("Saturn conjunct your Aries Sun: a three-year initiation into structured responsibility over your public identity...") is a separate layer.

There are four viable strategies. Each has meaningful cost, quality, and drift tradeoffs.

### 7.1 Combinatorial size

The prose lookup dimensions:

| Dimension | Values |
|---|---|
| Transit planet | 7 meaningful (Jupiter, Saturn, Chiron, Uranus, Neptune, Pluto, Nodes) |
| Natal point | 9 (Sun, Moon, Mercury, Venus, Mars, ASC, MC, IC, DSC) |
| Aspect | 6 |
| Natal sign of the natal point | 12 |
| Natal house of the natal point | 12 |

- **Base themes** (planet × point × aspect only): 7 × 9 × 6 = **378 combinations**
- **Sign-flavored** (× natal sign): 378 × 12 = **4,536 combinations**
- **Sign + house** (× natal sign × natal house): 378 × 12 × 12 = **54,432 combinations**

### 7.2 Strategy comparison

| Strategy | Prose count | AI generation cost (one-time) | Prose quality | Drift risk | Recommended for |
|---|---|---|---|---|---|
| **A. Base themes only (378)** | 378 | ~$30 | Reads generic — same prose for every Aries Sun in the world | None (static) | Prototype / free tier |
| **B. Sign-flavored (4,536)** | 4,536 | ~$200–400 | Meaningfully personalized to the person's Sun sign, Moon sign, etc. | None (static) | **Default recommended** |
| **C. Sign + house (54,432)** | 54,432 | ~$3,000–6,000 | Fully situated — "Saturn on your Aries Sun in the 10th house" | None (static) | Premium product, once monetized |
| **D. Real-time AI generation** | Per request | ~$0.01–0.05 per event | Highest possible, adapts to full chart context | High: same user asking twice may get different readings; hard to QA; ongoing API cost | Skip for now — QA and cost are prohibitive at scale |

### 7.3 Recommendation

**Ship Strategy B (4,536 templates) at launch.** It's the sweet spot:

- 12× more personalized than the naïve baseline — every user gets prose specific to *their* Sun/Moon/Mercury sign, not generic
- Fully static: no ongoing cost, no drift, no user complaints about "why does it say different things when I refresh"
- Fits comfortably in a ~5 MB JSON file the API serves as a static asset
- Reviewable: 4,536 entries can be spot-audited by a human astrologer before launch

**Upgrade to Strategy C (54,432) later** once the product has revenue justifying either (a) the AI generation budget for the full matrix, or (b) hiring an astrologer to author the extra 50k entries. The API structure won't change — it's a data-file swap.

**Real-time AI (Strategy D) is a trap for this product** because prose consistency across sessions is a *feature*, not a bug. Users share their readings with friends and expect the same words to be there tomorrow.

### 7.4 Generation pipeline (proposed)

Independent of the calculator API:

1. `scripts/generate-transit-combinations.mjs` → emits `transit-combinations.json` (structured metadata for all 4,536 keys, no prose)
2. Batch job hands each combination to an LLM (Claude Opus recommended for astrology domain quality) with a strict template prompt
3. Human reviewer spot-checks ~5% of output for quality gates
4. Compiled to `src/lib/constants/transit-themes.json` — shipped as a static asset with the API
5. `GET /api/v1/transit/theme?transitPlanet=saturn&natalPoint=sun&aspect=conjunction&natalSign=Aries` returns the prose

---

## 8. Data model additions (out of scope for the calculator core)

If the client wants prose delivered by our API rather than composed client-side, we'd add:

- `src/lib/constants/transit-themes.json` — 4,536-entry lookup
- `GET /api/v1/transit/theme` — lookup endpoint
- OpenAPI schema updates

If the client prefers to compose prose in their own service, they get structured events and hydrate them themselves — no API changes needed.

---

## 9. Non-goals for v1

- **Progressed-chart transits** (transiting current sky against secondary progressions) — deferrable
- **Solar arc directions** — separate technique, deferrable
- **Fixed stars** — very niche, deferrable
- **Draconic zodiac** — niche, deferrable
- **Sidereal vs tropical** — currently tropical only. Sidereal is on the existing roadmap; when added, it applies to transits automatically
- **Composite / Davison midpoint charts** — deferred to phase F
- **Astrocartography for transits** ("relocated transits") — deferrable

---

## 10. Rollout phases

| Phase | Deliverable | Effort |
|---|---|---|
| A | `computeOverlay()` core function + tests | 2–3 days |
| B | `POST /api/v1/transit` + `POST /api/v1/transit/natal` | 1 day |
| C | `POST /api/v1/transit/events` with retrograde-loop detection | 3–5 days |
| D | `POST /api/v1/synastry` (near-zero after A) | 0.5 day |
| E | `scripts/generate-transit-combinations.mjs` (structured metadata only) | 0.5 day |
| F | Theme prose generation (Strategy B, 4,536 entries) + `GET /api/v1/transit/theme` | 2–3 days build + LLM batch + review |
| G | `POST /api/v1/composite` (deferred) | 1–2 days |

Total for A–F: **~2 weeks** engineering + 1 week prose review.

---

## 11. Open decisions for the client

Before we start building, please confirm:

1. **Prose strategy** — Ship 378 / 4,536 / 54,432 / real-time (§7)? Recommendation: **4,536**.
2. **Prose ownership** — Should our API serve the prose (`GET /transit/theme` returns text) or return structured events only, with the client's app composing prose from its own copy of the lookup? Public-calculator scope says the second; a "premium" API tier could bundle the first.
3. **Body defaults** — Confirm we should include Chiron and Nodes in default transit scanning. (Both are astrologically significant but slightly heterodox in some schools.)
4. **Date range cap for `/transit/events`** — Proposed cap: 20 years. Confirm or adjust.
5. **Deferred features** — Confirm composite / progressed-transits / solar arc can wait for v2.
6. **Synastry framing** — Do we want dedicated HD "connection chart" analysis (definition through partner's activations, penta dynamics) in v1, or keep synastry to the astrological aspect table for now?

Once these are answered, phase A begins.

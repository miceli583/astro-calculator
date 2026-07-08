# Transits & Chart Comparison — Feature Specification

**Status:** Implemented (v1).
**Scope:** Astrology transits, natal-vs-transit overlays, synastry (compatibility), event scanning.

---

## 1. Overview

Transits are the same core operation as compatibility (synastry) — both compare two sets of planetary positions and surface the meaningful angular relationships (aspects) between them. The API is built on one shared **overlay calculator** with three surfaces on top:

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

**Retrograde loop.** Outer planets frequently retrograde, causing a single transit aspect to become exact three times (direct pass → retrograde back → direct again) over ~12–18 months. The event scanner treats these as a single event with multiple peaks — this is the canonical astrological framing.

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

Consumers apply their own prose layer on top of these structured events (see §7).

### 4.4 `POST /api/v1/synastry`

Same shape as `transit/natal` but takes two natal births instead of natal + datetime.

```json
{
  "personA": { "datetime": "...", "timezone": "...", "latitude": ..., "longitude": ... },
  "personB": { "datetime": "...", "timezone": "...", "latitude": ..., "longitude": ... }
}
```

Returns the same overlay structure. HD activations become "connection chart" data (whose gates co-activate whose, forming defined channels between the two people).

### 4.5 `POST /api/v1/composite` *(deferred)*

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

To support keyed lookups, `scripts/generate-transit-combinations.mjs` emits a structured manifest of all `(transitPlanet, aspect, natalPoint, natalSign)` combinations (4,536 keys) at `src/lib/constants/transit-combinations.json`. Consumers use these keys to attach their own theming.

---

## 7. Prose / theme generation

Out of scope for the calculator API. Events return **structured data only** — consumers apply their own prose layer. This keeps the calculator neutral about interpretation and lets each consumer choose a theming approach (static tables, real-time generation, hybrid, etc.) that fits their product.

The event `id` combined with `natalSign` produces a stable lookup key (`saturn.conjunction.sun.Aries`) that consumers can key their prose against.

---

## 8. Non-goals for v1

- **Progressed-chart transits** (transiting current sky against secondary progressions) — deferrable
- **Solar arc directions** — separate technique, deferrable
- **Fixed stars** — very niche, deferrable
- **Draconic zodiac** — niche, deferrable
- **Sidereal vs tropical** — currently tropical only. Sidereal is on the existing roadmap; when added, it applies to transits automatically
- **Composite / Davison midpoint charts** — deferred
- **Astrocartography for transits** ("relocated transits") — deferrable

// OpenAPI 3.1 specification for the public Astro Calculator API.
// Hand-authored (not derived from Zod) for control over docs and examples.

import { API_VERSION } from "../version";

// Repeated verbatim on every endpoint that returns computed positions. Responses
// are description-only (see TODO.md), so this prose IS the contract for the
// `ephemeris` / `unavailableBodies` pair — it must say the same thing everywhere.
const EPHEMERIS_PROSE =
  "`ephemeris` names the data source that actually produced the positions: `\"swiss\"`, " +
  "`\"moshier\"`, `\"jpl\"`, or `\"mixed\"`. Dates outside the shipped Swiss Ephemeris data " +
  "files (before 1800 CE) are answered from the Moshier analytic theory and labelled " +
  "`\"moshier\"` rather than rejected — arc-second-level agreement for the Sun and planets, " +
  "coarser for the Moon. `unavailableBodies` is OPTIONAL (key absent when every requested " +
  "body was computed) and lists each body the ephemeris refuses for that instant as " +
  "`{ name, longitude: null, reason }`; Chiron before 1800 is the common case, since no " +
  "ephemeris for it exists there at all.";

const HOUSES_PROSE =
  "`houses.system` names the house system that actually produced the cusps, which is not " +
  "always the one requested: inside the polar circles Placidus and Koch are undefined, and " +
  "Swiss Ephemeris substitutes Porphyry cusps. When that happens `houses.system` is " +
  "`\"porphyrius\"` and `houses.requestedSystem` records what was asked for; " +
  "`requestedSystem` is OPTIONAL and its key is absent whenever no substitution occurred. " +
  "The substitution is detected from the ephemeris return flag, not a latitude threshold — " +
  "the true boundary tracks the obliquity and moves with the epoch. Regiomontanus and " +
  "Campanus are defined at every latitude but, above the polar circles and over a window of " +
  "sidereal time that widens with latitude, the wheel runs BACKWARDS: cusps descend, ten of " +
  "the twelve houses are hairline-narrow and two span roughly 180°. Bodies are still placed " +
  "in the house that genuinely contains them and the cusps are exact, but the house numbers " +
  "are not comparable with a temperate chart's, and `warnings` says so. `equal` and " +
  "`whole_sign` stay ordered at every latitude.";

export interface OpenAPISpec {
  openapi: string;
  info: Record<string, unknown>;
  servers: { url: string; description?: string }[];
  paths: Record<string, unknown>;
  components: { schemas: Record<string, unknown> };
}

export function buildOpenAPISpec(baseUrl: string): OpenAPISpec {
  return {
    openapi: "3.1.0",
    info: {
      title: "Astro Calculator API",
      version: API_VERSION,
      description:
        "Public, AGPL-licensed calculator API for astrology, astrocartography, " +
        "Human Design, Gene Keys, Life Path numerology, and Destiny Cards. " +
        "Powered by Swiss Ephemeris.",
      license: {
        name: "AGPL-3.0-or-later",
        url: "https://www.gnu.org/licenses/agpl-3.0.html",
      },
    },
    servers: [{ url: baseUrl, description: "Current host" }],
    paths: {
      "/api/health": {
        get: {
          summary: "Service health check",
          responses: {
            "200": {
              description: "Service is up",
              content: { "application/json": { schema: { type: "object" } } },
            },
          },
        },
      },
      "/api/v1/astrology/natal": {
        post: {
          summary: "Calculate a natal chart",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/NatalInput" } } },
          },
          responses: {
            "200": { description: "Natal chart with planets, houses, aspects, aspect patterns (stellium, grand trine, T-square, grand cross, yod, kite, mystic rectangle), and the chart ruler (ruler of the Ascendant sign with placement + aspects). `partOfFortune` is OPTIONAL: its formula requires both luminaries, so the field is omitted entirely (key absent) when `planets` excludes the Sun or the Moon. Its `isDayBirth` is determined by the Sun's position relative to the horizon and does not vary with `house_system`. " + EPHEMERIS_PROSE + " " + HOUSES_PROSE },
            "422": { description: "Invalid input" },
          },
        },
      },
      "/api/v1/astrology/transits": {
        post: {
          summary: "Calculate transit aspects to a natal chart",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransitInput" } } },
          },
          responses: {
            "200": {
              description:
                "Transit chart. Aspects to the natal chart use the TRANSIT orb table (conjunction/opposition/square 3°, trine/sextile 2°, quincunx 1.5°) — the same table as `/api/v1/transit/natal`, so both endpoints return the same aspects for the same moment. Each aspect carries `motion`: `\"applying\"`, `\"separating\"`, or `\"stationary\"` when the two bodies' relative speed is below 1e-4°/day. The boolean `applying` is OPTIONAL and is omitted entirely (key absent) when `motion` is `\"stationary\"`, since neither direction would be a true claim. That table is the DEFAULT, not a ceiling: send `orbs` to override any subset of it, merged over the defaults, exactly as `/api/v1/transit/natal` and `/api/v1/synastry` accept it. The two transit endpoints agree under a custom table as well as the default one. " +
                EPHEMERIS_PROSE +
                " The transit sky is sourced separately from the natal chart, so it reports `transitEphemeris` and `unavailableTransitBodies` alongside the natal chart's own `ephemeris` and `unavailableBodies`.",
            },
          },
        },
      },
      "/api/v1/transit": {
        post: {
          summary: "Sky snapshot — planet positions at a datetime (no natal chart)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransitSkyInput" } } },
          },
          responses: { "200": { description: "Planet longitudes, signs, HD gates, and sky-wide aspect patterns (sign-based) for the given moment. " + EPHEMERIS_PROSE } },
        },
      },
      "/api/v1/transit/natal": {
        post: {
          summary: "Transit-to-natal overlay: current-sky aspects + HD activations + house overlays for a natal chart",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransitToNatalInput" } } },
          },
          responses: { "200": { description:
                "Natal chart, transit sky, and overlay (aspects, hdActivations, houseOverlays). Each aspect hit carries `motion`: `\"applying\"`, `\"separating\"`, or `\"stationary\"`. The boolean `applying` is OPTIONAL — omitted (key absent) when the direction is not determinate, i.e. `motion` is `\"stationary\"` or no speed was available for the moving point. `motion` itself is absent in that no-speed case, which is a different claim from `\"stationary\"`: unknown rather than none." } },
        },
      },
      "/api/v1/transit/events": {
        post: {
          summary: "Scan a date range for transit events (aspect windows + retrograde loops)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/TransitEventsInput" } } },
          },
          responses: { "200": { description: "Chronologically sorted array of events, each with orbEnter/orbLeave dates and exact-aspect peaks (multiple for retrograde loops)" } },
        },
      },
      "/api/v1/sky/events": {
        post: {
          summary: "Sky weather feed — retrograde stations, lunations, sign ingresses, and eclipses",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SkyEventsInput" } } },
          },
          responses: { "200": { description: "Chronologically sorted array of sky events across the requested date range (up to 20 years)" } },
        },
      },
      "/api/v1/synastry": {
        post: {
          summary: "Compatibility / connection chart between two people's natal charts",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SynastryInput" } } },
          },
          responses: { "200": { description:
                "Both natal charts plus bidirectional overlays (bOnA and aOnB). Aspect hits carry the same optional `applying` / three-valued `motion` fields as `/api/v1/transit/natal`." } },
        },
      },
      "/api/v1/composite": {
        post: {
          summary: "Composite (midpoint) chart from 2–10 birth charts",
          description:
            "Synthesizes one chart from several people's natal midpoints — the chart 'of the relationship'. Each composite planet is the circular mean of that planet's natal positions (for two charts, the classic shorter-arc midpoint). The house wheel is derived from the composite MC at the mean birth latitude, or at an explicit `reference_latitude` (e.g. where the couple lives).",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/CompositeInput" } } },
          },
          responses: { "200": { description: "Natal-style composite chart: midpoint planets with sign + house, derived house wheel, internal aspects, aspect patterns, and the composite chart ruler. `partOfFortune` is OPTIONAL — omitted entirely (key absent) when either luminary is missing from the composite point set — and its sect is read from the composite horizon, so it does not vary with `house_system`. " + HOUSES_PROSE + " The composite wheel is cast at `referenceLatitude`, so it is that latitude — not the birth latitudes — that decides whether a substitution or a reversal happens." } },
        },
      },
      "/api/v1/astrology/progressions": {
        post: {
          summary: "Compute secondary-progressed positions ('day for a year')",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProgressedInput" } } },
          },
          responses: { "200": { description: "Progressed inner-planet positions for the requested age. " + EPHEMERIS_PROSE } },
        },
      },
      "/api/v1/astrology/solar-return": {
        post: {
          summary: "Cast a Solar Return chart for a given year",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SolarReturnInput" } } },
          },
          responses: { "200": { description: "Full natal-style chart cast at the moment the transit Sun returns to the natal Sun longitude. As with the natal chart, `partOfFortune` is optional and omitted when a luminary is absent from the requested `planets` subset. " + EPHEMERIS_PROSE } },
        },
      },
      "/api/v1/astrology/planetary-return": {
        post: {
          summary: "Cast a Planetary Return chart (Sun, Mercury, Venus, Mars, Jupiter, Saturn)",
          description:
            "Finds the first moment on or after `after_datetime` when the given planet's ecliptic longitude equals its natal longitude, then casts a full natal-style chart for that moment. A minimum interval from birth is enforced so post-birth retrograde loops back over the natal longitude don't count as a return.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/PlanetaryReturnInput" } } },
          },
          responses: { "200": { description: "Full natal-style chart cast at the return moment, with the planet, natal longitude, and return JD-UT. As with the natal chart, `partOfFortune` is optional and omitted when a luminary is absent from the requested `planets` subset. " + EPHEMERIS_PROSE } },
        },
      },
      "/api/v1/astrocartography": {
        post: {
          summary: "Compute astrocartography (planetary lines on Earth)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/AstroCartoInput" } } },
          },
          responses: { "200": { description: "Lat/lon arrays per planet line" } },
        },
      },
      "/api/v1/human-design/chart": {
        post: {
          summary: "Calculate Human Design body graph",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "HD chart with type, profile, channels, etc." } },
        },
      },
      "/api/v1/gene-keys/profile": {
        post: {
          summary: "Calculate Gene Keys profile",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "Activation, Venus, and Pearl sequences" } },
        },
      },
      "/api/v1/life-path": {
        post: {
          summary: "Calculate Life Path number (Pythagorean numerology)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/DateOnly" } } },
          },
          responses: { "200": { description: "Life Path number with reduction trace" } },
        },
      },
      "/api/v1/destiny-card": {
        post: {
          summary: "Look up Destiny Card / Birth Card from date",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/DateOnly" } } },
          },
          responses: { "200": { description: "Birth Card" } },
        },
      },
      "/api/v1/geocode": {
        post: {
          summary: "Look up a city / place name → lat, lon, and IANA timezone",
          description:
            "Backed by OpenStreetMap's Nominatim service. Returns up to N matches; for each, the timezone is derived from the resolved coordinates. Use for birthplace lookup in client UIs.",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/GeocodeInput" } } },
          },
          responses: { "200": { description: "Ranked list of matching places with lat/lon/timezone" } },
        },
      },
    },
    components: {
      schemas: {
        BirthData: {
          type: "object",
          required: ["datetime", "timezone", "latitude", "longitude"],
          properties: {
            datetime: { type: "string", example: "1980-07-15T14:30:00", description: "Local wall-clock time, ISO 8601" },
            timezone: { type: "string", example: "America/New_York", description: "IANA timezone" },
            latitude: { type: "number", minimum: -90, maximum: 90, example: 40.7128 },
            longitude: { type: "number", minimum: -180, maximum: 180, example: -74.006 },
          },
        },
        // The three natal shapes below mirror the Zod hierarchy in
        // src/lib/validation/schemas.ts exactly, and they are genuinely
        // different: an endpoint that takes `NatalHouseOptions` will reject
        // neither `rulership` nor `planets` — it ignores them — so advertising
        // the widest shape everywhere would tell consumers those options do
        // something where they do not.
        NatalHouseOptions: {
          allOf: [
            { $ref: "#/components/schemas/BirthData" },
            {
              type: "object",
              properties: {
                house_system: {
                  type: "string",
                  enum: ["placidus", "koch", "porphyrius", "regiomontanus", "campanus", "equal", "whole_sign"],
                  default: "placidus",
                },
              },
            },
          ],
        },
        /** Birth data + every chart option honored wherever a chart is cast. */
        NatalChartOptions: {
          allOf: [
            { $ref: "#/components/schemas/NatalHouseOptions" },
            {
              type: "object",
              properties: { rulership: { $ref: "#/components/schemas/RulershipConvention" } },
            },
          ],
        },
        NatalInput: {
          allOf: [
            { $ref: "#/components/schemas/NatalChartOptions" },
            {
              type: "object",
              properties: {
                planets: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional subset of planets to compute",
                },
              },
            },
          ],
        },
        AspectFilter: {
          type: "array",
          items: {
            type: "string",
            enum: ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"],
          },
          description:
            "Optional subset of aspect types to report. Omit for all six. This narrows WHICH aspects are searched for; `orbs` controls how wide each one's window is.",
        },
        PlanetFilter: {
          type: "array",
          items: { type: "string" },
          description: "Optional subset of planets. Omit for the full set.",
        },
        RulershipConvention: {
          type: "string",
          enum: ["modern", "traditional"],
          default: "modern",
          description:
            "Rulership table for the chart ruler. Modern: Scorpio→Pluto, Aquarius→Uranus, Pisces→Neptune. Traditional: Scorpio→Mars, Aquarius→Saturn, Pisces→Jupiter. Both rulers are always reported where the conventions differ.",
        },
        TransitInput: {
          type: "object",
          required: ["natal", "transit_datetime", "transit_timezone"],
          properties: {
            natal: { $ref: "#/components/schemas/NatalHouseOptions" },
            transit_datetime: { type: "string", example: "2026-05-15T12:00:00" },
            transit_timezone: { type: "string", example: "UTC" },
            planets: { $ref: "#/components/schemas/PlanetFilter" },
            orbs: { $ref: "#/components/schemas/OrbOverride" },
          },
        },
        TransitSkyInput: {
          type: "object",
          required: ["datetime", "timezone"],
          description:
            "A moment, not a birth. This endpoint reads the sky itself, so it takes no coordinates — houses need an observer and there is no observer here.",
          properties: {
            datetime: { type: "string", example: "2026-05-15T12:00:00" },
            timezone: { type: "string", example: "UTC" },
            planets: { $ref: "#/components/schemas/PlanetFilter" },
          },
        },
        TransitToNatalInput: {
          type: "object",
          required: ["natal", "transit_datetime", "transit_timezone"],
          properties: {
            natal: { $ref: "#/components/schemas/NatalChartOptions" },
            transit_datetime: { type: "string", example: "2026-05-15T12:00:00" },
            transit_timezone: { type: "string", example: "UTC" },
            transit_planets: { $ref: "#/components/schemas/PlanetFilter" },
            aspects: { $ref: "#/components/schemas/AspectFilter" },
            orbs: { $ref: "#/components/schemas/OrbOverride" },
          },
        },
        TransitEventsInput: {
          type: "object",
          required: ["natal", "start_date", "end_date"],
          properties: {
            natal: { $ref: "#/components/schemas/NatalHouseOptions" },
            start_date: { type: "string", example: "2026-01-01" },
            end_date: { type: "string", example: "2026-12-31" },
            transit_planets: { $ref: "#/components/schemas/PlanetFilter" },
            natal_points: {
              type: "array",
              items: { type: "string" },
              description:
                "Optional subset of natal points to scan against — planets plus the angles, South Node, Vertex, and Part of Fortune.",
            },
            aspects: { $ref: "#/components/schemas/AspectFilter" },
            orbs: { $ref: "#/components/schemas/OrbOverride" },
            step_days: {
              type: "integer",
              minimum: 1,
              maximum: 30,
              description:
                "Sampling interval for the scan. Coarser steps are faster but can step over a short window entirely.",
            },
          },
        },
        SkyEventsInput: {
          type: "object",
          required: ["start_date", "end_date"],
          description: "Birth-independent: the sky's own calendar over a range of up to 20 years.",
          properties: {
            start_date: { type: "string", example: "2026-01-01" },
            end_date: { type: "string", example: "2026-12-31" },
            categories: {
              type: "array",
              items: { type: "string", enum: ["retrograde", "lunation", "ingress", "eclipse"] },
              description: "Optional subset of event categories. Omit for all four.",
            },
            retrograde_planets: { $ref: "#/components/schemas/PlanetFilter" },
            ingress_planets: { $ref: "#/components/schemas/PlanetFilter" },
          },
        },
        SynastryInput: {
          type: "object",
          required: ["personA", "personB"],
          properties: {
            personA: { $ref: "#/components/schemas/NatalChartOptions" },
            personB: { $ref: "#/components/schemas/NatalChartOptions" },
            aspects: { $ref: "#/components/schemas/AspectFilter" },
            orbs: { $ref: "#/components/schemas/OrbOverride" },
          },
        },
        OrbOverride: {
          type: "object",
          description:
            "Per-aspect orb overrides, in degrees. Merged OVER the endpoint's default table rather than replacing it: any aspect you omit keeps its default orb. Capped at 15° per aspect, which is half the smallest gap between two exact aspect angles — so no two aspect windows can overlap and each pair of bodies still yields at most one aspect.",
          properties: {
            conjunction: { type: "number", minimum: 0, maximum: 15, example: 6 },
            sextile: { type: "number", minimum: 0, maximum: 15 },
            square: { type: "number", minimum: 0, maximum: 15 },
            trine: { type: "number", minimum: 0, maximum: 15 },
            quincunx: { type: "number", minimum: 0, maximum: 15 },
            opposition: { type: "number", minimum: 0, maximum: 15 },
          },
        },
        AstroCartoInput: {
          allOf: [
            { $ref: "#/components/schemas/BirthData" },
            {
              type: "object",
              properties: {
                planets: { type: "array", items: { type: "string" } },
                latitude_step: { type: "number", default: 1, description: "Sampling resolution (degrees)" },
                min_latitude: { type: "number", default: -85 },
                max_latitude: { type: "number", default: 85 },
                include_parans: { type: "boolean", default: true, description: "Include paran (line-crossing) points in the result" },
                paran_resolution: { type: "number", default: 0.5, description: "Latitude resolution for paran detection (degrees)" },
              },
            },
          ],
        },
        ProgressedInput: {
          allOf: [
            { $ref: "#/components/schemas/BirthData" },
            {
              type: "object",
              required: ["years"],
              properties: {
                years: { type: "number", minimum: 0, maximum: 120, description: "Years after birth (e.g. 28 for 'at age 28'). Fractional values allowed." },
                planets: { type: "array", items: { type: "string" }, description: "Defaults to Sun, Moon, Mercury, Venus, Mars (inner planets that move meaningfully)" },
              },
            },
          ],
        },
        SolarReturnInput: {
          type: "object",
          required: ["natal", "year"],
          properties: {
            natal: { $ref: "#/components/schemas/NatalChartOptions" },
            year: { type: "integer", minimum: 1500, maximum: 3500, example: 2026 },
            relocation: {
              type: "object",
              description: "Optional: cast the return chart for a different location (where you will be during the year).",
              required: ["latitude", "longitude", "timezone"],
              properties: {
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                timezone: { type: "string" },
              },
            },
          },
        },
        PlanetaryReturnInput: {
          type: "object",
          required: ["natal", "planet"],
          properties: {
            natal: { $ref: "#/components/schemas/NatalChartOptions" },
            planet: {
              type: "string",
              enum: ["sun", "mercury", "venus", "mars", "jupiter", "saturn"],
              example: "saturn",
            },
            after_datetime: {
              type: "string",
              example: "2026-01-01T00:00:00",
              description: "Find the first return on or after this ISO datetime. Defaults to now.",
            },
            after_timezone: {
              type: "string",
              example: "UTC",
              description: "IANA timezone for after_datetime. Defaults to UTC.",
            },
            relocation: {
              type: "object",
              description: "Optional: cast the return chart at a different location.",
              required: ["latitude", "longitude", "timezone"],
              properties: {
                latitude: { type: "number", minimum: -90, maximum: 90 },
                longitude: { type: "number", minimum: -180, maximum: 180 },
                timezone: { type: "string" },
              },
            },
          },
        },
        CompositeInput: {
          type: "object",
          required: ["charts"],
          properties: {
            charts: {
              type: "array",
              minItems: 2,
              maxItems: 10,
              items: { $ref: "#/components/schemas/BirthData" },
              description: "2–10 birth charts to combine into one composite chart",
            },
            house_system: {
              type: "string",
              enum: ["placidus", "koch", "porphyrius", "regiomontanus", "campanus", "equal", "whole_sign"],
              default: "placidus",
              description: "House system for the composite wheel",
            },
            reference_latitude: {
              type: "number",
              minimum: -90,
              maximum: 90,
              description:
                "Latitude to cast the composite house wheel for (e.g. where the couple lives). Defaults to the arithmetic mean of the birth latitudes (Astrodienst method). The response reports the latitude used and its source.",
            },
            rulership: { $ref: "#/components/schemas/RulershipConvention" },
          },
        },
        DateOnly: {
          type: "object",
          required: ["date"],
          properties: { date: { type: "string", example: "1990-08-22" } },
        },
        // /api/v1/geocode has always $ref'd this name; the component itself was
        // never written, so the reference dangled and Swagger UI had no body
        // schema to render for the endpoint.
        GeocodeInput: {
          type: "object",
          required: ["query"],
          properties: {
            query: { type: "string", minLength: 2, maxLength: 200, example: "Sandringham, Norfolk" },
            limit: { type: "integer", minimum: 1, maximum: 10, default: 5, description: "Maximum matches to return" },
          },
        },
      },
    },
  };
}

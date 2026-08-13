// OpenAPI 3.1 specification for the public Astro Calculator API.
// Hand-authored (not derived from Zod) for control over docs and examples.

import { API_VERSION } from "../version";

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
            "200": { description: "Natal chart with planets, houses, aspects, aspect patterns (stellium, grand trine, T-square, grand cross, yod, kite, mystic rectangle), and the chart ruler (ruler of the Ascendant sign with placement + aspects). `partOfFortune` is OPTIONAL: its formula requires both luminaries, so the field is omitted entirely (key absent) when `planets` excludes the Sun or the Moon. Its `isDayBirth` is determined by the Sun's position relative to the horizon and does not vary with `house_system`." },
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
          responses: { "200": { description: "Transit chart" } },
        },
      },
      "/api/v1/transit": {
        post: {
          summary: "Sky snapshot — planet positions at a datetime (no natal chart)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "Planet longitudes, signs, HD gates, and sky-wide aspect patterns (sign-based) for the given moment" } },
        },
      },
      "/api/v1/transit/natal": {
        post: {
          summary: "Transit-to-natal overlay: current-sky aspects + HD activations + house overlays for a natal chart",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "Natal chart, transit sky, and overlay (aspects, hdActivations, houseOverlays)" } },
        },
      },
      "/api/v1/transit/events": {
        post: {
          summary: "Scan a date range for transit events (aspect windows + retrograde loops)",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "Chronologically sorted array of events, each with orbEnter/orbLeave dates and exact-aspect peaks (multiple for retrograde loops)" } },
        },
      },
      "/api/v1/sky/events": {
        post: {
          summary: "Sky weather feed — retrograde stations, lunations, sign ingresses, and eclipses",
          responses: { "200": { description: "Chronologically sorted array of sky events across the requested date range (up to 20 years)" } },
        },
      },
      "/api/v1/synastry": {
        post: {
          summary: "Compatibility / connection chart between two people's natal charts",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/BirthData" } } },
          },
          responses: { "200": { description: "Both natal charts plus bidirectional overlays (bOnA and aOnB)" } },
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
          responses: { "200": { description: "Natal-style composite chart: midpoint planets with sign + house, derived house wheel, internal aspects, aspect patterns, and the composite chart ruler. `partOfFortune` is OPTIONAL — omitted entirely (key absent) when either luminary is missing from the composite point set — and its sect is read from the composite horizon, so it does not vary with `house_system`." } },
        },
      },
      "/api/v1/astrology/progressions": {
        post: {
          summary: "Compute secondary-progressed positions ('day for a year')",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/ProgressedInput" } } },
          },
          responses: { "200": { description: "Progressed inner-planet positions for the requested age" } },
        },
      },
      "/api/v1/astrology/solar-return": {
        post: {
          summary: "Cast a Solar Return chart for a given year",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/SolarReturnInput" } } },
          },
          responses: { "200": { description: "Full natal-style chart cast at the moment the transit Sun returns to the natal Sun longitude. As with the natal chart, `partOfFortune` is optional and omitted when a luminary is absent from the requested `planets` subset." } },
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
          responses: { "200": { description: "Full natal-style chart cast at the return moment, with the planet, natal longitude, and return JD-UT. As with the natal chart, `partOfFortune` is optional and omitted when a luminary is absent from the requested `planets` subset." } },
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
        NatalInput: {
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
                planets: {
                  type: "array",
                  items: { type: "string" },
                  description: "Optional subset of planets to compute",
                },
                rulership: { $ref: "#/components/schemas/RulershipConvention" },
              },
            },
          ],
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
            natal: { $ref: "#/components/schemas/NatalInput" },
            transit_datetime: { type: "string", example: "2026-05-15T12:00:00" },
            transit_timezone: { type: "string", example: "UTC" },
            planets: { type: "array", items: { type: "string" } },
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
            natal: { $ref: "#/components/schemas/NatalInput" },
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
            natal: { $ref: "#/components/schemas/NatalInput" },
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
      },
    },
  };
}

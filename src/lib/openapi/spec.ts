// OpenAPI 3.1 specification for the public Astro Calculator API.
// Hand-authored (not derived from Zod) for control over docs and examples.

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
      version: "0.1.0",
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
            "200": { description: "Natal chart with planets, houses, aspects" },
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
              },
            },
          ],
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
              },
            },
          ],
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

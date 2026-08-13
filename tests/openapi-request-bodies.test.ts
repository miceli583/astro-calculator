// The published OpenAPI spec is hand-authored (see the header of
// src/lib/openapi/spec.ts), which is deliberate — it buys prose and examples a
// generator can't produce — but it means nothing structural stops a documented
// request body from drifting away from the Zod schema the route actually
// validates against. It had: five of the sixteen POST endpoints advertised a
// body their handler would have rejected, and /api/v1/sky/events documented no
// body at all despite requiring two fields.
//
// This test is the missing link. It doesn't reimplement Zod-to-OpenAPI; it
// checks the one property that matters to a consumer reading /docs — the
// documented field names and which of them are required — for every POST path
// and every nested object inside it.

import { describe, it, expect } from "vitest";
import { z, ZodObject, type ZodTypeAny } from "zod";
import { buildOpenAPISpec } from "@/lib/openapi/spec";
import {
  astrocartoInputSchema,
  compositeInputSchema,
  dateOnlySchema,
  geocodeInputSchema,
  natalInputSchema,
  planetaryReturnInputSchema,
  progressedInputSchema,
  skyEventsInputSchema,
  solarReturnInputSchema,
  synastryInputSchema,
  transitEventsInputSchema,
  transitInputSchema,
  transitSkyInputSchema,
  transitToNatalInputSchema,
  humanDesignInputSchema,
  geneKeysInputSchema,
} from "@/lib/validation/schemas";

const spec = buildOpenAPISpec("https://example.test");
const components = spec.components.schemas as Record<string, JsonSchema>;

type JsonSchema = {
  $ref?: string;
  allOf?: JsonSchema[];
  type?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
};

/** Every POST endpoint, paired with the schema its handler actually parses. */
const CONTRACTS: Record<string, ZodObject<z.ZodRawShape>> = {
  "/api/v1/astrology/natal": natalInputSchema,
  "/api/v1/astrology/transits": transitInputSchema,
  "/api/v1/transit": transitSkyInputSchema,
  "/api/v1/transit/natal": transitToNatalInputSchema,
  "/api/v1/transit/events": transitEventsInputSchema,
  "/api/v1/sky/events": skyEventsInputSchema,
  "/api/v1/synastry": synastryInputSchema,
  "/api/v1/composite": compositeInputSchema,
  "/api/v1/astrology/progressions": progressedInputSchema,
  "/api/v1/astrology/solar-return": solarReturnInputSchema,
  "/api/v1/astrology/planetary-return": planetaryReturnInputSchema,
  "/api/v1/astrocartography": astrocartoInputSchema,
  "/api/v1/human-design/chart": humanDesignInputSchema,
  "/api/v1/gene-keys/profile": geneKeysInputSchema,
  "/api/v1/life-path": dateOnlySchema,
  "/api/v1/destiny-card": dateOnlySchema,
  "/api/v1/geocode": geocodeInputSchema,
};

/**
 * Flatten a spec schema to the field names and required names a consumer would
 * see, following `$ref` and merging `allOf` the way a spec reader does.
 */
function flatten(schema: JsonSchema, seen = new Set<string>()): { props: Set<string>; required: Set<string> } {
  if (schema.$ref) {
    const name = schema.$ref.replace("#/components/schemas/", "");
    // Guards a self-referential spec from hanging the suite rather than failing it.
    expect(seen.has(name), `circular $ref through ${name}`).toBe(false);
    expect(components[name], `dangling $ref: ${schema.$ref}`).toBeDefined();
    return flatten(components[name], new Set(seen).add(name));
  }
  const props = new Set(Object.keys(schema.properties ?? {}));
  const required = new Set(schema.required ?? []);
  for (const part of schema.allOf ?? []) {
    const flat = flatten(part, seen);
    flat.props.forEach((p) => props.add(p));
    flat.required.forEach((r) => required.add(r));
  }
  return { props, required };
}

/** Resolve a spec schema to its merged `properties` map, refs and allOf included. */
function propertyMap(schema: JsonSchema): Record<string, JsonSchema> {
  if (schema.$ref) {
    return propertyMap(components[schema.$ref.replace("#/components/schemas/", "")]);
  }
  const merged: Record<string, JsonSchema> = { ...(schema.properties ?? {}) };
  for (const part of schema.allOf ?? []) Object.assign(merged, propertyMap(part));
  return merged;
}

/** Strip Optional/Nullable/Default wrappers down to the schema they carry. */
function unwrap(schema: ZodTypeAny): ZodTypeAny {
  let current = schema;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  while ((current as any)._def?.innerType) current = (current as any)._def.innerType;
  return current;
}

function zodFields(schema: ZodObject<z.ZodRawShape>) {
  const shape = schema.shape;
  const props = new Set(Object.keys(shape));
  const required = new Set(Object.keys(shape).filter((k) => !shape[k].isOptional()));
  return { props, required, shape };
}

/** Compare one object level, then descend into every nested object field. */
function assertMatches(where: string, documented: JsonSchema, actual: ZodObject<z.ZodRawShape>) {
  const doc = flatten(documented);
  const zod = zodFields(actual);

  expect([...doc.props].sort(), `${where}: documented fields`).toEqual([...zod.props].sort());
  expect([...doc.required].sort(), `${where}: required fields`).toEqual([...zod.required].sort());

  const docProps = propertyMap(documented);
  for (const [key, field] of Object.entries(zod.shape)) {
    const inner = unwrap(field);
    if (inner instanceof ZodObject) {
      assertMatches(`${where}.${key}`, docProps[key], inner as ZodObject<z.ZodRawShape>);
    }
  }
}

describe("OpenAPI request bodies match the schemas the routes validate against", () => {
  const paths = spec.paths as Record<string, Record<string, { requestBody?: JsonSchema }>>;

  it("covers every POST path in the spec", () => {
    const posted = Object.keys(paths).filter((p) => paths[p].post);
    expect(posted.sort()).toEqual(Object.keys(CONTRACTS).sort());
  });

  it("every POST endpoint documents a required request body", () => {
    for (const path of Object.keys(CONTRACTS)) {
      const body = paths[path]?.post?.requestBody as
        | { required?: boolean; content?: Record<string, { schema: JsonSchema }> }
        | undefined;
      // /api/v1/sky/events shipped with this key missing outright, so Swagger UI
      // offered no body field at all for an endpoint that requires two.
      expect(body, `${path} has no requestBody`).toBeDefined();
      expect(body!.required, `${path} requestBody not marked required`).toBe(true);
      expect(body!.content?.["application/json"]?.schema, `${path} has no JSON schema`).toBeDefined();
    }
  });

  for (const [path, schema] of Object.entries(CONTRACTS)) {
    it(`${path} documents the fields its handler accepts`, () => {
      const documented = (
        paths[path].post.requestBody as { content: Record<string, { schema: JsonSchema }> }
      ).content["application/json"].schema;
      assertMatches(path, documented, schema);
    });
  }
});

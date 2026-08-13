// Guards the API version against drifting away from package.json.
//
// This has now happened twice. The health endpoint read
// `env.npm_package_version`, which npm sets only for processes it spawns, so on
// Vercel it fell through to a hardcoded fallback (fixed in f78f231). The OpenAPI
// spec carried a literal "0.1.0" that nobody updated across the 0.2.0 and 0.3.0
// releases, so `/docs` advertised a version that had not existed for two
// releases (t_12980284). Both surfaces now import `API_VERSION` from
// `src/lib/version.ts`.
//
// The last test here is the one that stops a third recurrence: it reads the
// source of every file that reports a version and fails if a semver literal
// reappears in it. Equality tests alone would not catch a NEW surface that
// hardcodes its own string.

import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import pkg from "../package.json";
import { API_VERSION } from "../src/lib/version";
import { buildOpenAPISpec } from "../src/lib/openapi/spec";
import { GET as healthGET } from "../src/app/api/health/route";

const ROOT = resolve(__dirname, "..");

/** Every file that reports a version to a caller. Add to this list, not around it. */
const VERSION_REPORTING_SOURCES = [
  "src/lib/version.ts",
  "src/lib/openapi/spec.ts",
  "src/app/api/health/route.ts",
];

describe("API version has a single source of truth", () => {
  it("package.json carries a real semver", () => {
    // Non-vacuousness: the equality tests below are worthless if this is empty
    // or undefined, since two undefineds compare equal.
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+(-[\w.]+)?$/);
  });

  it("API_VERSION is package.json's version", () => {
    expect(API_VERSION).toBe(pkg.version);
  });

  it("the OpenAPI info block reports it", () => {
    const spec = buildOpenAPISpec("https://example.test");
    expect(spec.info.version).toBe(pkg.version);
  });

  it("the health endpoint reports it", async () => {
    const body = await healthGET().json();
    expect(body.version).toBe(pkg.version);
  });

  it("the two public surfaces agree with each other", async () => {
    // The failure mode is drift between them, not just drift from package.json,
    // so assert the relation directly rather than inferring it transitively.
    const health = await healthGET().json();
    const spec = buildOpenAPISpec("https://example.test");
    expect(health.version).toBe(spec.info.version);
  });

  it("the value does not come from npm_package_version", async () => {
    // npm sets npm_package_version only for processes it spawns. It IS set when
    // this suite runs under `npm test`, and it is NOT set in the Vercel runtime
    // — so an implementation reading it passes locally and ships a stale
    // fallback. That is exactly what f78f231 fixed, and a mutation reinstating
    // that shape passed all the other tests here before this one existed.
    //
    // Poison the variable and re-import: if the module reads the environment at
    // load, it now returns the poison instead of package.json's version.
    const prev = process.env.npm_package_version;
    process.env.npm_package_version = "9.9.9-poison";
    vi.resetModules();
    try {
      const fresh = await import("../src/lib/version");
      expect(fresh.API_VERSION).toBe(pkg.version);
    } finally {
      if (prev === undefined) delete process.env.npm_package_version;
      else process.env.npm_package_version = prev;
      vi.resetModules();
    }
  });

  it("no version-reporting source hardcodes a semver", () => {
    for (const rel of VERSION_REPORTING_SOURCES) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      // Strip comments and the OpenAPI *format* version, which is correctly a
      // literal, then reject any remaining semver string — in a field, a
      // fallback (`?? "0.1.0"`), or anywhere else. The narrower `version:`-only
      // regex this replaced missed the fallback shape.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^\s*\/\/.*$/gm, "")
        .replace(/\bopenapi:\s*"\d+\.\d+\.\d+"/g, "");
      const hardcoded = code.match(/"\d+\.\d+\.\d+[^"]*"/);
      expect(hardcoded, `${rel} hardcodes a version literal`).toBeNull();
    }
  });
});

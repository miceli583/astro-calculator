// Thin wrapper around the `sweph` native module (Swiss Ephemeris bindings).
// Centralizes initialization, path config, and typed access patterns so
// calculators don't need to know about flag bitmasks.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { env } from "@/env.js";
import { parseLocalISO, toUTC, type ParsedDateTime } from "./julian-day";

const require = createRequire(import.meta.url);

// sweph is a native CommonJS module; require lazily to keep tooling happy.
type SwephModule = typeof import("sweph");
let _swe: SwephModule | null = null;
let _ephePath: string | null = null;

/**
 * Resolve the Swiss Ephemeris data directory.
 *
 * In dev/local, `./ephemeris/` relative to the project root is always present.
 * On Vercel, `process.cwd()` is `/var/task` and the directory is bundled in
 * via `outputFileTracingIncludes` — but historically that ends up either at
 * `/var/task/ephemeris` or nested under `/var/task/.next/server`, depending
 * on the build. We try every plausible location and fail loudly if none hit.
 */
function findEphemerisPath(): string {
  if (_ephePath) return _ephePath;

  const envPath = env.EPHEMERIS_PATH;
  const thisFileDir = (() => {
    try { return dirname(fileURLToPath(import.meta.url)); }
    catch { return null; }
  })();

  const candidates = [
    envPath,
    resolve(process.cwd(), "ephemeris"),
    "/var/task/ephemeris",
    thisFileDir && resolve(thisFileDir, "../../../ephemeris"),
    thisFileDir && resolve(thisFileDir, "../../../../ephemeris"),
    thisFileDir && resolve(thisFileDir, "../../../../../ephemeris"),
    resolve(process.cwd(), ".next/server/ephemeris"),
    resolve(process.cwd(), ".next/standalone/ephemeris"),
  ].filter((p): p is string => Boolean(p));

  for (const c of candidates) {
    if (existsSync(c)) {
      _ephePath = c;
      return c;
    }
  }

  throw new Error(
    `Swiss Ephemeris data directory not found. cwd=${process.cwd()} ` +
      `tried: ${candidates.join(" | ")}`
  );
}

function getSwe(): SwephModule {
  if (_swe) return _swe;
  const path = findEphemerisPath();
  _swe = require("sweph") as SwephModule;
  _swe.set_ephe_path(path);
  return _swe;
}

// Standard flags. SWIEPH = use Swiss Ephemeris files. SPEED = compute daily motion.
const SE_FLAGS = 2 | 256;

export const PLANETS = {
  sun: 0,
  moon: 1,
  mercury: 2,
  venus: 3,
  mars: 4,
  jupiter: 5,
  saturn: 6,
  uranus: 7,
  neptune: 8,
  pluto: 9,
  mean_node: 10,
  true_node: 11,
  mean_lilith: 12, // Black Moon Lilith — Mean lunar apogee (most common)
  osc_lilith: 13,  // Black Moon Lilith — Osculating apogee (less common)
  chiron: 15,
  ceres: 17,
  pallas: 18,
  juno: 19,
  vesta: 20,
} as const;

export type PlanetName = keyof typeof PLANETS;

// House system codes accepted by sweph's `houses_ex`.
export const HOUSE_SYSTEMS = {
  placidus: "P",
  koch: "K",
  porphyrius: "O",
  regiomontanus: "R",
  campanus: "C",
  equal: "E",
  whole_sign: "W",
} as const;

export type HouseSystem = keyof typeof HOUSE_SYSTEMS;

export interface PlanetPosition {
  longitude: number; // ecliptic longitude in degrees, 0–360
  latitude: number; // ecliptic latitude in degrees
  distance: number; // AU
  longitudeSpeed: number; // deg/day; negative => retrograde
  latitudeSpeed: number;
  distanceSpeed: number;
}

export interface HousesResult {
  cusps: number[]; // length 12, each value 0–360°
  ascendant: number;
  midheaven: number;
  armc: number; // sidereal time (degrees)
  vertex: number;
  equatorialAscendant: number;
}

// Convert ISO local datetime + IANA timezone to a UT Julian Day.
export function julianDayUT(localIso: string, timeZone: string): number {
  const local = parseLocalISO(localIso);
  const utc = toUTC(local, timeZone);
  const swe = getSwe();
  const result = swe.utc_to_jd(
    utc.year,
    utc.month,
    utc.day,
    utc.hour,
    utc.minute,
    utc.second,
    swe.constants.SE_GREG_CAL
  );
  // sweph returns { data: [jd_et, jd_ut], ... }
  // We use UT for chart calculations.
  return result.data[1];
}

export function calcPlanet(jdUt: number, planet: PlanetName): PlanetPosition {
  const swe = getSwe();
  const id = PLANETS[planet];
  const out = swe.calc_ut(jdUt, id, SE_FLAGS);
  if ("error" in out && out.error) {
    throw new Error(`Ephemeris error for ${planet}: ${out.error}`);
  }
  const [longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed] = out.data;
  return { longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed };
}

export function calcAllPlanets(jdUt: number, planets: readonly PlanetName[]): Record<string, PlanetPosition> {
  const out: Record<string, PlanetPosition> = {};
  for (const p of planets) out[p] = calcPlanet(jdUt, p);
  return out;
}

export function calcHouses(
  jdUt: number,
  latitude: number,
  longitude: number,
  system: HouseSystem
): HousesResult {
  const swe = getSwe();
  const code = HOUSE_SYSTEMS[system];
  const result = swe.houses_ex(jdUt, 0, latitude, longitude, code);
  // sweph result.data = { houses: [12 cusps], points: [asc, mc, armc, vertex, eqasc, ...] }
  const cusps = result.data.houses;
  const points = result.data.points;
  return {
    cusps,
    ascendant: points[0],
    midheaven: points[1],
    armc: points[2],
    vertex: points[3],
    equatorialAscendant: points[4],
  };
}

// Equatorial coordinates (right ascension, declination) — needed for astrocartography.
// Flag 2048 (SEFLG_EQUATORIAL) tells sweph to return RA/Dec instead of ecliptic.
const SE_FLAG_EQ = 2 | 256 | 2048;

export interface EquatorialPosition {
  rightAscension: number; // degrees, 0–360
  declination: number; // degrees, -90 to +90
  distance: number;
}

export function calcPlanetEquatorial(jdUt: number, planet: PlanetName): EquatorialPosition {
  const swe = getSwe();
  const id = PLANETS[planet];
  const out = swe.calc_ut(jdUt, id, SE_FLAG_EQ);
  if ("error" in out && out.error) {
    throw new Error(`Ephemeris equatorial error for ${planet}: ${out.error}`);
  }
  const [rightAscension, declination, distance] = out.data;
  return { rightAscension, declination, distance };
}

// Greenwich sidereal time at JD-UT, in degrees.
export function greenwichSiderealTimeDeg(jdUt: number): number {
  const swe = getSwe();
  return swe.sidtime(jdUt) * 15; // sidtime() returns hours
}

export type ParsedDateTimeUtc = ParsedDateTime;

// Re-export for convenience
export { parseLocalISO, toUTC };

// Thin wrapper around the `sweph` native module (Swiss Ephemeris bindings).
// Centralizes initialization, path config, and typed access patterns so
// calculators don't need to know about flag bitmasks.

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { env } from "@/env.js";
import {
  parseLocalISO,
  toUTC,
  toUTCResolved,
  type LocalTimeKind,
  type ParsedDateTime,
} from "./julian-day";

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

/**
 * Which ephemeris actually produced a position.
 *
 * This is reported rather than assumed. This deployment ships only the
 * 1800–2399 Swiss Ephemeris data files, so below 1800 sweph falls back to its
 * built-in Moshier analytic theory — a real answer, at roughly arcsecond
 * accuracy rather than milliarcsecond. That fallback is legitimate, but it must
 * not be silent: a caller comparing a 1750 chart against a Swiss-grade one is
 * entitled to know which one they got. See finding F1 (`docs/accuracy.md` §6).
 */
export type EphemerisSource = "swiss" | "moshier" | "jpl";

const SEFLG_JPLEPH = 1;
const SEFLG_SWIEPH = 2;
const SEFLG_MOSEPH = 4;

/** Read the ephemeris actually used out of sweph's returned flag bits. */
export function ephemerisSourceFromFlag(flag: number): EphemerisSource {
  if (flag & SEFLG_MOSEPH) return "moshier";
  if (flag & SEFLG_JPLEPH) return "jpl";
  if (flag & SEFLG_SWIEPH) return "swiss";
  // sweph always sets one of the three on success; reaching here means the
  // caller passed us a failure flag, which is the caller's bug, not a default
  // worth guessing at.
  throw new Error(`No ephemeris bit set in sweph flag ${flag}`);
}

export interface PlanetPosition {
  longitude: number; // ecliptic longitude in degrees, 0–360
  latitude: number; // ecliptic latitude in degrees
  distance: number; // AU
  longitudeSpeed: number; // deg/day; negative => retrograde
  latitudeSpeed: number;
  distanceSpeed: number;
  /** Which ephemeris answered for THIS body at THIS instant. */
  ephemeris: EphemerisSource;
}

/** A body sweph genuinely could not compute, with the reason it gave. */
export interface UnavailableBody {
  name: PlanetName;
  reason: string;
}

export interface PlanetPositions {
  positions: Record<string, PlanetPosition>;
  /**
   * Bodies sweph refused outright (`flag < 0`). Empty for every ordinary
   * chart. Non-empty mainly for Chiron before 1800, which has no ephemeris at
   * all — not a fallback case, an absence (finding F2).
   */
  unavailable: UnavailableBody[];
}

export interface HousesResult {
  cusps: number[]; // length 12, each value 0–360°
  ascendant: number;
  midheaven: number;
  armc: number; // sidereal time (degrees)
  vertex: number;
  equatorialAscendant: number;
  /**
   * The house system that actually produced `cusps` — not necessarily the one
   * requested. Inside the polar circles Placidus and Koch are undefined, and
   * sweph substitutes Porphyry rather than failing, signalling the swap through
   * `flag < 0`. That flag used to be discarded, so a caller asking for Placidus
   * at Tromsø received Porphyry cusps under the name `placidus`. See finding F5
   * (`docs/chart-conventions.md` §7).
   */
  system: HouseSystem;
  /** What the caller asked for. Differs from `system` only on a substitution. */
  requestedSystem: HouseSystem;
}

/**
 * Systems sweph refuses inside the polar circles, and what it silently
 * substitutes. The substitution is asserted against an explicit `porphyrius`
 * request in `tests/polar-houses.test.ts` rather than trusted here, so a change
 * in sweph's behaviour fails CI instead of quietly relabelling cusps again.
 */
const POLAR_SUBSTITUTE: HouseSystem = "porphyrius";

function resolveHouseSystem(requested: HouseSystem, flag: number): HouseSystem {
  return flag < 0 ? POLAR_SUBSTITUTE : requested;
}

/**
 * Convert ISO local datetime + IANA timezone to a UT Julian Day, also reporting
 * how the wall clock mapped onto the timeline. `kind` is "unique" for every
 * ordinary birth time; "gap" and "ambiguous" mean the local reading does not
 * identify a single instant and a convention was applied to pick one. Callers
 * with a warnings channel should surface those two — the resulting chart is
 * defensible but not uniquely determined by the input.
 */
export function julianDayUTResolved(
  localIso: string,
  timeZone: string
): { jd: number; utc: ParsedDateTime; offsetMinutes: number; kind: LocalTimeKind } {
  const local = parseLocalISO(localIso);
  const { utc, offsetMinutes, kind } = toUTCResolved(local, timeZone);
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
  return { jd: result.data[1], utc, offsetMinutes, kind };
}

// Convert ISO local datetime + IANA timezone to a UT Julian Day.
export function julianDayUT(localIso: string, timeZone: string): number {
  return julianDayUTResolved(localIso, timeZone).jd;
}

/**
 * Compute one body, or report that sweph refused it.
 *
 * **Failure is signalled by `flag < 0`, not by a non-empty error string.**
 * sweph uses that same string for WARNINGS — "SwissEph file 'sepl_12.se1' not
 * found ... using Moshier eph." arrives alongside a perfectly good position and
 * a positive flag. Gating on the string is why every pre-1800 birth used to
 * return a 500 (finding F1).
 */
export function tryCalcPlanet(
  jdUt: number,
  planet: PlanetName
): { ok: true; position: PlanetPosition } | { ok: false; reason: string } {
  const swe = getSwe();
  const id = PLANETS[planet];
  const out = swe.calc_ut(jdUt, id, SE_FLAGS);
  if (out.flag < 0) {
    return { ok: false, reason: normalizeSwephMessage(out.error) || `sweph flag ${out.flag}` };
  }
  const [longitude, latitude, distance, longitudeSpeed, latitudeSpeed, distanceSpeed] = out.data;
  return {
    ok: true,
    position: {
      longitude,
      latitude,
      distance,
      longitudeSpeed,
      latitudeSpeed,
      distanceSpeed,
      ephemeris: ephemerisSourceFromFlag(out.flag),
    },
  };
}

/** sweph messages carry embedded newlines and a trailing "; " — tidy for prose. */
function normalizeSwephMessage(msg: string | undefined): string {
  return (msg ?? "").replace(/\s+/g, " ").replace(/;\s*$/, "").trim();
}

/** Compute one body, throwing if sweph refuses it. */
export function calcPlanet(jdUt: number, planet: PlanetName): PlanetPosition {
  const r = tryCalcPlanet(jdUt, planet);
  if (!r.ok) throw new Error(`Ephemeris error for ${planet}: ${r.reason}`);
  return r.position;
}

/**
 * Compute a set of bodies, separating the ones sweph refused from the ones it
 * answered. Callers that need every body should check `unavailable`; callers
 * building a chart should report the gap rather than fail the whole chart.
 */
export function calcAllPlanets(
  jdUt: number,
  planets: readonly PlanetName[]
): PlanetPositions {
  const positions: Record<string, PlanetPosition> = {};
  const unavailable: UnavailableBody[] = [];
  for (const p of planets) {
    const r = tryCalcPlanet(jdUt, p);
    if (r.ok) positions[p] = r.position;
    else unavailable.push({ name: p, reason: r.reason });
  }
  return { positions, unavailable };
}

/**
 * The single ephemeris that answered for a whole set of positions, or `"mixed"`
 * if they disagree. In practice a chart is uniformly one source, because the
 * data-file boundary is a function of the instant, not of the body.
 */
export function summarizeEphemeris(
  positions: Record<string, PlanetPosition>
): EphemerisSource | "mixed" | null {
  const seen = new Set<EphemerisSource>();
  for (const p of Object.values(positions)) seen.add(p.ephemeris);
  if (seen.size === 0) return null;
  if (seen.size > 1) return "mixed";
  return [...seen][0];
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
    system: resolveHouseSystem(system, result.flag),
    requestedSystem: system,
  };
}

/** True obliquity of the ecliptic in degrees at a UT Julian Day. */
export function obliquity(jdUt: number): number {
  const swe = getSwe();
  const out = swe.calc_ut(jdUt, swe.constants.SE_ECL_NUT, SE_FLAGS);
  // flag < 0 is failure; a non-empty message alongside a positive flag is a
  // warning about which ephemeris answered, not an error (F1).
  if (out.flag < 0) {
    throw new Error(`Ephemeris error for obliquity: ${normalizeSwephMessage(out.error)}`);
  }
  return out.data[0];
}

/**
 * House cusps computed from an ARMC (right ascension of the MC, in degrees)
 * rather than from a moment + place. This is how composite-chart house wheels
 * are cast: the composite MC fixes the ARMC, and the cusps follow for a
 * reference latitude. Same return shape as `calcHouses`.
 */
export function calcHousesFromArmc(
  armc: number,
  latitude: number,
  eps: number,
  system: HouseSystem
): HousesResult {
  const swe = getSwe();
  const code = HOUSE_SYSTEMS[system];
  const result = swe.houses_armc(armc, latitude, eps, code);
  const cusps = result.data.houses;
  const points = result.data.points;
  return {
    cusps,
    ascendant: points[0],
    midheaven: points[1],
    armc: points[2],
    vertex: points[3],
    equatorialAscendant: points[4],
    system: resolveHouseSystem(system, result.flag),
    requestedSystem: system,
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
  if (out.flag < 0) {
    throw new Error(`Ephemeris equatorial error for ${planet}: ${normalizeSwephMessage(out.error)}`);
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
export type { LocalTimeKind };

// Re-export for convenience
export { parseLocalISO, toUTC, toUTCResolved };

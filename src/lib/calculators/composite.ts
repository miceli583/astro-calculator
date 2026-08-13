// Composite (midpoint) chart calculator.
//
// A composite chart is a single synthesized chart built from the midpoints of
// several people's natal positions — the chart "of the relationship" rather
// than of any one person. Supports 2 up to 10 input charts: for two charts
// the circular mean of a planet pair is exactly the classic shorter-arc
// composite midpoint; for larger groups it generalizes to the circular mean
// of all N positions.
//
// House wheel: the standard "derived from composite MC" method (as used by
// Astrodienst). The composite MC (circular mean of the natal MCs) fixes the
// ARMC via the obliquity of the ecliptic; cusps and angles then follow from
// `houses_armc` at a reference latitude (mean of the birth latitudes). This
// always yields a coherent, monotonic wheel — averaging cusps directly does
// not.
//
// Composite points don't move, so speed/retrograde are meaningless and every
// derived speed is 0.

import {
  calcHousesFromArmc,
  obliquity,
  type HouseSystem,
} from "../ephemeris/client";
import type { BirthData } from "../types/birth-data";
import {
  calculateNatalChart,
  computeAspects,
  computeChartRuler,
  computePartOfFortune,
  longitudeToSign,
  patternPointsFromPlanets,
  type Aspect,
  type ChartRuler,
  type NatalChart,
  type NatalPlanet,
  type SignPosition,
} from "./astrology";
import { detectAspectPatterns, type AspectPattern } from "./aspect-patterns";
import type { RulershipConvention } from "../constants/rulerships";
import { houseFor } from "./overlay";

/** Max charts in one composite. */
export const MAX_COMPOSITE_CHARTS = 10;

export interface CompositeInput {
  /** 2–10 birth charts (validated at the API boundary). */
  charts: (BirthData & { house_system?: HouseSystem })[];
  /** House system for the composite wheel. Default placidus. */
  house_system?: HouseSystem;
  /**
   * Latitude to cast the composite house wheel for (e.g. where the couple
   * lives, as Astro.com's reference-place option). Defaults to the
   * arithmetic mean of the birth latitudes (Astrodienst method).
   */
  reference_latitude?: number;
  /** Rulership convention for the composite chart ruler. Default "modern". */
  rulership?: RulershipConvention;
}

export interface CompositePoint {
  name: NatalPlanet["name"];
  longitude: number;
  latitude: number;
  sign: SignPosition;
  house: number;
  /** True if the midpoint was directionally degenerate (see `circularMidpoint`). */
  degenerate: boolean;
}

export interface CompositeChart {
  chartCount: number;
  /** Arithmetic mean of the input charts' Julian Days (UT). */
  jd_ut_mean: number;
  /** Latitude the composite house wheel is cast for. */
  referenceLatitude: number;
  /** Whether `referenceLatitude` came from the request or the mean-birth-latitude default. */
  referenceLatitudeSource: "mean_birth_latitude" | "explicit";
  planets: CompositePoint[];
  houses: {
    system: HouseSystem;
    /** House-wheel construction method (see module docs). */
    method: "derived-from-composite-mc";
    cusps: { house: number; longitude: number; sign: SignPosition }[];
    ascendant: { longitude: number; sign: SignPosition };
    midheaven: { longitude: number; sign: SignPosition };
    vertex: { longitude: number; sign: SignPosition };
  };
  /**
   * Composite Part of Fortune. Sect is taken from the composite Sun's position
   * relative to the composite horizon, so it does not vary with the requested
   * house system (F7). **Optional** — omitted when either luminary is absent
   * from the requested `planets` subset (F8).
   */
  partOfFortune?: {
    longitude: number;
    sign: SignPosition;
    house: number;
    isDayBirth: boolean;
  };
  aspects: Aspect[];
  /** Aspect patterns among the composite points (South Node excluded). */
  patterns: AspectPattern[];
  /** Ruler of the composite Ascendant sign, its placement and aspects. */
  chartRuler: ChartRuler;
  warnings: string[];
}

/**
 * Circular mean of a set of ecliptic longitudes (degrees).
 *
 * For two positions this is the midpoint of the shorter arc between them —
 * the classic composite midpoint. For N positions it is the direction of the
 * mean unit vector.
 *
 * Degenerate case: when the vectors cancel (e.g. two antipodal points, or
 * three points 120° apart) no direction is meaningful. We then fall back to
 * the normalized arithmetic mean of the normalized longitudes — deterministic
 * and stable, but flagged so callers can surface a warning.
 */
export function circularMidpoint(longitudes: number[]): {
  longitude: number;
  degenerate: boolean;
} {
  if (longitudes.length === 0) throw new Error("circularMidpoint needs at least one longitude");
  let x = 0;
  let y = 0;
  for (const lon of longitudes) {
    const rad = (lon * Math.PI) / 180;
    x += Math.cos(rad);
    y += Math.sin(rad);
  }
  const magnitude = Math.hypot(x, y) / longitudes.length;
  if (magnitude < 1e-9) {
    const norm = longitudes.map((l) => ((l % 360) + 360) % 360);
    const fallback = norm.reduce((a, b) => a + b, 0) / norm.length;
    return { longitude: ((fallback % 360) + 360) % 360, degenerate: true };
  }
  const mean = (Math.atan2(y, x) * 180) / Math.PI;
  return { longitude: ((mean % 360) + 360) % 360, degenerate: false };
}

/** ARMC (right ascension of the MC, degrees) for an ecliptic MC longitude. */
function armcFromMc(mcLongitude: number, eps: number): number {
  const lam = (mcLongitude * Math.PI) / 180;
  const epsRad = (eps * Math.PI) / 180;
  const armc = (Math.atan2(Math.sin(lam) * Math.cos(epsRad), Math.cos(lam)) * 180) / Math.PI;
  return ((armc % 360) + 360) % 360;
}

/**
 * Compute a composite (midpoint) chart from 2–10 birth charts.
 *
 * Each input chart is computed as a full natal chart; each composite planet
 * is the circular mean of that planet's positions across all charts. The
 * house wheel is derived from the composite MC (see module docs).
 */
export function calculateComposite(input: CompositeInput): CompositeChart {
  const count = input.charts.length;
  if (count < 2) throw new Error("A composite chart needs at least 2 charts");
  if (count > MAX_COMPOSITE_CHARTS) {
    throw new Error(`A composite chart supports at most ${MAX_COMPOSITE_CHARTS} charts (got ${count})`);
  }
  const houseSystem = input.house_system ?? "placidus";

  const charts: NatalChart[] = input.charts.map((c) =>
    calculateNatalChart({
      datetime: c.datetime,
      timezone: c.timezone,
      latitude: c.latitude,
      longitude: c.longitude,
    })
  );

  const warnings: string[] = [];
  const jdMean = charts.reduce((a, c) => a + c.jd_ut, 0) / count;
  const referenceLatitude =
    input.reference_latitude ??
    input.charts.reduce((a, c) => a + c.latitude, 0) / count;
  const referenceLatitudeSource =
    input.reference_latitude != null ? "explicit" as const : "mean_birth_latitude" as const;

  // ── House wheel: composite MC → ARMC → cusps at the reference latitude ──
  const mcMid = circularMidpoint(charts.map((c) => c.houses.midheaven.longitude));
  if (mcMid.degenerate) {
    warnings.push(
      "Composite MC is directionally degenerate (natal MCs cancel out); " +
        "fell back to the arithmetic mean. House placements may be unreliable."
    );
  }
  const eps = obliquity(jdMean);
  const armc = armcFromMc(mcMid.longitude, eps);
  const houses = calcHousesFromArmc(armc, referenceLatitude, eps, houseSystem);
  const cusps = houses.cusps;

  if (Math.abs(referenceLatitude) >= 66.5 && ["placidus", "koch", "regiomontanus", "campanus"].includes(houseSystem)) {
    warnings.push(
      `Reference latitude ${referenceLatitude.toFixed(2)}° is at or beyond the polar circle; ` +
        `${houseSystem} composite cusps may be unreliable. Consider whole_sign or equal.`
    );
  }

  // ── Composite planets: circular mean per shared point name ──────────────
  // All charts are computed with the default planet list, so every chart has
  // the same point set; intersect defensively anyway.
  const names = charts[0].planets
    .map((p) => p.name)
    .filter((name) => charts.every((c) => c.planets.some((p) => p.name === name)));

  const planets: CompositePoint[] = names.map((name) => {
    const members = charts.map((c) => c.planets.find((p) => p.name === name)!);
    const mid = circularMidpoint(members.map((m) => m.longitude));
    if (mid.degenerate) {
      warnings.push(
        `Composite ${name} is directionally degenerate (positions cancel out); ` +
          "fell back to the arithmetic mean."
      );
    }
    const latitude = members.reduce((a, m) => a + m.latitude, 0) / count;
    return {
      name,
      longitude: mid.longitude,
      latitude,
      sign: longitudeToSign(mid.longitude),
      house: houseFor(mid.longitude, cusps),
      degenerate: mid.degenerate,
    };
  });

  // ── Part of Fortune from composite ASC/Sun/Moon (same rule as natal) ────
  // Shares the natal implementation so the two cannot drift: sect from the
  // horizon (F7), field omitted rather than fabricated when a luminary is
  // missing from the requested subset (F8).
  const sun = planets.find((p) => p.name === "sun");
  const moon = planets.find((p) => p.name === "moon");
  const partOfFortune =
    sun && moon
      ? computePartOfFortune(houses.ascendant, sun.longitude, moon.longitude, cusps)
      : undefined;

  // ── Aspects within the composite chart (natal-scale orbs, speed 0) ──────
  const natalShaped: NatalPlanet[] = planets.map((p) => ({
    name: p.name,
    longitude: p.longitude,
    latitude: p.latitude,
    speed: 0,
    retrograde: false,
    sign: p.sign,
    house: p.house,
  }));

  const aspects = computeAspects(natalShaped);
  const ascendantSign = longitudeToSign(houses.ascendant).sign;

  return {
    chartCount: count,
    jd_ut_mean: jdMean,
    referenceLatitude,
    referenceLatitudeSource,
    planets,
    houses: {
      system: houseSystem,
      method: "derived-from-composite-mc",
      cusps: cusps.map((cusp, i) => ({
        house: i + 1,
        longitude: cusp,
        sign: longitudeToSign(cusp),
      })),
      ascendant: { longitude: houses.ascendant, sign: longitudeToSign(houses.ascendant) },
      midheaven: { longitude: houses.midheaven, sign: longitudeToSign(houses.midheaven) },
      vertex: { longitude: houses.vertex, sign: longitudeToSign(houses.vertex) },
    },
    // Spread rather than assign, so an omitted Part of Fortune leaves the key
    // genuinely ABSENT rather than present-and-undefined. JSON.stringify drops
    // undefined either way, but a JS consumer doing `"partOfFortune" in chart`
    // would otherwise see a field that is not there (F8).
    ...(partOfFortune ? { partOfFortune } : {}),
    aspects,
    patterns: detectAspectPatterns(patternPointsFromPlanets(natalShaped)),
    chartRuler: computeChartRuler(ascendantSign, natalShaped, aspects, input.rulership),
    warnings,
  };
}

// Transit event scanner: given a natal chart and a date range, find every
// window in which a transiting body is within orb of a natal aspect. Merges
// retrograde loops into single events with multiple exact-aspect peaks.

import { calcPlanet, julianDayUT, type PlanetName } from "../ephemeris/client";
import { calculateNatalChart, longitudeToSign, type NatalChart, type NatalInput } from "./astrology";
import {
  ASPECT_ANGLES,
  DEFAULT_TRANSIT_ORBS,
  angularDifference,
  buildNatalOverlayPoints,
  houseFor,
  type AspectType,
} from "./overlay";
import { MATRIX_NATAL_POINTS } from "../constants/transit-matrix";

/** Slow bodies whose transits produce multi-month/year themes. */
export const DEFAULT_EVENT_TRANSIT_PLANETS: readonly PlanetName[] = [
  "jupiter",
  "saturn",
  "chiron",
  "uranus",
  "neptune",
  "pluto",
  "true_node",
];

/**
 * Natal points scanned by default: the full combination-matrix point space
 * (all modeled planets + South Node, four angles, Vertex, Part of Fortune).
 * Point-window extraction is cheap arithmetic over already-sampled planet
 * positions, so the full set adds little cost — and slow-planet contacts to
 * a chart's own outer planets are exactly the life-stage markers (Saturn
 * return, Uranus opposition, Chiron return, nodal returns).
 */
export const DEFAULT_EVENT_NATAL_POINTS: readonly string[] = MATRIX_NATAL_POINTS;

/** Max scan window — 20 years matches the spec cap. */
export const MAX_SCAN_YEARS = 20;

export interface TransitEventsInput {
  natal: NatalInput;
  start_date: string; // YYYY-MM-DD
  end_date: string;   // YYYY-MM-DD
  transit_planets?: PlanetName[];
  natal_points?: string[];
  aspects?: AspectType[];
  orbs?: Partial<Record<AspectType, number>>;
  /** Sampling resolution in days. Default 1 (daily). Coarser = faster + less accurate. */
  step_days?: number;
}

export interface TransitEvent {
  id: string;
  transitPlanet: string;
  natalPoint: string;
  aspect: AspectType;
  natalSign: string;
  natalHouse?: number;
  /** ISO date when transit first enters orb. */
  orbEnter: string;
  /** ISO date when transit finally exits orb (after retrograde loops, if any). */
  orbLeave: string;
  /** ISO datetimes when the aspect is exact (typically 1 for direct, 3 for retrograde loop). */
  peaks: string[];
  /** True if the aspect went exact more than once due to a retrograde. */
  isRetrogradeLoop: boolean;
}

export interface TransitEventsResult {
  natal_jd_ut: number;
  scannedDateRange: { start: string; end: string; days: number };
  events: TransitEvent[];
}

/**
 * Scan a date range for every transit aspect event to a natal chart.
 * Retrograde loops (planet crosses exact aspect, retrogrades back over it,
 * then completes the third pass) are merged into a single event with three
 * peak dates.
 */
export function calculateTransitEvents(input: TransitEventsInput): TransitEventsResult {
  const step = input.step_days ?? 1;
  const enabledAspects = input.aspects ?? (Object.keys(ASPECT_ANGLES) as AspectType[]);
  const orbs = { ...DEFAULT_TRANSIT_ORBS, ...input.orbs };
  const transitPlanets = input.transit_planets ?? DEFAULT_EVENT_TRANSIT_PLANETS;
  const natalPointNames = input.natal_points ?? DEFAULT_EVENT_NATAL_POINTS;

  const natalChart = calculateNatalChart(input.natal);
  const natalPoints = buildNatalPointList(natalChart).filter((p) =>
    natalPointNames.includes(p.name)
  );

  const startJd = dateStringToJd(input.start_date);
  const endJd = dateStringToJd(input.end_date);
  if (endJd <= startJd) {
    return {
      natal_jd_ut: natalChart.jd_ut,
      scannedDateRange: { start: input.start_date, end: input.end_date, days: 0 },
      events: [],
    };
  }
  const spanYears = (endJd - startJd) / 365.25;
  if (spanYears > MAX_SCAN_YEARS) {
    throw new Error(
      `Requested scan span ${spanYears.toFixed(1)} years exceeds max of ${MAX_SCAN_YEARS} years`
    );
  }

  const cusps = natalChart.houses.cusps.map((c) => c.longitude);
  const events: TransitEvent[] = [];

  for (const planet of transitPlanets) {
    // Sample longitude at step-day resolution across the range for this planet.
    const samples: Array<{ jd: number; lon: number; speed: number }> = [];
    for (let jd = startJd; jd <= endJd; jd += step) {
      const p = calcPlanet(jd, planet);
      samples.push({ jd, lon: p.longitude, speed: p.longitudeSpeed });
    }

    for (const natal of natalPoints) {
      for (const aspect of enabledAspects) {
        const target = ASPECT_ANGLES[aspect];
        const orbLimit = orbs[aspect];
        const rawEvents = extractWindows(
          samples,
          natal.longitude,
          target,
          orbLimit,
          planet
        );
        for (const raw of rawEvents) {
          const peaks = raw.peaks.map(jdToIsoDate);
          events.push({
            id: `${planet}-${natal.name}-${aspect}-${peaks[0]}`,
            transitPlanet: planet,
            natalPoint: natal.name,
            aspect,
            natalSign: longitudeToSign(natal.longitude).sign,
            natalHouse: houseFor(natal.longitude, cusps),
            orbEnter: jdToIsoDate(raw.enter),
            orbLeave: jdToIsoDate(raw.leave),
            peaks,
            isRetrogradeLoop: raw.peaks.length > 1,
          });
        }
      }
    }
  }

  events.sort((a, b) => a.orbEnter.localeCompare(b.orbEnter));

  return {
    natal_jd_ut: natalChart.jd_ut,
    scannedDateRange: {
      start: input.start_date,
      end: input.end_date,
      days: Math.round(endJd - startJd),
    },
    events,
  };
}

interface RawEventWindow {
  enter: number;
  leave: number;
  peaks: number[];
}

/**
 * Find contiguous "in-orb" windows for a given aspect and merge windows that
 * belong to the same retrograde loop (gap ≤ ~18 months and same natal point).
 */
function extractWindows(
  samples: Array<{ jd: number; lon: number; speed: number }>,
  natalLongitude: number,
  targetAngle: number,
  orbLimit: number,
  planet: PlanetName
): RawEventWindow[] {
  const inOrb = (lon: number) =>
    Math.abs(angularDifference(lon, natalLongitude) - targetAngle) <= orbLimit;

  const separationSigned = (lon: number) => {
    // Signed offset: how far past exact aspect the planet is, in [-180, 180],
    // consistent across samples so we can look for sign changes (exact passes).
    // Rotate longitude so exact aspect corresponds to natalLongitude + targetAngle.
    const exactLon = (natalLongitude + targetAngle) % 360;
    let diff = ((lon - exactLon + 540) % 360) - 180;
    // Also consider the "conjunction-opposite" target for non-conjunction aspects
    // since square/trine/sextile/quincunx have TWO exact positions.
    if (targetAngle !== 0 && targetAngle !== 180) {
      const altExact = (natalLongitude - targetAngle + 360) % 360;
      const alt = ((lon - altExact + 540) % 360) - 180;
      if (Math.abs(alt) < Math.abs(diff)) diff = alt;
    }
    return diff;
  };

  // Step 1: identify raw contiguous windows.
  const rawWindows: Array<{ startIdx: number; endIdx: number }> = [];
  let curStart = -1;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (inOrb(s.lon)) {
      if (curStart < 0) curStart = i;
    } else {
      if (curStart >= 0) {
        rawWindows.push({ startIdx: curStart, endIdx: i - 1 });
        curStart = -1;
      }
    }
  }
  if (curStart >= 0) rawWindows.push({ startIdx: curStart, endIdx: samples.length - 1 });

  // Step 2: merge retrograde-loop windows (gap ≤ retrograde period upper bound).
  const RETROGRADE_MERGE_DAYS: Partial<Record<PlanetName, number>> = {
    jupiter: 200,
    saturn: 300,
    chiron: 300,
    uranus: 300,
    neptune: 300,
    pluto: 300,
    true_node: 400,
  };
  const mergeGap = RETROGRADE_MERGE_DAYS[planet] ?? 90;
  const merged: Array<{ startIdx: number; endIdx: number }> = [];
  for (const w of rawWindows) {
    const last = merged[merged.length - 1];
    if (last && samples[w.startIdx].jd - samples[last.endIdx].jd <= mergeGap) {
      last.endIdx = w.endIdx;
    } else {
      merged.push({ ...w });
    }
  }

  // Step 3: find exact-aspect peaks (sign changes of separationSigned) within each merged window.
  const events: RawEventWindow[] = [];
  for (const w of merged) {
    const peaks: number[] = [];
    let prevSep = separationSigned(samples[w.startIdx].lon);
    for (let i = w.startIdx + 1; i <= w.endIdx; i++) {
      const cur = separationSigned(samples[i].lon);
      if ((prevSep <= 0 && cur > 0) || (prevSep >= 0 && cur < 0) || cur === 0) {
        // Sign change → exact aspect between samples[i-1] and samples[i]. Refine.
        const exactJd = refineExactAspect(
          samples[i - 1].jd,
          samples[i].jd,
          natalLongitude,
          targetAngle,
          planet
        );
        peaks.push(exactJd);
      }
      prevSep = cur;
    }
    events.push({
      enter: samples[w.startIdx].jd,
      leave: samples[w.endIdx].jd,
      peaks: peaks.length > 0 ? peaks : [samples[w.startIdx].jd], // fallback: window start
    });
  }
  return events;
}

/** Newton-style refinement of the exact aspect time between two JD bounds. */
function refineExactAspect(
  jdLo: number,
  jdHi: number,
  natalLongitude: number,
  targetAngle: number,
  planet: PlanetName
): number {
  // Try both target longitudes for non-conjunction aspects; return whichever
  // matches the observed sign changes best.
  const exact1 = (natalLongitude + targetAngle) % 360;
  const exact2 = (natalLongitude - targetAngle + 360) % 360;

  const bestSep = (lon: number, target: number) => {
    const d = ((lon - target + 540) % 360) - 180;
    return d;
  };

  let lo = jdLo;
  let hi = jdHi;
  for (let iter = 0; iter < 8; iter++) {
    const mid = (lo + hi) / 2;
    const p = calcPlanet(mid, planet);
    const dp = bestSep(p.longitude, exact1);
    const dpAlt = bestSep(p.longitude, exact2);
    const use = Math.abs(dp) < Math.abs(dpAlt) ? dp : dpAlt;
    // Use signed separation at endpoints to decide which half brackets the root.
    const pLo = calcPlanet(lo, planet);
    const dLo1 = bestSep(pLo.longitude, exact1);
    const dLo2 = bestSep(pLo.longitude, exact2);
    const useLo = Math.abs(dLo1) < Math.abs(dLo2) ? dLo1 : dLo2;
    if ((useLo <= 0 && use >= 0) || (useLo >= 0 && use <= 0)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

/** Build the full natal-point list including derived points (Angles, South Node). */
function buildNatalPointList(chart: NatalChart): Array<{ name: string; longitude: number }> {
  return buildNatalOverlayPoints(chart).map((p) => ({ name: p.name, longitude: p.longitude }));
}

function dateStringToJd(iso: string): number {
  // Interpret as noon UTC on that date — center of the day for stable window edges.
  return julianDayUT(`${iso}T12:00:00`, "UTC");
}

function jdToIsoDate(jd: number): string {
  // Convert JD (UT) to Gregorian YYYY-MM-DD. Adapted from Meeus ch. 7.
  const jdPlusHalf = jd + 0.5;
  const Z = Math.floor(jdPlusHalf);
  const F = jdPlusHalf - Z;
  let A: number;
  if (Z < 2299161) {
    A = Z;
  } else {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const day = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const dayInt = Math.floor(day);
  return `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${dayInt.toString().padStart(2, "0")}`;
}

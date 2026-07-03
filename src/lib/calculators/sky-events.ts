// Sky-weather events — the collective/public astrology feed. No birth data.
//
// Covers the four categories of events people typically ask about:
//
//   1. Retrograde stations   — Mercury retrograde etc. Each retrograde period
//      produces two events: "goes retrograde" (station retrograde) and "goes
//      direct" (station direct). Bisection on longitudeSpeed sign change.
//
//   2. Lunar phases          — new moon, first quarter, full moon, last
//      quarter. Bisection on (moon.lon - sun.lon) mod 360 crossing 0/90/180/270.
//
//   3. Sign ingresses        — a planet moving from one zodiac sign to the
//      next. Bisection on longitude crossing a 30° multiple.
//
//   4. Eclipses              — a new or full moon that occurs while the Sun
//      is within eclipse-eligible distance of the lunar nodes. Uses the
//      classical solar/lunar limits (18.5° / 12.25°).

import { calcPlanet, julianDayUT, type PlanetName } from "../ephemeris/client";

// Bodies that can go retrograde and whose retrogrades people care about.
export const RETROGRADE_PLANETS: readonly PlanetName[] = [
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
];

// Bodies whose sign ingresses are astrologically noteworthy. Sun ingresses
// (equinoxes/solstices/sign starts) matter most; Moon ingresses happen every
// ~2.3 days and are usually more noise than signal at the "monthly feed" level.
export const INGRESS_PLANETS: readonly PlanetName[] = [
  "sun",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "chiron",
  "uranus",
  "neptune",
  "pluto",
  "true_node",
];

export const MAX_SCAN_YEARS = 20;

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
] as const;

export type SkyEventType =
  | "retrograde_station"
  | "direct_station"
  | "new_moon"
  | "first_quarter"
  | "full_moon"
  | "last_quarter"
  | "sign_ingress"
  | "solar_eclipse"
  | "lunar_eclipse";

export interface SkyEvent {
  /** UTC ISO datetime of the event. */
  datetime: string;
  type: SkyEventType;
  /** For retrograde/ingress: the body involved. Absent for lunations/eclipses. */
  body?: string;
  /** Zodiac sign of the event (Sun's sign for lunations/eclipses, planet's for others). */
  sign?: string;
  /** For ingresses: the sign left behind. */
  fromSign?: string;
  /** Ecliptic longitude (0–360) of the primary body at the event moment. */
  longitude?: number;
  /** For lunations: the Moon's longitude. */
  moonLongitude?: number;
  /** For eclipses: how close the Sun was to a node in degrees. */
  eclipseNodeDistance?: number;
}

export interface SkyEventsInput {
  start_date: string; // YYYY-MM-DD
  end_date: string;
  /** Which event categories to emit. Default: all four. */
  categories?: Array<"retrograde" | "lunation" | "ingress" | "eclipse">;
  /** Bodies to scan for retrogrades (subset of RETROGRADE_PLANETS). */
  retrograde_planets?: PlanetName[];
  /** Bodies to scan for sign ingresses (subset of INGRESS_PLANETS). */
  ingress_planets?: PlanetName[];
}

export interface SkyEventsResult {
  scannedDateRange: { start: string; end: string; days: number };
  events: SkyEvent[];
}

/**
 * Compute all sky-weather events in a date range.
 *
 * Events are sorted chronologically. Every timestamp is UTC ISO.
 */
export function calculateSkyEvents(input: SkyEventsInput): SkyEventsResult {
  const startJd = dateStringToJd(input.start_date);
  const endJd = dateStringToJd(input.end_date);
  if (endJd <= startJd) {
    return {
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

  const categories = new Set(input.categories ?? ["retrograde", "lunation", "ingress", "eclipse"]);
  const retroPlanets = input.retrograde_planets ?? RETROGRADE_PLANETS;
  const ingressPlanets = input.ingress_planets ?? INGRESS_PLANETS;

  const events: SkyEvent[] = [];

  if (categories.has("retrograde")) {
    for (const p of retroPlanets) events.push(...findRetrogradeStations(startJd, endJd, p));
  }

  const lunations = categories.has("lunation") || categories.has("eclipse")
    ? findLunarPhases(startJd, endJd)
    : [];
  if (categories.has("lunation")) events.push(...lunations);

  if (categories.has("eclipse")) {
    events.push(...detectEclipses(lunations));
  }

  if (categories.has("ingress")) {
    for (const p of ingressPlanets) events.push(...findSignIngresses(startJd, endJd, p));
  }

  events.sort((a, b) => a.datetime.localeCompare(b.datetime));

  return {
    scannedDateRange: {
      start: input.start_date,
      end: input.end_date,
      days: Math.round(endJd - startJd),
    },
    events,
  };
}

// ─── Retrograde stations ────────────────────────────────────────────────────

function findRetrogradeStations(startJd: number, endJd: number, planet: PlanetName): SkyEvent[] {
  const events: SkyEvent[] = [];
  const step = 1; // daily
  let prevSpeed = calcPlanet(startJd, planet).longitudeSpeed;
  for (let jd = startJd + step; jd <= endJd; jd += step) {
    const curSpeed = calcPlanet(jd, planet).longitudeSpeed;
    if (prevSpeed > 0 && curSpeed <= 0) {
      // Station retrograde (positive → non-positive speed).
      const exact = refineZeroSpeed(jd - step, jd, planet);
      const pos = calcPlanet(exact, planet);
      events.push({
        datetime: jdToIsoDateTime(exact),
        type: "retrograde_station",
        body: planet,
        longitude: pos.longitude,
        sign: signOf(pos.longitude),
      });
    } else if (prevSpeed < 0 && curSpeed >= 0) {
      // Station direct.
      const exact = refineZeroSpeed(jd - step, jd, planet);
      const pos = calcPlanet(exact, planet);
      events.push({
        datetime: jdToIsoDateTime(exact),
        type: "direct_station",
        body: planet,
        longitude: pos.longitude,
        sign: signOf(pos.longitude),
      });
    }
    prevSpeed = curSpeed;
  }
  return events;
}

function refineZeroSpeed(lo: number, hi: number, planet: PlanetName): number {
  for (let i = 0; i < 12; i++) {
    const mid = (lo + hi) / 2;
    const s = calcPlanet(mid, planet).longitudeSpeed;
    const sLo = calcPlanet(lo, planet).longitudeSpeed;
    if ((sLo <= 0 && s >= 0) || (sLo >= 0 && s <= 0)) {
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return (lo + hi) / 2;
}

// ─── Lunar phases ───────────────────────────────────────────────────────────

const PHASE_ANGLES: Array<{ angle: number; type: SkyEvent["type"] }> = [
  { angle: 0,   type: "new_moon" },
  { angle: 90,  type: "first_quarter" },
  { angle: 180, type: "full_moon" },
  { angle: 270, type: "last_quarter" },
];

function phaseAngle(jd: number): number {
  const sun = calcPlanet(jd, "sun");
  const moon = calcPlanet(jd, "moon");
  return ((moon.longitude - sun.longitude + 360) % 360);
}

function findLunarPhases(startJd: number, endJd: number): SkyEvent[] {
  const events: SkyEvent[] = [];
  const step = 1;
  let prev = phaseAngle(startJd);
  for (let jd = startJd + step; jd <= endJd; jd += step) {
    const cur = phaseAngle(jd);
    for (const { angle, type } of PHASE_ANGLES) {
      if (crossedTarget(prev, cur, angle)) {
        const exact = refinePhase(jd - step, jd, angle);
        const sun = calcPlanet(exact, "sun");
        const moon = calcPlanet(exact, "moon");
        events.push({
          datetime: jdToIsoDateTime(exact),
          type,
          sign: signOf(sun.longitude),
          longitude: sun.longitude,
          moonLongitude: moon.longitude,
        });
      }
    }
    prev = cur;
  }
  return events;
}

function crossedTarget(prev: number, cur: number, target: number): boolean {
  // Handle 0/360 wrap by rotating so target = 180 and looking for a sign change.
  const rot = (x: number) => ((x - target + 540) % 360) - 180;
  const p = rot(prev);
  const c = rot(cur);
  // Sign change AND small enough delta (<180) so we don't catch the long way around
  return Math.sign(p) !== Math.sign(c) && Math.abs(p - c) < 180;
}

function refinePhase(lo: number, hi: number, target: number): number {
  const rotAt = (jd: number) => {
    const a = phaseAngle(jd);
    return ((a - target + 540) % 360) - 180;
  };
  let l = lo, h = hi;
  for (let i = 0; i < 20; i++) {
    const mid = (l + h) / 2;
    const rL = rotAt(l);
    const rM = rotAt(mid);
    if (Math.sign(rL) !== Math.sign(rM)) h = mid;
    else l = mid;
  }
  return (l + h) / 2;
}

// ─── Sign ingresses ─────────────────────────────────────────────────────────

function findSignIngresses(startJd: number, endJd: number, planet: PlanetName): SkyEvent[] {
  const events: SkyEvent[] = [];
  const step = 1;
  let prevLon = calcPlanet(startJd, planet).longitude;
  let prevSign = Math.floor(prevLon / 30);
  for (let jd = startJd + step; jd <= endJd; jd += step) {
    const p = calcPlanet(jd, planet);
    const curSign = Math.floor(p.longitude / 30);
    if (curSign !== prevSign) {
      // The sign moved from `prevSign` → `curSign`. Compute the boundary that
      // was crossed (either curSign*30 for forward motion, or prevSign*30 for
      // retrograde back into the previous sign).
      const targetLon = curSign > prevSign ? curSign * 30 : prevSign * 30;
      const exact = refineIngress(jd - step, jd, planet, targetLon);
      const pos = calcPlanet(exact, planet);
      // Use the detected sign indices directly — signOf(pos.longitude) can
      // round back to the from-sign at the exact boundary due to floating point.
      events.push({
        datetime: jdToIsoDateTime(exact),
        type: "sign_ingress",
        body: planet,
        longitude: pos.longitude,
        sign: ZODIAC_SIGNS[((curSign % 12) + 12) % 12],
        fromSign: ZODIAC_SIGNS[((prevSign % 12) + 12) % 12],
      });
      prevSign = curSign;
    }
    prevLon = p.longitude;
  }
  return events;
}

function refineIngress(lo: number, hi: number, planet: PlanetName, targetLon: number): number {
  const rot = (lon: number) => ((lon - targetLon + 540) % 360) - 180;
  let l = lo, h = hi;
  for (let i = 0; i < 20; i++) {
    const mid = (l + h) / 2;
    const rL = rot(calcPlanet(l, planet).longitude);
    const rM = rot(calcPlanet(mid, planet).longitude);
    if (Math.sign(rL) !== Math.sign(rM)) h = mid;
    else l = mid;
  }
  return (l + h) / 2;
}

// ─── Eclipses ───────────────────────────────────────────────────────────────

/** Solar-eclipse limit (Sun within this angular distance of a lunar node). */
const SOLAR_ECLIPSE_LIMIT_DEG = 18.5;
/** Lunar-eclipse limit (Sun within this angular distance of the point opposite the moon's node, i.e. of the opposite node). */
const LUNAR_ECLIPSE_LIMIT_DEG = 12.25;

function detectEclipses(lunations: SkyEvent[]): SkyEvent[] {
  const out: SkyEvent[] = [];
  for (const ev of lunations) {
    if (ev.type !== "new_moon" && ev.type !== "full_moon") continue;
    // At the phase moment, check Sun's angular distance to the true node.
    const jd = isoDateTimeToJd(ev.datetime);
    const sun = calcPlanet(jd, "sun");
    const node = calcPlanet(jd, "true_node");
    const nodeOpp = (node.longitude + 180) % 360;
    const distToNode = angularDistance(sun.longitude, node.longitude);
    const distToOppNode = angularDistance(sun.longitude, nodeOpp);
    const closest = Math.min(distToNode, distToOppNode);
    if (ev.type === "new_moon" && closest < SOLAR_ECLIPSE_LIMIT_DEG) {
      out.push({
        datetime: ev.datetime,
        type: "solar_eclipse",
        sign: ev.sign,
        longitude: ev.longitude,
        moonLongitude: ev.moonLongitude,
        eclipseNodeDistance: closest,
      });
    } else if (ev.type === "full_moon" && closest < LUNAR_ECLIPSE_LIMIT_DEG) {
      out.push({
        datetime: ev.datetime,
        type: "lunar_eclipse",
        sign: ev.sign,
        longitude: ev.longitude,
        moonLongitude: ev.moonLongitude,
        eclipseNodeDistance: closest,
      });
    }
  }
  return out;
}

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function signOf(longitude: number): string {
  const norm = ((longitude % 360) + 360) % 360;
  return ZODIAC_SIGNS[Math.floor(norm / 30)];
}

function dateStringToJd(iso: string): number {
  return julianDayUT(`${iso}T00:00:00`, "UTC");
}

function jdToIsoDateTime(jd: number): string {
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
  const dayFrac = B - D - Math.floor(30.6001 * E) + F;
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const dayInt = Math.floor(dayFrac);
  const dayRemainder = dayFrac - dayInt;
  const totalSeconds = Math.round(dayRemainder * 86400);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return (
    `${year.toString().padStart(4, "0")}-` +
    `${month.toString().padStart(2, "0")}-` +
    `${dayInt.toString().padStart(2, "0")}T` +
    `${hours.toString().padStart(2, "0")}:` +
    `${minutes.toString().padStart(2, "0")}:` +
    `${seconds.toString().padStart(2, "0")}Z`
  );
}

function isoDateTimeToJd(iso: string): number {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!m) throw new Error(`Bad ISO datetime: ${iso}`);
  const [, y, mo, d, h, mi, s] = m;
  return julianDayUT(`${y}-${mo}-${d}T${h}:${mi}:${s}`, "UTC");
}

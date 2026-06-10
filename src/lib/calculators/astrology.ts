// Natal chart and transit calculator built on top of the ephemeris client.
// Returns planet positions, house cusps, and aspects.

import {
  calcAllPlanets,
  calcHouses,
  calcPlanet,
  julianDayUT,
  type HouseSystem,
  type PlanetName,
  type PlanetPosition,
} from "../ephemeris/client";
import type { BirthData } from "../types/birth-data";

const DEFAULT_PLANETS: readonly PlanetName[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "true_node",
  "chiron",
];

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export interface SignPosition {
  sign: string;
  degree: number; // 0-30 within the sign
  minute: number; // 0-60
  second: number; // 0-60
}

export function longitudeToSign(longitude: number): SignPosition {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const remainder = normalized - signIndex * 30;
  const degree = Math.floor(remainder);
  const minuteFloat = (remainder - degree) * 60;
  const minute = Math.floor(minuteFloat);
  const second = Math.round((minuteFloat - minute) * 60);
  return { sign: ZODIAC_SIGNS[signIndex], degree, minute, second };
}

export interface NatalPlanet {
  name: PlanetName | "south_node";
  longitude: number;
  latitude: number;
  speed: number;
  retrograde: boolean;
  sign: SignPosition;
  house: number; // 1-12
}

export interface NatalChart {
  jd_ut: number;
  planets: NatalPlanet[];
  houses: {
    system: HouseSystem;
    cusps: { house: number; longitude: number; sign: SignPosition }[];
    ascendant: { longitude: number; sign: SignPosition };
    midheaven: { longitude: number; sign: SignPosition };
    vertex: { longitude: number; sign: SignPosition };
  };
  /**
   * Part of Fortune (Pars Fortunae) — derived point representing material
   * well-being and "the place where you find your joy". Day-birth formula:
   * ASC + Moon - Sun. Night-birth formula: ASC + Sun - Moon (reversed).
   * `isDayBirth` tells you which formula was used.
   */
  partOfFortune: {
    longitude: number;
    sign: SignPosition;
    house: number;
    isDayBirth: boolean;
  };
  aspects: Aspect[];
  /** Non-fatal warnings about the chart (e.g., high-latitude house distortion). */
  warnings: string[];
}

/** Quadrant house systems (Placidus, Koch, Regiomontanus, Campanus) become
 * undefined near the poles because the formulas reference the celestial
 * equator's intersection with the horizon, which fails when the Sun never
 * rises or sets. We warn at the Arctic/Antarctic circles (~66.5°). */
const QUADRANT_SYSTEMS: ReadonlySet<HouseSystem> = new Set(["placidus", "koch", "regiomontanus", "campanus"]);
const HIGH_LATITUDE_THRESHOLD = 66.5;

export type AspectBody = PlanetName | "south_node";

export interface Aspect {
  from: AspectBody;
  to: AspectBody;
  type: "conjunction" | "opposition" | "trine" | "square" | "sextile" | "quincunx";
  exactAngle: number;
  orb: number;
  applying: boolean;
}

const ASPECT_DEFS: { type: Aspect["type"]; angle: number; orb: number }[] = [
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "opposition", angle: 180, orb: 8 },
  { type: "trine", angle: 120, orb: 7 },
  { type: "square", angle: 90, orb: 7 },
  { type: "sextile", angle: 60, orb: 5 },
  { type: "quincunx", angle: 150, orb: 3 },
];

function angularDifference(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

function houseFor(longitude: number, cusps: number[]): number {
  // cusps[i] is the start of house i+1. Houses wrap around 360°.
  const norm = ((longitude % 360) + 360) % 360;
  for (let i = 0; i < 12; i++) {
    const start = cusps[i];
    const end = cusps[(i + 1) % 12];
    const inHouse = end > start ? norm >= start && norm < end : norm >= start || norm < end;
    if (inHouse) return i + 1;
  }
  return 1;
}

function computeAspects(planets: NatalPlanet[]): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      const sep = angularDifference(a.longitude, b.longitude);
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(sep - def.angle);
        if (orb <= def.orb) {
          // Applying = orbit will tighten toward exact aspect over the next ~15 minutes.
          const sepFuture = angularDifference(
            a.longitude + a.speed * 0.01,
            b.longitude + b.speed * 0.01
          );
          const applying = Math.abs(sepFuture - def.angle) < orb;
          out.push({
            from: a.name,
            to: b.name,
            type: def.type,
            exactAngle: def.angle,
            orb,
            applying,
          });
          break;
        }
      }
    }
  }
  return out;
}

export interface NatalInput extends BirthData {
  house_system?: HouseSystem;
  planets?: PlanetName[];
}

/**
 * Compute a tropical natal chart: planet positions, house cusps, and aspects.
 *
 * Coordinates are tropical-zodiac ecliptic longitudes in degrees (0–360).
 * Default house system is Placidus; default planet set is sun..pluto + true_node + chiron.
 *
 * @example
 *   calculateNatalChart({
 *     datetime: "1961-07-01T19:45:00",
 *     timezone: "Europe/London",
 *     latitude: 52.833,
 *     longitude: 0.5,
 *   });
 *
 * @param input.datetime  ISO 8601 local datetime, e.g. "1980-07-15T14:30:00".
 * @param input.timezone  IANA timezone, e.g. "America/New_York".
 * @param input.latitude  North-positive decimal degrees.
 * @param input.longitude East-positive decimal degrees.
 * @param input.house_system  Default "placidus". One of placidus, koch,
 *   porphyrius, regiomontanus, campanus, equal, whole_sign.
 * @param input.planets   Default includes 12 bodies; override to limit.
 * @returns A `NatalChart` with planets (with sign + house), houses (cusps,
 *   ASC, MC, vertex), and computed aspects.
 */
export function calculateNatalChart(input: NatalInput): NatalChart {
  const houseSystem = input.house_system ?? "placidus";
  const planetList = input.planets ?? DEFAULT_PLANETS;

  const jd = julianDayUT(input.datetime, input.timezone);
  const positions = calcAllPlanets(jd, planetList);
  const houses = calcHouses(jd, input.latitude, input.longitude, houseSystem);

  const warnings: string[] = [];
  if (Math.abs(input.latitude) >= HIGH_LATITUDE_THRESHOLD && QUADRANT_SYSTEMS.has(houseSystem)) {
    warnings.push(
      `Latitude ${input.latitude.toFixed(2)}° is at or beyond the polar circle; ` +
      `${houseSystem} house cusps are mathematically degenerate above ~66.5° and ` +
      `may be unreliable. Consider whole_sign or equal house systems for polar charts.`
    );
  }

  const planets: NatalPlanet[] = planetList.map((name) => {
    const p: PlanetPosition = positions[name];
    return {
      name,
      longitude: p.longitude,
      latitude: p.latitude,
      speed: p.longitudeSpeed,
      retrograde: p.longitudeSpeed < 0,
      sign: longitudeToSign(p.longitude),
      house: houseFor(p.longitude, houses.cusps),
    };
  });

  // South Node is always 180° opposite the (true or mean) North Node. It isn't
  // a Swiss Ephemeris body; we derive it whenever the user includes a node.
  const northNode = planets.find((p) => p.name === "true_node" || p.name === "mean_node");
  if (northNode) {
    const snLon = (northNode.longitude + 180) % 360;
    planets.push({
      name: "south_node",
      longitude: snLon,
      latitude: 0,
      speed: northNode.speed,
      retrograde: northNode.retrograde,
      sign: longitudeToSign(snLon),
      house: houseFor(snLon, houses.cusps),
    });
  }

  // Part of Fortune: day-birth = ASC + Moon - Sun; night-birth = ASC + Sun - Moon.
  // Day birth ≡ Sun above horizon ≡ Sun's house ∈ {7..12} under conventional
  // house counting (1 starts at ASC, descending eastern horizon).
  const sunPlanet = planets.find((p) => p.name === "sun");
  const moonPlanet = planets.find((p) => p.name === "moon");
  let partOfFortune;
  if (sunPlanet && moonPlanet) {
    const isDayBirth = sunPlanet.house >= 7 && sunPlanet.house <= 12;
    const pofLon = isDayBirth
      ? ((houses.ascendant + moonPlanet.longitude - sunPlanet.longitude) % 360 + 360) % 360
      : ((houses.ascendant + sunPlanet.longitude - moonPlanet.longitude) % 360 + 360) % 360;
    partOfFortune = {
      longitude: pofLon,
      sign: longitudeToSign(pofLon),
      house: houseFor(pofLon, houses.cusps),
      isDayBirth,
    };
  } else {
    partOfFortune = {
      longitude: houses.ascendant,
      sign: longitudeToSign(houses.ascendant),
      house: 1,
      isDayBirth: false,
    };
  }

  return {
    jd_ut: jd,
    planets,
    houses: {
      system: houseSystem,
      cusps: houses.cusps.map((cusp, i) => ({
        house: i + 1,
        longitude: cusp,
        sign: longitudeToSign(cusp),
      })),
      ascendant: { longitude: houses.ascendant, sign: longitudeToSign(houses.ascendant) },
      midheaven: { longitude: houses.midheaven, sign: longitudeToSign(houses.midheaven) },
      vertex: { longitude: houses.vertex, sign: longitudeToSign(houses.vertex) },
    },
    partOfFortune,
    aspects: computeAspects(planets),
    warnings,
  };
}

export interface TransitInput {
  natal: BirthData & { house_system?: HouseSystem };
  transit_datetime: string; // local ISO at the natal location, or UTC
  transit_timezone: string;
  planets?: PlanetName[];
}

export interface TransitChart {
  natal_jd_ut: number;
  transit_jd_ut: number;
  transitingPlanets: NatalPlanet[];
  aspectsToNatal: (Aspect & { fromTransit: boolean })[];
}

/**
 * Compute transits to a natal chart at a given moment.
 *
 * Computes a full natal chart for the birth data, then overlays the planet
 * positions at the transit moment, returning the aspects each transiting
 * planet makes to natal planets.
 *
 * @param input.natal              Natal birth data (same shape as calculateNatalChart input).
 * @param input.transit_datetime   ISO 8601 local datetime of the transit moment.
 * @param input.transit_timezone   IANA timezone of `transit_datetime`.
 * @param input.planets            Optional subset of bodies to include.
 * @returns Both Julian Days, the transit planet positions in natal houses,
 *   and the transit-to-natal aspect list.
 */
export function calculateTransits(input: TransitInput): TransitChart {
  const natalChart = calculateNatalChart(input.natal);
  const transitJd = julianDayUT(input.transit_datetime, input.transit_timezone);
  const planetList = input.planets ?? DEFAULT_PLANETS;
  const tpos = calcAllPlanets(transitJd, planetList);

  const transitingPlanets: NatalPlanet[] = planetList.map((name) => {
    const p = tpos[name];
    return {
      name,
      longitude: p.longitude,
      latitude: p.latitude,
      speed: p.longitudeSpeed,
      retrograde: p.longitudeSpeed < 0,
      sign: longitudeToSign(p.longitude),
      house: houseFor(p.longitude, natalChart.houses.cusps.map((c) => c.longitude)),
    };
  });

  const aspectsToNatal: (Aspect & { fromTransit: boolean })[] = [];
  for (const t of transitingPlanets) {
    for (const n of natalChart.planets) {
      const sep = angularDifference(t.longitude, n.longitude);
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(sep - def.angle);
        if (orb <= def.orb) {
          aspectsToNatal.push({
            from: t.name,
            to: n.name,
            type: def.type,
            exactAngle: def.angle,
            orb,
            applying: false,
            fromTransit: true,
          });
          break;
        }
      }
    }
  }

  return {
    natal_jd_ut: natalChart.jd_ut,
    transit_jd_ut: transitJd,
    transitingPlanets,
    aspectsToNatal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Secondary Progressions
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressedInput extends BirthData {
  /** Years after birth to project the chart to. Can be fractional. */
  years: number;
  /** Planet subset; defaults to the fast-moving inner planets (Sun..Mars) plus Moon. */
  planets?: PlanetName[];
}

export interface ProgressedChart {
  natal_jd_ut: number;
  progressed_jd_ut: number;
  years: number;
  planets: { name: PlanetName; longitude: number; sign: SignPosition; retrograde: boolean }[];
}

const DEFAULT_PROGRESSED_PLANETS: readonly PlanetName[] = [
  "sun", "moon", "mercury", "venus", "mars",
];

/**
 * Compute secondary-progressed planet positions.
 *
 * Per the classical "day for a year" symbolic technique: where the planets
 * were N solar days after birth = their progressed positions at age N years.
 * Only the fast-moving inner planets (Sun through Mars, plus the Moon) move
 * meaningfully on this timescale; outer planets are essentially fixed and
 * are omitted by default.
 *
 * @param input.years Number of years after birth (e.g. 28 for "at age 28").
 *                    May be fractional ("28.5" = mid-year).
 */
export function calculateProgressions(input: ProgressedInput): ProgressedChart {
  const natalJd = julianDayUT(input.datetime, input.timezone);
  const progressedJd = natalJd + input.years;
  const planetList = input.planets ?? DEFAULT_PROGRESSED_PLANETS;
  const positions = calcAllPlanets(progressedJd, planetList);

  const planets = planetList.map((name) => {
    const p = positions[name];
    return {
      name,
      longitude: p.longitude,
      sign: longitudeToSign(p.longitude),
      retrograde: p.longitudeSpeed < 0,
    };
  });

  return {
    natal_jd_ut: natalJd,
    progressed_jd_ut: progressedJd,
    years: input.years,
    planets,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Solar Return
// ─────────────────────────────────────────────────────────────────────────────

export interface SolarReturnInput {
  natal: BirthData & { house_system?: HouseSystem };
  /** Year of the return (e.g. 2026). */
  year: number;
  /**
   * Optional relocation. Solar Returns are traditionally cast for where you
   * will be during the year ahead. If omitted, uses the natal lat/lon.
   */
  relocation?: { latitude: number; longitude: number; timezone: string };
}

export interface SolarReturnChart extends NatalChart {
  /** The natal Sun longitude that the return Sun matches. */
  natal_sun_longitude: number;
  /** UT instant when transit Sun returns to natal Sun longitude in the given year. */
  return_jd_ut: number;
  year: number;
  /** True if the return chart was cast at a relocated lat/lon. */
  relocated: boolean;
}

/**
 * Compute a Solar Return chart for a given year.
 *
 * Finds the JD-UT instant where the Sun's ecliptic longitude equals the natal
 * Sun's, on or near the birthday in the requested year, then casts a full
 * natal-style chart for that moment at the (optionally relocated) location.
 */
export function calculateSolarReturn(input: SolarReturnInput): SolarReturnChart {
  const natalJd = julianDayUT(input.natal.datetime, input.natal.timezone);
  const natalSunLon = calcPlanet(natalJd, "sun").longitude;

  // Birth month/day in the target year as a starting guess. The return occurs
  // within ±1 day of the birthday. Iterate Newton-style on Sun longitude.
  const m = input.natal.datetime.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) throw new Error("natal.datetime must be ISO 8601");
  const month = m[1];
  const day = m[2];
  const seedIso = `${input.year}-${month}-${day}T00:00:00`;
  let jd = julianDayUT(seedIso, input.natal.timezone);

  for (let i = 0; i < 12; i++) {
    const cur = calcPlanet(jd, "sun");
    let diff = cur.longitude - natalSunLon;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    if (Math.abs(diff) < 1e-7) break;
    jd -= diff / cur.longitudeSpeed;
  }

  // Cast the full chart at the return JD using the chosen location.
  const lat = input.relocation?.latitude ?? input.natal.latitude;
  const lon = input.relocation?.longitude ?? input.natal.longitude;
  const tz = input.relocation?.timezone ?? input.natal.timezone;

  // The natal-chart calculator wants a datetime + timezone. Convert JD-UT
  // back to a UTC ISO string and pass UTC explicitly to avoid TZ conversion.
  const isoUtc = jdUtToIsoUtc(jd);

  const chart = calculateNatalChart({
    datetime: isoUtc,
    timezone: "UTC",
    latitude: lat,
    longitude: lon,
    house_system: input.natal.house_system,
  });

  return {
    ...chart,
    natal_sun_longitude: natalSunLon,
    return_jd_ut: jd,
    year: input.year,
    relocated: input.relocation !== undefined && (lat !== input.natal.latitude || lon !== input.natal.longitude || tz !== input.natal.timezone),
  };
}

/** Convert a Julian Day (UT) to an ISO 8601 UTC datetime string. */
function jdUtToIsoUtc(jd: number): string {
  // Standard JD-to-Gregorian (Meeus, Astronomical Algorithms ch. 7).
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFloat = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayFloat);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const dayFrac = dayFloat - day;
  const totalSeconds = Math.round(dayFrac * 86400);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

// Natal chart and transit calculator built on top of the ephemeris client.
// Returns planet positions, house cusps, and aspects.

import {
  calcAllPlanets,
  calcHouses,
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
  name: PlanetName;
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

export interface Aspect {
  from: PlanetName;
  to: PlanetName;
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

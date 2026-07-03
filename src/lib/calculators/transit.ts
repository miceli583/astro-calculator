// Transit calculators built on the shared computeOverlay core.
//
// - calculateTransitSky: pure sky snapshot for a datetime (no natal chart).
// - calculateTransitToNatal: overlay of sky-at-datetime onto a natal chart.
//
// For the transit event scanner see `transit-events.ts`.

import { calcAllPlanets, julianDayUT, type PlanetName } from "../ephemeris/client";
import { calculateNatalChart, longitudeToSign, type NatalChart, type NatalInput, type SignPosition } from "./astrology";
import {
  computeOverlay,
  type AspectType,
  type OverlayOptions,
  type OverlayResult,
} from "./overlay";
import { longitudeToGate } from "../constants/hd-gates";

/** Default transit-planet set: outer + fast + Chiron + nodes. */
export const DEFAULT_TRANSIT_PLANETS: readonly PlanetName[] = [
  "sun",
  "moon",
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

export interface TransitSkyInput {
  datetime: string;
  timezone: string;
  planets?: PlanetName[];
}

export interface TransitSkyPoint {
  name: PlanetName | "south_node";
  longitude: number;
  latitude: number;
  speed: number;
  retrograde: boolean;
  sign: SignPosition;
  /** HD gate/line at this position. */
  gate: number;
  line: number;
}

export interface TransitSkyChart {
  jd_ut: number;
  planets: TransitSkyPoint[];
}

/**
 * Compute the raw planetary sky for a specific instant. No natal chart needed.
 *
 * Useful on its own ("what's the sky doing right now?") and as a building
 * block for the transit-to-natal and event-scanner endpoints.
 */
export function calculateTransitSky(input: TransitSkyInput): TransitSkyChart {
  const jd = julianDayUT(input.datetime, input.timezone);
  const planetList = input.planets ?? DEFAULT_TRANSIT_PLANETS;
  const positions = calcAllPlanets(jd, planetList);

  const planets: TransitSkyPoint[] = planetList.map((name) => {
    const p = positions[name];
    const g = longitudeToGate(p.longitude);
    return {
      name,
      longitude: p.longitude,
      latitude: p.latitude,
      speed: p.longitudeSpeed,
      retrograde: p.longitudeSpeed < 0,
      sign: longitudeToSign(p.longitude),
      gate: g.gate,
      line: g.line,
    };
  });

  // South Node derived if a North Node was requested.
  const nn = planets.find((p) => p.name === "true_node" || p.name === "mean_node");
  if (nn) {
    const snLon = (nn.longitude + 180) % 360;
    const g = longitudeToGate(snLon);
    planets.push({
      name: "south_node",
      longitude: snLon,
      latitude: 0,
      speed: nn.speed,
      retrograde: nn.retrograde,
      sign: longitudeToSign(snLon),
      gate: g.gate,
      line: g.line,
    });
  }

  return { jd_ut: jd, planets };
}

export interface TransitToNatalInput {
  natal: NatalInput;
  transit_datetime: string;
  transit_timezone: string;
  transit_planets?: PlanetName[];
  aspects?: AspectType[];
  orbs?: OverlayOptions["orbs"];
}

export interface TransitToNatalResult {
  natal_jd_ut: number;
  transit_jd_ut: number;
  natalChart: NatalChart;
  transitSky: TransitSkyChart;
  overlay: OverlayResult;
}

/**
 * Compute the full transit-to-natal overlay: aspects, HD activations, and
 * house overlays of the current (or specified) sky onto a natal chart.
 */
export function calculateTransitToNatal(input: TransitToNatalInput): TransitToNatalResult {
  const natalChart = calculateNatalChart(input.natal);
  const transitSky = calculateTransitSky({
    datetime: input.transit_datetime,
    timezone: input.transit_timezone,
    planets: input.transit_planets,
  });

  const natalPoints = [
    ...natalChart.planets.map((p) => ({
      name: p.name as string,
      longitude: p.longitude,
      speed: p.speed,
      retrograde: p.retrograde,
    })),
    // Angles as natal points — transits to the ASC/MC are major life events.
    { name: "asc", longitude: natalChart.houses.ascendant.longitude, speed: 0 },
    { name: "mc",  longitude: natalChart.houses.midheaven.longitude, speed: 0 },
  ];
  const overlay = computeOverlay(
    { points: natalPoints, cusps: natalChart.houses.cusps.map((c) => c.longitude) },
    {
      points: transitSky.planets.map((p) => ({
        name: p.name,
        longitude: p.longitude,
        speed: p.speed,
        retrograde: p.retrograde,
      })),
    },
    {
      aspects: input.aspects,
      orbs: input.orbs,
    }
  );

  return {
    natal_jd_ut: natalChart.jd_ut,
    transit_jd_ut: transitSky.jd_ut,
    natalChart,
    transitSky,
    overlay,
  };
}

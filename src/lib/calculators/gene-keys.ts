// Gene Keys Profile (Richard Rudd's system).
//
// Gene Keys shares the 64-hexagram wheel with Human Design but interprets the
// activations through three sequences:
//
//   • Activation Sequence — 4 prime gifts (Life's Work, Evolution, Radiance, Purpose)
//   • Venus Sequence      — 6 spheres of relating (heart line)
//   • Pearl Sequence      — 3 spheres of prosperity
//
// The mapping below uses the most commonly cited convention. Different
// teachers describe slight variations; verify against an authoritative
// Gene Keys profile (e.g. Richard Rudd's official chart) before building
// downstream interpretation.

import {
  calcAllPlanets,
  calcPlanet,
  julianDayUT,
  type PlanetName,
} from "../ephemeris/client";
import { longitudeToGate, type GateActivation } from "../constants/hd-gates";
import type { BirthData } from "../types/birth-data";

const GK_PLANETS: readonly PlanetName[] = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn",
];

interface ChartActivations {
  jd: number;
  byPlanet: Record<string, GateActivation & { longitude: number }>;
}

function chartActivations(jd: number): ChartActivations {
  const positions = calcAllPlanets(jd, GK_PLANETS);
  const byPlanet: ChartActivations["byPlanet"] = {};
  for (const p of GK_PLANETS) {
    byPlanet[p] = { longitude: positions[p].longitude, ...longitudeToGate(positions[p].longitude) };
  }
  // Earth = Sun + 180°
  const earthLong = (positions.sun.longitude + 180) % 360;
  byPlanet.earth = { longitude: earthLong, ...longitudeToGate(earthLong) };
  return { jd, byPlanet };
}

function designJd(birthJd: number, birthSunLong: number): number {
  const target = (birthSunLong - 88 + 360) % 360;
  let jd = birthJd - 88 / 0.9856;
  for (let i = 0; i < 12; i++) {
    const sun = calcPlanet(jd, "sun");
    let diff = sun.longitude - target;
    if (diff > 180) diff -= 360;
    if (diff <= -180) diff += 360;
    if (Math.abs(diff) < 1e-7) break;
    jd -= diff / sun.longitudeSpeed;
  }
  return jd;
}

export interface Sphere {
  name: string;
  source: string; // e.g. "Personality Sun"
  gate: number;
  line: number;
}

export interface ActivationSequence {
  lifesWork: Sphere; // P-Sun
  evolution: Sphere; // P-Earth
  radiance: Sphere; // D-Sun
  purpose: Sphere; // D-Earth
}

export interface VenusSequence {
  attraction: Sphere; // P-Mars
  iq: Sphere; // P-Venus
  eq: Sphere; // P-Moon
  sq: Sphere; // P-Mercury
  core: Sphere; // D-Earth (same gate as Purpose)
  wound: Sphere; // P-Saturn
}

export interface PearlSequence {
  vocation: Sphere; // D-Jupiter
  culture: Sphere; // P-Jupiter
  brand: Sphere; // P-Sun (same as Life's Work)
}

export interface GeneKeysProfile {
  personality_jd_ut: number;
  design_jd_ut: number;
  activation: ActivationSequence;
  venus: VenusSequence;
  pearl: PearlSequence;
}

function sphere(name: string, source: string, a: GateActivation): Sphere {
  return { name, source, gate: a.gate, line: a.line };
}

export function calculateGeneKeys(input: BirthData): GeneKeysProfile {
  const pJd = julianDayUT(input.datetime, input.timezone);
  const sunLong = calcPlanet(pJd, "sun").longitude;
  const dJd = designJd(pJd, sunLong);

  const personality = chartActivations(pJd);
  const design = chartActivations(dJd);

  return {
    personality_jd_ut: pJd,
    design_jd_ut: dJd,
    activation: {
      lifesWork: sphere("Life's Work", "Personality Sun", personality.byPlanet.sun),
      evolution: sphere("Evolution", "Personality Earth", personality.byPlanet.earth),
      radiance: sphere("Radiance", "Design Sun", design.byPlanet.sun),
      purpose: sphere("Purpose", "Design Earth", design.byPlanet.earth),
    },
    venus: {
      attraction: sphere("Attraction", "Personality Mars", personality.byPlanet.mars),
      iq: sphere("IQ", "Personality Venus", personality.byPlanet.venus),
      eq: sphere("EQ", "Personality Moon", personality.byPlanet.moon),
      sq: sphere("SQ", "Personality Mercury", personality.byPlanet.mercury),
      core: sphere("Core", "Design Earth", design.byPlanet.earth),
      wound: sphere("Wound", "Personality Saturn", personality.byPlanet.saturn),
    },
    pearl: {
      vocation: sphere("Vocation", "Design Jupiter", design.byPlanet.jupiter),
      culture: sphere("Culture", "Personality Jupiter", personality.byPlanet.jupiter),
      brand: sphere("Brand", "Personality Sun", personality.byPlanet.sun),
    },
  };
}

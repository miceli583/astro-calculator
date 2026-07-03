// Gene Keys Hologenetic Profile (Richard Rudd's system).
//
// The official Hologenetic Profile displays 11 spheres across 3 sequences:
//
//   • Activation Sequence — 4 spheres: Life's Work, Evolution, Radiance, Purpose
//   • Venus Sequence      — 5 spheres: Attraction, IQ, EQ, SQ, Core
//   • Pearl Sequence      — 2 spheres: Pearl/Vocation, Culture
//
// Source mappings verified against the official genekeys.com profile.

import {
  calcAllPlanets,
  calcPlanet,
  julianDayUT,
  type PlanetName,
} from "../ephemeris/client";
import { longitudeToGate, type GateActivation } from "../constants/hd-gates";
import {
  HD_DESIGN_ARC_DEG,
  HD_DESIGN_ARC_APPROX_DAYS,
} from "../constants/design-arc";
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
  const target = (birthSunLong - HD_DESIGN_ARC_DEG + 360) % 360;
  let jd = birthJd - HD_DESIGN_ARC_APPROX_DAYS;
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
  attraction: Sphere; // D-Moon
  iq: Sphere; // P-Venus
  eq: Sphere; // P-Mars
  sq: Sphere; // D-Venus
  core: Sphere; // D-Mars
}

export interface PearlSequence {
  vocation: Sphere; // P-Jupiter (the "Pearl" sphere)
  culture: Sphere; // D-Jupiter
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

/**
 * Compute a Gene Keys Hologenetic Profile (Richard Rudd's system) from birth data.
 *
 * Returns the 11 spheres of the official Hologenetic Profile across three sequences:
 *   - Activation Sequence (4): Life's Work, Evolution, Radiance, Purpose
 *   - Venus Sequence (5): Attraction, IQ, EQ, SQ, Core
 *   - Pearl Sequence (2): Vocation (Pearl), Culture
 *
 * The "Design" moment is the same as HD's: when the Sun was 88° behind its
 * birth longitude (~88 calendar days earlier).
 *
 * Note: GK output depends only on the birth instant in UT — `latitude` and
 * `longitude` are accepted for API consistency but not used.
 */
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
      attraction: sphere("Attraction", "Design Moon", design.byPlanet.moon),
      iq: sphere("IQ", "Personality Venus", personality.byPlanet.venus),
      eq: sphere("EQ", "Personality Mars", personality.byPlanet.mars),
      sq: sphere("SQ", "Design Venus", design.byPlanet.venus),
      core: sphere("Core", "Design Mars", design.byPlanet.mars),
    },
    pearl: {
      vocation: sphere("Vocation", "Personality Jupiter", personality.byPlanet.jupiter),
      culture: sphere("Culture", "Design Jupiter", design.byPlanet.jupiter),
    },
  };
}

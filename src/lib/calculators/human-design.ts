// Human Design body graph calculation.
//
// Human Design uses two charts:
//   • "Personality" — planet positions at the moment of birth (in UT)
//   • "Design"      — planet positions when the Sun was 88° behind its birth
//                     position (~88 days earlier)
//
// Each planet's ecliptic longitude maps to a gate / line / color / tone / base
// via the Mandala wheel (see constants/hd-gates.ts).
//
// The gate activations are then used to derive: defined centers, channels,
// type, authority, profile, and incarnation cross.

import {
  calcAllPlanets,
  calcPlanet,
  julianDayUT,
  type PlanetName,
} from "../ephemeris/client";
import { longitudeToGate, type GateActivation } from "../constants/hd-gates";
import {
  ALL_CENTERS,
  CHANNELS,
  MOTOR_CENTERS,
  type Center,
  type Channel,
} from "../constants/hd-channels";
import type { BirthData } from "../types/birth-data";

// Bodies needed for HD: Sun, Earth (Sun + 180°), Moon, North Node, South Node,
// Mercury, Venus, Mars, Jupiter, Saturn, Uranus, Neptune, Pluto.
const HD_PLANETS: readonly PlanetName[] = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter",
  "saturn", "uranus", "neptune", "pluto", "true_node",
];

// Find the JD when the Sun was exactly 88° earlier in longitude than birthSunLongitude.
// We use Newton's method on Sun longitude (mean motion ≈ 0.9856°/day).
function designJulianDay(birthJd: number, birthSunLongitude: number): number {
  const TARGET = (birthSunLongitude - 88 + 360) % 360;
  // Initial guess: 88 mean solar days before birth
  let jd = birthJd - 88 / 0.9856;
  for (let i = 0; i < 12; i++) {
    const sun = calcPlanet(jd, "sun");
    let diff = sun.longitude - TARGET;
    // Wrap to (-180, 180]
    if (diff > 180) diff -= 360;
    if (diff <= -180) diff += 360;
    if (Math.abs(diff) < 1e-7) break;
    jd -= diff / sun.longitudeSpeed;
  }
  return jd;
}

export type Activation = GateActivation & { planet: string; longitude: number };

export interface ChartHalf {
  jd_ut: number;
  activations: Activation[];
}

function activationsFor(jd: number): Activation[] {
  const positions = calcAllPlanets(jd, HD_PLANETS);
  const out: Activation[] = [];
  for (const p of HD_PLANETS) {
    const longitude = positions[p].longitude;
    out.push({ planet: p, longitude, ...longitudeToGate(longitude) });
  }
  // Earth = Sun + 180°
  const sunLong = positions.sun.longitude;
  const earthLong = (sunLong + 180) % 360;
  out.push({ planet: "earth", longitude: earthLong, ...longitudeToGate(earthLong) });
  // South Node = North Node + 180°
  const nnLong = positions.true_node.longitude;
  const snLong = (nnLong + 180) % 360;
  out.push({ planet: "south_node", longitude: snLong, ...longitudeToGate(snLong) });
  return out;
}

function definedChannels(activatedGates: Set<number>): Channel[] {
  const seen = new Set<string>();
  const out: Channel[] = [];
  for (const ch of CHANNELS) {
    if (activatedGates.has(ch.gates[0]) && activatedGates.has(ch.gates[1])) {
      const key = [...ch.gates].sort().join("-");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(ch);
    }
  }
  return out;
}

function definedCenters(channels: Channel[]): Set<Center> {
  const out = new Set<Center>();
  for (const ch of channels) {
    out.add(ch.centers[0]);
    out.add(ch.centers[1]);
  }
  return out;
}

export type HumanDesignType =
  | "Reflector" | "Manifestor" | "Generator" | "Manifesting Generator" | "Projector";

function determineType(defined: Set<Center>, channels: Channel[]): HumanDesignType {
  if (defined.size === 0) return "Reflector";
  const sacralDefined = defined.has("sacral");
  // Throat connected to a motor by any chain of defined channels?
  const throatToMotor = throatConnectedToMotor(defined, channels);

  if (sacralDefined) {
    return throatToMotor ? "Manifesting Generator" : "Generator";
  }
  if (throatToMotor) return "Manifestor";
  return "Projector";
}

function throatConnectedToMotor(defined: Set<Center>, channels: Channel[]): boolean {
  if (!defined.has("throat")) return false;
  // BFS from throat through defined channels
  const adjacency = new Map<Center, Center[]>();
  for (const c of ALL_CENTERS) adjacency.set(c, []);
  for (const ch of channels) {
    adjacency.get(ch.centers[0])!.push(ch.centers[1]);
    adjacency.get(ch.centers[1])!.push(ch.centers[0]);
  }
  const visited = new Set<Center>(["throat"]);
  const queue: Center[] = ["throat"];
  while (queue.length) {
    const c = queue.shift()!;
    if (MOTOR_CENTERS.includes(c)) return true;
    for (const n of adjacency.get(c) ?? []) {
      if (!visited.has(n)) {
        visited.add(n);
        queue.push(n);
      }
    }
  }
  return false;
}

export type Authority =
  | "Emotional" | "Sacral" | "Splenic" | "Ego Manifested" | "Ego Projected"
  | "Self Projected" | "Mental" | "Lunar" | "None";

function determineAuthority(defined: Set<Center>, type: HumanDesignType): Authority {
  if (type === "Reflector") return "Lunar";
  if (defined.has("solar_plexus")) return "Emotional";
  if (defined.has("sacral")) return "Sacral";
  if (defined.has("spleen")) return "Splenic";
  if (defined.has("heart")) {
    return type === "Manifestor" ? "Ego Manifested" : "Ego Projected";
  }
  if (defined.has("g") && defined.has("throat")) return "Self Projected";
  if (defined.has("ajna") || defined.has("head")) return "Mental";
  return "None";
}

function profileFromSuns(personalitySun: Activation, designSun: Activation): string {
  return `${personalitySun.line}/${designSun.line}`;
}

function incarnationCross(
  personalitySun: Activation,
  personalityEarth: Activation,
  designSun: Activation,
  designEarth: Activation
): { name: string; gates: [number, number, number, number] } {
  // Cross is named by the four gates: (P-Sun, P-Earth, D-Sun, D-Earth)
  // The "angle" (Right/Left/Juxtaposition) is determined by P-Sun.line:
  //   lines 1, 2, 4, 5 → Right Angle (personal karma)
  //   lines 3, 6       → Left Angle (transpersonal karma)
  //   if Personality and Design Sun lines are both odd OR both even (specific
  //   patterns) → Juxtaposition.
  const angle = personalitySun.line === 4 ? "Juxtaposition"
    : [1, 2, 4, 5].includes(personalitySun.line) ? "Right Angle"
    : "Left Angle";
  return {
    name: `${angle} Cross of (${personalitySun.gate}/${personalityEarth.gate} | ${designSun.gate}/${designEarth.gate})`,
    gates: [personalitySun.gate, personalityEarth.gate, designSun.gate, designEarth.gate],
  };
}

export interface HumanDesignChart {
  type: HumanDesignType;
  strategy: string;
  authority: Authority;
  profile: string;
  definition: "None" | "Single" | "Split" | "Triple Split" | "Quadruple Split";
  definedCenters: Center[];
  undefinedCenters: Center[];
  channels: { gates: [number, number]; name: string; centers: [Center, Center] }[];
  incarnationCross: { name: string; gates: [number, number, number, number] };
  personality: ChartHalf;
  design: ChartHalf;
}

const STRATEGY: Record<HumanDesignType, string> = {
  Reflector: "Wait a lunar cycle (28 days) before major decisions",
  Manifestor: "Inform before acting",
  Generator: "Wait to respond",
  "Manifesting Generator": "Wait to respond, then inform",
  Projector: "Wait for the invitation",
};

function definitionType(
  defined: Set<Center>,
  channels: Channel[]
): HumanDesignChart["definition"] {
  if (defined.size === 0) return "None";
  // Build adjacency among defined centers using channels
  const groups: Set<Center>[] = [];
  const visited = new Set<Center>();
  for (const start of defined) {
    if (visited.has(start)) continue;
    const group = new Set<Center>([start]);
    const stack: Center[] = [start];
    visited.add(start);
    while (stack.length) {
      const cur = stack.pop()!;
      for (const ch of channels) {
        let next: Center | null = null;
        if (ch.centers[0] === cur) next = ch.centers[1];
        else if (ch.centers[1] === cur) next = ch.centers[0];
        if (next && !visited.has(next)) {
          visited.add(next);
          group.add(next);
          stack.push(next);
        }
      }
    }
    groups.push(group);
  }
  switch (groups.length) {
    case 1: return "Single";
    case 2: return "Split";
    case 3: return "Triple Split";
    case 4: return "Quadruple Split";
    default: return "None";
  }
}

export interface HumanDesignInput extends BirthData {}

/**
 * Compute a Human Design body graph from birth data.
 *
 * Returns the BodyGraph: Type (Manifestor/Generator/MG/Projector/Reflector),
 * Strategy, Authority, Profile (e.g. "5/1"), Definition, defined and undefined
 * Centers, defined Channels, the Incarnation Cross, and both halves of the
 * chart (Personality at birth + Design 88° of solar arc earlier).
 *
 * Gate-wheel anchor: Gate 41 starts at 2°00' Aquarius (the Rave Mandala
 * convention used by Jovian Archive's official software).
 *
 * Note: HD output depends only on the birth instant in UT — `latitude` and
 * `longitude` in the BirthData input are accepted for API consistency but
 * not used in any HD calculation.
 *
 * @example
 *   calculateHumanDesign({
 *     datetime: "1961-07-01T19:45:00",
 *     timezone: "Europe/London",
 *     latitude: 52.833,
 *     longitude: 0.5,
 *   });
 */
export function calculateHumanDesign(input: HumanDesignInput): HumanDesignChart {
  const personalityJd = julianDayUT(input.datetime, input.timezone);
  const birthSun = calcPlanet(personalityJd, "sun");
  const designJd = designJulianDay(personalityJd, birthSun.longitude);

  const personalityActs = activationsFor(personalityJd);
  const designActs = activationsFor(designJd);

  const allActivated = new Set<number>();
  for (const a of personalityActs) allActivated.add(a.gate);
  for (const a of designActs) allActivated.add(a.gate);

  const channels = definedChannels(allActivated);
  const defined = definedCenters(channels);
  const undefined_ = ALL_CENTERS.filter((c) => !defined.has(c));

  const type = determineType(defined, channels);
  const authority = determineAuthority(defined, type);

  const pSun = personalityActs.find((a) => a.planet === "sun")!;
  const pEarth = personalityActs.find((a) => a.planet === "earth")!;
  const dSun = designActs.find((a) => a.planet === "sun")!;
  const dEarth = designActs.find((a) => a.planet === "earth")!;

  return {
    type,
    strategy: STRATEGY[type],
    authority,
    profile: profileFromSuns(pSun, dSun),
    definition: definitionType(defined, channels),
    definedCenters: [...defined],
    undefinedCenters: undefined_,
    channels: channels.map((c) => ({ gates: c.gates, name: c.name, centers: c.centers })),
    incarnationCross: incarnationCross(pSun, pEarth, dSun, dEarth),
    personality: { jd_ut: personalityJd, activations: personalityActs },
    design: { jd_ut: designJd, activations: designActs },
  };
}

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
import { crossThemeName } from "../constants/hd-crosses";
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

// Cross angle is determined by the Profile (Personality Sun line / Design Sun line).
// Canonical mapping per Ra Uru Hu's HD system: there are 12 valid profiles, each
// belonging to exactly one of three cross types.
const CROSS_ANGLE_BY_PROFILE: Record<string, "Right Angle" | "Left Angle" | "Juxtaposition"> = {
  "1/3": "Right Angle",
  "1/4": "Right Angle",
  "2/4": "Right Angle",
  "2/5": "Right Angle",
  "3/5": "Right Angle",
  "3/6": "Right Angle",
  "4/6": "Right Angle",
  "4/1": "Juxtaposition",
  "5/1": "Left Angle",
  "5/2": "Left Angle",
  "6/2": "Left Angle",
  "6/3": "Left Angle",
};

// HD Variables — canonical color → trait mappings per Ra Uru Hu's PHS.
// All four variables are sourced from the COLOR of their point (verified by
// reverse-engineering a MyBodyGraph reference chart 1998-04-08 06:30 New Orleans):
//   Digestion   ← Design Sun COLOR         (body, top-left)
//   Environment ← Design North Node COLOR  (body, bottom-left)
//   Perspective ← Personality N Node COLOR (mind, bottom-right)
//   Motivation  ← Personality Sun COLOR    (mind, top-right)
// Direction (Left=Strategic, Right=Receptive) comes from the TONE of the same
// point: tones 1-3 → Left, tones 4-6 → Right.
const DIGESTION_BY_COLOR: Record<number, string> = {
  1: "Appetite",
  2: "Taste",
  3: "Thirst",
  4: "Touch",
  5: "Sound",
  6: "Light",
};

const ENVIRONMENT_BY_COLOR: Record<number, string> = {
  1: "Caves",
  2: "Markets",
  3: "Kitchens",
  4: "Mountains",
  5: "Valleys",
  6: "Shores",
};

const PERSPECTIVE_BY_COLOR: Record<number, string> = {
  1: "Survival",
  2: "Possibility",
  3: "Power",
  4: "Wanting",
  5: "Probability",
  6: "Personal",
};

const MOTIVATION_BY_COLOR: Record<number, string> = {
  1: "Fear",
  2: "Hope",
  3: "Desire",
  4: "Need",
  5: "Guilt",
  6: "Innocence",
};

// Cognition (Design Sense) — the 5th PHS variable. Sourcing: Design Sun TONE.
// Verified against two MyBodyGraph reference charts (1998-04-08 New Orleans and
// 1974-01-03 Stockholm) where D.Sun.tone = 6 in both cases correctly produces
// "Touch". A third chart with a different D.Sun.tone would independently
// confirm the Sense wheel ordering below.
const COGNITION_BY_TONE: Record<number, string> = {
  1: "Smell",
  2: "Taste",
  3: "Outer Vision",
  4: "Inner Vision",
  5: "Feeling",
  6: "Touch",
};

function directionFromTone(tone: number): "Left" | "Right" {
  return tone <= 3 ? "Left" : "Right";
}

function computeVariables(
  pSun: Activation,
  dSun: Activation,
  pNode: Activation,
  dNode: Activation
): HumanDesignVariables {
  return {
    digestion: {
      source: "Design Sun",
      color: dSun.color,
      name: DIGESTION_BY_COLOR[dSun.color] ?? "Unknown",
      direction: directionFromTone(dSun.tone),
    },
    environment: {
      source: "Design North Node",
      color: dNode.color,
      name: ENVIRONMENT_BY_COLOR[dNode.color] ?? "Unknown",
      direction: directionFromTone(dNode.tone),
    },
    perspective: {
      source: "Personality North Node",
      color: pNode.color,
      name: PERSPECTIVE_BY_COLOR[pNode.color] ?? "Unknown",
      direction: directionFromTone(pNode.tone),
    },
    motivation: {
      source: "Personality Sun",
      color: pSun.color,
      name: MOTIVATION_BY_COLOR[pSun.color] ?? "Unknown",
      direction: directionFromTone(pSun.tone),
    },
    cognition: {
      source: "Design Sun",
      tone: dSun.tone,
      name: COGNITION_BY_TONE[dSun.tone] ?? "Unknown",
    },
  };
}

// Signature (aligned) and Not-Self (misaligned) themes are deterministic by Type.
const SIGNATURE_BY_TYPE: Record<HumanDesignType, string> = {
  Manifestor: "Peace",
  Generator: "Satisfaction",
  "Manifesting Generator": "Satisfaction",
  Projector: "Success",
  Reflector: "Surprise",
};

const NOT_SELF_BY_TYPE: Record<HumanDesignType, string> = {
  Manifestor: "Anger",
  Generator: "Frustration",
  "Manifesting Generator": "Frustration",
  Projector: "Bitterness",
  Reflector: "Disappointment",
};

function incarnationCross(
  personalitySun: Activation,
  personalityEarth: Activation,
  designSun: Activation,
  designEarth: Activation
): { name: string; gates: [number, number, number, number] } {
  const profile = `${personalitySun.line}/${designSun.line}`;
  const angle = CROSS_ANGLE_BY_PROFILE[profile] ?? "Right Angle";
  const theme = crossThemeName(personalitySun.gate, angle);
  return {
    name: `${angle} Cross of ${theme} (${personalitySun.gate}/${personalityEarth.gate} | ${designSun.gate}/${designEarth.gate})`,
    gates: [personalitySun.gate, personalityEarth.gate, designSun.gate, designEarth.gate],
  };
}

/**
 * PHS Variables — the "arrows" around the body graph plus Cognition (Sense).
 * The four arrow traits are sourced from the COLOR of their point; the arrow's
 * direction is determined by the TONE of the same point (tones 1-3 → Left,
 * tones 4-6 → Right). Cognition has no arrow direction — it's the tone of
 * the Design Sun mapped through the Sense wheel.
 */
export interface HumanDesignVariables {
  /** Top-left arrow: dietary regimen. From Design Sun's color. */
  digestion: { source: "Design Sun"; color: number; name: string; direction: "Left" | "Right" };
  /** Bottom-left arrow: optimal environment. From Design North Node's color. */
  environment: { source: "Design North Node"; color: number; name: string; direction: "Left" | "Right" };
  /** Bottom-right arrow: how the mind takes in information. From Personality North Node's color. */
  perspective: { source: "Personality North Node"; color: number; name: string; direction: "Left" | "Right" };
  /** Top-right arrow: underlying mental drive. From Personality Sun's color. */
  motivation: { source: "Personality Sun"; color: number; name: string; direction: "Left" | "Right" };
  /** Design Sense / sensory pathway. From Design Sun's tone. */
  cognition: { source: "Design Sun"; tone: number; name: string };
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
  variables: HumanDesignVariables;
  /** Aligned-state theme, determined by type. Manifestor=Peace, Generator/MG=Satisfaction, Projector=Success, Reflector=Surprise. */
  signature: string;
  /** Misaligned-state theme, determined by type. Manifestor=Anger, Generator/MG=Frustration, Projector=Bitterness, Reflector=Disappointment. */
  notSelfTheme: string;
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
  const pNode = personalityActs.find((a) => a.planet === "true_node")!;
  const dSun = designActs.find((a) => a.planet === "sun")!;
  const dEarth = designActs.find((a) => a.planet === "earth")!;
  const dNode = designActs.find((a) => a.planet === "true_node")!;

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
    variables: computeVariables(pSun, dSun, pNode, dNode),
    signature: SIGNATURE_BY_TYPE[type],
    notSelfTheme: NOT_SELF_BY_TYPE[type],
    personality: { jd_ut: personalityJd, activations: personalityActs },
    design: { jd_ut: designJd, activations: designActs },
  };
}

// Human Design channels: 36 pairs of gates that, when both activated, define
// a connection between two centers. The channel is named after both gates.
//
// Source: standard published Human Design charts (Ra Uru Hu's body graph).

export type Center =
  | "head"
  | "ajna"
  | "throat"
  | "g"
  | "heart" // also called "ego"
  | "spleen"
  | "sacral"
  | "solar_plexus"
  | "root";

export interface Channel {
  gates: [number, number];
  name: string;
  centers: [Center, Center];
}

export const CHANNELS: readonly Channel[] = [
  { gates: [64, 47], name: "Abstraction", centers: ["head", "ajna"] },
  { gates: [61, 24], name: "Awareness", centers: ["head", "ajna"] },
  { gates: [63, 4], name: "Logic", centers: ["head", "ajna"] },
  { gates: [17, 62], name: "Acceptance", centers: ["ajna", "throat"] },
  { gates: [43, 23], name: "Structuring", centers: ["ajna", "throat"] },
  { gates: [11, 56], name: "Curiosity", centers: ["ajna", "throat"] },
  { gates: [16, 48], name: "The Wavelength", centers: ["throat", "spleen"] },
  { gates: [20, 57], name: "The Brainwave", centers: ["throat", "spleen"] },
  { gates: [20, 10], name: "Awakening", centers: ["throat", "g"] },
  { gates: [31, 7], name: "The Alpha", centers: ["throat", "g"] },
  { gates: [8, 1], name: "Inspiration", centers: ["throat", "g"] },
  { gates: [33, 13], name: "The Prodigal", centers: ["throat", "g"] },
  { gates: [45, 21], name: "Money", centers: ["throat", "heart"] },
  { gates: [35, 36], name: "Transitoriness", centers: ["throat", "solar_plexus"] },
  { gates: [12, 22], name: "Openness", centers: ["throat", "solar_plexus"] },
  { gates: [23, 43], name: "Structuring", centers: ["throat", "ajna"] }, // duplicate channel direction
  { gates: [20, 34], name: "Charisma", centers: ["throat", "sacral"] },
  { gates: [10, 57], name: "Perfected Form", centers: ["g", "spleen"] },
  { gates: [10, 34], name: "Exploration", centers: ["g", "sacral"] },
  { gates: [25, 51], name: "Initiation", centers: ["g", "heart"] },
  { gates: [2, 14], name: "The Beat", centers: ["g", "sacral"] },
  { gates: [15, 5], name: "Rhythm", centers: ["g", "sacral"] },
  { gates: [46, 29], name: "Discovery", centers: ["g", "sacral"] },
  { gates: [40, 37], name: "Community", centers: ["heart", "solar_plexus"] },
  { gates: [26, 44], name: "Surrender", centers: ["heart", "spleen"] },
  { gates: [21, 45], name: "Money", centers: ["heart", "throat"] }, // mirror
  { gates: [48, 16], name: "The Wavelength", centers: ["spleen", "throat"] }, // mirror
  { gates: [57, 34], name: "Power", centers: ["spleen", "sacral"] },
  { gates: [28, 38], name: "Struggle", centers: ["spleen", "root"] },
  { gates: [18, 58], name: "Judgment", centers: ["spleen", "root"] },
  { gates: [32, 54], name: "Transformation", centers: ["spleen", "root"] },
  { gates: [50, 27], name: "Preservation", centers: ["spleen", "sacral"] },
  { gates: [34, 57], name: "Power", centers: ["sacral", "spleen"] }, // mirror
  { gates: [3, 60], name: "Mutation", centers: ["sacral", "root"] },
  { gates: [42, 53], name: "Maturation", centers: ["sacral", "root"] },
  { gates: [9, 52], name: "Concentration", centers: ["sacral", "root"] },
  { gates: [29, 46], name: "Discovery", centers: ["sacral", "g"] }, // mirror
  { gates: [59, 6], name: "Mating", centers: ["sacral", "solar_plexus"] },
  { gates: [55, 39], name: "Emoting", centers: ["solar_plexus", "root"] },
  { gates: [49, 19], name: "Synthesis", centers: ["solar_plexus", "root"] },
  { gates: [30, 41], name: "Recognition", centers: ["solar_plexus", "root"] },
];

// Find a channel by an unordered gate pair. Returns null if not a valid channel.
export function findChannel(gateA: number, gateB: number): Channel | null {
  for (const ch of CHANNELS) {
    const [a, b] = ch.gates;
    if ((a === gateA && b === gateB) || (a === gateB && b === gateA)) return ch;
  }
  return null;
}

export const ALL_CENTERS: readonly Center[] = [
  "head",
  "ajna",
  "throat",
  "g",
  "heart",
  "spleen",
  "sacral",
  "solar_plexus",
  "root",
];

// Motors in HD (used for type determination)
export const MOTOR_CENTERS: readonly Center[] = ["sacral", "solar_plexus", "heart", "root"];

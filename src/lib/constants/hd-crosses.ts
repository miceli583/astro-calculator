// Canonical Incarnation Cross names (192 crosses = 64 gates × 3 angle types).
//
// Primary source: loveyourhumandesign.com/incarnation-crosses/
// Secondary source (used to correct wrong entries): ahumandesign.com/incarnation-cross/
//
// Data was cross-verified two ways:
//   1. RA quaternary invariant — the 64 gates group into exactly 16 quaternaries
//      of 4 gates each, and all 4 gates in a quaternary share the same RA name
//      (Sphinx, Explanation, Tension, etc.). Any gate whose RA name doesn't
//      match its quaternary is wrong.
//   2. LA/J quaternary pairing — each quaternary's LA/J themes pair with a
//      specific "opposite" quaternary in a canonical rotation.
//
// The primary source had errors in gates 59-64 (wrong D.Sun pairings, which
// bled into wrong theme names for RA/J/LA). Those were corrected against the
// secondary source and the quaternary pattern.
//
// Regression-verified against MyBodyGraph on chart with Personality Sun = 38,
// profile 3/5 → "Right Angle Cross of Tension (38/39 | 48/21)".
//
// Key: Personality Sun gate (1-64).
// Value: name for each of the 3 angle types (Right Angle, Left Angle,
// Juxtaposition). The angle is determined by the profile; see
// CROSS_ANGLE_BY_PROFILE in human-design.ts.
//
// Names are the bare theme (e.g., "Tension", "the Sphinx"). The wrapper
// function prepends "{Angle} Cross of " when formatting the full name.
// Numeric suffixes from the source (e.g., "Tension 4") are dropped to match
// MyBodyGraph's output convention.

interface CrossNames {
  /** Right Angle Cross name (personal geometry — 7 profiles). */
  RA: string;
  /** Left Angle Cross name (transpersonal geometry — 4 profiles). */
  LA: string;
  /** Juxtaposition Cross name (fixed geometry — profile 4/1 only). */
  J: string;
}

export const CROSS_NAMES_BY_PERSONALITY_SUN_GATE: Record<number, CrossNames> = {
  1:  { RA: "the Sphinx",         J: "Self-Expression", LA: "Defiance" },
  2:  { RA: "the Sphinx",         J: "the Driver",      LA: "Defiance" },
  3:  { RA: "Laws",               J: "Mutation",        LA: "Wishes" },
  4:  { RA: "Explanation",        J: "Formulization",   LA: "Revolution" },
  5:  { RA: "Consciousness",      J: "Habits",          LA: "Separation" },
  6:  { RA: "Eden",               J: "Conflict",        LA: "the Plane" },
  7:  { RA: "the Sphinx",         J: "Interaction",     LA: "Masks" },
  8:  { RA: "Contagion",          J: "Contribution",    LA: "Uncertainty" },
  9:  { RA: "Planning",           J: "Focus",           LA: "Identification" },
  10: { RA: "the Vessel of Love", J: "Behavior",        LA: "Prevention" },
  11: { RA: "Eden",               J: "Ideas",           LA: "Education" },
  12: { RA: "Eden",               J: "Articulation",    LA: "Education" },
  13: { RA: "the Sphinx",         J: "Listening",       LA: "Masks" },
  14: { RA: "Contagion",          J: "Empowering",      LA: "Uncertainty" },
  15: { RA: "the Vessel of Love", J: "Extremes",        LA: "Prevention" },
  16: { RA: "Planning",           J: "Experimentation", LA: "Identification" },
  17: { RA: "Service",            J: "Opinions",        LA: "Upheaval" },
  18: { RA: "Service",            J: "Correction",      LA: "Upheaval" },
  19: { RA: "the Four Ways",      J: "Need",            LA: "Refinement" },
  20: { RA: "the Sleeping Phoenix", J: "the Now",       LA: "Duality" },
  21: { RA: "Tension",            J: "Control",         LA: "Endeavour" },
  22: { RA: "Rulership",          J: "Grace",           LA: "Informing" },
  23: { RA: "Explanation",        J: "Assimilation",    LA: "Dedication" },
  24: { RA: "the Four Ways",      J: "Rationalization", LA: "Incarnation" },
  25: { RA: "the Vessel of Love", J: "Innocence",       LA: "Healing" },
  26: { RA: "Rulership",          J: "the Trickster",   LA: "Confrontation" },
  27: { RA: "the Unexpected",     J: "Caring",          LA: "Alignment" },
  28: { RA: "the Unexpected",     J: "Risks",           LA: "Alignment" },
  29: { RA: "Contagion",          J: "Commitment",      LA: "Industry" },
  30: { RA: "Contagion",          J: "Fates",           LA: "Industry" },
  31: { RA: "the Unexpected",     J: "Influence",       LA: "the Alpha" },
  32: { RA: "Maya",               J: "Conservation",    LA: "Limitation" },
  33: { RA: "the Four Ways",      J: "Retreat",         LA: "Refinement" },
  34: { RA: "the Sleeping Phoenix", J: "Power",         LA: "Duality" },
  35: { RA: "Consciousness",      J: "Experience",      LA: "Separation" },
  36: { RA: "Eden",               J: "Crisis",          LA: "the Plane" },
  37: { RA: "Planning",           J: "Bargains",        LA: "Migration" },
  38: { RA: "Tension",            J: "Opposition",      LA: "Individualism" },
  39: { RA: "Tension",            J: "Provocation",     LA: "Individualism" },
  40: { RA: "Planning",           J: "Denial",          LA: "Migration" },
  41: { RA: "the Unexpected",     J: "Fantasy",         LA: "the Alpha" },
  42: { RA: "Maya",               J: "Completion",      LA: "Limitation" },
  43: { RA: "Explanation",        J: "Insight",         LA: "Dedication" },
  44: { RA: "the Four Ways",      J: "Alertness",       LA: "Incarnation" },
  45: { RA: "Rulership",          J: "Possession",      LA: "Confrontation" },
  46: { RA: "the Vessel of Love", J: "Serendipity",     LA: "Healing" },
  47: { RA: "Rulership",          J: "Oppression",      LA: "Informing" },
  48: { RA: "Tension",            J: "Depth",           LA: "Endeavour" },
  49: { RA: "Explanation",        J: "Principles",      LA: "Revolution" },
  50: { RA: "Laws",               J: "Values",          LA: "Wishes" },
  51: { RA: "Penetration",        J: "Shock",           LA: "the Clarion" },
  52: { RA: "Service",            J: "Stillness",       LA: "Demands" },
  53: { RA: "Penetration",        J: "Beginnings",      LA: "Cycles" },
  54: { RA: "Penetration",        J: "Ambition",        LA: "Cycles" },
  55: { RA: "the Sleeping Phoenix", J: "Moods",         LA: "Spirit" },
  56: { RA: "Laws",               J: "Stimulation",     LA: "Distraction" },
  57: { RA: "Penetration",        J: "Intuition",       LA: "the Clarion" },
  58: { RA: "Service",            J: "Vitality",        LA: "Demands" },
  59: { RA: "the Sleeping Phoenix", J: "Strategy",      LA: "Spirit" },
  60: { RA: "Laws",               J: "Limitation",      LA: "Distraction" },
  61: { RA: "Maya",               J: "Thinking",        LA: "Obscuration" },
  62: { RA: "Maya",               J: "Detail",          LA: "Obscuration" },
  63: { RA: "Consciousness",      J: "Doubts",          LA: "Dominion" },
  64: { RA: "Consciousness",      J: "Confusion",       LA: "Dominion" },
};

export type CrossAngle = "Right Angle" | "Left Angle" | "Juxtaposition";

/** Look up the theme name for a cross given the Personality Sun gate + angle. */
export function crossThemeName(personalitySunGate: number, angle: CrossAngle): string {
  const entry = CROSS_NAMES_BY_PERSONALITY_SUN_GATE[personalitySunGate];
  if (!entry) return "Unknown";
  switch (angle) {
    case "Right Angle": return entry.RA;
    case "Left Angle": return entry.LA;
    case "Juxtaposition": return entry.J;
  }
}

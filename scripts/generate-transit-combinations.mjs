// Emit the full sign-flavored transit-theme combination manifest.
//
// Produces src/lib/constants/transit-combinations.json — 17,784 entries
// covering every (transitPlanet × natalPoint × aspect × natalSign) tuple that
// a themed prose-generation pass would need to fill in: ALL 13 modeled
// transit points × ALL 19 modeled natal points × the 6 agreed aspects × 12
// signs. This file is the input contract for that later prose pass (see
// docs/transits-spec.md §7).
//
// The dimension sets here MUST stay in lockstep with
// src/lib/constants/transit-matrix.ts — a unit test
// (tests/transit-matrix.test.ts) asserts set equality, so a drift in either
// place fails CI.
//
// House context (natal house, transit sign/house) is deliberately NOT crossed
// into the manifest keys — that would be a ~30.7M-entry file. Those factors
// are runtime annotations: every aspect hit the API returns carries them plus
// a full `comboKey` (see buildComboKey in src/lib/calculators/overlay.ts),
// of which the manifest key is a stable prefix.
//
// Run: node scripts/generate-transit-combinations.mjs
// Output: src/lib/constants/transit-combinations.json (~4 MB pretty-printed)

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "src", "lib", "constants", "transit-combinations.json");

// Shared planet natures — used on both the transit and natal side.
const PLANET_NATURES = {
  sun:        "core identity, vitality, conscious will",
  moon:       "emotional nature, inner life, subconscious rhythms",
  mercury:    "mind, communication, learning, everyday movement",
  venus:      "love, values, aesthetics, relating and attraction",
  mars:       "drive, assertion, sexuality, how you take action",
  jupiter:    "expansion, opportunity, faith, growth",
  saturn:     "structure, responsibility, limitation, mastery through discipline",
  chiron:     "the wound and the wisdom that grows from tending it",
  uranus:     "sudden change, awakening, liberation, disruption",
  neptune:    "dissolution, spirituality, illusion, transcendence",
  pluto:      "deep transformation, power, death and rebirth, the unavoidable",
  true_node:  "karmic direction, the growth path, evolutionary purpose",
  south_node: "past patterns, karmic inheritance, familiar gifts to release",
};

// ALL modeled transit points — every body the sky snapshot returns, fast and
// slow (fast-planet prose reads as hours-to-days weather rather than
// multi-week themes; the manifest carries both so no combination is missing).
const TRANSIT_PLANETS = [
  "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "chiron",
  "uranus", "neptune", "pluto", "true_node", "south_node",
].map((name) => ({ name, nature: PLANET_NATURES[name] }));

// ALL modeled natal points: every default natal planet + South Node, the four
// chart angles, the Vertex, and the Part of Fortune.
const NATAL_POINTS = [
  ...[
    "sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus",
    "neptune", "pluto", "true_node", "chiron", "south_node",
  ].map((name) => ({ name, nature: PLANET_NATURES[name] })),
  { name: "asc",             nature: "self-presentation, life direction, embodied identity" },
  { name: "mc",              nature: "career, public reputation, life's calling" },
  { name: "ic",              nature: "roots, home, ancestral foundation, private self" },
  { name: "dsc",             nature: "partnership, the other, what you project onto relationships" },
  { name: "vertex",          nature: "fated encounters, destined turning points through others" },
  { name: "part_of_fortune", nature: "material well-being, where joy and flow are found" },
];

const ASPECTS = [
  { name: "conjunction", angle: 0,   nature: "fusion, merging, intensification of the natal theme" },
  { name: "sextile",     angle: 60,  nature: "opportunity, gentle flow, invitation to act" },
  { name: "square",      angle: 90,  nature: "tension, growth-forcing friction, decisive challenge" },
  { name: "trine",       angle: 120, nature: "harmony, natural flow, gift energy" },
  { name: "quincunx",    angle: 150, nature: "awkward integration, adjustment required, blind spot" },
  { name: "opposition",  angle: 180, nature: "polarization, mirror through the other, confrontation" },
];

const SIGNS = [
  { name: "Aries",       nature: "initiation, courage, self-assertion, raw start-energy" },
  { name: "Taurus",      nature: "stability, embodiment, values, sensuality, resource" },
  { name: "Gemini",      nature: "curiosity, communication, plurality, quick synthesis" },
  { name: "Cancer",      nature: "nurture, memory, belonging, emotional container" },
  { name: "Leo",         nature: "creative self-expression, generosity, warmth, presence" },
  { name: "Virgo",       nature: "discernment, refinement, service, precise attention" },
  { name: "Libra",       nature: "relatedness, aesthetics, balance, negotiated harmony" },
  { name: "Scorpio",     nature: "depth, intimacy, power, willingness to transform" },
  { name: "Sagittarius", nature: "meaning-making, exploration, faith, expansion" },
  { name: "Capricorn",   nature: "mastery, structure, ambition, mature responsibility" },
  { name: "Aquarius",    nature: "vision, individuation, community, systemic thinking" },
  { name: "Pisces",      nature: "surrender, mystical connection, dissolution of self" },
];

const keys = [];
for (const tp of TRANSIT_PLANETS) {
  for (const np of NATAL_POINTS) {
    for (const asp of ASPECTS) {
      for (const sign of SIGNS) {
        keys.push(`${tp.name}.${asp.name}.${np.name}.${sign.name}`);
      }
    }
  }
}

// Cardinality sanity check — 13 × 19 × 6 × 12 = 17,784
const expected = TRANSIT_PLANETS.length * NATAL_POINTS.length * ASPECTS.length * SIGNS.length;
if (keys.length !== expected) {
  throw new Error(`Expected ${expected} combinations, generated ${keys.length}`);
}
if (new Set(keys).size !== keys.length) {
  throw new Error("Duplicate combination keys generated");
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      // v2: dimension-based manifest. v1 repeated every dimension's nature
      // strings inside all 4,536 entries (13.7 MB at full cardinality); v2
      // states each dimension once, materializes the full key list, and keeps
      // `prose` as a key→prose map for the later prose pass. All prose was
      // empty in every published v1 file, so no information is lost.
      version: 2,
      generatedAt: new Date().toISOString(),
      keyFormat:
        "<transitPlanet>.<aspect>.<natalPoint>.<natalSign> — the runtime comboKey on API aspect hits " +
        "extends this with .h<natalHouse>.<transitSign>.h<transitHouse> where applicable (house " +
        "segments are h-prefixed; segments are omitted when not computable, e.g. no natal cusps).",
      cardinality: {
        transitPlanets: TRANSIT_PLANETS.length,
        natalPoints: NATAL_POINTS.length,
        aspects: ASPECTS.length,
        signs: SIGNS.length,
        total: keys.length,
      },
      dimensions: {
        transitPlanets: TRANSIT_PLANETS,
        natalPoints: NATAL_POINTS,
        aspects: ASPECTS,
        signs: SIGNS,
      },
      combinations: keys,
      // Prose contract: map of combination key → { title, summary, expanded,
      // keywords } filled in by a later prose-generation pass. Ships empty.
      prose: {},
    },
    null,
    2
  )
);

console.log(`Wrote ${keys.length} transit combinations → ${OUTPUT_PATH}`);

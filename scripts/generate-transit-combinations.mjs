// Emit the full sign-flavored transit-theme combination manifest.
//
// Produces src/lib/constants/transit-combinations.json — 4,536 entries covering
// every (transitPlanet × natalPoint × aspect × natalSign) tuple that a themed
// prose-generation pass would need to fill in. This file is the input contract
// for that later prose pass (see docs/transits-spec.md §7.4).
//
// The output ships prose-free — every entry has a `key` and `structured` block
// describing the astrological meaning primitives (transit planet, natal point,
// aspect, natal sign, natural nature of each), plus an empty `prose` field for
// later population.
//
// Run: node scripts/generate-transit-combinations.mjs
// Output: src/lib/constants/transit-combinations.json (~1 MB pretty-printed)

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "..", "src", "lib", "constants", "transit-combinations.json");

// Meaningful transit planets — the slow ones plus Jupiter and the Nodes.
// Sun/Moon/Mercury/Venus/Mars move too fast to warrant themed multi-week prose.
const TRANSIT_PLANETS = [
  { name: "jupiter",   nature: "expansion, opportunity, faith, growth" },
  { name: "saturn",    nature: "structure, responsibility, limitation, mastery through discipline" },
  { name: "chiron",    nature: "the wound and the wisdom that grows from tending it" },
  { name: "uranus",    nature: "sudden change, awakening, liberation, disruption" },
  { name: "neptune",   nature: "dissolution, spirituality, illusion, transcendence" },
  { name: "pluto",     nature: "deep transformation, power, death and rebirth, the unavoidable" },
  { name: "true_node", nature: "karmic direction, the growth path, evolutionary purpose" },
];

// Natal points that carry theme weight when transited.
const NATAL_POINTS = [
  { name: "sun",     nature: "core identity, vitality, conscious will" },
  { name: "moon",    nature: "emotional nature, inner life, subconscious rhythms" },
  { name: "mercury", nature: "mind, communication, learning, everyday movement" },
  { name: "venus",   nature: "love, values, aesthetics, relating and attraction" },
  { name: "mars",    nature: "drive, assertion, sexuality, how you take action" },
  { name: "asc",     nature: "self-presentation, life direction, embodied identity" },
  { name: "mc",      nature: "career, public reputation, life's calling" },
  { name: "ic",      nature: "roots, home, ancestral foundation, private self" },
  { name: "dsc",     nature: "partnership, the other, what you project onto relationships" },
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

const combinations = [];
for (const tp of TRANSIT_PLANETS) {
  for (const np of NATAL_POINTS) {
    for (const asp of ASPECTS) {
      for (const sign of SIGNS) {
        combinations.push({
          key: `${tp.name}.${asp.name}.${np.name}.${sign.name}`,
          structured: {
            transitPlanet: { name: tp.name, nature: tp.nature },
            aspect:        { name: asp.name, angle: asp.angle, nature: asp.nature },
            natalPoint:    { name: np.name, nature: np.nature },
            natalSign:     { name: sign.name, nature: sign.nature },
          },
          prose: {
            title: "",
            summary: "",
            expanded: "",
            keywords: [],
          },
        });
      }
    }
  }
}

// Cardinality sanity check — 7 × 9 × 6 × 12 = 4,536
const expected = TRANSIT_PLANETS.length * NATAL_POINTS.length * ASPECTS.length * SIGNS.length;
if (combinations.length !== expected) {
  throw new Error(`Expected ${expected} combinations, generated ${combinations.length}`);
}

mkdirSync(dirname(OUTPUT_PATH), { recursive: true });
writeFileSync(
  OUTPUT_PATH,
  JSON.stringify(
    {
      version: 1,
      generatedAt: new Date().toISOString(),
      cardinality: {
        transitPlanets: TRANSIT_PLANETS.length,
        natalPoints: NATAL_POINTS.length,
        aspects: ASPECTS.length,
        signs: SIGNS.length,
        total: combinations.length,
      },
      combinations,
    },
    null,
    2
  )
);

console.log(`Wrote ${combinations.length} transit combinations → ${OUTPUT_PATH}`);

import { describe, it, expect } from "vitest";
import { CROSS_NAMES_BY_PERSONALITY_SUN_GATE } from "@/lib/constants/hd-crosses";

// Ra Uru Hu's canonical 16 Right-Angle quaternaries. Each of the 64 gates is
// P.Sun in exactly one Right-Angle cross, and all 4 gates in the same
// quaternary share the same RA theme. This is a strong structural check —
// if any single entry in CROSS_NAMES_BY_PERSONALITY_SUN_GATE has a typo or
// wrong theme, this test will catch it.
const RA_QUATERNARIES: Record<string, number[]> = {
  "the Sphinx": [1, 2, 7, 13],
  "Explanation": [4, 23, 43, 49],
  "the Four Ways": [19, 24, 33, 44],
  "Consciousness": [5, 35, 63, 64],
  "Eden": [6, 11, 12, 36],
  "Contagion": [8, 14, 29, 30],
  "Planning": [9, 16, 37, 40],
  "the Vessel of Love": [10, 15, 25, 46],
  "Service": [17, 18, 52, 58],
  "the Sleeping Phoenix": [20, 34, 55, 59],
  "Tension": [21, 38, 39, 48],
  "Rulership": [22, 26, 45, 47],
  "the Unexpected": [27, 28, 31, 41],
  "Maya": [32, 42, 61, 62],
  "Laws": [3, 50, 56, 60],
  "Penetration": [51, 53, 54, 57],
};

// LA pairs — each RA quaternary's LA theme splits its 4 gates into 2 pairs,
// each pair sharing an LA theme.
const LA_PAIRS: [string, number[]][] = [
  ["Defiance", [1, 2]],
  ["Masks", [7, 13]],
  ["Revolution", [4, 49]],
  ["Dedication", [23, 43]],
  ["Refinement", [19, 33]],
  ["Incarnation", [24, 44]],
  ["Separation", [5, 35]],
  ["Dominion", [63, 64]],
  ["the Plane", [6, 36]],
  ["Education", [11, 12]],
  ["Uncertainty", [8, 14]],
  ["Industry", [29, 30]],
  ["Identification", [9, 16]],
  ["Migration", [37, 40]],
  ["Prevention", [10, 15]],
  ["Healing", [25, 46]],
  ["Upheaval", [17, 18]],
  ["Demands", [52, 58]],
  ["Duality", [20, 34]],
  ["Spirit", [55, 59]],
  ["Endeavour", [21, 48]],
  ["Individualism", [38, 39]],
  ["Informing", [22, 47]],
  ["Confrontation", [26, 45]],
  ["the Alpha", [31, 41]],
  ["Alignment", [27, 28]],
  ["Limitation", [32, 42]],
  ["Obscuration", [61, 62]],
  ["Wishes", [3, 50]],
  ["Distraction", [56, 60]],
  ["the Clarion", [51, 57]],
  ["Cycles", [53, 54]],
];

describe("Incarnation Cross lookup — structural invariants", () => {
  it("has an entry for every gate 1-64", () => {
    for (let g = 1; g <= 64; g++) {
      expect(CROSS_NAMES_BY_PERSONALITY_SUN_GATE[g], `missing entry for gate ${g}`).toBeDefined();
    }
  });

  it("RA name is consistent across each canonical quaternary", () => {
    for (const [theme, gates] of Object.entries(RA_QUATERNARIES)) {
      for (const g of gates) {
        expect(
          CROSS_NAMES_BY_PERSONALITY_SUN_GATE[g].RA,
          `gate ${g} should have RA "${theme}"`
        ).toBe(theme);
      }
    }
  });

  it("LA name is consistent across each canonical LA pair", () => {
    for (const [theme, gates] of LA_PAIRS) {
      for (const g of gates) {
        expect(
          CROSS_NAMES_BY_PERSONALITY_SUN_GATE[g].LA,
          `gate ${g} should have LA "${theme}"`
        ).toBe(theme);
      }
    }
  });

  it("every J theme is a non-empty string", () => {
    for (let g = 1; g <= 64; g++) {
      expect(CROSS_NAMES_BY_PERSONALITY_SUN_GATE[g].J.length).toBeGreaterThan(0);
    }
  });
});

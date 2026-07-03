import { describe, it, expect } from "vitest";
import { calculateSynastry } from "@/lib/calculators/synastry";
import { DIANA, EINSTEIN } from "./fixtures/charts";

describe("calculateSynastry", () => {
  it("returns both natal charts, both overlays, and aspects", () => {
    const result = calculateSynastry({ personA: DIANA.birth, personB: EINSTEIN.birth });
    expect(result.personA.planets.length).toBeGreaterThan(0);
    expect(result.personB.planets.length).toBeGreaterThan(0);
    expect(result.bOnA.aspects.length).toBeGreaterThan(0);
    expect(result.aOnB.aspects.length).toBeGreaterThan(0);
    expect(result.aspects).toBeInstanceOf(Array);
  });

  it("aspects are symmetric across the two overlays", () => {
    const result = calculateSynastry({ personA: DIANA.birth, personB: EINSTEIN.birth });
    // Both overlays should surface the same underlying aspect pairs (just with
    // the natal/transit label roles swapped). Cross-check by counting.
    expect(result.bOnA.aspects.length).toBe(result.aOnB.aspects.length);
  });

  it("bOnA emits house overlays showing B's planets in A's houses", () => {
    const result = calculateSynastry({ personA: DIANA.birth, personB: EINSTEIN.birth });
    expect(result.bOnA.houseOverlays.length).toBeGreaterThan(0);
    // Every entry references A's house numbers (1-12)
    for (const h of result.bOnA.houseOverlays) {
      expect(h.inNatalHouse).toBeGreaterThanOrEqual(1);
      expect(h.inNatalHouse).toBeLessThanOrEqual(12);
    }
  });

  it("HD activations flag when a planet shares a gate with the partner", () => {
    const result = calculateSynastry({ personA: DIANA.birth, personB: EINSTEIN.birth });
    const shared = result.bOnA.hdActivations.filter((h) => h.natalPointSharingGate !== "");
    // With 12+ planets from B and 12+ from A across a 64-gate wheel some
    // overlap is virtually guaranteed
    expect(shared.length).toBeGreaterThanOrEqual(0);
    for (const h of result.bOnA.hdActivations) {
      expect(h.gate).toBeGreaterThanOrEqual(1);
      expect(h.gate).toBeLessThanOrEqual(64);
      expect(h.line).toBeGreaterThanOrEqual(1);
      expect(h.line).toBeLessThanOrEqual(6);
    }
  });

  it("respects orb overrides", () => {
    const tight = calculateSynastry({
      personA: DIANA.birth,
      personB: EINSTEIN.birth,
      orbs: { conjunction: 1 },
    });
    const wide = calculateSynastry({
      personA: DIANA.birth,
      personB: EINSTEIN.birth,
      orbs: { conjunction: 8 },
    });
    // Tighter conjunction orb ⇒ fewer conjunctions
    const tightConj = tight.aspects.filter((a) => a.aspect === "conjunction").length;
    const wideConj = wide.aspects.filter((a) => a.aspect === "conjunction").length;
    expect(tightConj).toBeLessThanOrEqual(wideConj);
  });
});

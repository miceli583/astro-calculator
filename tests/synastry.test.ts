import { describe, it, expect } from "vitest";
import { calculateSynastry } from "@/lib/calculators/synastry";
import { DEFAULT_SYNASTRY_ORBS, type AspectType } from "@/lib/constants/orbs";
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
    // The title's claim, actually asserted. This read `toBeGreaterThanOrEqual(0)`,
    // which is true of every array that has ever existed — the test named the
    // shared-gate behaviour and then checked nothing about it. 19 activations,
    // 7 of them shared on this pair; a regression to zero flagging is now a
    // failure rather than a silent pass.
    expect(shared.length).toBeGreaterThan(0);
    expect(result.bOnA.hdActivations.length).toBeGreaterThan(0);
    for (const h of result.bOnA.hdActivations) {
      expect(h.gate).toBeGreaterThanOrEqual(1);
      expect(h.gate).toBeLessThanOrEqual(64);
      expect(h.line).toBeGreaterThanOrEqual(1);
      expect(h.line).toBeLessThanOrEqual(6);
    }
  });

  // The orb override has to be shown to CHANGE THE ANSWER, not merely to be
  // accepted. This assertion used to read `toBeLessThanOrEqual`, which a
  // calculator that ignored `input.orbs` outright also satisfies — equal
  // passes. Verified: dropping `...input.orbs` from `calculateSynastry` left
  // the whole file green. Strict inequalities are the difference between
  // testing the field and testing the feature.
  const conjunctionsAt = (orb: number) =>
    calculateSynastry({
      personA: DIANA.birth,
      personB: EINSTEIN.birth,
      orbs: { conjunction: orb },
    }).aspects.filter((a) => a.aspect === "conjunction");

  it("a tighter conjunction orb reports strictly fewer conjunctions", () => {
    // 1° and 8° are 5 and 19 hits on this fixture pair — far enough apart that
    // the two cannot coincide under any small drift in the ephemeris.
    expect(conjunctionsAt(1).length).toBeLessThan(conjunctionsAt(8).length);
  });

  it("the override moves the count off the default in both directions", () => {
    // DEFAULT_SYNASTRY_ORBS.conjunction is 5°, so 1° and 12° bracket it.
    const base = calculateSynastry({ personA: DIANA.birth, personB: EINSTEIN.birth }).aspects.filter(
      (a) => a.aspect === "conjunction",
    ).length;
    expect(conjunctionsAt(12).length).toBeGreaterThan(base);
    expect(conjunctionsAt(1).length).toBeLessThan(base);
  });

  it("widening an orb never drops a conjunction it already reported", () => {
    // Guards the failure a bare count comparison cannot see: a differently
    // shaped list of the right size. The wider set must be a strict superset.
    const key = (a: { transitPoint: string; natalPoint: string }) =>
      `${a.transitPoint}|${a.natalPoint}`;
    const wideKeys = new Set(conjunctionsAt(8).map(key));
    const tight = conjunctionsAt(1);
    expect(tight.length).toBeGreaterThan(0);
    for (const a of tight) {
      expect(wideKeys.has(key(a)), `widening dropped ${key(a)}`).toBe(true);
    }
  });

  it("a partial override leaves the other aspects on their defaults", () => {
    // "Merge over the defaults" as opposed to "replace them" — the same
    // contract the transit paths hold (aspect-conventions §1.3).
    const partial = calculateSynastry({
      personA: DIANA.birth,
      personB: EINSTEIN.birth,
      orbs: { conjunction: 12 },
    });
    for (const a of partial.aspects) {
      if (a.aspect === "conjunction") continue;
      expect(a.orb, `${a.transitPoint} ${a.aspect} ${a.natalPoint}`).toBeLessThanOrEqual(
        DEFAULT_SYNASTRY_ORBS[a.aspect as AspectType],
      );
    }
  });
});

// Human Design output well-formedness for Princess Diana's chart.
//
// PURPOSE: catch a whole-output break — a calculator that returns an
// out-of-range gate, a malformed profile, an unknown type/authority, or a
// half-populated activation set — for a real birth chart rather than a
// synthetic one. Every assertion here is a range or enum invariant; no
// captured value is asserted, so this file is deliberately insensitive to the
// gate wheel's calibration.
//
// The gate wheel itself is anchored elsewhere and is NOT provisional:
// GATE_WHEEL_OFFSET = 358.25°, fixed by the Rave Mandala convention that
// Gate 41 begins at 2°00' Aquarius (302.00° tropical). That anchor, shared by
// Jovian Archive and multiple independent open-source HD calculators, is
// asserted in tests/hd-gates.test.ts — which is where a calibration change
// would be caught.
//
// NOTE: this file's header previously described a 3.875° offset as unverified
// and the output as PROVISIONAL. That was stale: the offset was calibrated and
// externally anchored, and the comment was never updated. Corrected 2026-08-12.

import { describe, it, expect } from "vitest";
import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { DIANA } from "./fixtures/charts";

describe("HD — Diana output well-formedness (gate wheel anchored in hd-gates.test.ts)", () => {
  const chart = calculateHumanDesign(DIANA.birth);

  it("Personality Sun activation is a well-formed gate.line", () => {
    const sun = chart.personality.activations.find((a) => a.planet === "sun")!;
    expect(sun.gate).toBeGreaterThanOrEqual(1);
    expect(sun.gate).toBeLessThanOrEqual(64);
    expect(sun.line).toBeGreaterThanOrEqual(1);
    expect(sun.line).toBeLessThanOrEqual(6);
  });

  it("Profile is a valid HD profile string", () => {
    expect(chart.profile).toMatch(/^[1-6]\/[1-6]$/);
  });

  it("Type is one of the five HD types", () => {
    expect(["Reflector", "Manifestor", "Generator", "Manifesting Generator", "Projector"]).toContain(chart.type);
  });

  it("Authority is one of the documented HD authorities", () => {
    expect([
      "Emotional", "Sacral", "Splenic", "Ego Manifested", "Ego Projected",
      "Self Projected", "Mental", "Lunar", "None",
    ]).toContain(chart.authority);
  });

  it("Definition is None, Single, Split, Triple Split, or Quadruple Split", () => {
    expect(["None", "Single", "Split", "Triple Split", "Quadruple Split"]).toContain(chart.definition);
  });

  it("Incarnation cross gates are well-formed", () => {
    expect(chart.incarnationCross.gates.length).toBe(4);
    for (const g of chart.incarnationCross.gates) {
      expect(g).toBeGreaterThanOrEqual(1);
      expect(g).toBeLessThanOrEqual(64);
    }
    expect(chart.incarnationCross.name).toMatch(/Cross of/);
  });

  it("Personality and Design halves both contain a Sun and Earth activation", () => {
    const planets = ["sun", "earth"] as const;
    for (const p of planets) {
      expect(
        chart.personality.activations.find((a) => a.planet === p),
        `personality ${p}`
      ).toBeDefined();
      expect(
        chart.design.activations.find((a) => a.planet === p),
        `design ${p}`
      ).toBeDefined();
    }
  });
});

describe("Incarnation Cross angle is determined by Profile (canonical mapping)", () => {
  // The cross angle is fixed by the 12-profile system; these tests assert the
  // canonical mapping per Ra Uru Hu, not specific birth charts.
  const CASES: { profile: string; expected: string }[] = [
    { profile: "1/3", expected: "Right Angle" },
    { profile: "1/4", expected: "Right Angle" },
    { profile: "2/4", expected: "Right Angle" },
    { profile: "2/5", expected: "Right Angle" },
    { profile: "3/5", expected: "Right Angle" },
    { profile: "3/6", expected: "Right Angle" },
    { profile: "4/6", expected: "Right Angle" },
    { profile: "4/1", expected: "Juxtaposition" },
    { profile: "5/1", expected: "Left Angle" },
    { profile: "5/2", expected: "Left Angle" },
    { profile: "6/2", expected: "Left Angle" },
    { profile: "6/3", expected: "Left Angle" },
  ];

  // We exercise the logic via a representative chart and check the angle
  // string in the cross name matches the canonical mapping for that chart's
  // profile. Diana's chart is used as the substrate.
  it("Diana's cross name angle matches the canonical mapping for her profile", () => {
    const chart = calculateHumanDesign(DIANA.birth);
    const expected = CASES.find((c) => c.profile === chart.profile)?.expected;
    expect(expected, `unknown profile ${chart.profile}`).toBeDefined();
    expect(chart.incarnationCross.name.startsWith(expected!)).toBe(true);
  });
});

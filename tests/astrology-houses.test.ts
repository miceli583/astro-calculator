// House cusp + angle accuracy tests.
//
// Tests cusps for the Placidus system (the default and most commonly published)
// against Astrodienst's reference values for Princess Diana's chart. Then
// validates the four cardinal angles (ASC, IC, DSC, MC) across multiple house
// systems for internal consistency: those four points are independent of the
// house system, so all systems must produce the same values.

import { describe, it, expect } from "vitest";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { DIANA } from "./fixtures/charts";

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

function fmt(longitude: number): string {
  const SIGNS = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
  const norm = ((longitude % 360) + 360) % 360;
  const sIdx = Math.floor(norm / 30);
  const inSign = norm - sIdx * 30;
  const d = Math.floor(inSign);
  const m = Math.round((inSign - d) * 60);
  return `${SIGNS[sIdx]} ${d}°${String(m).padStart(2, "0")}'`;
}

describe("Diana — Placidus house cusps and angles vs Astrodienst", () => {
  const chart = calculateNatalChart({ ...DIANA.birth, house_system: "placidus" });

  it(`Ascendant ≈ ${fmt(DIANA.expected.angles.ascendant.longitude)}`, () => {
    const exp = DIANA.expected.angles.ascendant;
    const d = angularDistance(chart.houses.ascendant.longitude, exp.longitude);
    if (d > exp.tolDeg) {
      throw new Error(
        `ASC: got ${fmt(chart.houses.ascendant.longitude)} (${chart.houses.ascendant.longitude.toFixed(4)}°), ` +
        `expected ${fmt(exp.longitude)}, offset ${(d * 60).toFixed(1)}'`
      );
    }
    expect(d).toBeLessThanOrEqual(exp.tolDeg);
  });

  it(`Midheaven ≈ ${fmt(DIANA.expected.angles.midheaven.longitude)}`, () => {
    const exp = DIANA.expected.angles.midheaven;
    const d = angularDistance(chart.houses.midheaven.longitude, exp.longitude);
    if (d > exp.tolDeg) {
      throw new Error(
        `MC: got ${fmt(chart.houses.midheaven.longitude)} (${chart.houses.midheaven.longitude.toFixed(4)}°), ` +
        `expected ${fmt(exp.longitude)}, offset ${(d * 60).toFixed(1)}'`
      );
    }
    expect(d).toBeLessThanOrEqual(exp.tolDeg);
  });

  for (let i = 0; i < 12; i++) {
    const exp = DIANA.expected.placidusCusps[i];
    it(`Cusp ${i + 1} ≈ ${fmt(exp.longitude)}`, () => {
      const cusp = chart.houses.cusps[i];
      const d = angularDistance(cusp.longitude, exp.longitude);
      if (d > exp.tolDeg) {
        throw new Error(
          `Cusp ${i + 1}: got ${fmt(cusp.longitude)} (${cusp.longitude.toFixed(4)}°), ` +
          `expected ${fmt(exp.longitude)}, offset ${(d * 60).toFixed(1)}'`
        );
      }
      expect(d).toBeLessThanOrEqual(exp.tolDeg);
    });
  }
});

describe("Diana — angles match across house systems", () => {
  // The four cardinal angles (ASC, IC, DSC, MC) are determined by Earth's
  // rotation and the observer's lat/lon — they do NOT depend on the house
  // system. Every implementation must produce the same ASC and MC regardless
  // of system. The intermediate cusps (2,3,5,6,8,9,11,12) are what differ.
  const systems = ["placidus", "koch", "equal", "whole_sign", "porphyrius", "regiomontanus", "campanus"] as const;

  for (const sys of systems) {
    it(`${sys}: ASC matches Placidus ASC`, () => {
      const placidus = calculateNatalChart({ ...DIANA.birth, house_system: "placidus" });
      const chart = calculateNatalChart({ ...DIANA.birth, house_system: sys });
      const d = angularDistance(chart.houses.ascendant.longitude, placidus.houses.ascendant.longitude);
      expect(d).toBeLessThan(1 / 3600); // sub-arcsecond
    });

    it(`${sys}: MC matches Placidus MC`, () => {
      const placidus = calculateNatalChart({ ...DIANA.birth, house_system: "placidus" });
      const chart = calculateNatalChart({ ...DIANA.birth, house_system: sys });
      const d = angularDistance(chart.houses.midheaven.longitude, placidus.houses.midheaven.longitude);
      expect(d).toBeLessThan(1 / 3600);
    });
  }
});

describe("Diana — house-system-specific cusp invariants", () => {
  it("Whole-Sign: every cusp is at 0° of a sign, and ASC is on cusp 1's sign", () => {
    const chart = calculateNatalChart({ ...DIANA.birth, house_system: "whole_sign" });
    for (const cusp of chart.houses.cusps) {
      const frac = cusp.longitude - Math.floor(cusp.longitude / 30) * 30;
      expect(frac).toBeLessThan(1e-6);
    }
    // ASC's sign and cusp 1's sign agree
    const ascSign = Math.floor(chart.houses.ascendant.longitude / 30);
    const cusp1Sign = Math.floor(chart.houses.cusps[0].longitude / 30);
    expect(cusp1Sign).toBe(ascSign);
  });

  it("Equal: cusp[i] = ASC + 30°·i (mod 360)", () => {
    const chart = calculateNatalChart({ ...DIANA.birth, house_system: "equal" });
    const asc = chart.houses.ascendant.longitude;
    for (let i = 0; i < 12; i++) {
      const expected = (asc + i * 30) % 360;
      const d = angularDistance(chart.houses.cusps[i].longitude, expected);
      expect(d).toBeLessThan(1 / 3600);
    }
  });

  it("Placidus: cusp 1 = ASC, cusp 10 = MC", () => {
    const chart = calculateNatalChart({ ...DIANA.birth, house_system: "placidus" });
    expect(angularDistance(chart.houses.cusps[0].longitude, chart.houses.ascendant.longitude)).toBeLessThan(1 / 3600);
    expect(angularDistance(chart.houses.cusps[9].longitude, chart.houses.midheaven.longitude)).toBeLessThan(1 / 3600);
  });
});

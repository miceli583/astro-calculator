// Planet-position accuracy tests against well-known reference charts.
//
// Each fixture lists the expected ecliptic longitude (degrees east of 0° Aries)
// for each major body, taken from Astrodienst. The calculator uses the same
// Swiss Ephemeris under the hood, so deviations indicate problems in our:
//   - Time-conversion pipeline (parseLocalISO → toUTC → julianDayUT)
//   - sweph flag selection
//   - Planet ID mapping
// rather than ephemeris inaccuracy.

import { describe, it, expect } from "vitest";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { DIANA, EINSTEIN, JOBS, J2000_NOON } from "./fixtures/charts";

/** Smallest angular distance on a circle. Returns 0..180. */
function angularDistance(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

function expectLongitudeClose(actual: number, expected: number, tolDeg: number, label: string): void {
  const d = angularDistance(actual, expected);
  if (d > tolDeg) {
    // Helpful debug output: show actual, expected, and degree+sign of actual.
    const ZS = ["Ari","Tau","Gem","Can","Leo","Vir","Lib","Sco","Sag","Cap","Aqu","Pis"];
    const sIdx = Math.floor(actual / 30);
    const inSign = actual - sIdx * 30;
    const degInSign = Math.floor(inSign);
    const minInSign = Math.round((inSign - degInSign) * 60);
    throw new Error(
      `${label}: ${actual.toFixed(4)}° (${ZS[sIdx]} ${degInSign}°${String(minInSign).padStart(2, "0")}') ` +
      `expected ${expected.toFixed(4)}° within ±${(tolDeg * 60).toFixed(1)}', actual offset ${(d * 60).toFixed(1)}'`
    );
  }
  expect(d).toBeLessThanOrEqual(tolDeg);
}

describe("astrology — Princess Diana planet positions", () => {
  const chart = calculateNatalChart(DIANA.birth);

  for (const [planet, exp] of Object.entries(DIANA.expected.planets)) {
    it(`${planet}: matches Astrodienst within ±${(exp.tolDeg * 60).toFixed(1)}'`, () => {
      const p = chart.planets.find((x) => x.name === planet);
      expect(p, `planet ${planet} not in chart`).toBeDefined();
      expectLongitudeClose(p!.longitude, exp.longitude, exp.tolDeg, `Diana ${planet}`);
      if (exp.retrograde !== undefined) {
        expect(p!.retrograde, `${planet} retrograde flag`).toBe(exp.retrograde);
      }
    });
  }
});

describe("astrology — Albert Einstein planet positions", () => {
  const chart = calculateNatalChart(EINSTEIN.birth);

  for (const [planet, exp] of Object.entries(EINSTEIN.expected.planets)) {
    it(`${planet}: matches Astrodienst within ±${(exp.tolDeg * 60).toFixed(1)}'`, () => {
      const p = chart.planets.find((x) => x.name === planet);
      expect(p, `planet ${planet} not in chart`).toBeDefined();
      expectLongitudeClose(p!.longitude, exp.longitude, exp.tolDeg, `Einstein ${planet}`);
      if (exp.retrograde !== undefined) {
        expect(p!.retrograde, `${planet} retrograde flag`).toBe(exp.retrograde);
      }
    });
  }
});

describe("astrology — Steve Jobs planet positions", () => {
  const chart = calculateNatalChart(JOBS.birth);

  for (const [planet, exp] of Object.entries(JOBS.expected.planets)) {
    it(`${planet}: matches Astrodienst within ±${(exp.tolDeg * 60).toFixed(1)}'`, () => {
      const p = chart.planets.find((x) => x.name === planet);
      expect(p, `planet ${planet} not in chart`).toBeDefined();
      expectLongitudeClose(p!.longitude, exp.longitude, exp.tolDeg, `Jobs ${planet}`);
      if (exp.retrograde !== undefined) {
        expect(p!.retrograde, `${planet} retrograde flag`).toBe(exp.retrograde);
      }
    });
  }
});

describe("astrology — J2000 synthetic Sun position", () => {
  it("Sun is at ~10°08' Capricorn at 2000-01-01 12:00 UT", () => {
    const chart = calculateNatalChart(J2000_NOON.birth);
    const sun = chart.planets.find((p) => p.name === "sun")!;
    const exp = J2000_NOON.expected.planets.sun;
    expectLongitudeClose(sun.longitude, exp.longitude, exp.tolDeg, "J2000 Sun");
  });
});

describe("astrology — South Node is derived from True Node + 180°", () => {
  it("South Node is present in default output and sits opposite True Node", () => {
    const chart = calculateNatalChart(J2000_NOON.birth);
    const tn = chart.planets.find((p) => p.name === "true_node");
    const sn = chart.planets.find((p) => p.name === "south_node");
    expect(tn, "true_node missing from default output").toBeDefined();
    expect(sn, "south_node missing from default output").toBeDefined();
    // Opposite by exactly 180° mod 360.
    const sep = ((sn!.longitude - tn!.longitude) % 360 + 360) % 360;
    expect(Math.abs(sep - 180)).toBeLessThan(1e-9);
  });
});

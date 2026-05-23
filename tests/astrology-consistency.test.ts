// Internal-consistency tests for natal chart output.
//
// These don't compare to external reference values — they test invariants that
// MUST hold for any valid chart (e.g., ASC and DSC are 180° apart). They catch
// bugs where the calculator might produce internally inconsistent output even
// while individual numbers look plausible.

import { describe, it, expect } from "vitest";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { DIANA, EINSTEIN, JOBS } from "./fixtures/charts";

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

const charts = [
  { name: "Diana",    chart: calculateNatalChart(DIANA.birth),    birth: DIANA.birth },
  { name: "Einstein", chart: calculateNatalChart(EINSTEIN.birth), birth: EINSTEIN.birth },
  { name: "Jobs",     chart: calculateNatalChart(JOBS.birth),     birth: JOBS.birth },
];

describe("chart invariants", () => {
  for (const { name, chart } of charts) {
    describe(name, () => {
      it("ASC and DSC (cusps 1 & 7) are exactly 180° apart", () => {
        const d = angularDistance(chart.houses.cusps[0].longitude, chart.houses.cusps[6].longitude);
        expect(Math.abs(d - 180)).toBeLessThan(1 / 3600);
      });

      it("MC and IC (cusps 10 & 4) are exactly 180° apart", () => {
        const d = angularDistance(chart.houses.cusps[9].longitude, chart.houses.cusps[3].longitude);
        expect(Math.abs(d - 180)).toBeLessThan(1 / 3600);
      });

      it("Placidus opposite-house cusps are 180° apart (2-8, 3-9, 5-11, 6-12)", () => {
        const placidusChart = calculateNatalChart({ ...(charts.find((c) => c.name === name)!.birth), house_system: "placidus" });
        for (const [i, j] of [[1, 7], [2, 8], [4, 10], [5, 11]] as const) {
          const d = angularDistance(placidusChart.houses.cusps[i].longitude, placidusChart.houses.cusps[j].longitude);
          expect(Math.abs(d - 180), `cusps ${i + 1} & ${j + 1}`).toBeLessThan(1 / 3600);
        }
      });

      it("all 12 cusps are in [0°, 360°)", () => {
        for (const c of chart.houses.cusps) {
          expect(c.longitude).toBeGreaterThanOrEqual(0);
          expect(c.longitude).toBeLessThan(360);
        }
      });

      it("all 12 cusp signs are derived consistently from their longitudes", () => {
        const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
        for (const c of chart.houses.cusps) {
          const expectedSign = SIGNS[Math.floor(c.longitude / 30)];
          expect(c.sign.sign).toBe(expectedSign);
        }
      });

      it("every planet's house number is 1..12", () => {
        for (const p of chart.planets) {
          expect(p.house, p.name).toBeGreaterThanOrEqual(1);
          expect(p.house, p.name).toBeLessThanOrEqual(12);
        }
      });

      it("every planet's sign is derived consistently from its longitude", () => {
        const SIGNS = ["Aries","Taurus","Gemini","Cancer","Leo","Virgo","Libra","Scorpio","Sagittarius","Capricorn","Aquarius","Pisces"];
        for (const p of chart.planets) {
          const expectedSign = SIGNS[Math.floor(p.longitude / 30)];
          expect(p.sign.sign, p.name).toBe(expectedSign);
        }
      });

      it("planet.retrograde is consistent with negative speed", () => {
        for (const p of chart.planets) {
          expect(p.retrograde, p.name).toBe(p.speed < 0);
        }
      });

      it("planet longitudes are all in [0°, 360°)", () => {
        for (const p of chart.planets) {
          expect(p.longitude, p.name).toBeGreaterThanOrEqual(0);
          expect(p.longitude, p.name).toBeLessThan(360);
        }
      });

      it("cusp 1 longitude equals ASC longitude (sub-arcsecond)", () => {
        const d = angularDistance(chart.houses.cusps[0].longitude, chart.houses.ascendant.longitude);
        expect(d).toBeLessThan(1 / 3600);
      });

      it("cusp 10 longitude equals MC longitude (sub-arcsecond)", () => {
        const d = angularDistance(chart.houses.cusps[9].longitude, chart.houses.midheaven.longitude);
        expect(d).toBeLessThan(1 / 3600);
      });
    });
  }
});

describe("high-latitude warnings", () => {
  it("emits no warning for ordinary mid-latitude charts", () => {
    const chart = calculateNatalChart(DIANA.birth);
    expect(chart.warnings).toEqual([]);
  });

  it("warns for Placidus at 70°N", () => {
    const chart = calculateNatalChart({
      datetime: "1980-07-15T12:00:00",
      timezone: "UTC",
      latitude: 70,
      longitude: 25,
      house_system: "placidus",
    });
    expect(chart.warnings.length).toBeGreaterThan(0);
    expect(chart.warnings[0]).toContain("polar circle");
    expect(chart.warnings[0]).toContain("placidus");
  });

  it("warns for Koch at 70°S", () => {
    const chart = calculateNatalChart({
      datetime: "1980-01-15T12:00:00",
      timezone: "UTC",
      latitude: -70,
      longitude: 0,
      house_system: "koch",
    });
    expect(chart.warnings.length).toBeGreaterThan(0);
    expect(chart.warnings[0]).toContain("koch");
  });

  it("does NOT warn for Whole-Sign at 80°N (sign-based systems work at any latitude)", () => {
    const chart = calculateNatalChart({
      datetime: "1980-07-15T12:00:00",
      timezone: "UTC",
      latitude: 80,
      longitude: 0,
      house_system: "whole_sign",
    });
    expect(chart.warnings).toEqual([]);
  });

  it("does NOT warn for Equal at 80°N", () => {
    const chart = calculateNatalChart({
      datetime: "1980-07-15T12:00:00",
      timezone: "UTC",
      latitude: 80,
      longitude: 0,
      house_system: "equal",
    });
    expect(chart.warnings).toEqual([]);
  });

  it("threshold is exactly 66.5° (Arctic Circle)", () => {
    const just_below = calculateNatalChart({
      datetime: "1980-07-15T12:00:00",
      timezone: "UTC",
      latitude: 66.4,
      longitude: 0,
      house_system: "placidus",
    });
    const just_above = calculateNatalChart({
      datetime: "1980-07-15T12:00:00",
      timezone: "UTC",
      latitude: 66.6,
      longitude: 0,
      house_system: "placidus",
    });
    expect(just_below.warnings).toEqual([]);
    expect(just_above.warnings.length).toBeGreaterThan(0);
  });
});

describe("Diana — narrative house placements", () => {
  // Widely-published facts about Diana's chart that any correct calculator
  // should reproduce. These tie the chart back to interpretive astrology.
  const chart = calculateNatalChart(DIANA.birth);

  it("Sun is in the 7th house (Cancer, exact-degree opposite ASC)", () => {
    const sun = chart.planets.find((p) => p.name === "sun")!;
    expect(sun.house).toBe(7);
    expect(sun.sign.sign).toBe("Cancer");
  });

  it("Moon is in the 2nd house (Aquarius)", () => {
    const moon = chart.planets.find((p) => p.name === "moon")!;
    expect(moon.house).toBe(2);
    expect(moon.sign.sign).toBe("Aquarius");
  });

  it("Saturn is in Capricorn (1st house in Placidus, conjunct 2nd cusp ~2°)", () => {
    // Saturn at Cap 27°49' (297.82°) falls just before cusp 2 at Cap 29°48'
    // (299.80°) → strict Placidus house = 1. Some traditions count Saturn in
    // the 2nd because it's within a few degrees of cusp 2; we assert the
    // strict mathematical placement here.
    const sat = chart.planets.find((p) => p.name === "saturn")!;
    expect(sat.sign.sign).toBe("Capricorn");
    expect(sat.house).toBe(1);
  });

  it("Mars is in Virgo (8th house in Placidus, since cusp 9 is at Vir 18°)", () => {
    const mars = chart.planets.find((p) => p.name === "mars")!;
    expect(mars.sign.sign).toBe("Virgo");
    expect(mars.house).toBe(8);
  });

  it("Mercury is in the 7th house (Cancer)", () => {
    const merc = chart.planets.find((p) => p.name === "mercury")!;
    expect(merc.house).toBe(7);
    expect(merc.sign.sign).toBe("Cancer");
  });

  it("Venus is in the 5th house (Taurus)", () => {
    const ven = chart.planets.find((p) => p.name === "venus")!;
    expect(ven.house).toBe(5);
    expect(ven.sign.sign).toBe("Taurus");
  });

  it("Aspects include Sun-Mercury conjunction (both in Cancer)", () => {
    const conj = chart.aspects.find(
      (a) => a.type === "conjunction" &&
        ((a.from === "sun" && a.to === "mercury") || (a.from === "mercury" && a.to === "sun"))
    );
    expect(conj).toBeDefined();
  });
});

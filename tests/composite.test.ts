import { describe, it, expect } from "vitest";
import {
  MAX_COMPOSITE_CHARTS,
  calculateComposite,
  circularMidpoint,
} from "@/lib/calculators/composite";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { compositeInputSchema } from "@/lib/validation/schemas";
import { DIANA, EINSTEIN, JOBS, MANDELA } from "./fixtures/charts";

/** Independent shorter-arc midpoint of two longitudes (classic composite rule). */
function pairMidpoint(a: number, b: number): number {
  const delta = ((b - a + 540) % 360) - 180; // signed shortest arc a → b
  return (((a + delta / 2) % 360) + 360) % 360;
}

describe("circularMidpoint — pure math", () => {
  it("averages nearby longitudes", () => {
    expect(circularMidpoint([10, 20]).longitude).toBeCloseTo(15, 6);
    expect(circularMidpoint([100, 110, 120]).longitude).toBeCloseTo(110, 6);
  });

  it("takes the shorter arc across 0°", () => {
    expect(circularMidpoint([350, 10]).longitude).toBeCloseTo(0, 6);
    expect(circularMidpoint([355, 5, 15]).longitude).toBeCloseTo(5, 6);
  });

  it("matches the classic pair midpoint for arbitrary pairs", () => {
    const pairs: Array<[number, number]> = [
      [0, 90], [200, 359], [10, 170], [300, 60], [123.4, 289.7],
    ];
    for (const [a, b] of pairs) {
      const { longitude, degenerate } = circularMidpoint([a, b]);
      expect(degenerate).toBe(false);
      expect(longitude).toBeCloseTo(pairMidpoint(a, b), 6);
    }
  });

  it("is rotation-invariant for non-degenerate sets", () => {
    const lons = [12, 48, 95];
    const base = circularMidpoint(lons).longitude;
    for (const rot of [30, 123, 270]) {
      const rotated = circularMidpoint(lons.map((l) => (l + rot) % 360)).longitude;
      // Angular distance between rotated and base+rot, folded to [0, 180].
      const diff = 180 - Math.abs((((rotated - base - rot) % 360) + 540) % 360 - 180);
      expect(diff).toBeCloseTo(180, 5);
    }
  });

  it("flags directionally degenerate sets and falls back deterministically", () => {
    const antipodal = circularMidpoint([10, 190]);
    expect(antipodal.degenerate).toBe(true);
    expect(antipodal.longitude).toBeCloseTo(100, 6); // arithmetic-mean fallback

    const tripod = circularMidpoint([0, 120, 240]);
    expect(tripod.degenerate).toBe(true);
  });

  it("throws on an empty input", () => {
    expect(() => circularMidpoint([])).toThrow();
  });
});

describe("calculateComposite — two charts (classic composite)", () => {
  const composite = calculateComposite({ charts: [DIANA.birth, EINSTEIN.birth] });
  const natalA = calculateNatalChart(DIANA.birth);
  const natalB = calculateNatalChart(EINSTEIN.birth);

  it("every composite planet is the shorter-arc midpoint of the natal pair", () => {
    for (const p of composite.planets) {
      const a = natalA.planets.find((x) => x.name === p.name)!;
      const b = natalB.planets.find((x) => x.name === p.name)!;
      expect(a).toBeDefined();
      expect(b).toBeDefined();
      if (!p.degenerate) {
        expect(p.longitude).toBeCloseTo(pairMidpoint(a.longitude, b.longitude), 5);
      }
    }
  });

  it("covers the full modeled planet set including the derived South Node", () => {
    const names = composite.planets.map((p) => p.name);
    expect(names).toContain("sun");
    expect(names).toContain("true_node");
    expect(names).toContain("south_node");
    expect(names).toContain("chiron");
    expect(names.length).toBe(13);
  });

  it("is symmetric in chart order", () => {
    const reversed = calculateComposite({ charts: [EINSTEIN.birth, DIANA.birth] });
    for (const p of composite.planets) {
      const q = reversed.planets.find((x) => x.name === p.name)!;
      expect(q.longitude).toBeCloseTo(p.longitude, 8);
    }
    expect(reversed.houses.midheaven.longitude).toBeCloseTo(
      composite.houses.midheaven.longitude,
      6
    );
  });

  it("derives the house wheel from the composite MC (round-trips)", () => {
    const expectedMc = pairMidpoint(
      natalA.houses.midheaven.longitude,
      natalB.houses.midheaven.longitude
    );
    // houses_armc recomputes the MC from the ARMC — should round-trip closely.
    expect(composite.houses.midheaven.longitude).toBeCloseTo(expectedMc, 2);
    expect(composite.houses.method).toBe("derived-from-composite-mc");
  });

  it("produces a coherent wheel: 12 cusps, ASC = cusp 1, MC = cusp 10 (placidus)", () => {
    expect(composite.houses.cusps.length).toBe(12);
    expect(composite.houses.cusps[0].longitude).toBeCloseTo(
      composite.houses.ascendant.longitude,
      6
    );
    expect(composite.houses.cusps[9].longitude).toBeCloseTo(
      composite.houses.midheaven.longitude,
      6
    );
    // Cusps advance monotonically around the circle (sum of gaps = 360°).
    const lons = composite.houses.cusps.map((c) => c.longitude);
    let total = 0;
    for (let i = 0; i < 12; i++) {
      total += (((lons[(i + 1) % 12] - lons[i]) % 360) + 360) % 360;
    }
    expect(total).toBeCloseTo(360, 4);
  });

  it("assigns every planet a sign and a house 1-12", () => {
    for (const p of composite.planets) {
      expect(p.house).toBeGreaterThanOrEqual(1);
      expect(p.house).toBeLessThanOrEqual(12);
      expect(p.sign.sign.length).toBeGreaterThan(0);
    }
  });

  it("computes the Part of Fortune from composite ASC/Sun/Moon with the day/night rule", () => {
    const sun = composite.planets.find((p) => p.name === "sun")!;
    const moon = composite.planets.find((p) => p.name === "moon")!;
    const asc = composite.houses.ascendant.longitude;
    const expectedDay = sun.house >= 7 && sun.house <= 12;
    expect(composite.partOfFortune.isDayBirth).toBe(expectedDay);
    const expected = expectedDay
      ? (((asc + moon.longitude - sun.longitude) % 360) + 360) % 360
      : (((asc + sun.longitude - moon.longitude) % 360) + 360) % 360;
    expect(composite.partOfFortune.longitude).toBeCloseTo(expected, 6);
  });

  it("computes internal aspects between composite planets", () => {
    expect(composite.aspects.length).toBeGreaterThan(0);
    const names = new Set(composite.planets.map((p) => p.name as string));
    for (const a of composite.aspects) {
      expect(names.has(a.from)).toBe(true);
      expect(names.has(a.to)).toBe(true);
    }
  });

  it("reports the mean JD and reference latitude", () => {
    expect(composite.jd_ut_mean).toBeCloseTo((natalA.jd_ut + natalB.jd_ut) / 2, 6);
    expect(composite.referenceLatitude).toBeCloseTo(
      (DIANA.birth.latitude + EINSTEIN.birth.latitude) / 2,
      6
    );
  });
});

describe("calculateComposite — identity and group composites", () => {
  it("composite of N identical charts reproduces that chart's positions", () => {
    for (const n of [2, 5, 10]) {
      const charts = Array.from({ length: n }, () => JOBS.birth);
      const composite = calculateComposite({ charts });
      const natal = calculateNatalChart(JOBS.birth);
      for (const p of composite.planets) {
        const source = natal.planets.find((x) => x.name === p.name)!;
        expect(p.longitude).toBeCloseTo(source.longitude, 6);
      }
      expect(composite.houses.midheaven.longitude).toBeCloseTo(
        natal.houses.midheaven.longitude,
        2
      );
      expect(composite.chartCount).toBe(n);
    }
  });

  it("supports the maximum of ten distinct charts", () => {
    // Ten distinct births: the four reference fixtures plus six offsets of Diana.
    const offsets = ["1962-07-01T10:00:00", "1965-02-11T04:30:00", "1970-12-25T22:15:00",
                     "1980-03-05T08:45:00", "1990-06-18T16:20:00", "2000-01-01T00:01:00"];
    const charts = [
      DIANA.birth,
      EINSTEIN.birth,
      JOBS.birth,
      MANDELA.birth,
      ...offsets.map((datetime) => ({ ...DIANA.birth, datetime })),
    ];
    expect(charts.length).toBe(MAX_COMPOSITE_CHARTS);
    const composite = calculateComposite({ charts });
    expect(composite.chartCount).toBe(10);
    expect(composite.planets.length).toBe(13);
    expect(composite.houses.cusps.length).toBe(12);
  });

  it("rejects fewer than 2 or more than 10 charts", () => {
    expect(() => calculateComposite({ charts: [DIANA.birth] })).toThrow();
    const eleven = Array.from({ length: 11 }, () => DIANA.birth);
    expect(() => calculateComposite({ charts: eleven })).toThrow(/at most 10/);
  });
});

describe("composite input schema (API boundary)", () => {
  const birth = {
    datetime: "1990-05-05T12:00:00",
    timezone: "UTC",
    latitude: 10,
    longitude: 10,
  };

  it("accepts 2 and 10 charts", () => {
    expect(compositeInputSchema.safeParse({ charts: [birth, birth] }).success).toBe(true);
    expect(
      compositeInputSchema.safeParse({ charts: Array.from({ length: 10 }, () => birth) }).success
    ).toBe(true);
  });

  it("rejects 1 and 11 charts", () => {
    expect(compositeInputSchema.safeParse({ charts: [birth] }).success).toBe(false);
    expect(
      compositeInputSchema.safeParse({ charts: Array.from({ length: 11 }, () => birth) }).success
    ).toBe(false);
  });

  it("accepts an optional house system", () => {
    expect(
      compositeInputSchema.safeParse({ charts: [birth, birth], house_system: "whole_sign" })
        .success
    ).toBe(true);
    expect(
      compositeInputSchema.safeParse({ charts: [birth, birth], house_system: "vedic" }).success
    ).toBe(false);
  });
});

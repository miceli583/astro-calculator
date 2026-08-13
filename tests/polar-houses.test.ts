/**
 * F5 / F6 — house cusps inside the polar circles.
 *
 * F5: `calcHouses` discarded sweph's return flag. Inside the polar circles
 * Placidus and Koch are undefined, and sweph substitutes Porphyry rather than
 * failing, signalling the swap through `flag < 0`. A caller asking for Placidus
 * at Tromsø therefore received exact Porphyry cusps under the label `placidus`.
 *
 * F6: above the circle, Campanus and Regiomontanus cusps collapse onto two
 * points 180° apart and the wheel goes locally retrograde — cusp i+1 lands a
 * hundredth of a degree BEHIND cusp i. Read forward that house measures 359.97°
 * instead of 0.03°, house 1 swallows the zodiac, and every body is reported in
 * it. The cusps themselves are exact; the ordering assumption was ours.
 *
 * The regression for F6 is an ARMC SWEEP, not a fixture set. The collapse
 * occupies a window of sidereal time that is empty below the polar circle and
 * widens with latitude — 8/360 of a day at 66.6°N. Twenty point fixtures missed
 * it entirely the first time this was investigated, which is the whole reason
 * the sweep is here.
 */

import { describe, it, expect } from "vitest";
import {
  calcHouses,
  calcHousesFromArmc,
  obliquity,
  type HouseSystem,
} from "@/lib/ephemeris/client";
import { calculateNatalChart, houseSpans } from "@/lib/calculators/astrology";
import { houseFor as overlayHouseFor } from "@/lib/calculators/overlay";

// True obliquity at J2000 as the ephemeris reports it (includes nutation, so it
// sits ~5.8" off the textbook mean value of 23.4392911). Taken from the source
// rather than hardcoded: the sweep needs the ephemeris's own number, and a
// stale constant here would silently shift the boundary the sweep is probing.
const EPS_2000 = obliquity(2451545.0);

/** Forward arcs of the twelve houses, each normalised into [0, 360). */
function naiveArcs(cusps: number[]): number[] {
  return cusps.map((start, i) => {
    const end = cusps[(i + 1) % 12];
    return (((end - start) % 360) + 360) % 360;
  });
}

/** A wheel is degenerate when its twelve forward arcs sum to more than 360°. */
function isDegenerate(cusps: number[]): boolean {
  return naiveArcs(cusps).reduce((a, b) => a + b, 0) > 360 + 1e-6;
}

describe("F5 — the reported house system is the one that produced the cusps", () => {
  // Longyearbyen, well inside the Arctic circle.
  const POLAR = {
    datetime: "1990-05-15T09:20:00",
    timezone: "Europe/Oslo",
    latitude: 78.22,
    longitude: 15.65,
  } as const;

  const TEMPERATE = { ...POLAR, latitude: 51.5074, longitude: -0.1278 } as const;

  it("a placidus request above the circle is labelled porphyrius, not placidus", () => {
    const chart = calculateNatalChart({ ...POLAR, house_system: "placidus" });
    expect(chart.houses.system).toBe("porphyrius");
    expect(chart.houses.requestedSystem).toBe("placidus");
  });

  it("the substituted cusps really are Porphyry cusps, to the last digit", () => {
    // The runtime maps `flag < 0` to porphyrius from sweph's documented
    // behaviour. This is the assertion that keeps that mapping honest: if a
    // future sweph substitutes something else, this fails rather than
    // relabelling cusps a second time.
    const substituted = calcHouses(2448026.888, 78.22, 15.65, "placidus");
    const explicit = calcHouses(2448026.888, 78.22, 15.65, "porphyrius");
    expect(substituted.system).toBe("porphyrius");
    expect(explicit.system).toBe("porphyrius");
    for (let i = 0; i < 12; i++) {
      expect(substituted.cusps[i]).toBe(explicit.cusps[i]);
    }
  });

  it("koch is substituted the same way", () => {
    const chart = calculateNatalChart({ ...POLAR, house_system: "koch" });
    expect(chart.houses.system).toBe("porphyrius");
    expect(chart.houses.requestedSystem).toBe("koch");
  });

  it("no substitution at temperate latitudes, and no requestedSystem key", () => {
    const chart = calculateNatalChart({ ...TEMPERATE, house_system: "placidus" });
    expect(chart.houses.system).toBe("placidus");
    expect("requestedSystem" in chart.houses).toBe(false);
  });

  it("the warning names the system that answered instead of calling it unreliable", () => {
    const chart = calculateNatalChart({ ...POLAR, house_system: "placidus" });
    const w = chart.warnings.join(" ");
    expect(w).toContain("porphyrius");
    // The old warning called the cusps "mathematically degenerate ... and may be
    // unreliable". They were neither: they were exact Porphyry cusps under the
    // wrong label. Saying "unreliable" about them was the second half of F5.
    expect(w).not.toContain("may be unreliable");
    expect(w).not.toContain("mathematically degenerate");
  });

  it("systems that sweph computes fine above the circle are not relabelled", () => {
    for (const system of ["campanus", "regiomontanus", "equal", "whole_sign"] as HouseSystem[]) {
      const chart = calculateNatalChart({ ...POLAR, house_system: system });
      expect(chart.houses.system, system).toBe(system);
    }
  });
});

describe("F5 — the 66.5° constant was wrong, and could not have been right", () => {
  function substitutionBoundary(jd: number): number {
    let lo = 60;
    let hi = 80;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (calcHouses(jd, mid, 18.95, "placidus").system !== "placidus") hi = mid;
      else lo = mid;
    }
    return hi;
  }

  it("the true boundary is past 66.5°, so 66.5 warned on charts that were fine", () => {
    const b = substitutionBoundary(2451545.0); // J2000
    expect(b).toBeGreaterThan(66.5);
    expect(b).toBeLessThan(66.6);
    // A chart in the gap gets real Placidus cusps and must not be relabelled.
    const mid = (66.5 + b) / 2;
    expect(calcHouses(2451545.0, mid, 18.95, "placidus").system).toBe("placidus");
  });

  it("the boundary MOVES with the epoch — no constant can be correct", () => {
    // It tracks the obliquity of the ecliptic, which is decreasing.
    const b1800 = substitutionBoundary(2378496.5);
    const b2000 = substitutionBoundary(2451545.0);
    const b2333 = substitutionBoundary(2500000.5);
    expect(b1800).toBeLessThan(b2000);
    expect(b2000).toBeLessThan(b2333);
    expect(b2333 - b1800).toBeGreaterThan(0.02);
  });

  it("but it does NOT depend on the moment within a day, or on longitude", () => {
    // Which is why reading the flag is cheap and exact: one call, no search.
    const base = substitutionBoundary(2451545.0);
    for (const lon of [0, 90, 180, 270]) {
      let lo = 60;
      let hi = 80;
      for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;
        if (calcHouses(2451545.0, mid, lon, "placidus").system !== "placidus") hi = mid;
        else lo = mid;
      }
      expect(Math.abs(hi - base)).toBeLessThan(1e-6);
    }
  });
});

describe("F6 — degenerate polar wheels, swept across a full sidereal day", () => {
  // A sweep, deliberately, not fixtures. See the file header.
  const STEP = 0.25; // degrees of ARMC — 1440 instants per latitude
  const SYSTEMS: HouseSystem[] = ["campanus", "regiomontanus"];

  it("the collapse window is empty below the circle and widens with latitude", () => {
    const width = (lat: number) => {
      let n = 0;
      for (let armc = 0; armc < 360; armc += STEP) {
        if (SYSTEMS.some((s) => isDegenerate(calcHousesFromArmc(armc, lat, EPS_2000, s).cusps))) n++;
      }
      return n;
    };
    const below = width(60);
    const just = width(66.6);
    const far = width(78.22);
    expect(below).toBe(0);
    expect(just).toBeGreaterThan(0);
    expect(far).toBeGreaterThan(just);
    // Non-vacuity: the sweep must actually be finding the pathology it guards.
    expect(far).toBeGreaterThan(100);
  });

  it("the twelve houses close the circle exactly once, everywhere in the sweep", () => {
    // The bug's exact shape: eleven arcs read forward as ~359.98° instead of
    // ~0.02°, so the twelve of them wound the circle eleven times over.
    let checked = 0;
    let degenerate = 0;
    for (const lat of [66.6, 69.65, 78.22, 89]) {
      for (const system of SYSTEMS) {
        for (let armc = 0; armc < 360; armc += STEP) {
          const { cusps } = calcHousesFromArmc(armc, lat, EPS_2000, system);
          const spans = houseSpans(cusps);
          const sum = spans.reduce((a, s) => a + s.extent, 0);
          expect(Math.abs(sum - 360), `lat ${lat} ${system} armc ${armc}`).toBeLessThan(1e-6);
          for (const s of spans) expect(s.extent).toBeLessThanOrEqual(360);
          if (isDegenerate(cusps)) degenerate++;
          checked++;
        }
      }
    }
    expect(checked).toBe(4 * 2 * 1440);
    // Non-vacuity: this must be exercising reversed wheels, not just tame ones.
    expect(degenerate).toBeGreaterThan(1000);
  });

  it("every longitude lands in exactly one house, everywhere in the sweep", () => {
    // The real invariant, and the one the old code could not satisfy: a wheel
    // that swallows the zodiac satisfies "at least one house"; only a wheel
    // that genuinely partitions the circle satisfies "exactly one".
    for (const lat of [66.6, 69.65, 78.22, 89]) {
      for (const system of SYSTEMS) {
        for (let armc = 0; armc < 360; armc += 15) {
          const { cusps } = calcHousesFromArmc(armc, lat, EPS_2000, system);
          const spans = houseSpans(cusps);
          for (let lon = 0; lon < 360; lon += 7) {
            const hits = spans.reduce((n, s) => {
              if (s.extent <= 0) return n;
              const off = (((lon - s.start) % 360) + 360) % 360;
              return off < s.extent ? n + 1 : n;
            }, 0);
            expect(hits, `lat ${lat} ${system} armc ${armc} lon ${lon}`).toBe(1);
          }
        }
      }
    }
  });

  it("a temperate wheel is untouched — it already runs forward", () => {
    for (let armc = 0; armc < 360; armc += 5) {
      const { cusps } = calcHousesFromArmc(armc, 51.5, EPS_2000, "placidus");
      const naive = naiveArcs(cusps);
      const spans = houseSpans(cusps);
      for (let i = 0; i < 12; i++) {
        expect(spans[i].start).toBe(cusps[i]);
        expect(spans[i].extent).toBeCloseTo(naive[i], 9);
      }
    }
  });

  it("a reversed wheel is read backwards, and that is what closes it", () => {
    // Pins the mechanism, not just the symptom. If someone reverts to reading
    // forward arcs and papers over the sum with a clamp, this fails.
    const { cusps } = calcHousesFromArmc(239, 69.65, EPS_2000, "campanus");
    expect(isDegenerate(cusps)).toBe(true);
    const spans = houseSpans(cusps);
    for (let i = 0; i < 12; i++) expect(spans[i].start).toBe(cusps[(i + 1) % 12]);
    expect(spans.reduce((a, s) => a + s.extent, 0)).toBeCloseTo(360, 9);
  });
});

describe("F6 — the chart no longer puts every body in house 1", () => {
  // Tromsø, 69.65°N, Campanus — and, critically, at an hour whose wheel is
  // actually reversed. Not every polar chart is: the same place four hours
  // later has a perfectly ordinary forward wheel and would pass these tests
  // against the broken code. The `isDegenerate` guard below is what stops this
  // fixture from quietly drifting into that harmless window.
  const BASE = {
    timezone: "Europe/Oslo",
    latitude: 69.65,
    longitude: 18.95,
    house_system: "campanus",
  } as const;
  const POLAR = { ...BASE, datetime: "1990-05-01T05:00:00" } as const;
  const COLLAPSED = { ...BASE, datetime: "1990-05-01T03:00:00" } as const;

  it("the fixtures really are reversed wheels", () => {
    for (const input of [POLAR, COLLAPSED]) {
      const chart = calculateNatalChart(input);
      expect(isDegenerate(chart.houses.cusps.map((c) => c.longitude)), input.datetime).toBe(true);
    }
  });

  it("bodies are distributed across houses, not piled into one", () => {
    const chart = calculateNatalChart(POLAR);
    const houses = new Set(chart.planets.map((p) => p.house));
    expect(chart.planets.length).toBeGreaterThan(5);
    // Was 1 — every body in house 1, the zodiac swallowed whole.
    expect(houses.size).toBeGreaterThan(4);
  });

  it("even a fully collapsed wheel splits its bodies across its two real houses", () => {
    // The hardest case: ten hairline houses and two of ~180° each. Two is the
    // honest answer here, and it is not one.
    const chart = calculateNatalChart(COLLAPSED);
    const houses = new Set(chart.planets.map((p) => p.house));
    expect(houses.size).toBeGreaterThan(1);
  });

  it("each body sits in a house whose arc actually contains it", () => {
    // Independent of the implementation: re-derive membership from the cusps
    // the response itself reports.
    const chart = calculateNatalChart(POLAR);
    const spans = houseSpans(chart.houses.cusps.map((c) => c.longitude));
    for (const p of chart.planets) {
      const { start, extent } = spans[p.house - 1];
      const off = (((p.longitude - start) % 360) + 360) % 360;
      expect(extent, `${p.name} in house ${p.house}`).toBeGreaterThan(0);
      expect(off, `${p.name} at ${p.longitude} vs house start ${start}`).toBeLessThan(extent);
    }
  });

  it("temperate charts are unaffected", () => {
    const chart = calculateNatalChart({
      datetime: "1980-07-15T14:30:00",
      timezone: "America/New_York",
      latitude: 40.7128,
      longitude: -74.006,
    });
    const cusps = chart.houses.cusps.map((c) => c.longitude);
    for (const p of chart.planets) {
      const i = p.house - 1;
      const start = cusps[i];
      const end = cusps[(i + 1) % 12];
      const inHouse =
        end > start ? p.longitude >= start && p.longitude < end : p.longitude >= start || p.longitude < end;
      expect(inHouse, `${p.name}`).toBe(true);
    }
  });
});

describe("F6 — the overlay path reports the same houses as the chart", () => {
  it("overlay.houseFor and the natal chart agree above the polar circle", () => {
    // These were two separate implementations until this fix, so F6 lived in
    // both and would have had to be found twice. Composite charts, synastry
    // overlays and every transit house reading went through the overlay copy.
    const chart = calculateNatalChart({
      datetime: "1990-05-01T05:00:00",
      timezone: "Europe/Oslo",
      latitude: 69.65,
      longitude: 18.95,
      house_system: "campanus",
    });
    const cusps = chart.houses.cusps.map((c) => c.longitude);
    expect(isDegenerate(cusps)).toBe(true);
    for (const p of chart.planets) {
      expect(overlayHouseFor(p.longitude, cusps), p.name).toBe(p.house);
    }
  });
});

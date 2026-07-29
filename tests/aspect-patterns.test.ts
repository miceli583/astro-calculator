import { describe, it, expect } from "vitest";
import {
  detectAspectPatterns,
  elementOfSign,
  modalityOfSign,
  type AspectPattern,
  type PatternPoint,
} from "@/lib/calculators/aspect-patterns";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { calculateTransitSky } from "@/lib/calculators/transit";
import { DIANA, EINSTEIN, JOBS, MANDELA } from "./fixtures/charts";

function pts(...longitudes: number[]): PatternPoint[] {
  return longitudes.map((longitude, i) => ({ name: `p${i}`, longitude }));
}

function ofType(patterns: AspectPattern[], type: AspectPattern["type"]): AspectPattern[] {
  return patterns.filter((p) => p.type === type);
}

describe("sign classification helpers", () => {
  it("maps signs to elements", () => {
    expect(elementOfSign("Aries")).toBe("fire");
    expect(elementOfSign("Taurus")).toBe("earth");
    expect(elementOfSign("Gemini")).toBe("air");
    expect(elementOfSign("Cancer")).toBe("water");
    expect(elementOfSign("Sagittarius")).toBe("fire");
    expect(elementOfSign("Pisces")).toBe("water");
  });

  it("maps signs to modalities", () => {
    expect(modalityOfSign("Aries")).toBe("cardinal");
    expect(modalityOfSign("Taurus")).toBe("fixed");
    expect(modalityOfSign("Gemini")).toBe("mutable");
    expect(modalityOfSign("Capricorn")).toBe("cardinal");
    expect(modalityOfSign("Aquarius")).toBe("fixed");
    expect(modalityOfSign("Pisces")).toBe("mutable");
  });
});

describe("detectAspectPatterns — synthetic exact geometry", () => {
  it("finds a grand trine with its shared element", () => {
    const patterns = detectAspectPatterns(pts(5, 125, 245)); // Aries/Leo/Sag
    const trines = ofType(patterns, "grand_trine");
    expect(trines).toHaveLength(1);
    expect(trines[0].points.sort()).toEqual(["p0", "p1", "p2"]);
    expect(trines[0].element).toBe("fire");
    expect(trines[0].maxOrb).toBe(0);
  });

  it("omits the element when the trine spans mixed triplicities", () => {
    // 0 (Aries/fire), 114 (Cancer/water — still within 7° trine orb), 240 (Sag/fire)
    const patterns = detectAspectPatterns(pts(0, 114, 240));
    const trines = ofType(patterns, "grand_trine");
    expect(trines).toHaveLength(1);
    expect(trines[0].element).toBeUndefined();
  });

  it("finds a T-square with apex and modality", () => {
    const patterns = detectAspectPatterns(pts(0, 180, 90)); // Aries–Libra opp, Cancer apex
    const tsq = ofType(patterns, "t_square");
    expect(tsq).toHaveLength(1);
    expect(tsq[0].apex).toBe("p2");
    expect(tsq[0].modality).toBe("cardinal");
  });

  it("finds a grand cross and suppresses its four component T-squares", () => {
    const patterns = detectAspectPatterns(pts(0, 90, 180, 270));
    const crosses = ofType(patterns, "grand_cross");
    expect(crosses).toHaveLength(1);
    expect(crosses[0].modality).toBe("cardinal");
    expect(ofType(patterns, "t_square")).toHaveLength(0);
  });

  it("keeps T-squares that are not contained in the grand cross", () => {
    // Cross at 0/90/180/270 plus an independent T-square at 40–220 opp with
    // apex 130, none of whose members aspect the cross points.
    const patterns = detectAspectPatterns(pts(0, 90, 180, 270, 40, 220, 130));
    expect(ofType(patterns, "grand_cross")).toHaveLength(1);
    const tsq = ofType(patterns, "t_square");
    expect(tsq).toHaveLength(1);
    expect(tsq[0].points.sort()).toEqual(["p4", "p5", "p6"]);
    expect(tsq[0].apex).toBe("p6");
  });

  it("finds a yod (sextile base, quincunx apex)", () => {
    const patterns = detectAspectPatterns(pts(0, 60, 210));
    const yods = ofType(patterns, "yod");
    expect(yods).toHaveLength(1);
    expect(yods[0].apex).toBe("p2");
  });

  it("finds a kite on top of its grand trine", () => {
    // Trine 0/120/240 + focal point at 60: opposite 240, sextile 0 and 120.
    const patterns = detectAspectPatterns(pts(0, 120, 240, 60));
    expect(ofType(patterns, "grand_trine")).toHaveLength(1);
    const kites = ofType(patterns, "kite");
    expect(kites).toHaveLength(1);
    expect(kites[0].apex).toBe("p3");
    expect(kites[0].points).toHaveLength(4);
  });

  it("finds a mystic rectangle", () => {
    // Oppositions 0–180 and 60–240; sextiles 0–60, 180–240; trines 0–240, 60–180.
    const patterns = detectAspectPatterns(pts(0, 180, 60, 240));
    expect(ofType(patterns, "mystic_rectangle")).toHaveLength(1);
  });

  it("finds a sign stellium at three points and not at two", () => {
    expect(ofType(detectAspectPatterns(pts(1, 5, 29)), "stellium")).toHaveLength(1);
    expect(ofType(detectAspectPatterns(pts(1, 5)), "stellium")).toHaveLength(0);
    const [st] = ofType(detectAspectPatterns(pts(1, 5, 29)), "stellium");
    expect(st.basis).toBe("sign");
    expect(st.sign).toBe("Aries");
  });

  it("finds a house stellium when house data is present, skipping duplicates of sign stelliums", () => {
    // Three points spread across a sign boundary but sharing house 4.
    const spanning: PatternPoint[] = [
      { name: "a", longitude: 28, house: 4 },
      { name: "b", longitude: 32, house: 4 },
      { name: "c", longitude: 36, house: 4 },
    ];
    const houseSt = ofType(detectAspectPatterns(spanning), "stellium");
    expect(houseSt).toHaveLength(1);
    expect(houseSt[0].basis).toBe("house");
    expect(houseSt[0].house).toBe(4);

    // Same members in one sign AND one house → reported once, sign-based.
    const overlapping: PatternPoint[] = [
      { name: "a", longitude: 1, house: 1 },
      { name: "b", longitude: 5, house: 1 },
      { name: "c", longitude: 9, house: 1 },
    ];
    const both = ofType(detectAspectPatterns(overlapping), "stellium");
    expect(both).toHaveLength(1);
    expect(both[0].basis).toBe("sign");
  });

  it("respects orbs — near-miss geometry produces no pattern", () => {
    // Third trine leg 8° off (grand trine orb is 7°).
    expect(ofType(detectAspectPatterns(pts(0, 120, 248)), "grand_trine")).toHaveLength(0);
    // Apex 8° off square (orb 7°).
    expect(ofType(detectAspectPatterns(pts(0, 180, 98)), "t_square")).toHaveLength(0);
    // Quincunx 4° off (orb 3°).
    expect(ofType(detectAspectPatterns(pts(0, 60, 214)), "yod")).toHaveLength(0);
  });

  it("returns an empty list for an empty or aspect-free chart", () => {
    expect(detectAspectPatterns([])).toEqual([]);
    expect(detectAspectPatterns(pts(0, 43))).toEqual([]);
  });

  it("produces deterministic ordering", () => {
    const a = detectAspectPatterns(pts(0, 90, 180, 270, 5, 8));
    const b = detectAspectPatterns(pts(0, 90, 180, 270, 5, 8));
    expect(a).toEqual(b);
  });
});

describe("natal chart patterns — reference fixtures", () => {
  // Fixture positions are Astrodienst-anchored by the positions suite, so
  // these assertions pin the detector to independently verified geometry.

  it("Diana: fixed Moon–Uranus T-square with Venus apex, water kite onto Pluto, Mercury–Pluto yod onto Jupiter", () => {
    const chart = calculateNatalChart(DIANA.birth);
    const tsq = chart.patterns.find(
      (p) => p.type === "t_square" && p.apex === "venus" && p.points.includes("uranus"),
    );
    expect(tsq).toBeDefined();
    expect(tsq!.modality).toBe("fixed");

    const kite = chart.patterns.find(
      (p) => p.type === "kite" && p.apex === "pluto" && p.points.includes("sun"),
    );
    expect(kite).toBeDefined();
    expect(kite!.element).toBe("water");

    const yod = chart.patterns.find((p) => p.type === "yod" && p.apex === "jupiter");
    expect(yod).toBeDefined();
    expect(yod!.points.sort()).toEqual(["jupiter", "mercury", "pluto"]);
  });

  it("Einstein: Aries stellium (Mercury, Venus, Saturn) and a Uranus-apex yod", () => {
    const chart = calculateNatalChart(EINSTEIN.birth);
    const aries = chart.patterns.find(
      (p) => p.type === "stellium" && p.basis === "sign" && p.sign === "Aries",
    );
    expect(aries).toBeDefined();
    expect(aries!.points.sort()).toEqual(["mercury", "saturn", "venus"]);

    const yod = chart.patterns.find((p) => p.type === "yod" && p.apex === "uranus");
    expect(yod).toBeDefined();
  });

  it("Jobs: cardinal T-square with Neptune apex", () => {
    const chart = calculateNatalChart(JOBS.birth);
    const tsq = chart.patterns.find((p) => p.type === "t_square" && p.apex === "neptune");
    expect(tsq).toBeDefined();
    expect(tsq!.modality).toBe("cardinal");
  });

  it("Mandela: Leo and Cancer sign stelliums", () => {
    const chart = calculateNatalChart(MANDELA.birth);
    const signs = chart.patterns
      .filter((p) => p.type === "stellium" && p.basis === "sign")
      .map((p) => p.sign)
      .sort();
    expect(signs).toEqual(["Cancer", "Leo"]);
  });

  it("never includes the derived South Node in a pattern", () => {
    for (const fixture of [DIANA, EINSTEIN, JOBS, MANDELA]) {
      const chart = calculateNatalChart(fixture.birth);
      for (const p of chart.patterns) {
        expect(p.points).not.toContain("south_node");
      }
    }
  });

  it("every pattern's aspect pairs are consistent with the chart's own aspect list orbs", () => {
    const chart = calculateNatalChart(DIANA.birth);
    // Every grand trine member pair must actually be within trine orb.
    for (const p of chart.patterns.filter((x) => x.type === "grand_trine")) {
      const members = p.points.map((n) => chart.planets.find((pl) => pl.name === n)!);
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
          const sep = Math.abs(((members[i].longitude - members[j].longitude + 540) % 360) - 180);
          expect(Math.abs(sep - 120)).toBeLessThanOrEqual(7);
        }
      }
    }
  });
});

describe("sky-weather patterns — calculateTransitSky", () => {
  it("detects the famous 5 Feb 1962 seven-planet Aquarius stellium", () => {
    const sky = calculateTransitSky({ datetime: "1962-02-05T00:00:00", timezone: "UTC" });
    const st = sky.patterns.find(
      (p) => p.type === "stellium" && p.basis === "sign" && p.sign === "Aquarius",
    );
    expect(st).toBeDefined();
    expect(st!.points.sort()).toEqual(
      ["jupiter", "mars", "mercury", "moon", "saturn", "sun", "venus"].sort(),
    );
  });

  it("sky patterns are sign-based only (no houses) and never include the South Node", () => {
    const sky = calculateTransitSky({ datetime: "1962-02-05T00:00:00", timezone: "UTC" });
    for (const p of sky.patterns) {
      expect(p.basis === "house" ? p.house : undefined).toBeUndefined();
      expect(p.points).not.toContain("south_node");
    }
  });

  it("emits a patterns array on every sky snapshot", () => {
    const sky = calculateTransitSky({ datetime: "2026-07-29T12:00:00", timezone: "UTC" });
    expect(Array.isArray(sky.patterns)).toBe(true);
  });
});

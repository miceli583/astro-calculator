import { describe, it, expect } from "vitest";
import { angularDifference, computeOverlay, houseFor } from "@/lib/calculators/overlay";

describe("overlay math", () => {
  it("angularDifference returns shortest arc", () => {
    expect(angularDifference(10, 20)).toBeCloseTo(10);
    expect(angularDifference(350, 10)).toBeCloseTo(20);
    expect(angularDifference(0, 180)).toBeCloseTo(180);
    expect(angularDifference(90, 270)).toBeCloseTo(180);
    expect(angularDifference(45, 315)).toBeCloseTo(90);
  });

  it("houseFor handles wrap-around cusps", () => {
    // 12 cusps starting at 350° (h1) — the ASC in late Pisces
    const cusps = [350, 20, 50, 80, 110, 140, 170, 200, 230, 260, 290, 320];
    expect(houseFor(355, cusps)).toBe(1); // in h1 which wraps 350 → 20
    expect(houseFor(10, cusps)).toBe(1);
    expect(houseFor(25, cusps)).toBe(2);
    expect(houseFor(345, cusps)).toBe(12);
  });
});

describe("computeOverlay — synthetic charts", () => {
  const natal = {
    points: [
      { name: "sun", longitude: 100, speed: 1.0 },
      { name: "moon", longitude: 200, speed: 13.0 },
      { name: "asc", longitude: 45 },
    ],
    cusps: [45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345, 15],
  };

  it("detects exact conjunction within default orb", () => {
    const other = {
      points: [{ name: "saturn", longitude: 100.5, speed: 0.03 }],
    };
    const result = computeOverlay(natal, other);
    const hit = result.aspects.find(
      (a) => a.transitPoint === "saturn" && a.natalPoint === "sun"
    );
    expect(hit).toBeDefined();
    expect(hit?.aspect).toBe("conjunction");
    expect(hit?.orb).toBeCloseTo(0.5);
    expect(hit?.natalSign).toBe("Cancer");
  });

  it("rejects an aspect outside orb", () => {
    const other = {
      points: [{ name: "saturn", longitude: 104.5, speed: 0.03 }], // 4.5° off
    };
    const result = computeOverlay(natal, other);
    const hit = result.aspects.find(
      (a) => a.transitPoint === "saturn" && a.natalPoint === "sun"
    );
    expect(hit).toBeUndefined();
  });

  it("detects opposition, square, trine, sextile, and quincunx", () => {
    const other = {
      points: [
        { name: "opp", longitude: 280 },   // opposite sun (100 + 180)
        { name: "sq",  longitude: 190 },   // 90° from sun
        { name: "tr",  longitude: 220 },   // 120° from sun
        { name: "sx",  longitude: 160 },   // 60° from sun
        { name: "qx",  longitude: 250 },   // 150° from sun
      ],
    };
    const result = computeOverlay(natal, other);
    const kinds = result.aspects
      .filter((a) => a.natalPoint === "sun")
      .map((a) => a.aspect)
      .sort();
    expect(kinds).toEqual(["conjunction", "opposition", "quincunx", "sextile", "square", "trine"].sort().slice(1));
    // Note: no self-conjunction expected — verify each aspect type present exactly once.
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it("applying flag reflects motion toward exact", () => {
    const other = {
      points: [{ name: "mars", longitude: 99, speed: 0.5 }], // approaching sun at 100
    };
    const result = computeOverlay(natal, other);
    const hit = result.aspects.find((a) => a.transitPoint === "mars");
    expect(hit?.applying).toBe(true);
  });

  it("emits HD activations with natal-gate co-occurrence flag", () => {
    const other = {
      points: [{ name: "saturn", longitude: 100, speed: 0.03 }],
    };
    const result = computeOverlay(natal, other);
    const sat = result.hdActivations.find((a) => a.transitPoint === "saturn");
    expect(sat).toBeDefined();
    // natal Sun is also at 100 → same gate → natalPointSharingGate should point to "sun"
    expect(sat?.natalPointSharingGate).toBe("sun");
  });

  it("emits house overlays when cusps present", () => {
    const other = {
      points: [{ name: "jupiter", longitude: 100, speed: 0.1 }],
    };
    const result = computeOverlay(natal, other);
    const jup = result.houseOverlays.find((h) => h.transitPoint === "jupiter");
    // 100° falls in the range [75, 105] → house 2 per our synthetic cusps
    expect(jup?.inNatalHouse).toBe(2);
  });

  it("skips house overlays when cusps missing", () => {
    const skyOnly = { points: [{ name: "saturn", longitude: 100 }] };
    const result = computeOverlay({ points: natal.points }, skyOnly);
    expect(result.houseOverlays).toEqual([]);
  });

  it("respects the aspects option (subset detection)", () => {
    const other = {
      points: [
        { name: "sq", longitude: 190 },
        { name: "tr", longitude: 220 },
      ],
    };
    const result = computeOverlay(natal, other, { aspects: ["square"] });
    const kinds = result.aspects.map((a) => a.aspect);
    expect(kinds.every((k) => k === "square")).toBe(true);
  });

  it("respects orb overrides (tighter → fewer hits)", () => {
    const other = {
      points: [{ name: "saturn", longitude: 102.5 }], // 2.5° off from sun
    };
    const result = computeOverlay(natal, other, { orbs: { conjunction: 2 } });
    const hit = result.aspects.find((a) => a.natalPoint === "sun");
    expect(hit).toBeUndefined();
  });
});

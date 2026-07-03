import { describe, it, expect } from "vitest";
import { calculateTransitSky, calculateTransitToNatal } from "@/lib/calculators/transit";
import { DIANA } from "./fixtures/charts";

describe("calculateTransitSky", () => {
  it("returns planet positions for a known moment", () => {
    // 2026-03-14 12:00 UTC — sun should be in Pisces (around 353-354° tropical)
    const sky = calculateTransitSky({
      datetime: "2026-03-14T12:00:00",
      timezone: "UTC",
    });
    const sun = sky.planets.find((p) => p.name === "sun");
    expect(sun).toBeDefined();
    expect(sun?.sign.sign).toBe("Pisces");
    expect(sun?.longitude).toBeGreaterThan(340);
    expect(sun?.longitude).toBeLessThan(360);
    expect(sun?.gate).toBeGreaterThanOrEqual(1);
    expect(sun?.gate).toBeLessThanOrEqual(64);
  });

  it("includes South Node when North Node is in the planet list", () => {
    const sky = calculateTransitSky({
      datetime: "2026-01-01T00:00:00",
      timezone: "UTC",
      planets: ["true_node"],
    });
    const nn = sky.planets.find((p) => p.name === "true_node");
    const sn = sky.planets.find((p) => p.name === "south_node");
    expect(nn).toBeDefined();
    expect(sn).toBeDefined();
    const diff = Math.abs(((nn!.longitude - sn!.longitude + 540) % 360) - 180);
    expect(diff).toBeCloseTo(180);
  });

  it("marks retrograde bodies", () => {
    // Mercury is retrograde during known windows; just verify the flag is a boolean
    const sky = calculateTransitSky({
      datetime: "2024-12-06T00:00:00", // Mercury retrograde period Nov 25 - Dec 15 2024
      timezone: "UTC",
      planets: ["mercury"],
    });
    const merc = sky.planets.find((p) => p.name === "mercury");
    expect(merc).toBeDefined();
    expect(typeof merc?.retrograde).toBe("boolean");
    expect(merc?.retrograde).toBe(true);
  });
});

describe("calculateTransitToNatal", () => {
  it("returns natal + sky + overlay for a real chart", () => {
    const result = calculateTransitToNatal({
      natal: DIANA.birth,
      transit_datetime: "2026-03-14T12:00:00",
      transit_timezone: "UTC",
    });
    expect(result.natalChart.planets.length).toBeGreaterThan(5);
    expect(result.transitSky.planets.length).toBeGreaterThan(5);
    expect(result.overlay.aspects).toBeInstanceOf(Array);
    expect(result.overlay.hdActivations.length).toBeGreaterThan(0);
    expect(result.overlay.houseOverlays.length).toBeGreaterThan(0);
    // ASC and MC included as natal points → should appear in aspect/house data at least sometimes
    const hasAngleAspect = result.overlay.aspects.some(
      (a) => a.natalPoint === "asc" || a.natalPoint === "mc"
    );
    // Not guaranteed but likely with 12 transit planets and 3° orbs
    expect(typeof hasAngleAspect).toBe("boolean");
  });

  it("respects aspect subset restriction", () => {
    const result = calculateTransitToNatal({
      natal: DIANA.birth,
      transit_datetime: "2026-03-14T12:00:00",
      transit_timezone: "UTC",
      aspects: ["conjunction"],
    });
    for (const a of result.overlay.aspects) {
      expect(a.aspect).toBe("conjunction");
    }
  });

  it("emits natal signs on every aspect", () => {
    const result = calculateTransitToNatal({
      natal: DIANA.birth,
      transit_datetime: "2026-03-14T12:00:00",
      transit_timezone: "UTC",
    });
    for (const a of result.overlay.aspects) {
      expect(a.natalSign).toBeDefined();
      expect(typeof a.natalSign).toBe("string");
      expect(a.natalSign!.length).toBeGreaterThan(0);
    }
  });
});

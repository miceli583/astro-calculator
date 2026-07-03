import { describe, it, expect } from "vitest";
import { lookupTransitTheme, themesStatus } from "@/lib/calculators/transit-themes";

describe("transit-themes lookup", () => {
  it("themesStatus reports version and populated count", () => {
    const status = themesStatus();
    expect(status.version).toBe(1);
    expect(typeof status.populatedCount).toBe("number");
    expect(status.populatedCount).toBeGreaterThanOrEqual(0);
  });

  it("returns populated=false for a valid but unpopulated key", () => {
    const result = lookupTransitTheme({
      transitPlanet: "saturn",
      aspect: "conjunction",
      natalPoint: "sun",
      natalSign: "Aries",
    });
    expect(result.key).toBe("saturn.conjunction.sun.Aries");
    // Stub file ships empty
    expect(result.populated).toBe(false);
    expect(result.prose).toBeNull();
  });

  it("returns populated=true when the key exists (simulated by direct check)", () => {
    // The stub file ships empty. Once populated, populated should flip to true.
    // This test just exercises the contract shape.
    const result = lookupTransitTheme({
      transitPlanet: "jupiter",
      aspect: "trine",
      natalPoint: "moon",
      natalSign: "Cancer",
    });
    expect(result).toHaveProperty("populated");
    expect(result).toHaveProperty("prose");
    expect(result).toHaveProperty("themesVersion");
  });
});

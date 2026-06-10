import { describe, it, expect } from "vitest";
import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { DIANA } from "./fixtures/charts";

describe("HD Variables (4 arrows)", () => {
  const chart = calculateHumanDesign(DIANA.birth);

  it("returns all four variables", () => {
    expect(chart.variables).toBeDefined();
    expect(chart.variables.digestion).toBeDefined();
    expect(chart.variables.environment).toBeDefined();
    expect(chart.variables.perspective).toBeDefined();
    expect(chart.variables.motivation).toBeDefined();
  });

  it("digestion sources from Design Sun color (1-6)", () => {
    expect(chart.variables.digestion.source).toBe("Design Sun");
    expect(chart.variables.digestion.color).toBeGreaterThanOrEqual(1);
    expect(chart.variables.digestion.color).toBeLessThanOrEqual(6);
    expect(chart.variables.digestion.name.length).toBeGreaterThan(0);
  });

  it("environment sources from Design Sun tone (1-6)", () => {
    expect(chart.variables.environment.source).toBe("Design Sun");
    expect(chart.variables.environment.tone).toBeGreaterThanOrEqual(1);
    expect(chart.variables.environment.tone).toBeLessThanOrEqual(6);
  });

  it("perspective sources from Personality Sun color (1-6)", () => {
    expect(chart.variables.perspective.source).toBe("Personality Sun");
    expect(chart.variables.perspective.color).toBeGreaterThanOrEqual(1);
    expect(chart.variables.perspective.color).toBeLessThanOrEqual(6);
  });

  it("motivation sources from Personality Sun tone (1-6)", () => {
    expect(chart.variables.motivation.source).toBe("Personality Sun");
    expect(chart.variables.motivation.tone).toBeGreaterThanOrEqual(1);
    expect(chart.variables.motivation.tone).toBeLessThanOrEqual(6);
  });

  it("direction is Left (tones 1-3) or Right (tones 4-6)", () => {
    for (const v of [chart.variables.digestion, chart.variables.environment, chart.variables.perspective, chart.variables.motivation]) {
      expect(["Left", "Right"]).toContain(v.direction);
    }
  });
});

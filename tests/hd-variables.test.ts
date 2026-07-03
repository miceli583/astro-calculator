import { describe, it, expect } from "vitest";
import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { DIANA } from "./fixtures/charts";

// Reference charts with all PHS variable values verified against MyBodyGraph.
// These are the primary regression tests for HD Variable sourcing — swapping any
// source point or reading tone/color wrong will break them.
const REFERENCE_CHARTS = [
  {
    label: "New Orleans 1998-04-08 06:30",
    birth: {
      datetime: "1998-04-08T06:30:00",
      timezone: "America/Chicago",
      latitude: 29.9511,
      longitude: -90.0715,
    },
    expected: {
      type: "Generator",
      digestion: "Touch",
      environment: "Kitchens",
      perspective: "Probability",
      motivation: "Need",
      cognition: "Touch",
      signature: "Satisfaction",
      notSelfTheme: "Frustration",
    },
  },
  {
    label: "Stockholm 1974-01-03 00:02",
    birth: {
      datetime: "1974-01-03T00:02:00",
      timezone: "Europe/Stockholm",
      latitude: 59.3293,
      longitude: 18.0686,
    },
    expected: {
      type: "Generator",
      profile: "3/5",
      cross: "Right Angle Cross of Tension (38/39 | 48/21)",
      digestion: "Light",
      environment: "Markets",
      perspective: "Possibility",
      motivation: "Innocence",
      cognition: "Touch",
      signature: "Satisfaction",
      notSelfTheme: "Frustration",
    },
  },
] as const;

describe("HD Variables — MyBodyGraph reference charts", () => {
  for (const fx of REFERENCE_CHARTS) {
    describe(fx.label, () => {
      const chart = calculateHumanDesign(fx.birth);
      const e = fx.expected;

      it("type matches", () => {
        expect(chart.type).toBe(e.type);
      });

      if ("profile" in e) {
        it("profile matches", () => {
          expect(chart.profile).toBe(e.profile);
        });
      }

      if ("cross" in e) {
        it("incarnation cross matches", () => {
          expect(chart.incarnationCross.name).toBe(e.cross);
        });
      }

      it("digestion (Design Sun color)", () => {
        expect(chart.variables.digestion.source).toBe("Design Sun");
        expect(chart.variables.digestion.name).toBe(e.digestion);
      });

      it("environment (Design North Node color)", () => {
        expect(chart.variables.environment.source).toBe("Design North Node");
        expect(chart.variables.environment.name).toBe(e.environment);
      });

      it("perspective (Personality North Node color)", () => {
        expect(chart.variables.perspective.source).toBe("Personality North Node");
        expect(chart.variables.perspective.name).toBe(e.perspective);
      });

      it("motivation (Personality Sun color)", () => {
        expect(chart.variables.motivation.source).toBe("Personality Sun");
        expect(chart.variables.motivation.name).toBe(e.motivation);
      });

      it("cognition (Design Sun tone)", () => {
        expect(chart.variables.cognition.source).toBe("Design Sun");
        expect(chart.variables.cognition.name).toBe(e.cognition);
      });

      it("signature and not-self theme", () => {
        expect(chart.signature).toBe(e.signature);
        expect(chart.notSelfTheme).toBe(e.notSelfTheme);
      });
    });
  }
});

describe("HD Variables — structural checks (Diana)", () => {
  const chart = calculateHumanDesign(DIANA.birth);

  it("returns all four arrow variables with valid shapes", () => {
    for (const v of [
      chart.variables.digestion,
      chart.variables.environment,
      chart.variables.perspective,
      chart.variables.motivation,
    ]) {
      expect(v.color).toBeGreaterThanOrEqual(1);
      expect(v.color).toBeLessThanOrEqual(6);
      expect(v.name.length).toBeGreaterThan(0);
      expect(["Left", "Right"]).toContain(v.direction);
    }
  });

  it("cognition (5th PHS variable) has a tone-based value", () => {
    expect(chart.variables.cognition.tone).toBeGreaterThanOrEqual(1);
    expect(chart.variables.cognition.tone).toBeLessThanOrEqual(6);
    expect(chart.variables.cognition.name.length).toBeGreaterThan(0);
  });

  it("signature and not-self are populated for every type", () => {
    expect(chart.signature.length).toBeGreaterThan(0);
    expect(chart.notSelfTheme.length).toBeGreaterThan(0);
  });
});

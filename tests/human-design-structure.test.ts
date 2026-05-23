// Human Design structural and algorithmic tests.
//
// These verify the calculator's internal consistency and that it produces
// structurally valid Human Design output. They do NOT verify the gate-wheel
// offset against an external reference — that requires comparison to a chart
// from jovianarchive.com (Ra Uru Hu's official software) and is tracked
// separately in human-design-snapshot.test.ts and the project's TODO.md.

import { describe, it, expect } from "vitest";
import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { CHANNELS, ALL_CENTERS } from "@/lib/constants/hd-channels";
import { DIANA, EINSTEIN } from "./fixtures/charts";

describe("HD chart — structural invariants", () => {
  for (const fixture of [DIANA, EINSTEIN]) {
    describe(fixture.name, () => {
      const chart = calculateHumanDesign(fixture.birth);

      it("returns 13 activations on each side (Personality + Design)", () => {
        // 11 planets (sun..pluto + true_node) + earth + south_node = 13
        expect(chart.personality.activations.length).toBe(13);
        expect(chart.design.activations.length).toBe(13);
      });

      it("each activation has valid gate (1-64), line (1-6), color/tone (1-6), base (1-5)", () => {
        for (const act of [...chart.personality.activations, ...chart.design.activations]) {
          expect(act.gate, `${act.planet} gate`).toBeGreaterThanOrEqual(1);
          expect(act.gate, `${act.planet} gate`).toBeLessThanOrEqual(64);
          expect(act.line, `${act.planet} line`).toBeGreaterThanOrEqual(1);
          expect(act.line, `${act.planet} line`).toBeLessThanOrEqual(6);
          expect(act.color).toBeGreaterThanOrEqual(1);
          expect(act.color).toBeLessThanOrEqual(6);
          expect(act.tone).toBeGreaterThanOrEqual(1);
          expect(act.tone).toBeLessThanOrEqual(6);
          expect(act.base).toBeGreaterThanOrEqual(1);
          expect(act.base).toBeLessThanOrEqual(5);
        }
      });

      it("Personality Earth is exactly 180° from Personality Sun", () => {
        const sun = chart.personality.activations.find((a) => a.planet === "sun")!;
        const earth = chart.personality.activations.find((a) => a.planet === "earth")!;
        const separation = ((earth.longitude - sun.longitude + 360) % 360);
        expect(Math.abs(separation - 180)).toBeLessThan(1e-9);
      });

      it("Personality South Node is exactly 180° from Personality True Node", () => {
        const nn = chart.personality.activations.find((a) => a.planet === "true_node")!;
        const sn = chart.personality.activations.find((a) => a.planet === "south_node")!;
        const separation = ((sn.longitude - nn.longitude + 360) % 360);
        expect(Math.abs(separation - 180)).toBeLessThan(1e-9);
      });

      it("Design Sun is ~88° before Personality Sun (within 0.01°)", () => {
        const pSun = chart.personality.activations.find((a) => a.planet === "sun")!;
        const dSun = chart.design.activations.find((a) => a.planet === "sun")!;
        const target = (pSun.longitude - 88 + 360) % 360;
        const diff = Math.abs(((dSun.longitude - target + 540) % 360) - 180);
        expect(diff).toBeLessThan(0.01);
      });

      it("Design JD is 88° of solar arc earlier — 85 to 92 calendar days due to orbital eccentricity", () => {
        // The HD design half is "Sun was 88° behind Personality Sun". The
        // Sun's apparent daily motion varies from ~0.953°/day (near aphelion
        // in July) to ~1.019°/day (near perihelion in January), so 88° takes
        // anywhere from 86.4 to 92.3 calendar days depending on birth date.
        const dt = chart.personality.jd_ut - chart.design.jd_ut;
        expect(dt).toBeGreaterThan(85);
        expect(dt).toBeLessThan(93);
      });

      it("definedCenters and undefinedCenters partition all 9 centers", () => {
        const union = new Set([...chart.definedCenters, ...chart.undefinedCenters]);
        expect(union.size).toBe(9);
        for (const c of ALL_CENTERS) expect(union.has(c)).toBe(true);
        const overlap = chart.definedCenters.filter((c) => chart.undefinedCenters.includes(c));
        expect(overlap).toEqual([]);
      });

      it("every reported channel's gates are present in the combined activations", () => {
        const allGates = new Set<number>();
        for (const a of chart.personality.activations) allGates.add(a.gate);
        for (const a of chart.design.activations) allGates.add(a.gate);
        for (const ch of chart.channels) {
          expect(allGates.has(ch.gates[0]), `gate ${ch.gates[0]} missing`).toBe(true);
          expect(allGates.has(ch.gates[1]), `gate ${ch.gates[1]} missing`).toBe(true);
        }
      });

      it("every reported channel exists in the canonical CHANNELS table", () => {
        for (const ch of chart.channels) {
          const found = CHANNELS.find(
            (c) =>
              (c.gates[0] === ch.gates[0] && c.gates[1] === ch.gates[1]) ||
              (c.gates[0] === ch.gates[1] && c.gates[1] === ch.gates[0])
          );
          expect(found, `${ch.gates[0]}-${ch.gates[1]}`).toBeDefined();
        }
      });

      it("channels don't duplicate (each gate-pair appears at most once)", () => {
        const seen = new Set<string>();
        for (const ch of chart.channels) {
          const key = [...ch.gates].sort((a, b) => a - b).join("-");
          expect(seen.has(key), key).toBe(false);
          seen.add(key);
        }
      });

      it("type matches sacral/throat/motor logic", () => {
        const defined = new Set(chart.definedCenters);
        if (defined.size === 0) {
          expect(chart.type).toBe("Reflector");
        } else if (defined.has("sacral")) {
          expect(["Generator", "Manifesting Generator"]).toContain(chart.type);
        } else {
          expect(["Manifestor", "Projector"]).toContain(chart.type);
        }
      });

      it("authority matches center-priority logic", () => {
        const d = new Set(chart.definedCenters);
        const a = chart.authority;
        if (chart.type === "Reflector") expect(a).toBe("Lunar");
        else if (d.has("solar_plexus")) expect(a).toBe("Emotional");
        else if (d.has("sacral")) expect(a).toBe("Sacral");
        else if (d.has("spleen")) expect(a).toBe("Splenic");
        else if (d.has("heart")) {
          expect(a).toBe(chart.type === "Manifestor" ? "Ego Manifested" : "Ego Projected");
        } else if (d.has("g") && d.has("throat")) expect(a).toBe("Self Projected");
        else if (d.has("ajna") || d.has("head")) expect(a).toBe("Mental");
        else expect(a).toBe("None");
      });

      it("profile is in the form 'N/M' where N,M are 1-6 lines", () => {
        const match = /^(\d)\/(\d)$/.exec(chart.profile);
        expect(match, `profile=${chart.profile}`).not.toBeNull();
        const n = Number(match![1]);
        const m = Number(match![2]);
        expect(n).toBeGreaterThanOrEqual(1);
        expect(n).toBeLessThanOrEqual(6);
        expect(m).toBeGreaterThanOrEqual(1);
        expect(m).toBeLessThanOrEqual(6);
      });

      it("incarnation cross names 4 valid gates", () => {
        for (const g of chart.incarnationCross.gates) {
          expect(g).toBeGreaterThanOrEqual(1);
          expect(g).toBeLessThanOrEqual(64);
        }
      });

      it("strategy matches type", () => {
        const expectedStrat: Record<string, string> = {
          Reflector: "Wait a lunar cycle (28 days) before major decisions",
          Manifestor: "Inform before acting",
          Generator: "Wait to respond",
          "Manifesting Generator": "Wait to respond, then inform",
          Projector: "Wait for the invitation",
        };
        expect(chart.strategy).toBe(expectedStrat[chart.type]);
      });
    });
  }
});

describe("HD design-time calculation", () => {
  it("design Sun is at Personality Sun - 88° within 0.001°", () => {
    const chart = calculateHumanDesign({
      datetime: "2000-06-21T00:00:00",
      timezone: "UTC",
      latitude: 0,
      longitude: 0,
    });
    const pSun = chart.personality.activations.find((a) => a.planet === "sun")!.longitude;
    const dSun = chart.design.activations.find((a) => a.planet === "sun")!.longitude;
    const target = (pSun - 88 + 360) % 360;
    const diff = Math.abs(((dSun - target + 540) % 360) - 180);
    expect(diff).toBeLessThan(0.001);
  });

  it("design-time iteration terminates across a range of births", () => {
    for (const iso of ["1900-01-01T00:00:00", "1950-06-15T12:00:00", "2025-12-31T23:59:00"]) {
      const chart = calculateHumanDesign({
        datetime: iso,
        timezone: "UTC",
        latitude: 0,
        longitude: 0,
      });
      const dSun = chart.design.activations.find((a) => a.planet === "sun")!;
      expect(dSun.longitude).toBeGreaterThanOrEqual(0);
      expect(dSun.longitude).toBeLessThan(360);
    }
  });
});

describe("HD output is invariant to latitude/longitude (depends only on UT)", () => {
  it("Diana's HD chart is identical at her birth lat/lon and at (0,0)", () => {
    const here = calculateHumanDesign(DIANA.birth);
    const there = calculateHumanDesign({ ...DIANA.birth, latitude: 0, longitude: 0 });
    expect(there.type).toBe(here.type);
    expect(there.authority).toBe(here.authority);
    expect(there.profile).toBe(here.profile);
    expect(there.definition).toBe(here.definition);
    expect(there.definedCenters.sort()).toEqual(here.definedCenters.sort());
    expect(there.incarnationCross.gates).toEqual(here.incarnationCross.gates);
    expect(there.channels.length).toBe(here.channels.length);
    // Activations should match gate-for-gate
    for (let i = 0; i < here.personality.activations.length; i++) {
      expect(there.personality.activations[i].gate).toBe(here.personality.activations[i].gate);
      expect(there.personality.activations[i].line).toBe(here.personality.activations[i].line);
    }
  });
});

describe("HD across multiple births — type and authority are valid", () => {
  const births = [
    { ...DIANA.birth, label: "Diana" },
    { ...EINSTEIN.birth, label: "Einstein" },
    { datetime: "2000-01-01T00:00:00", timezone: "UTC", latitude: 0,  longitude: 0,   label: "Y2K-UTC" },
    { datetime: "1980-07-15T14:30:00", timezone: "America/New_York", latitude: 40.7, longitude: -74, label: "1980-NYC" },
  ];

  for (const b of births) {
    it(`${b.label}: produces a valid type and authority`, () => {
      const chart = calculateHumanDesign({
        datetime: b.datetime,
        timezone: b.timezone,
        latitude: b.latitude,
        longitude: b.longitude,
      });
      expect(["Reflector", "Manifestor", "Generator", "Manifesting Generator", "Projector"]).toContain(chart.type);
      expect(["Emotional", "Sacral", "Splenic", "Ego Manifested", "Ego Projected", "Self Projected", "Mental", "Lunar", "None"]).toContain(chart.authority);
    });
  }
});

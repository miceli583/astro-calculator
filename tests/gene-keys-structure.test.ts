// Gene Keys structural tests.
//
// Gene Keys uses the same 64-gate wheel as Human Design. With GATE_WHEEL_OFFSET
// now anchored to Gate 41 at 302° (= 2° Aquarius), the gate output should
// match HD's output for any shared planet.

import { describe, it, expect } from "vitest";
import { calculateGeneKeys } from "@/lib/calculators/gene-keys";
import { calculateHumanDesign } from "@/lib/calculators/human-design";
import { DIANA, EINSTEIN } from "./fixtures/charts";

describe("Gene Keys — structural validity", () => {
  for (const fixture of [DIANA, EINSTEIN]) {
    describe(fixture.name, () => {
      const profile = calculateGeneKeys(fixture.birth);

      it("Activation Sequence has 4 spheres with valid gate/line", () => {
        const spheres = [profile.activation.lifesWork, profile.activation.evolution, profile.activation.radiance, profile.activation.purpose];
        for (const s of spheres) {
          expect(s.gate, s.name).toBeGreaterThanOrEqual(1);
          expect(s.gate, s.name).toBeLessThanOrEqual(64);
          expect(s.line, s.name).toBeGreaterThanOrEqual(1);
          expect(s.line, s.name).toBeLessThanOrEqual(6);
        }
      });

      it("Venus Sequence has 6 spheres with valid gate/line", () => {
        const spheres = [
          profile.venus.attraction, profile.venus.iq, profile.venus.eq,
          profile.venus.sq, profile.venus.core, profile.venus.wound,
        ];
        for (const s of spheres) {
          expect(s.gate, s.name).toBeGreaterThanOrEqual(1);
          expect(s.gate, s.name).toBeLessThanOrEqual(64);
          expect(s.line, s.name).toBeGreaterThanOrEqual(1);
          expect(s.line, s.name).toBeLessThanOrEqual(6);
        }
      });

      it("Pearl Sequence has 3 spheres with valid gate/line", () => {
        const spheres = [profile.pearl.vocation, profile.pearl.culture, profile.pearl.brand];
        for (const s of spheres) {
          expect(s.gate, s.name).toBeGreaterThanOrEqual(1);
          expect(s.gate, s.name).toBeLessThanOrEqual(64);
          expect(s.line, s.name).toBeGreaterThanOrEqual(1);
          expect(s.line, s.name).toBeLessThanOrEqual(6);
        }
      });

      it("Activation 'brand' (Pearl) equals 'Life's Work' (Activation) — both are Personality Sun", () => {
        expect(profile.pearl.brand.gate).toBe(profile.activation.lifesWork.gate);
        expect(profile.pearl.brand.line).toBe(profile.activation.lifesWork.line);
      });

      it("Venus 'core' equals Activation 'purpose' — both are Design Earth", () => {
        expect(profile.venus.core.gate).toBe(profile.activation.purpose.gate);
        expect(profile.venus.core.line).toBe(profile.activation.purpose.line);
      });

      it("Gene Keys Life's Work gate matches HD Personality Sun gate", () => {
        const hd = calculateHumanDesign(fixture.birth);
        const hdPSun = hd.personality.activations.find((a) => a.planet === "sun")!;
        expect(profile.activation.lifesWork.gate).toBe(hdPSun.gate);
        expect(profile.activation.lifesWork.line).toBe(hdPSun.line);
      });

      it("Gene Keys Evolution gate matches HD Personality Earth gate", () => {
        const hd = calculateHumanDesign(fixture.birth);
        const hdPEarth = hd.personality.activations.find((a) => a.planet === "earth")!;
        expect(profile.activation.evolution.gate).toBe(hdPEarth.gate);
        expect(profile.activation.evolution.line).toBe(hdPEarth.line);
      });

      it("Personality and Design JDs differ by 85-92 days (the 88° solar arc range)", () => {
        const dt = profile.personality_jd_ut - profile.design_jd_ut;
        expect(dt).toBeGreaterThan(85);
        expect(dt).toBeLessThan(93);
      });
    });
  }
});

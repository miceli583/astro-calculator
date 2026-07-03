import { describe, it, expect } from "vitest";
import { calculateSkyEvents } from "@/lib/calculators/sky-events";

describe("calculateSkyEvents", () => {
  it("returns chronologically sorted events", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2026-04-01",
    });
    expect(result.events.length).toBeGreaterThan(0);
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].datetime >= result.events[i - 1].datetime).toBe(true);
    }
  });

  it("finds Mercury retrograde stations", () => {
    // Mercury retrogrades ~3x per year, ~3 weeks each. Over a full year we
    // expect ~6 station events (3 retrograde + 3 direct).
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      categories: ["retrograde"],
      retrograde_planets: ["mercury"],
    });
    const retro = result.events.filter((e) => e.type === "retrograde_station" && e.body === "mercury");
    const direct = result.events.filter((e) => e.type === "direct_station" && e.body === "mercury");
    expect(retro.length).toBeGreaterThanOrEqual(3);
    expect(direct.length).toBeGreaterThanOrEqual(3);
    // Every retrograde should be followed by a direct station
    expect(Math.abs(retro.length - direct.length)).toBeLessThanOrEqual(1);
  });

  it("finds new moons every ~29.5 days", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      categories: ["lunation"],
    });
    const newMoons = result.events.filter((e) => e.type === "new_moon");
    // ~12-13 new moons per year
    expect(newMoons.length).toBeGreaterThanOrEqual(11);
    expect(newMoons.length).toBeLessThanOrEqual(14);

    // Check spacing — new moons should be ~28-31 days apart
    for (let i = 1; i < newMoons.length; i++) {
      const prev = new Date(newMoons[i - 1].datetime).getTime();
      const cur = new Date(newMoons[i].datetime).getTime();
      const gapDays = (cur - prev) / (1000 * 60 * 60 * 24);
      expect(gapDays).toBeGreaterThan(28);
      expect(gapDays).toBeLessThan(31);
    }
  });

  it("emits full moons in each new-lunation-cycle window", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      categories: ["lunation"],
    });
    const fullMoons = result.events.filter((e) => e.type === "full_moon");
    expect(fullMoons.length).toBeGreaterThanOrEqual(2);
  });

  it("finds Sun sign ingresses (12 per year)", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      categories: ["ingress"],
      ingress_planets: ["sun"],
    });
    const sunIngresses = result.events.filter(
      (e) => e.type === "sign_ingress" && e.body === "sun"
    );
    // Sun crosses all 12 sign boundaries per year
    expect(sunIngresses.length).toBe(12);
    // Each ingress must include a to-sign and a from-sign
    for (const ev of sunIngresses) {
      expect(ev.sign).toBeDefined();
      expect(ev.fromSign).toBeDefined();
      expect(ev.sign).not.toBe(ev.fromSign);
    }
  });

  it("detects at least 2 eclipses per year (eclipse seasons)", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      categories: ["eclipse"],
    });
    const eclipses = result.events.filter(
      (e) => e.type === "solar_eclipse" || e.type === "lunar_eclipse"
    );
    // Eclipse seasons produce ~4-6 eclipses per year on average
    expect(eclipses.length).toBeGreaterThanOrEqual(2);
    expect(eclipses.length).toBeLessThanOrEqual(8);
    for (const ev of eclipses) {
      expect(ev.eclipseNodeDistance).toBeDefined();
      expect(ev.eclipseNodeDistance).toBeLessThan(20);
    }
  });

  it("respects the max-scan-years cap", () => {
    expect(() =>
      calculateSkyEvents({
        start_date: "2000-01-01",
        end_date: "2100-01-01",
      })
    ).toThrow(/exceeds max/);
  });

  it("filters by category", () => {
    const result = calculateSkyEvents({
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      categories: ["lunation"],
    });
    for (const ev of result.events) {
      expect(["new_moon", "first_quarter", "full_moon", "last_quarter"]).toContain(ev.type);
    }
  });
});

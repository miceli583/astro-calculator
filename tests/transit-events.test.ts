import { describe, it, expect } from "vitest";
import { calculateTransitEvents } from "@/lib/calculators/transit-events";
import { DIANA } from "./fixtures/charts";

describe("calculateTransitEvents", () => {
  it("returns events sorted by orbEnter date", () => {
    const result = calculateTransitEvents({
      natal: DIANA.birth,
      start_date: "2026-01-01",
      end_date: "2027-01-01",
      transit_planets: ["saturn", "jupiter"],
      aspects: ["conjunction", "opposition", "square"],
    });
    expect(result.events.length).toBeGreaterThan(0);
    // Sorted ascending by orbEnter
    for (let i = 1; i < result.events.length; i++) {
      expect(result.events[i].orbEnter >= result.events[i - 1].orbEnter).toBe(true);
    }
  });

  it("every event has valid date fields and a natal sign", () => {
    const result = calculateTransitEvents({
      natal: DIANA.birth,
      start_date: "2026-01-01",
      end_date: "2026-06-01",
      transit_planets: ["jupiter"],
    });
    for (const ev of result.events) {
      expect(ev.orbEnter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.orbLeave).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ev.orbLeave >= ev.orbEnter).toBe(true);
      expect(ev.peaks.length).toBeGreaterThan(0);
      expect(ev.natalSign.length).toBeGreaterThan(0);
      expect(ev.aspect).toBeDefined();
    }
  });

  it("detects retrograde loops for slow outer planets", () => {
    // Saturn over a multi-year window is virtually guaranteed to produce at least
    // one retrograde-loop transit against any natal chart's Sun/Moon/etc.
    const result = calculateTransitEvents({
      natal: DIANA.birth,
      start_date: "2026-01-01",
      end_date: "2029-01-01",
      transit_planets: ["saturn"],
    });
    const withLoops = result.events.filter((e) => e.isRetrogradeLoop);
    // Multi-peak events should exist for Saturn transits over 3 years
    expect(withLoops.length).toBeGreaterThan(0);
    for (const ev of withLoops) {
      expect(ev.peaks.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("respects the max-scan-years cap", () => {
    expect(() =>
      calculateTransitEvents({
        natal: DIANA.birth,
        start_date: "2000-01-01",
        end_date: "2050-01-01", // 50 years > 20-year cap
        transit_planets: ["saturn"],
      })
    ).toThrow(/exceeds max/);
  });

  it("returns empty events when end < start", () => {
    const result = calculateTransitEvents({
      natal: DIANA.birth,
      start_date: "2026-06-01",
      end_date: "2026-01-01",
    });
    expect(result.events).toEqual([]);
  });

  it("filters by transit_planets and aspects options", () => {
    const result = calculateTransitEvents({
      natal: DIANA.birth,
      start_date: "2026-01-01",
      end_date: "2026-04-01",
      transit_planets: ["jupiter"],
      aspects: ["conjunction"],
    });
    for (const ev of result.events) {
      expect(ev.transitPlanet).toBe("jupiter");
      expect(ev.aspect).toBe("conjunction");
    }
  });
});

import { describe, it, expect } from "vitest";
import {
  MODERN_RULERS,
  TRADITIONAL_RULERS,
  rulerOfSign,
} from "@/lib/constants/rulerships";
import {
  calculateNatalChart,
  calculateSolarReturn,
  ZODIAC_SIGNS,
} from "@/lib/calculators/astrology";
import { calculateComposite } from "@/lib/calculators/composite";
import { DIANA, EINSTEIN, JOBS } from "./fixtures/charts";

// A birth moment with a Scorpio Ascendant (probed against this codebase's own
// house math) — the sign where modern (Pluto) and traditional (Mars) diverge.
const SCORPIO_ASC_BIRTH = {
  datetime: "1990-03-15T22:00:00",
  timezone: "America/New_York",
  latitude: 40.7128,
  longitude: -74.006,
};

describe("rulership tables", () => {
  it("cover all 12 signs in both conventions", () => {
    for (const sign of ZODIAC_SIGNS) {
      expect(MODERN_RULERS[sign]).toBeDefined();
      expect(TRADITIONAL_RULERS[sign]).toBeDefined();
    }
  });

  it("diverge exactly for Scorpio, Aquarius, and Pisces", () => {
    const diverging = ZODIAC_SIGNS.filter(
      (s) => MODERN_RULERS[s] !== TRADITIONAL_RULERS[s],
    );
    expect(diverging.sort()).toEqual(["Aquarius", "Pisces", "Scorpio"]);
    expect(MODERN_RULERS.Scorpio).toBe("pluto");
    expect(TRADITIONAL_RULERS.Scorpio).toBe("mars");
    expect(MODERN_RULERS.Aquarius).toBe("uranus");
    expect(TRADITIONAL_RULERS.Aquarius).toBe("saturn");
    expect(MODERN_RULERS.Pisces).toBe("neptune");
    expect(TRADITIONAL_RULERS.Pisces).toBe("jupiter");
  });

  it("rulerOfSign defaults to modern and rejects unknown signs", () => {
    expect(rulerOfSign("Scorpio")).toBe("pluto");
    expect(rulerOfSign("Scorpio", "traditional")).toBe("mars");
    expect(rulerOfSign("Leo", "traditional")).toBe("sun");
    expect(() => rulerOfSign("Ophiuchus")).toThrow();
  });
});

describe("natal chart ruler", () => {
  it("Diana: Sagittarius rising → Jupiter in Aquarius in the 2nd house", () => {
    const chart = calculateNatalChart(DIANA.birth);
    const cr = chart.chartRuler;
    expect(cr.ascendantSign).toBe("Sagittarius");
    expect(cr.convention).toBe("modern");
    expect(cr.ruler).toBe("jupiter");
    // Sagittarius rules the same in both conventions.
    expect(cr.modernRuler).toBe("jupiter");
    expect(cr.traditionalRuler).toBe("jupiter");
    expect(cr.placement).not.toBeNull();
    expect(cr.placement!.sign.sign).toBe("Aquarius");
    expect(cr.placement!.house).toBe(2);
  });

  it("Einstein: Cancer rising → Moon in Sagittarius in the 6th house", () => {
    const cr = calculateNatalChart(EINSTEIN.birth).chartRuler;
    expect(cr.ascendantSign).toBe("Cancer");
    expect(cr.ruler).toBe("moon");
    expect(cr.placement!.sign.sign).toBe("Sagittarius");
    expect(cr.placement!.house).toBe(6);
  });

  it("Scorpio rising: modern gives Pluto, traditional flag gives Mars, both always reported", () => {
    const modern = calculateNatalChart(SCORPIO_ASC_BIRTH).chartRuler;
    expect(modern.ascendantSign).toBe("Scorpio");
    expect(modern.convention).toBe("modern");
    expect(modern.ruler).toBe("pluto");
    expect(modern.modernRuler).toBe("pluto");
    expect(modern.traditionalRuler).toBe("mars");

    const traditional = calculateNatalChart({
      ...SCORPIO_ASC_BIRTH,
      rulership: "traditional",
    }).chartRuler;
    expect(traditional.convention).toBe("traditional");
    expect(traditional.ruler).toBe("mars");
    expect(traditional.modernRuler).toBe("pluto");
    expect(traditional.traditionalRuler).toBe("mars");
  });

  it("placement matches the ruler's planet entry exactly", () => {
    const chart = calculateNatalChart(JOBS.birth);
    const cr = chart.chartRuler;
    const planet = chart.planets.find((p) => p.name === cr.ruler)!;
    expect(cr.placement).toEqual({
      longitude: planet.longitude,
      sign: planet.sign,
      house: planet.house,
      retrograde: planet.retrograde,
      speed: planet.speed,
    });
  });

  it("aspects contain exactly the chart aspects involving the ruler", () => {
    const chart = calculateNatalChart(DIANA.birth);
    const cr = chart.chartRuler;
    const expected = chart.aspects.filter(
      (a) => a.from === cr.ruler || a.to === cr.ruler,
    );
    expect(cr.aspects).toEqual(expected);
    expect(cr.aspects.length).toBeGreaterThan(0);
  });

  it("placement is null when the requested planet subset omits the ruler", () => {
    const chart = calculateNatalChart({
      ...DIANA.birth,
      planets: ["sun", "moon"], // Sagittarius rising, but no Jupiter computed
    });
    expect(chart.chartRuler.ruler).toBe("jupiter");
    expect(chart.chartRuler.placement).toBeNull();
    expect(chart.chartRuler.aspects).toEqual([]);
  });
});

describe("chart ruler in derived charts", () => {
  it("solar return charts honor the natal rulership flag", () => {
    const sr = calculateSolarReturn({
      natal: { ...SCORPIO_ASC_BIRTH, rulership: "traditional" },
      year: 2026,
    });
    expect(sr.chartRuler.convention).toBe("traditional");
    // Whatever the return ASC is, the ruler follows the traditional table.
    expect(sr.chartRuler.ruler).toBe(
      TRADITIONAL_RULERS[sr.chartRuler.ascendantSign],
    );
  });

  it("composite charts expose a chart ruler with placement and aspects", () => {
    const comp = calculateComposite({ charts: [DIANA.birth, EINSTEIN.birth] });
    const cr = comp.chartRuler;
    expect(cr.convention).toBe("modern");
    expect(cr.ruler).toBe(MODERN_RULERS[cr.ascendantSign]);
    expect(cr.placement).not.toBeNull();
    const planet = comp.planets.find((p) => p.name === cr.ruler)!;
    expect(cr.placement!.longitude).toBe(planet.longitude);

    const traditional = calculateComposite({
      charts: [DIANA.birth, EINSTEIN.birth],
      rulership: "traditional",
    });
    expect(traditional.chartRuler.convention).toBe("traditional");
    expect(traditional.chartRuler.ruler).toBe(
      TRADITIONAL_RULERS[traditional.chartRuler.ascendantSign],
    );
  });
});

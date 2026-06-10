import { describe, it, expect } from "vitest";
import {
  calculateNatalChart,
  calculateProgressions,
  calculateSolarReturn,
} from "@/lib/calculators/astrology";
import { calcPlanet } from "@/lib/ephemeris/client";
import { DIANA } from "./fixtures/charts";

describe("Part of Fortune", () => {
  const chart = calculateNatalChart(DIANA.birth);

  it("Part of Fortune is present with sign + house", () => {
    expect(chart.partOfFortune).toBeDefined();
    expect(chart.partOfFortune.longitude).toBeGreaterThanOrEqual(0);
    expect(chart.partOfFortune.longitude).toBeLessThan(360);
    expect(chart.partOfFortune.house).toBeGreaterThanOrEqual(1);
    expect(chart.partOfFortune.house).toBeLessThanOrEqual(12);
  });

  it("Day formula = ASC + Moon - Sun; Night formula = ASC + Sun - Moon", () => {
    const sun = chart.planets.find((p) => p.name === "sun")!;
    const moon = chart.planets.find((p) => p.name === "moon")!;
    const asc = chart.houses.ascendant.longitude;
    const expected = chart.partOfFortune.isDayBirth
      ? ((asc + moon.longitude - sun.longitude) % 360 + 360) % 360
      : ((asc + sun.longitude - moon.longitude) % 360 + 360) % 360;
    expect(Math.abs(chart.partOfFortune.longitude - expected)).toBeLessThan(1e-9);
  });
});

describe("Secondary Progressions", () => {
  it("at years=0 the progressed Sun matches the natal Sun within rounding", () => {
    const prog = calculateProgressions({ ...DIANA.birth, years: 0 });
    const natal = calculateNatalChart(DIANA.birth);
    const pSun = prog.planets.find((p) => p.name === "sun")!;
    const nSun = natal.planets.find((p) => p.name === "sun")!;
    expect(Math.abs(pSun.longitude - nSun.longitude)).toBeLessThan(1e-6);
  });

  it("progressed Moon moves ~12-15° per year (one symbolic day ≈ 13°/day moon motion)", () => {
    const y0 = calculateProgressions({ ...DIANA.birth, years: 0 });
    const y1 = calculateProgressions({ ...DIANA.birth, years: 1 });
    const m0 = y0.planets.find((p) => p.name === "moon")!.longitude;
    const m1 = y1.planets.find((p) => p.name === "moon")!.longitude;
    const diff = ((m1 - m0 + 540) % 360) - 180;
    expect(Math.abs(diff)).toBeGreaterThan(11);
    expect(Math.abs(diff)).toBeLessThan(16);
  });

  it("progressed Sun moves ~1° per year", () => {
    const y0 = calculateProgressions({ ...DIANA.birth, years: 0 });
    const y30 = calculateProgressions({ ...DIANA.birth, years: 30 });
    const s0 = y0.planets.find((p) => p.name === "sun")!.longitude;
    const s30 = y30.planets.find((p) => p.name === "sun")!.longitude;
    const diff = ((s30 - s0 + 540) % 360) - 180;
    expect(Math.abs(diff)).toBeGreaterThan(28);
    expect(Math.abs(diff)).toBeLessThan(32);
  });
});

describe("Solar Return", () => {
  it("Sun at return JD equals natal Sun longitude (within 1 arcsecond)", () => {
    const sr = calculateSolarReturn({ natal: DIANA.birth, year: 2000 });
    const returnSun = calcPlanet(sr.return_jd_ut, "sun").longitude;
    const diff = ((returnSun - sr.natal_sun_longitude + 540) % 360) - 180;
    expect(Math.abs(diff)).toBeLessThan(1 / 3600); // <1 arcsec
  });

  it("the returned chart has houses, planets, and aspects", () => {
    const sr = calculateSolarReturn({ natal: DIANA.birth, year: 2000 });
    expect(sr.planets.length).toBeGreaterThan(0);
    expect(sr.houses.cusps.length).toBe(12);
    expect(sr.aspects.length).toBeGreaterThan(0);
  });

  it("relocation flag flips when lat/lon are different from natal", () => {
    const sr = calculateSolarReturn({
      natal: DIANA.birth,
      year: 2000,
      relocation: { latitude: 40, longitude: -74, timezone: "America/New_York" },
    });
    expect(sr.relocated).toBe(true);
  });
});

describe("Black Moon Lilith (mean) — sweph integration", () => {
  it("can request mean_lilith via the natal endpoint", () => {
    const chart = calculateNatalChart({
      ...DIANA.birth,
      planets: ["sun", "moon", "mean_lilith"],
    });
    const lilith = chart.planets.find((p) => p.name === "mean_lilith");
    expect(lilith).toBeDefined();
    expect(lilith!.longitude).toBeGreaterThanOrEqual(0);
    expect(lilith!.longitude).toBeLessThan(360);
  });
});

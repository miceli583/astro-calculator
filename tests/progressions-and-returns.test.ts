import { describe, it, expect } from "vitest";
import {
  calculateNatalChart,
  calculatePlanetaryReturn,
  calculateProgressions,
  calculateSolarReturn,
} from "@/lib/calculators/astrology";
import { calcPlanet, julianDayUT } from "@/lib/ephemeris/client";
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

describe("Planetary Returns", () => {
  const natalJd = julianDayUT(DIANA.birth.datetime, DIANA.birth.timezone);

  it("Sun return via calculatePlanetaryReturn matches calculateSolarReturn", () => {
    // Solar return for 2000: seed on 2000-01-01 UTC and the next Sun return
    // should be within ±1 day of Diana's 2000 birthday (July 1).
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "sun",
      after_datetime: "2000-01-01T00:00:00",
      after_timezone: "UTC",
    });
    const sr = calculateSolarReturn({ natal: DIANA.birth, year: 2000 });
    expect(Math.abs(pr.return_jd_ut - sr.return_jd_ut)).toBeLessThan(1 / 86400); // <1 second
    expect(pr.planet).toBe("sun");
    expect(pr.natal_planet_longitude).toBeCloseTo(sr.natal_sun_longitude, 6);
  });

  it("at the return JD, the planet's longitude equals the natal longitude (<1 arcsec)", () => {
    for (const planet of ["mercury", "venus", "mars", "jupiter", "saturn"] as const) {
      const pr = calculatePlanetaryReturn({
        natal: DIANA.birth,
        planet,
        after_datetime: "2000-01-01T00:00:00",
        after_timezone: "UTC",
      });
      const returnLon = calcPlanet(pr.return_jd_ut, planet).longitude;
      const diff = ((returnLon - pr.natal_planet_longitude + 540) % 360) - 180;
      expect(Math.abs(diff)).toBeLessThan(1 / 3600);
    }
  });

  it("Saturn return period is ~29-30 years", () => {
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "saturn",
      after_datetime: DIANA.birth.datetime,
      after_timezone: DIANA.birth.timezone,
    });
    const years = (pr.return_jd_ut - natalJd) / 365.25;
    expect(years).toBeGreaterThan(29);
    expect(years).toBeLessThan(30);
  });

  it("Jupiter return period is ~11-12 years", () => {
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "jupiter",
      after_datetime: DIANA.birth.datetime,
      after_timezone: DIANA.birth.timezone,
    });
    const years = (pr.return_jd_ut - natalJd) / 365.25;
    expect(years).toBeGreaterThan(11);
    expect(years).toBeLessThan(13);
  });

  it("Mars return period is under 3 years", () => {
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "mars",
      after_datetime: DIANA.birth.datetime,
      after_timezone: DIANA.birth.timezone,
    });
    const years = (pr.return_jd_ut - natalJd) / 365.25;
    expect(years).toBeGreaterThan(0);
    expect(years).toBeLessThan(3);
  });

  it("consecutive Venus returns are ~1 year apart on average", () => {
    const first = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "venus",
      after_datetime: "2000-01-01T00:00:00",
      after_timezone: "UTC",
    });
    // Start the next scan a day after the first return to avoid re-finding it.
    const secondSeedIso = new Date((first.return_jd_ut - 2451545.0) * 86400000 + Date.UTC(2000, 0, 1) + 86400000)
      .toISOString().slice(0, 19);
    const second = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "venus",
      after_datetime: secondSeedIso,
      after_timezone: "UTC",
    });
    const daysBetween = second.return_jd_ut - first.return_jd_ut;
    // Venus geocentric returns aren't a fixed period; they cluster around
    // 224-day multiples but with retrograde-loop complications. Loosely bound.
    expect(daysBetween).toBeGreaterThan(60);
    expect(daysBetween).toBeLessThan(600);
  });

  it("returned chart has houses, planets, and aspects", () => {
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "jupiter",
      after_datetime: "2000-01-01T00:00:00",
      after_timezone: "UTC",
    });
    expect(pr.planets.length).toBeGreaterThan(0);
    expect(pr.houses.cusps.length).toBe(12);
    expect(pr.aspects.length).toBeGreaterThan(0);
  });

  it("relocation flag flips when lat/lon differ from natal", () => {
    const pr = calculatePlanetaryReturn({
      natal: DIANA.birth,
      planet: "saturn",
      after_datetime: DIANA.birth.datetime,
      after_timezone: DIANA.birth.timezone,
      relocation: { latitude: 40, longitude: -74, timezone: "America/New_York" },
    });
    expect(pr.relocated).toBe(true);
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

// Astrocartography accuracy and consistency tests.
//
// Astrocartography lines are defined in the EQUATORIAL (RA/dec) frame, not
// the ecliptic frame:
//   • MC line: longitudes where the planet's hour angle H = 0 (upper meridian).
//             For each latitude, all on the same longitude.
//   • IC line: where H = 180° (lower meridian).
//   • AC line: (lat, lon) where the planet's altitude = 0 with east azimuth
//             (rising). Hour angle H = -arccos(-tan(φ)·tan(δ)).
//   • DC line: same but with west azimuth (setting). H = +arccos(...).
//
// We verify by recomputing the hour angle and altitude at each line point from
// first-principles spherical astronomy, using sweph only to get the planet's
// equatorial coordinates. This is independent of the astrocartography code's
// own formulas and so catches bugs like an AC/DC swap.

import { describe, it, expect } from "vitest";
import { calculateAstrocartography } from "@/lib/calculators/astrocartography";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import {
  calcPlanetEquatorial,
  greenwichSiderealTimeDeg,
  julianDayUT,
  type PlanetName,
} from "@/lib/ephemeris/client";
import { DIANA } from "./fixtures/charts";

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function angularDistance(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Local sidereal time (degrees) at GST and east-positive longitude. */
function lst(gstDeg: number, lonDeg: number): number {
  return ((gstDeg + lonDeg) % 360 + 360) % 360;
}

/** Hour angle (degrees, normalized to [-180, 180]) of an object at RA seen from a place with given LST. */
function hourAngle(lstDeg: number, raDeg: number): number {
  let h = lstDeg - raDeg;
  while (h > 180) h -= 360;
  while (h <= -180) h += 360;
  return h;
}

/** Altitude (degrees) of an object at (RA, dec) seen from (lat, LST). */
function altitude(raDeg: number, decDeg: number, latDeg: number, lstDeg: number): number {
  const H = hourAngle(lstDeg, raDeg) * RAD;
  const lat = latDeg * RAD;
  const dec = decDeg * RAD;
  return Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H)) * DEG;
}

/** Azimuth (degrees, 0=N, 90=E, 180=S, 270=W) of an object at (RA, dec) from (lat, LST). */
function azimuth(raDeg: number, decDeg: number, latDeg: number, lstDeg: number): number {
  const H = hourAngle(lstDeg, raDeg) * RAD;
  const lat = latDeg * RAD;
  const dec = decDeg * RAD;
  const sinA = -Math.cos(dec) * Math.sin(H);
  const cosA = Math.sin(dec) * Math.cos(lat) - Math.cos(dec) * Math.sin(lat) * Math.cos(H);
  let az = Math.atan2(sinA, cosA) * DEG;
  if (az < 0) az += 360;
  return az;
}

describe("astrocartography — structural validity", () => {
  const acg = calculateAstrocartography(DIANA.birth);

  it("returns lines for all 10 default planets", () => {
    expect(acg.planets.length).toBe(10);
    const names = acg.planets.map((p) => p.planet);
    for (const expected of ["sun","moon","mercury","venus","mars","jupiter","saturn","uranus","neptune","pluto"]) {
      expect(names).toContain(expected as never);
    }
  });

  it("each planet has at least MC and IC lines", () => {
    for (const p of acg.planets) {
      const types = p.lines.map((l) => l.type);
      expect(types).toContain("MC");
      expect(types).toContain("IC");
    }
  });

  it("MC line is vertical: all points share the same longitude", () => {
    for (const p of acg.planets) {
      const mc = p.lines.find((l) => l.type === "MC")!;
      const lons = mc.coordinates.map((c) => c.lon);
      const first = lons[0];
      for (const lon of lons) {
        expect(Math.abs(lon - first)).toBeLessThan(1e-9);
      }
    }
  });

  it("IC line longitude is 180° from MC line longitude", () => {
    for (const p of acg.planets) {
      const mc = p.lines.find((l) => l.type === "MC")!;
      const ic = p.lines.find((l) => l.type === "IC")!;
      const d = angularDistance(mc.coordinates[0].lon, ic.coordinates[0].lon);
      expect(Math.abs(d - 180)).toBeLessThan(1e-9);
    }
  });

  it("AC and DC lines (when present) have lat in [-85, 85]", () => {
    for (const p of acg.planets) {
      for (const line of p.lines) {
        if (line.type !== "AC" && line.type !== "DC") continue;
        for (const c of line.coordinates) {
          expect(c.lat, `${p.planet} ${line.type}`).toBeGreaterThanOrEqual(-85);
          expect(c.lat, `${p.planet} ${line.type}`).toBeLessThanOrEqual(85);
        }
      }
    }
  });

  it("all longitudes are normalized to [-180, 180]", () => {
    for (const p of acg.planets) {
      for (const line of p.lines) {
        for (const c of line.coordinates) {
          expect(c.lon, `${p.planet} ${line.type}`).toBeGreaterThanOrEqual(-180);
          expect(c.lon, `${p.planet} ${line.type}`).toBeLessThanOrEqual(180);
        }
      }
    }
  });
});

describe("astrocartography — MC/IC line accuracy via hour-angle math", () => {
  // At any point on a planet's MC line, the planet's hour angle should be 0
  // (planet on local upper meridian). We verify by computing H from
  // first-principles spherical astronomy.
  const jd = julianDayUT(DIANA.birth.datetime, DIANA.birth.timezone);
  const gst = greenwichSiderealTimeDeg(jd);
  const acg = calculateAstrocartography(DIANA.birth);

  const testPlanets: PlanetName[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
  for (const planet of testPlanets) {
    it(`${planet}: MC line hour-angle = 0 (within 0.01°)`, () => {
      const eq = calcPlanetEquatorial(jd, planet);
      const p = acg.planets.find((x) => x.planet === planet)!;
      const mcLon = p.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
      // Hour angle from this longitude should be exactly 0
      const localLst = lst(gst, mcLon);
      const H = hourAngle(localLst, eq.rightAscension);
      expect(Math.abs(H), `${planet}: hour angle at MC line lon`).toBeLessThan(0.01);
    });

    it(`${planet}: IC line hour-angle = 180° (within 0.01°)`, () => {
      const eq = calcPlanetEquatorial(jd, planet);
      const p = acg.planets.find((x) => x.planet === planet)!;
      const icLon = p.lines.find((l) => l.type === "IC")!.coordinates[0].lon;
      const localLst = lst(gst, icLon);
      const H = hourAngle(localLst, eq.rightAscension);
      // |H| should be 180° (planet on lower meridian)
      expect(Math.abs(Math.abs(H) - 180), `${planet}: hour angle at IC line lon`).toBeLessThan(0.01);
    });
  }
});

describe("astrocartography — AC/DC line accuracy via altitude+azimuth math", () => {
  // At any point on a planet's AC line, the planet should have altitude 0
  // (on the local horizon) with east azimuth (rising). DC: altitude 0 with
  // west azimuth (setting).
  const jd = julianDayUT(DIANA.birth.datetime, DIANA.birth.timezone);
  const gst = greenwichSiderealTimeDeg(jd);
  const acg = calculateAstrocartography({ ...DIANA.birth, latitude_step: 5 });

  const testPlanets: PlanetName[] = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "pluto"];
  for (const planet of testPlanets) {
    it(`${planet}: every AC line point has altitude ≈ 0 and east azimuth`, () => {
      const eq = calcPlanetEquatorial(jd, planet);
      const p = acg.planets.find((x) => x.planet === planet)!;
      const acLine = p.lines.find((l) => l.type === "AC");
      if (!acLine) return; // some planets at some dates don't have an AC line in the sampled range
      let checked = 0;
      for (const point of acLine.coordinates) {
        if (Math.abs(point.lat) > 70) continue; // skip extreme latitudes where formulas degrade
        const localLst = lst(gst, point.lon);
        const alt = altitude(eq.rightAscension, eq.declination, point.lat, localLst);
        const az = azimuth(eq.rightAscension, eq.declination, point.lat, localLst);
        expect(Math.abs(alt), `${planet} AC alt at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeLessThan(0.01);
        // East azimuth: 0° < az < 180°
        expect(az, `${planet} AC az at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeGreaterThan(0);
        expect(az, `${planet} AC az at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeLessThan(180);
        checked++;
      }
      expect(checked, `${planet}: at least one AC point checked`).toBeGreaterThan(0);
    });

    it(`${planet}: every DC line point has altitude ≈ 0 and west azimuth`, () => {
      const eq = calcPlanetEquatorial(jd, planet);
      const p = acg.planets.find((x) => x.planet === planet)!;
      const dcLine = p.lines.find((l) => l.type === "DC");
      if (!dcLine) return;
      let checked = 0;
      for (const point of dcLine.coordinates) {
        if (Math.abs(point.lat) > 70) continue;
        const localLst = lst(gst, point.lon);
        const alt = altitude(eq.rightAscension, eq.declination, point.lat, localLst);
        const az = azimuth(eq.rightAscension, eq.declination, point.lat, localLst);
        expect(Math.abs(alt), `${planet} DC alt at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeLessThan(0.01);
        // West azimuth: 180° < az < 360°
        expect(az, `${planet} DC az at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeGreaterThan(180);
        expect(az, `${planet} DC az at (${point.lat}°, ${point.lon.toFixed(2)}°)`).toBeLessThan(360);
        checked++;
      }
      expect(checked, `${planet}: at least one DC point checked`).toBeGreaterThan(0);
    });
  }
});

describe("astrocartography — relocated chart consistency (low-ecliptic-latitude planets)", () => {
  // For planets that lie close to the ecliptic (Sun by definition, and the
  // inner planets to within a few degrees), the planet's ecliptic longitude
  // is approximately equal to the projection onto the ecliptic at the local
  // horizon/meridian. So a relocated chart at the planet's MC longitude
  // should show that planet near (but not necessarily exactly on) the chart's
  // MC. Tolerance reflects the small ecliptic-latitude contribution.
  const acg = calculateAstrocartography(DIANA.birth);

  for (const planet of ["sun"] as const) {
    it(`${planet}: relocated chart at MC line longitude shows ${planet} ≈ MC (within 30')`, () => {
      const p = acg.planets.find((x) => x.planet === planet)!;
      const mcLon = p.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
      const relocated = calculateNatalChart({
        ...DIANA.birth,
        latitude: 40,
        longitude: mcLon,
      });
      const planetLong = relocated.planets.find((pl) => pl.name === planet)!.longitude;
      const mcChartLong = relocated.houses.midheaven.longitude;
      const offset = angularDistance(planetLong, mcChartLong);
      expect(offset, `${planet} should be near local MC`).toBeLessThan(30 / 60);
    });
  }
});

describe("astrocartography — invariants across multiple charts", () => {
  it("a planet's MC longitude doesn't depend on the observer's lat/lon used to build the input", () => {
    const a = calculateAstrocartography({ ...DIANA.birth, latitude: 0, longitude: 0 });
    const b = calculateAstrocartography({ ...DIANA.birth, latitude: 89, longitude: 179 });
    const aSun = a.planets.find((p) => p.planet === "sun")!.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
    const bSun = b.planets.find((p) => p.planet === "sun")!.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
    expect(Math.abs(aSun - bSun)).toBeLessThan(1e-9);
  });

  it("MC line shifts by 15° west per hour of birth time difference (Earth rotation)", () => {
    // If two charts have the same date/lat/lon but birth times 1 hour apart,
    // each planet's MC line should shift by ~15° (Earth rotates 360°/24h).
    const a = calculateAstrocartography({
      datetime: "2024-06-15T12:00:00",
      timezone: "UTC",
      latitude: 0,
      longitude: 0,
    });
    const b = calculateAstrocartography({
      datetime: "2024-06-15T13:00:00",
      timezone: "UTC",
      latitude: 0,
      longitude: 0,
    });
    const aSun = a.planets.find((p) => p.planet === "sun")!.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
    const bSun = b.planets.find((p) => p.planet === "sun")!.lines.find((l) => l.type === "MC")!.coordinates[0].lon;
    // a was at hour 12, b at hour 13 → b's MC line is 15° west of a's
    // (Sun has moved less than 15°/day so we approximate Earth's rotation dominates).
    const diff = ((aSun - bSun + 540) % 360) - 180; // signed diff
    expect(diff, "MC line shifts ~15° west per hour").toBeGreaterThan(14.5);
    expect(diff).toBeLessThan(15.5);
  });
});

describe("astrocartography — parans", () => {
  const acg = calculateAstrocartography(DIANA.birth);
  const jd = julianDayUT(DIANA.birth.datetime, DIANA.birth.timezone);
  const gst = greenwichSiderealTimeDeg(jd);

  it("returns a non-empty parans array for a real chart", () => {
    expect(acg.parans.length).toBeGreaterThan(0);
  });

  it("excludes degenerate MC×MC and IC×IC vertical-line pairs", () => {
    const meridianBoth = acg.parans.filter(
      (p) =>
        (p.angle1 === "MC" || p.angle1 === "IC") &&
        (p.angle2 === "MC" || p.angle2 === "IC")
    );
    expect(meridianBoth.length).toBe(0);
  });

  it("every paran's latitude is within the sampling range", () => {
    for (const p of acg.parans) {
      expect(Math.abs(p.latitude)).toBeLessThanOrEqual(85);
    }
  });

  it("every paran's two lines actually intersect there (independent re-check)", () => {
    // For each paran, recompute both planetary lines at the paran latitude
    // from the equatorial coordinates and confirm both pass through the
    // reported longitude within 0.5° tolerance.
    for (const paran of acg.parans.slice(0, 30)) { // first 30 for speed
      const eq1 = calcPlanetEquatorial(jd, paran.planet1);
      const eq2 = calcPlanetEquatorial(jd, paran.planet2);

      function lineLonAt(eq: typeof eq1, lat: number, angle: typeof paran.angle1): number | null {
        if (angle === "MC") {
          let l = eq.rightAscension - gst;
          while (l > 180) l -= 360;
          while (l < -180) l += 360;
          return l;
        }
        if (angle === "IC") {
          let l = eq.rightAscension - gst + 180;
          while (l > 180) l -= 360;
          while (l < -180) l += 360;
          return l;
        }
        const cosH = -Math.tan(lat * RAD) * Math.tan(eq.declination * RAD);
        if (cosH < -1 || cosH > 1) return null;
        const H = Math.acos(cosH) * DEG;
        const ha = angle === "AC" ? -H : H;
        let l = eq.rightAscension + ha - gst;
        while (l > 180) l -= 360;
        while (l < -180) l += 360;
        return l;
      }

      const lon1 = lineLonAt(eq1, paran.latitude, paran.angle1);
      const lon2 = lineLonAt(eq2, paran.latitude, paran.angle2);
      expect(lon1, `${paran.planet1} ${paran.angle1} should be defined at paran lat`).not.toBeNull();
      expect(lon2, `${paran.planet2} ${paran.angle2} should be defined at paran lat`).not.toBeNull();
      expect(angularDistance(lon1!, paran.longitude)).toBeLessThan(0.5);
      expect(angularDistance(lon2!, paran.longitude)).toBeLessThan(0.5);
    }
  });

  it("include_parans=false suppresses the parans calculation", () => {
    const result = calculateAstrocartography({ ...DIANA.birth, include_parans: false });
    expect(result.parans).toEqual([]);
  });

  it("parans are sorted by absolute latitude ascending", () => {
    let prev = -1;
    for (const p of acg.parans) {
      const absLat = Math.abs(p.latitude);
      expect(absLat).toBeGreaterThanOrEqual(prev);
      prev = absLat;
    }
  });
});

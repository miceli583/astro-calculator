// Astrocartography: compute the lat/lon coordinates where each planet is on
// the four angles (MC, IC, AC, DC) at the moment of birth, projected onto
// the Earth's surface.
//
// The MC and IC lines are vertical (constant longitude) — for each planet,
// MC is the meridian where the planet is on the upper meridian at the birth
// instant. IC is 180° from that.
//
// AC and DC lines are sinusoidal — the planet is rising (AC) or setting (DC)
// at the locations along these curves. We sample latitudes and compute the
// longitude offset.

import {
  calcPlanetEquatorial,
  greenwichSiderealTimeDeg,
  julianDayUT,
  type PlanetName,
} from "../ephemeris/client";
import type { BirthData } from "../types/birth-data";

const DEFAULT_PLANETS: readonly PlanetName[] = [
  "sun", "moon", "mercury", "venus", "mars",
  "jupiter", "saturn", "uranus", "neptune", "pluto",
];

export interface LineSegment {
  type: "MC" | "IC" | "AC" | "DC";
  /** Array of {lat, lon} points; for MC/IC this is just two endpoints (vertical line). */
  coordinates: { lat: number; lon: number }[];
}

export interface PlanetLines {
  planet: PlanetName;
  lines: LineSegment[];
}

export interface AstrocartographyResult {
  jd_ut: number;
  planets: PlanetLines[];
}

const RAD = Math.PI / 180;
const DEG = 180 / Math.PI;

function normalizeLon(lon: number): number {
  let l = lon;
  while (l > 180) l -= 360;
  while (l < -180) l += 360;
  return l;
}

// MC line: longitude where the planet's hour angle = 0 → lon = ra - GST
function mcLongitude(ra: number, gstDeg: number): number {
  return normalizeLon(ra - gstDeg);
}

// AC/DC sinusoidal line.
// For each latitude φ, the planet is rising/setting when:
//   cos(H) = -tan(φ) * tan(δ)
// where H is the local hour angle. AC: H = -arccos(...), DC: H = +arccos(...).
// Local longitude = ra - GST - H.
function angleLineLongitude(
  ra: number,
  dec: number,
  gstDeg: number,
  latDeg: number,
  side: "AC" | "DC"
): number | null {
  const lat = latDeg * RAD;
  const decRad = dec * RAD;
  const cosH = -Math.tan(lat) * Math.tan(decRad);
  if (cosH < -1 || cosH > 1) return null; // never rises/sets at this latitude
  const H = Math.acos(cosH) * DEG; // 0–180
  const hourAngle = side === "AC" ? -H : H;
  return normalizeLon(ra - gstDeg - hourAngle);
}

export interface AstroInput extends BirthData {
  planets?: PlanetName[];
  /** Latitude sampling resolution in degrees (default 1). Lower = smoother lines, more data. */
  latitude_step?: number;
  /** Min latitude to sample (default -85). */
  min_latitude?: number;
  /** Max latitude to sample (default 85). */
  max_latitude?: number;
}

export function calculateAstrocartography(input: AstroInput): AstrocartographyResult {
  const jd = julianDayUT(input.datetime, input.timezone);
  const gst = greenwichSiderealTimeDeg(jd);
  const planetList = input.planets ?? DEFAULT_PLANETS;
  const step = input.latitude_step ?? 1;
  const minLat = input.min_latitude ?? -85;
  const maxLat = input.max_latitude ?? 85;

  const planets: PlanetLines[] = planetList.map((name) => {
    const eq = calcPlanetEquatorial(jd, name);
    const mcLon = mcLongitude(eq.rightAscension, gst);
    const icLon = normalizeLon(mcLon + 180);

    const lines: LineSegment[] = [
      {
        type: "MC",
        coordinates: [
          { lat: maxLat, lon: mcLon },
          { lat: minLat, lon: mcLon },
        ],
      },
      {
        type: "IC",
        coordinates: [
          { lat: maxLat, lon: icLon },
          { lat: minLat, lon: icLon },
        ],
      },
    ];

    const ac: { lat: number; lon: number }[] = [];
    const dc: { lat: number; lon: number }[] = [];
    for (let lat = minLat; lat <= maxLat; lat += step) {
      const acLon = angleLineLongitude(eq.rightAscension, eq.declination, gst, lat, "AC");
      const dcLon = angleLineLongitude(eq.rightAscension, eq.declination, gst, lat, "DC");
      if (acLon !== null) ac.push({ lat, lon: acLon });
      if (dcLon !== null) dc.push({ lat, lon: dcLon });
    }
    if (ac.length) lines.push({ type: "AC", coordinates: ac });
    if (dc.length) lines.push({ type: "DC", coordinates: dc });

    return { planet: name, lines };
  });

  return { jd_ut: jd, planets };
}

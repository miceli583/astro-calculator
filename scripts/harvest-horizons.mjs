#!/usr/bin/env node
// Harvest JPL Horizons positions into in-repo fixtures for the L1 accuracy tier.
//
//   npm run accuracy:harvest            # only charts with no fixture yet
//   npm run accuracy:harvest -- --force # re-fetch everything
//   npm run accuracy:harvest -- --only nyc-gap-2005
//
// THIS SCRIPT IS NOT RUN BY CI, AND MUST NEVER BE. It is a one-time (and
// thereafter rarely repeated) harvest. `tests/ephemeris-horizons.test.ts` reads
// only the frozen JSON it writes, so the test suite has no network dependency.
//
// ---------------------------------------------------------------------------
// Horizons API notes, all established empirically (2026-08). Read before editing.
// ---------------------------------------------------------------------------
//  * Parameter values need LITERAL single quotes in the query string. The
//    curl `--data-urlencode` form does not work.
//  * `OBJ_DATA='NO'` returns HTTP 500 for every body. Omit it entirely.
//  * EPHEM_TYPE='OBSERVER' with QUANTITIES='31' (ecliptic lon/lat of date)
//    returns the object header and NO $$SOE block for COMMAND 10 (Sun),
//    199, 299, 301 (Moon) and 399 — reproducibly, not transiently. It works
//    for 499 and outward, and for 2060 (Chiron). That is why the of-date
//    comparison covers Mars..Pluto + Chiron only; see docs/accuracy.md §3.2.
//  * EPHEM_TYPE='VECTORS' works for every body, so the all-body comparison
//    runs in the J2000 frame off state vectors.
//  * VECTORS epochs are TDB. OBSERVER epochs default to UT, but accept
//    TIME_TYPE='TT'. We query BOTH at sweph's own JD(TT), so the ΔT model
//    cancels out of the comparison and what is left is purely the ephemeris
//    and the frame rotation. ΔT is checked separately, in the L0 tier.

import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import swe from "sweph";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "tests/fixtures/horizons");
const API = "https://ssd.jpl.nasa.gov/api/horizons.api";

swe.set_ephe_path(join(ROOT, "ephemeris"));

// --------------------------------------------------------------------------
// The charts. Every one of these is here because something about it is
// hostile: a hemisphere, a latitude, an epoch, or a clock that does not
// behave. Ordinary well-behaved birth data is already covered by the existing
// reference fixtures, and adding more of it would buy nothing.
// --------------------------------------------------------------------------
const CHARTS = [
  // --- southern hemisphere ---
  { id: "mandela-1918-mvezo", why: "southern hemisphere, pre-1970, established reference chart",
    datetime: "1918-07-18T14:00:00", timezone: "Africa/Johannesburg", latitude: -31.9, longitude: 28.65 },
  { id: "sydney-1985-southern-dst", why: "southern hemisphere with DST in JANUARY — reversed seasonal sense",
    datetime: "1985-01-15T09:20:00", timezone: "Australia/Sydney", latitude: -33.8688, longitude: 151.2093 },
  { id: "ushuaia-1980-subpolar-south", why: "sub-polar southern latitude (54.8 S)",
    datetime: "1980-07-01T04:05:00", timezone: "America/Argentina/Ushuaia", latitude: -54.8019, longitude: -68.303 },
  { id: "santiago-1974-southern-transition", why: "southern-hemisphere DST edge, day of transition",
    datetime: "1974-10-01T23:30:00", timezone: "America/Santiago", latitude: -33.4489, longitude: -70.6693 },

  // --- high latitude (house systems degenerate; positions do not) ---
  { id: "tromso-1975-arctic", why: "69.65 N — above the Arctic Circle, quadrant houses degenerate",
    datetime: "1975-06-21T12:00:00", timezone: "Europe/Oslo", latitude: 69.6492, longitude: 18.9553 },
  { id: "longyearbyen-1990-polar-night", why: "78.22 N at the winter solstice — the extreme case",
    datetime: "1990-12-21T00:30:00", timezone: "Europe/Oslo", latitude: 78.2232, longitude: 15.6469 },
  { id: "reykjavik-1962-subarctic", why: "64.15 N, zone with no DST and a non-integer historical offset",
    datetime: "1962-11-08T18:45:00", timezone: "Atlantic/Reykjavik", latitude: 64.1466, longitude: -21.9426 },

  // --- deep time ---
  { id: "paris-1750-pre-gregorian-clocks", why: "1750 — long before standard time; proleptic-Gregorian JD, large ΔT",
    datetime: "1750-03-14T06:00:00", timezone: "Europe/Paris", latitude: 48.8566, longitude: 2.3522 },
  { id: "boston-1799-lmt", why: "pre-1800, Local Mean Time offset carrying seconds",
    datetime: "1799-12-14T22:15:00", timezone: "America/New_York", latitude: 42.3601, longitude: -71.0589 },
  { id: "nyc-1883-standard-time-eve", why: "1883-11-17, the last day of New York LMT (−04:56:02)",
    datetime: "1883-11-17T12:00:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  { id: "vienna-1899-turn-of-century", why: "pre-1900, integer-offset standard time already in force",
    datetime: "1899-06-30T03:33:00", timezone: "Europe/Vienna", latitude: 48.2082, longitude: 16.3738 },
  { id: "london-1950-postwar", why: "pre-1970 with British Summer Time active",
    datetime: "1950-08-04T16:20:00", timezone: "Europe/London", latitude: 51.5074, longitude: -0.1278 },

  // --- clocks that misbehave ---
  { id: "nyc-2005-gap-inside", why: "birth INSIDE the skipped hour (spring forward) — resolves as kind=gap",
    datetime: "2005-04-03T02:30:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  { id: "nyc-2005-gap-minus-1min", why: "one minute before the same gap — must NOT shift",
    datetime: "2005-04-03T01:59:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  { id: "nyc-2005-ambiguous", why: "fall-back hour, occurs twice — resolves to the FIRST occurrence",
    datetime: "2005-10-30T01:30:00", timezone: "America/New_York", latitude: 40.7128, longitude: -74.006 },
  { id: "lisbon-1992-transition-day", why: "DST edge in a zone that changed its base offset that decade",
    datetime: "1992-09-27T01:30:00", timezone: "Europe/Lisbon", latitude: 38.7223, longitude: -9.1393 },

  // --- fractional-hour zones ---
  { id: "kolkata-1972-half-hour", why: "+05:30 half-hour zone",
    datetime: "1972-08-15T05:30:00", timezone: "Asia/Kolkata", latitude: 22.5726, longitude: 88.3639 },
  { id: "kathmandu-1984-45min", why: "+05:45 — a 45-minute offset, and after Nepal's 1986 shift this zone changes",
    datetime: "1984-04-13T10:15:00", timezone: "Asia/Kathmandu", latitude: 27.7172, longitude: 85.324 },
  { id: "chatham-2000-1245-dst", why: "+13:45 — the largest offset in the database, DST active",
    datetime: "2000-01-15T07:07:00", timezone: "Pacific/Chatham", latitude: -43.9539, longitude: -176.5595 },
  { id: "kiritimati-1999-antimeridian", why: "+14:00 across the antimeridian; local date leads UTC by a day",
    datetime: "1999-12-31T23:59:00", timezone: "Pacific/Kiritimati", latitude: 1.8721, longitude: -157.4278 },
];

// Horizons body ids. `sweId` is the sweph planet number.
const BODIES = [
  { key: "sun", command: "10", sweId: 0 },
  { key: "moon", command: "301", sweId: 1 },
  { key: "mercury", command: "199", sweId: 2 },
  { key: "venus", command: "299", sweId: 3 },
  { key: "mars", command: "499", sweId: 4 },
  { key: "jupiter", command: "599", sweId: 5 },
  { key: "saturn", command: "699", sweId: 6 },
  { key: "uranus", command: "799", sweId: 7 },
  { key: "neptune", command: "899", sweId: 8 },
  { key: "pluto", command: "999", sweId: 9 },
  { key: "chiron", command: "2060", sweId: 15 },
];

/** Bodies for which Horizons will serve QUANTITIES='31' (ecliptic of date). */
const OFDATE_BODIES = BODIES.filter((b) => Number(b.command) >= 499);

// --------------------------------------------------------------------------
// Time resolution.
//
// This duplicates src/lib/ephemeris/julian-day.ts on purpose: the harvest must
// not depend on the TypeScript build, and the fixture records the resolved UTC
// so that ephemeris-horizons.test.ts can re-derive it with the REAL
// implementation and assert the two agree. If this copy ever drifts, the test
// fails — which is the point.
// --------------------------------------------------------------------------
const DAY_MS = 86_400_000;
const fmtCache = new Map();

function fmt(tz) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    fmtCache.set(tz, f);
  }
  return f;
}

function wallClockMsAtInstant(utcMs, tz) {
  const p = {};
  for (const part of fmt(tz).formatToParts(new Date(utcMs))) {
    if (part.type !== "literal") p[part.type] = Number(part.value);
  }
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
}

const offsetAtInstant = (utcMs, tz) => (wallClockMsAtInstant(utcMs, tz) - utcMs) / 60_000;

function resolve(datetime, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(datetime);
  if (!m) throw new Error(`bad datetime ${datetime}`);
  const [, Y, Mo, D, H, Mi, S] = m.map(Number);
  const wall = Date.UTC(Y, Mo - 1, D, H, Mi, S);

  const before = offsetAtInstant(wall - DAY_MS, tz);
  const after = offsetAtInstant(wall + DAY_MS, tz);
  let offsetMinutes = before;
  let kind = "unique";
  if (before !== after) {
    const okBefore = wallClockMsAtInstant(wall - before * 60_000, tz) === wall;
    const okAfter = wallClockMsAtInstant(wall - after * 60_000, tz) === wall;
    if (okBefore && okAfter) kind = "ambiguous";
    else if (okBefore) kind = "unique";
    else if (okAfter) { offsetMinutes = after; kind = "unique"; }
    else kind = "gap";
  }

  const d = new Date(wall - offsetMinutes * 60_000);
  const utc = {
    year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate(),
    hour: d.getUTCHours(), minute: d.getUTCMinutes(),
    second: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
  };
  const jd = swe.utc_to_jd(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second, 1);
  if (jd.flag < 0) throw new Error(`utc_to_jd failed: ${jd.error}`);
  return { offsetMinutes, kind, utc, jdTT: jd.data[0], jdUT: jd.data[1] };
}

// --------------------------------------------------------------------------
// Horizons requests
// --------------------------------------------------------------------------
const qs = (o) => Object.entries(o).map(([k, v]) => `${k}=${encodeURIComponent(`'${v}'`)}`).join("&");

async function horizons(params) {
  const url = `${API}?format=text&${qs(params)}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch(url);
    const body = await res.text();
    if (res.ok && body.includes("$$SOE")) {
      return body.slice(body.indexOf("$$SOE") + 6, body.indexOf("$$EOE")).trim().split("\n");
    }
    if (attempt === 4) {
      const first = body.split("\n").slice(0, 3).join(" | ");
      throw new Error(`Horizons ${res.status} after ${attempt} tries [${first}] :: ${url}`);
    }
    await new Promise((r) => setTimeout(r, 1500 * attempt));
  }
}

const COMMON = {
  CENTER: "500@399",
  REF_PLANE: "ECLIPTIC",
  REF_SYSTEM: "ICRF",
  OUT_UNITS: "AU-D",
  CSV_FORMAT: "YES",
};

/** J2000 mean-ecliptic apparent position (light-time + stellar aberration). */
async function vectorPosition(command, jdTT) {
  const rows = await horizons({
    ...COMMON,
    COMMAND: command,
    EPHEM_TYPE: "VECTORS",
    VEC_CORR: "LT+S",
    VEC_TABLE: "1",
    VEC_LABELS: "NO",
    START_TIME: `JD${jdTT.toFixed(9)}`,
    STOP_TIME: `JD${(jdTT + 0.5).toFixed(9)}`,
    STEP_SIZE: "12h",
  });
  const c = rows[0].split(",").map((s) => s.trim());
  const [x, y, z] = [Number(c[2]), Number(c[3]), Number(c[4])];
  const deg = (r) => ((r * 180) / Math.PI + 360) % 360;
  return {
    lon: deg(Math.atan2(y, x)),
    lat: (Math.atan2(z, Math.hypot(x, y)) * 180) / Math.PI,
    distanceAu: Math.hypot(x, y, z),
  };
}

/** Apparent ecliptic longitude/latitude referred to the TRUE equinox of date. */
async function ofDatePosition(command, jdTT) {
  const rows = await horizons({
    CENTER: "500@399",
    COMMAND: command,
    EPHEM_TYPE: "OBSERVER",
    QUANTITIES: "31",
    CSV_FORMAT: "YES",
    ANG_FORMAT: "DEG",
    TIME_TYPE: "TT",
    START_TIME: `JD${jdTT.toFixed(9)}`,
    STOP_TIME: `JD${(jdTT + 0.5).toFixed(9)}`,
    STEP_SIZE: "12h",
  });
  const c = rows[0].split(",").map((s) => s.trim());
  return { lon: Number(c[3]), lat: Number(c[4]) };
}

/**
 * Osculating ascending node of the geocentric lunar orbit, J2000 ecliptic.
 * Horizons has no "lunar node" body — this is the only place the node exists
 * as an observable-derived quantity rather than a convention. See docs/accuracy.md §4.
 */
async function lunarOsculatingNode(jdTT) {
  const rows = await horizons({
    ...COMMON,
    COMMAND: "301",
    EPHEM_TYPE: "ELEMENTS",
    START_TIME: `JD${jdTT.toFixed(9)}`,
    STOP_TIME: `JD${(jdTT + 0.5).toFixed(9)}`,
    STEP_SIZE: "12h",
  });
  // JDTDB, Calendar Date, EC, QR, IN, OM, ...
  return Number(rows[0].split(",")[5].trim());
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------
const args = process.argv.slice(2);
const force = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const only = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

mkdirSync(OUT_DIR, { recursive: true });

const harvestedAt = new Date().toISOString().slice(0, 10);
let written = 0;
let skipped = 0;

for (const chart of CHARTS) {
  if (only && chart.id !== only) continue;
  const path = join(OUT_DIR, `${chart.id}.json`);
  if (!force && existsSync(path)) {
    skipped++;
    continue;
  }

  const t = resolve(chart.datetime, chart.timezone);
  process.stdout.write(`${chart.id.padEnd(34)} JD(TT) ${t.jdTT.toFixed(6)} `);

  const j2000 = {};
  const notes = [];
  for (const b of BODIES) {
    try {
      j2000[b.key] = await vectorPosition(b.command, t.jdTT);
    } catch (err) {
      notes.push(`j2000/${b.key}: ${err.message.split("::")[0].trim()}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  const ofDate = {};
  for (const b of OFDATE_BODIES) {
    try {
      ofDate[b.key] = await ofDatePosition(b.command, t.jdTT);
    } catch (err) {
      notes.push(`ofdate/${b.key}: ${err.message.split("::")[0].trim()}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  let node = null;
  try {
    node = await lunarOsculatingNode(t.jdTT);
  } catch (err) {
    notes.push(`node: ${err.message.split("::")[0].trim()}`);
  }

  const fixture = {
    id: chart.id,
    why: chart.why,
    input: {
      datetime: chart.datetime,
      timezone: chart.timezone,
      latitude: chart.latitude,
      longitude: chart.longitude,
    },
    resolved: { offsetMinutes: t.offsetMinutes, kind: t.kind, utc: t.utc },
    jd: { tt: t.jdTT, ut: t.jdUT },
    source: {
      api: API,
      harvestedAt,
      center: "500@399 (geocentric)",
      j2000: "EPHEM_TYPE=VECTORS, REF_PLANE=ECLIPTIC, REF_SYSTEM=ICRF, VEC_CORR=LT+S, epoch=JD(TT) as TDB",
      ofDate: "EPHEM_TYPE=OBSERVER, QUANTITIES=31 (ObsEcLon/ObsEcLat, true ecliptic and equinox of date), TIME_TYPE=TT",
      node: "EPHEM_TYPE=ELEMENTS, OM = osculating ascending node, J2000 ecliptic",
    },
    j2000Ecliptic: j2000,
    ofDateApparent: ofDate,
    moonOsculatingNodeJ2000: node,
    ...(notes.length ? { notes } : {}),
  };

  writeFileSync(path, `${JSON.stringify(fixture, null, 2)}\n`);
  written++;
  console.log(`→ ${Object.keys(j2000).length} j2000, ${Object.keys(ofDate).length} of-date${notes.length ? `, ${notes.length} gaps` : ""}`);
}

const index = CHARTS.map((c) => {
  const p = join(OUT_DIR, `${c.id}.json`);
  return { id: c.id, why: c.why, present: existsSync(p) };
});
writeFileSync(join(OUT_DIR, "index.json"), `${JSON.stringify({ harvestedAt, charts: index }, null, 2)}\n`);

console.log(`\n${written} harvested, ${skipped} already present (use --force to refetch).`);
if (skipped && !written) {
  const sample = JSON.parse(readFileSync(join(OUT_DIR, "index.json"), "utf8"));
  console.log(`index lists ${sample.charts.length} charts.`);
}

#!/usr/bin/env node
// Print sweph-vs-Horizons residuals for every frozen fixture, in arcseconds.
//
//   npm run accuracy:residuals            # per-body summary
//   npm run accuracy:residuals -- --full  # every chart, every body
//
// This is a REPORTING tool, not a gate. The gate is tests/ephemeris-horizons.test.ts,
// whose tolerances are set from documented model differences (docs/accuracy.md §5)
// rather than from this output. Reading residuals to pick a tolerance that passes
// is exactly the thing that makes an accuracy suite worthless.

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import swe from "sweph";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
swe.set_ephe_path(join(ROOT, "ephemeris"));

const DIR = join(ROOT, "tests/fixtures/horizons");
const SWE_ID = {
  sun: 0, moon: 1, mercury: 2, venus: 3, mars: 4, jupiter: 5,
  saturn: 6, uranus: 7, neptune: 8, pluto: 9, chiron: 15,
};
// NOGDEFL (512) is required on the J2000 comparison and is not optional: Horizons'
// VECTORS/'LT+S' correction excludes relativistic light deflection by the Sun,
// which sweph applies by default. Without it the comparison mixes two physical
// models and a body in solar conjunction shows a spurious ~1.5" residual. The
// of-date comparison keeps deflection ON, because Horizons' OBSERVER tables
// include it. Same flags as tests/ephemeris-horizons.test.ts, deliberately — a
// report that disagrees with the gate is worse than no report.
const J2000 = 2 | 256 | 32 | 512; // SWIEPH | SPEED | J2000 | NOGDEFL
const OFDATE = 2 | 256; // SWIEPH | SPEED  → true equinox of date, deflection on
const NONUT = 2 | 256 | 64; // + NONUT     → mean equinox of date
const SEFLG_MOSEPH = 4;

const arcsec = (deg) => (((deg + 540) % 360) - 180) * 3600;
const full = process.argv.includes("--full");

/** Ascending node of the geocentric lunar orbit from sweph's own r × v. */
function oscNodeFromSweph(jdTt) {
  const m = swe.calc(jdTt, SWE_ID.moon, J2000).data;
  const rad = Math.PI / 180;
  const [l, b, r, dl, db, dr] = [m[0] * rad, m[1] * rad, m[2], m[3] * rad, m[4] * rad, m[5]];
  const cb = Math.cos(b), sb = Math.sin(b), cl = Math.cos(l), sl = Math.sin(l);
  const x = r * cb * cl, y = r * cb * sl, z = r * sb;
  const vx = dr * cb * cl - r * db * sb * cl - r * dl * cb * sl;
  const vy = dr * cb * sl - r * db * sb * sl + r * dl * cb * cl;
  const vz = dr * sb + r * db * cb;
  return ((Math.atan2(y * vz - z * vy, -(z * vx - x * vz)) * 180) / Math.PI % 360 + 360) % 360;
}

const files = readdirSync(DIR).filter((f) => f.endsWith(".json") && f !== "index.json").sort();
const stats = new Map();

function record(bucket, key, dLon, dLat, chartId) {
  const k = `${bucket}/${key}`;
  const s = stats.get(k) ?? { n: 0, maxLon: 0, maxLat: 0, worst: "" };
  s.n++;
  if (Math.abs(dLon) > Math.abs(s.maxLon)) { s.maxLon = dLon; s.worst = chartId; }
  if (Math.abs(dLat) > Math.abs(s.maxLat)) s.maxLat = dLat;
  stats.set(k, s);
}

for (const f of files) {
  const fx = JSON.parse(readFileSync(join(DIR, f), "utf8"));
  // Which ephemeris actually answered. Below 1800 this deployment has no data
  // file and sweph substitutes Moshier — a different ephemeris, so those rows
  // are a different comparison and are labelled as such.
  const probe = swe.calc(fx.jd.tt, SWE_ID.sun, J2000);
  const moshier = probe.flag >= 0 && (probe.flag & SEFLG_MOSEPH) !== 0;
  const era = moshier ? "MOSHIER" : "swieph";
  if (full) console.log(`\n=== ${fx.id}  (${fx.input.datetime} ${fx.input.timezone})  [${era}]`);

  for (const [key, ref] of Object.entries(fx.j2000Ecliptic ?? {})) {
    const p = swe.calc(fx.jd.tt, SWE_ID[key], J2000);
    if (p.flag < 0) { console.log(`  !! ${key}: ${p.error}`); continue; }
    const dLon = arcsec(p.data[0] - ref.lon);
    const dLat = (p.data[1] - ref.lat) * 3600;
    record(moshier ? "j2000-mosh" : "j2000", key, dLon, dLat, fx.id);
    if (full) console.log(`  j2000   ${key.padEnd(8)} dLon ${dLon.toFixed(4).padStart(11)}"  dLat ${dLat.toFixed(4).padStart(11)}"`);
  }

  for (const [key, ref] of Object.entries(fx.ofDateApparent ?? {})) {
    const p = swe.calc(fx.jd.tt, SWE_ID[key], OFDATE);
    if (p.flag < 0) { console.log(`  !! ${key}: ${p.error}`); continue; }
    const dLon = arcsec(p.data[0] - ref.lon);
    const dLat = (p.data[1] - ref.lat) * 3600;
    record(moshier ? "ofdate-mosh" : "ofdate", key, dLon, dLat, fx.id);
    if (full) console.log(`  ofdate  ${key.padEnd(8)} dLon ${dLon.toFixed(4).padStart(11)}"  dLat ${dLat.toFixed(4).padStart(11)}"`);
  }

  if (fx.moonOsculatingNodeJ2000 != null) {
    // The real ephemeris check: the node direction is r × v, free of GM and of
    // any element convention, so this tests the lunar VELOCITY — the only thing
    // in the tier that does.
    const dOsc = arcsec(oscNodeFromSweph(fx.jd.tt) - fx.moonOsculatingNodeJ2000);
    record("node", "osculating", dOsc, 0, fx.id);

    // SE_TRUE_NODE is a different quantity, not a worse one. Reported against
    // the osculating node to track the convention's envelope; Horizons is NOT
    // its oracle. See docs/accuracy.md §4.
    const p = swe.calc(fx.jd.tt, 11, J2000);
    const dSe = arcsec(p.data[0] - fx.moonOsculatingNodeJ2000);
    record("node", "SE_TRUE_NODE", dSe, 0, fx.id);
    if (full) {
      console.log(`  node    osc      dLon ${dOsc.toFixed(4).padStart(11)}"  (sweph r×v vs Horizons OM)`);
      console.log(`  node    se_true  dLon ${dSe.toFixed(4).padStart(11)}"  (convention offset, not an error)`);
    }
  }

  // Mean node has no Horizons counterpart — compare to Meeus (1998) ch. 47,
  // which is referred to the MEAN equinox of date, hence the NONUT flag.
  {
    const T = (fx.jd.tt - 2451545) / 36525;
    const meeus =
      ((125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000) % 360 + 360) % 360;
    const p = swe.calc(fx.jd.tt, 10, NONUT);
    const d = arcsec(p.data[0] - meeus);
    record("node", "mean_node", d, 0, fx.id);
    if (full) console.log(`  node    mean     dLon ${d.toFixed(4).padStart(11)}"  (vs Meeus ch.47)`);
  }
}

console.log(`\n${files.length} charts. Worst |residual| per body, arcseconds:\n`);
console.log(`${"comparison".padEnd(22)}${"n".padStart(4)}${"max dLon".padStart(12)}${"max dLat".padStart(12)}   worst chart`);
for (const [k, s] of stats) {
  console.log(
    k.padEnd(22) + String(s.n).padStart(4) +
    s.maxLon.toFixed(4).padStart(12) + s.maxLat.toFixed(4).padStart(12) +
    `   ${s.worst}`
  );
}

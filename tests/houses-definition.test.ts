// L2 — chart construction, checked against the DEFINITION of each house system.
//
// The oracle here is not another astrology program. It is the defining
// geometric property of each system, asserted directly against the cusps this
// calculator returns: "this point has traversed a third of its own semi-diurnal
// arc", "this point lies on the great circle through that equator division and
// the north point of the horizon". A second implementation transcribed from a
// formula table can be transcribed wrongly, and then its disagreement is
// indistinguishable from a real defect. A definition cannot.
//
// Conventions are pinned in docs/chart-conventions.md and that document is
// normative: if the code disagrees with it, the finding goes in §7 and the
// document is NOT amended to describe the bug. Read §4 before touching a
// tolerance here.
//
// Charts: the same twenty hostile fixtures L1 uses (southern hemisphere, polar,
// pre-1800, DST edges, fractional zones). Only their input and frozen JD are
// used — no Horizons data enters this tier.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import swe from "sweph";
import {
  calcHouses,
  obliquity,
  HOUSE_SYSTEMS,
  type HouseSystem,
  type HousesResult,
} from "@/lib/ephemeris/client";
import { calculateNatalChart } from "@/lib/calculators/astrology";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/horizons");

interface Fixture {
  id: string;
  why: string;
  input: { datetime: string; timezone: string; latitude: number; longitude: number };
  jd: { tt: number; ut: number };
}

const FIXTURES: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .sort()
  .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")) as Fixture);

const SYSTEMS = Object.keys(HOUSE_SYSTEMS) as HouseSystem[];

// ---------------------------------------------------------------------------
// Tolerances. Each carries the reason it has the value it has.
// ---------------------------------------------------------------------------

interface Tolerance {
  arcsec: number;
  why: string;
}

/**
 * Closed-form constructions — the angles, equal, whole-sign, Porphyry,
 * Regiomontanus, Campanus, Koch. Both sides evaluate algebraically equivalent
 * expressions in IEEE double precision, so the ONLY admissible difference is
 * floating-point round-off, amplified by whatever cancellation the geometry
 * introduces near a degenerate configuration. A double carries ~2e-16 relative
 * precision; one milliarcsecond is ~5e-9 radians, which leaves six orders of
 * magnitude for that amplification and still cannot hide a definitional
 * disagreement, the smallest of which (a different sidereal-time convention)
 * is 16 arcseconds.
 */
const TOL_CLOSED_FORM: Tolerance = {
  arcsec: 1e-3,
  why: "closed form on both sides; only IEEE double round-off is admissible",
};

/**
 * Placidus is not closed form. Swiss Ephemeris solves it by iteration, so its
 * cusps carry that iteration's convergence floor (order 1e-7 degrees). One
 * hundredth of an arcsecond sits far above that floor and far below anything
 * astronomically or astrologically meaningful — cusps are quoted to the
 * arcminute at best. A failure at this level is a change in the definition or
 * the solver, not numerical noise.
 */
const TOL_PLACIDUS: Tolerance = {
  arcsec: 0.01,
  why: "iterative solver; bound set above its convergence floor, below any meaningful quantity",
};

/**
 * The seam: an independent sidereal time and obliquity computed from Meeus
 * (1998) ch. 12 and ch. 22, compared against what Swiss Ephemeris uses.
 *
 * Two model differences are expected and neither is an error:
 *   1. Meeus's GMST (12.4) is the IAU 1982 series built on IAU 1976 precession;
 *      Swiss Ephemeris uses IAU 2006. The two diverge in right ascension at
 *      roughly 3 mas/yr, so ~0.8" at the 1750 end of this fixture set.
 *   2. Meeus's abbreviated nutation series (ch. 22) is stated good to 0.5" in
 *      Δψ, which enters sidereal time as Δψ·cos ε ≈ 0.46".
 * Worst case ~1.3". The bound's job is to catch a MODEL mistake — mean instead
 * of apparent sidereal time (16"), a west-positive longitude (2×longitude), an
 * hours/degrees confusion (15×) — not to certify a fit.
 */
const TOL_SEAM_ARMC: Tolerance = {
  arcsec: 2.0,
  why: "IAU 1976 vs IAU 2006 precession in RA (~0.8\" at 1750) + truncated nutation (0.46\")",
};

/**
 * Obliquity: Meeus 22.2 is the IAU 1976/Laskar expression, Swiss Ephemeris uses
 * IAU 2006. The constants differ by 0.042" at J2000 — the same difference that
 * sets the residual floor in L1 (docs/accuracy.md §5.1.1) — growing to ~0.05"
 * at the ends of this epoch span. Meeus's abbreviated Δε adds ~0.04".
 */
const TOL_SEAM_EPS: Tolerance = {
  arcsec: 0.2,
  why: "IAU 1976 vs IAU 2006 obliquity constant (0.042\") + truncated Δε (0.04\")",
};

function fail(fx: Fixture, what: string, got: number, tol: Tolerance): string {
  return (
    `${fx.id} (${fx.input.datetime} ${fx.input.timezone}, ` +
    `lat ${fx.input.latitude}, lon ${fx.input.longitude})\n` +
    `  ${what}: ${got.toExponential(4)}" vs bound ${tol.arcsec}"\n` +
    `  bound reason: ${tol.why}\n` +
    `  This is a construction finding. Read docs/chart-conventions.md §4 and ` +
    `escalate — do NOT widen the constant.`
  );
}

// ---------------------------------------------------------------------------
// Spherical geometry. Equatorial Cartesian frame, right-handed:
//   x̂ → the point where the local meridian meets the celestial equator (H = 0)
//   ŷ → east                      ẑ → north celestial pole
// Hour angle H increases westward, hence the minus sign on y.
// ---------------------------------------------------------------------------

const D = Math.PI / 180;
const R = 180 / Math.PI;
const n360 = (x: number) => ((x % 360) + 360) % 360;
const n180 = (x: number) => ((x + 540) % 360) - 180;
type Vec = [number, number, number];

const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const det = (a: Vec, b: Vec, c: Vec) =>
  a[0] * (b[1] * c[2] - b[2] * c[1]) -
  a[1] * (b[0] * c[2] - b[2] * c[0]) +
  a[2] * (b[0] * c[1] - b[1] * c[0]);

const vecOf = (H: number, dec: number): Vec => [
  Math.cos(dec * D) * Math.cos(H * D),
  -Math.cos(dec * D) * Math.sin(H * D),
  Math.sin(dec * D),
];

/** Zenith, north point of the horizon, east point — all in the frame above. */
const zenith = (phi: number): Vec => [Math.cos(phi * D), 0, Math.sin(phi * D)];
const northPoint = (phi: number): Vec => [-Math.sin(phi * D), 0, Math.cos(phi * D)];
const EAST_POINT: Vec = [0, 1, 0];

/** An ecliptic longitude (latitude 0) as an equatorial direction plus its hour angle. */
function pointOf(lambda: number, eps: number, armc: number) {
  const ra = n360(Math.atan2(Math.sin(lambda * D) * Math.cos(eps * D), Math.cos(lambda * D)) * R);
  const dec = Math.asin(Math.sin(eps * D) * Math.sin(lambda * D)) * R;
  const H = n180(armc - ra);
  return { ra, dec, H, v: vecOf(H, dec) };
}

/** Semi-diurnal arc in degrees, or null when the point is circumpolar. */
function semiDiurnalArc(phi: number, dec: number): number | null {
  const c = -Math.tan(phi * D) * Math.tan(dec * D);
  return Math.abs(c) > 1 ? null : Math.acos(c) * R;
}

/** The ascendant for a given ARMC, latitude and obliquity — used only by Koch. */
const ascFor = (armc: number, phi: number, eps: number) =>
  n360(
    Math.atan2(
      Math.cos(armc * D),
      -(Math.sin(armc * D) * Math.cos(eps * D) + Math.tan(phi * D) * Math.sin(eps * D))
    ) * R
  );

// ---------------------------------------------------------------------------
// Independent sidereal time and obliquity — Meeus (1998), transcribed here and
// nowhere else in the codebase, so it can disagree with the implementation.
// ---------------------------------------------------------------------------

/** Mean obliquity of the ecliptic, Meeus (22.3), valid over ±10 000 years. */
function meeusMeanObliquity(jd: number): number {
  const U = (jd - 2451545) / 3652500;
  return (
    23 + 26 / 60 + 21.448 / 3600 -
    (4680.93 * U + 1.55 * U ** 2 - 1999.25 * U ** 3 - 51.38 * U ** 4 + 249.67 * U ** 5 +
      39.05 * U ** 6 - 7.12 * U ** 7 + 27.87 * U ** 8 + 5.79 * U ** 9 + 2.45 * U ** 10) / 3600
  );
}

/** Nutation in longitude and obliquity, Meeus ch. 22 abbreviated series. */
function meeusNutation(jd: number): { dpsi: number; deps: number } {
  const T = (jd - 2451545) / 36525;
  const Om = (125.04452 - 1934.136261 * T + 0.0020708 * T * T + T ** 3 / 450000) * D;
  const L = (280.4665 + 36000.7698 * T) * D;
  const Lp = (218.3165 + 481267.8813 * T) * D;
  return {
    dpsi: (-17.2 * Math.sin(Om) - 1.32 * Math.sin(2 * L) - 0.23 * Math.sin(2 * Lp) + 0.21 * Math.sin(2 * Om)) / 3600,
    deps: (9.2 * Math.cos(Om) + 0.57 * Math.cos(2 * L) + 0.1 * Math.cos(2 * Lp) - 0.09 * Math.cos(2 * Om)) / 3600,
  };
}

/** Greenwich mean sidereal time in degrees, Meeus (12.4). */
function meeusGmst(jd: number): number {
  const T = (jd - 2451545) / 36525;
  return n360(280.46061837 + 360.98564736629 * (jd - 2451545) + 0.000387933 * T * T - T ** 3 / 38710000);
}

/** ARMC and true obliquity from Meeus alone. `lonEast` is east-positive. */
function meeusArmcAndEps(jd: number, lonEast: number): { armc: number; eps: number; eqEquinoxes: number } {
  const { dpsi, deps } = meeusNutation(jd);
  const eps = meeusMeanObliquity(jd) + deps;
  const eqEquinoxes = dpsi * Math.cos(eps * D);
  return { armc: n360(meeusGmst(jd) + eqEquinoxes + lonEast), eps, eqEquinoxes };
}

// ---------------------------------------------------------------------------

/** Everything the geometry tests need, computed once per chart. */
function chartOf(fx: Fixture, system: HouseSystem = "placidus") {
  const { latitude: phi, longitude: lon } = fx.input;
  const h: HousesResult = calcHouses(fx.jd.ut, phi, lon, system);
  return { phi, lon, jd: fx.jd.ut, h, eps: obliquity(fx.jd.ut) };
}

/**
 * Swiss Ephemeris refuses Placidus and Koch inside the polar circles by
 * returning flag < 0 (and Porphyry cusps). `calcHouses` drops that flag — see
 * docs/chart-conventions.md F5 — so the raw call is the only way to ask.
 */
function quadrantSystemsUndefined(fx: Fixture): boolean {
  return swe.houses_ex(fx.jd.ut, 0, fx.input.latitude, fx.input.longitude, "P").flag < 0;
}

const DEFINED = FIXTURES.filter((fx) => !quadrantSystemsUndefined(fx));
const DEGENERATE = FIXTURES.filter(quadrantSystemsUndefined);

// ===========================================================================

describe("L2 fixtures — the charts the tier depends on", () => {
  it("uses the L1 fixture set", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(20);
  });

  it("contains charts where the quadrant systems are defined AND where they are not", () => {
    // Every degeneracy assertion below is vacuous without both groups, and the
    // Placidus/Koch definition tests are vacuous without the first.
    expect(DEFINED.length, "no chart where Placidus is defined").toBeGreaterThanOrEqual(15);
    expect(DEGENERATE.length, "no polar chart — the §6 assertions would be vacuous").toBeGreaterThanOrEqual(2);
  });
});

describe("L2 seam — sidereal time and obliquity from an independent implementation", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id}: ARMC and ε agree with Meeus`, () => {
      const { phi, lon, jd, h, eps } = chartOf(fx);
      expect(phi).toBeTypeOf("number");
      const mine = meeusArmcAndEps(jd, lon);

      const dArmc = n180(mine.armc - h.armc) * 3600;
      expect(Math.abs(dArmc), fail(fx, "ARMC vs Meeus ch.12", dArmc, TOL_SEAM_ARMC))
        .toBeLessThan(TOL_SEAM_ARMC.arcsec);

      const dEps = (mine.eps - eps) * 3600;
      expect(Math.abs(dEps), fail(fx, "true obliquity vs Meeus ch.22", dEps, TOL_SEAM_EPS))
        .toBeLessThan(TOL_SEAM_EPS.arcsec);
    });
  }

  it("the seam distinguishes apparent from mean sidereal time", () => {
    // docs/chart-conventions.md §2 states that the ARMC is built on APPARENT
    // sidereal time. That claim is only worth anything if the seam could see
    // the difference: the equation of the equinoxes is the whole of it.
    const eq = FIXTURES.map((fx) => Math.abs(meeusArmcAndEps(fx.jd.ut, fx.input.longitude).eqEquinoxes) * 3600);
    const discriminating = eq.filter((v) => v > TOL_SEAM_ARMC.arcsec * 2).length;
    expect(
      discriminating,
      `equation of the equinoxes exceeds twice the ARMC bound on only ${discriminating} charts; ` +
        `the "apparent sidereal time" convention would not be tested`
    ).toBeGreaterThanOrEqual(FIXTURES.length / 2);
    expect(Math.max(...eq)).toBeGreaterThan(10);
  });

  it("the seam distinguishes east-positive from west-positive longitude", () => {
    // §2 fixes longitude as east-positive. A consumer passing the other sign
    // gets a chart for the wrong hemisphere; this asserts the seam would catch
    // that convention being flipped inside the implementation.
    const offenders = FIXTURES.filter((fx) => {
      const flipped = meeusArmcAndEps(fx.jd.ut, -fx.input.longitude).armc;
      const { h } = chartOf(fx);
      return Math.abs(n180(flipped - h.armc) * 3600) > TOL_SEAM_ARMC.arcsec;
    });
    expect(offenders.length, "a longitude sign flip would pass the seam").toBe(FIXTURES.length);
  });
});

describe("L2 — the angles are what their definitions say", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id}: ASC on the horizon rising, MC on the meridian, Vertex on the prime vertical`, () => {
      const { phi, h, eps } = chartOf(fx);
      const Z = zenith(phi);
      const N = northPoint(phi);

      // ASC: altitude zero, and east of the meridian (it is rising, not setting).
      const asc = pointOf(h.ascendant, eps, h.armc);
      const altAsc = Math.asin(dot(asc.v, Z)) * R * 3600;
      expect(Math.abs(altAsc), fail(fx, "ASC altitude above the horizon", altAsc, TOL_CLOSED_FORM))
        .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      expect(asc.H, `${fx.id}: ASC is west of the meridian — that is the descendant`).toBeLessThan(0);

      // MC: on the meridian, upper culmination.
      const mc = pointOf(h.midheaven, eps, h.armc);
      expect(Math.abs(mc.H * 3600), fail(fx, "MC hour angle", mc.H * 3600, TOL_CLOSED_FORM))
        .toBeLessThan(TOL_CLOSED_FORM.arcsec);

      // Vertex: on the prime vertical, whose pole is the north point.
      const vx = pointOf(h.vertex, eps, h.armc);
      const offPv = Math.asin(dot(vx.v, N)) * R * 3600;
      expect(Math.abs(offPv), fail(fx, "Vertex off the prime vertical", offPv, TOL_CLOSED_FORM))
        .toBeLessThan(TOL_CLOSED_FORM.arcsec);

      // Equatorial ascendant: the ascendant for latitude 0, i.e. hour angle −90°.
      const ep = pointOf(h.equatorialAscendant, eps, h.armc);
      const dEp = n180(ep.H + 90) * 3600;
      expect(Math.abs(dEp), fail(fx, "equatorial ascendant hour angle + 90°", dEp, TOL_CLOSED_FORM))
        .toBeLessThan(TOL_CLOSED_FORM.arcsec);
    });
  }

  it("the Vertex is the WESTERN intersection with the prime vertical", () => {
    // §3 says western. On the prime vertical the east half is the +ŷ side.
    for (const fx of FIXTURES) {
      const { h, eps } = chartOf(fx);
      const vx = pointOf(h.vertex, eps, h.armc);
      expect(vx.v[1], `${fx.id}: Vertex is on the eastern half of the prime vertical`).toBeLessThan(0);
    }
  });

  for (const fx of FIXTURES) {
    it(`${fx.id}: the angles do not depend on the house system`, () => {
      const base = chartOf(fx, "placidus").h;
      for (const system of SYSTEMS) {
        const h = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, system);
        for (const key of ["ascendant", "midheaven", "armc", "vertex", "equatorialAscendant"] as const) {
          const d = n180(h[key] - base[key]) * 3600;
          expect(Math.abs(d), fail(fx, `${key} differs under ${system}`, d, TOL_CLOSED_FORM))
            .toBeLessThan(TOL_CLOSED_FORM.arcsec);
        }
      }
    });
  }
});

describe("L2 — the arithmetic systems are exact", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id}: equal houses are ASC + 30k`, () => {
      const { h } = chartOf(fx, "equal");
      for (let i = 0; i < 12; i++) {
        const d = n180(h.cusps[i] - (h.ascendant + 30 * i)) * 3600;
        expect(Math.abs(d), fail(fx, `equal cusp ${i + 1}`, d, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    });

    it(`${fx.id}: whole-sign houses start at the ASC's sign`, () => {
      const { h } = chartOf(fx, "whole_sign");
      const first = Math.floor(n360(h.ascendant) / 30) * 30;
      for (let i = 0; i < 12; i++) {
        const d = n180(h.cusps[i] - (first + 30 * i)) * 3600;
        expect(Math.abs(d), fail(fx, `whole-sign cusp ${i + 1}`, d, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
      expect(h.cusps[0] % 30, `${fx.id}: whole-sign cusp 1 is not a sign boundary`).toBe(0);
    });

    it(`${fx.id}: Porphyry trisects the ecliptic quadrants`, () => {
      const { h } = chartOf(fx, "porphyrius");
      const upper = n360(h.ascendant - h.midheaven); // MC → ASC, houses 11 and 12
      const lower = n360(n360(h.midheaven + 180) - h.ascendant); // ASC → IC, houses 2 and 3
      const expected: [number, number][] = [
        [11, h.midheaven + upper / 3],
        [12, h.midheaven + (2 * upper) / 3],
        [2, h.ascendant + lower / 3],
        [3, h.ascendant + (2 * lower) / 3],
      ];
      for (const [cusp, want] of expected) {
        const d = n180(h.cusps[cusp - 1] - want) * 3600;
        expect(Math.abs(d), fail(fx, `Porphyry cusp ${cusp}`, d, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    });
  }
});

describe("L2 — Placidus cusps trisect their own semi-arcs", () => {
  // The definition (§4): cusp 11 has completed 1/3 of its semi-diurnal arc
  // before culminating, cusp 12 has 2/3 to go, and 2 and 3 trisect the
  // semi-nocturnal arc below the horizon. Hour angles are measured westward
  // from the upper meridian, so the above-horizon cusps are negative.
  const targetHourAngle: Record<number, (sd: number) => number> = {
    11: (sd) => -sd / 3,
    12: (sd) => (-2 * sd) / 3,
    2: (sd) => -(sd + (180 - sd) / 3),
    3: (sd) => -(sd + (2 * (180 - sd)) / 3),
  };

  for (const fx of DEFINED) {
    it(`${fx.id}: cusps 11, 12, 2, 3 sit at their trisection points`, () => {
      const { phi, h, eps } = chartOf(fx, "placidus");
      let checked = 0;
      for (const cusp of [11, 12, 2, 3]) {
        const p = pointOf(h.cusps[cusp - 1], eps, h.armc);
        const sd = semiDiurnalArc(phi, p.dec);
        if (sd === null) continue; // circumpolar: the definition itself has no value here
        checked++;
        const d = n180(p.H - targetHourAngle[cusp](sd)) * 3600;
        expect(Math.abs(d), fail(fx, `Placidus cusp ${cusp} hour angle`, d, TOL_PLACIDUS))
          .toBeLessThan(TOL_PLACIDUS.arcsec);
      }
      expect(checked, `${fx.id}: every Placidus cusp was circumpolar — nothing was tested`).toBeGreaterThan(0);
    });
  }

  it("cusps 5, 6, 8, 9 are the exact opposites, so the four above cover all eight", () => {
    for (const fx of DEFINED) {
      const { h } = chartOf(fx, "placidus");
      for (const [a, b] of [[11, 5], [12, 6], [2, 8], [3, 9]]) {
        const d = n180(h.cusps[b - 1] - (h.cusps[a - 1] + 180)) * 3600;
        expect(Math.abs(d), `${fx.id}: Placidus cusp ${b} is not opposite cusp ${a}`)
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    }
  });
});

describe("L2 — Regiomontanus and Campanus cusps lie on their house circles", () => {
  // Both systems project twelve equal divisions onto the ecliptic along great
  // circles through the north and south points of the horizon. A cusp P lies on
  // the circle carrying division Q exactly when P, Q and the north point N are
  // coplanar through the centre — det[P, Q, N] = 0. Nothing about the cusp
  // formula enters this; only the construction does.
  //
  // Regiomontanus divides the celestial equator from the ARMC; Campanus divides
  // the prime vertical from the east point. Both constructions are self-checking
  // at the angles: the circle through N, S and the east point IS the horizon
  // (so cusp 1 = ASC), and the circle through N, S and the zenith IS the
  // meridian (so cusp 10 = MC).
  for (const fx of FIXTURES) {
    it(`${fx.id}: all twelve Regiomontanus cusps are coplanar with their equator division`, () => {
      const { phi, h, eps } = chartOf(fx, "regiomontanus");
      const N = northPoint(phi);
      for (let k = 1; k <= 12; k++) {
        const Q = vecOf(n360((10 - k) * 30), 0);
        const off = Math.asin(det(pointOf(h.cusps[k - 1], eps, h.armc).v, Q, N)) * R * 3600;
        expect(Math.abs(off), fail(fx, `Regiomontanus cusp ${k} off its house circle`, off, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    });

    it(`${fx.id}: all twelve Campanus cusps are coplanar with their prime-vertical division`, () => {
      const { phi, h, eps } = chartOf(fx, "campanus");
      const N = northPoint(phi);
      const Z = zenith(phi);
      for (let k = 1; k <= 12; k++) {
        const t = n360((1 - k) * 30) * D;
        const Q: Vec = [
          Math.cos(t) * EAST_POINT[0] + Math.sin(t) * Z[0],
          Math.cos(t) * EAST_POINT[1] + Math.sin(t) * Z[1],
          Math.cos(t) * EAST_POINT[2] + Math.sin(t) * Z[2],
        ];
        const off = Math.asin(det(pointOf(h.cusps[k - 1], eps, h.armc).v, Q, N)) * R * 3600;
        expect(Math.abs(off), fail(fx, `Campanus cusp ${k} off its house circle`, off, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    });
  }
});

describe("L2 — Koch cusps are the ascendants across the MC's semi-diurnal arc", () => {
  // NOTE ON EPISTEMIC STATUS. Placidus, Regiomontanus and Campanus are asserted
  // against constructions stated in purely geometric terms, which cannot be
  // transcribed wrongly without becoming obviously false. Koch is different:
  // the construction below is the published verbal definition ("the cusps are
  // the ascendants at the moments when the MC degree had traversed a third and
  // two thirds of its own semi-diurnal arc"), turned into a formula by me. It
  // reproduces the implementation exactly, which is a CONSISTENCY result
  // between two readings of the same definition — not an independent
  // verification of Koch the way the other three are. Recorded as such in
  // docs/chart-conventions.md §8.
  for (const fx of DEFINED) {
    it(`${fx.id}: cusps 11, 12, 2, 3 are ascendants at ARMC ∓ SD_mc/3`, () => {
      const { phi, h, eps } = chartOf(fx, "koch");
      const mc = pointOf(h.midheaven, eps, h.armc);
      const sd = semiDiurnalArc(phi, mc.dec);
      if (sd === null) {
        expect.fail(`${fx.id}: the MC degree is circumpolar but Swiss Ephemeris accepted Koch`);
        return;
      }
      const expected: [number, number][] = [
        [11, ascFor(n360(h.armc - (2 * sd) / 3), phi, eps)],
        [12, ascFor(n360(h.armc - sd / 3), phi, eps)],
        [2, ascFor(n360(h.armc + sd / 3), phi, eps)],
        [3, ascFor(n360(h.armc + (2 * sd) / 3), phi, eps)],
      ];
      for (const [cusp, want] of expected) {
        const d = n180(h.cusps[cusp - 1] - want) * 3600;
        expect(Math.abs(d), fail(fx, `Koch cusp ${cusp}`, d, TOL_CLOSED_FORM))
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    });
  }
});

describe("L2 — wheel invariants that hold in every system", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id}: opposite cusps are exactly 180° apart in all seven systems`, () => {
      for (const system of SYSTEMS) {
        const { cusps } = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, system);
        expect(cusps.length, `${system} returned ${cusps.length} cusps, not 12`).toBe(12);
        for (let i = 0; i < 6; i++) {
          const d = n180(cusps[i + 6] - (cusps[i] + 180)) * 3600;
          expect(Math.abs(d), fail(fx, `${system}: cusp ${i + 7} vs cusp ${i + 1} + 180°`, d, TOL_CLOSED_FORM))
            .toBeLessThan(TOL_CLOSED_FORM.arcsec);
        }
      }
    });
  }

  it("cusp 1 is the ASC in every system except whole-sign", () => {
    for (const fx of FIXTURES) {
      for (const system of SYSTEMS) {
        const { cusps, ascendant } = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, system);
        if (system === "whole_sign") {
          // §4: whole-sign is the one system where cusp 1 is a sign boundary
          // rather than the ascendant itself.
          expect(cusps[0] % 30, `${fx.id}: whole-sign cusp 1 off a sign boundary`).toBe(0);
          continue;
        }
        expect(Math.abs(n180(cusps[0] - ascendant) * 3600), `${fx.id}/${system}: cusp 1 ≠ ASC`)
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    }
  });

  // CORRECTED PREMISE. This was first written as "cusp 10 is the MC in every
  // system except whole-sign", which is false and was caught by the very first
  // fixture. Only the systems constructed from BOTH angles put a cusp on the
  // MC. Equal houses are generated from the ascendant alone, so the MC floats:
  // it lands wherever the meridian happens to cut the ecliptic, anywhere from
  // the 9th to the 11th house. That is a property of equal houses, not a
  // defect, and docs/chart-conventions.md §4 now says so.
  const MC_ON_CUSP_10: HouseSystem[] = ["placidus", "koch", "porphyrius", "regiomontanus", "campanus"];

  it("cusp 10 is the MC in the systems built from both angles", () => {
    for (const fx of FIXTURES) {
      for (const system of MC_ON_CUSP_10) {
        const { cusps, midheaven } = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, system);
        expect(Math.abs(n180(cusps[9] - midheaven) * 3600), `${fx.id}/${system}: cusp 10 ≠ MC`)
          .toBeLessThan(TOL_CLOSED_FORM.arcsec);
      }
    }
  });

  it("equal houses genuinely do NOT put the MC on cusp 10", () => {
    // Non-vacuousness for the split above: if equal houses happened to agree
    // with the MC anyway, excluding them would be an untested exception.
    const differing = FIXTURES.filter((fx) => {
      const { cusps, midheaven } = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, "equal");
      return Math.abs(n180(cusps[9] - midheaven)) > 1;
    });
    expect(
      differing.length,
      "equal-house cusp 10 coincides with the MC on every chart, so the exception above is untested"
    ).toBeGreaterThan(FIXTURES.length / 2);
  });
});

describe("L2 — house membership follows the documented rule", () => {
  // §5: a body is in house k iff its longitude lies in [cusp_k, cusp_{k+1})
  // traversed forward in zodiacal order. Checked through the real calculator,
  // not a reimplementation of the rule.
  //
  // Pre-1800 charts USED to be excluded here: F1 made calculateNatalChart throw
  // on sweph's Moshier-fallback warning, so they could not be built at all. That
  // exclusion was asserted rather than commented, which is what forced it to be
  // removed when F1 was fixed. House membership is a geometric property and has
  // nothing to do with which ephemeris supplied the longitudes, so these charts
  // belong in the membership test on exactly the same terms as every other one.
  const JD_1800 = 2378496.5;
  const BUILDABLE = DEFINED;
  const PRE_1800 = FIXTURES.filter((fx) => fx.jd.ut < JD_1800);

  it("pre-1800 charts build and are covered by the membership test below", () => {
    expect(PRE_1800.length, "no pre-1800 fixture, so this claim is untested").toBeGreaterThan(0);
    const covered = new Set(BUILDABLE.map((fx) => fx.id));
    for (const fx of PRE_1800) {
      const chart = calculateNatalChart({ ...fx.input, house_system: "placidus" });
      expect(chart.houses.cusps).toHaveLength(12);
      // Non-vacuity: being buildable is worth little if the fixture is not
      // actually one of the charts the membership test iterates.
      if (DEFINED.some((d) => d.id === fx.id)) {
        expect(covered.has(fx.id), `${fx.id} builds but is not in the membership set`).toBe(true);
      }
    }
  });

  for (const fx of BUILDABLE) {
    it(`${fx.id}: every body's reported house contains its longitude`, () => {
      const chart = calculateNatalChart({ ...fx.input, house_system: "placidus" });
      const cusps = chart.houses.cusps.map((c) => c.longitude);
      for (const p of chart.planets) {
        const k = p.house;
        const start = cusps[k - 1];
        const width = n360(cusps[k % 12] - start);
        const into = n360(p.longitude - start);
        expect(
          into < width || Math.abs(into - width) < 1e-9,
          `${fx.id}: ${p.name} at ${p.longitude.toFixed(4)}° reported in house ${k}, ` +
            `which spans ${start.toFixed(4)}° → ${n360(start + width).toFixed(4)}°`
        ).toBe(true);
      }
    });
  }
});

describe("L2 degeneracy — the polar boundary, asserted rather than avoided", () => {
  // docs/chart-conventions.md §6. A house system being undefined at a latitude
  // is a documented limitation, not a failing test — but the BOUNDARY and the
  // FALLBACK are behaviour, and behaviour that is not asserted moves silently.

  it("Placidus and Koch are refused inside the polar circles", () => {
    for (const fx of DEGENERATE) {
      for (const code of ["P", "K"]) {
        const r = swe.houses_ex(fx.jd.ut, 0, fx.input.latitude, fx.input.longitude, code);
        expect(r.flag, `${fx.id} (lat ${fx.input.latitude}): ${code} was accepted`).toBeLessThan(0);
      }
    }
    expect(DEGENERATE.every((fx) => Math.abs(fx.input.latitude) > 66), "a refusal below 66°").toBe(true);
  });

  it("Placidus and Koch are accepted everywhere outside them", () => {
    for (const fx of DEFINED) {
      for (const code of ["P", "K"]) {
        const r = swe.houses_ex(fx.jd.ut, 0, fx.input.latitude, fx.input.longitude, code);
        expect(r.flag, `${fx.id} (lat ${fx.input.latitude}): ${code} was refused`).toBe(0);
      }
      expect(Math.abs(fx.input.latitude), `${fx.id} is inside the polar circle yet accepted`).toBeLessThan(66.5);
    }
  });

  // ---- Characterization tests: these assert DEFECTS, not desired behaviour. --
  // F5 and F6 in docs/chart-conventions.md. When either is dispositioned, the
  // corresponding test must be rewritten — it is here so that a fix is a
  // deliberate act rather than a silent change in what the API returns.

  it("F5: a polar Placidus request returns Porphyry cusps under the Placidus name", () => {
    for (const fx of DEGENERATE) {
      const placidus = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, "placidus");
      const porphyry = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, "porphyrius");
      for (let i = 0; i < 12; i++) {
        expect(
          Math.abs(n180(placidus.cusps[i] - porphyry.cusps[i])),
          `${fx.id}: cusp ${i + 1} is not the Porphyry substitute — F5 may be fixed; update this test`
        ).toBeLessThan(1e-9);
      }
    }
  });

  // CORRECTED PREMISE. F6 was first written as "Regiomontanus and Campanus
  // return a reversed wheel at polar latitudes", asserted against the polar
  // fixtures. It failed: at the moments those two charts actually record, both
  // wheels are perfectly ordered. The defect is real but it is not a property
  // of latitude alone — it depends on sidereal time, and it is a COLLAPSE
  // rather than a reversal. Measured by sweeping ARMC through a full sidereal
  // day (docs/chart-conventions.md §6.2):
  //
  //   latitude   fraction of the sidereal day with a broken wheel
  //   64.1°      0 / 360        (below the polar circle: never)
  //   66.6°      8 / 360
  //   69.65°    62 / 360
  //   78.22°   122 / 360
  //   89°      176 / 360        (approaching half the day at the pole)
  //
  // Inside those windows the ecliptic lies nearly in the plane of the horizon,
  // every house circle cuts it in almost the same place, and ten of the twelve
  // cusps collapse onto two points 180° apart. Swiss Ephemeris returns flag = 0
  // throughout — it does not consider this an error, and it is right not to:
  // the cusps remain geometrically exact. What breaks is downstream.
  //
  // A chart chosen to sit inside the window, since no fixture does:
  const COLLAPSED = {
    datetime: "1990-01-15T06:15:00",
    timezone: "Europe/Oslo",
    latitude: 78.2232,
    longitude: 15.6469,
  } as const;

  it("F6: the collapsed cusps are still geometrically exact — sweph is not wrong", () => {
    const chart = calculateNatalChart({ ...COLLAPSED, house_system: "regiomontanus" });
    const cusps = chart.houses.cusps.map((c) => c.longitude);
    const near = cusps.filter((c) => Math.abs(n180(c - cusps[0])) < 2).length;
    expect(near, "the wheel is no longer collapsed — F6 may be fixed; update this test")
      .toBeGreaterThanOrEqual(6);

    // The same coplanarity test the ordered charts pass, applied here.
    const h = calcHouses(
      chart.jd_ut, COLLAPSED.latitude, COLLAPSED.longitude, "regiomontanus"
    );
    const N = northPoint(COLLAPSED.latitude);
    const eps = obliquity(chart.jd_ut);
    for (let k = 1; k <= 12; k++) {
      const off = Math.asin(det(pointOf(h.cusps[k - 1], eps, h.armc).v, vecOf(n360((10 - k) * 30), 0), N)) * R * 3600;
      expect(Math.abs(off), `collapsed Regiomontanus cusp ${k} is off its house circle by ${off}"`)
        .toBeLessThan(TOL_CLOSED_FORM.arcsec);
    }
  });

  it("F6: the collapse puts every body in house 1, which is the actual defect", () => {
    // §5's half-open [cusp_k, cusp_{k+1}) rule assumes the cusps run forward.
    // Collapsed, house 1 spans −0.03°; read forward that is 359.97°, so it
    // swallows the whole zodiac and houses 2–12 are unreachable. The API does
    // warn about polar degeneracy, but "may be unreliable" understates a chart
    // in which every body is in the first house.
    const chart = calculateNatalChart({ ...COLLAPSED, house_system: "regiomontanus" });
    const houses = new Set(chart.planets.map((p) => p.house));
    expect(
      [...houses],
      "bodies are no longer all in house 1 — F6 may be fixed; update this test"
    ).toEqual([1]);

    // And the assignment is demonstrably wrong, not merely suspicious: bodies
    // sit inside the one genuinely wide house, which is not house 1.
    const cusps = chart.houses.cusps.map((c) => c.longitude);
    const widest = cusps.reduce(
      (best, _, i) => (n360(cusps[(i + 1) % 12] - cusps[i]) > best.w
        ? { h: i + 1, w: n360(cusps[(i + 1) % 12] - cusps[i]) } : best),
      { h: 0, w: 0 }
    );
    expect(widest.w, "no house spans a large arc, so the mis-assignment claim is untested")
      .toBeGreaterThan(150);
    const misplaced = chart.planets.filter(
      (p) => n360(p.longitude - cusps[widest.h - 1]) < widest.w && p.house !== widest.h
    );
    expect(misplaced.length, "no body is mis-assigned").toBeGreaterThan(0);
  });

  it("F6: below the polar circle the wheel is ordered at EVERY sidereal time", () => {
    // The other half of the finding, and the reason it is not a general defect:
    // outside the polar circle no sidereal time produces a collapse, so
    // ordinary charts are unaffected. Swept, not sampled — a fixture set of
    // twenty instants could easily miss a window that is only 8/360 wide at the
    // boundary. Sweeping longitude at fixed JD sweeps ARMC through a full turn.
    const JD = 2447892.5;
    for (const lat of [0, 33.9, -33.9, 51.5, -55.05, 64.1, 66.0, -66.0]) {
      for (const system of ["regiomontanus", "campanus"] as const) {
        for (let lon = -180; lon < 180; lon += 1) {
          const { cusps } = calcHouses(JD, lat, lon, system);
          const backwards = cusps.filter((c, i) => n360(cusps[(i + 1) % 12] - c) > 180).length;
          expect(backwards, `lat ${lat}, lon ${lon}, ${system}: sub-polar wheel is broken`).toBe(0);
        }
      }
    }
  });

  it("F6: the collapse window widens monotonically with latitude", () => {
    // The structure of the finding, asserted so it cannot drift unnoticed. A
    // flat bound would pass just as well if the window vanished or swallowed
    // the whole day; monotonicity in latitude is the claim actually being made.
    const JD = 2447892.5;
    const windowAt = (lat: number) => {
      let broken = 0;
      for (let lon = -180; lon < 180; lon += 1) {
        const { cusps } = calcHouses(JD, lat, lon, "regiomontanus");
        if (cusps.some((c, i) => n360(cusps[(i + 1) % 12] - c) > 180)) broken++;
      }
      return broken;
    };
    const measured = [66.0, 66.6, 69.65, 78.22, 85, 89].map(windowAt);
    expect(measured[0], "a collapse below the polar circle").toBe(0);
    for (let i = 1; i < measured.length; i++) {
      expect(measured[i], `window shrank between step ${i - 1} and ${i}: ${measured.join(", ")}`)
        .toBeGreaterThan(measured[i - 1]);
    }
    expect(measured[measured.length - 1], "the window never approaches half the sidereal day")
      .toBeGreaterThan(150);
  });

  it("F6: equal and whole-sign stay ordered at every latitude, which is why §6.3 recommends them", () => {
    for (const fx of FIXTURES) {
      for (const system of ["equal", "whole_sign"] as const) {
        const { cusps } = calcHouses(fx.jd.ut, fx.input.latitude, fx.input.longitude, system);
        for (let i = 0; i < 12; i++) {
          const gap = n360(cusps[(i + 1) % 12] - cusps[i]);
          expect(Math.abs(gap - 30), `${fx.id}/${system}: house ${i + 1} spans ${gap.toFixed(3)}°`)
            .toBeLessThan(1e-6);
        }
      }
    }
  });
});

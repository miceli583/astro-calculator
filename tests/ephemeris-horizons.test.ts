// L1 — ephemeris accuracy against JPL Horizons.
//
// Every number compared here comes from a frozen fixture in
// tests/fixtures/horizons/. This suite NEVER touches the network; re-harvesting
// is a deliberate, manual act (`npm run accuracy:harvest -- --force`).
//
// Each tolerance carries the reason it has the value it has. Read
// docs/accuracy.md §5 before changing any of them: a tolerance chosen to make a
// test pass proves nothing, and a disagreement larger than the documented model
// spread is a finding to escalate, not a constant to widen.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import swe from "sweph";
import { parseLocalISO, toUTCResolved } from "@/lib/ephemeris/julian-day";

const FIXTURE_DIR = join(process.cwd(), "tests/fixtures/horizons");
const EPHE_DIR = join(process.cwd(), "ephemeris");

// Point sweph at the same data directory the API uses. Set explicitly rather
// than inherited, because WHICH data files are visible determines whether sweph
// answers from the Swiss Ephemeris or silently falls back to Moshier — and this
// suite asserts that distinction.
swe.set_ephe_path(EPHE_DIR);

interface Position {
  lon: number;
  lat: number;
  distanceAu?: number;
}

interface Fixture {
  id: string;
  why: string;
  input: { datetime: string; timezone: string; latitude: number; longitude: number };
  resolved: {
    offsetMinutes: number;
    kind: "unique" | "gap" | "ambiguous";
    utc: { year: number; month: number; day: number; hour: number; minute: number; second: number };
  };
  jd: { tt: number; ut: number };
  j2000Ecliptic: Record<string, Position>;
  ofDateApparent: Record<string, Position>;
  moonOsculatingNodeJ2000: number | null;
  notes?: string[];
}

const FIXTURES: Fixture[] = readdirSync(FIXTURE_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .sort()
  .map((f) => JSON.parse(readFileSync(join(FIXTURE_DIR, f), "utf8")) as Fixture);

const SWE_ID: Record<string, number> = {
  sun: 0, moon: 1, mercury: 2, venus: 3, mars: 4, jupiter: 5,
  saturn: 6, uranus: 7, neptune: 8, pluto: 9, chiron: 15,
};

const SEFLG_SWIEPH = 2;
const SEFLG_J2000 = 32;
const SEFLG_MOSEPH = 4;
const SEFLG_SPEED = 256;
const SEFLG_NOGDEFL = 512;

/**
 * J2000 comparison flags.
 *
 * SEFLG_NOGDEFL is REQUIRED here and is not a convenience. Horizons'
 * `VEC_CORR='LT+S'` applies light-time and stellar aberration but NOT
 * relativistic light deflection by the Sun; sweph applies deflection by
 * default. Leaving it on compares two different physical models. The term is
 * ~0.004″ at large elongation — invisible — but grows as 1/elongation and
 * reaches 1.5″ for a body in solar conjunction, which this fixture set
 * contains (Jupiter at 0.27° from the Sun, sydney-1985). The deflection term
 * itself is not thereby untested: it is verified positively against Horizons'
 * OBSERVER tables, which DO include it — see "relativistic light deflection".
 */
const FLAG_J2000 = SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_J2000 | SEFLG_NOGDEFL;
/** SWIEPH | SPEED — apparent, true ecliptic and equinox of date. The API default. */
const FLAG_OF_DATE = SEFLG_SWIEPH | SEFLG_SPEED;
/** ... | NONUT — mean equinox of date, which is what Meeus ch. 47 is referred to. */
const FLAG_MEAN_OF_DATE = SEFLG_SWIEPH | SEFLG_SPEED | 64;

/**
 * First JD covered by the Swiss Ephemeris data files this deployment ships
 * (`sepl_18.se1` &c., 1800–2399). Below it sweph silently substitutes its
 * built-in Moshier analytic ephemeris — a different ephemeris, so a different
 * comparison and a different tolerance. See docs/accuracy.md §5.2.
 */
const SWIEPH_DATA_START_JD = 2378497; // 1800-01-01
const isMoshierEra = (fx: Fixture) => fx.jd.tt < SWIEPH_DATA_START_JD;

interface Tolerance {
  arcsec: number;
  why: string;
}

// ---------------------------------------------------------------------------
// Tolerances — J2000 frame, Swiss Ephemeris era (1800+).
//
// This comparison isolates the EPHEMERIS: both sides are evaluated at the same
// JD(TT)/TDB in the same non-rotating frame, so neither ΔT nor a precession
// model can contribute.
//
// The floor is NOT the compression error. Measured across the modern fixtures,
// the residual is ~0.05″, of which 0.042″ is a SINGLE ROTATION COMMON TO EVERY
// BODY — the two sides do not use the same numerical value for the obliquity
// that defines "the ecliptic of J2000" (IAU 1976's 84381.448″ vs IAU 2006's
// 84381.406″ differ by 0.042″). Remove that one rotation and the RMS residual
// is 0.005″. The suite asserts that structure directly, below, which is a much
// stronger statement than any per-body bound: a genuine per-body ephemeris
// error cannot hide inside a rotation shared by all of them.
// ---------------------------------------------------------------------------
const WELL_DETERMINED: Tolerance = {
  arcsec: 0.15,
  why: "measured floor is ~0.05″, dominated by a single all-body frame rotation of 0.042″ (the obliquity constant defining the J2000 ecliptic differs between IAU 1976 and IAU 2006 by exactly that); the true per-body ephemeris difference after removing it is ~0.005″ RMS. 0.15″ is 3× the raw floor and ~30× the post-rotation residual, while remaining far below the ≥1″ signature of a wrong flag, frame or epoch",
};

const TOL_J2000: Record<string, Tolerance> = {
  sun: WELL_DETERMINED,
  moon: WELL_DETERMINED,
  mercury: WELL_DETERMINED,
  venus: WELL_DETERMINED,
  mars: WELL_DETERMINED,
  jupiter: WELL_DETERMINED,
  saturn: WELL_DETERMINED,
  neptune: WELL_DETERMINED,
  // Uranus is the one major planet whose residual has clear temporal STRUCTURE:
  // 0.40″ in 1883, 0.36″ in 1918, 0.21″ in 1950, 0.10″ in 1962, 0.02″ in the
  // 1970s. A monotone decline toward the present is the signature of two
  // different orbit determinations converging as they share more astrometry —
  // not of an error, which would not care what year it is.
  uranus: {
    arcsec: 0.50,
    why: "residual declines monotonically toward the present (0.40″ at 1883 → 0.02″ in the 1970s), the signature of orbit-fit divergence between the DE release sweph compresses and the DE441 Horizons serves. Uranus has the poorest historical astrometry of the major planets and a single flyby, so the two fits separate fastest going back",
  },
  pluto: {
    arcsec: 0.30,
    why: "DE431→DE441 materially revised Pluto; its observational arc starts in 1930, so the two integrations diverge most at the early end of this fixture set",
  },
  chiron: {
    arcsec: 5.0,
    why: "Chiron is a small body on a chaotic, planet-crossing orbit. sweph ships a FIXED solution baked into seas_18.se1; Horizons serves the current SBDB fit, re-derived as new astrometry lands. These are different orbit determinations, not two compressions of one, so the residual is solution drift and it grows away from the 1977+ observational arc",
  },
};

// ---------------------------------------------------------------------------
// Tolerances — J2000 frame, Moshier era (before 1800).
//
// This deployment ships only the 1800–2399 Swiss Ephemeris data files, so below
// 1800 sweph substitutes its built-in Moshier analytic ephemeris. The
// comparison there is Moshier-vs-DE441 and says NOTHING about Swiss Ephemeris
// accuracy. It is still worth running — it bounds what the deployment actually
// returns — but it needs its own numbers and its own name.
// ---------------------------------------------------------------------------
const MOSHIER_WHY =
  "before 1800 this deployment has no Swiss Ephemeris data file and sweph falls back to its built-in Moshier analytic ephemeris (asserted below). Moshier is a truncated analytic theory, documented at roughly the arcsecond level and worse for the Moon, whose theory carries the largest truncated terms. This bound describes MOSHIER, not the Swiss Ephemeris";
const TOL_J2000_MOSHIER: Record<string, Tolerance> = {
  moon: { arcsec: 2.0, why: MOSHIER_WHY },
  sun: { arcsec: 1.0, why: MOSHIER_WHY },
  mercury: { arcsec: 1.0, why: MOSHIER_WHY },
  venus: { arcsec: 1.0, why: MOSHIER_WHY },
  mars: { arcsec: 1.0, why: MOSHIER_WHY },
  jupiter: { arcsec: 1.0, why: MOSHIER_WHY },
  saturn: { arcsec: 1.0, why: MOSHIER_WHY },
  uranus: { arcsec: 1.0, why: MOSHIER_WHY },
  neptune: { arcsec: 1.0, why: MOSHIER_WHY },
  pluto: { arcsec: 1.0, why: MOSHIER_WHY },
};

const tolFor = (fx: Fixture, body: string): Tolerance | undefined =>
  isMoshierEra(fx) ? TOL_J2000_MOSHIER[body] : TOL_J2000[body];

// ---------------------------------------------------------------------------
// Tolerances — ecliptic of date. Same ephemeris, plus the rotation from J2000
// to the true equinox and ecliptic of date. That adds a precession model and a
// nutation model, and the two sides do not use the same ones: sweph defaults to
// IAU 2006 precession (Vondrák 2011 far from J2000) with IAU 2000B nutation;
// Horizons' ecliptic-of-date quantities use the IAU 1976/1980 pair. Those are
// not right and wrong — they are successive conventions, and their spread IS
// the tolerance.
//
// The of-date residual necessarily CONTAINS the J2000 residual, so the bound is
// derived rather than restated: model spread + whatever that body already owes.
// ---------------------------------------------------------------------------
const OF_DATE_MODEL_SPREAD = 1.0;
const OF_DATE_SPREAD_WHY =
  "IAU 1976 vs IAU 2006 precession agree to well under 0.1″ near J2000 and diverge roughly quadratically — a few tenths of an arcsecond at ±250 yr, this set's span. IAU 1980 vs IAU 2000B nutation adds ~0.03″. 1.0″ covers both with headroom and is still 20× tighter than the coarsest thing a chart resolves";

function tolOfDate(fx: Fixture, body: string): Tolerance | undefined {
  const base = tolFor(fx, body);
  if (!base) return undefined;
  return {
    arcsec: OF_DATE_MODEL_SPREAD + base.arcsec,
    why: `${OF_DATE_SPREAD_WHY}. Added to the J2000 bound for this body and era, which the frame rotation does not remove: ${base.why}`,
  };
}

/**
 * Signed difference of two longitudes in arcseconds, wrapped to (−180°, +180°].
 * Wrapping matters: a body at 359.9999° and one at 0.0001° are 0.7″ apart, not
 * 1 295 999″ apart, and the fixture set deliberately contains such a case.
 */
function lonDiffArcsec(a: number, b: number): number {
  return (((a - b + 540) % 360) - 180) * 3600;
}

function fail(fx: Fixture, body: string, kind: string, got: number, tol: Tolerance): string {
  return [
    `${fx.id} · ${body} · ${kind}`,
    `  residual ${got.toFixed(4)}″ exceeds ${tol.arcsec}″`,
    `  chart is in the set because: ${fx.why}`,
    `  tolerance reason: ${tol.why}`,
    `  This is an ephemeris finding. Investigate — do NOT widen the constant.`,
  ].join("\n");
}

describe("L1 fixtures — the set itself", () => {
  it("covers at least 20 charts", () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(20);
  });

  it("spans more than two centuries", () => {
    const years = FIXTURES.map((f) => Number(f.input.datetime.slice(0, 4)));
    expect(Math.min(...years)).toBeLessThanOrEqual(1800);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2000);
  });

  it("includes both hemispheres and a sub-polar latitude in each", () => {
    const lats = FIXTURES.map((f) => f.input.latitude);
    expect(Math.min(...lats)).toBeLessThan(-50);
    expect(Math.max(...lats)).toBeGreaterThan(66.5);
  });

  it("includes a gap birth, an ambiguous birth, and fractional-hour zones", () => {
    const kinds = new Set(FIXTURES.map((f) => f.resolved.kind));
    expect(kinds.has("gap")).toBe(true);
    expect(kinds.has("ambiguous")).toBe(true);
    const fractional = FIXTURES.filter((f) => f.resolved.offsetMinutes % 60 !== 0);
    expect(fractional.length).toBeGreaterThanOrEqual(4);
  });

  it("records every gap in coverage rather than dropping it silently", () => {
    // A body Horizons refused is allowed, but it must be written down in the
    // fixture, and docs/accuracy.md must explain it. A silently missing body
    // would look identical to a passing one.
    for (const fx of FIXTURES) {
      const missing = Object.keys(SWE_ID).filter((k) => !(k in fx.j2000Ecliptic));
      expect(
        missing.length === 0 || (fx.notes?.length ?? 0) > 0,
        `${fx.id} missing ${missing.join(",")} with no note`
      ).toBe(true);
    }
  });
});

describe("L1 seam — the frozen JD comes from the real L0 implementation", () => {
  // The harvest script carries its own copy of the timezone resolver so it does
  // not depend on the TypeScript build. That copy is not authoritative: these
  // assertions re-derive the same values with src/lib/ephemeris/julian-day.ts
  // and fail if the two ever drift. Without this, an L1 pass would only prove
  // the harvest agreed with itself.
  for (const fx of FIXTURES) {
    it(`${fx.id} — re-derives the frozen UTC and JD`, () => {
      const resolved = toUTCResolved(parseLocalISO(fx.input.datetime), fx.input.timezone);
      expect(resolved.offsetMinutes).toBeCloseTo(fx.resolved.offsetMinutes, 6);
      expect(resolved.kind).toBe(fx.resolved.kind);
      expect(resolved.utc).toEqual(fx.resolved.utc);

      const jd = swe.utc_to_jd(
        fx.resolved.utc.year, fx.resolved.utc.month, fx.resolved.utc.day,
        fx.resolved.utc.hour, fx.resolved.utc.minute, fx.resolved.utc.second, 1
      );
      expect(jd.data[0]).toBeCloseTo(fx.jd.tt, 9);
      expect(jd.data[1]).toBeCloseTo(fx.jd.ut, 9);
    });
  }
});

// ---------------------------------------------------------------------------
// WHICH ephemeris answered. Every tolerance below depends on this and on
// nothing else, so it is asserted rather than assumed. If the `_12` data files
// are ever shipped, these tests fail and force the pre-1800 bounds to be
// re-derived instead of silently becoming 100× too loose.
// ---------------------------------------------------------------------------
describe("L1 provenance — which ephemeris actually answered", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id} — ${isMoshierEra(fx) ? "falls back to Moshier (no data file below 1800)" : "uses the Swiss Ephemeris data files"}`, () => {
      const p = swe.calc(fx.jd.tt, SWE_ID.sun, FLAG_J2000);
      expect(p.flag).toBeGreaterThanOrEqual(0);
      if (isMoshierEra(fx)) {
        expect(p.flag & SEFLG_MOSEPH, "expected the Moshier fallback below 1800").toBeTruthy();
      } else {
        expect(p.flag & SEFLG_SWIEPH, "expected a Swiss Ephemeris data file").toBeTruthy();
      }
    });
  }

  it("Chiron has no ephemeris at all before 1800, and that is a documented limitation", () => {
    // seas_12.se1 is not shipped and there is no analytic fallback for
    // asteroids, so sweph REFUSES rather than degrading. Pinned here because a
    // refusal is the one outcome a positional tolerance can never notice.
    for (const fx of FIXTURES.filter(isMoshierEra)) {
      const p = swe.calc(fx.jd.tt, SWE_ID.chiron, FLAG_J2000);
      expect(p.flag, `${fx.id}: expected sweph to refuse Chiron`).toBeLessThan(0);
      expect(p.error).toContain("seas_12.se1");
    }
  });
});

describe("L1 — J2000 ecliptic positions vs JPL Horizons (ephemeris in isolation)", () => {
  for (const fx of FIXTURES) {
    for (const [body, ref] of Object.entries(fx.j2000Ecliptic)) {
      const tol = tolFor(fx, body);
      // Chiron before 1800 has no ephemeris; the refusal is asserted above.
      if (!tol) continue;
      it(`${fx.id} · ${body}`, () => {
        const p = swe.calc(fx.jd.tt, SWE_ID[body], FLAG_J2000);
        expect(p.flag, `sweph refused ${body}: ${p.error}`).toBeGreaterThanOrEqual(0);

        const dLon = lonDiffArcsec(p.data[0], ref.lon) * Math.cos((ref.lat * Math.PI) / 180);
        const dLat = (p.data[1] - ref.lat) * 3600;
        expect(Math.abs(dLon), fail(fx, body, "J2000 longitude", dLon, tol)).toBeLessThan(tol.arcsec);
        expect(Math.abs(dLat), fail(fx, body, "J2000 latitude", dLat, tol)).toBeLessThan(tol.arcsec);

        // The radial component, checked against the SAME tolerance rather than
        // a new one. A frame rotation cannot change a distance, so this is the
        // one clean look at the ephemeris with the frame question removed — and
        // it catches a light-time or centre mismatch that longitude can hide
        // (confusing the geocentre with the Earth–Moon barycentre displaces a
        // body by ~3e-5 AU, far outside these bounds).
        //
        // Expressed as the angle that radial error subtends at the body's own
        // distance, so "the ephemerides agree to X arcsec" means the same thing
        // in all three components instead of needing a separate constant.
        if (ref.distanceAu !== undefined) {
          const dRadial = (Math.abs(p.data[2] - ref.distanceAu) / ref.distanceAu) * 206264.806;
          expect(dRadial, fail(fx, body, "distance (as angle at that range)", dRadial, tol)).toBeLessThan(tol.arcsec);
        }
      });
    }
  }
});

// ---------------------------------------------------------------------------
// The J2000 floor is a ROTATION, not per-body error.
//
// This is the strongest single statement the tier makes. Fit one small rotation
// of the ecliptic frame — two free parameters — across every well-determined
// body at every modern epoch simultaneously. If the residual really is a
// disagreement about where the J2000 ecliptic is, one rotation absorbs all of
// it. If any individual body's ephemeris were wrong, it could not: a per-body
// error has no reason to lie on a common sinusoid in longitude.
// ---------------------------------------------------------------------------
describe("L1 structure — the residual floor is one shared frame rotation", () => {
  it("a single two-parameter rotation absorbs the modern-era latitude residual", () => {
    // dLat = r1·sin λ − r2·cos λ for a small rotation (r1, r2) of the frame.
    let saa = 0, sab = 0, sbb = 0, sya = 0, syb = 0;
    const samples: { s: number; c: number; y: number }[] = [];

    for (const fx of FIXTURES) {
      if (isMoshierEra(fx)) continue; // different ephemeris, different question
      for (const [body, ref] of Object.entries(fx.j2000Ecliptic)) {
        if (TOL_J2000[body] !== WELL_DETERMINED) continue; // exclude known orbit-fit drift
        const p = swe.calc(fx.jd.tt, SWE_ID[body], FLAG_J2000);
        if (p.flag < 0) continue;
        const s = Math.sin((ref.lon * Math.PI) / 180);
        const c = Math.cos((ref.lon * Math.PI) / 180);
        const y = (p.data[1] - ref.lat) * 3600;
        saa += s * s; sab += s * c; sbb += c * c; sya += s * y; syb += c * y;
        samples.push({ s, c, y });
      }
    }

    expect(samples.length).toBeGreaterThan(100);
    const det = saa * sbb - sab * sab;
    const r1 = (sya * sbb - syb * sab) / det;
    const r2 = (saa * syb - sab * sya) / det;
    const rms = (v: number[]) => Math.sqrt(v.reduce((t, x) => t + x * x, 0) / v.length);

    const before = rms(samples.map((p) => p.y));
    const after = rms(samples.map((p) => p.y - (r1 * p.s + r2 * p.c)));
    const amplitude = Math.hypot(r1, r2);

    // The rotation is real and small: comparable to the 0.042″ difference
    // between the IAU 1976 and IAU 2006 obliquity constants.
    expect(amplitude, `common rotation ${amplitude.toFixed(4)}″ — larger than a frame-convention difference can explain`).toBeLessThan(0.10);
    // And it explains essentially all of the floor. THIS is the accuracy claim.
    expect(
      after,
      `after removing one common rotation the residual RMS is ${after.toFixed(4)}″ (from ${before.toFixed(4)}″). If this rises, some body's ephemeris — not the frame — has moved.`
    ).toBeLessThan(0.015);
    expect(after).toBeLessThan(before / 3);
  });
});

// ---------------------------------------------------------------------------
// Uranus gets the loosest major-planet bound in the set, so its reason is tested
// rather than merely written down.
//
// The claim is orbit-fit divergence: two different determinations of the same
// orbit, pinned together where the observational constraint is strongest and
// separating away from it. For Uranus that anchor is not "the present" — it is
// the Voyager 2 encounter of 1986-01-24, the only spacecraft ranging this planet
// has ever had. The hypothesis therefore makes a falsifiable prediction fixed by
// an EXTERNAL date rather than by fitting this data: the residual is minimised
// near 1986 and grows in BOTH directions away from it.
//
// It does. The residual runs 0.402″ (1883) → 0.204″ (1950) → 0.001″ (1980) →
// 0.010″ (1990) → 0.039″ (2005): a V whose floor sits on the encounter.
// A defect in the ephemeris, a wrong flag or a bad frame would produce nothing
// of the kind. If this fails, the 0.50″ bound has lost its justification and
// must be re-derived, not kept.
// ---------------------------------------------------------------------------
const VOYAGER2_URANUS_JD = 2446454.5; // 1986-01-24, closest approach

describe("L1 structure — the Uranus residual is orbit-fit divergence", () => {
  it("is minimised at the Voyager 2 encounter and grows away from it in both directions", () => {
    const pts = FIXTURES.filter((f) => !isMoshierEra(f) && f.j2000Ecliptic.uranus).map((fx) => {
      const ref = fx.j2000Ecliptic.uranus;
      const p = swe.calc(fx.jd.tt, SWE_ID.uranus, FLAG_J2000);
      return {
        fromEncounter: Math.abs(fx.jd.tt - VOYAGER2_URANUS_JD),
        resid: Math.abs(lonDiffArcsec(p.data[0], ref.lon)),
      };
    });

    expect(pts.length).toBeGreaterThan(10);

    // Spearman rank correlation: +1 means the residual orders perfectly by
    // distance from the encounter.
    const rank = (v: number[]) => v.map((x) => v.filter((y) => y < x).length);
    const rx = rank(pts.map((p) => p.fromEncounter));
    const ry = rank(pts.map((p) => p.resid));
    const n = pts.length;
    const rho = 1 - (6 * rx.reduce((t, x, i) => t + (x - ry[i]) ** 2, 0)) / (n * (n * n - 1));

    expect(
      rho,
      `Spearman rho between |epoch − Voyager 2 encounter| and |Uranus residual| is ${rho.toFixed(3)}. Orbit-fit divergence anchored by spacecraft ranging predicts a strong positive. Without it the 0.50″ tolerance has no justification — re-derive it, do not keep it.`
    ).toBeGreaterThan(0.85);

    // The effect is also large, not merely well-ordered: charts a century from
    // the encounter disagree by two orders of magnitude more than charts on it.
    const sorted = [...pts].sort((a, b) => a.fromEncounter - b.fromEncounter);
    const near = sorted.slice(0, 3).reduce((t, p) => t + p.resid, 0) / 3;
    const far = sorted.slice(-3).reduce((t, p) => t + p.resid, 0) / 3;
    expect(far).toBeGreaterThan(20 * near);
  });
});

describe("L1 — apparent positions of date vs JPL Horizons (precession + nutation)", () => {
  for (const fx of FIXTURES) {
    for (const [body, ref] of Object.entries(fx.ofDateApparent)) {
      const tol = tolOfDate(fx, body);
      if (!tol) continue;
      it(`${fx.id} · ${body}`, () => {
        const p = swe.calc(fx.jd.tt, SWE_ID[body], FLAG_OF_DATE);
        expect(p.flag, `sweph refused ${body}: ${p.error}`).toBeGreaterThanOrEqual(0);

        const dLon = lonDiffArcsec(p.data[0], ref.lon) * Math.cos((ref.lat * Math.PI) / 180);
        const dLat = (p.data[1] - ref.lat) * 3600;
        expect(Math.abs(dLon), fail(fx, body, "of-date longitude", dLon, tol)).toBeLessThan(tol.arcsec);
        expect(Math.abs(dLat), fail(fx, body, "of-date latitude", dLat, tol)).toBeLessThan(tol.arcsec);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// Relativistic light deflection — a positive test, not an exclusion.
//
// The J2000 comparison switches deflection OFF to match Horizons' VECTORS
// correction model. That would leave the term untested, so it is tested here
// against the OBSERVER tables, which DO include it. The fixture set contains a
// body in near-exact solar conjunction (Jupiter 0.27° from the Sun in January
// 1985) precisely because that is where the term is large enough to adjudicate:
// ~1.5″ instead of its usual few milliarcseconds.
// ---------------------------------------------------------------------------
describe("L1 — relativistic light deflection near solar conjunction", () => {
  const conj = FIXTURES.find((f) => f.id === "sydney-1985-southern-dst");
  if (!conj) {
    // Not a skip: losing this chart silently disarms the only test of the
    // deflection term, so its absence must itself be a failure.
    it("the near-conjunction fixture is load-bearing and must exist", () => {
      expect.fail("sydney-1985-southern-dst is missing — it is the only solar conjunction in the set");
    });
    return;
  }

  it("Jupiter really is in solar conjunction here (the premise of the test)", () => {
    const sun = swe.calc(conj.jd.tt, SWE_ID.sun, FLAG_J2000).data[0];
    const jup = swe.calc(conj.jd.tt, SWE_ID.jupiter, FLAG_J2000).data[0];
    expect(Math.abs(lonDiffArcsec(sun, jup)) / 3600).toBeLessThan(1.0);
  });

  it("sweph WITH deflection matches Horizons' apparent place; without it, it does not", () => {
    const ref = conj.ofDateApparent.jupiter;
    const withDefl = swe.calc(conj.jd.tt, SWE_ID.jupiter, FLAG_OF_DATE);
    const without = swe.calc(conj.jd.tt, SWE_ID.jupiter, FLAG_OF_DATE | SEFLG_NOGDEFL);

    const dWith = Math.abs((withDefl.data[1] - ref.lat) * 3600);
    const dWithout = Math.abs((without.data[1] - ref.lat) * 3600);

    expect(dWith, "Horizons OBSERVER tables include gravitational deflection; sweph's default must agree").toBeLessThan(0.15);
    expect(dWithout, "with deflection disabled the disagreement must appear — otherwise this test proves nothing").toBeGreaterThan(1.0);
  });

  it("Horizons' VECTORS tables do NOT include deflection, which is why FLAG_J2000 disables it", () => {
    const ref = conj.j2000Ecliptic.jupiter;
    const without = swe.calc(conj.jd.tt, SWE_ID.jupiter, FLAG_J2000);
    const withDefl = swe.calc(conj.jd.tt, SWE_ID.jupiter, FLAG_J2000 & ~SEFLG_NOGDEFL);

    expect(Math.abs((without.data[1] - ref.lat) * 3600)).toBeLessThan(0.15);
    expect(Math.abs((withDefl.data[1] - ref.lat) * 3600)).toBeGreaterThan(1.0);
  });
});

// ---------------------------------------------------------------------------
// The lunar nodes. Horizons has no node body — a node is not an object, it is a
// property of an orbit, and the two nodes this API publishes are two different
// conventions for extracting it.
//
// The node direction is fixed by the orbital angular momentum h = r × v alone.
// It does not depend on GM, on the epoch of osculation, or on any convention,
// which makes it a genuinely independent check of the lunar VELOCITY — the only
// place in this tier where velocity is tested at all. Horizons' `OM` element
// was verified to equal its own r × v node to 0.00″ before being used here.
// ---------------------------------------------------------------------------
const TOL_OSC_NODE: Tolerance = {
  arcsec: 3.0,
  why: "the node is the direction of r × v, free of GM and of any element convention, so both sides mean exactly the same thing and the only input that differs is the lunar state vector itself. Small velocity differences are amplified into the node direction, so this bound is looser than the Moon's own positional bound",
};
const TOL_OSC_NODE_MOSHIER: Tolerance = {
  arcsec: 40.0,
  why: `${MOSHIER_WHY}. The node amplifies the Moon's velocity error, so the Moshier-era bound is proportionally looser than its ~2″ positional bound`,
};

describe("L1 — lunar orbital plane (osculating node from the state vector)", () => {
  /** Ascending node of the geocentric lunar orbit, from sweph's own r and v. */
  function oscNodeFromSweph(jdTt: number): number {
    const m = swe.calc(jdTt, SWE_ID.moon, FLAG_J2000).data;
    const rad = Math.PI / 180;
    const [l, b, r, dl, db, dr] = [m[0] * rad, m[1] * rad, m[2], m[3] * rad, m[4] * rad, m[5]];
    const cb = Math.cos(b), sb = Math.sin(b), cl = Math.cos(l), sl = Math.sin(l);
    const x = r * cb * cl, y = r * cb * sl, z = r * sb;
    const vx = dr * cb * cl - r * db * sb * cl - r * dl * cb * sl;
    const vy = dr * cb * sl - r * db * sb * sl + r * dl * cb * cl;
    const vz = dr * sb + r * db * cb;
    const hx = y * vz - z * vy;
    const hy = z * vx - x * vz;
    return (((Math.atan2(hx, -hy) * 180) / Math.PI) % 360 + 360) % 360;
  }

  for (const fx of FIXTURES) {
    if (fx.moonOsculatingNodeJ2000 == null) continue;
    const tol = isMoshierEra(fx) ? TOL_OSC_NODE_MOSHIER : TOL_OSC_NODE;
    it(`${fx.id} · osculating node vs Horizons OM`, () => {
      const d = lonDiffArcsec(oscNodeFromSweph(fx.jd.tt), fx.moonOsculatingNodeJ2000!);
      expect(Math.abs(d), fail(fx, "osculating_node", "J2000 longitude", d, tol)).toBeLessThan(tol.arcsec);
    });
  }
});

// ---------------------------------------------------------------------------
// SE_TRUE_NODE is a CONVENTION, and is deliberately not tested against Horizons.
//
// Measured: SE_TRUE_NODE differs from the osculating node of the instantaneous
// geocentric lunar orbit by 0.6″ near J2000, 38″ by 1990, 372″ by 1883 and
// 1285″ (0.36°) by 1750 — oscillating in sign with an envelope that grows away
// from J2000. The osculating node itself is reproduced from sweph's own state
// vector to ~1″ (above), so this is not a lunar-ephemeris error: SE_TRUE_NODE
// simply computes a different quantity.
//
// Every astrology program built on the Swiss Ephemeris publishes this same
// quantity, so matching it is the correct behaviour for this API and pointing a
// test at Horizons here would be a category error. What IS testable is that the
// convention does not silently change, and that its divergence stays inside the
// envelope documented in docs/accuracy.md §4.
// ---------------------------------------------------------------------------
describe("L1 — SE_TRUE_NODE convention envelope", () => {
  for (const fx of FIXTURES) {
    if (fx.moonOsculatingNodeJ2000 == null) continue;
    it(`${fx.id} · stays inside the documented envelope`, () => {
      const se = swe.calc(fx.jd.tt, 11, FLAG_J2000);
      const d = Math.abs(lonDiffArcsec(se.data[0], fx.moonOsculatingNodeJ2000!));
      const years = Math.abs(fx.jd.tt - 2451545) / 365.25;
      // 0.36° at 250 yr from J2000, shrinking to arcseconds at J2000 itself.
      const envelope = 6 * years + 5;
      expect(
        d,
        `${fx.id}: SE_TRUE_NODE is ${d.toFixed(1)}″ from the osculating node, outside the documented envelope of ${envelope.toFixed(0)}″ at ${years.toFixed(0)} yr from J2000. The convention has changed — update docs/accuracy.md §4, do not widen this.`
      ).toBeLessThan(envelope);
    });
  }
});

const TOL_MEAN_NODE: Tolerance = {
  arcsec: 1.0,
  why: "the mean node is not observable — it is a mean-element convention, so no ephemeris can verify it and Horizons is not the oracle here. The reference is Meeus (1998) ch. 47, an independent implementation of the same ELP-derived mean-element theory referred to the MEAN equinox of date (hence SEFLG_NONUT). The two are different truncations of that theory, so the residual grows with |T| and reaches a few tenths of an arcsecond at the ends of this span",
};

describe("L1 — mean node vs Meeus (1998) ch. 47", () => {
  for (const fx of FIXTURES) {
    it(`${fx.id} · mean node`, () => {
      const T = (fx.jd.tt - 2451545) / 36525;
      const meeus =
        ((125.0445479 - 1934.1362891 * T + 0.0020754 * T * T + T ** 3 / 467441 - T ** 4 / 60616000) % 360 + 360) % 360;
      const p = swe.calc(fx.jd.tt, 10, FLAG_MEAN_OF_DATE);
      const d = lonDiffArcsec(p.data[0], meeus);
      expect(Math.abs(d), fail(fx, "mean_node", "mean-of-date longitude", d, TOL_MEAN_NODE)).toBeLessThan(TOL_MEAN_NODE.arcsec);
    });
  }
});

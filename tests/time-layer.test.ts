/**
 * L0 — TIME LAYER. Local wall clock → UTC → Julian Day.
 *
 * This tier sits ABOVE the ephemeris tests and needs no astronomical oracle.
 * Everything here is decidable from the IANA tz database and the calendar, so
 * it can assert exact values rather than tolerances.
 *
 * It exists because an error here is invisible downstream: a wrong offset does
 * not produce a broken chart, it produces a valid chart for a different moment.
 * Every ephemeris comparison downstream would then disagree with its oracle in
 * a way that looks like an ephemeris problem and is not.
 *
 * The JD assertions compare against a SECOND, INDEPENDENT implementation of
 * Meeus (1998) ch. 7 written in this file — not against sweph — so a bug in the
 * Swiss Ephemeris call path cannot make these pass.
 */
import { describe, it, expect } from "vitest";
import {
  parseLocalISO,
  resolveLocalTime,
  timezoneOffsetMinutes,
  toUTC,
  toUTCResolved,
} from "@/lib/ephemeris/julian-day";
import { julianDayUT, julianDayUTResolved } from "@/lib/ephemeris/client";
import { calculateNatalChart } from "@/lib/calculators/astrology";

/**
 * Julian Day from a UTC calendar date, Meeus (1998) ch. 7, Gregorian branch.
 * Deliberately a hand-written second implementation: sweph's `utc_to_jd` is the
 * thing under test, so it cannot also be the reference.
 */
function meeusJD(y: number, m: number, d: number, h: number, mi: number, s: number): number {
  let year = y;
  let month = m;
  if (month <= 2) {
    year -= 1;
    month += 12;
  }
  const A = Math.floor(year / 100);
  const B = 2 - A + Math.floor(A / 4);
  const dayFraction = d + (h + mi / 60 + s / 3600) / 24;
  return (
    Math.floor(365.25 * (year + 4716)) +
    Math.floor(30.6001 * (month + 1)) +
    dayFraction +
    B -
    1524.5
  );
}

/**
 * sweph's `utc_to_jd` returns JD(UT1); meeusJD returns JD(UTC). They differ by
 * (UT1 − UTC), which is kept below 0.9 s by leap seconds — 1.04e-5 day. The
 * tolerance below is that physical bound, not a number chosen to make a test
 * pass. Anything larger is a real defect in the conversion path.
 */
const JD_TOL_DAYS = 1.1e-5; // ≈ 0.95 s

const iso = (utc: { year: number; month: number; day: number; hour: number; minute: number; second: number }) =>
  `${String(utc.year).padStart(4, "0")}-${String(utc.month).padStart(2, "0")}-${String(utc.day).padStart(2, "0")}` +
  `T${String(utc.hour).padStart(2, "0")}:${String(utc.minute).padStart(2, "0")}:${String(Math.round(utc.second)).padStart(2, "0")}Z`;

// ---------------------------------------------------------------------------
// Offsets on the dangerous axes. Expected values come from the IANA tz
// database, independently of this codebase.
// ---------------------------------------------------------------------------
describe("L0 offsets — ordinary cases", () => {
  const cases: Array<[string, string, number, string]> = [
    ["America/New_York", "1980-07-15T14:30:00", -240, "EDT"],
    ["America/New_York", "1980-01-15T14:30:00", -300, "EST"],
    ["Asia/Tokyo", "2000-06-15T12:00:00", 540, "JST, no DST"],
    ["Africa/Johannesburg", "1968-02-29T06:00:00", 120, "SAST, southern hemisphere, no DST"],
    ["Asia/Kolkata", "1975-08-20T10:15:00", 330, "+05:30 half-hour zone"],
    ["Asia/Kathmandu", "1995-04-10T06:45:00", 345, "+05:45 — the only 45-minute zone in common use"],
    ["Asia/Kathmandu", "1980-04-10T06:45:00", 330, "Nepal was +05:30 before 1986"],
    ["Pacific/Chatham", "2020-07-10T09:00:00", 765, "+12:45 standard"],
    ["Pacific/Chatham", "2020-01-10T09:00:00", 825, "+13:45 daylight"],
    ["Australia/Adelaide", "1999-11-20T08:00:00", 630, "+10:30 daylight, southern hemisphere"],
  ];

  for (const [tz, dt, expected, note] of cases) {
    it(`${tz} ${dt} → ${expected} (${note})`, () => {
      expect(timezoneOffsetMinutes(parseLocalISO(dt), tz)).toBe(expected);
    });
  }
});

describe("L0 offsets — pre-standard-time local mean time", () => {
  // Before a zone adopted standard time its offset is its LMT: longitude/15
  // hours, to the second. These are not whole minutes, and rounding them is a
  // real (if small) error in the resulting chart.
  it("Europe/Paris in 1890 uses Paris Mean Time, +00:09:21", () => {
    const off = timezoneOffsetMinutes(parseLocalISO("1890-06-15T12:00:00"), "Europe/Paris");
    expect(off).toBeCloseTo(9 + 21 / 60, 6);
  });

  it("America/New_York before 1883-11-18 uses LMT, −04:56:02", () => {
    const off = timezoneOffsetMinutes(parseLocalISO("1883-11-17T12:00:00"), "America/New_York");
    expect(off).toBeCloseTo(-(4 * 60 + 56 + 2 / 60), 6);
  });

  it("the same zone one day later is on standard time, −05:00", () => {
    const off = timezoneOffsetMinutes(parseLocalISO("1883-11-19T12:00:00"), "America/New_York");
    expect(off).toBe(-300);
  });
});

// ---------------------------------------------------------------------------
// REGRESSION. Each of these returned an offset exactly 60 minutes wrong before
// the fixed-point resolution landed, on a perfectly valid birth time.
//
// The old implementation asked for the offset at the wall clock *interpreted as
// UTC*, which is |offset| hours away from the real instant, so any transition
// inside that window landed on the wrong side. The window is a few hours of
// valid local time after every transition, scaling with |offset|.
// ---------------------------------------------------------------------------
describe("L0 offsets — DST transition edges (regression)", () => {
  const cases: Array<[string, string, number, string]> = [
    ["America/New_York", "2026-03-08T03:00:00", -240, "first hour of EDT; was −300"],
    ["America/New_York", "2026-11-01T03:00:00", -300, "after fall-back to EST; was −240"],
    ["America/Los_Angeles", "2026-03-08T05:00:00", -420, "PDT, wide window; was −480"],
    ["Australia/Sydney", "2026-10-04T05:00:00", 660, "AEDT begins; southern hemisphere"],
    ["Australia/Sydney", "2026-04-05T05:00:00", 600, "AEST resumes; southern hemisphere"],
    ["Pacific/Auckland", "2026-09-27T06:00:00", 780, "NZDT begins; +13 window is 13 h wide"],
    ["America/Santiago", "2026-09-06T05:00:00", -180, "southern-hemisphere DST"],
    ["Asia/Tehran", "2005-03-21T20:30:00", 210, "Iran DST, +03:30 → +04:30"],
    ["America/Sao_Paulo", "1990-02-11T01:00:00", -180, "historic Brazilian DST end"],
    ["Europe/Berlin", "1990-03-25T03:00:00", 120, "CEST begins"],
  ];

  for (const [tz, dt, expected, note] of cases) {
    it(`${tz} ${dt} → ${expected} (${note})`, () => {
      expect(timezoneOffsetMinutes(parseLocalISO(dt), tz)).toBe(expected);
    });
  }

  it("times just outside a transition window are unaffected", () => {
    // Guards against "fixing" the edge by breaking the ordinary case.
    expect(timezoneOffsetMinutes(parseLocalISO("2026-03-07T03:00:00"), "America/New_York")).toBe(-300);
    expect(timezoneOffsetMinutes(parseLocalISO("2026-03-09T03:00:00"), "America/New_York")).toBe(-240);
    expect(timezoneOffsetMinutes(parseLocalISO("2026-10-31T03:00:00"), "America/New_York")).toBe(-240);
    expect(timezoneOffsetMinutes(parseLocalISO("2026-11-02T03:00:00"), "America/New_York")).toBe(-300);
  });
});

// ---------------------------------------------------------------------------
// Wall clocks that are not in 1:1 correspondence with the timeline.
// The rule is Temporal's `compatible` mode: use the offset in effect BEFORE the
// transition, in both directions. See docs/time-conventions.md.
// ---------------------------------------------------------------------------
describe("L0 — non-existent and ambiguous wall clocks", () => {
  it("classifies a birth inside the skipped hour as a gap", () => {
    // 2026-03-08: 02:00 EST jumps to 03:00 EDT. 02:30 never happened.
    const r = resolveLocalTime(parseLocalISO("2026-03-08T02:30:00"), "America/New_York");
    expect(r.kind).toBe("gap");
    expect(r.offsetMinutes).toBe(-300); // pre-transition offset
  });

  it("resolves the skipped hour forward, past the gap", () => {
    const { utc, kind } = toUTCResolved(parseLocalISO("2026-03-08T02:30:00"), "America/New_York");
    expect(kind).toBe("gap");
    // 02:30 + 05:00 = 07:30Z, which reads back as 03:30 EDT — one hour later,
    // the same shift `new Date(2026, 2, 8, 2, 30)` performs in that zone.
    expect(iso(utc)).toBe("2026-03-08T07:30:00Z");
  });

  it("classifies the repeated hour as ambiguous and takes the first occurrence", () => {
    // 2026-11-01: 02:00 EDT falls back to 01:00 EST. 01:30 happens twice.
    const r = resolveLocalTime(parseLocalISO("2026-11-01T01:30:00"), "America/New_York");
    expect(r.kind).toBe("ambiguous");
    expect(r.offsetMinutes).toBe(-240); // still EDT — the earlier instant
    expect(iso(toUTC(parseLocalISO("2026-11-01T01:30:00"), "America/New_York"))).toBe(
      "2026-11-01T05:30:00Z"
    );
  });

  it("finds the gap and the repeat in a southern-hemisphere zone too", () => {
    // Australia/Sydney 2026-10-04: 02:00 AEST → 03:00 AEDT (gap).
    expect(resolveLocalTime(parseLocalISO("2026-10-04T02:30:00"), "Australia/Sydney").kind).toBe("gap");
    // 2026-04-05: 03:00 AEDT → 02:00 AEST (repeat).
    expect(resolveLocalTime(parseLocalISO("2026-04-05T02:30:00"), "Australia/Sydney").kind).toBe(
      "ambiguous"
    );
  });

  it("reports every ordinary time as unique", () => {
    for (const [tz, dt] of [
      ["America/New_York", "1980-07-15T14:30:00"],
      ["Asia/Kolkata", "1975-08-20T10:15:00"],
      ["Pacific/Chatham", "2020-07-10T09:00:00"],
      ["Europe/Paris", "1890-06-15T12:00:00"],
    ] as const) {
      expect(resolveLocalTime(parseLocalISO(dt), tz).kind).toBe("unique");
    }
  });
});

// ---------------------------------------------------------------------------
// UTC and JD asserted directly, not inferred from a chart.
// ---------------------------------------------------------------------------
describe("L0 — local → UTC", () => {
  const cases: Array<[string, string, string]> = [
    ["America/New_York", "1980-07-15T14:30:00", "1980-07-15T18:30:00Z"],
    ["America/New_York", "2026-11-01T03:00:00", "2026-11-01T08:00:00Z"],
    // NSW started DST early in 2000 (27 Aug) for the Sydney Olympics, so this
    // September date is already AEDT +11, not AEST +10. A hand-written "+10 in
    // September" expectation is wrong here, and this row exists to keep it wrong.
    ["Australia/Sydney", "2000-09-24T23:45:00", "2000-09-24T12:45:00Z"],
    ["Pacific/Chatham", "2020-01-10T09:00:00", "2020-01-09T19:15:00Z"],
    ["Asia/Kathmandu", "1995-04-10T06:45:00", "1995-04-10T01:00:00Z"],
    ["Asia/Kolkata", "1975-08-20T10:15:00", "1975-08-20T04:45:00Z"],
  ];

  for (const [tz, local, expected] of cases) {
    it(`${tz} ${local} → ${expected}`, () => {
      expect(iso(toUTC(parseLocalISO(local), tz))).toBe(expected);
    });
  }

  it("crosses the date boundary in both directions", () => {
    expect(iso(toUTC(parseLocalISO("2000-01-01T00:30:00"), "Pacific/Auckland"))).toBe(
      "1999-12-31T11:30:00Z"
    );
    expect(iso(toUTC(parseLocalISO("1999-12-31T22:00:00"), "America/Los_Angeles"))).toBe(
      "2000-01-01T06:00:00Z"
    );
  });
});

describe("L0 — UTC → Julian Day, against an independent Meeus implementation", () => {
  const cases: Array<[string, string]> = [
    ["America/New_York", "1980-07-15T14:30:00"],
    ["America/New_York", "2026-03-08T03:00:00"],
    ["America/New_York", "2026-11-01T03:00:00"],
    ["Australia/Sydney", "1975-06-01T09:00:00"],
    ["Pacific/Chatham", "2020-01-10T09:00:00"],
    ["Asia/Kathmandu", "1995-04-10T06:45:00"],
    ["Europe/Paris", "1890-06-15T12:00:00"],
    ["America/New_York", "1883-11-17T12:00:00"],
    ["UTC", "1899-12-31T12:00:00"],
    ["UTC", "2000-01-01T12:00:00"],
  ];

  for (const [tz, local] of cases) {
    it(`${tz} ${local}`, () => {
      const utc = toUTC(parseLocalISO(local), tz);
      const expected = meeusJD(utc.year, utc.month, utc.day, utc.hour, utc.minute, utc.second);
      expect(julianDayUT(local, tz)).toBeCloseTo(expected, 4);
      expect(Math.abs(julianDayUT(local, tz) - expected)).toBeLessThan(JD_TOL_DAYS);
    });
  }

  it("anchors on the two JD epochs everyone knows", () => {
    // J2000.0 = 2000-01-01 12:00 TT ≈ JD 2451545.0; in UT the difference is the
    // ~64 s of ΔT, which does not apply to JD(UT) — so this is exactly 2451545.
    expect(meeusJD(2000, 1, 1, 12, 0, 0)).toBe(2451545);
    // JD 0 is 4713 BC Jan 1 12:00 in the Julian proleptic calendar; the modern
    // anchor that is checkable in the Gregorian branch is 1970-01-01 00:00 UT.
    expect(meeusJD(1970, 1, 1, 0, 0, 0)).toBe(2440587.5);
    expect(julianDayUT("2000-01-01T12:00:00", "UTC")).toBeCloseTo(2451545, 4);
    expect(julianDayUT("1970-01-01T00:00:00", "UTC")).toBeCloseTo(2440587.5, 4);
  });

  it("spaces consecutive local noons by 24 h, except 23 h across spring-forward", () => {
    // Consecutive local noons are one real day apart — EXCEPT across a
    // spring-forward, where they are 23 hours apart because an hour of the
    // timeline is genuinely absent. Asserting the whole week pins both the
    // ordinary days and the transition, and fails if the transition is placed
    // on the wrong day or missed entirely.
    const tz = "America/New_York";
    const days = ["05", "06", "07", "08", "09", "10", "11"];
    const jds = days.map((d) => julianDayUT(`2026-03-${d}T12:00:00`, tz));
    const stepHours = jds.slice(1).map((jd, i) => (jd - jds[i]) * 24);
    expect(stepHours.map((h) => Math.round(h))).toEqual([24, 24, 23, 24, 24, 24]);
    for (const h of stepHours) expect(h).toBeCloseTo(Math.round(h), 5);
  });

  it("spaces consecutive local noons by 25 h across fall-back", () => {
    const tz = "America/New_York";
    const days = ["30", "31"];
    const before = days.map((d) => julianDayUT(`2026-10-${d}T12:00:00`, tz));
    const after = ["01", "02"].map((d) => julianDayUT(`2026-11-${d}T12:00:00`, tz));
    const jds = [...before, ...after];
    const stepHours = jds.slice(1).map((jd, i) => (jd - jds[i]) * 24);
    expect(stepHours.map((h) => Math.round(h))).toEqual([24, 25, 24]);
  });

  it("advances by exactly one hour per local hour through a transition day", () => {
    // Local 00:00 → 23:00 on a spring-forward day is 23 UT hours, not 24: the
    // skipped hour is genuinely absent from the timeline. Asserting the shape
    // of the day is stronger than asserting any single offset.
    const tz = "America/New_York";
    const jds = Array.from({ length: 24 }, (_, h) =>
      julianDayUT(`2026-03-08T${String(h).padStart(2, "0")}:00:00`, tz)
    );
    const spanHours = (jds[23] - jds[0]) * 24;
    expect(spanHours).toBeCloseTo(22, 6); // 23 local steps, one of which is absent
    // and no step ever goes backwards
    for (let i = 1; i < jds.length; i++) expect(jds[i]).toBeGreaterThanOrEqual(jds[i - 1]);
  });
});

// ---------------------------------------------------------------------------
// The disambiguation must reach the caller. A chart cast from a wall clock that
// does not identify a single instant is defensible but not uniquely determined
// by its input, and silently returning it is the failure mode this whole tier
// exists to prevent.
// ---------------------------------------------------------------------------
describe("L0 — disambiguation is surfaced, not swallowed", () => {
  const nyc = { latitude: 40.7128, longitude: -74.006, timezone: "America/New_York" };

  it("warns when the birth time falls in a skipped hour", () => {
    const chart = calculateNatalChart({ datetime: "2026-03-08T02:30:00", ...nyc });
    expect(chart.warnings.some((w) => /does not exist/.test(w))).toBe(true);
  });

  it("warns when the birth time occurs twice", () => {
    const chart = calculateNatalChart({ datetime: "2026-11-01T01:30:00", ...nyc });
    expect(chart.warnings.some((w) => /occurs twice/.test(w))).toBe(true);
  });

  it("stays silent for an ordinary birth time", () => {
    const chart = calculateNatalChart({ datetime: "1980-07-15T14:30:00", ...nyc });
    expect(chart.warnings).toEqual([]);
  });

  it("reports the offset and UT it actually used", () => {
    const r = julianDayUTResolved("2026-11-01T03:00:00", "America/New_York");
    expect(r.offsetMinutes).toBe(-300);
    expect(r.kind).toBe("unique");
    expect(r.utc.hour).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Calendar range validation. `Date.UTC` rolls out-of-range components over
// silently, so without an explicit check these inputs produced a complete,
// confident chart for a different date — the same failure mode as a wrong
// offset, and just as invisible in the output.
// ---------------------------------------------------------------------------
describe("L0 — impossible wall clocks are rejected, not normalized", () => {
  const rejected: Array<[string, string]> = [
    ["2026-02-30T12:00:00", "30 February — rolled to 2 March"],
    ["2026-13-45T25:70:00", "every field out of range — rolled to 2027-02-15"],
    ["2026-00-10T12:00:00", "month 00"],
    ["2026-01-00T12:00:00", "day 00"],
    ["2026-01-10T24:00:00", "hour 24"],
    ["2026-01-10T12:60:00", "minute 60"],
    ["2016-12-31T23:59:60", "leap second — rolled into the next minute"],
    ["1900-02-29T12:00:00", "1900 was not a leap year (century rule)"],
  ];

  for (const [input, why] of rejected) {
    it(`rejects ${input} (${why})`, () => {
      expect(() => parseLocalISO(input)).toThrow(/Invalid datetime/);
    });
  }

  it("accepts the leap days that do exist", () => {
    expect(parseLocalISO("2000-02-29T12:00:00").day).toBe(29); // 400-year rule
    expect(parseLocalISO("2024-02-29T12:00:00").day).toBe(29);
    expect(parseLocalISO("1968-02-29T06:00:00").day).toBe(29);
  });

  it("accepts the boundary values that are legal", () => {
    expect(parseLocalISO("2026-12-31T23:59:59").second).toBe(59);
    expect(parseLocalISO("2026-01-01T00:00:00").hour).toBe(0);
  });
});

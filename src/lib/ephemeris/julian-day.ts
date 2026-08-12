// Convert a wall-clock datetime in an IANA timezone to UTC, then to Julian Day.
// Uses the built-in Intl API to resolve historical timezone offsets including
// DST transitions and pre-standard-time LMT; no external timezone library.
//
// This is the highest-risk layer in the whole calculator: an error here is a
// whole-hour shift in UT that every downstream number inherits, and it fails
// *plausibly* — the chart still looks like a chart, it is just someone else's.
// See docs/time-conventions.md for the disambiguation rules and their proof.

export interface ParsedDateTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/** How a wall-clock time maps onto the UTC timeline in a given zone. */
export type LocalTimeKind =
  /** Exactly one instant has this wall-clock reading. The normal case. */
  | "unique"
  /** DST "spring forward": this reading never occurred. */
  | "gap"
  /** DST "fall back": two instants have this reading. */
  | "ambiguous";

export interface ResolvedLocalTime {
  /** Minutes east of UTC applied to this wall clock. */
  offsetMinutes: number;
  kind: LocalTimeKind;
}

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

/** Days in a (proleptic) Gregorian month. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

/**
 * Parse a local wall clock. Shape AND calendar ranges are both checked here.
 *
 * The range check is not pedantry. `Date.UTC` silently rolls out-of-range
 * components over, so without it "2026-02-30T12:00" produced a complete,
 * confident chart for 2 March, and "2026-13-45T25:70" produced one for
 * 2027-02-15. That is the same failure mode as a wrong timezone offset: a valid
 * chart for a moment nobody asked about, with nothing in the response to say so.
 *
 * The thrown message begins "Invalid datetime" so `handleCalculatorError` maps
 * it to a 422 rather than a 500.
 */
export function parseLocalISO(iso: string): ParsedDateTime {
  const m = ISO_RE.exec(iso.trim());
  if (!m) throw new Error(`Invalid datetime "${iso}". Expected "YYYY-MM-DDTHH:mm[:ss]".`);

  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const hour = Number(m[4]);
  const minute = Number(m[5]);
  const second = m[6] ? Number(m[6]) : 0;

  const bad = (what: string) => {
    throw new Error(`Invalid datetime "${iso}": ${what}.`);
  };

  if (month < 1 || month > 12) bad(`month ${m[2]} is out of range 01–12`);
  if (day < 1 || day > daysInMonth(year, month)) {
    bad(`${year}-${m[2]} has ${daysInMonth(year, month)} days, so day ${m[3]} does not exist`);
  }
  if (hour > 23) bad(`hour ${m[4]} is out of range 00–23`);
  if (minute > 59) bad(`minute ${m[5]} is out of range 00–59`);
  // Leap seconds are real but never appear in a birth record, and accepting
  // ":60" would roll the reading into the next minute. Reject it explicitly.
  if (second >= 60) bad(`second ${m[6]} is out of range 00–59 (leap seconds are not supported)`);

  return { year, month, day, hour, minute, second };
}

const DAY_MS = 86_400_000;

function wallClockMs(local: ParsedDateTime): number {
  return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute, local.second);
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let f = formatterCache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    formatterCache.set(timeZone, f);
  }
  return f;
}

/**
 * The zone's wall-clock reading at a true UTC instant, expressed as the ms value
 * that reading would have if it were read as UTC. Unambiguous by construction:
 * an instant has exactly one local reading.
 */
function wallClockMsAtInstant(utcMs: number, timeZone: string): number {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));
  const lookup: Record<string, number> = {};
  for (const p of parts) {
    if (p.type !== "literal") lookup[p.type] = Number(p.value);
  }
  return Date.UTC(
    lookup.year,
    lookup.month - 1,
    lookup.day,
    lookup.hour === 24 ? 0 : lookup.hour,
    lookup.minute,
    lookup.second
  );
}

/** Minutes east of UTC in effect at a true UTC instant. Never ambiguous. */
function offsetAtInstant(utcMs: number, timeZone: string): number {
  return (wallClockMsAtInstant(utcMs, timeZone) - utcMs) / 60_000;
}

/**
 * Resolve a wall-clock reading to the offset that applies to it.
 *
 * WHY THIS IS NOT A ONE-LINER. The obvious implementation — read the zone's
 * offset "at" the wall-clock value interpreted as UTC — is wrong, and wrong in
 * the worst possible way: silently, by exactly one hour, on perfectly ordinary
 * birth times. It asks for the offset at an instant that is |offset| hours away
 * from the real one, so any DST transition inside that gap lands on the wrong
 * side. A sweep of 15-minute wall clocks over 1975/1990/2005/2026
 * (`scripts/audit-timezone-offsets.mjs`) put the damage at 8 h/year of REAL
 * local time for America/New_York, 21 h/year for Australia/Sydney and
 * 26.5 h/year for Pacific/Chatham — scaling with |offset| and always by a full
 * 60 minutes. Those are wall clocks that genuinely occurred; disagreements on
 * non-existent times are counted separately, since there neither answer is
 * right. Every one of them silently produced a chart for the wrong hour.
 *
 * The correct algorithm brackets the wall clock by a day on each side, which is
 * wider than any transition, and then tests each candidate offset for
 * self-consistency: an offset is valid for this wall clock only if the instant
 * it implies reads back as that same wall clock.
 *
 * Disambiguation follows Temporal's `compatible` mode, which is also what
 * `new Date(y, m, d, …)` does, so the rule matches what every other tool in the
 * stack already assumes:
 *   - ambiguous (fall-back): take the FIRST occurrence, i.e. the pre-transition
 *     offset (still DST).
 *   - gap (spring-forward): also take the pre-transition offset, which shifts
 *     the resulting instant forward past the gap.
 * Both cases reduce to "use the offset in effect before the transition."
 */
export function resolveLocalTime(local: ParsedDateTime, timeZone: string): ResolvedLocalTime {
  const wall = wallClockMs(local);

  // A day either side brackets any real transition; no zone transitions twice
  // within 24 hours.
  const offsetBefore = offsetAtInstant(wall - DAY_MS, timeZone);
  const offsetAfter = offsetAtInstant(wall + DAY_MS, timeZone);

  if (offsetBefore === offsetAfter) {
    return { offsetMinutes: offsetBefore, kind: "unique" };
  }

  // An offset is valid for this wall clock only if it round-trips.
  const validBefore = wallClockMsAtInstant(wall - offsetBefore * 60_000, timeZone) === wall;
  const validAfter = wallClockMsAtInstant(wall - offsetAfter * 60_000, timeZone) === wall;

  if (validBefore && validAfter) return { offsetMinutes: offsetBefore, kind: "ambiguous" };
  if (validBefore) return { offsetMinutes: offsetBefore, kind: "unique" };
  if (validAfter) return { offsetMinutes: offsetAfter, kind: "unique" };
  return { offsetMinutes: offsetBefore, kind: "gap" };
}

/**
 * Offset (minutes east of UTC) the named timezone applied at the given
 * wall-clock reading. E.g. America/New_York on 1980-07-15T14:30:00 → -240.
 *
 * Ambiguous and non-existent readings resolve per `resolveLocalTime`; call that
 * directly when you need to know which case you are in.
 */
export function timezoneOffsetMinutes(local: ParsedDateTime, timeZone: string): number {
  return resolveLocalTime(local, timeZone).offsetMinutes;
}

/** Convert local wall-clock + IANA timezone → UTC parsed datetime. */
export function toUTC(local: ParsedDateTime, timeZone: string): ParsedDateTime {
  return toUTCResolved(local, timeZone).utc;
}

/** As `toUTC`, but also reports how the wall clock mapped onto the timeline. */
export function toUTCResolved(
  local: ParsedDateTime,
  timeZone: string
): { utc: ParsedDateTime; offsetMinutes: number; kind: LocalTimeKind } {
  const { offsetMinutes, kind } = resolveLocalTime(local, timeZone);
  const d = new Date(wallClockMs(local) - offsetMinutes * 60_000);
  return {
    utc: {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      hour: d.getUTCHours(),
      minute: d.getUTCMinutes(),
      second: d.getUTCSeconds() + d.getUTCMilliseconds() / 1000,
    },
    offsetMinutes,
    kind,
  };
}

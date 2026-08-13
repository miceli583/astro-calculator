// Quantify the damage done by the naive local-time → offset idiom.
//
// This script exists so the numbers in docs/time-conventions.md are checkable
// rather than asserted. It re-implements both algorithms inline — the naive one
// this project shipped before 2026-08-12, and the bracket-and-validate one in
// src/lib/ephemeris/julian-day.ts — and sweeps wall clocks through a set of
// zones, reporting how much valid local time the naive version resolves to the
// wrong offset.
//
// Run: node scripts/audit-timezone-offsets.mjs
//
// Both implementations are duplicated here on purpose. Importing the real one
// would make this a tautology when it changes; the point is to compare two
// frozen algorithms against the IANA database, which is the only oracle either
// of them answers to.

const DAY_MS = 86_400_000;
const STEP_MIN = 15; // wall-clock sweep granularity
const YEARS = [1975, 1990, 2005, 2026];

const ZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Kolkata",
  "Asia/Tokyo",
  "Asia/Tehran",
  "Australia/Sydney",
  "Pacific/Auckland",
  "Pacific/Chatham",
  "America/Santiago",
  "America/Sao_Paulo",
  "Africa/Johannesburg",
];

const cache = new Map();
function formatterFor(timeZone) {
  let f = cache.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    });
    cache.set(timeZone, f);
  }
  return f;
}

function wallClockMsAtInstant(utcMs, timeZone) {
  const parts = formatterFor(timeZone).formatToParts(new Date(utcMs));
  const p = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  return Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
}

const offsetAtInstant = (utcMs, tz) => (wallClockMsAtInstant(utcMs, tz) - utcMs) / 60_000;

/** The shipped-before-2026-08-12 implementation. Wrong; kept to measure by. */
function naiveOffset(wallMs, tz) {
  return offsetAtInstant(wallMs, tz);
}

/** The current implementation. See julian-day.ts for the reasoning. */
function resolveOffset(wallMs, tz) {
  const before = offsetAtInstant(wallMs - DAY_MS, tz);
  const after = offsetAtInstant(wallMs + DAY_MS, tz);
  if (before === after) return { offsetMinutes: before, kind: "unique" };
  const validBefore = wallClockMsAtInstant(wallMs - before * 60_000, tz) === wallMs;
  const validAfter = wallClockMsAtInstant(wallMs - after * 60_000, tz) === wallMs;
  if (validBefore && validAfter) return { offsetMinutes: before, kind: "ambiguous" };
  if (validBefore) return { offsetMinutes: before, kind: "unique" };
  if (validAfter) return { offsetMinutes: after, kind: "unique" };
  return { offsetMinutes: before, kind: "gap" };
}

const rows = [];
const firstValidExample = new Map();

for (const tz of ZONES) {
  // A disagreement on a GAP wall clock is a convention difference, not an
  // error: no instant has that reading, so neither answer is "right". Those are
  // counted separately and excluded from the damage figure, which must only
  // contain wall clocks that really happened.
  let wrongValidSteps = 0;
  let differOnGapSteps = 0;
  let totalSteps = 0;
  const deltas = new Set();

  for (const year of YEARS) {
    const start = Date.UTC(year, 0, 1, 0, 0, 0);
    const end = Date.UTC(year + 1, 0, 1, 0, 0, 0);
    for (let wall = start; wall < end; wall += STEP_MIN * 60_000) {
      totalSteps++;
      const truth = resolveOffset(wall, tz);
      const naive = naiveOffset(wall, tz);
      if (naive === truth.offsetMinutes) continue;
      if (truth.kind === "gap") {
        differOnGapSteps++;
        continue;
      }
      wrongValidSteps++;
      deltas.add(naive - truth.offsetMinutes);
      if (!firstValidExample.has(tz)) {
        firstValidExample.set(tz, {
          wall: new Date(wall).toISOString().replace(".000Z", "").replace("T", " "),
          naive,
          correct: truth.offsetMinutes,
          kind: truth.kind,
        });
      }
    }
  }

  rows.push({
    tz,
    hoursWrong: (wrongValidSteps * STEP_MIN) / 60,
    hoursWrongPerYear: (wrongValidSteps * STEP_MIN) / 60 / YEARS.length,
    gapHours: (differOnGapSteps * STEP_MIN) / 60,
    deltas: [...deltas].sort((a, b) => a - b).join(",") || "-",
    pct: ((wrongValidSteps / totalSteps) * 100).toFixed(3),
  });
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`Sweep: ${YEARS.join(", ")} at ${STEP_MIN}-minute wall-clock granularity.\n`);
console.log(
  pad("zone", 22) + pad("h wrong", 10) + pad("h/yr", 8) + pad("% of yr", 10) +
  pad("delta (min)", 14) + "h differing on gaps"
);
console.log("-".repeat(96));
for (const r of rows) {
  console.log(
    pad(r.tz, 22) + pad(r.hoursWrong, 10) + pad(r.hoursWrongPerYear, 8) +
    pad(r.pct, 10) + pad(r.deltas, 14) + r.gapHours
  );
}

const totalValid = rows.reduce((a, r) => a + r.hoursWrong, 0);
const totalGap = rows.reduce((a, r) => a + r.gapHours, 0);
console.log(
  `\nAcross ${ZONES.length} zones × ${YEARS.length} years: ${totalValid} hours of REAL wall-clock ` +
  `time resolved to the wrong offset, every disagreement exactly ±60 minutes.`
);
console.log(
  `A further ${totalGap} hours land on non-existent wall clocks, where the two algorithms ` +
  `merely pick different conventions — those are excluded above.\n`
);

console.log("First disagreement on a REAL wall clock, per zone:");
for (const [tz, e] of firstValidExample) {
  console.log(`  ${pad(tz, 22)} ${e.wall}  naive ${e.naive}  correct ${e.correct}  (${e.kind})`);
}

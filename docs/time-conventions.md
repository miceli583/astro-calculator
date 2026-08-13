# Time Conventions

**Status:** Normative. Every endpoint that accepts `datetime` + `timezone` obeys this document.
**Scope:** Local wall clock → UTC → Julian Day. Everything upstream of the ephemeris.
**Implementation:** `src/lib/ephemeris/julian-day.ts`, `src/lib/ephemeris/client.ts`
**Tests:** `tests/time-layer.test.ts` (L0 tier — 64 tests, no astronomical oracle required)

---

## 0. Why this layer gets its own document

An error here does not produce a broken chart. It produces a **valid chart for a
different moment** — internally consistent, correctly formatted, and wrong. It is
the only defect class in this calculator that cannot be spotted by looking at the
output.

It is also the layer where accuracy claims get made and lost. Every comparison
against an external ephemeris downstream is a comparison of *this layer's answer*
plus the ephemeris; if the UT is off by an hour, the Moon disagrees by ~30′ and
the discrepancy looks exactly like an ephemeris problem. So this tier is tested
first, independently, and against sources that are not the Swiss Ephemeris.

---

## 1. Input contract

| Field | Form | Meaning |
|---|---|---|
| `datetime` | `YYYY-MM-DDTHH:mm[:ss]` | **Local wall clock at the place of birth.** No offset, no `Z`. |
| `timezone` | IANA identifier (`America/New_York`) | The zone that wall clock was read in. |
| `latitude` / `longitude` | decimal degrees | Place. Does **not** influence the time conversion. |

Two consequences worth stating plainly:

- **A UTC offset is never accepted as input.** `+05:30` does not identify a zone
  and cannot resolve DST or historical rule changes. The IANA identifier is the
  only thing that carries the rule history.
- **Longitude does not set the clock.** For dates before a zone adopted standard
  time, the IANA database already encodes Local Mean Time to the second (see §4);
  we do not compute LMT from longitude ourselves.

Offsets are resolved from the platform's IANA tz database via `Intl`. No
timezone library is bundled. The database is therefore whatever the deployed
Node runtime carries, which is the same source Astrodienst and the tz-aware
tooling ecosystem use.

---

## 2. Resolving a wall clock to an offset

**The rule:** an offset is valid for a wall-clock reading only if the instant it
implies reads back as that same wall clock.

```
offsetBefore = offset in effect 24 h before   (wall clock read as UTC)
offsetAfter  = offset in effect 24 h after
if equal                      → unique, use it
else test each for round-trip:
  both valid                  → ambiguous  (fall-back; two instants match)
  exactly one valid           → unique     (an ordinary transition-adjacent time)
  neither valid               → gap        (spring-forward; no instant matches)
```

A day either side brackets any real transition — no zone shifts twice within 24
hours — so the two candidates are exhaustive.

### 2.1 What this replaced, and what it was costing

The obvious implementation is a one-liner: ask the zone for its offset "at" the
wall-clock value interpreted as UTC. That is what this project shipped until
2026-08-12, and it is wrong. It queries an instant that is `|offset|` hours away
from the real one, so **any DST transition inside that window lands on the wrong
side** — silently, by exactly one hour, on perfectly ordinary birth times.

`scripts/audit-timezone-offsets.mjs` re-implements both algorithms and sweeps
15-minute wall clocks across 15 zones × 1975/1990/2005/2026. Hours of **real**
local time resolved to the wrong offset, per year:

| Zone | h/yr wrong | Zone | h/yr wrong |
|---|---|---|---|
| Pacific/Chatham | 26.5 | Europe/Berlin, Europe/Paris | 2.25 |
| Pacific/Auckland | 25 | Asia/Tehran | 2 |
| Australia/Sydney | 21 | America/Sao_Paulo | 2 |
| America/Los_Angeles | 14 | Europe/London | 1 |
| America/Chicago | 10 | Asia/Kolkata, Asia/Tokyo, Africa/Johannesburg | 0 |
| America/New_York | 8 | | |

Three properties of that table matter more than its size:

1. **The error scales with `|offset|`,** which is why the damage is worst in the
   Pacific and nil in the zero-offset and no-DST zones. It is a structural
   property of the wrong query, not a tz-database quirk.
2. **Every disagreement is exactly ±60 minutes.** Nothing rounds; charts are
   whole-hour wrong or right.
3. **The affected wall clocks genuinely occurred.** Disagreements on *non-existent*
   times are excluded from the table (23 h across the whole sweep) because there
   neither algorithm is "right" — that is a convention choice, covered in §3.

Ten rows of `tests/time-layer.test.ts` are regression cases drawn from this
sweep; reverting to the one-liner fails all of them.

---

## 3. Wall clocks that are not 1:1 with the timeline

Twice a year a DST zone breaks the bijection between wall clocks and instants.
Both cases are **normal input** — people are born during them — so neither is an
error, and neither may be silently normalized away.

**The rule, in both directions: use the offset in effect BEFORE the transition.**

| Case | Example | Resolution | Result |
|---|---|---|---|
| **Gap** (spring forward) | `2026-03-08T02:30` America/New_York | offset −300 (EST, pre-transition) | Instant lands at 03:30 EDT — one hour past the gap |
| **Ambiguous** (fall back) | `2026-11-01T01:30` America/New_York | offset −240 (EDT, pre-transition) | The **first** of the two occurrences |

This is Temporal's `compatible` disambiguation, and also what `new Date(y, m, d, …)`
does. It was chosen because it is what the rest of the ecosystem already assumes,
not because it is astronomically privileged — for an ambiguous birth time there
is no privileged answer, only a disclosed one.

### 3.1 Disclosure is mandatory

A chart cast from a gap or ambiguous reading is **defensible but not uniquely
determined by its input.** Both cases therefore emit a `warnings` entry naming the
convention applied and what to check:

- gap → *"Local time … does not exist in …: it falls inside an hour skipped by a
  daylight-saving transition. The chart was cast one hour later, past the gap.
  Verify the recorded birth time."*
- ambiguous → *"Local time … occurs twice in … The chart was cast for the FIRST
  occurrence (daylight time); the second is one hour later and gives a different
  chart."*

Callers needing the resolution programmatically use `julianDayUTResolved()`,
which returns `{ jd, utc, offsetMinutes, kind }` with `kind ∈ {unique, gap, ambiguous}`.

---

## 4. Pre-standard-time dates

Before a zone adopted standard time its offset is Local Mean Time — a
longitude-derived value that is **not a whole number of minutes**:

| Zone | Date | Offset |
|---|---|---|
| Europe/Paris | 1890 | +00:09:21 (Paris Mean Time) |
| America/New_York | 1883-11-17 | −04:56:02 (LMT) |
| America/New_York | 1883-11-19 | −05:00:00 (standard time, two days later) |

These come from the IANA database and are used to the second. Rounding LMT to
whole minutes would be a real error in the resulting angles, so the offset is
carried as a fractional-minute value throughout, and the tests assert it to
6 decimal places rather than to the minute.

**Limit:** the tz database's pre-1900 entries are LMT approximations, and for
much of the world the recorded *local* time of a pre-1900 birth is itself
uncertain by more than the ephemeris error. This layer is exact with respect to
the database; the database is not exact with respect to history.

---

## 5. UTC → Julian Day

Julian Day is computed by `sweph.utc_to_jd(…, SE_GREG_CAL)`, and we take **index
1 of its result — JD(UT1)**, not index 0 (JD(TT)/ET). UT1 is the correct time
argument for rotation-dependent quantities (houses, angles, sidereal time), which
is what the chart is built on.

### 5.1 The independent reference

sweph is the thing under test, so it cannot also be the reference. `tests/time-layer.test.ts`
contains a hand-written second implementation of **Meeus (1998) ch. 7**,
Gregorian branch, and asserts sweph's JD against it.

**Tolerance: `JD_TOL_DAYS = 1.1e-5` (≈ 0.95 s).** This is not a number chosen to
make a test pass. Meeus computes JD(UTC); sweph returns JD(UT1). The two differ
by (UT1 − UTC), which leap seconds keep below 0.9 s = 1.04e-5 day by definition.
The tolerance is that physical bound plus rounding headroom. **Any disagreement
larger than this is a real defect in the conversion path, not a tolerance
problem** — the correct response is to investigate, never to widen the constant.

Anchors asserted exactly: JD 2451545.0 = 2000-01-01T12:00 UTC (J2000.0), and
JD 2440587.5 = 1970-01-01T00:00 UTC (the Unix epoch).

### 5.2 Calendar

Gregorian throughout (`SE_GREG_CAL`), including for dates before the 1582
adoption, where it is proleptic. Julian-calendar input is not accepted; a user
with a Julian-calendar date must convert before calling. The tz database's own
pre-1582 entries are LMT, so §4's limits apply with more force.

### 5.3 Leap seconds

Handled inside sweph, which carries its own leap-second table for the UTC→JD
step. A wall clock *labelled* with a leap second (`23:59:60`) is rejected at
parse time — see §5.4. That is a documented limitation with no practical
consequence: no birth record has ever been written that way.

### 5.4 Calendar ranges are validated, not normalized

`Date.UTC` rolls out-of-range components over without complaint, so a date that
does not exist used to produce a complete, confident chart for a different date:

| Input | Silently became | Now |
|---|---|---|
| `2026-02-30T12:00` | 2026-03-02T12:00 | rejected |
| `1900-02-29T12:00` | 1900-03-01T12:00 | rejected (1900 is not a leap year) |
| `2026-13-45T25:70` | 2027-02-15T02:10 | rejected |
| `2016-12-31T23:59:60` | 2017-01-01T00:00:00 | rejected |

`parseLocalISO` now range-checks month, day (against the true length of that
month, Gregorian leap rules included), hour, minute and second, and throws a
message beginning `Invalid datetime` — which `handleCalculatorError` maps to
**HTTP 422** with the standard error envelope. This is the same failure class as
a wrong offset (a valid chart for a moment nobody asked about, with nothing in
the response to say so) and is fixed at the same choke point, so every endpoint
inherits it.

---

## 6. What this layer guarantees, and what it does not

**Guaranteed**

- The offset applied is the one the IANA database specifies for that wall clock
  in that zone, at whole- and fractional-minute resolution, for every date the
  database covers.
- Gap and ambiguous readings are resolved by the stated rule and always disclosed.
- The resulting JD agrees with an independent Meeus implementation to within the
  UT1−UTC bound.

**Not guaranteed**

- That the *recorded* birth time is the true one. Rounded, misremembered, and
  hospital-clock times dominate real-world error and are invisible here.
- That the tz database's pre-1900 LMT entries reflect what a local clock actually
  read.
- Anything about leap-second-labelled input, which is rejected.

---

## 7. Test tiers

| Tier | What it tests | Oracle |
|---|---|---|
| **L0** — this document | wall clock → UT → JD | IANA tz database + hand-written Meeus (1998) |
| **L1** | ephemeris positions | JPL Horizons, frozen to in-repo fixtures |
| **L2** | chart construction conventions | pinned in writing, then compared |
| **L3** | interpretive layers (orbs, patterns, rulerships) | no ground truth; the conventions doc *is* the deliverable |

L0 comes first deliberately: it is cheap, it needs no external service, and an
error here makes every L1 comparison lie in a way that looks like an ephemeris
problem.

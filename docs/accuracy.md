# Accuracy

**Status:** Normative for the L1 tier (ephemeris positions).
**Companion:** [`time-conventions.md`](./time-conventions.md) covers L0 (wall clock → UT → JD).
**Tests:** `tests/ephemeris-horizons.test.ts` · **Fixtures:** `tests/fixtures/horizons/`
**Harvest:** `npm run accuracy:harvest` · **Residual report:** `npm run accuracy:residuals`

---

## 0. What "accurate" means here, and what it cannot mean

This calculator has four layers, and only two of them have a ground truth:

| Tier | What it computes | Oracle | Verifiable? |
|---|---|---|---|
| **L0** | wall clock → UT → JD | IANA tz database, Meeus (1998) ch. 7 | Yes — see `time-conventions.md` |
| **L1** | ephemeris positions | **JPL Horizons** | Yes — this document |
| **L2** | chart construction (houses, angles) | the **defining geometry** of each system, pinned first | Yes — see `chart-conventions.md` |
| **L3** | interpretation (orbs, patterns, rulerships) | none exists | No — see `aspect-conventions.md`; the doc *is* the deliverable |

A comparison against another astrology site is **consistency**, never verification:
that site has the same four layers and the same freedom in L2 and L3. Nothing in
this repository treats agreement with such a site as evidence of correctness, and
none was used to derive any number here.

L1 is the layer where an actual external authority exists, so it is tested
against one: NASA/JPL's Horizons service, which serves the DE441 planetary
ephemeris and the current small-body solutions.

---

## 1. The oracle

**JPL Horizons** (`https://ssd.jpl.nasa.gov/api/horizons.api`), geocentric
(`CENTER='500@399'`), ecliptic reference plane, ICRF reference system,
apparent positions (light-time + stellar aberration).

**Responses are frozen into `tests/fixtures/horizons/*.json` and committed.**
The test suite reads only those files. **No CI job may depend on a live
third-party API** — a suite whose result depends on someone else's uptime does
not report on this codebase. Re-harvesting is a manual, deliberate act:

```bash
npm run accuracy:harvest              # fetch only charts with no fixture yet
npm run accuracy:harvest -- --force   # re-fetch everything
```

`scripts/harvest-horizons.mjs` carries a header block of Horizons API quirks
discovered the hard way (parameters need literal single quotes; `OBJ_DATA='NO'`
returns HTTP 500; see §3.2). Read it before touching the request shapes.

---

## 2. The charts, and why these

Twenty charts, chosen because each is hostile in a specific way. Ordinary,
well-behaved birth data is already covered by the existing reference fixtures
(Astrodienst-anchored) and adding more of it would buy nothing.

| Axis | Charts |
|---|---|
| **Southern hemisphere** | Mandela 1918 (Mvezo), Sydney 1985 (DST in January — reversed seasonal sense), Ushuaia 1980 (−54.8°), Santiago 1974 (southern DST edge) |
| **High latitude** | Tromsø 1975 (69.65 °N), Longyearbyen 1990 (78.22 °N, winter solstice), Reykjavík 1962 (64.15 °N) |
| **Deep time** | Paris 1750, Boston 1799, New York 1883-11-17 (last day of LMT), Vienna 1899, London 1950 |
| **Misbehaving clocks** | New York 2005 birth *inside* the skipped hour; one minute before the same gap; the fall-back hour that occurs twice; Lisbon 1992 transition day |
| **Fractional-hour zones** | Kolkata +05:30, Kathmandu +05:45, Chatham +13:45, Kiritimati +14:00 (local date leads UTC by a day) |

The fixture set is itself asserted: `tests/ephemeris-horizons.test.ts` fails if
the count drops below 20, if the epoch span narrows, if both hemispheres and a
sub-polar latitude in each are not present, or if the gap/ambiguous/fractional
cases disappear. Coverage cannot be quietly reduced to make a run green.

### 2.1 High latitude is an L1 non-event

Planetary positions are geocentric and do not depend on the observer's latitude
at all. Tromsø and Longyearbyen are in this set because their *clocks* and their
*house geometry* are hostile, not their ephemeris. **The degeneracy of quadrant
house systems near the poles is an L2 concern**, and where a house system is
undefined at a latitude that is a documented limitation, not a failing test.

---

## 3. What is compared, and how ΔT is kept out of it

Two independent comparisons run against every chart.

### 3.1 J2000 frame — the ephemeris in isolation

`EPHEM_TYPE='VECTORS'`, `REF_PLANE='ECLIPTIC'`, `REF_SYSTEM='ICRF'`,
`VEC_CORR='LT+S'`, evaluated at **JD(TT)** interpreted as TDB; compared against
`swe.calc(jd_tt, body, SEFLG_SWIEPH | SEFLG_SPEED | SEFLG_J2000 | SEFLG_NOGDEFL)`.

**`SEFLG_NOGDEFL` is required here, and finding that out is what this comparison
was for.** Horizons' `VEC_CORR='LT+S'` applies light-time and stellar aberration
but *not* relativistic light deflection by the Sun; sweph applies deflection by
default. Leaving it enabled compares two different physical models. The term is
~0.004″ at ordinary elongations — invisible, and it hid here for exactly that
reason — but it grows as 1/elongation and reaches ~1.75″ at the solar limb.

It surfaced as a 1.5051″ Jupiter latitude residual at Sydney 1985, which turned
out to be Jupiter 0.27° from the Sun. Adding `SEFLG_NOGDEFL` collapses that
residual to 0.0419″, i.e. to the same floor as every other body.

The term is therefore **not** left untested. It is verified positively against
the of-date comparison, whose Horizons OBSERVER tables *do* include deflection,
and the suite asserts the disagreement in both directions:

| Comparison | sweph with deflection | sweph with `NOGDEFL` |
|---|---|---|
| vs Horizons OBSERVER (of date) | **0.0424″** ✓ | 1.4209″ ✗ |
| vs Horizons VECTORS (J2000) | 1.5051″ ✗ | **0.0419″** ✓ |

Both rows are asserted. A change to sweph's deflection handling breaks one, and
a change to the harvest's correction model breaks the other.

Both sides are evaluated at the *same* time argument in the *same* non-rotating
frame. **ΔT therefore cancels exactly and contributes nothing to the residual**,
and neither does any precession or nutation model. What is left is the ephemeris
and nothing else. (ΔT is not thereby exempt from testing — it is checked in L0,
where `utc_to_jd` returns both JD(TT) and JD(UT1) and their difference is
asserted against the expected value.)

The state vector also gives distance, which is asserted as well: a light-time or
centre mismatch can leave longitude nearly right while distance is visibly wrong
(confusing the geocentre with the Earth–Moon barycentre displaces a body by
~3 × 10⁻⁵ AU). Distance does **not** get its own tolerance. The radial residual
is expressed as the angle it subtends at that body's own distance and held to
the **same** per-body bound as the transverse residual, so "the two ephemerides
agree to X arcseconds" means one thing in all three components. Measured worst
case, converted that way: 0.0433″ for the major planets, 0.0915″ for Pluto,
0.1743″ for Chiron — and 0.0026″ for the Moon, whose distance agrees to 4.6 m.

### 3.2 Ecliptic of date — precession and nutation

`EPHEM_TYPE='OBSERVER'`, `QUANTITIES='31'` (ObsEcLon/ObsEcLat, referred to the
true ecliptic and equinox of date), `TIME_TYPE='TT'`; compared against
`swe.calc(jd_tt, body, SEFLG_SWIEPH | SEFLG_SPEED)` — the flag set the API
itself uses. This is the comparison that exercises the numbers we actually
publish.

**Documented limitation — five bodies are missing from this comparison.**
Horizons returns the object header and *no ephemeris block* for
`QUANTITIES='31'` for COMMAND `10` (Sun), `199` (Mercury), `299` (Venus), `301`
(Moon) and `399` (Earth). This is reproducible, not transient, and was bisected
across centres, time formats, quantity sets and output formats before being
accepted. The of-date comparison therefore covers **Mars outward, plus Chiron**
— seven bodies.

This is a real gap and is stated rather than papered over. What limits it: the
frame rotation from J2000 to the equinox of date is **one code path applied to
every body**, not a per-body calculation. Validating it on seven bodies spanning
1.5 to 40 AU and −2.4° to +11° of ecliptic latitude constrains that rotation to
the tolerance below; the inner bodies then ride on the same rotation, with their
underlying positions independently confirmed by §3.1.

---

## 4. The lunar nodes need their own treatment

**Horizons has no lunar-node body.** A node is not an object; it is a property
of an orbit, and the two nodes this API publishes are two different conventions
for extracting it. Each therefore gets its own oracle, and only one of them can
be adjudicated by an ephemeris at all.

**Osculating node** — the ascending node of the instantaneous geocentric lunar
orbit, computed here from **sweph's own state vector** as the direction of
h = r × v, and compared against Horizons `EPHEM_TYPE='ELEMENTS'`, element `OM`
(J2000 ecliptic). This direction depends on nothing but r and v — not on GM, not
on the epoch of osculation, not on any element convention — so both sides mean
exactly the same thing and the only differing input is the lunar state vector.
Horizons' `OM` was checked against its own r × v before being trusted here, and
reproduces it to 0.00″.

This is the only place in the tier that tests the lunar **velocity**: positions
are compared everywhere, but nothing else looks at the rate. Measured residual
≤ 1.6″ across the Swiss Ephemeris era.

**`SE_TRUE_NODE` is a different quantity, and Horizons is not its oracle.**

> **Corrected premise.** This document previously asserted that `SE_TRUE_NODE`
> and the osculating node "mean the same thing" and differ only by reduction,
> and set a 3″ tolerance on that basis. **That was wrong.** Measured against the
> osculating node, `SE_TRUE_NODE` differs by 0.6″ near J2000, 38″ by 1990, 372″
> by 1883 and **1285″ (0.36°) by 1750** — oscillating in sign, with an envelope
> that grows away from J2000. Since the osculating node is independently
> reproduced from sweph's own state vector to ≤1.6″, the lunar ephemeris is not
> the cause: `SE_TRUE_NODE` simply computes something else.

This is **not** a defect and is not being changed. `SE_TRUE_NODE` is the true
node as the Swiss Ephemeris defines it, and therefore as essentially every
astrology program built on it reports it; matching that is the correct behaviour
for this API, and pointing an ephemeris test at it would be a category error.
What the suite asserts instead is that the convention does not silently drift:
the offset from the osculating node must stay inside a documented envelope of
6″ per year from J2000 plus 5″. The tightest observed margin is 85% of that
envelope, so it is a live constraint, not slack.

**Mean node** — *not observable.* It is a mean-element convention, so Horizons
is not an authority on it and pointing a test at Horizons here would be
theatre. The reference is an independent implementation of **Meeus (1998)
ch. 47**, which is referred to the *mean* equinox of date — hence the comparison
uses `SEFLG_NONUT`. The two are different truncations of the same ELP-derived
theory, so the residual grows with distance from J2000.

---

## 5. Tolerances, and the reason for each

Every tolerance below is derived from an identified property of the two models
being compared. `npm run accuracy:residuals` reports the measured numbers; it is
a reporting tool and deliberately not a gate, because reading residuals in order
to pick a threshold that passes is the thing that makes an accuracy suite
worthless.

**A residual larger than these bounds is an escalation, not a patch.** The
correct response is to investigate the disagreement and report it — never to
widen the constant. The failure message printed by the suite says so.

> **Corrected premise — the J2000 floor.** The first version of this table set
> 0.05″ for the well-determined bodies and justified it as "~50× the ~0.001″
> compression floor, since DE431→DE441 is sub-milliarcsecond for these bodies."
> **The measured floor is ~0.05″, not ~0.001″, so that premise was falsified.**
> The cause was then identified and is *not* ephemeris error — see §5.1.1. The
> bound below was re-derived from that cause; it was not widened to fit the
> data, and the structural test in §5.1.1 constrains the residual far more
> tightly than the flat bound does.

### 5.1 J2000 frame — Swiss Ephemeris era (1800 onward)

| Bodies | Tolerance | Reason |
|---|---|---|
| Sun, Moon, Mercury–Saturn, Neptune | **0.15″** | The measured floor is ~0.05″, of which **0.042″ is a single rotation common to every body** (§5.1.1) and only ~0.005″ RMS is genuine per-body difference. 0.15″ is 3× the raw floor and ~30× the post-rotation residual, still far below the ≥1″ signature of a wrong flag, frame or epoch. |
| Uranus | **0.50″** | Uranus is the one major planet whose residual has clear temporal *structure* — see §5.1.2. It is orbit-fit divergence anchored by spacecraft ranging, and **the suite asserts that structure**, so this bound rests on a tested claim rather than on the observed maximum. |
| Pluto | **0.30″** | The one major body materially revised between DE releases. Its observational arc begins in 1930, so the two integrations diverge most at the early end of this fixture set. |
| Chiron | **5.0″** | A different *kind* of disagreement. Chiron is a small body on a chaotic, planet-crossing orbit; sweph ships a fixed solution baked into `seas_18.se1`, while Horizons serves the current SBDB fit, re-derived as new astrometry arrives. Two independent orbit determinations, not two compressions of one integration, so the residual is solution drift and grows away from the 1977+ observational arc. |

#### 5.1.1 The floor is a frame rotation, not per-body error

The two sides do not use the same numerical value for the obliquity that
*defines* "the ecliptic of J2000": IAU 1976 uses 84381.448″, IAU 2006 uses
84381.406″. The difference is **0.042″**, and a disagreement about the frame
appears as one rotation applied to every body at once.

The suite tests exactly that, and it is the strongest single statement this tier
makes. It fits one small two-parameter rotation across all well-determined
bodies at all modern epochs simultaneously (n = 144 samples):

| | Value | Asserted bound |
|---|---|---|
| Fitted rotation amplitude | **0.04189″** | < 0.10″ |
| Latitude residual RMS before | 0.03048″ | — |
| Latitude residual RMS after | **0.00491″** | < 0.015″ |

The fitted amplitude reproduces the 0.042″ obliquity-constant difference. One
rotation absorbs essentially the entire floor, which is only possible if the
floor *is* a frame-definition difference — a genuine error in any single body's
ephemeris cannot lie on a sinusoid shared with every other body. After it is
removed the two ephemerides agree to **0.005″ RMS**, and that is the real
accuracy claim; the 0.15″ table entry above is merely the per-body backstop.

Removing this degree of freedom by comparing in equatorial ICRF instead was
tried and rejected: it improves some bodies and worsens others, because sweph's
J2000 is the mean equinox of J2000 rather than ICRF, which leaves the ~0.023″
frame bias behind. There is no comparison that has zero frame convention in it,
so the honest move is to measure the convention and state it.

#### 5.1.2 Uranus: the residual is pinned to the Voyager 2 encounter

The Uranus residual is not noise and it is not a monotone drift. It is a **V**,
and the floor of the V sits on 1986:

| Epoch | 1883 | 1918 | 1950 | 1962 | 1972 | **1980–85** | 1990 | 1999 | 2005 |
|---|---|---|---|---|---|---|---|---|---|
| Residual | 0.402″ | 0.356″ | 0.204″ | 0.089″ | 0.022″ | **≤0.003″** | 0.010″ | 0.031″ | 0.039″ |

Voyager 2 passed Uranus on **1986-01-24** — the only spacecraft ranging this
planet has ever had, and by far the strongest constraint on its orbit. Two
independent determinations of that orbit are pinned together where the data is
strongest and separate away from it in *both* directions, which is exactly the
shape above.

This is worth stating carefully because the prediction is fixed by an **external
date, not by fitting this data**. Rank-correlating |epoch − encounter| against
the residual gives **ρ = 0.967**; anchoring instead at 1980 gives 0.927, at 1990
gives 0.796, and at 2000 gives 0.377. The best fit lands on the encounter
without being told where it is, and the suite asserts ρ > 0.85 against the
externally fixed date.

The practical consequence: Uranus's 0.50″ bound is a statement about *historical*
charts. Near the encounter the two ephemerides agree to ~0.001″, and even in
2005 to 0.039″.

> **Corrected premise.** An earlier draft of this section claimed the Uranus
> residual "declines monotonically toward the present". It does not — it rises
> again after ~1986, and a monotonicity test against epoch scores only
> ρ = −0.38. The monotone reading came from looking at pre-1985 charts alone.
> The V is the real structure and has a specific physical cause.

### 5.2 J2000 frame — Moshier era (before 1800)

> **Corrected premise — the pre-1800 residuals.** These were originally going to
> be attributed to "18th-century DE-release divergence." **That is wrong.** This
> deployment ships only the 1800–2399 Swiss Ephemeris data files, so below 1800
> **sweph silently substitutes its built-in Moshier analytic ephemeris** — the
> returned flag has `SEFLG_MOSEPH` set, which the suite now asserts explicitly.
> The pre-1800 comparison is Moshier-vs-DE441 and says nothing whatever about
> Swiss Ephemeris accuracy. The `ephemeris` field on every response names
> which of the two answered — see finding **F1** in §6.

| Bodies | Tolerance | Reason |
|---|---|---|
| Moon | **2.0″** | Moshier is a truncated analytic theory; the lunar theory carries the largest truncated terms. Measured 1.10″. |
| Sun, planets | **1.0″** | Moshier's documented agreement with the DE series is of order an arcsecond. Measured worst 0.45″ (Jupiter, 1750). |
| Chiron | *no ephemeris at all* | `seas_12.se1` is not shipped and there is no analytic fallback for asteroids, so sweph **refuses** (`flag < 0`) rather than degrading. The suite pins the refusal, because a refusal is the one outcome a positional tolerance can never notice. Finding **F2** in §6. |

These bounds describe **Moshier**, not the Swiss Ephemeris, and must not be
quoted as an accuracy figure for this API's normal operating range.

### 5.3 Ecliptic of date

The of-date comparison adds the rotation from J2000 to the true equinox and
ecliptic of date, and **the two sides do not use the same models**: sweph
defaults to IAU 2006 precession (Vondrák 2011 far from J2000) with IAU 2000B
nutation, while Horizons' ecliptic-of-date quantities use the IAU 1976/1980
pair. These are successive conventions, not right and wrong answers, and their
spread *is* the tolerance.

The of-date residual necessarily **contains** the J2000 one — a frame rotation
does not remove an ephemeris difference — so these bounds are *derived* rather
than restated: `model spread + that body's J2000 bound for that era`.

| Component | Value | Reason |
|---|---|---|
| Precession/nutation model spread | **1.0″** | IAU 1976 vs IAU 2006 precession agree to well under 0.1″ near J2000 and diverge roughly quadratically — a few tenths of an arcsecond at ±250 yr, this set's span. IAU 1980 vs IAU 2000B nutation adds ~0.03″. 1.0″ covers both with headroom and is still 20× tighter than the finest thing a chart resolves. |
| Per-body term | §5.1 or §5.2 | Whichever era the chart falls in. |

Worked examples: Mars–Neptune in the Swiss era get 1.15″ (measured worst 0.33″);
Uranus 1.50″ (measured 0.68″); Chiron 6.0″ (measured 0.52″); Saturn in the
Moshier era 2.0″ (measured 0.96″).

### 5.4 Nodes

| Quantity | Tolerance | Reason |
|---|---|---|
| Osculating node (Swiss era) | **3.0″** | Both sides are the direction of r × v, so the definitions are identical and the only differing input is the lunar state vector. The node amplifies velocity differences, so this is looser than the Moon's own 0.15″ positional bound. Measured worst 1.58″. |
| Osculating node (Moshier era) | **40″** | Same quantity, but the Moon comes from Moshier (§5.2), whose velocity error the node amplifies in the same way. Measured worst 24.8″. |
| `SE_TRUE_NODE` | envelope **6″/yr from J2000 + 5″** | Not an accuracy bound. `SE_TRUE_NODE` is a *convention* and Horizons is not its oracle (§4); this pins the convention so it cannot drift silently. Tightest observed margin 85% of the envelope. |
| Mean node | **1.0″** | Two truncations of the same mean-element theory; the residual grows with \|T\| and reaches a few tenths of an arcsecond at the ends of this span. **Measured worst 0.19″ — this one checks out cleanly.** |

---

## 6. Findings

Building this tier turned up four things. **None of them was fixed by adjusting
a tolerance.** F1 and F2 were live defects when first written up; both were
fixed on 2026-08-13 and the write-ups below record the diagnosis, the chosen
disposition, and the reason the other options were declined.

### F1 — every birth date before 1800 returned a 500 (fixed 2026-08-13)

`src/lib/ephemeris/client.ts` treats sweph's `error` field as fatal:

```ts
const out = swe.calc_ut(jdUt, id, SE_FLAGS);
if ("error" in out && out.error) {
  throw new Error(`Ephemeris error for ${planet}: ${out.error}`);
}
```

But sweph uses that field for **warnings** as well as errors, and signals real
failure through `flag < 0`. Below 1800 there is no data file, so sweph falls
back to Moshier and reports the *warning*
`SwissEph file 'sepl_12.se1' not found in PATH ... using Moshier eph.` — which
this code raises as an exception. Verified end to end through the exported
`calcPlanet`:

```
1799 Boston: THROWS -> Ephemeris error for sun: SwissEph file 'sepl_12.se1' not found ...
1883 NYC:    OK  sun lon=234.868262
1950 London: OK  sun lon=82.987053
```

Charts from 1800 onward were unaffected. Three dispositions were available:

1. Ship `sepl_12.se1` / `semo_12.se1` / `seas_12.se1` (already available behind
   `EPHE_RANGE=full` in `scripts/download-ephemeris.mjs`) — extends real Swiss
   Ephemeris coverage back to 1200 CE at ~10 MB of bundle.
2. Gate on `flag < 0` instead of `error`, and surface the Moshier fallback in
   the response — pre-1800 charts then work at Moshier accuracy (§5.2) rather
   than 500ing, and the degradation is visible to the caller.
3. Return a documented 4xx with an explicit supported range.

**Chosen: (2).** (1) buys Swiss-grade precision for a range no caller has asked
for, at a permanent ~10 MB of repo and bundle weight; it can be revisited if one
does. (3) turns a computable chart into an error, which is strictly worse than a
labelled approximation. The objection to (2) is that a silent downgrade is a lie
of omission — so it is not silent: every response that returns positions now
carries **`ephemeris`**, naming the source that actually answered
(`"swiss" | "moshier" | "jpl" | "mixed"`), decoded from sweph's return flag
rather than inferred from the date. `tests/ephemeris-fallback.test.ts` asserts
both directions — a pre-1800 chart must say `"moshier"` and a modern one must
say `"swiss"` — so a fix that hardcoded the label, or that swallowed every
error and always claimed one source, fails.

The fix itself is three lines of semantics: `flag < 0` is failure; a non-empty
`error` alongside a non-negative flag is a warning; the ephemeris bit of the
flag (`SEFLG_SWIEPH = 2`, `SEFLG_MOSEPH = 4`, `SEFLG_JPLEPH = 1`) says which
source answered.

### F2 — Chiron has no ephemeris at all before 1800 (fixed 2026-08-13)

`seas_12.se1` is not shipped and there is no analytic fallback for asteroids, so
sweph **refuses** (`flag < 0`) rather than degrading. This is a genuine refusal,
not a silent fallback, and it survives disposition (2) above — option (1) is the
only one that would make pre-1800 Chiron work. Pinned by the suite, because a
refusal is the one outcome a positional tolerance can never notice.

Before the fix a single refused body took the whole chart down with it. Now the
refusal is reported and the other twelve bodies are returned: charts carry an
optional **`unavailableBodies`** array of `{ name, longitude: null, reason }`,
plus a warning naming the bodies.

This is deliberately *not* F8's convention. F8 omits the Part of Fortune
entirely, because there the caller's own `planets` subset made the omission
self-explanatory. Here the caller asked for Chiron, so silence would be
indistinguishable from "not requested" — a present-but-null entry with a reason
is the honest shape. Same principle in both: never make an absence ambiguous.

Two paths are strict rather than tolerant. Human Design and Gene Keys **throw**
when any body is unavailable, because a partial body set does not produce a
slightly incomplete bodygraph — it produces a structurally different, wrong one.

### F3 — Horizons has no Neptune or Pluto at 1750 and 1799

Requests for COMMAND `899` and `999` at JD 2360306 and 2378479 return HTTP 200
with no `$SOE` block. Recorded in the `notes` field of `paris-1750` and
`boston-1799`, which carry 9 J2000 and 5 of-date bodies instead of 11 and 7. The
suite requires that any body missing from a fixture be accompanied by a note, so
coverage cannot shrink silently. A barycentre fallback (COMMAND `8`/`9`) would
close this at the cost of a centre mismatch; not currently worth it, since the
pre-1800 range is served from Moshier anyway (F1) and is labelled as such.

### F4 — `SE_TRUE_NODE` is not the osculating node

Up to 0.36° apart in the 18th century, oscillating in sign, shrinking to ~0.6″
near J2000. **Not a bug** and deliberately not changed — see §4. It is a
documentation matter: the API's `true_node` is the Swiss Ephemeris convention,
which is what other astrology software reports, and it should not be described
as the osculating node of the lunar orbit.

### Where it checks out

Reporting only the problems would misrepresent the result. The following were
tested and agree, and that is the main outcome of this tier:

- **All eight well-determined bodies, 1800–2005**: agreement to **0.005″ RMS**
  once one shared frame rotation is removed (§5.1.1), with the rotation itself
  matching the known obliquity-constant difference to three decimal places.
- **Radial distances**: within the same per-body angular bound in every case;
  the Moon's geocentric distance agrees to **4.6 m**.
- **Relativistic light deflection**: confirmed present in sweph and correctly
  modelled, verified in both directions against a solar conjunction (§3.1).
- **Mean node vs Meeus ch. 47**: worst residual **0.19″** against a 1.0″ bound.
- **Lunar velocity**, via the osculating node against Horizons `OM`: ≤1.58″.
- **The L0 seam**: every frozen JD re-derives from the real `parseLocalISO` →
  `toUTCResolved` → `swe.utc_to_jd` path, including the gap, ambiguous and
  fractional-offset charts.

## 7. What this tier does not cover

- **Topocentric positions.** Everything here is geocentric. The topocentric flag
  is deferred (see `TODO.md`).
- **Sidereal zodiac / ayanamsa.** Tropical only. An ayanamsa is a convention,
  not an observable, and belongs in L2 when it lands.
- **House cusps, angles, and anything latitude-dependent.** L2 — now landed, see
  `chart-conventions.md`. Two findings there (F5, F6) concern how a correct
  computation is labelled and shaped on the way out at polar latitudes.
- **Aspects, orbs, patterns, rulerships.** L3 — now landed, see
  `aspect-conventions.md`. No ground truth exists at that layer, so the
  conventions document is the deliverable and the tests pin it rather than
  verify it. Five findings there (F7–F11): sect coupled to the requested house
  system, a fabricated Part of Fortune, and three defects on `/api/v1/transit`.
- **Whether the recorded birth time is the true one.** Dominant real-world error
  source, invisible to every tier here.

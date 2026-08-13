# Chart construction conventions (L2)

**Status:** Normative. This document is the specification; the code is required
to match it, not the other way round. Where the implementation departs from a
convention stated here, §7 records a **finding** — the convention is not
amended to describe the bug.

**Companions:** [`time-conventions.md`](./time-conventions.md) (L0, wall clock →
UT → JD) · [`accuracy.md`](./accuracy.md) (L1, ephemeris positions)
**Tests:** `tests/houses-definition.test.ts` · **Charts:** the same twenty
hostile fixtures used by L1, `tests/fixtures/horizons/`

---

## 0. What L2 is, and why the convention has to come first

L2 is everything between a set of planetary longitudes and a chart: the angles
(ASC, MC, Vertex, equatorial ascendant), the twelve house cusps, and the rule
that puts a body in a house.

Given a stated convention this is objective — it is spherical trigonometry on
top of L1. Without one, almost every disagreement between two astrology programs
is a *convention* difference wearing the costume of an error: a different zodiac,
a different sidereal-time definition, a different default house system, a
different rule for a body sitting exactly on a cusp. Comparing first and
explaining afterwards produces an endless supply of false findings.

So the conventions are fixed here first, and the oracle for L2 is **the
definition of each house system**, not another program. That is deliberate:
a second implementation transcribed from a formula table can be transcribed
wrongly, and then its disagreement is indistinguishable from a real defect.
A house system's *defining geometric property* — "this point has traversed a
third of its semi-diurnal arc", "this point lies on the great circle through
the horizon's north point and that equator division" — can be checked directly
against the cusps the calculator returns, with nothing between the definition
and the assertion.

---

## 1. Zodiac and reference frame

| Choice | Value |
|---|---|
| Zodiac | **Tropical.** Longitudes measured from the true equinox of date. |
| Ayanamsa | **None.** Sidereal is not supported (tracked in `TODO.md`). |
| Origin | **Geocentric.** Topocentric is not supported; it would move the Moon by up to ~1°. |
| Positions | Apparent — light-time, aberration, and relativistic deflection applied (`SEFLG_SWIEPH | SEFLG_SPEED`, `SE_FLAGS` in `src/lib/ephemeris/client.ts`). |
| Equinox / obliquity | True of date (nutation included) for both bodies and cusps. |
| House call | `swe_houses_ex(jd_ut, iflag = 0, lat, lon, code)` — `iflag = 0` is the same tropical, of-date frame the bodies use. |

Bodies and cusps are therefore in **one frame**. A chart that mixed a
mean-equinox cusp with an apparent-equinox planet would be wrong by ~17″ in a
way no test comparing only planets could see, so the shared frame is a
convention and not an implementation detail.

---

## 2. Geographic and time inputs

- **Latitude** north-positive, −90 to +90.
- **Longitude** east-positive, −180 to +180. (West-negative. A consumer passing
  west-positive longitudes gets a chart for the wrong hemisphere with no error;
  the sign convention is part of the contract.)
- The Julian Day handed to the house routine is **the same UT JD** used for the
  bodies, produced by the L0 path (`julianDayUTResolved`). L0 owns wall clock →
  UT; L2 never re-derives it.
- **Sidereal time is apparent** — Greenwich apparent sidereal time (nutation in
  right ascension included) plus the geographic longitude gives the ARMC. This
  is Swiss Ephemeris's internal convention rather than a choice made here, and
  it is recorded so that any comparison is like-for-like: mean sidereal time
  differs by up to ~1.2″ of arc, which is small but not zero.

---

## 3. The angles

| Angle | Definition |
|---|---|
| **MC** | The ecliptic point whose right ascension equals the ARMC — the ecliptic degree on the upper meridian. |
| **IC** | MC + 180°. |
| **ASC** | The ecliptic point rising on the eastern horizon: altitude 0, on the east side. |
| **DSC** | ASC + 180°. |
| **Vertex** | The ecliptic point on the western half of the prime vertical. |
| **Equatorial ascendant** (East Point) | The ecliptic point rising in the plane of the celestial equator — the ascendant computed for latitude 0. |

**The angles do not depend on the house system.** All seven systems must return
the same ASC, MC, Vertex, and equatorial ascendant for the same instant and
place. Only the *cusps* differ. Whole-sign is the single system in which cusp 1
is not the ASC.

---

## 4. House systems

Seven are supported. `key` is the API value; `code` is the Swiss Ephemeris
letter.

| key | code | Defining construction | Defined everywhere? |
|---|---|---|---|
| **`placidus`** | `P` | Each cusp is the point that has traversed 1/3 or 2/3 of *its own* semi-diurnal (above horizon) or semi-nocturnal (below) arc, measured in time. **Default.** | **No** — undefined for any point that never rises or sets, so it fails inside the polar circles. |
| `koch` | `K` | The ascendants at the moments when the MC degree had traversed 1/3 and 2/3 of its own semi-diurnal arc. | **No** — same failure, same cause. |
| `porphyrius` | `O` | Trisect the *ecliptic* arcs MC→ASC and ASC→IC. | Yes, wherever ASC and MC exist. |
| `regiomontanus` | `R` | Divide the celestial equator into twelve 30° arcs from the ARMC; project each division onto the ecliptic along the great circle through it and the north and south points of the horizon. | Yes, except exactly at a pole. |
| `campanus` | `C` | The same projection, but the twelve 30° divisions are taken on the **prime vertical** starting from the east point. | Yes, except exactly at a pole. |
| `equal` | `E` | cusp *k* = ASC + 30°(k−1). | Yes. |
| `whole_sign` | `W` | cusp 1 = 0° of the sign containing the ASC; every cusp a sign boundary. | Yes. |

**Why Placidus is the default:** it is the system the overwhelming majority of
published natal charts and consumer astrology software use, so it is what a
caller who expresses no preference almost certainly means. It is also the least
robust of the seven, which is why the polar behaviour in §6 matters.

**Which systems put a cusp on the MC.** Only those constructed from *both*
angles: `placidus`, `koch`, `porphyrius`, `regiomontanus`, `campanus`. `equal`
is generated from the ascendant alone, so its cusp 10 is ASC + 270° and the MC
floats free — it lands wherever the meridian happens to cut the ecliptic, which
on these twenty charts is anywhere from the 9th house to the 11th. `whole_sign`
likewise. This is a property of those systems, not a defect, and a consumer
drawing an MC line on an equal-house wheel must not assume it coincides with a
cusp.

> **Corrected premise.** This document first asserted "cusp 1 = ASC and cusp
> 10 = MC in every system except whole-sign". The definition suite falsified the
> second half on the first chart it tested (equal houses, 4.46° off). Recorded
> here rather than silently amended, per the L1 practice.

---

## 5. Cusps, ordering, and house membership

- `cusps` is a **12-element array**; index *i* is the cusp of house *i*+1, each
  value in [0, 360).
- Houses are numbered counterclockwise from the ASC: 1 begins at the ASC,
  10 at the MC (except whole-sign).
- **Opposite cusps are exactly 180° apart** in all seven systems:
  cusp *k*+6 = cusp *k* + 180°. This is a property of every system offered here,
  not a general truth about house systems.
- **House membership:** a body is in house *k* iff its longitude lies in the
  half-open arc `[cusp_k, cusp_{k+1})` traversed **forward in zodiacal order**.
  A body exactly on a cusp belongs to the **later** house. (`houseFor`,
  `src/lib/calculators/astrology.ts`.)
- That rule assumes the cusps advance in zodiacal order. **They do not always**
  — see §6.

Derived points that depend on the ASC but express an interpretive choice — the
Part of Fortune day/night rule, the chart ruler's rulership table, aspect orbs —
belong to L3 and are specified separately.

---

## 6. High latitude: where the definitions run out

This is the section the L1 tier deferred here. Above the polar circles the
quadrant systems do not merely become *inaccurate*; two of them become
**undefined** and the other two stop producing an ordered wheel. That is a
property of the geometry, not a defect in Swiss Ephemeris.

### 6.1 Placidus and Koch are undefined, and Swiss Ephemeris says so

Placidus and Koch both need a point's semi-diurnal arc, `arccos(−tan φ · tan δ)`.
When |tan φ · tan δ| > 1 the point is circumpolar — it never crosses the horizon
— and the arc does not exist. Inside the polar circles this happens for part of
the ecliptic at every moment.

Swiss Ephemeris handles it by **returning Porphyry cusps and setting the return
flag to −1**. Measured, at the 2000-01-01 epoch and 15° E:

| Latitude | `swe_houses_ex` flag, `P` and `K` | Max cusp difference vs Porphyry |
|---|---|---|
| 66.4° N | 0 | 59.6° (P), 101.4° (K) — genuinely different systems |
| 66.6° N | **−1** | **0.0°** — byte-identical to Porphyry |
| 69.65° N (Tromsø) | **−1** | **0.0°** |
| 78.22° N (Longyearbyen) | **−1** | **0.0°** |

The substitution is the documented, sane fallback. **Discarding the flag is
not** — see F5.

### 6.2 Regiomontanus and Campanus stay defined but can collapse

Regiomontanus and Campanus need no semi-arc, so they return values at any
latitude and `swe_houses_ex` reports success (`flag = 0`) everywhere. Above the
polar circle, for part of each sidereal day, the ecliptic lies nearly in the
plane of the horizon; every house circle then cuts it in almost the same place
and the wheel **collapses**. At 78.22° N, ARMC 208.8°:

```
cusps   30.87  30.84  29.64  210.93  210.90  210.88
        210.87 210.84 209.64  30.93   30.90   30.88
```

Ten of the twelve cusps sit on two points 180° apart. Houses 1, 2 and 10–12 span
a few hundredths of a degree; houses 3 and 9 span ~181°. The forward arc from
cusp 1 to cusp 2 is −0.03°, so the wheel is not merely crowded, it is locally
**out of zodiacal order** — which is what breaks §5's membership rule (F6).

Not locally, though: it is out of order *throughout*. Inside these windows the
whole wheel runs **retrograde** — cusp 1 → cusp 2 → cusp 3 descends rather than
ascends, and house *k* runs from cusp *k+1* forward to cusp *k*. Swept across a
full sidereal day at seven latitudes and seven house systems, every one of
**4186** degenerate instants had forward arcs summing to 360 × 11 and backward
arcs summing to exactly 360 (worst residual 0.000000000). Read in that
direction the twelve houses partition the circle exactly once, with no gap and
no overlap — the same invariant §5 asserts for a temperate chart.

So the wheel is reversed, not broken. House numbering reverses with it, mapping
house *k* to *2 − k* (mod 12); house 1 *ends* at the Ascendant instead of
beginning there. Cross-checked against a system that stays ordered at every
latitude: `whole_sign` puts the Longyearbyen Moon in house 5, and 2 − 5 ≡ 9
(mod 12) is exactly where the Regiomontanus wheel puts it.

This is not a latitude threshold but a **window of sidereal time that widens
with latitude**. Sweeping ARMC through a full turn at fixed epoch:

| Latitude | Sidereal day with a broken wheel |
|---|---|
| ≤ 66.0° N (below the polar circle) | **0 / 360** |
| 66.6° N | 8 / 360 |
| 69.65° N (Tromsø) | 62 / 360 |
| 78.22° N (Longyearbyen) | 122 / 360 |
| 85° N | 156 / 360 |
| 89° N | 176 / 360 |

Regiomontanus and Campanus break over the *same* windows. Neither polar fixture
in the test set falls inside one, which is precisely why this needed a sweep:
twenty sampled instants would have missed an 8/360 window entirely, and did —
the first version of F6 was written from a single chart and was wrong (§7).

**The cusps themselves are exact.** Every one of the twelve collapsed cusps
satisfies its defining coplanarity condition to 8.6 × 10⁻¹¹ arcsec. Swiss
Ephemeris is right to report success; the geometry really does do this. What
failed was our assumption about the *direction* of the answer — an assumption
`houseSpans` no longer makes: it measures which direction closes the circle
rather than presuming forward.

### 6.3 The policy

- A house system that is **undefined** at a latitude is a documented limitation
  and a docs line, **not a failing test**. `tests/houses-definition.test.ts`
  asserts the *degeneracy itself* — that Placidus is refused above the polar
  circle and that the fallback is Porphyry — so the boundary cannot move
  silently.
- Callers above the polar circle should use `whole_sign` or `equal`, both of
  which are defined everywhere and ordered everywhere. The suite asserts that:
  every house in both systems spans exactly 30° at every fixture latitude,
  including the polar ones.
- The API must not present a substituted or reversed wheel as though it were an
  ordinary chart in the requested system. It no longer does: `houses.system`
  names the system that produced the cusps and `houses.requestedSystem` records
  what was asked for when they differ (F5), and a reversed wheel is both read
  correctly and announced in `warnings` (F6). See §7.
- **No latitude constant appears in the substitution logic.** The boundary is
  read from Swiss Ephemeris's return flag, because it is not a constant: it
  tracks the obliquity, moving from 66.532697° (1800) through 66.562323°
  (J2000) to 66.577351° (≈2333). The old hardcoded 66.5° both warned on charts
  that were fine and named the wrong system for charts that were not.

---

## 7. Findings

Recorded, not patched. As at L1, a disagreement is an escalation.

### F5 — polar charts return Porphyry cusps labelled as the requested system

`calcHouses` (`src/lib/ephemeris/client.ts`) reads `result.data` and **discards
`result.flag`**. Above the polar circle that flag is −1 and the cusps in `data`
are Porphyry, not Placidus. A caller asking for `house_system: "placidus"` at
Tromsø receives Porphyry cusps, a response that still says `placidus`, and a
warning whose text is *"cusps are mathematically degenerate above ~66.5° and may
be unreliable"*.

"May be unreliable" is the wrong claim. The cusps are not unreliable Placidus
cusps; they are exact Porphyry cusps under another name. The warning understates
what happened and the response does not record the substitution anywhere a
machine consumer can read.

This is the same class of defect as **F1** in `accuracy.md`: Swiss Ephemeris
signals a status through a return code, and the wrapper drops it. Candidate
dispositions, all product calls:

1. Surface it — keep the cusps, set `house_system_used: "porphyrius"` (or a
   `substituted` field) and rewrite the warning to say what actually happened.
2. Refuse it — return a documented 4xx for quadrant systems inside the polar
   circles, with the supported alternatives named.
3. Leave it and document it — cheapest, and the least defensible for an API
   whose consumers render the value as a label.

Note the thresholds also disagree: our warning fires at |lat| ≥ 66.5°, Swiss
Ephemeris switches at the true polar circle for the epoch (between 66.4° and
66.6° in the measurements above). Whatever disposition is chosen should take
the boundary from the returned flag rather than from a constant.

**Resolved** by disposition 1. `calcHouses` and `calcHousesFromArmc` now read
`result.flag` and return `system` — the system that actually produced the cusps
— alongside `requestedSystem`. The chart, composite and API responses carry
`houses.system`, and `houses.requestedSystem` only when a substitution
happened, so a machine consumer can detect it without parsing prose. The
warning now says what occurred: *"placidus house cusps are undefined. These are
porphyrius cusps — exact for that system, not unreliable placidus ones."*

Disposition 2 (4xx) was rejected: the substituted cusps are a correct answer to
a well-formed request, and refusing them would break every existing caller at
high latitude to no benefit. Disposition 3 was rejected as the finding
describes.

The boundary constant was not corrected — it was **removed from the decision**.
The suite binary-searches the true boundary and pins it at three epochs
(66.532697° / 66.562323° / 66.577351°) precisely to show that no constant can
be right; 66.5° survives only as secondary advice for the systems sweph does
*not* substitute, where there is no flag to read.

### F6 — a collapsed wheel puts every body in the first house, silently

Inside the windows in §6.2, Regiomontanus and Campanus return a wheel whose
first forward arc is *negative* (−0.03° in the worked example) with `flag = 0`.
`houseFor` walks the cusps assuming forward order: when `cusp_{k+1} < cusp_k` it
treats the arc as wrapping through 0°, so a −0.03° house is read as a 359.97°
house that swallows the entire zodiac. House 1 matches first, and houses 2–12
become unreachable.

Measured end to end through `calculateNatalChart` (Longyearbyen,
1990-01-15 06:15 Europe/Oslo, `regiomontanus`): **all thirteen bodies are
reported in house 1**, including the Moon at 163.98° and Jupiter at 93.40°,
both of which lie inside the genuinely wide house 3 (29.64° → 210.93°). So this
is not a borderline mis-rounding; it is a chart in which the house column is
uniformly wrong and self-evidently so.

The response does carry the generic polar warning (*"…may be unreliable.
Consider whole_sign or equal…"*), which is the correct advice but understates
the outcome. A consumer that renders the warning as a footnote and the houses as
data will render thirteen wrong houses.

The output shape is the deeper problem: twelve longitudes with an implied
forward order cannot express a collapsed or out-of-order wheel. Any real fix has
to decide what the API *means* at those latitudes before it can decide what to
return. Candidate dispositions, as with F5, are a product call.

> **Corrected premise.** F6 was first written as *"Regiomontanus and Campanus
> return a wheel in reverse zodiacal order above the polar circle"*, generalised
> from one chart at 69.65° N. The definition suite falsified it immediately:
> at the instants both polar fixtures actually record, both wheels are perfectly
> ordered. The real behaviour is a collapse over a sidereal-time window that
> widens with latitude (§6.2), and the suite now asserts that structure —
> monotonic growth in latitude — rather than a single sampled chart.
>
> The premise was right about the *shape* and wrong about its *universality*.
> Inside the windows the wheel genuinely does run in reverse; outside them it
> does not, and both polar fixtures happened to sit outside. A twenty-instant
> fixture set misses an 8/360 window; only the sweep finds it.

**Resolved** by measuring the direction instead of assuming it. `houseSpans`
(`calculators/astrology.ts`) computes the twelve forward arcs, and if they do
not sum to 360 it computes the backward ones and uses those — house *i* running
from cusp *i+1* forward to cusp *i*. `houseFor` places bodies by offset within
those spans. Every longitude then lands in exactly one house at every one of
the 11 520 swept instants.

Two rejected approaches, both recorded because both look right:

- **Normalising each arc into [0, 360)** is the bug, not the fix: it is exactly
  what turns a −0.03° house into a 359.97° one.
- **Flipping the largest arc by −360°** (a plausible "un-wrap the outlier"
  heuristic) is wrong too, and measurably so: at 66.6° N, ARMC 270° it produces
  two houses of 270.065° that overlap by 180.13°. Direction is a property of
  the whole wheel; it cannot be inferred from one arc.

A correction to the finding above: the Longyearbyen Moon (163.98°) and Jupiter
(93.40°) land in house **9**, not house 3. The "house 3" in the original
write-up came from reading the wide arc forward — the very assumption at issue.
Under the reversal map house 3 ↔ house 9, and `whole_sign` independently agrees
(§6.2).

The reversal is also **announced**: a chart whose wheel runs backwards carries a
warning saying so, that ten of twelve houses are hairline-narrow, that the
placements are nevertheless correct, and that house numbers there are not
comparable with a temperate chart's.

One further change came out of the fix rather than the finding. `houseFor`
existed **twice** — privately in `astrology.ts` and exported from `overlay.ts`
(used by composite, synastry, transit-to-natal and the event scanner) — so F6
was a single defect that had to be found and fixed in two places. The two are
now one function, re-exported, and the suite asserts the overlay path and the
chart path agree above the polar circle.

### Where it checks out

Reported per the L1 practice of recording the negatives too. Across all twenty
hostile fixtures and all seven systems:

- **Every closed-form construction is exact** to ≤ 1.5 × 10⁻⁷ arcsec — the
  angles, equal, whole-sign, Porphyry, Regiomontanus, Campanus, Koch. That is
  double-precision round-off; there is no modelling difference to find.
- **Placidus agrees to 3.4 × 10⁻⁴ arcsec**, which is Swiss Ephemeris's iteration
  convergence floor rather than a disagreement about the definition.
- **The angles are geometrically what §3 says they are** on every chart: the ASC
  sits on the horizon and east of the meridian, the MC on the meridian, the
  Vertex on the western half of the prime vertical, the equatorial ascendant at
  hour angle −90°. Southern-hemisphere and polar charts included.
- **The angles are identical across all seven house systems**, and opposite
  cusps are exactly 180° apart in all seven.
- **The independent sidereal time and obliquity agree** with the implementation
  to 0.84″ and 0.084″ against bounds of 2.0″ and 0.20″ derived from named model
  differences (§8).
- **The Placidus/Koch polar boundary is clean**: refused at every sidereal time
  inside the polar circle, accepted at every sidereal time outside it. The
  degeneracy is a function of latitude alone, exactly as the geometry predicts.

No ephemeris or construction discrepancy was found at this tier. The two
findings are both about how a correct computation is *labelled and shaped* on
the way out.

---

## 8. Verification

`tests/houses-definition.test.ts` — **250 tests**, run against the same twenty
hostile fixtures L1 uses (southern hemisphere, polar, pre-1800, DST edges,
fractional zones). No Horizons data enters this tier and no network call is made.

Each system is checked against the construction in §4, not against another
program's numbers. Where a construction is stated geometrically — "this point
has traversed a third of its own semi-diurnal arc", "this cusp is coplanar with
that equator division and the north point of the horizon" — the assertion is
made directly against the returned cusps, with no intermediate formula that
could be transcribed wrongly.

### Tolerances and the reason for each

| Bound | Value | Why it has that value | Worst measured |
|---|---|---|---|
| Closed-form constructions | 1 × 10⁻³ ″ | Both sides evaluate algebraically equivalent expressions in IEEE double precision. Only round-off is admissible; the smallest real definitional disagreement (mean vs apparent sidereal time) is 16″, four orders of magnitude away. | 1.5 × 10⁻⁷ ″ |
| Placidus | 0.01 ″ | Not closed form — Swiss Ephemeris iterates, so its cusps carry that solver's convergence floor (~10⁻⁷ degrees). Set above the floor and far below anything meaningful; cusps are quoted to the arcminute at best. | 3.4 × 10⁻⁴ ″ |
| Seam, ARMC | 2.0 ″ | Meeus (12.4) is IAU 1982/1976; Swiss Ephemeris is IAU 2006. Precession in RA diverges ~3 mas/yr → ~0.8″ at the 1750 end. Meeus's abbreviated nutation is good to 0.5″ in Δψ, entering as Δψ·cos ε ≈ 0.46″. | 0.84 ″ |
| Seam, obliquity | 0.20 ″ | IAU 1976 vs IAU 2006 obliquity constant: 84381.448″ − 84381.406″ = 0.042″ — the same difference that sets the L1 residual floor — plus ~0.04″ from the truncated Δε. | 0.084 ″ |

No bound was chosen by observing a residual. Each is derived from a named model
difference and then measured against; the headroom above is the result, not the
design.

### The seam is not vacuous

A tolerance can pass because the quantity is right or because the test cannot
see the quantity. Three checks establish it is the former:

- The **equation of the equinoxes** on these charts ranges 0.855″ to 16.367″.
  Computing the ARMC from *mean* rather than apparent sidereal time — the
  convention §2 pins — would exceed the 2.0″ bound by up to 8×. Asserted
  directly, and confirmed by mutation: dropping the term fails 19 tests.
- Flipping longitude to **west-positive** exceeds the bound on all twenty
  fixtures, so §2's sign convention is under test rather than assumed.
- Perturbing the **Placidus trisection** by 10⁻⁵ degrees (0.036″) fails 18
  tests; taking the **Regiomontanus** equator division one house off fails 21.

### Epistemic status of each result

Six of the seven systems are *verified* against geometry that cannot be
restated wrongly without becoming obviously false.

**Koch is a consistency result, not a verification.** Its construction is
published verbally — "the cusps are the ascendants at the moments when the MC
degree had traversed a third and two thirds of its own semi-diurnal arc" — and I
turned that sentence into a formula myself. It reproduces the implementation to
1.5 × 10⁻⁷ arcsec, which says the two readings of the definition agree; it does
not independently establish that either reading is the one Koch intended. Labelled
as such in the suite. Anchoring Koch would need a published worked example from
a source that is not Swiss Ephemeris.

### What the suite deliberately does not do

- **Pre-1800 charts are excluded** from the house-membership test, because F1
  (`docs/accuracy.md` §6) makes `calculateNatalChart` throw on them. The
  exclusion is itself asserted — the suite requires those charts to keep
  throwing — so when F1 is dispositioned this test fails and forces them back in.
- **F5 and F6 were pinned as characterization tests**: they asserted the
  *defective* behaviour so that changing it had to be a deliberate act, each
  carrying a comment saying the test must be rewritten when the finding was
  dispositioned. That is what happened — the fix broke them, exactly as
  designed, and they now assert the corrected behaviour. `tests/polar-houses.
  test.ts` carries the sweep.
- **No comparison against astro.com, astroseek, or any other program.** Nothing
  at this tier is a check against another implementation, so nothing at this
  tier can be mistaken for external verification.

---

## 9. What L2 does not cover

- Sidereal zodiacs and ayanamsas — unsupported, not merely untested.
- Topocentric positions — unsupported.
- House systems outside the seven in §4 (Alcabitius, Morinus, Meridian,
  Krusinski, APC…). Swiss Ephemeris offers them; this API does not expose them,
  so they have no convention here.
- Anything interpretive: orbs, aspect patterns, rulerships, the Part of Fortune
  sect rule. That is L3.

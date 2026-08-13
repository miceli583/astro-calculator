# Interpretive conventions (L3)

**Status:** Normative. This document is the specification; the code is required
to match it, not the other way round. Where the implementation departs from a
convention stated here, §8 records a **finding** — the convention is not
amended to describe the bug.

**Companions:** [`time-conventions.md`](./time-conventions.md) (L0, wall clock →
UT → JD) · [`accuracy.md`](./accuracy.md) (L1, ephemeris positions) ·
[`chart-conventions.md`](./chart-conventions.md) (L2, angles and houses)
**Tests:** `tests/aspect-conventions.test.ts`

---

## 0. What L3 is, and why there is no oracle for it

L3 is everything above a finished chart: which pairs of points count as
aspecting, how wide an aspect may be, which points participate, what counts as
a named pattern, which planet rules a sign, and how the Part of Fortune is
derived.

Layers 0–2 have external truth. A wall clock converts to one Julian Day; the
Sun is at one longitude; a Placidus cusp satisfies one geometric condition, and
`chart-conventions.md` could therefore anchor every claim to a definition that
cannot be restated wrongly without becoming obviously false.

**None of that exists here.** An 8° conjunction orb is not more correct than a
6° one; it is a different school. Ptolemy's five aspects, the quincunx,
whole-sign versus quadrant sect, modern versus traditional rulerships — these
are traditions, not facts, and the disagreement between two astrology programs
at this layer is almost never a defect in either.

So the deliverable at L3 is **this document**. The tests below do not verify
that the conventions are right — nothing could. They verify that the code
implements *these* conventions, exactly, and that a change to them is a
deliberate edit to a specification rather than a silent drift in what the API
returns. Agreement with astro.com, astroseek or any other program is explicitly
**not** a goal at this layer and is not measured here.

What *is* objectively checkable at L3, and is checked:

- **Internal consistency** — the orb reported equals the true angular distance
  to the exact angle; a pattern's constituent aspects appear in the chart's own
  aspect list; the same pair never yields two aspects.
- **Well-definedness** — the aspect windows do not overlap, so "first match
  wins" is not an arbitrary tie-break.
- **Cross-surface agreement** — the same chart asked the same question through
  two endpoints should not give two answers. §8 records where it does.
- **Derivations against their own definition** — the Part of Fortune formula,
  the South Node as the North Node's opposite, the rulership tables.

---

## 1. Aspects

### 1.1 The set

Six aspects. The five Ptolemaic aspects (conjunction, sextile, square, trine,
opposition) plus the quincunx.

| Aspect | Exact angle | Harmonic |
|---|---|---|
| Conjunction | 0° | 1st |
| Opposition | 180° | 2nd |
| Trine | 120° | 3rd |
| Square | 90° | 4th |
| Sextile | 60° | 6th |
| Quincunx | 150° | 12th (5×30°) |

No minor aspects (semisextile, semisquare, sesquiquadrate, quintile, biquintile,
septile). This is a deliberate floor, not an oversight: minor aspects multiply
the hit count several-fold and are the least agreed-upon part of an already
unagreed layer. Adding one is an API contract change and belongs in a release,
not a patch.

### 1.2 Orbs — natal scale

`ASPECT_DEFS` in `src/lib/calculators/astrology.ts`:

| Aspect | Orb | Reason for this width |
|---|---|---|
| Conjunction | 8° | Widest by convention — the strongest aspect, and the one traditionally granted the largest orb. |
| Opposition | 8° | Paired with the conjunction: the two hard axial aspects share a width. |
| Trine | 7° | Major but softer; one degree inside the axial pair. |
| Square | 7° | Major and hard; matched to the trine so the harmonious/tense pair are treated evenly. |
| Sextile | 5° | Minor-major; conventionally about two-thirds of a trine. |
| Quincunx | 3° | The narrowest, and the least traditional of the six — a tight orb keeps its hit rate near the majors' rather than dominating the list. |

**Orbs are flat.** They are a property of the *aspect*, not of the bodies
involved. Many traditions widen the orb when the Sun or Moon is involved (a
luminary bonus of 1–2°) or narrow it for outer planets and asteroids. We do
not. The reason is contract stability, not astrological preference: a flat table
is a total function of the aspect type alone, so a consumer can reproduce our
aspect list from the longitudes we return without also knowing our body-class
table. If a luminary weighting is ever added it is a breaking change.

**Orbs are symmetric.** No distinction between applying and separating width.

### 1.3 Orbs — transit and synastry scale

Two further tables exist in `src/lib/calculators/overlay.ts`, and they are
deliberately tighter than natal:

| Aspect | Natal | Synastry | Transit |
|---|---|---|---|
| Conjunction | 8° | 5° | 3° |
| Opposition | 8° | 5° | 3° |
| Trine | 7° | 4° | 2° |
| Square | 7° | 4° | 3° |
| Sextile | 5° | 3° | 2° |
| Quincunx | 3° | 2° | 1.5° |

The ordering natal > synastry > transit is the convention, and the reason is the
number of pairs each surface produces. A natal chart compares 13 points against
themselves (78 pairs). A synastry or transit overlay compares 13 against 13
(169 ordered pairs) — more than twice as many — and a transit list is read as
"what is happening now", where a 7°-wide square lasting weeks is not an event.
Narrowing the orb as the pair count rises keeps the returned lists comparable in
length and the transit list temporally meaningful.

Both tables are caller-overridable per aspect (`orbs` in the synastry and
transit request bodies). The natal table is **not** overridable.

> **Finding.** `/api/v1/transit` does not use the transit table — see **F9**.

### 1.4 One aspect per pair

For each unordered pair, `ASPECT_DEFS` is scanned in table order and the **first**
match wins; the scan then stops.

This is well-defined rather than arbitrary, and the reason is worth stating
because it is the only thing that makes "first match" safe: **no two aspect
windows overlap.** A separation therefore falls inside at most one window, so
table order never decides anything and reordering `ASPECT_DEFS` cannot change
the output.

Checked exhaustively over all 15 pairs (§7). The binding constraint is **square
and trine**: 30° apart, carrying the two widest non-axial orbs at 7° each, for a
margin of **16°**. Every other pair is looser.

> **Corrected premise.** I first wrote that the constraint was the conjunction
> and the sextile — the two *closest* exact angles, 60° apart with orbs summing
> to 13° — and that "every adjacent pair has more slack still". That is false,
> and the test caught it on the first run. Closest angles are not the binding
> pair, because orb width varies: conjunction/sextile actually has the **largest**
> margin in the table (47°), while the four 30°-spaced pairs above 60° are all
> tighter. The property still holds; my reason for it did not.

The practical consequence is the one that matters for §1.1: with 30° between
every pair of exact angles above 60°, **any aspect added to this set must keep
its orb plus its neighbours' under 30°.** A semisextile at 30° would collide with
the conjunction as soon as its orb exceeded 22°. The 16° margin, not the 47° one,
is the number a future addition has to respect.

### 1.5 Applying and separating

An aspect is **applying** when it is getting closer to exact, **separating**
when it is moving apart.

Determined by re-evaluating the separation after advancing both bodies along
their known daily motion by **0.01 day (14.4 minutes)** and asking whether the
orb shrank. Retrograde motion is handled naturally, because the speed carries
its own sign.

Two consequences of the finite step, both accepted:

- A body within 14.4 minutes of a **station** has a speed near zero and its
  applying flag is effectively a coin-flip. This is inherent to any finite-step
  rule and is not worth a special case.
- An **exactly partile** aspect (orb 0) reports `applying: false`, because the
  test is a strict shrink and the orb cannot shrink below zero. Reading this as
  "separating" is wrong; read `applying: false` as "not currently closing".

> **Finding.** `/api/v1/transit` reports `applying: false` for every hit
> regardless of motion — see **F10**.

### 1.6 Which points participate

Aspects are computed between **planets only** — the ten bodies, the true node,
the South Node and Chiron, subject to the caller's `planets` subset.

The following do **not** participate in the natal aspect list:

- **The angles** (ASC, MC, Vertex, equatorial ascendant). Aspects to the angles
  are common in practice, but the angles are not bodies: they have no speed, so
  they cannot carry an applying flag, and they move ~1° per 4 minutes of clock
  time, which makes an aspect to them far more sensitive to birth-time error
  than an aspect between two planets. Excluding them keeps every entry in the
  list the same kind of object. A caller who wants them can compute them from
  the longitudes we return.
- **The Part of Fortune.** A derived point, not a body; same reasoning.
- **House cusps.**

The **South Node is included**, and is the exact opposite of the true node by
construction (§4). Its aspects to other bodies are reported normally; its
aspect to the true node is not — see §1.7.

### 1.7 Tautological pairs are excluded

One pair is excluded from the aspect list regardless of geometry:

| Pair | Why |
|---|---|
| `true_node` – `south_node` | The South Node is *defined* as `true_node + 180°` (§4.1), so the opposition is an identity, not an observation. |

Reporting it was a defect (**F11**): being exact by construction, it was the
tightest aspect in every chart ever calculated, so any consumer ranking aspects
by orb or surfacing "the closest aspect" got this one first, always.

The exclusion is on the **pair**, not on either point. The South Node still
aspects everything else, and no other pair is suppressed for any reason —
including genuinely exact ones. A real 0.00° opposition between two bodies is a
rare and meaningful configuration and is reported.

Implementation: `TAUTOLOGICAL_PAIRS` in `src/lib/calculators/astrology.ts`,
keyed by the sorted name pair. Adding to that set is a change to this section.

---

## 2. Aspect patterns

Detected by `src/lib/calculators/aspect-patterns.ts` on every natal-style chart
(natal, composite, solar and planetary returns) and on the sky snapshot.

### 2.1 Pattern orbs

`PATTERN_ORBS` mirrors the natal table for the five aspects patterns are built
from: opposition 8°, trine 7°, square 7°, sextile 5°, quincunx 3°.

**There is no conjunction entry**, because no pattern in the set is defined by a
conjunction — the stellium is defined by shared sign or house occupancy, not by
pairwise conjunction (§2.2). Mirroring the natal table is required for coherence:
a pattern whose legs were not also aspects in the same chart's aspect list would
be indefensible, and §7 asserts that this never happens.

### 2.2 The patterns

| Pattern | Definition |
|---|---|
| **Stellium** | 3+ points in the same sign, or 3+ in the same house. Occupancy-based, not aspect-based, so a stellium can span more than a conjunction orb. |
| **Grand trine** | 3 points mutually trine. Reports the shared element when all three signs agree, and omits it otherwise. |
| **T-square** | 2 points in opposition, both square a third (the apex). Reports the apex and the shared modality when present. |
| **Grand cross** | 4 points forming two oppositions with all four squares present. |
| **Yod** | 2 points in sextile, both quincunx a third (the apex). |
| **Kite** | A grand trine plus a fourth point opposing one of its members (and therefore sextile the other two). |
| **Mystic rectangle** | 4 points: 2 oppositions, 2 trines, 2 sextiles. |

### 2.3 Tie-breaks and suppression

These rules exist because the patterns overlap by construction, and without them
one geometric configuration is reported several times under different names.

1. **A grand cross suppresses its component T-squares.** Four points in a grand
   cross contain four T-squares. A T-square is emitted only when its three
   members are *not* all contained in a single detected grand cross. A T-square
   that merely shares two points with a cross survives — it is a different
   configuration.
2. **A kite does not suppress its grand trine.** Both are reported. The grand
   trine is a real and separately named configuration, and a consumer that wants
   only the larger figure can filter by type; one that wants the trine cannot
   recover it from a kite without redoing the geometry.
3. **A house stellium duplicating a sign stellium is dropped.** When the same
   set of points forms both, only the sign stellium is kept. Points in the same
   sign are usually in the same house, so without this every such stellium would
   be reported twice.
4. **One wiring per mystic rectangle.** Four points admit two candidate
   opposition pairings; the first valid one is emitted and the search for that
   point set stops.
5. **The South Node never participates in a pattern.** It is excluded from the
   pattern input by `patternPointsFromPlanets`. Because it is exactly opposite
   the true node, admitting it would manufacture a spurious opposition leg in
   every chart and turn any two points square the nodal axis into a "grand
   cross" that is really a T-square. Note this is *not* symmetric with the aspect
   list, which does include it — see **F11**.
6. **Ordering is deterministic.** Patterns sort by type — stellium, grand cross,
   T-square, grand trine, kite, yod, mystic rectangle — then by member names.
   Two identical charts always produce byte-identical pattern arrays.

Reported `maxOrb` is the widest leg of the figure, rounded to 2 decimals.

### 2.4 Element and modality

Element is the sign index mod 4 (fire, earth, air, water from Aries); modality
is the sign index mod 3 (cardinal, fixed, mutable from Aries). Both follow from
the standard ordering of the zodiac and are asserted against it.

---

## 3. Rulerships

`src/lib/constants/rulerships.ts`. Two tables, **modern by default**, selected
per request with `rulership: "modern" | "traditional"`.

| Sign | Modern | Traditional |
|---|---|---|
| Aries | Mars | Mars |
| Taurus | Venus | Venus |
| Gemini | Mercury | Mercury |
| Cancer | Moon | Moon |
| Leo | Sun | Sun |
| Virgo | Mercury | Mercury |
| Libra | Venus | Venus |
| Scorpio | **Pluto** | **Mars** |
| Sagittarius | Jupiter | Jupiter |
| Capricorn | Saturn | Saturn |
| Aquarius | **Uranus** | **Saturn** |
| Pisces | **Neptune** | **Jupiter** |

The two conventions differ on exactly three signs — the three whose modern ruler
is a planet unknown before 1781. Modern is the default because it is the more
common expectation in contemporary practice.

**Both rulers are always reported**, on every response, regardless of which
convention was requested: `ruler` is the one selected, `modernRuler` and
`traditionalRuler` are always populated. A consumer never has to re-request a
chart to see the other reading.

The **chart ruler** is the ruler of the *Ascendant's sign* — not of the
Ascendant degree, and not the ruler of the 1st house cusp under whole-sign
houses (which is the same sign by construction). Its reported `aspects` are
exactly the chart's own aspects involving that planet, with no separate orb
table. `placement` is `null` — not omitted, and not fabricated — when the
caller's `planets` subset excludes the ruling planet.

---

## 4. Derived points

### 4.1 South Node

`south_node = true_node + 180°`, exactly, sharing the true node's speed and
retrograde flag. It is a derived point, not an independent ephemeris query.

We use the **true** node, not the mean node. The two differ by up to ~1.7°.

### 4.2 Part of Fortune

The Arabic Part of Fortune, with the **sect-sensitive** formula:

- Day birth: `ASC + Moon − Sun`
- Night birth: `ASC + Sun − Moon`

Normalised to [0, 360). Using the day formula at night (or vice versa) reflects
the point across the ASC–Sun–Moon geometry and typically moves it by a large
arc, so the sect determination is not a detail — it is most of the calculation.

**Sect is a property of the birth, not of the requested house system.** A birth
is diurnal when the Sun is above the horizon, i.e. when the Sun's longitude lies
on the arc running backwards from the Ascendant to the Descendant. That is a
statement about the horizon, and it must give the same answer whichever house
system the caller asked for.

> **Finding.** Sect is derived from the Sun's *house number*, which tracks the
> horizon only in some house systems — see **F7**. The Part of Fortune is also
> fabricated rather than omitted when the Sun or Moon is absent — see **F8**.

---

## 5. What is reported and what is not

- Aspect `orb` is the absolute angular distance from exact, in degrees — never a
  percentage, never a "strength".
- No aspect is weighted, scored, or ranked. Consumers that want a strength
  measure can compute one from `orb` and the aspect's table width, both of which
  are returned or documented here.
- No interpretive text. This API returns geometry and named configurations; it
  does not return meanings.

---

## 6. High-latitude and degenerate charts

L3 inherits L2's house numbers without re-checking them. Where a chart's houses
are degenerate (`chart-conventions.md` §6, findings F5 and F6), every L3 output
that depends on a house number is degenerate with them: house stelliums, the
chart ruler's `house`, and — via §4.2 — the sect determination and therefore the
Part of Fortune. This is noted rather than fixed, because the fix belongs at L2.

---

## 7. Verification

`tests/aspect-conventions.test.ts`. What is asserted, and what that is worth:

| Claim | How it is checked | Status |
|---|---|---|
| Aspect windows do not overlap | Exhaustively over all 15 aspect pairs: window separation vs orb sum | **Proof** — arithmetic on the table |
| First-match scan is order-independent | Follows from the above; tightest margin pinned at 16° (square/trine) | **Proof** |
| The orb table is the documented one | Every aspect on all 24 charts predicted from this document's table alone, then required to equal the calculator's list exactly — ~1900 pairs, no extras and no omissions | **Objective** |
| Reported orb = true distance to exact | Recomputed from longitudes on every aspect of every fixture | **Objective** |
| One aspect per unordered pair | Every fixture chart | **Objective** |
| Every pattern leg is in the chart's aspect list | Cross-checked per pattern, per fixture | **Objective** |
| South Node = true node + 180° | Direct, every fixture | **Objective** |
| Part of Fortune matches the stated formula | Recomputed from ASC/Sun/Moon and the sect flag | **Objective** |
| Sect agrees across house systems | Same birth, all 7 systems | **Fails — F7** |
| Transit orbs are the transit table | `/api/v1/transit` vs `/api/v1/transit/natal` | **Fails — F9** |
| Orb *values* (8/7/5/3) are correct | — | **Not checkable.** Convention. Pinned so a change is deliberate. |
| Pattern definitions are correct | — | **Not checkable.** Convention. |
| Modern default is the right default | — | **Not checkable.** Convention. |

The last three rows are the honest core of this layer: they are pinned as
golden values, and a test failing there means someone changed the school of
astrology the API implements, which should require editing this document.

---

## 8. Findings

Recorded, not patched. As at L1 and L2, a disagreement is an escalation.

### F7 — sect is read off the house number, and is wrong under whole-sign houses

`isDayBirth` is computed as `sun.house >= 7 && sun.house <= 12`.

That is a correct test of "Sun above the horizon" **only when houses 7–12 span
exactly the arc from the Descendant to the Ascendant.** They do in the five
systems whose cusp 1 is the ASC and cusp 7 the DSC (Placidus, Koch, Porphyry,
Regiomontanus, Campanus) and in equal houses, where cusp 1 = ASC and cusp 7 =
ASC + 180 by construction even though cusp 10 is not the MC.

They do **not** under `whole_sign`, where house 1 begins at the start of the
Ascendant's *sign*, not at the Ascendant degree. The house boundaries are offset
from the horizon by the Ascendant's degree within its sign, so a body in that
offset arc is assigned to the wrong hemisphere. The misclassification window is
two arcs each equal to that offset — on average about 8% of the zodiac, and up
to 16% for a late-degree Ascendant.

Measured on the L1 fixtures (Kolkata, 1972, half-hour offset zone):

| | Placidus | Whole-sign |
|---|---|---|
| Sun's house | 12 | 1 |
| `isDayBirth` | `true` | `false` |
| Part of Fortune | 212.73° | 77.58° |

The Sun is at 142.26° with the Ascendant at 145.15°: it rose about eleven
minutes before the birth and is unambiguously above the horizon. The birth is
diurnal. Placidus reports it correctly; whole-sign does not, and the Part of
Fortune moves **135°** — nearly five signs — as a result of nothing but the
caller's choice of house system.

Sect is a property of the sky, so this is a defect and not a convention
difference. Candidate dispositions, all product calls:

1. Derive sect from the horizon directly — is the Sun's longitude on the arc
   from ASC backwards to DSC — and drop the house-number proxy. Correct under
   every house system, including the degenerate polar wheels of F6, and it is a
   two-line change.
2. Keep the proxy but compute it against an internally-derived quadrant wheel
   regardless of the requested system.
3. Document the coupling and leave it. Hard to defend: the response gives no
   indication that the Part of Fortune depends on `house_system`.

### F8 — the Part of Fortune is fabricated when the Sun or Moon is absent

The formula needs the Sun, the Moon and the Ascendant. When the caller's
`planets` subset omits either luminary the code falls back to returning **the
Ascendant's longitude** with `isDayBirth: false`.

Measured (London 1950, `planets: ["mars", "venus"]`): `partOfFortune.longitude`
= 245.25346052636763, `houses.ascendant.longitude` = 245.25346052636763 —
identical to the last digit, with a populated sign, degree, minute, second and
house.

The response is indistinguishable from a genuine Part of Fortune that happens to
conjoin the Ascendant, which is a real configuration. Nothing in the payload
marks it as a fallback, so a consumer cannot tell the difference and will render
it. `isDayBirth: false` is likewise asserted rather than unknown, and is wrong
for half of all births.

Dispositions: return `null` for `partOfFortune` when a luminary is missing
(preferred — the field is already an object, and null is unambiguous); or
always compute the Sun and Moon internally regardless of the requested subset,
since the Ascendant is always computed anyway; or reject the request. Silently
returning the Ascendant is the one option that cannot be defended.

### F9 — `/api/v1/transit` uses natal orbs, `/api/v1/transit/natal` uses transit orbs

Two endpoints answer the same question — which transiting bodies aspect this
natal chart — through two different code paths with two different orb tables.
`calculateTransits` scans `ASPECT_DEFS` (the natal table, §1.2); the overlay
path used by `/api/v1/transit/natal` uses `DEFAULT_TRANSIT_ORBS` (§1.3), which
is 2–2.7× tighter.

Measured (Diana's natal chart, transits for 2026-08-12 12:00 UTC):

| Endpoint | Orb table | Aspect hits |
|---|---|---|
| `/api/v1/transit` | natal (8/8/7/7/5/3) | **54** |
| `/api/v1/transit/natal` | transit (3/3/3/2/2/1.5) | **18** |

36 of the 54 — two thirds — are wider than the transit table permits, including
a Sun–Moon opposition at 5.23° and a Sun–Venus square at 4.59°. A consumer
switching endpoints sees the hit count triple with no documented reason, and
`/api/v1/transit` additionally ignores the caller's `orbs` override because
`ASPECT_DEFS` is a module constant.

Whichever table is right, both endpoints should use it. §1.3's stated
convention is that transit-scale surfaces use the transit table, so on the
convention as written `/api/v1/transit` is the one that is wrong.

### F10 — `/api/v1/transit` reports `applying: false` unconditionally

In the same loop, every pushed aspect carries a hardcoded `applying: false`.
The transiting bodies' speeds are available on the objects being iterated, and
the overlay path computes the flag correctly from them.

Measured on the same request: **0 of 54** hits applying on `/api/v1/transit`,
against **10 of 18** on `/api/v1/transit/natal`. Roughly half of all transit
aspects are applying, so a blanket `false` is not a conservative default — it is
a wrong answer on about half the list, and it is the half that matters most,
since an applying transit is the one that has not yet peaked.

The field being present and always false is worse than the field being absent:
absent is unknown, `false` is a claim.

### F11 — every chart carries a tautological node–node opposition — **FIXED**

**Resolved** by excluding the pair specifically; the convention is now §1.7.
The narrow disposition was taken: the South Node keeps its other aspects, and
no other pair — exact or otherwise — is suppressed. The original finding
follows.

`computeAspects` runs over the planet list after the South Node has been
appended, so `true_node` and `south_node` are aspected to each other. Because
the South Node is defined as the true node plus exactly 180°, the result is a
guaranteed opposition at orb 0.00 in every chart that includes the node.

Measured on Diana: `true_node–south_node opposition 0.00`, alongside six other
South Node aspects that are themselves the mirror images of true-node aspects.

It carries no information — it is an identity, not a configuration — and it has
a concrete downstream cost: it is the *tightest aspect in every chart*, so any
consumer ranking aspects by orb, or reporting the closest aspect, gets this one
first, always. It also makes the aspect list asymmetric with the pattern list,
which excludes the South Node precisely because it is derived (§2.3 rule 5).

Dispositions considered: exclude the node–node pair specifically (**taken**);
exclude the South Node from aspects as it is already excluded from patterns
(rejected — a larger contract change, and the other six South Node aspects are
meaningful to some schools); or document it and keep it (rejected — the
ranking cost is real). The narrow fix is defensible and cheap; the wide one is
a judgement about whether nodal aspects are wanted at all, which is a product
question and not one this fix should have pre-empted.

---

## 9. What L3 does not cover

- **Minor aspects** — not implemented (§1.1); no convention is asserted for them.
- **Aspects to the angles and to derived points** — deliberately excluded (§1.6).
- **Body-class or luminary orb weighting** — deliberately not implemented (§1.2).
- **Declination aspects** (parallel, contraparallel) — not implemented. Latitude
  is returned per body, so a consumer can compute them.
- **Midpoints, harmonics, fixed stars, antiscia, dignities, house rulers beyond
  the chart ruler** — out of scope.
- **Interpretation** — permanently out of scope (§5).
- **astro.com / astroseek comparison** — deliberately not performed at this
  layer, and not performed anywhere in this harness. There is no ground truth
  for L3, so agreement would establish only that two programs made the same
  conventional choices, and disagreement would establish nothing at all.

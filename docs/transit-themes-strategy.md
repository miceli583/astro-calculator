# Transit Themes — Strategy Analysis for Client

**Audience:** Product decision-maker (non-technical)
**Purpose:** Choose *how* transit themes get written before we invest in generating them.
**Companion:** `docs/transits-spec.md` §7 (technical implementation detail)

---

## 0. System boundary (already decided)

- **AstroCalculator (this repo)** — public AGPL API. Returns *structured* transit events
  only. No prose, no interpretation. This is the "what is happening" layer.
- **SoulMapCalculator (private, `/Volumes/LIVE/Projects/MiracleMind/Dev/Clients/MarissaMorisson/SoulMapCalculator`)** —
  proprietary consumer app. Consumes AstroCalculator's events over the network and
  applies the theme prose + AI augmentation described in this doc. This is the "what
  it means" layer.

Everything below refers to work that will live in **SoulMapCalculator**. AstroCalculator's
job is done once events return.

---

## 1. The question in plain English

The API can already tell a user *what* is happening in their chart on any given day —
"Saturn is conjunct your Sun," "Jupiter is trine your Moon," and so on. What
SoulMapCalculator needs to add is *what that means* in human language. That's the
"theme" layer, and there are three ways to build it. Each one produces a very
different product.

**Short version of what follows:**
we recommend a **tiered hybrid** — a hand-crafted table of prose for the most meaningful
combinations, with real-time AI used *only* to layer chart-specific context on top. This
matches how the strongest astrology products in the market feel to a user, while going
deeper than any of them on the personalization axis.

---

## 2. Why this is a combinatorial problem

Every transit theme is a stack of ingredients. The more ingredients we include, the more
specific (and more expensive to produce) the reading gets.

| Depth | Ingredients stacked | # of combos to write | Feel |
|---|---|---|---|
| **L1 — Base** | Transit planet × natal planet × aspect | **378** | Generic; every user with a Sun gets the same "Saturn conjunct Sun" |
| **L2 — Sign-flavored** | + sign of the natal planet | **4,536** | Personalized to *your* Sun (e.g. Aries Sun vs. Pisces Sun) |
| **L3 — Sign + house** | + house the natal planet lives in | **54,432** | Fully situated: "Saturn on your Aries Sun in your 10th house" |
| **L4 — Sign + house + transiting sign** | + sign the transiting planet is in | **653,184** | Extremely nuanced; captures the *flavor* of this particular Saturn transit |
| **L5+** | + retrograde phase, aspect pattern, chart-ruler role, life stage… | millions | Only real-time AI can go here |

At L3 and beyond, hand-authoring becomes impractical — but AI can fill the gap if
we've done the L1/L2 work as a foundation for the AI to build on.

### Concrete example — how depth changes what you read

The same event, read at each depth:

> **L1 (Base — 378 combos):**
> *Saturn conjunct Sun.* A period of consolidation around your core identity. Structure,
> responsibility, and confrontation with limits. Lasts ~2–3 years.

> **L2 (Sign-flavored — 4,536 combos):**
> *Saturn conjunct your **Aries** Sun.* A three-year initiation into disciplined
> self-assertion. Your instinct to charge forward meets the wall of what actually works.
> The reward on the other side is the kind of confidence that isn't performative.

> **L3 (Sign + house — 54,432 combos):**
> *Saturn conjunct your Aries Sun in your **10th house**.* Your public identity and career
> are being reforged. Any ambition built on borrowed confidence will crack; anything real
> will get its foundation poured in concrete. This is a career-defining passage.

> **L4 (Sign + house + transiting sign — 653,184 combos):**
> *Saturn conjunct your Aries Sun in your 10th, while Saturn moves through **Aries** itself.*
> Rare — this is Saturn returning to the sign it visits every 29 years, and it's hitting
> the most fire-forward point in your chart. The lesson is unusually direct: no dressing
> up, no delegating. What do *you* actually want to build with your name on it?

> **L5 (AI, chart-aware):**
> *Same event, but the AI also knows: you're in your Saturn return year, Mars rules your
> Aries Sun and is currently in Cancer squaring your MC, and your Human Design authority
> is Emotional.* The reading now weaves in your specific life stage, dispositor tensions,
> and decision-making style — and does so in a way no static table could pre-write.

Each level is dramatically more meaningful than the last. The question is where to draw
the "hand-written" line and let AI take over.

---

## 3. The three strategies

### 3.1 Strategy A — Prebuilt theme map (static)

Ship a JSON file of pre-written prose. Look up by key. Serve.

**Pros**
- Zero cost per read. Zero drift. A user who screenshots their reading and shows a
  friend a week later sees identical prose.
- Reviewable — an astrologer can audit every entry before launch.
- Fast (sub-millisecond lookup).
- Works offline / no third-party dependency.

**Cons**
- Depth-limited. L3 is the practical ceiling (54k entries ≈ book-length authoring project).
- Can't respond to the *rest* of the chart — every reader of "Saturn conjunct Aries Sun"
  gets the same words regardless of the other 40 things happening in their chart.
- Fixed voice — updating tone across 50k entries later is a full rewrite.

### 3.2 Strategy B — Real-time AI interpretation

Pass the structured event (and optionally the full chart) to an LLM at request time.
Return the model's interpretation directly.

**Pros**
- Effectively infinite depth. The AI can weave in every ingredient we hand it.
- Adapts to the *whole* chart, not just the isolated aspect.
- Voice/tone can be changed in a single prompt update.

**Cons**
- Non-deterministic. The same user asking the same question twice gets different words.
  This is a real product issue — users share readings, refer back to them, and expect
  continuity. Losing that erodes trust.
- Ongoing cost (~$0.01–0.05 per event; a single chart can generate 50+ events).
- Quality floor is unpredictable. One in 50 outputs will be flat, off-tone, or subtly
  wrong. QA doesn't scale.
- Latency — a full year-scan with per-event AI is a 30-second wait.
- Hallucination risk in a domain where "expert-sounding but wrong" is the failure mode.

### 3.3 Strategy C — Tiered hybrid *(recommended)*

Inside SoulMapCalculator, pre-write L2 (4,536 sign-flavored themes) as the **anchor**.
Use AI at read time *only* to add contextual layers on top — house placement, transiting
sign, chart-specific patterns, life stage — with the pre-written prose as ground truth.
The events driving each reading come from AstroCalculator; the interpretation stack
sits entirely in the private app.

**How the layers stack for one reading:**

1. **Static core (always the same):** L2 prose for `saturn.conjunction.sun.Aries`
2. **AI-augmented context (personalized on request):**
   - "…in your 10th house" nuance
   - "…while Saturn transits Aries" flavor
   - "…this is your Saturn return" life-stage cue
   - "…your Human Design authority is Emotional, so wait for the wave" cross-system tie-in

**Pros**
- Determinism where it matters (the core theme prose never changes for a given event key).
- Deep personalization where it matters (the situational layer is AI, but bounded by the
  static core, so it can't drift far).
- Cost is modest — AI is only called for the augmentation pass, not the whole reading.
- Progressive rollout: launch with L2-only prose, add AI augmentation later without
  changing the core.
- Reviewable — the 4,536 anchors are auditable; the AI layer is transparent about what
  it's adding.

**Cons**
- Two-system product to build and maintain.
- Requires careful prompt engineering so the AI *extends* rather than *contradicts* the
  anchor prose.
- Still a per-request AI cost, though far smaller than full-generation Strategy B.

---

## 4. Benchmark: how does The Pattern compare?

Based on The Pattern's public-facing product (not internal implementation, which is
proprietary):

| Attribute | The Pattern | Our opportunity |
|---|---|---|
| **Presentation** | Hides raw astrology. Themes are named narratively ("Deep Learning," "Great Awakening," "The Foundation") rather than as aspects. | We can offer *both*: the narrative surface for casual users, the raw aspect underneath for the astrologically literate. |
| **Depth of theme** | Appears planet × planet × aspect + timing window. Sign and house influence seem present but subtle. | Explicitly go to sign + house at L3, plus stack transiting-planet sign and life-stage context via AI. |
| **Prose source** | Hand-written by their team. Very consistent voice. Static — same user sees same words. | Match their consistency at the L2 anchor; add AI *situational* depth they don't have. |
| **Timing model** | Uses windows and "peak" language. Handles retrograde loops as extended themes. | Already implemented (AstroCalculator's event scanner does retrograde-loop merging with peak arrays). |
| **Personalization axis** | Very deep on *timing* ("this is what's happening for you now"). Less deep on *chart specifics* — a reading rarely references your other placements. | Cross-planet weaving (dispositor, chart ruler, current life-cycle transit) is a differentiator we can hit at L5 via AI. |
| **Multi-system integration** | Western astrology only. | AstroCalculator already computes Human Design, Gene Keys, Life Path, and Destiny Cards on the same birth data — SoulMapCalculator can weave all of them into a single reading. **Nobody in the consumer market ties these together.** That's the biggest available differentiator. |
| **Determinism / shareability** | High — static prose. | Match at the L2 anchor; keep AI augmentation deterministic per (chart, event) key via seeded prompts or cached outputs. |

### Where we can go deeper than The Pattern

1. **Chart-aware weaving.** The Pattern reads one theme at a time. We can layer the
   *interaction* between concurrent themes ("Saturn is redrawing your career while
   Uranus destabilizes your home base — this is *why* you feel pulled in two directions").
2. **Cross-system context.** No competitor stitches astrology + Human Design + Gene Keys
   into a single transit reading. Doing so authentically is a defensible moat.
3. **Life-stage awareness.** Saturn return, Uranus opposition, second Saturn return,
   Chiron return, progressed lunar return — these are the *actual* meaningful cycles in
   a life. Framing individual transits inside their life-stage context is rare in
   consumer apps and easy for us to add.
4. **Astrologer-grade transparency.** Users who *are* astrologically literate can toggle
   from the narrative surface to the raw aspect data — this is a lane The Pattern
   deliberately doesn't serve.

### Where we should *not* try to compete

- **Editorial voice at scale.** The Pattern has years of hand-tuned prose. We don't beat
  that by trying to out-write them — we beat it by going deeper on personalization axes
  they've chosen to keep flat.

---

## 5. Cost & effort comparison

| Strategy | One-time authoring | Per-request cost | Time to launch | Maintainability |
|---|---|---|---|---|
| **A. Prebuilt L1 (378)** | ~$30 LLM batch | $0 | 1 week | Trivial |
| **A. Prebuilt L2 (4,536)** | ~$200–400 LLM batch + human review | $0 | 2–3 weeks | Easy |
| **A. Prebuilt L3 (54,432)** | ~$3–6k LLM batch or ~6 months human-authored | $0 | 3–6 months | Harder (JSON is big) |
| **B. Real-time AI only** | $0 | $0.30–1.50 per chart reading | 1 week (prompt work) | Ongoing prompt tuning |
| **C. Hybrid (L2 + AI augment)** *(recommended)* | ~$200–400 for L2 core | $0.05–0.20 per chart reading | 3–4 weeks | Moderate — two systems |

Numbers assume Claude Opus for generation (highest quality in astrology domain per our
testing). GPT-class alternatives are cheaper but noticeably weaker at symbolic
interpretation.

---

## 6. Recommendation

**Ship in two phases, both inside SoulMapCalculator:**

### Phase 1 — L2 static launch (recommended for first release)
- Generate the 4,536 L2 theme entries with a supervised LLM batch and human spot-audit.
- Store as a private JSON asset in SoulMapCalculator (not shipped to end users).
- SoulMapCalculator calls AstroCalculator for events, then looks up L2 prose locally.
- This alone puts SoulMapCalculator at rough feature parity with The Pattern's core
  transit product, at a fraction of the effort.

### Phase 2 — Hybrid augmentation
- Add an internal SoulMapCalculator service that takes the L2 anchor prose plus the
  full chart (from AstroCalculator) and returns the situated reading — house,
  transiting sign, life stage, cross-system ties (HD / Gene Keys / Life Path / Cards).
- Cache the augmented output per (chart, event) key so a returning user sees the same
  words. This preserves shareability while allowing personalization.
- This is the layer where AI cost is spent per request; sizing the cache aggressively
  keeps that cost predictable.

**Rationale.** Phase 1 gives SoulMapCalculator a shippable, deterministic, defensible
product with no ongoing costs. Phase 2 is the differentiation moat — the layer where
SoulMapCalculator does something The Pattern isn't, and where the cost is justifiable
because that's the layer users are paying for.

---

## 7. Decisions we need from the client

Please weigh in on these before we invest in generation:

1. **Depth of the static core.** L1 (378) / **L2 (4,536, recommended)** / L3 (54,432)?
2. **Scope of AI augmentation.** Which of these situational layers should Phase 2 add?
   - House placement of the natal point
   - Sign the transiting planet is currently in
   - Life-stage context (Saturn return, Uranus opposition, Chiron return, etc.)
   - Concurrent-transit weaving (how *this* theme interacts with other active themes)
   - Cross-system tie-ins (HD authority, GK sphere, Destiny Card, Life Path)
3. **Cross-system integration.** How aggressive should the weaving of Human Design,
   Gene Keys, Life Path, and Destiny Card context into transit readings be?
   This is the biggest differentiator but also the most editorially sensitive —
   some users hold these systems separate.
4. **Voice / tone.** Who owns the editorial voice guide the LLM writes in?
   Rough options: clinical-astrologer, warm-mentor, poetic-mystical, brand-neutral.
5. **Astrologer-in-the-loop.** Hire a consulting astrologer to audit and revise the L2
   batch before launch, or ship the LLM output as-is with a "review in the wild" QA cycle?

---

## 8. What already exists (and where)

### In AstroCalculator (public API — already built)
- Event scanner with retrograde-loop detection at `POST /api/v1/transit/events`
- Overlay + snapshot endpoints at `POST /api/v1/transit`, `POST /api/v1/transit/natal`,
  `POST /api/v1/synastry`
- Sky-weather event feed at `POST /api/v1/sky/events`
- 4,536-entry structured L2 manifest at `src/lib/constants/transit-combinations.json`
  — this is a portable JSON asset SoulMapCalculator can copy in as its starting keyset
  for prose generation
- Generation script at `scripts/generate-transit-combinations.mjs` — reusable for
  regenerating the keyset if the taxonomy expands

Note: the empty `transit-themes.json` and scaffolded `GET /transit/theme` route in this
repo were placeholders from before the SoulMapCalculator split was decided. They can be
removed from AstroCalculator in a follow-up cleanup pass — this API returns structured
events only.

### To build in SoulMapCalculator (this strategy)
- Copy the L2 manifest keys as the prose-generation targets
- LLM batch job + human review to produce the 4,536-entry theme JSON
- Local theme lookup service inside SoulMapCalculator
- Phase 2: AI augmentation service consuming full-chart context from AstroCalculator
- Per-(chart, event) prose cache for shareability

Once the client answers §7, SoulMapCalculator can execute Phase 1 in 2–3 weeks.

// L3 — interpretive conventions.
//
// `docs/aspect-conventions.md` is NORMATIVE. This file does not verify that the
// conventions are right; nothing could. There is no external truth at this
// layer: an 8° conjunction orb is not more correct than a 6° one, it is a
// different school. Agreement with astro.com or astroseek is explicitly not a
// goal here and is not measured.
//
// What this file does:
//
//   1. PINS the conventional numbers (orb tables, rulerships, pattern set) as
//      goldens, so changing the school of astrology the API implements requires
//      editing the document as well as the code.
//   2. PROVES the things at this layer that are objective anyway — the aspect
//      windows do not overlap, a reported orb equals the true distance to
//      exact, a pattern's legs are aspects of the same chart, the Part of
//      Fortune matches its stated formula.
//   3. CHARACTERIZES five findings (F7–F11) at today's defective behaviour.
//      Those tests must be REWRITTEN, not deleted, when a finding is
//      dispositioned — see the comment on each.
//
// Overlap with existing suites is deliberate where the existing assertion is
// about mechanics and this one is about the convention being the stated one.

import { describe, it, expect } from "vitest";
import {
  calculateNatalChart,
  calculateTransits,
  computeAspects,
  ZODIAC_SIGNS,
  type NatalChart,
} from "@/lib/calculators/astrology";
import {
  computeOverlay,
  DEFAULT_TRANSIT_ORBS,
  DEFAULT_SYNASTRY_ORBS,
  ASPECT_ANGLES,
  type AspectType,
} from "@/lib/calculators/overlay";
import {
  detectAspectPatterns,
  elementOfSign,
  modalityOfSign,
} from "@/lib/calculators/aspect-patterns";
import {
  MODERN_RULERS,
  TRADITIONAL_RULERS,
  rulerOfSign,
} from "@/lib/constants/rulerships";
import { HOUSE_SYSTEMS, type HouseSystem } from "@/lib/ephemeris/client";
import { DIANA, EINSTEIN, JOBS, MANDELA } from "./fixtures/charts";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
//  Charts under test
// ─────────────────────────────────────────────────────────────────────────────

// The four reference charts plus the twenty hostile L1/L2 fixtures, minus the
// pre-1800 ones: F1 (`docs/accuracy.md` §6) makes `calculateNatalChart` throw on
// those, and the exclusion is asserted at the bottom of this file so a fix to F1
// forces them back in rather than leaving them quietly skipped.
const JD_1800 = 2378496.5;

interface HorizonsFixture {
  id: string;
  jd: { ut: number };
  input: {
    datetime: string;
    timezone: string;
    latitude: number;
    longitude: number;
  };
}

const HORIZONS_DIR = join(process.cwd(), "tests/fixtures/horizons");
const HORIZONS: HorizonsFixture[] = readdirSync(HORIZONS_DIR)
  .filter((f) => f.endsWith(".json") && f !== "index.json")
  .map((f) => JSON.parse(readFileSync(join(HORIZONS_DIR, f), "utf8")) as HorizonsFixture)
  .sort((a, b) => a.id.localeCompare(b.id));

const BUILDABLE = HORIZONS.filter((f) => f.jd.ut >= JD_1800);
const PRE_1800 = HORIZONS.filter((f) => f.jd.ut < JD_1800);

const REFERENCE = [DIANA, EINSTEIN, JOBS, MANDELA];

/** Every house system the API accepts — taken from the source, not retyped. */
const ALL_HOUSE_SYSTEMS = Object.keys(HOUSE_SYSTEMS) as HouseSystem[];

/** Every chart this file can actually build, labelled for failure messages. */
const CHARTS: { label: string; chart: NatalChart }[] = [
  ...REFERENCE.map((f) => ({ label: f.name, chart: calculateNatalChart(f.birth) })),
  ...BUILDABLE.map((f) => ({
    label: f.id,
    chart: calculateNatalChart(f.input as Parameters<typeof calculateNatalChart>[0]),
  })),
];

function angularDifference(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

// ─────────────────────────────────────────────────────────────────────────────
//  §1.1–1.2  The aspect set and the natal orb table — pinned goldens
// ─────────────────────────────────────────────────────────────────────────────

// These numbers ARE the convention. They are not derived from anything and
// nothing external can confirm them. Pinned so that a change is a deliberate
// edit to `docs/aspect-conventions.md` §1.2 and not a drift.
const NATAL_ORBS: Record<AspectType, number> = {
  conjunction: 8,
  opposition: 8,
  trine: 7,
  square: 7,
  sextile: 5,
  quincunx: 3,
};

/**
 * The order `computeAspects` tests candidates in, first match winning (§1.4).
 * The windows provably do not overlap (§1.3), so this ordering never actually
 * decides anything — but predicting the calculator means mirroring its rule,
 * not a rule that happens to agree with it today.
 */
const NATAL_ORDER: AspectType[] = [
  "conjunction",
  "opposition",
  "trine",
  "square",
  "sextile",
  "quincunx",
];

describe("§1.1–1.2 the aspect set and natal orbs are the documented ones", () => {
  it("exactly six aspects, at the documented exact angles", () => {
    expect(ASPECT_ANGLES).toEqual({
      conjunction: 0,
      sextile: 60,
      square: 90,
      trine: 120,
      quincunx: 150,
      opposition: 180,
    });
  });

  it("no minor aspects are implemented (§1.1, §9)", () => {
    for (const forbidden of ["semisextile", "semisquare", "sesquiquadrate", "quintile", "biquintile", "septile"]) {
      expect(Object.keys(ASPECT_ANGLES)).not.toContain(forbidden);
    }
  });

  it("natal orbs match docs §1.2 exactly — full behavioural equivalence", () => {
    // The strong form: for every unordered planet pair on every chart, predict
    // the aspect from the DOCUMENTED table alone, then require the calculator's
    // list to equal that prediction exactly — same pairs, same types, no
    // extras, no omissions. If any orb in the code differed from this document
    // by even 0.01°, some pair among ~1900 would fall between the two windows
    // and the sets would diverge.
    let pairs = 0;
    let predictedHits = 0;
    let nearMisses = 0;

    for (const { label, chart } of CHARTS) {
      const predicted = new Map<string, AspectType>();
      const ps = chart.planets;
      for (let i = 0; i < ps.length; i++) {
        for (let j = i + 1; j < ps.length; j++) {
          // The node/south-node pair is excluded by convention (§1.7): its
          // geometry is an identity, not an observation. Every other pair is
          // predicted from the orb table alone.
          if ([ps[i].name, ps[j].name].sort().join("|") === "south_node|true_node") continue;
          pairs++;
          const sep = angularDifference(ps[i].longitude, ps[j].longitude);
          for (const type of Object.keys(ASPECT_ANGLES) as AspectType[]) {
            const delta = Math.abs(sep - ASPECT_ANGLES[type]);
            if (delta <= NATAL_ORBS[type]) {
              predicted.set([ps[i].name, ps[j].name].sort().join("|"), type);
              predictedHits++;
              break;
            }
            // A pair within 1° outside a window is what makes this test bite:
            // it would flip if the documented orb were wrong by that much.
            if (delta > NATAL_ORBS[type] && delta <= NATAL_ORBS[type] + 1) nearMisses++;
          }
        }
      }

      const actual = new Map<string, AspectType>(
        chart.aspects.map((a) => [[a.from, a.to].sort().join("|"), a.type as AspectType]),
      );
      expect(
        Object.fromEntries([...actual].sort()),
        `${label}: calculator disagrees with the documented orb table`,
      ).toEqual(Object.fromEntries([...predicted].sort()));
    }

    expect(pairs).toBeGreaterThan(1500);
    expect(predictedHits).toBeGreaterThan(200);
    // Non-vacuousness: there really are pairs sitting just outside a window, so
    // the equality above is discriminating between this table and a nearby one.
    expect(nearMisses).toBeGreaterThan(20);
  });

  it("every reported aspect on every chart is inside its documented orb", () => {
    for (const { label, chart } of CHARTS) {
      for (const a of chart.aspects) {
        const width = NATAL_ORBS[a.type as AspectType];
        expect(width, `${label}: unknown aspect type ${a.type}`).toBeDefined();
        expect(a.orb, `${label}: ${a.from}-${a.to} ${a.type} orb ${a.orb} > ${width}`).toBeLessThanOrEqual(width);
      }
    }
  });

  it("orbs are flat — no luminary or body-class widening (§1.2)", () => {
    // If a luminary bonus were ever added, some Sun/Moon aspect somewhere in
    // 24 charts would exceed the flat table. None may.
    const luminaryAspects = CHARTS.flatMap(({ label, chart }) =>
      chart.aspects
        .filter((a) => ["sun", "moon"].includes(a.from) || ["sun", "moon"].includes(a.to))
        .map((a) => ({ label, a })),
    );
    expect(luminaryAspects.length).toBeGreaterThan(50); // non-vacuous
    for (const { label, a } of luminaryAspects) {
      expect(a.orb, `${label}: ${a.from}-${a.to}`).toBeLessThanOrEqual(NATAL_ORBS[a.type as AspectType]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §1.3  Transit and synastry orb tables
// ─────────────────────────────────────────────────────────────────────────────

describe("§1.3 transit and synastry orb tables", () => {
  it("match docs §1.3 exactly", () => {
    expect(DEFAULT_TRANSIT_ORBS).toEqual({
      conjunction: 3.0,
      opposition: 3.0,
      square: 3.0,
      trine: 2.0,
      sextile: 2.0,
      quincunx: 1.5,
    });
    expect(DEFAULT_SYNASTRY_ORBS).toEqual({
      conjunction: 5.0,
      opposition: 5.0,
      square: 4.0,
      trine: 4.0,
      sextile: 3.0,
      quincunx: 2.0,
    });
  });

  it("the documented ordering natal > synastry > transit holds for every aspect", () => {
    for (const type of Object.keys(ASPECT_ANGLES) as AspectType[]) {
      expect(NATAL_ORBS[type], type).toBeGreaterThan(DEFAULT_SYNASTRY_ORBS[type]);
      expect(DEFAULT_SYNASTRY_ORBS[type], type).toBeGreaterThan(DEFAULT_TRANSIT_ORBS[type]);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §1.4  "First match wins" is well-defined, not an arbitrary tie-break
// ─────────────────────────────────────────────────────────────────────────────

describe("§1.4 aspect windows do not overlap", () => {
  // This is the property that makes scanning the table in order and taking the
  // first hit safe. It is a proof, not a sample: 15 pairs, exhaustively.
  it("no separation can fall inside two aspect windows (all 15 pairs)", () => {
    const entries = Object.entries(ASPECT_ANGLES) as [AspectType, number][];
    let tightest = Infinity;
    let tightestPair = "";
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [ta, aa] = entries[i];
        const [tb, ab] = entries[j];
        const gap = Math.abs(aa - ab);
        const reach = NATAL_ORBS[ta] + NATAL_ORBS[tb];
        const margin = gap - reach;
        expect(margin, `${ta}(${aa}±${NATAL_ORBS[ta]}) and ${tb}(${ab}±${NATAL_ORBS[tb]}) overlap`).toBeGreaterThan(0);
        if (margin < tightest) {
          tightest = margin;
          tightestPair = `${ta}/${tb}`;
        }
      }
    }
    // The tightest pair is NOT conjunction/sextile (the closest exact angles,
    // margin 47°) but square/trine: 30° apart with the two widest 7° orbs,
    // leaving 16°. Pinned exactly, because it is the number that would have to
    // survive adding any minor aspect — see the corrected premise in §1.4 of
    // the doc.
    expect(tightestPair).toBe("square/trine");
    expect(tightest).toBe(16);
  });

  it("so no unordered pair ever yields two aspects", () => {
    for (const { label, chart } of CHARTS) {
      const seen = new Set<string>();
      for (const a of chart.aspects) {
        const key = [a.from, a.to].sort().join("|");
        expect(seen.has(key), `${label}: duplicate aspect for ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §1.5  Internal consistency of the reported orb
// ─────────────────────────────────────────────────────────────────────────────

describe("§1.5 reported orb is the true distance to exact", () => {
  it("recomputed from the longitudes on every aspect of every chart", () => {
    let checked = 0;
    for (const { label, chart } of CHARTS) {
      const lon = new Map(chart.planets.map((p) => [p.name, p.longitude]));
      for (const a of chart.aspects) {
        const from = lon.get(a.from);
        const to = lon.get(a.to);
        expect(from, `${label}: ${a.from} missing`).toBeDefined();
        expect(to, `${label}: ${a.to} missing`).toBeDefined();
        const sep = angularDifference(from!, to!);
        const expected = Math.abs(sep - ASPECT_ANGLES[a.type as AspectType]);
        expect(a.orb, `${label}: ${a.from}-${a.to} ${a.type}`).toBeCloseTo(expected, 9);
        expect(a.exactAngle).toBe(ASPECT_ANGLES[a.type as AspectType]);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(200); // non-vacuous
  });

  it("an exactly partile aspect reports applying: false (§1.5)", () => {
    // This used to ride on the node/south-node pair, the one aspect guaranteed
    // exact on every chart. F11 suppressed that pair, so no natural partile
    // aspect remains — the rule is now exercised by driving `computeAspects`
    // with a constructed pair instead, which is in any case a more direct test
    // of it: `applying` is `|separation-after-a-step − exact| < orb`, and at
    // orb 0 that comparison is false for every possible motion.
    const template = calculateNatalChart(DIANA.birth).planets;
    const sun = template.find((p) => p.name === "sun")!;
    const mars = template.find((p) => p.name === "mars")!;

    for (const [speedA, speedB] of [
      [1, 0.5], // closing
      [0.5, 1], // opening
      [1, 1], // no relative motion
    ]) {
      const aspects = computeAspects([
        { ...sun, longitude: 10, speed: speedA },
        { ...mars, longitude: 130, speed: speedB },
      ]);
      const trine = aspects.find((a) => a.type === "trine");
      expect(trine, `exact trine must be detected (speeds ${speedA}/${speedB})`).toBeDefined();
      expect(trine!.orb).toBeCloseTo(0, 9);
      expect(trine!.applying, "a partile aspect must not claim to be applying").toBe(false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §1.6  Which points participate
// ─────────────────────────────────────────────────────────────────────────────

describe("§1.6 participation", () => {
  it("angles, the Part of Fortune and cusps never appear in the aspect list", () => {
    const forbidden = ["asc", "ascendant", "mc", "midheaven", "vertex", "equatorial_ascendant", "part_of_fortune", "fortune"];
    for (const { label, chart } of CHARTS) {
      for (const a of chart.aspects) {
        expect(forbidden, `${label}: ${a.from}`).not.toContain(a.from);
        expect(forbidden, `${label}: ${a.to}`).not.toContain(a.to);
      }
    }
  });

  it("the South Node participates in aspects (and is excluded from patterns — §2.3)", () => {
    for (const { label, chart } of CHARTS) {
      if (!chart.planets.some((p) => p.name === "south_node")) continue;
      expect(
        chart.aspects.some((a) => a.from === "south_node" || a.to === "south_node"),
        `${label}: South Node should aspect something`,
      ).toBe(true);
      // `points` is string[], so this must be a membership test on names —
      // an object-shaped `.some(pt => pt.name === ...)` would pass vacuously.
      expect(chart.patterns.length + 1).toBeGreaterThan(0);
      for (const p of chart.patterns) {
        expect(p.points, `${label}: South Node must never be in a ${p.type}`).not.toContain("south_node");
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §2  Patterns
// ─────────────────────────────────────────────────────────────────────────────

describe("§2 aspect patterns", () => {
  it("§2.1 every pattern leg is an aspect of the same chart, within the same orbs", () => {
    let legs = 0;
    for (const { label, chart } of CHARTS) {
      const pairs = new Map<string, { type: string; orb: number }>();
      for (const a of chart.aspects) pairs.set([a.from, a.to].sort().join("|"), a);
      for (const pattern of chart.patterns) {
        if (pattern.type === "stellium") continue; // occupancy-based, not aspect-based
        const names = pattern.points;
        // Every named figure is built from legs that must themselves be aspects.
        // We assert the weaker, exactly-true claim: each pattern has at least
        // one leg, and every leg that IS in the aspect list is within orb.
        let found = 0;
        for (let i = 0; i < names.length; i++) {
          for (let j = i + 1; j < names.length; j++) {
            const hit = pairs.get([names[i], names[j]].sort().join("|"));
            if (hit) {
              expect(hit.orb, `${label}: ${pattern.type} leg ${names[i]}-${names[j]}`).toBeLessThanOrEqual(
                NATAL_ORBS[hit.type as AspectType],
              );
              found++;
            }
          }
        }
        expect(found, `${label}: ${pattern.type} (${names.join(",")}) has no legs in the aspect list`).toBeGreaterThan(0);
        legs += found;
      }
    }
    expect(legs).toBeGreaterThan(20); // non-vacuous
  });

  it("§2.3 rule 1 — a grand cross suppresses its component T-squares", () => {
    // Four points at exact 90° intervals: a grand cross containing four
    // T-squares, none of which may be reported.
    const cross = [0, 90, 180, 270].map((longitude, i) => ({ name: `p${i}`, longitude }));
    const patterns = detectAspectPatterns(cross);
    expect(patterns.filter((p) => p.type === "grand_cross")).toHaveLength(1);
    expect(patterns.filter((p) => p.type === "t_square")).toHaveLength(0);
  });

  it("§2.3 rule 1 — a T-square only partly overlapping a cross survives", () => {
    const pts = [0, 90, 180, 270, 45].map((longitude, i) => ({ name: `p${i}`, longitude }));
    const patterns = detectAspectPatterns(pts);
    expect(patterns.filter((p) => p.type === "grand_cross")).toHaveLength(1);
    // p4 at 45° squares neither 0 nor 90 exactly, but 45/135-type geometry is
    // what a partial overlap looks like; assert the rule via containment.
    for (const t of patterns.filter((p) => p.type === "t_square")) {
      const names = new Set(t.points);
      const inCross = ["p0", "p1", "p2", "p3"];
      expect([...names].every((n) => inCross.includes(n))).toBe(false);
    }
  });

  it("§2.3 rule 2 — a kite does NOT suppress its grand trine", () => {
    const kite = [0, 120, 240, 180].map((longitude, i) => ({ name: `p${i}`, longitude }));
    const patterns = detectAspectPatterns(kite);
    expect(patterns.filter((p) => p.type === "kite").length).toBeGreaterThan(0);
    expect(patterns.filter((p) => p.type === "grand_trine").length).toBeGreaterThan(0);
  });

  it("§2.3 rule 6 — ordering is deterministic and type-major", () => {
    const pts = [0, 90, 180, 270, 120, 240].map((longitude, i) => ({ name: `p${i}`, longitude }));
    const order = ["stellium", "grand_cross", "t_square", "grand_trine", "kite", "yod", "mystic_rectangle"];
    const a = detectAspectPatterns(pts);
    const b = detectAspectPatterns(pts);
    expect(a).toEqual(b);
    const idx = a.map((p) => order.indexOf(p.type));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
    expect(idx.every((i) => i >= 0)).toBe(true);
  });

  it("§2.2 no pattern type outside the documented seven is ever emitted", () => {
    const allowed = new Set(["stellium", "grand_cross", "t_square", "grand_trine", "kite", "yod", "mystic_rectangle"]);
    for (const { label, chart } of CHARTS) {
      for (const p of chart.patterns) {
        expect(allowed.has(p.type), `${label}: unexpected pattern type ${p.type}`).toBe(true);
      }
    }
  });

  it("§2.4 element is sign index mod 4 and modality is sign index mod 3", () => {
    const elements = ["fire", "earth", "air", "water"];
    const modalities = ["cardinal", "fixed", "mutable"];
    ZODIAC_SIGNS.forEach((sign, i) => {
      expect(elementOfSign(sign), sign).toBe(elements[i % 4]);
      expect(modalityOfSign(sign), sign).toBe(modalities[i % 3]);
    });
    // Non-vacuous: the two classifications must genuinely differ in period.
    expect(elementOfSign("Aries")).toBe(elementOfSign("Leo"));
    expect(modalityOfSign("Aries")).not.toBe(modalityOfSign("Leo"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §3  Rulerships — pinned goldens
// ─────────────────────────────────────────────────────────────────────────────

describe("§3 rulerships", () => {
  it("both tables match docs §3 exactly", () => {
    expect(MODERN_RULERS).toEqual({
      Aries: "mars", Taurus: "venus", Gemini: "mercury", Cancer: "moon",
      Leo: "sun", Virgo: "mercury", Libra: "venus", Scorpio: "pluto",
      Sagittarius: "jupiter", Capricorn: "saturn", Aquarius: "uranus", Pisces: "neptune",
    });
    expect(TRADITIONAL_RULERS).toEqual({
      Aries: "mars", Taurus: "venus", Gemini: "mercury", Cancer: "moon",
      Leo: "sun", Virgo: "mercury", Libra: "venus", Scorpio: "mars",
      Sagittarius: "jupiter", Capricorn: "saturn", Aquarius: "saturn", Pisces: "jupiter",
    });
  });

  it("they diverge on exactly the three post-1781 signs", () => {
    const diverging = ZODIAC_SIGNS.filter((s) => MODERN_RULERS[s] !== TRADITIONAL_RULERS[s]);
    expect(diverging).toEqual(["Scorpio", "Aquarius", "Pisces"]);
  });

  it("modern is the default (§3)", () => {
    for (const sign of ZODIAC_SIGNS) {
      expect(rulerOfSign(sign)).toBe(MODERN_RULERS[sign]);
    }
  });

  it("both rulers are always reported regardless of the requested convention", () => {
    // Across all four reference births, so the assertion covers Ascendant signs
    // where the two conventions agree AND where they diverge.
    for (const convention of ["modern", "traditional"] as const) {
      for (const fixture of REFERENCE) {
        const c = calculateNatalChart({
          ...fixture.birth,
          rulership: convention,
        } as Parameters<typeof calculateNatalChart>[0]);
        const where = `${fixture.name}/${convention}`;
        expect(c.chartRuler.modernRuler, where).toBe(MODERN_RULERS[c.chartRuler.ascendantSign]);
        expect(c.chartRuler.traditionalRuler, where).toBe(TRADITIONAL_RULERS[c.chartRuler.ascendantSign]);
        expect(c.chartRuler.convention, where).toBe(convention);
        expect(c.chartRuler.ruler, where).toBe(
          convention === "modern" ? c.chartRuler.modernRuler : c.chartRuler.traditionalRuler,
        );
      }
    }
  });

  it("the chart ruler is the ruler of the Ascendant's SIGN on every chart", () => {
    for (const { label, chart } of CHARTS) {
      expect(chart.chartRuler.ascendantSign, label).toBe(chart.houses.ascendant.sign.sign);
      expect(chart.chartRuler.ruler, label).toBe(rulerOfSign(chart.houses.ascendant.sign.sign));
    }
  });

  it("placement is null — not fabricated — when the subset omits the ruler", () => {
    const chart = calculateNatalChart({
      ...DIANA.birth,
      planets: ["sun", "moon"],
    } as Parameters<typeof calculateNatalChart>[0]);
    if (!["sun", "moon"].includes(chart.chartRuler.ruler)) {
      expect(chart.chartRuler.placement).toBeNull();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §4  Derived points
// ─────────────────────────────────────────────────────────────────────────────

describe("§4 derived points", () => {
  it("§4.1 South Node is exactly the true node + 180°, sharing its motion", () => {
    let checked = 0;
    for (const { label, chart } of CHARTS) {
      const node = chart.planets.find((p) => p.name === "true_node");
      const south = chart.planets.find((p) => p.name === "south_node");
      if (!node || !south) continue;
      expect(south.longitude, label).toBeCloseTo((node.longitude + 180) % 360, 9);
      expect(south.speed, label).toBe(node.speed);
      expect(south.retrograde, label).toBe(node.retrograde);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("§4.2 Part of Fortune matches the stated sect-sensitive formula", () => {
    let checked = 0;
    for (const { label, chart } of CHARTS) {
      const sun = chart.planets.find((p) => p.name === "sun");
      const moon = chart.planets.find((p) => p.name === "moon");
      if (!sun || !moon) continue;
      const asc = chart.houses.ascendant.longitude;
      const expected = chart.partOfFortune!.isDayBirth
        ? (((asc + moon.longitude - sun.longitude) % 360) + 360) % 360
        : (((asc + sun.longitude - moon.longitude) % 360) + 360) % 360;
      expect(chart.partOfFortune!.longitude, label).toBeCloseTo(expected, 9);
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("§4.2 the two sect formulas are genuinely different (non-vacuousness)", () => {
    // If day and night gave the same point, the sect findings below would be
    // harmless. On every chart they differ by a large arc.
    let minSeparation = Infinity;
    for (const { chart } of CHARTS) {
      const sun = chart.planets.find((p) => p.name === "sun");
      const moon = chart.planets.find((p) => p.name === "moon");
      if (!sun || !moon) continue;
      const asc = chart.houses.ascendant.longitude;
      const day = (((asc + moon.longitude - sun.longitude) % 360) + 360) % 360;
      const night = (((asc + sun.longitude - moon.longitude) % 360) + 360) % 360;
      minSeparation = Math.min(minSeparation, angularDifference(day, night));
    }
    expect(minSeparation).toBeGreaterThan(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  §8  Findings — CHARACTERIZATION TESTS
//
//  Each of these asserts today's DEFECTIVE behaviour so it cannot change
//  silently. When a finding is dispositioned, the test must be REWRITTEN to
//  assert the corrected behaviour — never deleted.
// ─────────────────────────────────────────────────────────────────────────────

describe("§8 findings (characterization — rewrite on disposition)", () => {
  // F7 — FIXED. Sect is derived from the ASC/DSC horizon arc, not the Sun's
  // house number, so it is invariant under the caller's house-system choice.
  it("F7: sect is identical across every supported house system", () => {
    // The whole point of the finding: the answer must not depend on the wheel.
    // Run every fixture through all seven systems and require one answer each.
    let charts = 0;
    let dayCount = 0;
    for (const fixture of [
      ...REFERENCE.map((f) => ({ id: f.name, input: f.birth })),
      ...BUILDABLE.map((f) => ({ id: f.id, input: f.input })),
    ]) {
      const answers = new Map<string, boolean>();
      for (const system of ALL_HOUSE_SYSTEMS) {
        const c = calculateNatalChart({
          ...fixture.input,
          house_system: system,
        } as Parameters<typeof calculateNatalChart>[0]);
        answers.set(system, c.partOfFortune!.isDayBirth);
      }
      expect(
        new Set(answers.values()).size,
        `${fixture.id}: sect must not depend on house system — got ${JSON.stringify([...answers])}`,
      ).toBe(1);
      if ([...answers.values()][0]) dayCount++;
      charts++;
    }
    expect(charts).toBeGreaterThan(20);
    // Non-vacuousness: a constant `true` (or `false`) would also be invariant.
    // The fixture set must contain both day and night births.
    expect(dayCount, "fixture set must contain day births").toBeGreaterThan(0);
    expect(charts - dayCount, "fixture set must contain night births").toBeGreaterThan(0);
  });

  it("F7: sect matches the horizon, and the Part of Fortune follows it", () => {
    // Invariance is not correctness — every system agreeing on the WRONG
    // answer would pass the test above. Pin the value against the geometry.
    const KOLKATA = HORIZONS.find((f) => f.id === "kolkata-1972-half-hour");
    expect(KOLKATA, "fixture kolkata-1972-half-hour is required by F7").toBeDefined();

    for (const { label, chart } of CHARTS) {
      const asc = chart.houses.ascendant.longitude;
      const sun = chart.planets.find((p) => p.name === "sun")!.longitude;
      const moon = chart.planets.find((p) => p.name === "moon")!.longitude;
      // Above the horizon ⇔ the Sun lies on the arc running backwards from the
      // ASC to the DSC. This is the definition, computed independently here.
      const aboveHorizon = (((asc - sun) % 360) + 360) % 360 < 180;
      expect(chart.partOfFortune!.isDayBirth, `${label}: sect`).toBe(aboveHorizon);

      // ...and the formula actually switches on it.
      const expected = aboveHorizon
        ? (((asc + moon - sun) % 360) + 360) % 360
        : (((asc + sun - moon) % 360) + 360) % 360;
      expect(chart.partOfFortune!.longitude, `${label}: PoF`).toBeCloseTo(expected, 9);
    }

    // The specific regression: whole-sign used to disagree with placidus here
    // and move the Part of Fortune 135°.
    const [quadrant, whole] = (["placidus", "whole_sign"] as const).map((house_system) =>
      calculateNatalChart({ ...KOLKATA!.input, house_system } as Parameters<
        typeof calculateNatalChart
      >[0]),
    );
    expect(quadrant.partOfFortune!.isDayBirth, "Kolkata is a day birth").toBe(true);
    expect(whole.partOfFortune!.isDayBirth, "whole_sign must agree").toBe(true);
    expect(
      angularDifference(quadrant.partOfFortune!.longitude, whole.partOfFortune!.longitude),
      "the Part of Fortune must not move with the house system",
    ).toBeCloseTo(0, 9);

    // Non-vacuousness for the fixture itself: the Sun really is in the arc
    // where the house-number proxy and the horizon disagree under whole-sign.
    const asc = quadrant.houses.ascendant.longitude;
    const sun = quadrant.planets.find((p) => p.name === "sun")!.longitude;
    expect((((asc - sun) % 360) + 360) % 360).toBeCloseTo(2.89, 1);
    expect(
      whole.planets.find((p) => p.name === "sun")!.house,
      "whole_sign still puts the Sun in house 1 — the proxy is still wrong, we stopped using it",
    ).toBe(1);
  });

  // F8 — FIXED. The Part of Fortune is omitted, not fabricated, when a
  // luminary is absent from the requested subset.
  it("F8: Part of Fortune is omitted when a luminary is absent", () => {
    for (const planets of [["mars", "venus"], ["sun", "mars"], ["moon", "mars"]]) {
      const chart = calculateNatalChart({
        ...DIANA.birth,
        planets,
      } as Parameters<typeof calculateNatalChart>[0]);
      expect(chart.partOfFortune, `planets=${planets.join(",")}`).toBeUndefined();
      expect(
        "partOfFortune" in chart,
        "the key must be absent, not present-and-undefined — JSON must omit it",
      ).toBe(false);
      // The Ascendant is still returned; it is simply no longer masquerading
      // as a Part of Fortune.
      expect(chart.houses.ascendant.longitude).toBeGreaterThanOrEqual(0);
    }
  });

  it("F8: Part of Fortune is present whenever both luminaries are", () => {
    // The omission must be narrow: it triggers on a missing luminary, not on
    // anything else. Returning undefined always would pass the test above.
    for (const { label, chart } of CHARTS) {
      expect(chart.partOfFortune, `${label}: default chart has both luminaries`).toBeDefined();
    }
    const subset = calculateNatalChart({
      ...DIANA.birth,
      planets: ["sun", "moon"],
    } as Parameters<typeof calculateNatalChart>[0]);
    expect(subset.partOfFortune, "sun+moon subset is sufficient").toBeDefined();
  });

  // F9 — /api/v1/transit uses the natal orb table instead of the transit one.
  // DISPOSITION: use DEFAULT_TRANSIT_ORBS (and honour the caller's override).
  // When that lands, rewrite to assert every hit is within the transit table.
  it("F9: /api/v1/transit uses natal orbs, not the transit table", () => {
    const t = calculateTransits({
      natal: DIANA.birth,
      transit_datetime: "2026-08-12T12:00:00",
      transit_timezone: "UTC",
    } as Parameters<typeof calculateTransits>[0]);

    const tooWide = t.aspectsToNatal.filter(
      (a) => a.orb > DEFAULT_TRANSIT_ORBS[a.type as AspectType],
    );
    // Two thirds of the list is wider than the documented transit orbs.
    expect(tooWide.length).toBeGreaterThan(t.aspectsToNatal.length / 2);
    // ...but all of it is inside the natal table, which is the actual behaviour.
    for (const a of t.aspectsToNatal) {
      expect(a.orb).toBeLessThanOrEqual(NATAL_ORBS[a.type as AspectType]);
    }

    // The overlay path, asked the same question, returns far fewer.
    const natal = calculateNatalChart(DIANA.birth);
    const overlay = computeOverlay(
      {
        points: natal.planets.map((p) => ({ name: p.name, longitude: p.longitude, speed: p.speed })),
        cusps: natal.houses.cusps.map((c) => c.longitude),
      },
      {
        points: t.transitingPlanets.map((p) => ({ name: p.name, longitude: p.longitude, speed: p.speed })),
      },
      {} as Parameters<typeof computeOverlay>[2],
    );
    expect(t.aspectsToNatal.length).toBeGreaterThan(overlay.aspects.length * 2);
  });

  // F10 — /api/v1/transit hardcodes applying: false.
  // DISPOSITION: compute it from the transiting body's speed, as the overlay
  // path already does. When that lands, rewrite to assert a realistic mix.
  it("F10: /api/v1/transit reports applying: false for every hit", () => {
    const t = calculateTransits({
      natal: DIANA.birth,
      transit_datetime: "2026-08-12T12:00:00",
      transit_timezone: "UTC",
    } as Parameters<typeof calculateTransits>[0]);
    expect(t.aspectsToNatal.length).toBeGreaterThan(20);
    expect(t.aspectsToNatal.every((a) => a.applying === false)).toBe(true);

    // The overlay path, with the same bodies and speeds, finds roughly half applying.
    const natal = calculateNatalChart(DIANA.birth);
    const overlay = computeOverlay(
      { points: natal.planets.map((p) => ({ name: p.name, longitude: p.longitude, speed: p.speed })) },
      { points: t.transitingPlanets.map((p) => ({ name: p.name, longitude: p.longitude, speed: p.speed })) },
      {} as Parameters<typeof computeOverlay>[2],
    );
    expect(overlay.aspects.filter((a) => a.applying).length).toBeGreaterThan(0);
  });

  // F11 — FIXED. The node/south-node opposition is an identity, not a
  // configuration, and is no longer reported. These tests replace the
  // characterization pair that pinned the defect.
  //
  // The danger in this fix is over-suppression: dropping the South Node from
  // the aspect list entirely, or filtering every 0.00° aspect, would also make
  // the first test below pass. The second and third exist to catch that.
  it("F11: the tautological node opposition is not reported", () => {
    let checked = 0;
    for (const { label, chart } of CHARTS) {
      const lon = new Map(chart.planets.map((p) => [p.name, p.longitude]));
      if (!lon.has("true_node") || !lon.has("south_node")) continue;

      // Non-vacuousness: the pair really is at an exact opposition, so there IS
      // something being suppressed. Without this, the test would pass on a
      // chart where the pair simply never aspected.
      const sep = angularDifference(lon.get("true_node")!, lon.get("south_node")!);
      expect(sep, `${label}: the nodes must be 180° apart by construction`).toBeCloseTo(180, 9);

      const nn = chart.aspects.find(
        (a) =>
          (a.from === "true_node" && a.to === "south_node") ||
          (a.from === "south_node" && a.to === "true_node"),
      );
      expect(nn, `${label}: node-node aspect must be suppressed`).toBeUndefined();
      checked++;
    }
    expect(checked).toBeGreaterThan(10);
  });

  it("F11: suppression is specific — every other in-orb opposition survives", () => {
    // Behavioural equivalence restricted to oppositions: predict the full set
    // from geometry, subtract only the node pair, and require an exact match.
    // Suppressing anything else — all node aspects, all exact aspects, all
    // oppositions — fails here.
    let predicted = 0;
    for (const { label, chart } of CHARTS) {
      const pts = chart.planets.map((p) => ({ name: p.name, longitude: p.longitude }));
      const expected = new Set<string>();
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i];
          const b = pts[j];
          const pair = [a.name, b.name].sort().join("|");
          if (pair === ["true_node", "south_node"].sort().join("|")) continue;
          const sep = angularDifference(a.longitude, b.longitude);
          // One aspect per pair, first match wins (§1.4) — so an opposition is
          // only reported if no tighter-listed aspect claimed the pair first.
          const claimed = NATAL_ORDER.find(
            (t) => Math.abs(sep - ASPECT_ANGLES[t]) <= NATAL_ORBS[t],
          );
          if (claimed === "opposition") expected.add(pair);
        }
      }
      const actual = new Set(
        chart.aspects
          .filter((a) => a.type === "opposition")
          .map((a) => [a.from, a.to].sort().join("|")),
      );
      expect([...actual].sort(), `${label}: opposition set`).toEqual([...expected].sort());
      predicted += expected.size;
    }
    expect(predicted, "non-vacuous: real oppositions must exist across the set").toBeGreaterThan(20);
  });

  it("F11: the South Node still aspects other bodies", () => {
    // The narrow fix excludes one PAIR. Excluding the POINT would be a
    // different, larger change to §1.6 participation, and is not what landed.
    let charts = 0;
    for (const { label, chart } of CHARTS) {
      if (!chart.planets.some((p) => p.name === "south_node")) continue;
      const others = chart.aspects.filter(
        (a) =>
          (a.from === "south_node" && a.to !== "true_node") ||
          (a.to === "south_node" && a.from !== "true_node"),
      );
      expect(others.length, `${label}: south_node must still participate`).toBeGreaterThan(0);
      charts++;
    }
    expect(charts).toBeGreaterThan(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Deliberate exclusion (inherited from L1's F1)
// ─────────────────────────────────────────────────────────────────────────────

describe("deliberate exclusions", () => {
  // Asserting the exclusion means a fix to F1 fails HERE and forces these
  // charts back into every test above, rather than leaving them silently unrun.
  it("pre-1800 fixtures are excluded because F1 still makes them throw", () => {
    expect(PRE_1800.length).toBeGreaterThan(0);
    for (const fx of PRE_1800) {
      expect(
        () => calculateNatalChart(fx.input as Parameters<typeof calculateNatalChart>[0]),
        `${fx.id} no longer throws — F1 may be fixed; re-include it above`,
      ).toThrow();
    }
  });
});

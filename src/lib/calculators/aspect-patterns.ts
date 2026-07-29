// Chart-level aspect-pattern detection.
//
// Detects the standard multi-planet geometric configurations from a set of
// chart points (natal planets, transiting sky, or composite midpoints):
//
//   - Stellium          — 3+ points in the same sign (or same house when
//                         house data is available)
//   - Grand trine       — 3 points in mutual trine; annotated with the shared
//                         element when all three occupy the same triplicity
//   - T-square          — an opposition whose both ends square a third point
//                         (the apex); annotated with the shared modality
//   - Grand cross       — two oppositions interlocked by four squares;
//                         annotated with the shared modality
//   - Yod               — two points in sextile, both quincunx a third (the
//                         apex; "finger of god")
//   - Kite              — a grand trine plus a fourth point opposing one
//                         member (the focal point) and sextile the other two
//   - Mystic rectangle  — two oppositions interlocked by two sextiles and
//                         two trines
//
// Rarer configurations (grand sextile, cradle, Thor's hammer) are deliberately
// out of scope: they add noise for the interpretive layer and the grand
// sextile in particular occurs a handful of times per century.
//
// Conventions:
//   - Aspect orbs match the natal-chart aspect table in `astrology.ts`, so a
//     detected pattern is always consistent with the chart's own aspect list.
//   - The derived South Node is excluded by callers (it is always exactly
//     opposite the North Node, so including both would fabricate
//     opposition-based patterns out of a single body).
//   - T-squares that are wholly contained in a detected grand cross are
//     suppressed (the classic convention: the cross *is* four T-squares).
//     Grand trines remain listed alongside a kite that contains them, with
//     the kite referencing all four points.

import { longitudeToSign, ZODIAC_SIGNS } from "./astrology";

export type PatternType =
  | "stellium"
  | "grand_trine"
  | "t_square"
  | "grand_cross"
  | "yod"
  | "kite"
  | "mystic_rectangle";

export type Element = "fire" | "earth" | "air" | "water";
export type Modality = "cardinal" | "fixed" | "mutable";

/** A chart point eligible for pattern detection. */
export interface PatternPoint {
  name: string;
  longitude: number;
  /** House placement (1–12) when the chart has a house wheel. */
  house?: number;
}

export interface AspectPattern {
  type: PatternType;
  /** Names of the participating points, in a stable order. */
  points: string[];
  /** T-square / yod: the apex point. Kite: the focal point (opposite the trine). */
  apex?: string;
  /** Grand trine / kite: shared element, when all trine members share one. */
  element?: Element;
  /** T-square / grand cross: shared modality, when all members share one. */
  modality?: Modality;
  /** Stellium: the shared sign (sign-based) …  */
  sign?: string;
  /** … or the shared house (house-based). */
  house?: number;
  /** Stellium: whether membership is by sign or by house. */
  basis?: "sign" | "house";
  /** Widest orb (degrees) among the aspects forming the pattern. Not set for stelliums. */
  maxOrb?: number;
}

/** Orbs per pattern-forming aspect — identical to the natal aspect table. */
const PATTERN_ORBS = {
  opposition: 8,
  trine: 7,
  square: 7,
  sextile: 5,
  quincunx: 3,
} as const;

type PatternAspect = keyof typeof PATTERN_ORBS;

const ASPECT_TARGET: Record<PatternAspect, number> = {
  opposition: 180,
  trine: 120,
  square: 90,
  sextile: 60,
  quincunx: 150,
};

const ELEMENTS: readonly Element[] = ["fire", "earth", "air", "water"];
const MODALITIES: readonly Modality[] = ["cardinal", "fixed", "mutable"];

export function elementOfSign(sign: string): Element {
  return ELEMENTS[ZODIAC_SIGNS.indexOf(sign) % 4];
}

export function modalityOfSign(sign: string): Modality {
  return MODALITIES[ZODIAC_SIGNS.indexOf(sign) % 3];
}

function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/** Orb of `aspect` between two points, or null when out of orb. */
function aspectOrb(a: PatternPoint, b: PatternPoint, aspect: PatternAspect): number | null {
  const orb = Math.abs(angularDifference(a.longitude, b.longitude) - ASPECT_TARGET[aspect]);
  return orb <= PATTERN_ORBS[aspect] ? orb : null;
}

/** Shared element of a point set, or undefined when mixed. */
function sharedElement(points: PatternPoint[]): Element | undefined {
  const els = points.map((p) => elementOfSign(longitudeToSign(p.longitude).sign));
  return els.every((e) => e === els[0]) ? els[0] : undefined;
}

/** Shared modality of a point set, or undefined when mixed. */
function sharedModality(points: PatternPoint[]): Modality | undefined {
  const mods = points.map((p) => modalityOfSign(longitudeToSign(p.longitude).sign));
  return mods.every((m) => m === mods[0]) ? mods[0] : undefined;
}

/**
 * Detect all aspect patterns in a set of chart points.
 *
 * Callers pass real bodies only (planets, Chiron, the North Node) — not the
 * derived South Node, and not angles/derived points — so patterns always
 * involve independent bodies. Points are matched pairwise with the same orbs
 * as the natal aspect table.
 */
export function detectAspectPatterns(points: PatternPoint[]): AspectPattern[] {
  const patterns: AspectPattern[] = [
    ...detectStelliums(points),
    ...detectOppositionPatterns(points),
    ...detectGrandTrinesAndKites(points),
    ...detectYods(points),
  ];
  // Stable order: by type, then by member names — deterministic output for
  // fixtures and downstream caching.
  const typeOrder: PatternType[] = [
    "stellium", "grand_cross", "t_square", "grand_trine", "kite", "yod", "mystic_rectangle",
  ];
  return patterns.sort((a, b) => {
    const t = typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type);
    if (t !== 0) return t;
    return a.points.join(",").localeCompare(b.points.join(","));
  });
}

// ─── Stelliums ──────────────────────────────────────────────────────────────

function detectStelliums(points: PatternPoint[]): AspectPattern[] {
  const out: AspectPattern[] = [];

  const bySign = new Map<string, PatternPoint[]>();
  for (const p of points) {
    const sign = longitudeToSign(p.longitude).sign;
    (bySign.get(sign) ?? bySign.set(sign, []).get(sign)!).push(p);
  }
  const signSets: string[] = [];
  for (const sign of ZODIAC_SIGNS) {
    const members = bySign.get(sign);
    if (members && members.length >= 3) {
      const names = members.map((m) => m.name);
      signSets.push(names.slice().sort().join(","));
      out.push({ type: "stellium", basis: "sign", sign, points: names });
    }
  }

  // House-based stelliums (only when house data exists). Skip any whose
  // member set is identical to a sign stellium already reported.
  const byHouse = new Map<number, PatternPoint[]>();
  for (const p of points) {
    if (p.house == null) continue;
    (byHouse.get(p.house) ?? byHouse.set(p.house, []).get(p.house)!).push(p);
  }
  for (let house = 1; house <= 12; house++) {
    const members = byHouse.get(house);
    if (members && members.length >= 3) {
      const names = members.map((m) => m.name);
      if (signSets.includes(names.slice().sort().join(","))) continue;
      out.push({ type: "stellium", basis: "house", house, points: names });
    }
  }

  return out;
}

// ─── Opposition-anchored patterns: T-square, grand cross, mystic rectangle ──

interface OppositionPair {
  a: number;
  b: number;
  orb: number;
}

function findOppositions(points: PatternPoint[]): OppositionPair[] {
  const out: OppositionPair[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const orb = aspectOrb(points[i], points[j], "opposition");
      if (orb != null) out.push({ a: i, b: j, orb });
    }
  }
  return out;
}

function detectOppositionPatterns(points: PatternPoint[]): AspectPattern[] {
  const out: AspectPattern[] = [];
  const oppositions = findOppositions(points);

  // Grand crosses: two disjoint oppositions where every cross-pair squares.
  const crossMembers: Set<string>[] = [];
  for (let x = 0; x < oppositions.length; x++) {
    for (let y = x + 1; y < oppositions.length; y++) {
      const o1 = oppositions[x];
      const o2 = oppositions[y];
      const ids = new Set([o1.a, o1.b, o2.a, o2.b]);
      if (ids.size !== 4) continue;
      const squares = [
        aspectOrb(points[o1.a], points[o2.a], "square"),
        aspectOrb(points[o1.a], points[o2.b], "square"),
        aspectOrb(points[o1.b], points[o2.a], "square"),
        aspectOrb(points[o1.b], points[o2.b], "square"),
      ];
      if (squares.some((s) => s == null)) continue;
      const members = [o1.a, o1.b, o2.a, o2.b].map((i) => points[i]);
      crossMembers.push(new Set(members.map((m) => m.name)));
      out.push({
        type: "grand_cross",
        points: members.map((m) => m.name),
        modality: sharedModality(members),
        maxOrb: round2(Math.max(o1.orb, o2.orb, ...(squares as number[]))),
      });
    }
  }

  // T-squares: an opposition plus an apex squaring both ends. Suppress those
  // wholly contained in a grand cross.
  for (const opp of oppositions) {
    for (let k = 0; k < points.length; k++) {
      if (k === opp.a || k === opp.b) continue;
      const sq1 = aspectOrb(points[k], points[opp.a], "square");
      const sq2 = aspectOrb(points[k], points[opp.b], "square");
      if (sq1 == null || sq2 == null) continue;
      const names = [points[opp.a].name, points[opp.b].name, points[k].name];
      if (crossMembers.some((cross) => names.every((n) => cross.has(n)))) continue;
      const members = [points[opp.a], points[opp.b], points[k]];
      out.push({
        type: "t_square",
        points: names,
        apex: points[k].name,
        modality: sharedModality(members),
        maxOrb: round2(Math.max(opp.orb, sq1, sq2)),
      });
    }
  }

  // Mystic rectangles: two disjoint oppositions joined by two sextiles and
  // two trines. For oppositions (a,b) and (c,d) the valid wiring is either
  // a~c sextile / b~d sextile / a~d trine / b~c trine, or the mirror.
  for (let x = 0; x < oppositions.length; x++) {
    for (let y = x + 1; y < oppositions.length; y++) {
      const o1 = oppositions[x];
      const o2 = oppositions[y];
      const ids = new Set([o1.a, o1.b, o2.a, o2.b]);
      if (ids.size !== 4) continue;
      const wirings: Array<[[number, number], [number, number], [number, number], [number, number]]> = [
        [[o1.a, o2.a], [o1.b, o2.b], [o1.a, o2.b], [o1.b, o2.a]],
        [[o1.a, o2.b], [o1.b, o2.a], [o1.a, o2.a], [o1.b, o2.b]],
      ];
      for (const [sx1, sx2, tr1, tr2] of wirings) {
        const s1 = aspectOrb(points[sx1[0]], points[sx1[1]], "sextile");
        const s2 = aspectOrb(points[sx2[0]], points[sx2[1]], "sextile");
        const t1 = aspectOrb(points[tr1[0]], points[tr1[1]], "trine");
        const t2 = aspectOrb(points[tr2[0]], points[tr2[1]], "trine");
        if (s1 == null || s2 == null || t1 == null || t2 == null) continue;
        out.push({
          type: "mystic_rectangle",
          points: [o1.a, o1.b, o2.a, o2.b].map((i) => points[i].name),
          maxOrb: round2(Math.max(o1.orb, o2.orb, s1, s2, t1, t2)),
        });
        break; // one wiring per point set
      }
    }
  }

  return out;
}

// ─── Grand trines and kites ─────────────────────────────────────────────────

function detectGrandTrinesAndKites(points: PatternPoint[]): AspectPattern[] {
  const out: AspectPattern[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const tIj = aspectOrb(points[i], points[j], "trine");
      if (tIj == null) continue;
      for (let k = j + 1; k < points.length; k++) {
        const tIk = aspectOrb(points[i], points[k], "trine");
        const tJk = aspectOrb(points[j], points[k], "trine");
        if (tIk == null || tJk == null) continue;
        const trine = [points[i], points[j], points[k]];
        out.push({
          type: "grand_trine",
          points: trine.map((p) => p.name),
          element: sharedElement(trine),
          maxOrb: round2(Math.max(tIj, tIk, tJk)),
        });

        // Kite: a 4th point opposing one trine member and sextile the other two.
        for (let m = 0; m < points.length; m++) {
          if (m === i || m === j || m === k) continue;
          for (const [oppIdx, rest] of [
            [i, [j, k]],
            [j, [i, k]],
            [k, [i, j]],
          ] as Array<[number, number[]]>) {
            const opp = aspectOrb(points[m], points[oppIdx], "opposition");
            if (opp == null) continue;
            const s1 = aspectOrb(points[m], points[rest[0]], "sextile");
            const s2 = aspectOrb(points[m], points[rest[1]], "sextile");
            if (s1 == null || s2 == null) continue;
            out.push({
              type: "kite",
              points: [...trine.map((p) => p.name), points[m].name],
              apex: points[m].name,
              element: sharedElement(trine),
              maxOrb: round2(Math.max(tIj, tIk, tJk, opp, s1, s2)),
            });
          }
        }
      }
    }
  }
  return out;
}

// ─── Yods ───────────────────────────────────────────────────────────────────

function detectYods(points: PatternPoint[]): AspectPattern[] {
  const out: AspectPattern[] = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const sextile = aspectOrb(points[i], points[j], "sextile");
      if (sextile == null) continue;
      for (let k = 0; k < points.length; k++) {
        if (k === i || k === j) continue;
        const q1 = aspectOrb(points[k], points[i], "quincunx");
        const q2 = aspectOrb(points[k], points[j], "quincunx");
        if (q1 == null || q2 == null) continue;
        out.push({
          type: "yod",
          points: [points[i].name, points[j].name, points[k].name],
          apex: points[k].name,
          maxOrb: round2(Math.max(sextile, q1, q2)),
        });
      }
    }
  }
  return out;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

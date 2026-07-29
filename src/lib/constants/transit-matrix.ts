// The full transit combination matrix — the canonical enumeration of every
// combination the transit/synastry endpoints can emit:
//
//   transit point × aspect × natal point          (core pairing)
//     + natal sign + natal house                  (natal-side context)
//     + transit sign + transit house              (transit-side context)
//
// Dimension sets are DERIVED from the app's existing models (planet lists,
// the six-aspect set, the zodiac) — this module never redefines them.
// House context is "where applicable": it requires natal cusps, so momentary
// overlays carry it while cusp-less (pure-sky) overlays omit it. Transit-side
// sign/house context is momentary by nature, so the event scanner (whose
// windows span months) carries natal-side context only.
//
// Nothing here is materialized as a cross product — the full context space is
// ~30.7M combinations. `transit-combinations.json` materializes the
// sign-keyed subset (core × natal sign) as the prose-contract manifest;
// everything else is enumerable/computable through this module, and every
// aspect hit the API returns carries its own `comboKey`.

import { ASPECT_ANGLES, buildComboKey, type AspectType } from "../calculators/overlay";
import { DEFAULT_TRANSIT_PLANETS } from "../calculators/transit";
import { DEFAULT_PLANETS, ZODIAC_SIGNS } from "../calculators/astrology";

/** Chart-frame points beyond the planet list: angles, Vertex, Part of Fortune. */
export const MATRIX_ANGLE_POINTS = [
  "asc",
  "mc",
  "ic",
  "dsc",
  "vertex",
  "part_of_fortune",
] as const;

/**
 * Every point that can occupy the transiting (moving) side of a combination:
 * the default transit planet set plus the derived South Node. Angles need a
 * ground location, so a pure sky has none.
 */
export const MATRIX_TRANSIT_POINTS: readonly string[] = [
  ...DEFAULT_TRANSIT_PLANETS,
  "south_node",
];

/**
 * Every point that can occupy the natal (receiving) side of a combination:
 * the default natal planet set, the derived South Node, and the six
 * chart-frame points. Mirrors `buildNatalOverlayPoints`.
 */
export const MATRIX_NATAL_POINTS: readonly string[] = [
  ...DEFAULT_PLANETS,
  "south_node",
  ...MATRIX_ANGLE_POINTS,
];

/** The six agreed aspects — reused from the overlay core, never redefined. */
export const MATRIX_ASPECTS: readonly AspectType[] = Object.keys(
  ASPECT_ANGLES
) as AspectType[];

/** All twelve zodiac signs (shared with the astrology calculator). */
export const MATRIX_SIGNS: readonly string[] = ZODIAC_SIGNS;

/** All twelve houses. */
export const MATRIX_HOUSES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

export interface TransitMatrixCardinality {
  transitPoints: number;
  natalPoints: number;
  aspects: number;
  signs: number;
  houses: number;
  /** transit point × aspect × natal point. */
  corePairings: number;
  /** Core pairings × natal sign — the manifest key space. */
  signKeyedCombinations: number;
  /** Core pairings × natal sign × natal house × transit sign × transit house. */
  fullContextCombinations: number;
}

/** Exact size of every level of the combination matrix. */
export function transitMatrixCardinality(): TransitMatrixCardinality {
  const transitPoints = MATRIX_TRANSIT_POINTS.length;
  const natalPoints = MATRIX_NATAL_POINTS.length;
  const aspects = MATRIX_ASPECTS.length;
  const signs = MATRIX_SIGNS.length;
  const houses = MATRIX_HOUSES.length;
  const corePairings = transitPoints * natalPoints * aspects;
  return {
    transitPoints,
    natalPoints,
    aspects,
    signs,
    houses,
    corePairings,
    signKeyedCombinations: corePairings * signs,
    fullContextCombinations: corePairings * signs * houses * signs * houses,
  };
}

export interface CorePairing {
  transitPoint: string;
  aspect: AspectType;
  natalPoint: string;
  /** Legacy-prefix-compatible key: `<transitPoint>.<aspect>.<natalPoint>`. */
  key: string;
}

/** Enumerate every core pairing (transit point × aspect × natal point). */
export function* enumerateCorePairings(): Generator<CorePairing> {
  for (const transitPoint of MATRIX_TRANSIT_POINTS) {
    for (const aspect of MATRIX_ASPECTS) {
      for (const natalPoint of MATRIX_NATAL_POINTS) {
        yield {
          transitPoint,
          aspect,
          natalPoint,
          key: buildComboKey({ transitPoint, aspect, natalPoint }),
        };
      }
    }
  }
}

/**
 * Enumerate the sign-keyed combination space (core pairing × natal sign) —
 * the key space materialized in `transit-combinations.json`.
 */
export function* enumerateSignKeyedCombinations(): Generator<CorePairing & { natalSign: string }> {
  for (const core of enumerateCorePairings()) {
    for (const natalSign of MATRIX_SIGNS) {
      yield {
        ...core,
        natalSign,
        key: buildComboKey({
          transitPoint: core.transitPoint,
          aspect: core.aspect,
          natalPoint: core.natalPoint,
          natalSign,
        }),
      };
    }
  }
}

export { buildComboKey };

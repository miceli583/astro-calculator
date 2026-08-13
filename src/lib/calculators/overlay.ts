// Shared "chart-vs-chart" overlay calculator.
//
// Used by:
//   - Transit to natal (`/api/v1/transit/natal`)         chartA = natal,      chartB = sky-at-datetime
//   - Synastry / compatibility (`/api/v1/synastry`)      chartA = person A,   chartB = person B
//   - Transit event scanner (`/api/v1/transit/events`)   sampled at each date step, filtered
//
// The three information layers returned:
//   1. Aspects — angular relationships between every A × B pair within orb.
//   2. HD gate co-activations — every point in B annotated with its HD gate/line
//      and any of A's already-activated gates it lands on (this is what "activates"
//      a channel in transit or connection charts).
//   3. House overlays — which of A's houses each of B's points falls into.

import {
  aspectMotion,
  houseFor,
  longitudeToSign,
  type AspectMotion,
  type NatalChart,
} from "./astrology";
import { longitudeToGate } from "../constants/hd-gates";
import {
  ASPECT_ANGLES,
  DEFAULT_TRANSIT_ORBS,
  type AspectType,
} from "../constants/orbs";

// The aspect vocabulary and the orb tables now live in `constants/orbs.ts` so
// that `astrology.ts` can reach them too — it could not import them from here
// without a runtime cycle, which is how the two transit paths ended up on two
// different tables (F9). Re-exported so existing importers are unchanged.
export {
  ASPECT_ANGLES,
  DEFAULT_TRANSIT_ORBS,
  DEFAULT_SYNASTRY_ORBS,
  type AspectType,
} from "../constants/orbs";

export interface OverlayPoint {
  /** Point identifier: planet name ("sun", "moon"), angle ("asc", "mc"), etc. */
  name: string;
  /** Ecliptic longitude in degrees (0–360). */
  longitude: number;
  /** Optional daily motion in degrees; used to determine "applying" vs "separating". */
  speed?: number;
  /** Optional retrograde flag; if omitted it's derived from `speed < 0`. */
  retrograde?: boolean;
}

/** A chart's worth of positions plus optional house cusps for house-overlay math. */
export interface OverlayChart {
  points: OverlayPoint[];
  /**
   * 12 house cusps in degrees (0–360). Cusp 0 = house 1 = ASC.
   * Required for `houseOverlays` in the result; omit for pure-sky charts.
   */
  cusps?: number[];
}

export interface AspectHit {
  /** Point in the "other" chart (transit body or partner's planet). */
  transitPoint: string;
  /** Point in the natal chart being aspected. */
  natalPoint: string;
  aspect: AspectType;
  /** Exact angular target for this aspect (0/60/90/120/150/180). */
  exactAngle: number;
  /** Distance from exact aspect in degrees. */
  orb: number;
  /**
   * True if the aspect is tightening (transit body approaching exact).
   * Absent when the direction is not determinate: either no speed was supplied
   * for the moving point, or `motion` is `"stationary"`.
   */
  applying?: boolean;
  /**
   * Three-valued direction. Absent — as opposed to `"stationary"` — means no
   * speed was supplied for the moving point, so the direction is unknown rather
   * than absent. See F10.
   */
  motion?: AspectMotion;
  /** Zodiac sign of the natal point (context for prose/theme lookup). */
  natalSign?: string;
  /** House the natal point occupies (1-12). Present only if natal.cusps provided. */
  natalHouse?: number;
  /** Zodiac sign the transiting/partner point occupies. */
  transitSign?: string;
  /** Natal house the transiting/partner point falls in. Present only if natal.cusps provided. */
  transitHouse?: number;
  /** Whether the transiting/partner point is retrograde (from its speed if not given). */
  transitRetrograde?: boolean;
  /**
   * Stable combination-matrix lookup key for this hit, built from every
   * available context factor. See `buildComboKey` for the format.
   */
  comboKey?: string;
}

export interface ComboKeyFactors {
  transitPoint: string;
  aspect: AspectType;
  natalPoint: string;
  natalSign?: string;
  natalHouse?: number;
  transitSign?: string;
  transitHouse?: number;
}

/**
 * Build the stable lookup key for a transit/synastry combination.
 *
 * Format (segments joined with "."):
 *   `<transitPoint>.<aspect>.<natalPoint>[.<natalSign>][.h<natalHouse>][.<transitSign>][.h<transitHouse>]`
 *
 * The first four segments (`saturn.conjunction.sun.Aries`) match the legacy
 * manifest key format in `transit-combinations.json`, so existing consumer
 * keying keeps working as a prefix match. House segments are prefixed with
 * `h` to distinguish them from sign names, and are simply omitted where not
 * applicable (e.g. no natal cusps available).
 */
export function buildComboKey(f: ComboKeyFactors): string {
  const parts: string[] = [f.transitPoint, f.aspect, f.natalPoint];
  if (f.natalSign) parts.push(f.natalSign);
  if (f.natalHouse != null) parts.push(`h${f.natalHouse}`);
  if (f.transitSign) parts.push(f.transitSign);
  if (f.transitHouse != null) parts.push(`h${f.transitHouse}`);
  return parts.join(".");
}

export interface HdActivation {
  /** Point in the "other" chart triggering the activation. */
  transitPoint: string;
  /** HD gate the point lands in (1-64). */
  gate: number;
  /** HD line within the gate (1-6). */
  line: number;
  /**
   * Name of the natal point that shares this gate, if any.
   * Empty string means the gate isn't natally activated — pure transit
   * activation (may still open a channel if the gate's partner is natally
   * activated; caller may enrich further).
   */
  natalPointSharingGate: string;
}

export interface HouseOverlay {
  transitPoint: string;
  inNatalHouse: number;
}

export interface OverlayOptions {
  /** Which aspects to detect. Defaults to all six. */
  aspects?: AspectType[];
  /** Orb overrides per aspect. Defaults to DEFAULT_TRANSIT_ORBS. */
  orbs?: Partial<Record<AspectType, number>>;
  /** Emit HD activations. Default true. */
  includeHd?: boolean;
  /** Emit house overlays. Requires natal.cusps. Default true when cusps present. */
  includeHouses?: boolean;
}

export interface OverlayResult {
  aspects: AspectHit[];
  hdActivations: HdActivation[];
  houseOverlays: HouseOverlay[];
}

/**
 * Compute the full overlay of `other` onto `natal`.
 *
 * "Natal" is the framing chart (its houses receive the transiting/partner bodies).
 * "Other" is the second chart — sky positions at a moment, or another person's natal.
 */
export function computeOverlay(
  natal: OverlayChart,
  other: OverlayChart,
  options: OverlayOptions = {}
): OverlayResult {
  const enabledAspects = options.aspects ?? (Object.keys(ASPECT_ANGLES) as AspectType[]);
  const orbs = { ...DEFAULT_TRANSIT_ORBS, ...options.orbs };
  const emitHd = options.includeHd ?? true;
  const emitHouses = (options.includeHouses ?? true) && Boolean(natal.cusps);

  const aspects: AspectHit[] = [];
  for (const o of other.points) {
    const transitSign = longitudeToSign(o.longitude).sign;
    const transitHouse = natal.cusps ? houseFor(o.longitude, natal.cusps) : undefined;
    const transitRetrograde = o.retrograde ?? (o.speed != null ? o.speed < 0 : undefined);
    for (const n of natal.points) {
      const sep = angularDifference(o.longitude, n.longitude);
      for (const a of enabledAspects) {
        const target = ASPECT_ANGLES[a];
        const orb = Math.abs(sep - target);
        if (orb > orbs[a]) continue;
        // Shares the natal/transit implementation so the two transit endpoints
        // cannot drift on direction the way they drifted on orbs (F9/F10).
        // A point with no speed keeps `motion` absent — unknown, not stationary.
        //
        // The framing chart's speed is deliberately 0, NOT `n.speed`: this chart
        // is a fixed moment, and a natal point's `speed` is the motion the body
        // had at birth — data about that instant, carried for the retrograde
        // flag, not motion happening now. Feeding it in would make a transit's
        // direction depend on how fast the natal Sun was moving in 1961.
        const motion =
          o.speed != null
            ? aspectMotion(o.longitude, o.speed, n.longitude, 0, target, orb)
            : undefined;
        const applying = motion == null || motion === "stationary" ? undefined : motion === "applying";
        const natalSign = longitudeToSign(n.longitude).sign;
        const natalHouse = natal.cusps ? houseFor(n.longitude, natal.cusps) : undefined;
        aspects.push({
          transitPoint: o.name,
          natalPoint: n.name,
          aspect: a,
          exactAngle: target,
          orb,
          // Spread so an indeterminate direction leaves the keys genuinely
          // absent rather than present-and-undefined (cf. F8).
          ...(applying != null ? { applying } : {}),
          ...(motion != null ? { motion } : {}),
          natalSign,
          natalHouse,
          transitSign,
          transitHouse,
          transitRetrograde,
          comboKey: buildComboKey({
            transitPoint: o.name,
            aspect: a,
            natalPoint: n.name,
            natalSign,
            natalHouse,
            transitSign,
            transitHouse,
          }),
        });
        break; // one aspect per pair (the tightest matches first by iteration order)
      }
    }
  }

  const hdActivations: HdActivation[] = [];
  if (emitHd) {
    // Map every natal point to its HD gate so we can flag co-activations.
    const natalGates = new Map<number, string>();
    for (const n of natal.points) {
      const g = longitudeToGate(n.longitude);
      if (!natalGates.has(g.gate)) natalGates.set(g.gate, n.name);
    }
    for (const o of other.points) {
      const g = longitudeToGate(o.longitude);
      hdActivations.push({
        transitPoint: o.name,
        gate: g.gate,
        line: g.line,
        natalPointSharingGate: natalGates.get(g.gate) ?? "",
      });
    }
  }

  const houseOverlays: HouseOverlay[] = [];
  if (emitHouses && natal.cusps) {
    for (const o of other.points) {
      houseOverlays.push({
        transitPoint: o.name,
        inNatalHouse: houseFor(o.longitude, natal.cusps),
      });
    }
  }

  return { aspects, hdActivations, houseOverlays };
}

/**
 * Every overlay-able point a natal chart models, as OverlayPoints: the full
 * planet list (including the derived South Node) plus the four chart angles
 * (ASC/MC/IC/DSC), the Vertex, and the Part of Fortune.
 *
 * Shared by transit-to-natal, synastry, and the transit event scanner so all
 * three expose the same complete natal-point space.
 */
export function buildNatalOverlayPoints(chart: NatalChart): OverlayPoint[] {
  const asc = chart.houses.ascendant.longitude;
  const mc = chart.houses.midheaven.longitude;
  return [
    ...chart.planets.map((p) => ({
      name: p.name as string,
      longitude: p.longitude,
      speed: p.speed,
      retrograde: p.retrograde,
    })),
    { name: "asc", longitude: asc, speed: 0 },
    { name: "mc", longitude: mc, speed: 0 },
    { name: "ic", longitude: (mc + 180) % 360, speed: 0 },
    { name: "dsc", longitude: (asc + 180) % 360, speed: 0 },
    { name: "vertex", longitude: chart.houses.vertex.longitude, speed: 0 },
    // The Part of Fortune is omitted from the chart when a luminary is absent
    // from the requested subset (F8), and drops out of the overlay with it —
    // rather than being replaced by a placeholder that would generate aspect
    // hits against a point that was never computed.
    ...(chart.partOfFortune
      ? [{ name: "part_of_fortune", longitude: chart.partOfFortune.longitude, speed: 0 }]
      : []),
  ];
}

/** Absolute angular distance between two longitudes in [0, 180]. */
export function angularDifference(a: number, b: number): number {
  return Math.abs(((a - b + 540) % 360) - 180);
}

/**
 * House (1-12) that a longitude falls into given 12 house cusps.
 *
 * Re-exported from `astrology.ts` rather than reimplemented. This file used to
 * carry its own copy comparing raw cusp values, so the polar-wheel bug (F6) had
 * to be found and fixed twice — once for natal charts and once for every
 * overlay, composite and transit that reports a house.
 */
export { houseFor };

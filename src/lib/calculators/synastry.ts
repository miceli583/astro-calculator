// Synastry (chart-to-chart compatibility) built on the shared overlay core.
//
// Returns two overlay perspectives — B's planets in A's houses, and A's planets
// in B's houses — because compatibility isn't symmetric: how partner B "shows
// up" in A's life (A's houses receive B's planets) is a different reading than
// A "showing up" in B's life.

import { calculateNatalChart, type NatalChart, type NatalInput } from "./astrology";
import {
  computeOverlay,
  DEFAULT_SYNASTRY_ORBS,
  type AspectType,
  type OverlayOptions,
  type OverlayResult,
} from "./overlay";

export interface SynastryInput {
  personA: NatalInput;
  personB: NatalInput;
  aspects?: AspectType[];
  orbs?: OverlayOptions["orbs"];
}

export interface SynastryResult {
  personA: NatalChart;
  personB: NatalChart;
  /** B's planets against A's chart (A is the frame). */
  bOnA: OverlayResult;
  /** A's planets against B's chart (B is the frame). */
  aOnB: OverlayResult;
  /**
   * Synastry aspects (aspects between A's planets and B's planets) — same
   * data on both overlays, deduplicated. This is the primary "compatibility
   * aspect table" most astrology apps display.
   */
  aspects: OverlayResult["aspects"];
}

/** Compute a synastry overlay between two people's natal charts. */
export function calculateSynastry(input: SynastryInput): SynastryResult {
  const personA = calculateNatalChart(input.personA);
  const personB = calculateNatalChart(input.personB);

  const orbs = { ...DEFAULT_SYNASTRY_ORBS, ...input.orbs };

  const buildPoints = (chart: NatalChart) => [
    ...chart.planets.map((p) => ({
      name: p.name as string,
      longitude: p.longitude,
      speed: p.speed,
      retrograde: p.retrograde,
    })),
    { name: "asc", longitude: chart.houses.ascendant.longitude, speed: 0 },
    { name: "mc",  longitude: chart.houses.midheaven.longitude, speed: 0 },
  ];

  const aChart = {
    points: buildPoints(personA),
    cusps: personA.houses.cusps.map((c) => c.longitude),
  };
  const bChart = {
    points: buildPoints(personB),
    cusps: personB.houses.cusps.map((c) => c.longitude),
  };

  const bOnA = computeOverlay(aChart, bChart, { aspects: input.aspects, orbs });
  const aOnB = computeOverlay(bChart, aChart, { aspects: input.aspects, orbs });

  return {
    personA,
    personB,
    bOnA,
    aOnB,
    // Aspects are symmetric — either overlay contains them. Use bOnA's list.
    aspects: bOnA.aspects,
  };
}

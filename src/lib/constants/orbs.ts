// Orb tables and aspect-motion tolerances — the single source of truth.
//
// These lived in `calculators/overlay.ts`, which `calculators/astrology.ts`
// cannot import (overlay already imports from astrology, and the cycle would
// be a runtime one). That is the structural reason the two transit code paths
// drifted onto two different orb tables: `calculateTransits` could not reach
// the transit table, so it fell back to the natal one and answered the same
// question 2–2.7× more loosely depending on which URL you hit. See finding F9.
//
// `overlay.ts` re-exports the two tables so existing importers are unaffected.

/** The six aspects the API detects — the Ptolemaic five plus the quincunx. */
export type AspectType =
  | "conjunction"
  | "sextile"
  | "square"
  | "trine"
  | "quincunx"
  | "opposition";

/** Exact separation, in degrees, for each aspect. */
export const ASPECT_ANGLES: Record<AspectType, number> = {
  conjunction: 0,
  sextile: 60,
  square: 90,
  trine: 120,
  quincunx: 150,
  opposition: 180,
};

/** Standard orbs for transit analysis (tighter than natal-scale). */
export const DEFAULT_TRANSIT_ORBS: Record<AspectType, number> = {
  conjunction: 3.0,
  opposition: 3.0,
  square: 3.0,
  trine: 2.0,
  sextile: 2.0,
  quincunx: 1.5,
};

/** Slightly wider orbs suitable for synastry (personal-planet contacts). */
export const DEFAULT_SYNASTRY_ORBS: Record<AspectType, number> = {
  conjunction: 5.0,
  opposition: 5.0,
  square: 4.0,
  trine: 4.0,
  sextile: 3.0,
  quincunx: 2.0,
};

/**
 * How far ahead to sample when deciding whether an aspect is applying:
 * ~15 minutes, expressed in days.
 */
export const MOTION_SAMPLE_DAYS = 0.01;

/**
 * Relative speed, in degrees per day, below which two bodies are treated as
 * having no meaningful motion with respect to each other — so the aspect
 * between them is neither applying nor separating.
 *
 * The tolerance has to sit far below the slowest motion we actually compute,
 * or it swallows real, determinate movement. Measured over 40 charts spanning
 * 1900–2020 (1304 aspecting pairs, excluding the tautological node pair of
 * §1.7):
 *
 * | tolerance (°/day) | pairs called stationary |
 * |---|---|
 * | 0.01   | 40 — including Saturn–Pluto at 0.0049°/day, which is moving |
 * | 0.001  | 7 |
 * | 0.0001 | 2 (e.g. Neptune–Chiron at 4.5e-5°/day) |
 *
 * The outer bodies legitimately run at 0.008–0.03°/day, so a 0.01 tolerance
 * would report Chiron, the lunar node, Uranus, Neptune and Pluto as stationary
 * essentially always. Calling a moving body stationary is as much a false claim
 * as calling a stationary one separating, so the tolerance is deliberately
 * strict: 1e-4°/day is 0.36 arcseconds per day, which cannot shift the orb by
 * as much as the two decimal places orbs are read to, even over a full day.
 */
export const STATIONARY_REL_SPEED_DEG_PER_DAY = 1e-4;

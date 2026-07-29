// Zodiac sign rulerships — both modern and traditional conventions.
//
// The traditional (pre-outer-planet) scheme assigns every sign one of the
// seven classical planets; the modern scheme reassigns Scorpio, Aquarius,
// and Pisces to the outer planets discovered later. The API defaults to
// modern and exposes traditional behind a request flag; both rulers are
// always reported for the three signs where the conventions differ.

import type { PlanetName } from "../ephemeris/client";

export type RulershipConvention = "modern" | "traditional";

export const MODERN_RULERS: Readonly<Record<string, PlanetName>> = {
  Aries: "mars",
  Taurus: "venus",
  Gemini: "mercury",
  Cancer: "moon",
  Leo: "sun",
  Virgo: "mercury",
  Libra: "venus",
  Scorpio: "pluto",
  Sagittarius: "jupiter",
  Capricorn: "saturn",
  Aquarius: "uranus",
  Pisces: "neptune",
};

export const TRADITIONAL_RULERS: Readonly<Record<string, PlanetName>> = {
  ...MODERN_RULERS,
  Scorpio: "mars",
  Aquarius: "saturn",
  Pisces: "jupiter",
};

/** Ruling planet of a zodiac sign under the given convention. */
export function rulerOfSign(sign: string, convention: RulershipConvention = "modern"): PlanetName {
  const table = convention === "traditional" ? TRADITIONAL_RULERS : MODERN_RULERS;
  const ruler = table[sign];
  if (!ruler) throw new Error(`Unknown zodiac sign: ${sign}`);
  return ruler;
}

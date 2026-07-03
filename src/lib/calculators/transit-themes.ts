// Transit theme lookup — reads a pre-generated prose table keyed by
//   `${transitPlanet}.${aspect}.${natalPoint}.${natalSign}`
//
// The prose table (transit-themes.json) is empty until a theme-generation pass
// populates it. This module handles that gracefully — returning `null` for
// keys that aren't populated yet — so the endpoint can ship before prose does.

import themesData from "../constants/transit-themes.json" with { type: "json" };
import type { AspectType } from "./overlay";

interface ThemeProse {
  title: string;
  summary: string;
  expanded: string;
  keywords: string[];
}

interface ThemesFile {
  version: number;
  generatedAt: string | null;
  themes: Record<string, ThemeProse>;
}

const themes = themesData as unknown as ThemesFile;

export interface ThemeQuery {
  transitPlanet: string;
  aspect: AspectType;
  natalPoint: string;
  natalSign: string;
}

export interface ThemeLookupResult {
  key: string;
  prose: ThemeProse | null;
  populated: boolean;
  themesVersion: number;
  themesGeneratedAt: string | null;
}

export function lookupTransitTheme(query: ThemeQuery): ThemeLookupResult {
  const key = `${query.transitPlanet}.${query.aspect}.${query.natalPoint}.${query.natalSign}`;
  const prose = themes.themes[key] ?? null;
  return {
    key,
    prose,
    populated: prose !== null,
    themesVersion: themes.version,
    themesGeneratedAt: themes.generatedAt,
  };
}

export function themesStatus(): { version: number; generatedAt: string | null; populatedCount: number } {
  return {
    version: themes.version,
    generatedAt: themes.generatedAt,
    populatedCount: Object.keys(themes.themes).length,
  };
}

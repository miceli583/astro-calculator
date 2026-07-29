import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import {
  MATRIX_ASPECTS,
  MATRIX_HOUSES,
  MATRIX_NATAL_POINTS,
  MATRIX_SIGNS,
  MATRIX_TRANSIT_POINTS,
  buildComboKey,
  enumerateCorePairings,
  enumerateSignKeyedCombinations,
  transitMatrixCardinality,
} from "@/lib/constants/transit-matrix";
import {
  ASPECT_ANGLES,
  buildNatalOverlayPoints,
  computeOverlay,
} from "@/lib/calculators/overlay";
import { DEFAULT_TRANSIT_PLANETS } from "@/lib/calculators/transit";
import { DEFAULT_EVENT_NATAL_POINTS } from "@/lib/calculators/transit-events";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { aspectTypeSchema } from "@/lib/validation/schemas";
import { DIANA } from "./fixtures/charts";

interface Manifest {
  version: number;
  cardinality: {
    transitPlanets: number;
    natalPoints: number;
    aspects: number;
    signs: number;
    total: number;
  };
  dimensions: {
    transitPlanets: { name: string; nature: string }[];
    natalPoints: { name: string; nature: string }[];
    aspects: { name: string; angle: number; nature: string }[];
    signs: { name: string; nature: string }[];
  };
  combinations: string[];
}

const manifest: Manifest = JSON.parse(
  readFileSync(
    join(__dirname, "..", "src", "lib", "constants", "transit-combinations.json"),
    "utf8"
  )
);

describe("transit matrix — full combination space", () => {
  const card = transitMatrixCardinality();

  it("covers ALL modeled points, ALL 12 signs, ALL 12 houses", () => {
    expect(card.transitPoints).toBe(13);
    expect(card.natalPoints).toBe(19);
    expect(card.signs).toBe(12);
    expect(card.houses).toBe(12);
  });

  it("asserts the full matrix sizes at every level", () => {
    expect(card.corePairings).toBe(13 * 19 * 6); // 1,482
    expect(card.corePairings).toBe(1_482);
    expect(card.signKeyedCombinations).toBe(1_482 * 12); // 17,784
    expect(card.signKeyedCombinations).toBe(17_784);
    // core × natalSign × natalHouse × transitSign × transitHouse
    expect(card.fullContextCombinations).toBe(1_482 * 12 * 12 * 12 * 12);
    expect(card.fullContextCombinations).toBe(30_730_752);
  });

  it("enumerates every core pairing exactly once", () => {
    const keys = [...enumerateCorePairings()].map((c) => c.key);
    expect(keys.length).toBe(card.corePairings);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("enumerates the sign-keyed combination space exactly once", () => {
    const keys = new Set<string>();
    for (const combo of enumerateSignKeyedCombinations()) keys.add(combo.key);
    expect(keys.size).toBe(card.signKeyedCombinations);
    expect(keys.has("saturn.conjunction.sun.Aries")).toBe(true); // legacy key format
    expect(keys.has("south_node.quincunx.part_of_fortune.Pisces")).toBe(true);
  });

  it("derives its point sets from the app's existing models", () => {
    expect(MATRIX_TRANSIT_POINTS).toEqual([...DEFAULT_TRANSIT_PLANETS, "south_node"]);
    // The natal side mirrors buildNatalOverlayPoints for a real chart.
    const chartPoints = buildNatalOverlayPoints(calculateNatalChart(DIANA.birth)).map(
      (p) => p.name
    );
    expect(new Set(chartPoints)).toEqual(new Set(MATRIX_NATAL_POINTS));
    expect(chartPoints.length).toBe(19);
  });
});

describe("six-aspect limit", () => {
  const SIX = ["conjunction", "sextile", "square", "trine", "quincunx", "opposition"];

  it("the matrix reuses exactly the overlay core's six aspects", () => {
    expect(MATRIX_ASPECTS.length).toBe(6);
    expect([...MATRIX_ASPECTS].sort()).toEqual(Object.keys(ASPECT_ANGLES).sort());
    expect([...MATRIX_ASPECTS].sort()).toEqual([...SIX].sort());
  });

  it("the API boundary accepts exactly the same six aspects", () => {
    expect([...aspectTypeSchema.options].sort()).toEqual([...SIX].sort());
  });

  it("the manifest is limited to the same six aspects", () => {
    const names = manifest.dimensions.aspects.map((a) => a.name).sort();
    expect(names).toEqual([...SIX].sort());
    for (const key of manifest.combinations.slice(0, 500)) {
      expect(SIX).toContain(key.split(".")[1]);
    }
  });
});

describe("manifest ↔ matrix module consistency", () => {
  it("dimension sets match the canonical matrix module exactly", () => {
    expect(new Set(manifest.dimensions.transitPlanets.map((p) => p.name))).toEqual(
      new Set(MATRIX_TRANSIT_POINTS)
    );
    expect(new Set(manifest.dimensions.natalPoints.map((p) => p.name))).toEqual(
      new Set(MATRIX_NATAL_POINTS)
    );
    expect(new Set(manifest.dimensions.signs.map((s) => s.name))).toEqual(
      new Set(MATRIX_SIGNS)
    );
  });

  it("materializes the complete sign-keyed key space with no duplicates", () => {
    const card = transitMatrixCardinality();
    expect(manifest.cardinality.total).toBe(card.signKeyedCombinations);
    expect(manifest.combinations.length).toBe(card.signKeyedCombinations);
    expect(new Set(manifest.combinations).size).toBe(card.signKeyedCombinations);
    const generated = new Set<string>();
    for (const combo of enumerateSignKeyedCombinations()) generated.add(combo.key);
    for (const key of manifest.combinations.slice(0, 1000)) {
      expect(generated.has(key)).toBe(true);
    }
  });

  it("every manifest aspect angle matches the overlay core", () => {
    for (const a of manifest.dimensions.aspects) {
      expect(ASPECT_ANGLES[a.name as keyof typeof ASPECT_ANGLES]).toBe(a.angle);
    }
  });
});

describe("combo keys and context factors on live overlays", () => {
  it("buildComboKey composes every available factor in a stable order", () => {
    expect(
      buildComboKey({ transitPoint: "saturn", aspect: "conjunction", natalPoint: "sun" })
    ).toBe("saturn.conjunction.sun");
    expect(
      buildComboKey({
        transitPoint: "saturn",
        aspect: "conjunction",
        natalPoint: "sun",
        natalSign: "Aries",
        natalHouse: 10,
        transitSign: "Pisces",
        transitHouse: 3,
      })
    ).toBe("saturn.conjunction.sun.Aries.h10.Pisces.h3");
    // Legacy manifest key is a strict prefix of the full runtime key.
    expect(
      buildComboKey({
        transitPoint: "saturn",
        aspect: "conjunction",
        natalPoint: "sun",
        natalSign: "Aries",
        natalHouse: 10,
        transitSign: "Pisces",
        transitHouse: 3,
      }).startsWith("saturn.conjunction.sun.Aries")
    ).toBe(true);
  });

  it("computeOverlay annotates hits with sign/house factors on both sides", () => {
    const natal = {
      points: [{ name: "sun", longitude: 100, speed: 1.0 }],
      cusps: [45, 75, 105, 135, 165, 195, 225, 255, 285, 315, 345, 15],
    };
    const other = { points: [{ name: "saturn", longitude: 100.5, speed: -0.03 }] };
    const hit = computeOverlay(natal, other).aspects[0];
    expect(hit.natalSign).toBe("Cancer");
    expect(hit.natalHouse).toBe(2);
    expect(hit.transitSign).toBe("Cancer");
    expect(hit.transitHouse).toBe(2);
    expect(hit.transitRetrograde).toBe(true); // retrograde phase wired from speed
    expect(hit.comboKey).toBe("saturn.conjunction.sun.Cancer.h2.Cancer.h2");
  });

  it("omits house segments where not applicable (no natal cusps)", () => {
    const natal = { points: [{ name: "sun", longitude: 100, speed: 1.0 }] };
    const other = { points: [{ name: "saturn", longitude: 100.5, speed: 0.03 }] };
    const hit = computeOverlay(natal, other).aspects[0];
    expect(hit.natalHouse).toBeUndefined();
    expect(hit.transitHouse).toBeUndefined();
    expect(hit.comboKey).toBe("saturn.conjunction.sun.Cancer.Cancer");
    expect(hit.transitRetrograde).toBe(false);
  });
});

describe("event scanner exposes the full natal point space", () => {
  it("scans all 19 matrix natal points by default", () => {
    expect([...DEFAULT_EVENT_NATAL_POINTS]).toEqual([...MATRIX_NATAL_POINTS]);
  });

  it("houses dimension is the full 1-12 range", () => {
    expect([...MATRIX_HOUSES]).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });
});

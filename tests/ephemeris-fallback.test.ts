/**
 * F1 / F2 — the ephemeris fallback contract.
 *
 * F1: every birth date before 1800 returned a 500. `calcPlanet` threw whenever
 * sweph's error string was non-empty, but sweph puts WARNINGS in that string —
 * "SwissEph file 'sepl_12.se1' not found ... using Moshier eph." arrives with a
 * perfectly good position and a POSITIVE flag. Real failure is `flag < 0`.
 *
 * F2: Chiron has no ephemeris at all below 1800 (`seas_12.se1`). sweph returns
 * `flag = -1` there. That is an absence, not a fallback, and it must not take
 * the whole chart down with it.
 *
 * The policy these tests pin (HM, 2026-08-13): do NOT ship `sepl_12.se1`.
 * Serve the Moshier answer and SAY SO. A labelled fallback is not a downgrade
 * in disguise; a silent one would be. Every assertion below that checks a label
 * exists to stop the silent version from ever passing.
 */

import { describe, it, expect } from "vitest";
import {
  calcAllPlanets,
  calcPlanet,
  ephemerisSourceFromFlag,
  summarizeEphemeris,
  tryCalcPlanet,
} from "@/lib/ephemeris/client";
import { calculateNatalChart } from "@/lib/calculators/astrology";
import { POST as natalPOST } from "@/app/api/v1/astrology/natal/route";

// First instant covered by the shipped Swiss Ephemeris data files (sepl_18.se1
// &c. run 1800–2399). Below it, sweph substitutes Moshier.
const JD_1800 = 2378496.5;

const CHART_1799 = {
  datetime: "1799-06-15T12:00:00",
  timezone: "Europe/London",
  latitude: 51.5074,
  longitude: -0.1278,
} as const;

const CHART_1750 = {
  datetime: "1750-03-01T06:30:00",
  timezone: "Europe/Paris",
  latitude: 48.8566,
  longitude: 2.3522,
} as const;

const CHART_1950 = {
  datetime: "1950-08-20T14:15:00",
  timezone: "America/New_York",
  latitude: 40.7128,
  longitude: -74.006,
} as const;

describe("F1 — pre-1800 charts build instead of 500ing", () => {
  it("a 1799 chart builds and reports Moshier", () => {
    const chart = calculateNatalChart(CHART_1799);
    expect(chart.planets.length).toBeGreaterThan(5);
    expect(chart.ephemeris).toBe("moshier");
  });

  it("a 1750 chart builds and reports Moshier", () => {
    const chart = calculateNatalChart(CHART_1750);
    expect(chart.planets.length).toBeGreaterThan(5);
    expect(chart.ephemeris).toBe("moshier");
  });

  it("a modern chart reports Swiss — the label tracks the data, not the date", () => {
    // Guards the cheapest wrong fix: hardcoding a label, or swallowing every
    // error and always claiming one source.
    const chart = calculateNatalChart(CHART_1950);
    expect(chart.ephemeris).toBe("swiss");
  });

  it("positions are real values, not zeros dressed up as an answer", () => {
    // A fix that caught the throw and returned a zero-filled position would
    // pass every label assertion above. The Sun must actually move.
    const a = calculateNatalChart(CHART_1750);
    const b = calculateNatalChart({ ...CHART_1750, datetime: "1750-09-01T06:30:00" });
    const sunA = a.planets.find((p) => p.name === "sun")!;
    const sunB = b.planets.find((p) => p.name === "sun")!;
    expect(sunA.longitude).toBeGreaterThan(0);
    expect(sunB.longitude).toBeGreaterThan(0);
    // Six months apart: the Sun is on the other side of the zodiac.
    const sep = Math.abs(((sunA.longitude - sunB.longitude + 540) % 360) - 180);
    expect(sep).toBeGreaterThan(150);
  });

  it("the fallback boundary is where sweph puts it, not where we guessed", () => {
    // One day either side of 1800-01-01. If someone re-implements the boundary
    // as a hardcoded year check rather than reading the flag, this still passes
    // — but the next test (a warning that is not an error) is what catches that.
    const before = tryCalcPlanet(JD_1800 - 1, "sun");
    const after = tryCalcPlanet(JD_1800 + 1, "sun");
    expect(before.ok && before.position.ephemeris).toBe("moshier");
    expect(after.ok && after.position.ephemeris).toBe("swiss");
  });

  it("a non-empty sweph message with a positive flag is a WARNING, not a failure", () => {
    // This is F1's root cause stated directly: below 1800 sweph returns BOTH a
    // message and a usable position. The old code read the message and threw.
    const r = tryCalcPlanet(JD_1800 - 1, "sun");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(Number.isFinite(r.position.longitude)).toBe(true);
    expect(r.position.ephemeris).toBe("moshier");
  });
});

describe("F2 — Chiron before 1800 is reported absent, not fabricated", () => {
  it("sweph refuses Chiron pre-1800 and we surface it rather than throwing", () => {
    const chart = calculateNatalChart({ ...CHART_1750, planets: undefined });
    // Chiron is in DEFAULT_PLANETS, so the caller asked for it.
    expect(chart.planets.find((p) => p.name === "chiron")).toBeUndefined();
    expect(chart.unavailableBodies).toBeDefined();
    const chiron = chart.unavailableBodies!.find((u) => u.name === "chiron");
    expect(chiron, "chiron must be reported, not silently dropped").toBeDefined();
    expect(chiron!.longitude).toBeNull();
    expect(chiron!.reason.length).toBeGreaterThan(0);
  });

  it("the absence is also announced in warnings", () => {
    const chart = calculateNatalChart(CHART_1750);
    expect(chart.warnings.some((w) => w.includes("chiron"))).toBe(true);
  });

  it("a modern chart has Chiron and no unavailableBodies key at all", () => {
    // Field-presence, not falsiness: an always-present empty array would make
    // "nothing was unavailable" and "something was" the same shape to a
    // consumer doing `"unavailableBodies" in chart` (the F8 convention).
    const chart = calculateNatalChart(CHART_1950);
    expect(chart.planets.find((p) => p.name === "chiron")).toBeDefined();
    expect("unavailableBodies" in chart).toBe(false);
  });

  it("tryCalcPlanet reports the refusal; calcPlanet still throws on it", () => {
    const r = tryCalcPlanet(JD_1800 - 1, "chiron");
    expect(r.ok).toBe(false);
    // The strict helper keeps throwing — callers that genuinely need every body
    // (Human Design, Gene Keys) must not silently lose one.
    expect(() => calcPlanet(JD_1800 - 1, "chiron")).toThrow();
  });

  it("one refused body does not cost the chart its other bodies", () => {
    // The bug this replaces: a single unavailable body took down all thirteen.
    const chart = calculateNatalChart(CHART_1750);
    for (const name of ["sun", "moon", "saturn", "pluto"]) {
      expect(chart.planets.find((p) => p.name === name), name).toBeDefined();
    }
  });
});

describe("the route itself — F1's definition of done is a 200, not a green unit test", () => {
  async function natal(body: unknown) {
    const res = await natalPOST(
      new Request("http://localhost/api/v1/astrology/natal", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      })
    );
    // Responses are enveloped as `{ data }` by `ok()` in lib/api/respond.ts.
    const envelope = (await res.json()) as { data?: Record<string, unknown> };
    return { status: res.status, json: envelope.data ?? {} };
  }

  it("POST /api/v1/astrology/natal returns 200 for 1799", async () => {
    const { status, json } = await natal(CHART_1799);
    expect(status).toBe(200);
    expect(json.ephemeris).toBe("moshier");
  });

  it("POST /api/v1/astrology/natal returns 200 for 1750, naming the ephemeris", async () => {
    const { status, json } = await natal(CHART_1750);
    expect(status).toBe(200);
    // The whole point of the disposition: the caller is TOLD they got Moshier.
    expect(json.ephemeris).toBe("moshier");
    const unavailable = json.unavailableBodies as { name: string; longitude: null }[];
    expect(unavailable.map((u) => u.name)).toContain("chiron");
  });

  it("a modern birth is unaffected", async () => {
    const { status, json } = await natal(CHART_1950);
    expect(status).toBe(200);
    expect(json.ephemeris).toBe("swiss");
    expect("unavailableBodies" in json).toBe(false);
  });
});

describe("flag decoding", () => {
  it("reads the ephemeris bit, and rejects a flag with none set", () => {
    expect(ephemerisSourceFromFlag(258)).toBe("swiss"); // SWIEPH|SPEED
    expect(ephemerisSourceFromFlag(260)).toBe("moshier"); // MOSEPH|SPEED
    expect(ephemerisSourceFromFlag(257)).toBe("jpl"); // JPLEPH|SPEED
    expect(() => ephemerisSourceFromFlag(256)).toThrow();
  });

  it("calcAllPlanets separates answered bodies from refused ones", () => {
    const { positions, unavailable } = calcAllPlanets(JD_1800 - 1, ["sun", "chiron", "moon"]);
    expect(Object.keys(positions).sort()).toEqual(["moon", "sun"]);
    expect(unavailable.map((u) => u.name)).toEqual(["chiron"]);
    expect(summarizeEphemeris(positions)).toBe("moshier");
  });

  it("summarizeEphemeris returns null for an empty set rather than guessing", () => {
    expect(summarizeEphemeris({})).toBeNull();
  });
});

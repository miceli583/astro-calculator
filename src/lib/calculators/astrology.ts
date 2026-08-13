// Natal chart and transit calculator built on top of the ephemeris client.
// Returns planet positions, house cusps, and aspects.

import {
  calcAllPlanets,
  calcHouses,
  calcPlanet,
  julianDayUT,
  julianDayUTResolved,
  type HouseSystem,
  type PlanetName,
  summarizeEphemeris,
  type EphemerisSource,
  type PlanetPosition,
} from "../ephemeris/client";
import type { BirthData } from "../types/birth-data";
import { detectAspectPatterns, type AspectPattern, type PatternPoint } from "./aspect-patterns";
import {
  DEFAULT_TRANSIT_ORBS,
  MOTION_SAMPLE_DAYS,
  STATIONARY_REL_SPEED_DEG_PER_DAY,
  type AspectType,
} from "../constants/orbs";
import {
  MODERN_RULERS,
  TRADITIONAL_RULERS,
  rulerOfSign,
  type RulershipConvention,
} from "../constants/rulerships";

export const DEFAULT_PLANETS: readonly PlanetName[] = [
  "sun",
  "moon",
  "mercury",
  "venus",
  "mars",
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
  "pluto",
  "true_node",
  "chiron",
];

export const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

export interface SignPosition {
  sign: string;
  degree: number; // 0-30 within the sign
  minute: number; // 0-60
  second: number; // 0-60
}

export function longitudeToSign(longitude: number): SignPosition {
  const normalized = ((longitude % 360) + 360) % 360;
  const signIndex = Math.floor(normalized / 30);
  const remainder = normalized - signIndex * 30;
  const degree = Math.floor(remainder);
  const minuteFloat = (remainder - degree) * 60;
  const minute = Math.floor(minuteFloat);
  const second = Math.round((minuteFloat - minute) * 60);
  return { sign: ZODIAC_SIGNS[signIndex], degree, minute, second };
}

export interface NatalPlanet {
  name: PlanetName | "south_node";
  longitude: number;
  latitude: number;
  speed: number;
  retrograde: boolean;
  sign: SignPosition;
  house: number; // 1-12
}

export interface NatalChart {
  jd_ut: number;
  planets: NatalPlanet[];
  houses: {
    /**
     * The house system that actually produced these cusps. Above the polar
     * circle Placidus and Koch are undefined and the ephemeris substitutes
     * Porphyry; this field reports the substitute, because reporting the
     * request would be a false label on exact cusps of a different system.
     * See finding F5.
     */
    system: HouseSystem;
    /** Present only when a substitution happened — then this is what was asked for. */
    requestedSystem?: HouseSystem;
    cusps: { house: number; longitude: number; sign: SignPosition }[];
    ascendant: { longitude: number; sign: SignPosition };
    midheaven: { longitude: number; sign: SignPosition };
    vertex: { longitude: number; sign: SignPosition };
  };
  /**
   * Part of Fortune (Pars Fortunae) — derived point representing material
   * well-being and "the place where you find your joy". Day-birth formula:
   * ASC + Moon - Sun. Night-birth formula: ASC + Sun - Moon (reversed).
   * `isDayBirth` tells you which formula was used, and is determined by the
   * Sun's position relative to the horizon — not by its house number, so it
   * does not vary with `house_system`.
   *
   * **Optional.** The formula requires both luminaries, so the field is
   * OMITTED (the key is absent from the JSON) when the caller's `planets`
   * subset excludes the Sun or the Moon. It previously fell back to the
   * Ascendant's longitude with `isDayBirth: false`, which was indistinguishable
   * from a real Part of Fortune conjunct the Ascendant. See finding F8.
   */
  partOfFortune?: {
    longitude: number;
    sign: SignPosition;
    house: number;
    isDayBirth: boolean;
  };
  aspects: Aspect[];
  /** Chart-level aspect patterns (stellium, grand trine, T-square, yod, …). */
  patterns: AspectPattern[];
  /**
   * The chart ruler — the planet ruling the Ascendant sign — with its
   * placement and every chart aspect it participates in. Convention defaults
   * to modern rulerships (Scorpio→Pluto, Aquarius→Uranus, Pisces→Neptune);
   * pass `rulership: "traditional"` for the classical table.
   */
  chartRuler: ChartRuler;
  /**
   * Which ephemeris answered for this chart's positions — `"swiss"` for the
   * 1800–2399 range this deployment ships data files for, `"moshier"` for
   * instants outside it, where sweph falls back to its built-in analytic theory
   * at roughly arcsecond rather than milliarcsecond accuracy.
   *
   * Reported on every chart, not only the fallback ones, so a consumer never
   * has to infer precision from the date. See finding F1.
   */
  ephemeris: EphemerisSource | "mixed";
  /**
   * Bodies the caller asked for that have no ephemeris at this instant, with
   * sweph's reason. Present only when non-empty. Chiron before 1800 is the
   * real-world case: sweph refuses it outright, so it is reported here rather
   * than silently dropped or given a fabricated position (finding F2).
   */
  unavailableBodies?: { name: PlanetName; longitude: null; reason: string }[];
  /** Non-fatal warnings about the chart (e.g., high-latitude house distortion). */
  warnings: string[];
}

export interface ChartRuler {
  /** Which rulership table produced `ruler`. */
  convention: RulershipConvention;
  ascendantSign: string;
  /** The ruling planet under `convention`. */
  ruler: PlanetName;
  /** Rulers under both conventions (differ only for Scorpio/Aquarius/Pisces). */
  modernRuler: PlanetName;
  traditionalRuler: PlanetName;
  /**
   * The ruler's placement in this chart, or null when the requested planet
   * subset excludes the ruling planet.
   */
  placement: {
    longitude: number;
    sign: SignPosition;
    house: number;
    retrograde: boolean;
    speed: number;
  } | null;
  /** Every chart aspect the ruling planet participates in. */
  aspects: Aspect[];
}

/**
 * Compute the chart-ruler role from an Ascendant sign and the chart's planets
 * and aspect list. Shared by natal and composite charts.
 */
export function computeChartRuler(
  ascendantSign: string,
  planets: NatalPlanet[],
  aspects: Aspect[],
  convention: RulershipConvention = "modern",
): ChartRuler {
  const ruler = rulerOfSign(ascendantSign, convention);
  const placed = planets.find((p) => p.name === ruler);
  return {
    convention,
    ascendantSign,
    ruler,
    modernRuler: MODERN_RULERS[ascendantSign],
    traditionalRuler: TRADITIONAL_RULERS[ascendantSign],
    placement: placed
      ? {
          longitude: placed.longitude,
          sign: placed.sign,
          house: placed.house,
          retrograde: placed.retrograde,
          speed: placed.speed,
        }
      : null,
    aspects: aspects.filter((a) => a.from === ruler || a.to === ruler),
  };
}

/**
 * Pattern-eligible points from a chart's planet list: every real body except
 * the derived South Node (always exactly opposite the North Node — including
 * both would fabricate opposition-based patterns out of one body).
 */
export function patternPointsFromPlanets(
  planets: Pick<NatalPlanet, "name" | "longitude" | "house">[],
): PatternPoint[] {
  return planets
    .filter((p) => p.name !== "south_node")
    .map((p) => ({ name: p.name, longitude: p.longitude, house: p.house }));
}

/** Quadrant house systems (Placidus, Koch, Regiomontanus, Campanus) become
 * undefined near the poles because the formulas reference the celestial
 * equator's intersection with the horizon, which fails when the Sun never
 * rises or sets. We warn at the Arctic/Antarctic circles (~66.5°). */
const QUADRANT_SYSTEMS: ReadonlySet<HouseSystem> = new Set(["placidus", "koch", "regiomontanus", "campanus"]);
const HIGH_LATITUDE_THRESHOLD = 66.5;

export type AspectBody = PlanetName | "south_node";

/**
 * Which way an aspect is going, from the two bodies' relative motion.
 *
 * `"stationary"` means the bodies are not moving with respect to each other to
 * within `STATIONARY_REL_SPEED_DEG_PER_DAY` — the aspect is doing neither thing,
 * and saying "separating" would be a claim rather than an observation. See F10.
 */
export type AspectMotion = "applying" | "separating" | "stationary";

export interface Aspect {
  from: AspectBody;
  to: AspectBody;
  type: "conjunction" | "opposition" | "trine" | "square" | "sextile" | "quincunx";
  exactAngle: number;
  orb: number;
  /**
   * True while the orb is tightening toward exact.
   *
   * **Optional.** Omitted (key absent) when `motion` is `"stationary"`, because
   * a two-valued field cannot express a third answer and `false` there would
   * read as "separating". Present whenever the direction is determinate.
   */
  applying?: boolean;
  /** The three-valued form; always present. */
  motion: AspectMotion;
}

const ASPECT_DEFS: { type: Aspect["type"]; angle: number; orb: number }[] = [
  { type: "conjunction", angle: 0, orb: 8 },
  { type: "opposition", angle: 180, orb: 8 },
  { type: "trine", angle: 120, orb: 7 },
  { type: "square", angle: 90, orb: 7 },
  { type: "sextile", angle: 60, orb: 5 },
  { type: "quincunx", angle: 150, orb: 3 },
];

function angularDifference(a: number, b: number): number {
  const d = Math.abs(((a - b + 540) % 360) - 180);
  return d;
}

/**
 * Direction of an aspect, from the RELATIVE motion of the two bodies.
 *
 * Sampled ~15 minutes ahead along both bodies' longitude speeds: if the
 * separation is closer to exact then, the aspect is applying. When the two
 * speeds differ by less than `STATIONARY_REL_SPEED_DEG_PER_DAY` the pair is not
 * moving with respect to each other in any meaningful sense and the answer is
 * `"stationary"` — a transiting body at its station, or two outer bodies
 * momentarily locked in step, is doing neither thing.
 *
 * For transit-to-natal work the natal chart is a fixed moment, so the natal
 * body's speed is 0 and the relative motion is the transiting body's own —
 * which is exactly what makes a transiting station come out as `"stationary"`.
 *
 * A partile aspect (orb 0) with the bodies still moving comes out as
 * `"separating"`: the next instant genuinely is wider. See §1.5.
 *
 * @returns The direction, or `"stationary"` when there is no meaningful one.
 */
export function aspectMotion(
  longitudeA: number,
  speedA: number,
  longitudeB: number,
  speedB: number,
  exactAngle: number,
  orb: number,
): AspectMotion {
  if (Math.abs(speedA - speedB) < STATIONARY_REL_SPEED_DEG_PER_DAY) return "stationary";
  const sepFuture = angularDifference(
    longitudeA + speedA * MOTION_SAMPLE_DAYS,
    longitudeB + speedB * MOTION_SAMPLE_DAYS,
  );
  return Math.abs(sepFuture - exactAngle) < orb ? "applying" : "separating";
}

/**
 * The `applying`/`motion` pair for an aspect payload, spread into the object.
 *
 * Spread rather than assigned so that a stationary aspect leaves `applying`
 * genuinely ABSENT rather than present-and-undefined (the same distinction the
 * Part of Fortune turns on — see F8).
 */
function motionFields(motion: AspectMotion): { applying?: boolean; motion: AspectMotion } {
  return motion === "stationary"
    ? { motion }
    : { applying: motion === "applying", motion };
}

/**
 * The signed extent of each of the twelve houses, in degrees.
 *
 * For an ordinary chart this is just `cusps[i+1] − cusps[i]` taken forward
 * around the circle, and the twelve add up to exactly 360.
 *
 * Above the polar circle they do not. Campanus and Regiomontanus cusps collapse
 * onto two points 180° apart, and the wheel becomes locally *retrograde*: cusp
 * i+1 sits a hundredth of a degree BEHIND cusp i. Read forward, that hair-thin
 * house measures 359.97° instead of 0.03°, and the naive twelve then sum to
 * 360 × k for k up to 11. Measured at 69.65°N, ARMC 239°, Campanus:
 *
 *   cusps  60.95 | 241.24  241.16  241.13  241.11  241.09 | 240.95 | 61.24 …
 *   naive  180.28  359.92  359.98  359.98  359.97  359.87   180.28  359.92 …
 *   sum    3960 = 360 × 11
 *
 * Ten of those twelve arcs are spurious. Exactly which ten is fixed by
 * arithmetic — the sum overshoots by 360 × (k−1), so k−1 arcs must be the
 * negative representative — and *which* ten is fixed by physics: the spurious
 * ones are the arcs nearest 360°, i.e. the ones that are really tiny negatives.
 * Flipping the largest k−1 turns them into −0.08, −0.03, −0.02, −0.03, −0.13 …
 * and the total falls back to exactly 360.
 *
 * Flipping largest-first rather than blindly normalising into (−180, 180] also
 * keeps genuinely oversized houses intact: the two real houses above measure
 * 180.28° each, and a (−180, 180] normalisation would wrongly zero both.
 */
/** One house as an arc: where it starts, and how far it runs counterclockwise. */
export interface HouseSpan {
  start: number;
  extent: number;
}

/**
 * The twelve houses as arcs of the zodiac (finding F6).
 *
 * A house is the arc between its own cusp and the next one, but *which* of the
 * two arcs between them is not always the forward one. Above the polar circles
 * the house wheel runs **backwards**: cusp 2 sits clockwise of cusp 1, cusp 3
 * clockwise of cusp 2, and so on all the way round. Measured forward, eleven of
 * the twelve arcs then come out just under 360° instead of just over 0°, house
 * 1 alone claims the whole zodiac, and every body in the chart is reported
 * inside it — which is exactly what this function exists to prevent.
 *
 * Direction is not guessed, it is measured. A wheel's twelve arcs must close
 * the circle exactly once, so the direction whose arcs sum to 360° is the real
 * one. Swept across a full sidereal day at seven latitudes and seven house
 * systems, every one of 4186 degenerate instants summed to 360×11 forward and
 * to exactly 360 backward — the wheel is reversed, not broken, and the cusps
 * themselves are correct to within 1e-10 arcsec.
 */
export function wheelDirection(cusps: number[]): "direct" | "reversed" {
  return houseSpans(cusps)[0].start === cusps[0] ? "direct" : "reversed";
}

export function houseSpans(cusps: number[]): HouseSpan[] {
  const forward = cusps.map((start, i) => ({
    start,
    extent: (((cusps[(i + 1) % 12] - start) % 360) + 360) % 360,
  }));
  const closes = (spans: HouseSpan[]) =>
    Math.abs(spans.reduce((a, s) => a + s.extent, 0) - 360) < 1e-6;
  if (closes(forward)) return forward;

  // Retrograde wheel: house i runs from the *next* cusp forward to its own.
  const backward = cusps.map((end, i) => {
    const start = cusps[(i + 1) % 12];
    return { start, extent: (((end - start) % 360) + 360) % 360 };
  });
  // If neither direction closes the circle the cusps are not a wheel at all;
  // forward is the conventional reading and still beats throwing a chart away.
  return closes(backward) ? backward : forward;
}

/**
 * Which house a longitude falls in.
 *
 * Membership is `offset < extent`, both measured counterclockwise from the
 * house's own start — never a comparison of raw cusp values, which assumes the
 * cusps ascend and so mis-reads every reversed polar wheel (finding F6).
 */
export function houseFor(longitude: number, cusps: number[]): number {
  const norm = ((longitude % 360) + 360) % 360;
  const spans = houseSpans(cusps);
  for (let i = 0; i < 12; i++) {
    if (spans[i].extent <= 0) continue;
    const offset = (((norm - spans[i].start) % 360) + 360) % 360;
    if (offset < spans[i].extent) return i + 1;
  }
  return 1;
}

/**
 * Sect: is the Sun above the horizon?
 *
 * The horizon is the ASC–DSC axis, so the above-horizon hemisphere is the arc
 * running *backwards* from the Ascendant through 180° to the Descendant. A body
 * is above it when `(asc − longitude) mod 360 < 180`.
 *
 * This deliberately does NOT go through the Sun's house number. Houses 7–12
 * coincide with that arc only when cusp 1 is the ASC and cusp 7 the DSC, which
 * is false under `whole_sign` — house 1 there begins at the start of the
 * Ascendant's *sign*. Reading sect off the house number therefore made the Part
 * of Fortune depend on the caller's `house_system`, moving it by up to ~135°
 * for a late-degree Ascendant. Sect is a property of the sky and must be
 * invariant under the choice of wheel. See `docs/aspect-conventions.md` §4.2
 * and finding F7.
 *
 * A body exactly on the Ascendant counts as above (rising); one exactly on the
 * Descendant counts as below (setting).
 */
export function isAboveHorizon(longitude: number, ascendant: number): boolean {
  return ((((ascendant - longitude) % 360) + 360) % 360) < 180;
}

/**
 * Part of Fortune: day-birth = ASC + Moon − Sun; night-birth = ASC + Sun − Moon.
 * Shared by the natal and composite charts so the two cannot drift apart.
 */
export function computePartOfFortune(
  ascendant: number,
  sunLongitude: number,
  moonLongitude: number,
  cusps: number[]
): { longitude: number; sign: SignPosition; house: number; isDayBirth: boolean } {
  const isDayBirth = isAboveHorizon(sunLongitude, ascendant);
  const lon = isDayBirth
    ? (((ascendant + moonLongitude - sunLongitude) % 360) + 360) % 360
    : (((ascendant + sunLongitude - moonLongitude) % 360) + 360) % 360;
  return {
    longitude: lon,
    sign: longitudeToSign(lon),
    house: houseFor(lon, cusps),
    isDayBirth,
  };
}

/**
 * Pairs whose geometry is fixed by definition rather than observed, so an
 * "aspect" between them carries no information. `south_node` is constructed as
 * `true_node + 180`, which means every chart reported a 0.00° opposition — the
 * tightest aspect present, always, on every chart ever calculated.
 *
 * Keyed by the sorted pair so lookup does not depend on iteration order.
 * This suppresses the PAIR, not either point: the South Node still aspects
 * everything else, and real oppositions between other bodies are untouched.
 */
const TAUTOLOGICAL_PAIRS = new Set(["south_node|true_node"]);

function isTautologicalPair(a: string, b: string): boolean {
  return TAUTOLOGICAL_PAIRS.has([a, b].sort().join("|"));
}

export function computeAspects(planets: NatalPlanet[]): Aspect[] {
  const out: Aspect[] = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const a = planets[i];
      const b = planets[j];
      if (isTautologicalPair(a.name, b.name)) continue;
      const sep = angularDifference(a.longitude, b.longitude);
      for (const def of ASPECT_DEFS) {
        const orb = Math.abs(sep - def.angle);
        if (orb <= def.orb) {
          out.push({
            from: a.name,
            to: b.name,
            type: def.type,
            exactAngle: def.angle,
            orb,
            ...motionFields(
              aspectMotion(a.longitude, a.speed, b.longitude, b.speed, def.angle, orb),
            ),
          });
          break;
        }
      }
    }
  }
  return out;
}

export interface NatalInput extends BirthData {
  house_system?: HouseSystem;
  planets?: PlanetName[];
  /** Rulership convention for the chart ruler. Default "modern". */
  rulership?: RulershipConvention;
}

/**
 * Compute a tropical natal chart: planet positions, house cusps, and aspects.
 *
 * Coordinates are tropical-zodiac ecliptic longitudes in degrees (0–360).
 * Default house system is Placidus; default planet set is sun..pluto + true_node + chiron.
 *
 * @example
 *   calculateNatalChart({
 *     datetime: "1961-07-01T19:45:00",
 *     timezone: "Europe/London",
 *     latitude: 52.833,
 *     longitude: 0.5,
 *   });
 *
 * @param input.datetime  ISO 8601 local datetime, e.g. "1980-07-15T14:30:00".
 * @param input.timezone  IANA timezone, e.g. "America/New_York".
 * @param input.latitude  North-positive decimal degrees.
 * @param input.longitude East-positive decimal degrees.
 * @param input.house_system  Default "placidus". One of placidus, koch,
 *   porphyrius, regiomontanus, campanus, equal, whole_sign.
 * @param input.planets   Default includes 12 bodies; override to limit.
 * @returns A `NatalChart` with planets (with sign + house), houses (cusps,
 *   ASC, MC, vertex), and computed aspects.
 */
export function calculateNatalChart(input: NatalInput): NatalChart {
  const houseSystem = input.house_system ?? "placidus";
  const planetList = input.planets ?? DEFAULT_PLANETS;

  const { jd, kind: timeKind } = julianDayUTResolved(input.datetime, input.timezone);
  const { positions, unavailable } = calcAllPlanets(jd, planetList);
  const houses = calcHouses(jd, input.latitude, input.longitude, houseSystem);

  const warnings: string[] = [];
  if (timeKind === "gap") {
    warnings.push(
      `Local time ${input.datetime} does not exist in ${input.timezone}: it falls inside ` +
      `an hour skipped by a daylight-saving transition. The chart was cast one hour ` +
      `later, past the gap. Verify the recorded birth time.`
    );
  } else if (timeKind === "ambiguous") {
    warnings.push(
      `Local time ${input.datetime} occurs twice in ${input.timezone} because of a ` +
      `daylight-saving transition. The chart was cast for the FIRST occurrence ` +
      `(daylight time); the second is one hour later and gives a different chart.`
    );
  }
  // Driven by sweph's return flag, not by a latitude constant. The substitution
  // boundary is not 66.5° and is not even fixed: it tracks the obliquity of the
  // ecliptic, measured at 66.5327° in 1800, 66.5623° in 2000 and 66.5774° in
  // 2333. A hardcoded 66.5 warned on charts sweph computes real Placidus cusps
  // for, and would drift further wrong with every century. See finding F5.
  if (houses.system !== houses.requestedSystem) {
    warnings.push(
      `Latitude ${input.latitude.toFixed(2)}° is beyond the polar circle, where ` +
      `${houses.requestedSystem} house cusps are undefined. These are ` +
      `${houses.system} cusps, which is what the ephemeris substituted — they are ` +
      `exact for that system, not unreliable ${houses.requestedSystem} ones. ` +
      `Consider whole_sign or equal house systems for polar charts.`
    );
  } else if (Math.abs(input.latitude) >= HIGH_LATITUDE_THRESHOLD && QUADRANT_SYSTEMS.has(houseSystem)) {
    warnings.push(
      `Latitude ${input.latitude.toFixed(2)}° is at or beyond the polar circle. ` +
      `${houseSystem} cusps are still defined here, but houses become extremely ` +
      `unequal and some may collapse to near-zero width. Consider whole_sign or ` +
      `equal house systems for polar charts.`
    );
  }

  // A reversed wheel is not an error, but it IS surprising: the house numbers
  // run clockwise, so house 1 ends at the Ascendant instead of beginning there
  // and a body a temperate chart would place in house 5 lands near house 9.
  // Saying so costs a sentence; leaving the caller to discover it from the
  // numbers is the same kind of silence F5 was about. See finding F6.
  if (wheelDirection(houses.cusps) === "reversed") {
    warnings.push(
      `At latitude ${input.latitude.toFixed(2)}° the ecliptic lies close to the plane ` +
      `of the horizon at this moment, so the ${houses.system} house wheel runs ` +
      `backwards: cusps descend rather than ascend, ten of the twelve houses are ` +
      `hairline-narrow, and two span roughly 180° each. The cusps are exact and every ` +
      `body is placed in the house that genuinely contains it, but house numbers here ` +
      `are not comparable with those from a temperate chart. Consider whole_sign or ` +
      `equal, which stay ordered at every latitude.`
    );
  }

  // Bodies sweph refused are reported, not fabricated and not silently
  // dropped: the caller asked for them, so silence would be indistinguishable
  // from "not requested" (the same reasoning that made F8 an omission — there
  // absence WAS the honest answer; here the request itself is the context).
  if (unavailable.length > 0) {
    warnings.push(
      `No ephemeris for ${unavailable.map((u) => u.name).join(", ")} at this date; ` +
      `reported in unavailableBodies with a null longitude rather than omitted.`
    );
  }
  const availableList = planetList.filter((n) => positions[n] != null);

  const planets: NatalPlanet[] = availableList.map((name) => {
    const p: PlanetPosition = positions[name];
    return {
      name,
      longitude: p.longitude,
      latitude: p.latitude,
      speed: p.longitudeSpeed,
      retrograde: p.longitudeSpeed < 0,
      sign: longitudeToSign(p.longitude),
      house: houseFor(p.longitude, houses.cusps),
    };
  });

  // South Node is always 180° opposite the (true or mean) North Node. It isn't
  // a Swiss Ephemeris body; we derive it whenever the user includes a node.
  const northNode = planets.find((p) => p.name === "true_node" || p.name === "mean_node");
  if (northNode) {
    const snLon = (northNode.longitude + 180) % 360;
    planets.push({
      name: "south_node",
      longitude: snLon,
      latitude: 0,
      speed: northNode.speed,
      retrograde: northNode.retrograde,
      sign: longitudeToSign(snLon),
      house: houseFor(snLon, houses.cusps),
    });
  }

  // Part of Fortune. Omitted entirely when either luminary is absent from the
  // requested `planets` subset — the formula needs both, and the Ascendant is
  // not a stand-in for a value we cannot compute (see `partOfFortune` above).
  const sunPlanet = planets.find((p) => p.name === "sun");
  const moonPlanet = planets.find((p) => p.name === "moon");
  const partOfFortune =
    sunPlanet && moonPlanet
      ? computePartOfFortune(
          houses.ascendant,
          sunPlanet.longitude,
          moonPlanet.longitude,
          houses.cusps,
        )
      : undefined;

  const aspects = computeAspects(planets);
  const ascendantSign = longitudeToSign(houses.ascendant).sign;

  return {
    jd_ut: jd,
    planets,
    houses: {
      // The system that produced these cusps, which above the polar circle is
      // not always the one requested (F5).
      system: houses.system,
      ...(houses.system !== houses.requestedSystem
        ? { requestedSystem: houses.requestedSystem }
        : {}),
      cusps: houses.cusps.map((cusp, i) => ({
        house: i + 1,
        longitude: cusp,
        sign: longitudeToSign(cusp),
      })),
      ascendant: { longitude: houses.ascendant, sign: longitudeToSign(houses.ascendant) },
      midheaven: { longitude: houses.midheaven, sign: longitudeToSign(houses.midheaven) },
      vertex: { longitude: houses.vertex, sign: longitudeToSign(houses.vertex) },
    },
    // Spread rather than assign, so an omitted Part of Fortune leaves the key
    // genuinely ABSENT rather than present-and-undefined. JSON.stringify drops
    // undefined either way, but a JS consumer doing `"partOfFortune" in chart`
    // would otherwise see a field that is not there (F8).
    ...(partOfFortune ? { partOfFortune } : {}),
    aspects,
    patterns: detectAspectPatterns(patternPointsFromPlanets(planets)),
    chartRuler: computeChartRuler(ascendantSign, planets, aspects, input.rulership),
    ephemeris: summarizeEphemeris(positions) ?? "swiss",
    ...(unavailable.length > 0
      ? {
          unavailableBodies: unavailable.map((u) => ({
            name: u.name,
            longitude: null as null,
            reason: u.reason,
          })),
        }
      : {}),
    warnings,
  };
}

export interface TransitInput {
  natal: BirthData & { house_system?: HouseSystem };
  transit_datetime: string; // local ISO at the natal location, or UTC
  transit_timezone: string;
  planets?: PlanetName[];
  /**
   * Per-aspect orb overrides, merged over `DEFAULT_TRANSIT_ORBS`. Structurally
   * identical to `OverlayOptions["orbs"]`, which the transit/natal and synastry
   * paths take — spelled out rather than imported because `overlay.ts` imports
   * this module and the reverse import would close the cycle that orb table
   * lived in before F9.
   */
  orbs?: Partial<Record<AspectType, number>>;
}

export interface TransitChart {
  natal_jd_ut: number;
  transit_jd_ut: number;
  transitingPlanets: NatalPlanet[];
  /** Which ephemeris answered for the TRANSIT positions (F1). */
  transitEphemeris: EphemerisSource | "mixed";
  /** Requested transiting bodies with no ephemeris at that instant (F2). */
  unavailableTransitBodies?: { name: PlanetName; longitude: null; reason: string }[];
  aspectsToNatal: (Aspect & { fromTransit: boolean })[];
}

/**
 * Compute transits to a natal chart at a given moment.
 *
 * Computes a full natal chart for the birth data, then overlays the planet
 * positions at the transit moment, returning the aspects each transiting
 * planet makes to natal planets.
 *
 * @param input.natal              Natal birth data (same shape as calculateNatalChart input).
 * @param input.transit_datetime   ISO 8601 local datetime of the transit moment.
 * @param input.transit_timezone   IANA timezone of `transit_datetime`.
 * @param input.planets            Optional subset of bodies to include.
 * @param input.orbs               Optional per-aspect orb overrides, merged OVER
 *   `DEFAULT_TRANSIT_ORBS` — an unlisted aspect keeps its default rather than
 *   being dropped. Same contract as `/api/v1/transit/natal` and
 *   `/api/v1/synastry`, which is the point: the override must not become a
 *   third way to make the two transit paths disagree (cf. F9).
 * @returns Both Julian Days, the transit planet positions in natal houses,
 *   and the transit-to-natal aspect list.
 */
export function calculateTransits(input: TransitInput): TransitChart {
  const natalChart = calculateNatalChart(input.natal);
  const transitJd = julianDayUT(input.transit_datetime, input.transit_timezone);
  const orbs = { ...DEFAULT_TRANSIT_ORBS, ...input.orbs };
  const planetList = input.planets ?? DEFAULT_PLANETS;
  const { positions: tpos, unavailable: tUnavailable } = calcAllPlanets(transitJd, planetList);
  const transitList = planetList.filter((n) => tpos[n] != null);

  const transitingPlanets: NatalPlanet[] = transitList.map((name) => {
    const p = tpos[name];
    return {
      name,
      longitude: p.longitude,
      latitude: p.latitude,
      speed: p.longitudeSpeed,
      retrograde: p.longitudeSpeed < 0,
      sign: longitudeToSign(p.longitude),
      house: houseFor(p.longitude, natalChart.houses.cusps.map((c) => c.longitude)),
    };
  });

  const aspectsToNatal: (Aspect & { fromTransit: boolean })[] = [];
  for (const t of transitingPlanets) {
    for (const n of natalChart.planets) {
      const sep = angularDifference(t.longitude, n.longitude);
      for (const def of ASPECT_DEFS) {
        // TRANSIT orbs, not the natal table this loop used to read off
        // `ASPECT_DEFS`. Which orbs a transit is judged by is a property of the
        // question, not of the URL the caller happened to reach for: this
        // endpoint and `/api/v1/transit/natal` answer the same question and
        // must answer it the same way (F9) — including when the caller supplies
        // the table.
        const orb = Math.abs(sep - def.angle);
        if (orb <= orbs[def.type]) {
          aspectsToNatal.push({
            from: t.name,
            to: n.name,
            type: def.type,
            exactAngle: def.angle,
            orb,
            // Computed from relative motion, where this used to be a hardcoded
            // `applying: false` on every hit — a wrong answer on roughly half
            // the list, and the half that matters, since an applying transit is
            // the one that has not yet peaked (F10). The natal chart is a fixed
            // moment, so the natal body's speed is 0 and the relative motion is
            // the transiting body's own.
            ...motionFields(
              aspectMotion(t.longitude, t.speed, n.longitude, 0, def.angle, orb),
            ),
            fromTransit: true,
          });
          break;
        }
      }
    }
  }

  return {
    natal_jd_ut: natalChart.jd_ut,
    transit_jd_ut: transitJd,
    transitingPlanets,
    transitEphemeris: summarizeEphemeris(tpos) ?? "swiss",
    ...(tUnavailable.length > 0
      ? {
          unavailableTransitBodies: tUnavailable.map((u) => ({
            ...u,
            longitude: null as null,
          })),
        }
      : {}),
    aspectsToNatal,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Secondary Progressions
// ─────────────────────────────────────────────────────────────────────────────

export interface ProgressedInput extends BirthData {
  /** Years after birth to project the chart to. Can be fractional. */
  years: number;
  /** Planet subset; defaults to the fast-moving inner planets (Sun..Mars) plus Moon. */
  planets?: PlanetName[];
}

export interface ProgressedChart {
  natal_jd_ut: number;
  progressed_jd_ut: number;
  years: number;
  planets: { name: PlanetName; longitude: number; sign: SignPosition; retrograde: boolean }[];
  /** Which ephemeris answered at the progressed instant (F1). */
  ephemeris: EphemerisSource | "mixed";
  /** Requested bodies with no ephemeris at the progressed instant (F2). */
  unavailableBodies?: { name: PlanetName; longitude: null; reason: string }[];
}

const DEFAULT_PROGRESSED_PLANETS: readonly PlanetName[] = [
  "sun", "moon", "mercury", "venus", "mars",
];

/**
 * Compute secondary-progressed planet positions.
 *
 * Per the classical "day for a year" symbolic technique: where the planets
 * were N solar days after birth = their progressed positions at age N years.
 * Only the fast-moving inner planets (Sun through Mars, plus the Moon) move
 * meaningfully on this timescale; outer planets are essentially fixed and
 * are omitted by default.
 *
 * @param input.years Number of years after birth (e.g. 28 for "at age 28").
 *                    May be fractional ("28.5" = mid-year).
 */
export function calculateProgressions(input: ProgressedInput): ProgressedChart {
  const natalJd = julianDayUT(input.datetime, input.timezone);
  const progressedJd = natalJd + input.years;
  const planetList = input.planets ?? DEFAULT_PROGRESSED_PLANETS;
  const { positions, unavailable } = calcAllPlanets(progressedJd, planetList);
  const availableList = planetList.filter((n) => positions[n] != null);

  const planets = availableList.map((name) => {
    const p = positions[name];
    return {
      name,
      longitude: p.longitude,
      sign: longitudeToSign(p.longitude),
      retrograde: p.longitudeSpeed < 0,
    };
  });

  return {
    natal_jd_ut: natalJd,
    progressed_jd_ut: progressedJd,
    years: input.years,
    planets,
    ephemeris: summarizeEphemeris(positions) ?? "swiss",
    ...(unavailable.length > 0
      ? { unavailableBodies: unavailable.map((u) => ({ ...u, longitude: null as null })) }
      : {}),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Solar Return
// ─────────────────────────────────────────────────────────────────────────────

export interface SolarReturnInput {
  natal: BirthData & { house_system?: HouseSystem; rulership?: RulershipConvention };
  /** Year of the return (e.g. 2026). */
  year: number;
  /**
   * Optional relocation. Solar Returns are traditionally cast for where you
   * will be during the year ahead. If omitted, uses the natal lat/lon.
   */
  relocation?: { latitude: number; longitude: number; timezone: string };
}

export interface SolarReturnChart extends NatalChart {
  /** The natal Sun longitude that the return Sun matches. */
  natal_sun_longitude: number;
  /** UT instant when transit Sun returns to natal Sun longitude in the given year. */
  return_jd_ut: number;
  year: number;
  /** True if the return chart was cast at a relocated lat/lon. */
  relocated: boolean;
}

/**
 * Compute a Solar Return chart for a given year.
 *
 * Finds the JD-UT instant where the Sun's ecliptic longitude equals the natal
 * Sun's, on or near the birthday in the requested year, then casts a full
 * natal-style chart for that moment at the (optionally relocated) location.
 */
export function calculateSolarReturn(input: SolarReturnInput): SolarReturnChart {
  const natalJd = julianDayUT(input.natal.datetime, input.natal.timezone);
  const natalSunLon = calcPlanet(natalJd, "sun").longitude;

  // Birth month/day in the target year as a starting guess. The return occurs
  // within ±1 day of the birthday. Iterate Newton-style on Sun longitude.
  const m = input.natal.datetime.match(/^\d{4}-(\d{2})-(\d{2})/);
  if (!m) throw new Error("natal.datetime must be ISO 8601");
  const month = m[1];
  const day = m[2];
  const seedIso = `${input.year}-${month}-${day}T00:00:00`;
  let jd = julianDayUT(seedIso, input.natal.timezone);

  for (let i = 0; i < 12; i++) {
    const cur = calcPlanet(jd, "sun");
    let diff = cur.longitude - natalSunLon;
    while (diff > 180) diff -= 360;
    while (diff <= -180) diff += 360;
    if (Math.abs(diff) < 1e-7) break;
    jd -= diff / cur.longitudeSpeed;
  }

  // Cast the full chart at the return JD using the chosen location.
  const lat = input.relocation?.latitude ?? input.natal.latitude;
  const lon = input.relocation?.longitude ?? input.natal.longitude;
  const tz = input.relocation?.timezone ?? input.natal.timezone;

  // The natal-chart calculator wants a datetime + timezone. Convert JD-UT
  // back to a UTC ISO string and pass UTC explicitly to avoid TZ conversion.
  const isoUtc = jdUtToIsoUtc(jd);

  const chart = calculateNatalChart({
    datetime: isoUtc,
    timezone: "UTC",
    latitude: lat,
    longitude: lon,
    house_system: input.natal.house_system,
    rulership: input.natal.rulership,
  });

  return {
    ...chart,
    natal_sun_longitude: natalSunLon,
    return_jd_ut: jd,
    year: input.year,
    relocated: input.relocation !== undefined && (lat !== input.natal.latitude || lon !== input.natal.longitude || tz !== input.natal.timezone),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
//  Planetary Returns (Mercury, Venus, Mars, Jupiter, Saturn, …)
// ─────────────────────────────────────────────────────────────────────────────

/** Planets for which a return chart is astrologically meaningful. */
export type ReturnPlanet =
  | "sun"
  | "mercury"
  | "venus"
  | "mars"
  | "jupiter"
  | "saturn";

/** Mean apparent daily motion (deg/day) — used to pick a coarse scan step. */
const RETURN_MEAN_MOTION: Record<ReturnPlanet, number> = {
  sun: 0.9856,
  mercury: 4.09,
  venus: 1.60,
  mars: 0.524,
  jupiter: 0.083,
  saturn: 0.034,
};

/**
 * Minimum days from birth before a crossing counts as a "return". Set to ~80%
 * of each planet's mean sidereal period so that near-birth retrograde-loop
 * crossings (which finish in the same direction as natal, but before any
 * meaningful orbital cycle) are filtered out.
 */
const RETURN_MIN_DAYS_FROM_BIRTH: Record<ReturnPlanet, number> = {
  sun: 300,      // ~82% of 365d
  mercury: 70,   // ~80% of 88d
  venus: 180,    // ~80% of 225d
  mars: 550,     // ~80% of 687d
  jupiter: 3466, // ~80% of 4333d (11.86y)
  saturn: 8607,  // ~80% of 10759d (29.46y)
};

export interface PlanetaryReturnInput {
  natal: BirthData & { house_system?: HouseSystem; rulership?: RulershipConvention };
  planet: ReturnPlanet;
  /** Find the first return on or after this ISO datetime. Defaults to now (UTC). */
  after_datetime?: string;
  /** Timezone for after_datetime. Defaults to UTC. */
  after_timezone?: string;
  /** Optional relocation. Falls back to natal lat/lon/timezone. */
  relocation?: { latitude: number; longitude: number; timezone: string };
}

export interface PlanetaryReturnChart extends NatalChart {
  planet: ReturnPlanet;
  /** Natal longitude of `planet` that the return matches. */
  natal_planet_longitude: number;
  /** UT instant when the transiting planet longitude equals the natal longitude. */
  return_jd_ut: number;
  /** True if the return chart was cast at a relocated lat/lon. */
  relocated: boolean;
}

/**
 * Find the first moment after `after_datetime` when the given planet's ecliptic
 * longitude matches its natal longitude, and cast a full chart for that moment.
 *
 * A minimum interval from birth is enforced to filter out the planet's own
 * post-birth retrograde loop back over the natal longitude — Saturn, for
 * instance, retrogrades over its natal longitude within months of birth, but
 * the astrological "return" is when it has completed a full orbital cycle.
 */
export function calculatePlanetaryReturn(input: PlanetaryReturnInput): PlanetaryReturnChart {
  const natalJd = julianDayUT(input.natal.datetime, input.natal.timezone);
  const natalLon = calcPlanet(natalJd, input.planet).longitude;

  const afterIso = input.after_datetime ?? new Date().toISOString().slice(0, 19);
  const afterTz = input.after_timezone ?? "UTC";
  const afterJd = julianDayUT(afterIso, afterTz);

  const meanMotion = RETURN_MEAN_MOTION[input.planet];
  // Step size targets ~0.5° of motion per sample. Small enough that even
  // retrograde crossings won't skip the natal longitude.
  const step = 0.5 / meanMotion;

  // Signed angular difference in (-180, 180].
  const sep = (lon: number) => {
    let d = ((lon - natalLon + 540) % 360) - 180;
    if (d === -180) d = 180;
    return d;
  };

  let prevJd = afterJd;
  let prevSep = sep(calcPlanet(prevJd, input.planet).longitude);

  // Cap the scan at 100 years — well beyond any expected return cadence.
  const maxJd = afterJd + 365.25 * 100;

  let returnJd = NaN;
  while (prevJd < maxJd) {
    const curJd = Math.min(prevJd + step, maxJd);
    const curSep = sep(calcPlanet(curJd, input.planet).longitude);
    // A true return crossing has both prevSep and curSep close to zero. The
    // sign-flip test alone also fires when the planet crosses the *opposition*
    // (natalLon + 180°) because sep wraps between +180 and -180 there — reject
    // those by requiring both endpoint magnitudes to be small.
    const signFlip =
      (prevSep < 0 && curSep >= 0) ||
      (prevSep > 0 && curSep <= 0) ||
      curSep === 0;
    const bothNearZero = Math.abs(prevSep) < 90 && Math.abs(curSep) < 90;
    const crossed = signFlip && bothNearZero;
    if (crossed) {
      // Bisect for the exact crossing between prevJd and curJd.
      let lo = prevJd;
      let hi = curJd;
      for (let j = 0; j < 40; j++) {
        const mid = (lo + hi) / 2;
        const midSep = sep(calcPlanet(mid, input.planet).longitude);
        if (Math.abs(midSep) < 1e-9) {
          lo = hi = mid;
          break;
        }
        const sameSideAsLo =
          (prevSep < 0 && midSep < 0) ||
          (prevSep > 0 && midSep > 0);
        if (sameSideAsLo) lo = mid;
        else hi = mid;
      }
      const candidate = (lo + hi) / 2;
      // Filter crossings that happen before the planet has completed a
      // meaningful fraction of its orbit. Otherwise Saturn's own post-birth
      // retrograde loop (which finishes direct ~5 months after birth) would
      // spuriously register as its return.
      const enoughTimeElapsed =
        candidate - natalJd >= RETURN_MIN_DAYS_FROM_BIRTH[input.planet];
      if (enoughTimeElapsed) {
        returnJd = candidate;
        break;
      }
      // Otherwise advance past the crossing and keep scanning.
    }
    prevJd = curJd;
    prevSep = curSep;
  }

  if (!Number.isFinite(returnJd)) {
    throw new Error(
      `No ${input.planet} return found within 100 years of ${afterIso}. This should not happen for supported planets.`,
    );
  }

  const lat = input.relocation?.latitude ?? input.natal.latitude;
  const lon = input.relocation?.longitude ?? input.natal.longitude;
  const tz = input.relocation?.timezone ?? input.natal.timezone;

  const isoUtc = jdUtToIsoUtc(returnJd);
  const chart = calculateNatalChart({
    datetime: isoUtc,
    timezone: "UTC",
    latitude: lat,
    longitude: lon,
    house_system: input.natal.house_system,
    rulership: input.natal.rulership,
  });

  return {
    ...chart,
    planet: input.planet,
    natal_planet_longitude: natalLon,
    return_jd_ut: returnJd,
    relocated:
      input.relocation !== undefined &&
      (lat !== input.natal.latitude ||
        lon !== input.natal.longitude ||
        tz !== input.natal.timezone),
  };
}

/** Convert a Julian Day (UT) to an ISO 8601 UTC datetime string. */
function jdUtToIsoUtc(jd: number): string {
  // Standard JD-to-Gregorian (Meeus, Astronomical Algorithms ch. 7).
  const Z = Math.floor(jd + 0.5);
  const F = jd + 0.5 - Z;
  let A = Z;
  if (Z >= 2299161) {
    const alpha = Math.floor((Z - 1867216.25) / 36524.25);
    A = Z + 1 + alpha - Math.floor(alpha / 4);
  }
  const B = A + 1524;
  const C = Math.floor((B - 122.1) / 365.25);
  const D = Math.floor(365.25 * C);
  const E = Math.floor((B - D) / 30.6001);
  const dayFloat = B - D - Math.floor(30.6001 * E) + F;
  const day = Math.floor(dayFloat);
  const month = E < 14 ? E - 1 : E - 13;
  const year = month > 2 ? C - 4716 : C - 4715;
  const dayFrac = dayFloat - day;
  const totalSeconds = Math.round(dayFrac * 86400);
  const hh = Math.floor(totalSeconds / 3600);
  const mm = Math.floor((totalSeconds % 3600) / 60);
  const ss = totalSeconds % 60;
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:${pad(ss)}`;
}

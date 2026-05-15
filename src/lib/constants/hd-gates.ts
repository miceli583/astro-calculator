// Human Design / Gene Keys gate wheel.
//
// The 64 I-Ching hexagrams are mapped around the tropical zodiac in a fixed
// "Mandala" order. Each gate occupies 360°/64 = 5.625° (5°37'30").
// Each gate is divided into 6 lines of 56'15" each.
//
// IMPORTANT — verify the wheel offset against known charts before relying on
// gate output for production. The offset varies slightly across published
// sources (3.875°, 13.875°, etc.). Run tests against a verified chart
// (e.g. jovianarchive.com or a known birth) and adjust GATE_WHEEL_OFFSET.
//
// Convention used here: Gate 25 begins at 3°52'30" Aries (= 3.875° tropical).

export const GATE_SIZE_DEG = 360 / 64; // 5.625°
export const LINE_SIZE_DEG = GATE_SIZE_DEG / 6; // 0.9375°
export const COLOR_SIZE_DEG = LINE_SIZE_DEG / 6; // 0.15625°
export const TONE_SIZE_DEG = COLOR_SIZE_DEG / 6;
export const BASE_SIZE_DEG = TONE_SIZE_DEG / 5;

export const GATE_WHEEL_OFFSET = 3.875; // degrees east of 0° Aries

// 64 gates in tropical zodiac order, starting from Aries (offset by GATE_WHEEL_OFFSET).
export const GATE_SEQUENCE: readonly number[] = [
  25, 17, 21, 51, 42, 3, 27, 24, 2, 23, 8, 20, 16, 35, 45, 12,
  15, 52, 39, 53, 62, 56, 31, 33, 7, 4, 29, 59, 40, 64, 47, 6,
  46, 18, 48, 57, 32, 50, 28, 44, 1, 43, 14, 34, 9, 5, 26, 11,
  10, 58, 38, 54, 61, 60, 41, 19, 13, 49, 30, 55, 37, 63, 22, 36,
];

export interface GateActivation {
  gate: number; // 1-64
  line: number; // 1-6
  color: number; // 1-6
  tone: number; // 1-6
  base: number; // 1-5
}

// Map a tropical ecliptic longitude (0-360°) → gate / line / color / tone / base.
export function longitudeToGate(longitudeDeg: number): GateActivation {
  const adjusted = (((longitudeDeg - GATE_WHEEL_OFFSET) % 360) + 360) % 360;
  const gateIndex = Math.floor(adjusted / GATE_SIZE_DEG);
  const gate = GATE_SEQUENCE[gateIndex];

  const positionInGate = adjusted - gateIndex * GATE_SIZE_DEG;
  const line = Math.floor(positionInGate / LINE_SIZE_DEG) + 1;

  const positionInLine = positionInGate - (line - 1) * LINE_SIZE_DEG;
  const color = Math.floor(positionInLine / COLOR_SIZE_DEG) + 1;

  const positionInColor = positionInLine - (color - 1) * COLOR_SIZE_DEG;
  const tone = Math.floor(positionInColor / TONE_SIZE_DEG) + 1;

  const positionInTone = positionInColor - (tone - 1) * TONE_SIZE_DEG;
  const base = Math.floor(positionInTone / BASE_SIZE_DEG) + 1;

  return { gate, line, color, tone, base };
}

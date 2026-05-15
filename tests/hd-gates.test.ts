import { describe, it, expect } from "vitest";
import {
  GATE_SEQUENCE,
  GATE_SIZE_DEG,
  longitudeToGate,
} from "@/lib/constants/hd-gates";

describe("HD gate wheel math", () => {
  it("has all 64 gates exactly once in the sequence", () => {
    expect(GATE_SEQUENCE.length).toBe(64);
    const set = new Set(GATE_SEQUENCE);
    expect(set.size).toBe(64);
    for (let g = 1; g <= 64; g++) expect(set.has(g)).toBe(true);
  });

  it("each gate spans exactly 5.625°", () => {
    expect(GATE_SIZE_DEG).toBeCloseTo(5.625, 6);
    // Sweeping a single gate's worth of degrees should change the gate.
    const start = 50; // arbitrary starting longitude
    const a = longitudeToGate(start).gate;
    const b = longitudeToGate(start + GATE_SIZE_DEG + 0.0001).gate;
    expect(a).not.toBe(b);
  });

  it("line is 1-6 across a gate", () => {
    for (let i = 0; i < 6; i++) {
      const lon = i * (GATE_SIZE_DEG / 6) + 0.001;
      const r = longitudeToGate(10 + lon);
      expect(r.line).toBe(i + 1);
    }
  });
});

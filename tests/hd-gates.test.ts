import { describe, it, expect } from "vitest";
import {
  GATE_SEQUENCE,
  GATE_SIZE_DEG,
  GATE_WHEEL_OFFSET,
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

describe("HD gate wheel anchors — Rave Mandala convention", () => {
  // The defining anchor of the Rave Mandala wheel: Gate 41 begins at 2°00'
  // Aquarius = 302.00° tropical longitude. This anchor is shared across
  // Ra Uru Hu's official software (Jovian Archive) and multiple independent
  // open-source HD calculators. Any change to GATE_WHEEL_OFFSET or
  // GATE_SEQUENCE that breaks this anchor changes which gate every planet
  // activates and must be reviewed carefully.

  it("Gate 41 starts at exactly 302.00° (= 2°00' Aquarius)", () => {
    // Just inside Gate 41's starting boundary.
    const justInside = longitudeToGate(302.001);
    expect(justInside.gate).toBe(41);
    expect(justInside.line).toBe(1);

    // Just outside (still in the previous gate, Gate 60).
    const justOutside = longitudeToGate(301.999);
    expect(justOutside.gate).toBe(60);
  });

  it("Gate 41 spans 302.00° to 307.625° (= 2°00' to 7°37'30\" Aquarius)", () => {
    // Mid-gate
    const mid = longitudeToGate(302 + GATE_SIZE_DEG / 2);
    expect(mid.gate).toBe(41);
    // Last line (line 6) just before the next gate
    const endOfLine6 = longitudeToGate(302 + GATE_SIZE_DEG - 0.001);
    expect(endOfLine6.gate).toBe(41);
    expect(endOfLine6.line).toBe(6);
  });

  it("GATE_WHEEL_OFFSET equals 358.25° (verified against multiple open-source HD implementations)", () => {
    expect(GATE_WHEEL_OFFSET).toBeCloseTo(358.25, 6);
  });

  it("Gate 25 (sequence index 0) starts at 358.25° = 28°15' Pisces", () => {
    const r = longitudeToGate(358.251);
    expect(r.gate).toBe(25);
    expect(r.line).toBe(1);
  });
});

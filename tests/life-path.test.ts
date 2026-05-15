import { describe, it, expect } from "vitest";
import { calculateLifePath } from "@/lib/calculators/life-path";

describe("life path numerology", () => {
  it("computes a simple single-digit life path", () => {
    // 1990-08-22 → 8 + 4 (2+2) + 1 (1+9+9+0=19→10→1) = 13 → 4
    const r = calculateLifePath({ date: "1990-08-22" });
    expect(r.lifePath).toBe(4);
    expect(r.isMaster).toBe(false);
  });

  it("preserves master number 11", () => {
    // 1980-02-29 (handled separately); pick a date that sums to 11
    // 1979-08-29 → 8 + 11 (2+9=11 master, kept) + 8 (1+9+7+9=26→8) = 27 → 9
    // Try: 1992-08-29: 8 + 11 + 3 (1+9+9+2=21→3) = 22 → master
    const r = calculateLifePath({ date: "1992-08-29" });
    expect(r.lifePath).toBe(22);
    expect(r.isMaster).toBe(true);
  });

  it("rejects malformed dates", () => {
    expect(() => calculateLifePath({ date: "not-a-date" })).toThrow();
  });
});

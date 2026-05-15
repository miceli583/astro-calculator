import { describe, it, expect } from "vitest";
import { calculateDestinyCard } from "@/lib/calculators/destiny-card";

describe("destiny card lookup", () => {
  it("returns the King of Spades for January 1", () => {
    const r = calculateDestinyCard({ date: "2024-01-01" });
    expect(r.birthCard.rank).toBe("K");
    expect(r.birthCard.suit).toBe("spades");
  });

  it("returns the Joker for December 31", () => {
    const r = calculateDestinyCard({ date: "2024-12-31" });
    expect(r.birthCard.name).toBe("Joker");
  });

  it("falls back to Feb 28 card for Feb 29", () => {
    const leap = calculateDestinyCard({ date: "2020-02-29" });
    const reg = calculateDestinyCard({ date: "2021-02-28" });
    expect(leap.birthCard.symbol).toBe(reg.birthCard.symbol);
  });
});

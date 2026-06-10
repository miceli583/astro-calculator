import { describe, it, expect } from "vitest";
import { calculateDestinyCard } from "@/lib/calculators/destiny-card";

// Anchor cases verified against the published Cards of Destiny Birth Chart
// (Robert Lee Camp). Each row in the chart was sampled at the 1st, the user's
// birthday (Apr 8), and the last data day of every month.

interface Anchor { date: string; symbol: string; name: string; }

const ANCHORS: Anchor[] = [
  // First-of-month anchors (12)
  { date: "2024-01-01", symbol: "K♠",  name: "King of Spades" },
  { date: "2024-02-01", symbol: "J♠",  name: "Jack of Spades" },
  { date: "2024-03-01", symbol: "9♠",  name: "Nine of Spades" },
  { date: "2024-04-01", symbol: "7♠",  name: "Seven of Spades" },
  { date: "2024-05-01", symbol: "5♠",  name: "Five of Spades" },
  { date: "2024-06-01", symbol: "3♠",  name: "Three of Spades" },
  { date: "2024-07-01", symbol: "A♠",  name: "Ace of Spades" },
  { date: "2024-08-01", symbol: "Q♦",  name: "Queen of Diamonds" },
  { date: "2024-09-01", symbol: "10♦", name: "Ten of Diamonds" },
  { date: "2024-10-01", symbol: "8♦",  name: "Eight of Diamonds" },
  { date: "2024-11-01", symbol: "6♦",  name: "Six of Diamonds" },
  { date: "2024-12-01", symbol: "4♦",  name: "Four of Diamonds" },

  // The user's birthday — the case that started this fix.
  { date: "1998-04-08", symbol: "K♦",  name: "King of Diamonds" },

  // End-of-month anchors that exercise the wrap.
  { date: "2024-01-31", symbol: "9♣",  name: "Nine of Clubs" },
  { date: "2024-02-28", symbol: "10♣", name: "Ten of Clubs" },
  { date: "2024-03-31", symbol: "5♣",  name: "Five of Clubs" },
  { date: "2024-07-31", symbol: "10♥", name: "Ten of Hearts" },
  { date: "2024-12-30", symbol: "A♥",  name: "Ace of Hearts" },
];

describe("destiny card lookup", () => {
  for (const a of ANCHORS) {
    it(`${a.date} → ${a.symbol}`, () => {
      const r = calculateDestinyCard({ date: a.date });
      expect(r.birthCard.symbol).toBe(a.symbol);
      expect(r.birthCard.name).toBe(a.name);
    });
  }

  it("Dec 31 → Joker", () => {
    const r = calculateDestinyCard({ date: "2024-12-31" });
    expect(r.birthCard.name).toBe("Joker");
  });

  it("Feb 29 falls back to Feb 28", () => {
    const leap = calculateDestinyCard({ date: "2020-02-29" });
    const reg = calculateDestinyCard({ date: "2021-02-28" });
    expect(leap.birthCard.symbol).toBe(reg.birthCard.symbol);
  });

  it("rejects invalid calendar dates (Apr 31)", () => {
    expect(() => calculateDestinyCard({ date: "2024-04-31" })).toThrow();
  });
});

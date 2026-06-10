// Destiny Cards / Cards of Destiny (Robert Lee Camp's Solar Birth Card chart).
//
// Source of truth: the Cards of Destiny Birth Chart as published by Camp and
// widely reproduced (e.g. Ashley Long / Cardologer at createtheleap.com).
//
// Algorithmic structure:
//   - The deck is fixed in this order: K♠ Q♠ J♠ 10♠ … A♠ → K♦ … A♦ → K♣ … A♣ → K♥ … A♥
//     (52 cards: spades, diamonds, clubs, hearts; each suit descending K→A)
//   - Each month starts 2 deck-positions ahead of the previous month.
//   - Each day within a month advances 1 deck-position.
//   - Formula: deckIndex = (2·(month − 1) + (day − 1)) mod 52
//   - Sole exception: December 31 → Joker (no card).
//
// Feb 29 has no native cell on the chart; FEB_29_FALLBACK selects whether it
// resolves to Feb 28 (default) or Mar 1.

export type Suit = "spades" | "hearts" | "diamonds" | "clubs";
export type Rank =
  | "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";

export interface Card {
  rank: Rank;
  suit: Suit;
  symbol: string; // e.g. "Q♥"
  name: string; // e.g. "Queen of Hearts"
}

const SUIT_GLYPH: Record<Suit, string> = {
  spades: "♠",
  hearts: "♥",
  diamonds: "♦",
  clubs: "♣",
};

const RANK_NAME: Record<Rank, string> = {
  A: "Ace", "2": "Two", "3": "Three", "4": "Four", "5": "Five", "6": "Six",
  "7": "Seven", "8": "Eight", "9": "Nine", "10": "Ten", J: "Jack", Q: "Queen", K: "King",
};

export function makeCard(rank: Rank, suit: Suit): Card {
  return {
    rank,
    suit,
    symbol: `${rank}${SUIT_GLYPH[suit]}`,
    name: `${RANK_NAME[rank]} of ${suit.charAt(0).toUpperCase()}${suit.slice(1)}`,
  };
}

// Days-per-month for invalid-date rejection (Feb 29 handled separately).
const DAYS_IN_MONTH: Record<number, number> = {
  1: 31, 2: 28, 3: 31, 4: 30, 5: 31, 6: 30,
  7: 31, 8: 31, 9: 30, 10: 31, 11: 30, 12: 31,
};

// Deck order: K Q J 10 9 8 7 6 5 4 3 2 A, suits S → D → C → H.
const RANK_ORDER: Rank[] = ["K", "Q", "J", "10", "9", "8", "7", "6", "5", "4", "3", "2", "A"];
const SUIT_ORDER: Suit[] = ["spades", "diamonds", "clubs", "hearts"];

function cardAtDeckIndex(idx: number): Card {
  const i = ((idx % 52) + 52) % 52;
  const suit = SUIT_ORDER[Math.floor(i / 13)];
  const rank = RANK_ORDER[i % 13];
  return makeCard(rank, suit);
}

export const FEB_29_FALLBACK: "feb_28" | "march_1" = "feb_28";

const JOKER: Card = { rank: "A", suit: "spades", symbol: "🃏", name: "Joker" };

export function birthCardFor(month: number, day: number): Card {
  if (month < 1 || month > 12) throw new Error(`Invalid month ${month}`);
  if (day < 1) throw new Error(`Invalid day ${day} for month ${month}`);
  if (month === 12 && day === 31) return JOKER;
  if (month === 2 && day === 29) {
    return FEB_29_FALLBACK === "feb_28" ? birthCardFor(2, 28) : birthCardFor(3, 1);
  }
  if (day > DAYS_IN_MONTH[month]) {
    throw new Error(`Invalid day ${day} for month ${month}`);
  }
  return cardAtDeckIndex(2 * (month - 1) + (day - 1));
}

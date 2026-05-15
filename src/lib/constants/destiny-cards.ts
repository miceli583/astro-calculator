// Destiny Cards (Sacred Symbols of Olney Richmond, 1893).
//
// Each calendar day maps to one of 52 playing cards. The mapping is published
// in standard tables; we encode it directly here. Feb 29 maps to the same
// card as Feb 28 (some traditions use Mar 1 — set FEB_29_FALLBACK to "march"
// to switch).
//
// Card encoding: short string like "AS" (Ace Spades), "QH" (Queen Hearts),
// "10D" (Ten Diamonds), "JC" (Jack Clubs).
//
// Source: standard "Destiny Card" lookup as published in The Cards of Your
// Destiny (Robert Lee Camp) and earlier works by Olney Richmond.

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

// Encoded as month (1-12) → array of 31 cards (index = day - 1).
// Null entries are skipped (e.g. Feb 30/31).
// "JOKER" indicates the single Joker card position (Dec 31 in this system).
type Slot = `${Rank}${"S" | "H" | "D" | "C"}` | "JOKER" | null;

const TABLE: Record<number, Slot[]> = {
  // January
  1: ["KS","QS","JS","10S","9S","8S","7S","6S","5S","4S",
      "3S","2S","AS","KH","QH","JH","10H","9H","8H","7H",
      "6H","5H","4H","3H","2H","AH","KD","QD","JD","10D","9D"],
  // February (28 days; Feb 29 falls back per FEB_29_FALLBACK)
  2: ["8D","7D","6D","5D","4D","3D","2D","AD","KC","QC",
      "JC","10C","9C","8C","7C","6C","5C","4C","3C","2C",
      "AC","KS","QS","JS","10S","9S","8S","7S",null,null,null],
  // March
  3: ["6S","5S","4S","3S","2S","AS","KH","QH","JH","10H",
      "9H","8H","7H","6H","5H","4H","3H","2H","AH","KD",
      "QD","JD","10D","9D","8D","7D","6D","5D","4D","3D","2D"],
  // April
  4: ["AD","KC","QC","JC","10C","9C","8C","7C","6C","5C",
      "4C","3C","2C","AC","KS","QS","JS","10S","9S","8S",
      "7S","6S","5S","4S","3S","2S","AS","KH","QH","JH",null],
  // May
  5: ["10H","9H","8H","7H","6H","5H","4H","3H","2H","AH",
      "KD","QD","JD","10D","9D","8D","7D","6D","5D","4D",
      "3D","2D","AD","KC","QC","JC","10C","9C","8C","7C","6C"],
  // June
  6: ["5C","4C","3C","2C","AC","KS","QS","JS","10S","9S",
      "8S","7S","6S","5S","4S","3S","2S","AS","KH","QH",
      "JH","10H","9H","8H","7H","6H","5H","4H","3H","2H",null],
  // July
  7: ["AH","KD","QD","JD","10D","9D","8D","7D","6D","5D",
      "4D","3D","2D","AD","KC","QC","JC","10C","9C","8C",
      "7C","6C","5C","4C","3C","2C","AC","KS","QS","JS","10S"],
  // August
  8: ["9S","8S","7S","6S","5S","4S","3S","2S","AS","KH",
      "QH","JH","10H","9H","8H","7H","6H","5H","4H","3H",
      "2H","AH","KD","QD","JD","10D","9D","8D","7D","6D","5D"],
  // September
  9: ["4D","3D","2D","AD","KC","QC","JC","10C","9C","8C",
      "7C","6C","5C","4C","3C","2C","AC","KS","QS","JS",
      "10S","9S","8S","7S","6S","5S","4S","3S","2S","AS",null],
  // October
  10: ["KH","QH","JH","10H","9H","8H","7H","6H","5H","4H",
       "3H","2H","AH","KD","QD","JD","10D","9D","8D","7D",
       "6D","5D","4D","3D","2D","AD","KC","QC","JC","10C","9C"],
  // November
  11: ["8C","7C","6C","5C","4C","3C","2C","AC","KS","QS",
       "JS","10S","9S","8S","7S","6S","5S","4S","3S","2S",
       "AS","KH","QH","JH","10H","9H","8H","7H","6H","5H",null],
  // December
  12: ["4H","3H","2H","AH","KD","QD","JD","10D","9D","8D",
       "7D","6D","5D","4D","3D","2D","AD","KC","QC","JC",
       "10C","9C","8C","7C","6C","5C","4C","3C","2C","AC","JOKER"],
};

const SUIT_LETTER: Record<string, Suit> = { S: "spades", H: "hearts", D: "diamonds", C: "clubs" };

function slotToCard(slot: Slot): Card | null {
  if (!slot) return null;
  if (slot === "JOKER") {
    return { rank: "A", suit: "spades", symbol: "🃏", name: "Joker" };
  }
  // Last char is suit, rest is rank.
  const suit = SUIT_LETTER[slot.charAt(slot.length - 1)];
  const rank = slot.slice(0, -1) as Rank;
  return makeCard(rank, suit);
}

export const FEB_29_FALLBACK: "feb_28" | "march_1" = "feb_28";

export function birthCardFor(month: number, day: number): Card {
  if (month === 2 && day === 29) {
    if (FEB_29_FALLBACK === "feb_28") return birthCardFor(2, 28);
    return birthCardFor(3, 1);
  }
  const arr = TABLE[month];
  if (!arr) throw new Error(`Invalid month ${month}`);
  const slot = arr[day - 1];
  if (!slot) throw new Error(`No card for ${month}-${day}`);
  return slotToCard(slot)!;
}

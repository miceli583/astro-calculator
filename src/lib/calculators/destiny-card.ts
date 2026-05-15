// Destiny Card calculator (Sacred Symbols / Olney Richmond system).
// Pure date lookup — no ephemeris required.

import { birthCardFor, type Card } from "../constants/destiny-cards";
import type { DateOnly } from "../types/birth-data";

export interface DestinyCardResult {
  date: string;
  birthCard: Card;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calculateDestinyCard(input: DateOnly): DestinyCardResult {
  const m = input.date.trim().match(DATE_RE);
  if (!m) throw new Error(`Invalid date "${input.date}". Expected "YYYY-MM-DD".`);
  const month = Number(m[2]);
  const day = Number(m[3]);
  return {
    date: input.date,
    birthCard: birthCardFor(month, day),
  };
}

// Life Path numerology (Pythagorean system).
// Pure date math — no ephemeris required.

import type { DateOnly } from "../types/birth-data";

export interface LifePathResult {
  date: string;
  lifePath: number;
  birthday: number;
  isMaster: boolean;
  /** Step-by-step trace of how the number was derived. */
  reduction: string[];
}

const MASTER_NUMBERS = new Set([11, 22, 33]);

function reduceNumber(n: number, trace: string[]): number {
  while (n > 9 && !MASTER_NUMBERS.has(n)) {
    const next = n
      .toString()
      .split("")
      .reduce((acc, d) => acc + Number(d), 0);
    trace.push(`${n} → ${next}`);
    n = next;
  }
  return n;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function calculateLifePath(input: DateOnly): LifePathResult {
  const m = input.date.trim().match(DATE_RE);
  if (!m) throw new Error(`Invalid date "${input.date}". Expected "YYYY-MM-DD".`);
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);

  const trace: string[] = [];

  const reducedMonth = reduceNumber(month, trace);
  const reducedDay = reduceNumber(day, trace);
  const reducedYear = reduceNumber(year, trace);

  trace.push(`${reducedMonth} + ${reducedDay} + ${reducedYear} = ${reducedMonth + reducedDay + reducedYear}`);
  const sum = reducedMonth + reducedDay + reducedYear;
  const lifePath = reduceNumber(sum, trace);

  return {
    date: input.date,
    lifePath,
    birthday: reduceNumber(day, []),
    isMaster: MASTER_NUMBERS.has(lifePath),
    reduction: trace,
  };
}

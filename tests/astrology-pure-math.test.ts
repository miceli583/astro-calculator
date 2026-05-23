// Unit tests for the pure-math helpers in src/lib/calculators/astrology.ts.
// These functions don't touch sweph; they're deterministic and exhaustively
// testable.

import { describe, it, expect } from "vitest";
import { longitudeToSign } from "@/lib/calculators/astrology";

describe("longitudeToSign — sign boundaries", () => {
  const signs = [
    "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
    "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
  ];

  for (let i = 0; i < 12; i++) {
    it(`${signs[i]} starts at exactly ${i * 30}°`, () => {
      const s = longitudeToSign(i * 30);
      expect(s.sign).toBe(signs[i]);
      expect(s.degree).toBe(0);
      expect(s.minute).toBe(0);
      expect(s.second).toBe(0);
    });

    it(`${signs[i]} contains ${i * 30 + 15}° (mid-sign)`, () => {
      const s = longitudeToSign(i * 30 + 15);
      expect(s.sign).toBe(signs[i]);
      expect(s.degree).toBe(15);
    });
  }

  it("29°59'59\" Pisces wraps to Aries 0°0'0\" at 360°", () => {
    const s = longitudeToSign(360);
    expect(s.sign).toBe("Aries");
    expect(s.degree).toBe(0);
  });

  it("handles values > 360° by wrapping", () => {
    const s = longitudeToSign(450); // = 90° = Cancer 0°
    expect(s.sign).toBe("Cancer");
    expect(s.degree).toBe(0);
  });

  it("handles negative values by wrapping", () => {
    const s = longitudeToSign(-30); // = 330° = Pisces 0°
    expect(s.sign).toBe("Pisces");
    expect(s.degree).toBe(0);
  });

  it("decomposes 99.6667° as Cancer 9°40'0\" (Diana's Sun)", () => {
    const s = longitudeToSign(99 + 40 / 60);
    expect(s.sign).toBe("Cancer");
    expect(s.degree).toBe(9);
    expect(s.minute).toBe(40);
    expect(s.second).toBe(0);
  });

  it("decomposes 1.5° as Aries 1°30'0\"", () => {
    const s = longitudeToSign(1.5);
    expect(s.sign).toBe("Aries");
    expect(s.degree).toBe(1);
    expect(s.minute).toBe(30);
  });

  it("decomposes minute/second arithmetic precisely (15°25'45\" Leo)", () => {
    // 15°25'45" within Leo = 120 + 15 + 25/60 + 45/3600 = 135.4291666...
    const longitude = 4 * 30 + 15 + 25 / 60 + 45 / 3600;
    const s = longitudeToSign(longitude);
    expect(s.sign).toBe("Leo");
    expect(s.degree).toBe(15);
    expect(s.minute).toBe(25);
    expect(s.second).toBe(45);
  });
});

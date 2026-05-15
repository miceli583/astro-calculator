import { describe, it, expect } from "vitest";
import { parseLocalISO, timezoneOffsetMinutes, toUTC } from "@/lib/ephemeris/julian-day";

describe("timezone conversion", () => {
  it("resolves DST in America/New_York for July (EDT, -240)", () => {
    const local = parseLocalISO("1980-07-15T14:30:00");
    expect(timezoneOffsetMinutes(local, "America/New_York")).toBe(-240);
  });

  it("resolves standard time for January (EST, -300)", () => {
    const local = parseLocalISO("1980-01-15T14:30:00");
    expect(timezoneOffsetMinutes(local, "America/New_York")).toBe(-300);
  });

  it("converts local time to UTC correctly", () => {
    const local = parseLocalISO("1980-07-15T14:30:00");
    const utc = toUTC(local, "America/New_York");
    // 14:30 EDT = 18:30 UTC
    expect(utc.hour).toBe(18);
    expect(utc.minute).toBe(30);
  });

  it("handles Asia/Tokyo (+540, no DST)", () => {
    const local = parseLocalISO("2000-06-15T12:00:00");
    expect(timezoneOffsetMinutes(local, "Asia/Tokyo")).toBe(540);
  });
});

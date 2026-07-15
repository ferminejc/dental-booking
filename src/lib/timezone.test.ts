import { describe, expect, it } from "vitest";
import {
  manilaCalendarDaysBetween,
  manilaDateTimeToUtc,
  manilaWeekday,
  utcToManilaDateString,
  utcToManilaTimeString,
} from "./timezone";

describe("manilaDateTimeToUtc", () => {
  it("converts a daytime Manila wall-clock time to UTC (same calendar date)", () => {
    expect(manilaDateTimeToUtc("2026-07-15", "09:00").toISOString()).toBe(
      "2026-07-15T01:00:00.000Z",
    );
  });

  it("rolls the UTC calendar date backward for early Manila morning hours", () => {
    // Manila is UTC+8, so 00:30 on the 15th is still 16:30 on the 14th in UTC.
    expect(manilaDateTimeToUtc("2026-07-15", "00:30").toISOString()).toBe(
      "2026-07-14T16:30:00.000Z",
    );
  });
});

describe("utcToManilaDateString", () => {
  it("returns the same calendar date for a daytime UTC instant", () => {
    expect(utcToManilaDateString(new Date("2026-07-15T01:00:00.000Z"))).toBe("2026-07-15");
  });

  it("rolls the Manila calendar date forward for late UTC evening instants", () => {
    // 20:00 UTC is already 04:00 the next day in Manila.
    expect(utcToManilaDateString(new Date("2026-07-15T20:00:00.000Z"))).toBe("2026-07-16");
  });
});

describe("utcToManilaTimeString", () => {
  it("returns the Manila wall-clock time for a UTC instant", () => {
    expect(utcToManilaTimeString(new Date("2026-07-15T01:00:00.000Z"))).toBe("09:00");
  });
});

describe("manilaWeekday", () => {
  it("returns the correct weekday key for a midweek date", () => {
    expect(manilaWeekday("2026-07-15")).toBe("wed");
  });

  it("returns 'sun' for a Sunday", () => {
    expect(manilaWeekday("2026-07-19")).toBe("sun");
  });
});

describe("manilaCalendarDaysBetween", () => {
  it("returns 0 for the same date", () => {
    expect(manilaCalendarDaysBetween("2026-07-15", "2026-07-15")).toBe(0);
  });

  it("returns a positive count for a later date", () => {
    expect(manilaCalendarDaysBetween("2026-07-15", "2026-08-14")).toBe(30);
  });

  it("returns a negative count for an earlier date", () => {
    expect(manilaCalendarDaysBetween("2026-07-15", "2026-07-14")).toBe(-1);
  });
});

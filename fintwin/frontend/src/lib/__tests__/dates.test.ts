import { describe, expect, it } from "vitest";

import {
  addDays,
  addMonths,
  differenceInDays,
  formatRelativeDay,
  isWithinRange,
  occurrencesBetween,
  parseIsoDate,
  toIsoDate,
} from "@/lib/dates";

describe("date arithmetic", () => {
  it("parses and formats in UTC, so a date is the same calendar day everywhere", () => {
    expect(toIsoDate(parseIsoDate("2026-10-12"))).toBe("2026-10-12");
    expect(parseIsoDate("2026-10-12").getUTCDate()).toBe(12);
  });

  it("adds days across a month boundary", () => {
    expect(addDays("2026-10-28", 7)).toBe("2026-11-04");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("clamps the day of month when a month is too short", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", -1)).toBe("2026-02-28");
  });

  it("measures whole days in both directions", () => {
    expect(differenceInDays("2026-10-12", "2026-11-11")).toBe(30);
    expect(differenceInDays("2026-11-11", "2026-10-12")).toBe(-30);
    expect(differenceInDays("2026-10-12", "2026-10-12")).toBe(0);
  });

  it("treats range bounds as inclusive", () => {
    expect(isWithinRange("2026-10-13", "2026-10-13", "2026-11-11")).toBe(true);
    expect(isWithinRange("2026-11-11", "2026-10-13", "2026-11-11")).toBe(true);
    expect(isWithinRange("2026-11-12", "2026-10-13", "2026-11-11")).toBe(false);
  });
});

describe("occurrencesBetween", () => {
  it("steps biweekly from an anchor inside the window", () => {
    expect(
      occurrencesBetween("2026-10-09", "biweekly", "2026-10-13", "2026-11-11"),
    ).toEqual(["2026-10-23", "2026-11-06"]);
  });

  it("steps weekly and includes an anchor that lands on the start date", () => {
    expect(
      occurrencesBetween("2026-10-13", "weekly", "2026-10-13", "2026-11-03"),
    ).toEqual(["2026-10-13", "2026-10-20", "2026-10-27", "2026-11-03"]);
  });

  it("repeats a monthly anchor's day of month", () => {
    expect(
      occurrencesBetween("2026-10-01", "monthly", "2026-10-13", "2026-12-31"),
    ).toEqual(["2026-11-01", "2026-12-01"]);
  });

  it("handles an anchor that starts after the window", () => {
    expect(
      occurrencesBetween("2026-11-05", "monthly", "2026-10-13", "2026-11-11"),
    ).toEqual(["2026-11-05"]);
  });

  it("clamps monthly occurrences into short months", () => {
    expect(
      occurrencesBetween("2026-01-31", "monthly", "2026-02-01", "2026-04-30"),
    ).toEqual(["2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("returns nothing for an inverted window", () => {
    expect(
      occurrencesBetween("2026-10-01", "monthly", "2026-11-11", "2026-10-13"),
    ).toEqual([]);
  });
});

describe("formatRelativeDay", () => {
  it("names the days around the reference date", () => {
    expect(formatRelativeDay("2026-10-12", "2026-10-12")).toBe("today");
    expect(formatRelativeDay("2026-10-13", "2026-10-12")).toBe("tomorrow");
    expect(formatRelativeDay("2026-10-11", "2026-10-12")).toBe("yesterday");
    expect(formatRelativeDay("2026-10-22", "2026-10-12")).toBe("in 10 days");
    expect(formatRelativeDay("2026-10-02", "2026-10-12")).toBe("10 days ago");
  });
});

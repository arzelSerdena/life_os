import { afterEach, describe, expect, test, vi } from "vitest";
import { periodInSentence, periodLabel, periodRange, shiftPeriod } from "./period";

afterEach(() => {
  vi.useRealTimers();
});

describe("periodRange", () => {
  test("a week runs Monday to Sunday", () => {
    expect(periodRange("week", "2026-11-14")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(periodRange("week", "2026-11-09")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
    expect(periodRange("week", "2026-11-15")).toEqual({ start: "2026-11-09", end: "2026-11-15" });
  });

  test("a week can span two years", () => {
    expect(periodRange("week", "2027-01-01")).toEqual({ start: "2026-12-28", end: "2027-01-03" });
  });

  test("months, quarters and years end on their last day", () => {
    expect(periodRange("month", "2028-02-10")).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(periodRange("quarter", "2026-11-14")).toEqual({
      start: "2026-10-01",
      end: "2026-12-31",
    });
    expect(periodRange("year", "2026-11-14")).toEqual({ start: "2026-01-01", end: "2026-12-31" });
  });
});

describe("shiftPeriod", () => {
  test("moves to the first day of the next or previous period", () => {
    expect(shiftPeriod("week", "2026-11-14", 1)).toBe("2026-11-16");
    expect(shiftPeriod("month", "2026-01-31", 1)).toBe("2026-02-01");
    expect(shiftPeriod("quarter", "2026-11-14", -1)).toBe("2026-07-01");
    expect(shiftPeriod("quarter", "2026-11-14", 1)).toBe("2027-01-01");
    expect(shiftPeriod("year", "2026-11-14", -1)).toBe("2025-01-01");
  });
});

describe("periodLabel", () => {
  test("names each period", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 14) });
    expect(periodLabel("week", "2026-11-14")).toBe("Nov 9 – 15");
    expect(periodLabel("week", "2026-11-02")).toBe("Nov 2 – 8");
    expect(periodLabel("week", "2026-10-28")).toBe("Oct 26 – Nov 1");
    expect(periodLabel("week", "2027-01-01")).toBe("Dec 28 – Jan 3, 2027");
    expect(periodLabel("month", "2026-11-14")).toBe("Nov 2026");
    expect(periodLabel("quarter", "2026-11-14")).toBe("Q4 2026");
    expect(periodLabel("year", "2026-11-14")).toBe("2026");
  });
});

describe("periodInSentence", () => {
  test("names the period inside a sentence, adding the year only when it isn't this year", () => {
    vi.useFakeTimers({ now: new Date(2026, 10, 14) });
    expect(periodInSentence("week", "2026-11-14")).toBe("the week of Nov 9");
    expect(periodInSentence("month", "2026-11-14")).toBe("November");
    expect(periodInSentence("quarter", "2026-11-14")).toBe("Q4");
    expect(periodInSentence("quarter", "2027-01-05")).toBe("Q1 2027");
    expect(periodInSentence("week", "2027-01-05")).toBe("the week of Jan 4, 2027");
    expect(periodInSentence("year", "2026-11-14")).toBe("2026");
  });
});

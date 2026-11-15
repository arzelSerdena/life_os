import { expect, test } from "vitest";
import { formatDuration, formatValue, inputAffixes, parseValue, valueParts } from "./format";

const money = { format: "currency", unit: "PHP" } as const;

test("formats each metric format", () => {
  expect(formatValue(1500, money)).toBe("₱1,500");
  expect(formatValue(12.5, money)).toBe("₱12.5");
  expect(formatValue(35, { format: "percent", unit: null })).toBe("35%");
  expect(formatValue(90, { format: "duration", unit: null })).toBe("1 h 30 m");
  expect(formatValue(17, { format: "number", unit: "km" })).toBe("17 km");
  expect(formatValue(3, { format: "number", unit: null })).toBe("3");
  expect(formatValue(3, { format: null, unit: null })).toBe("3");
});

test("tiles go compact from 100,000 on", () => {
  expect(formatValue(100_000, money, { compact: true })).toBe("₱100K");
  expect(formatValue(10_500, money, { compact: true })).toBe("₱10,500");
  expect(valueParts(250_000, { format: "number", unit: "steps" }, { compact: true })).toEqual({
    number: "250K",
    unit: "steps",
  });
});

test("durations show hours and minutes", () => {
  expect(formatDuration(45)).toBe("45 m");
  expect(formatDuration(600)).toBe("10 h");
  expect(formatDuration(0)).toBe("0 m");
});

test("an unknown currency code falls back to the code after the number", () => {
  expect(formatValue(5, { format: "currency", unit: "ZZZ1" })).toBe("5 ZZZ1");
});

test("inputs show the currency symbol or the unit", () => {
  expect(inputAffixes(money)).toEqual({ prefix: "₱", suffix: "" });
  expect(inputAffixes({ format: "number", unit: "km" })).toEqual({ prefix: "", suffix: "km" });
  expect(inputAffixes({ format: "percent", unit: null })).toEqual({ prefix: "", suffix: "%" });
});

test("typed values are read into the stored unit", () => {
  expect(parseValue("12,500", "currency")).toBe(12500);
  expect(parseValue("₱1,500", "currency")).toBe(1500);
  expect(parseValue("35%", "percent")).toBe(35);
  expect(parseValue("1.5", "duration")).toBe(90);
  expect(parseValue("1:30", "duration")).toBe(90);
  expect(parseValue("1 h 30 m", "duration")).toBe(90);
  expect(parseValue("45m", "duration")).toBe(45);
  expect(parseValue("", "number")).toBeNull();
  expect(parseValue("abc", "number")).toBeNull();
  expect(parseValue("-2", "number")).toBe(-2);
});

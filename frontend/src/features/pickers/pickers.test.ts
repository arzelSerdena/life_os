import { expect, test } from "vitest";
import { dayDate, parseDate, relativeName } from "./dates";
import {
  describeRepeat,
  endsOn,
  occurrences,
  presetOf,
  presets,
  type RepeatRule,
  simpleRule,
  toRRule,
} from "./repeat";

const TODAY = "2026-11-14"; // a Saturday

test("typed dates: words, weekdays, offsets, month names and numbers", () => {
  expect(parseDate("today", TODAY)).toBe(TODAY);
  expect(parseDate("tom", TODAY)).toBe("2026-11-15");
  expect(parseDate("fri", TODAY)).toBe("2026-11-20");
  expect(parseDate("sat", TODAY)).toBe(TODAY); // this Saturday is today
  expect(parseDate("+3d", TODAY)).toBe("2026-11-17");
  expect(parseDate("+2w", TODAY)).toBe("2026-11-28");
  expect(parseDate("+1m", TODAY)).toBe("2026-12-14");
  expect(parseDate("nov 20", TODAY)).toBe("2026-11-20");
  expect(parseDate("20 November", TODAY)).toBe("2026-11-20");
  expect(parseDate("nov 2", TODAY)).toBe("2027-11-02"); // passed this year
  expect(parseDate("Feb 27, 2027", TODAY)).toBe("2027-02-27");
  expect(parseDate("11/20", TODAY)).toBe("2026-11-20");
  expect(parseDate("2/29/2028", TODAY)).toBe("2028-02-29");
  expect(parseDate("2026-12-01", TODAY)).toBe("2026-12-01");
  expect(parseDate("20", TODAY)).toBe("2026-11-20");
  expect(parseDate("3", TODAY)).toBe("2026-12-03");
});

test("typed dates that mean nothing give null", () => {
  for (const text of ["", "x", "feb 30", "2026-02-30", "13/1", "nov", "1 2 3", "+3"]) {
    expect(parseDate(text, TODAY)).toBeNull();
  }
});

test("date names", () => {
  expect(dayDate("2026-11-15")).toBe("Sun, Nov 15");
  expect(relativeName(TODAY, TODAY)).toBe("Today");
  expect(relativeName("2026-11-15", TODAY)).toBe("Tomorrow");
  expect(relativeName("2026-11-20", TODAY)).toBe("Friday");
  expect(relativeName("2026-11-21", TODAY)).toBe("Nov 21, 2026");
});

test("presets come from the anchor date and are recognised again", () => {
  const list = presets(TODAY);
  expect(list.map((p) => [p.label, p.note])).toEqual([
    ["Every day", ""],
    ["Every weekday", "Mon – Fri"],
    ["Every week", "Sat"],
    ["Every month", "on the 14th"],
    ["Every year", "Nov 14"],
  ]);
  for (const preset of list) expect(presetOf(preset.rule, TODAY)).toBe(preset.id);
  expect(presetOf({ ...simpleRule("daily", TODAY), interval: 2 }, TODAY)).toBeNull();
});

test("rules become the API's RRULE, without DTSTART, UNTIL or COUNT", () => {
  expect(toRRule(simpleRule("daily", TODAY), TODAY)).toBe("FREQ=DAILY");
  expect(toRRule(presets(TODAY)[1].rule, TODAY)).toBe("FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR");
  expect(toRRule({ ...simpleRule("weekly", TODAY), interval: 2, weekdays: [5, 1] }, TODAY)).toBe(
    "FREQ=WEEKLY;INTERVAL=2;BYDAY=TU,SA",
  );
  expect(toRRule(simpleRule("monthly", TODAY), TODAY)).toBe("FREQ=MONTHLY;BYMONTHDAY=14");
  expect(toRRule(simpleRule("yearly", TODAY), TODAY)).toBe("FREQ=YEARLY;BYMONTH=11;BYMONTHDAY=14");
});

test("After n times becomes the date of the nth occurrence", () => {
  const tueSat: RepeatRule = {
    ...simpleRule("weekly", TODAY),
    weekdays: [1, 5],
    ends: { kind: "after", count: 4 },
  };
  expect(occurrences(tueSat, TODAY, 4)).toEqual([
    "2026-11-14",
    "2026-11-17",
    "2026-11-21",
    "2026-11-24",
  ]);
  expect(endsOn(tueSat, TODAY)).toBe("2026-11-24");
  // Every other week counts weeks from the anchor's Monday.
  const fortnight = { ...tueSat, interval: 2 };
  expect(occurrences(fortnight, TODAY, 3)).toEqual(["2026-11-14", "2026-11-24", "2026-11-28"]);
  // A month without the 31st is skipped, as the API's rule does.
  expect(occurrences(simpleRule("monthly", "2027-01-31"), "2027-01-31", 3)).toEqual([
    "2027-01-31",
    "2027-03-31",
    "2027-05-31",
  ]);
  expect(endsOn({ ...tueSat, ends: { kind: "on", date: "2027-02-27" } }, TODAY)).toBe("2027-02-27");
  expect(endsOn({ ...tueSat, ends: { kind: "never" } }, TODAY)).toBeNull();
});

test("rules described as data", () => {
  expect(describeRepeat(simpleRule("daily", TODAY), TODAY)).toBe("Every day");
  expect(describeRepeat({ ...simpleRule("daily", TODAY), interval: 3 }, TODAY)).toBe(
    "Every 3 days",
  );
  expect(describeRepeat(presets(TODAY)[1].rule, TODAY)).toBe("Every weekday");
  expect(describeRepeat(simpleRule("weekly", TODAY), TODAY)).toBe("Every Sat");
  expect(
    describeRepeat(
      {
        ...simpleRule("weekly", TODAY),
        weekdays: [1, 5],
        ends: { kind: "on", date: "2027-02-27" },
      },
      TODAY,
    ),
  ).toBe("Every Tue, Sat · until Feb 27");
  expect(
    describeRepeat({ ...simpleRule("weekly", TODAY), interval: 2, from: "completion" }, TODAY),
  ).toBe("Every 2 weeks · Sat · from completion");
  expect(describeRepeat(simpleRule("monthly", TODAY), TODAY)).toBe("Every month on the 14th");
  expect(
    describeRepeat({ ...simpleRule("yearly", TODAY), ends: { kind: "after", count: 5 } }, TODAY),
  ).toBe("Every year on Nov 14 · 5 times");
});

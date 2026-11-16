import { describe, expect, it } from "vitest";
import { simpleRule } from "../pickers/repeat";
import {
  canCreate,
  createEventRequest,
  durationLabel,
  endTimes,
  initialValues,
  moveStart,
  type NewEventValues,
  newEventProblem,
  startTimes,
} from "./newEvent";

const TODAY = "2026-11-16";
const base = (changes: Partial<NewEventValues> = {}): NewEventValues => ({
  ...initialValues({ lifeAreaId: 3 }, TODAY, { hours: 9, minutes: 20 }),
  title: "Coffee with Mia",
  ...changes,
});

describe("initialValues", () => {
  it("starts at the next whole hour on the spot's day, for an hour", () => {
    const values = initialValues({ day: "2026-11-20" }, TODAY, { hours: 9, minutes: 20 });
    expect(values).toMatchObject({
      startDate: "2026-11-20",
      startTime: "10:00",
      endDate: "2026-11-20",
      endTime: "11:00",
      allDay: false,
      lifeAreaId: null,
      projectId: null,
    });
  });

  it("runs past midnight late in the evening", () => {
    const values = initialValues({}, TODAY, { hours: 23, minutes: 30 });
    expect(values).toMatchObject({
      startDate: TODAY,
      startTime: "23:00",
      endDate: "2026-11-17",
      endTime: "00:00",
    });
  });
});

describe("moveStart", () => {
  it("keeps the length when the start time moves", () => {
    const moved = moveStart(base({ endTime: "11:30" }), { time: "14:00" });
    expect(moved).toMatchObject({ startTime: "14:00", endDate: TODAY, endTime: "15:30" });
  });

  it("keeps a multi-day length when the start date moves", () => {
    const moved = moveStart(base({ endDate: "2026-11-18" }), { date: "2026-11-20" });
    expect(moved).toMatchObject({ startDate: "2026-11-20", endDate: "2026-11-22" });
  });

  it("moves the end into the next day when the start moves late", () => {
    const moved = moveStart(base(), { time: "23:30" });
    expect(moved).toMatchObject({ endDate: "2026-11-17", endTime: "00:30" });
  });
});

describe("time lists", () => {
  it("lists every 15 minutes for the start", () => {
    const times = startTimes();
    expect(times).toHaveLength(96);
    expect(times.slice(0, 2)).toEqual(["00:00", "00:15"]);
    expect(times.at(-1)).toBe("23:45");
  });

  it("lists end times after the start with their durations on the same day", () => {
    const list = endTimes(base({ startTime: "14:00" }));
    expect(list[0]).toEqual({ time: "14:15", duration: "15 m" });
    expect(list[3]).toEqual({ time: "15:00", duration: "1 h" });
    expect(list[4]).toEqual({ time: "15:15", duration: "1 h 15 m" });
    expect(list.at(-1)?.time).toBe("23:45");
  });

  it("lists the whole day without durations on a later day", () => {
    const list = endTimes(base({ endDate: "2026-11-17" }));
    expect(list).toHaveLength(96);
    expect(list[0]).toEqual({ time: "00:00", duration: null });
  });

  it("reads durations", () => {
    expect(durationLabel(45)).toBe("45 m");
    expect(durationLabel(120)).toBe("2 h");
    expect(durationLabel(90)).toBe("1 h 30 m");
  });
});

describe("newEventProblem and canCreate", () => {
  it("refuses an end before the start", () => {
    expect(newEventProblem(base({ endTime: "09:00" }))).toBe("The event ends before it starts.");
    expect(newEventProblem(base({ allDay: true, endDate: "2026-11-15" }))).toBe(
      "The event ends before it starts.",
    );
  });

  it("ignores times on an all-day event", () => {
    expect(newEventProblem(base({ allDay: true, endTime: "09:00" }))).toBeNull();
  });

  it("refuses a repeat that ends before the event starts", () => {
    const repeat = { ...simpleRule("daily", TODAY), ends: { kind: "on", date: "2026-11-10" } };
    expect(newEventProblem(base({ repeat: repeat as NewEventValues["repeat"] }))).toBe(
      "The repeat ends before the event starts.",
    );
  });

  it("needs a name and an owner", () => {
    expect(canCreate(base())).toBe(true);
    expect(canCreate(base({ title: "  " }))).toBe(false);
    expect(canCreate(base({ lifeAreaId: null }))).toBe(false);
  });
});

describe("createEventRequest", () => {
  it("sends a timed one-day event with no end date", () => {
    expect(createEventRequest(base({ location: "  Blue Bottle " }))).toEqual({
      title: "Coffee with Mia",
      life_area_id: 3,
      start_date: TODAY,
      end_date: null,
      start_time: "10:00:00",
      end_time: "11:00:00",
      location: "Blue Bottle",
      rrule: null,
      repeat_ends_on: null,
    });
  });

  it("sends an all-day event over several days with no times, and a project alone", () => {
    const body = createEventRequest(
      base({ allDay: true, endDate: "2026-11-18", lifeAreaId: 3, projectId: 7 }),
    );
    expect(body).toMatchObject({
      project_id: 7,
      start_date: TODAY,
      end_date: "2026-11-18",
      start_time: null,
      end_time: null,
      location: null,
    });
    expect(body).not.toHaveProperty("life_area_id");
  });

  it("sends the repeat rule from the start date, and After n times as an end date", () => {
    const repeat = { ...simpleRule("weekly", TODAY), ends: { kind: "after", count: 3 } };
    const body = createEventRequest(base({ repeat: repeat as NewEventValues["repeat"] }));
    expect(body.rrule).toBe("FREQ=WEEKLY;BYDAY=MO");
    expect(body.repeat_ends_on).toBe("2026-11-30");
  });
});

import type { EventCreate } from "../../client/types.gen";
import { addDays, daysFrom } from "../pickers/dates";
import { endsOn, type RepeatRule, toRRule } from "../pickers/repeat";

/**
 * New event, as pure functions (STYLE_GUIDE.md, "Approved: Calendar" › New event pop-up):
 * the starting values, how the times move together, and what Create sends.
 */

/** What New event starts with: the day it was opened on and an owner, when known. */
export type EventSpot = {
  day?: string;
  lifeAreaId?: number | null;
  projectId?: number | null;
};

export type NewEventValues = {
  title: string;
  /** An event always has an owner; null until one is picked. */
  lifeAreaId: number | null;
  projectId: number | null;
  allDay: boolean;
  startDate: string;
  /** "HH:MM", 24-hour. Kept while All day is on, so turning it off brings them back. */
  startTime: string;
  endDate: string;
  endTime: string;
  repeat: RepeatRule | null;
  location: string;
};

const DAY = 24 * 60;
/** The time list's step. */
export const STEP = 15;
const DEFAULT_LENGTH = 60;

export function minutesOf(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function timeOf(minutes: number): string {
  const m = ((minutes % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** Minutes from the start of `start` day: the date and time as one number. */
function at(day: string, time: string, from: string): number {
  return daysFrom(from, day) * DAY + minutesOf(time);
}

/** A moment `minutes` after the start of `from`, as a date and a time. */
function moment(from: string, minutes: number): { date: string; time: string } {
  const days = Math.floor(minutes / DAY);
  return { date: addDays(from, days), time: timeOf(minutes - days * DAY) };
}

/**
 * The starting values: the spot's day (else today) from the next whole hour, for an hour.
 * Late in the evening the hour runs past midnight, so the event ends the next day.
 */
export function initialValues(
  spot: EventSpot,
  today: string,
  now: { hours: number; minutes: number },
): NewEventValues {
  const startDate = spot.day ?? today;
  const start = Math.min(now.hours + 1, 23) * 60;
  const end = moment(startDate, start + DEFAULT_LENGTH);
  return {
    title: "",
    lifeAreaId: spot.lifeAreaId ?? null,
    projectId: spot.projectId ?? null,
    allDay: false,
    startDate,
    startTime: timeOf(start),
    endDate: end.date,
    endTime: end.time,
    repeat: null,
    location: "",
  };
}

/** How long the event lasts, in minutes (all-day events count whole days). */
function length(values: NewEventValues): number {
  return at(values.endDate, values.endTime, values.startDate) - minutesOf(values.startTime);
}

/**
 * A new start keeps the event's length, as calendars do: moving the start moves the end.
 * An end that was already before the start is left where it is.
 */
export function moveStart(
  values: NewEventValues,
  start: { date?: string; time?: string },
): NewEventValues {
  const startDate = start.date ?? values.startDate;
  const startTime = start.time ?? values.startTime;
  const kept = length(values);
  if (kept < 0) return { ...values, startDate, startTime };
  const end = moment(startDate, minutesOf(startTime) + kept);
  return { ...values, startDate, startTime, endDate: end.date, endTime: end.time };
}

/** "15 m", "1 h", "1 h 30 m": how long an event that ends at a time lasts. */
export function durationLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} m`;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} m`;
}

/** The start time list: every 15 minutes of the day. */
export function startTimes(): string[] {
  return Array.from({ length: DAY / STEP }, (_, index) => timeOf(index * STEP));
}

/**
 * The end time list. On the start's own day it runs from 15 minutes after the start, with
 * each time's duration ("3:00 PM · 1 h"); on a later day it is the whole day.
 */
export function endTimes(values: NewEventValues): { time: string; duration: string | null }[] {
  if (values.endDate !== values.startDate) {
    return startTimes().map((time) => ({ time, duration: null }));
  }
  const start = minutesOf(values.startTime);
  const first = Math.floor(start / STEP) * STEP + STEP;
  const found: { time: string; duration: string | null }[] = [];
  for (let minutes = first; minutes < DAY; minutes += STEP) {
    found.push({ time: timeOf(minutes), duration: durationLabel(minutes - start) });
  }
  return found;
}

/** Why Create can't send yet, or null. A missing name or owner only disables the button. */
export function newEventProblem(values: NewEventValues): string | null {
  if (values.endDate < values.startDate) return "The event ends before it starts.";
  if (!values.allDay && length(values) < 0) return "The event ends before it starts.";
  const repeatEnd = values.repeat ? endsOn(values.repeat, values.startDate) : null;
  if (repeatEnd !== null && repeatEnd < values.startDate) {
    return "The repeat ends before the event starts.";
  }
  return null;
}

export function canCreate(values: NewEventValues): boolean {
  return (
    values.title.trim() !== "" &&
    (values.lifeAreaId !== null || values.projectId !== null) &&
    newEventProblem(values) === null
  );
}

/**
 * What Create sends. A one-day event stores no end date; an all-day one no times. A project
 * is sent alone, since the event takes its project's area. A repeat rule starts on the start
 * date, and "After n times" becomes the date of the last one.
 */
export function createEventRequest(values: NewEventValues): EventCreate {
  const location = values.location.trim();
  return {
    title: values.title.trim(),
    ...(values.projectId !== null
      ? { project_id: values.projectId }
      : { life_area_id: values.lifeAreaId }),
    start_date: values.startDate,
    end_date: values.endDate === values.startDate ? null : values.endDate,
    start_time: values.allDay ? null : `${values.startTime}:00`,
    end_time: values.allDay ? null : `${values.endTime}:00`,
    location: location === "" ? null : location,
    rrule: values.repeat ? toRRule(values.repeat, values.startDate) : null,
    repeat_ends_on: values.repeat ? endsOn(values.repeat, values.startDate) : null,
  };
}

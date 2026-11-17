import { expect, test } from "@playwright/test";
import {
  addDays,
  checkStep,
  createArea,
  createRoutine,
  createRoutineStep,
  serverToday,
  unique,
} from "./api.ts";

// The routine page against a real API: opened from the Plan sidebar, its run, today's
// steps checked off and skipped in the Day card, and a past day picked in the heatmap.

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const weekdayDate = (day: string) => {
  const date = new Date(`${day}T00:00:00Z`);
  return `${WEEKDAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
};

test("a routine's page shows its run and checks today's steps off", async ({ page, request }) => {
  const today = await serverToday(request);
  const start = addDays(today, -5);
  const area = await createArea(request, unique("Health"), "rose");
  const routine = await createRoutine(request, { title: unique("Evening"), starts_on: start });
  const read = await createRoutineStep(request, routine, {
    title: unique("Read"),
    life_area_id: area.id,
    starts_on: start,
  });
  const stretch = await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: start,
  });
  for (let back = 5; back >= 1; back--) {
    await checkStep(request, read, addDays(today, -back));
    await checkStep(request, stretch, addDays(today, -back));
  }

  await page.goto("/areas");
  await page
    .getByRole("navigation", { name: "Routines" })
    .getByRole("link", { name: routine.title })
    .click();

  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  await expect(page.getByText(`Every day · since ${weekdayDate(start).slice(5)}`)).toBeVisible();
  const run = page.getByRole("article", { name: "Current run" });
  await expect(run.getByText("5", { exact: true })).toBeVisible();

  const day = page.getByRole("region", { name: "Day" });
  await expect(day.getByRole("heading", { name: "Today" })).toBeVisible();
  await expect(day.getByText("0/2")).toBeVisible();

  await day.getByRole("checkbox", { name: `Mark ${read.title} done` }).click();
  await expect(day.getByText("1/2")).toBeVisible();

  const row = day.getByRole("listitem").filter({ hasText: stretch.title });
  await row.hover();
  await row.getByRole("button", { name: `Skip ${stretch.title}` }).click();
  await expect(row.getByText("Skipped")).toBeVisible();
  // Skipped steps leave the count: today is now full, so the run grows to 6.
  await expect(day.getByText("1/1")).toBeVisible();
  await expect(run.getByText("6", { exact: true })).toBeVisible();

  // A past day, picked in the heatmap, shows how it went; Today goes back.
  const yesterday = addDays(today, -1);
  await page.getByTitle(`All steps · ${weekdayDate(yesterday)} · 2 of 2 done`).click();
  await expect(
    day.getByRole("heading", { name: weekdayDate(yesterday).slice(0, 3) }),
  ).toBeVisible();
  await expect(day.getByRole("checkbox", { name: `Mark ${read.title} not done` })).toBeChecked();
  await day.getByRole("button", { name: "Today" }).click();
  await expect(day.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("a routine with no steps says so", async ({ page, request }) => {
  const routine = await createRoutine(request, { title: unique("Workout") });

  await page.goto(`/areas/routines/${routine.id}`);

  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Steps" }).getByText("No steps yet."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous period" })).toBeDisabled();
});

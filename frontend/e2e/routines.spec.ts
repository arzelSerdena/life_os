import { expect, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createRoutine,
  createRoutineStep,
  serverToday,
  unique,
} from "./api.ts";

// Tasks › Routines against a real API: a column per routine, checking a step off today,
// and a step that isn't due today showing its next date.

test("checking a step off counts it in the routine and its last seven days", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"), "teal");
  const routine = await createRoutine(request, {
    title: unique("Evening"),
    starts_on: addDays(today, -10),
  });
  const step = await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: addDays(today, -10),
  });

  await page.goto("/tasks/routines");
  const column = page.getByRole("region", { name: routine.title });
  await expect(column.getByText("Daily")).toBeVisible();
  await expect(column.getByText("0/1", { exact: true })).toBeVisible();
  const card = column.getByRole("listitem").filter({ hasText: step.title });
  await expect(card.getByText("0 of 7 done in the last 7 days")).toBeAttached();

  await card.getByRole("checkbox", { name: `Mark ${step.title} done` }).click();

  await expect(column.getByText("1/1", { exact: true })).toBeVisible();
  await expect(card.getByText("1 of 7 done in the last 7 days")).toBeAttached();
  await expect(card.getByRole("checkbox", { name: `Mark ${step.title} not done` })).toBeChecked();
});

test("a step not due today shows its next date and can't be checked", async ({ page, request }) => {
  const today = await serverToday(request);
  const tomorrow = addDays(today, 1);
  const weekday = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"][
    new Date(`${tomorrow}T00:00:00Z`).getUTCDay()
  ];
  const area = await createArea(request, unique("Career"));
  const routine = await createRoutine(request, {
    title: unique("Weekly reset"),
    rrule: `FREQ=WEEKLY;BYDAY=${weekday}`,
    starts_on: addDays(today, -14),
  });
  const step = await createRoutineStep(request, routine, {
    title: unique("Review the budget"),
    life_area_id: area.id,
    starts_on: addDays(today, -14),
  });

  await page.goto("/tasks/routines");
  const card = page
    .getByRole("region", { name: routine.title })
    .getByRole("listitem")
    .filter({ hasText: step.title });
  const [, month, day] = tomorrow.split("-").map(Number);
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  await expect(card.getByText(`${months[month - 1]} ${day}`)).toBeVisible();
  await expect(card.getByRole("checkbox")).toBeDisabled();
});

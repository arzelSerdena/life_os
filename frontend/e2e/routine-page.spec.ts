import { expect, test } from "@playwright/test";
import {
  addDays,
  checkStep,
  createArea,
  createRoutine,
  createRoutineStep,
  createStepMetric,
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

test("a square's popover and Skip day change a day, with Undo", async ({ page, request }) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"), "teal");
  const routine = await createRoutine(request, { title: unique("Morning"), starts_on: today });
  const read = await createRoutineStep(request, routine, {
    title: unique("Read"),
    life_area_id: area.id,
    starts_on: today,
  });
  const stretch = await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: today,
  });

  await page.goto(`/areas/routines/${routine.id}`);
  const day = page.getByRole("region", { name: "Day" });
  await expect(day.getByText("0/2")).toBeVisible();
  const toast = page.getByRole("status").filter({ hasText: "Skipped" });

  // A step's square opens its popover: Done checks it off.
  const square = page.getByTitle(`${read.title} · ${weekdayDate(today)}`);
  await square.click();
  const popover = page.getByRole("dialog", { name: `${read.title}, ${weekdayDate(today)}` });
  await expect(popover.getByRole("button", { name: "To do" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await popover.getByRole("button", { name: "Done" }).click();
  await expect(popover).toBeHidden();
  await expect(day.getByRole("checkbox", { name: `Mark ${read.title} not done` })).toBeChecked();

  // Skipped from the popover says so, and Undo puts the check back.
  await square.click();
  await popover.getByRole("button", { name: "Skipped" }).click();
  await expect(toast.getByText(`Skipped “${read.title}” today`)).toBeVisible();
  await expect(day.getByText("0/1")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(day.getByRole("checkbox", { name: `Mark ${read.title} not done` })).toBeChecked();

  // Skip day skips what's left; Undo brings it back.
  await day.getByRole("button", { name: "Skip day" }).click();
  await expect(toast.getByText(`Skipped day · ${weekdayDate(today)}`)).toBeVisible();
  const stretchRow = day.getByRole("listitem").filter({ hasText: stretch.title });
  await expect(stretchRow.getByText("Skipped")).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(stretchRow.getByText("Skipped")).toBeHidden();
  await expect(day.getByText("1/2")).toBeVisible();
});

test("the header renames, reschedules, pauses, archives and deletes", async ({ page, request }) => {
  const today = await serverToday(request);
  const start = addDays(today, -7);
  const area = await createArea(request, unique("Health"), "plum");
  const routine = await createRoutine(request, { title: unique("Evening"), starts_on: start });
  await createRoutineStep(request, routine, {
    title: unique("Read"),
    life_area_id: area.id,
    starts_on: start,
  });
  await page.goto(`/areas/routines/${routine.id}`);

  // Rename in place; Esc puts the name back.
  const renamed = unique("Wind down");
  await page.getByRole("button", { name: routine.title }).click();
  await page.getByRole("textbox", { name: "Routine name" }).fill("Nope");
  await page.getByRole("textbox", { name: "Routine name" }).press("Escape");
  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  await page.getByRole("button", { name: routine.title }).click();
  await page.getByRole("textbox", { name: "Routine name" }).fill(renamed);
  await page.getByRole("textbox", { name: "Routine name" }).press("Enter");
  await expect(page.getByRole("heading", { level: 1, name: renamed })).toBeVisible();

  // The schedule chip picks a rule, then asks which days it applies to.
  await page.getByRole("button", { name: "Change schedule" }).click();
  await page.getByRole("dialog", { name: "Change schedule" }).getByText("Every weekday").click();
  const confirm = page.getByRole("alertdialog", { name: "Change schedule?" });
  await expect(confirm.getByText("Keeps 7 past days as they were")).toBeVisible();
  await confirm.getByText("All days").click();
  await confirm.getByRole("button", { name: "Change schedule" }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByRole("button", { name: "Change schedule" })).toContainText(
    "Every weekday",
  );

  // ⋯: pause, then resume.
  const menu = page.getByRole("button", { name: "More actions" });
  await menu.click();
  await page.getByRole("menuitem", { name: "Pause routine" }).click();
  // The title row's pause icon (the sidebar's ring shows one too).
  const paused = page
    .getByRole("heading", { level: 1 })
    .locator("..")
    .getByRole("img", { name: "Paused" });
  await expect(paused).toBeVisible();
  await menu.click();
  await page.getByRole("menuitem", { name: "Resume routine" }).click();
  await expect(paused).toBeHidden();

  // Archive, with Undo in its toast.
  await menu.click();
  await page.getByRole("menuitem", { name: "Archive routine" }).click();
  // Read-only: Restore takes Add step's place.
  await expect(page.getByRole("button", { name: "Restore" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Add step" })).toHaveCount(0);
  await page
    .getByRole("status")
    .filter({ hasText: `Archived “${renamed}”` })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(page.getByRole("button", { name: "Add step" })).toBeVisible();

  // Delete asks first, then leaves the page.
  await menu.click();
  await page.getByRole("menuitem", { name: "Delete routine" }).click();
  await page
    .getByRole("alertdialog", { name: `Delete “${renamed}”?` })
    .getByRole("button", { name: "Delete routine" })
    .click();
  await expect(page).toHaveURL(/\/areas$/);
  await expect(
    page.getByRole("navigation", { name: "Routines" }).getByRole("link", { name: renamed }),
  ).toBeHidden();
});

test("a routine with no steps says so, and its first step is added", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"), "teal");
  const routine = await createRoutine(request, { title: unique("Workout") });

  await page.goto(`/areas/routines/${routine.id}`);

  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  const steps = page.getByRole("region", { name: "Steps" });
  await expect(steps.getByText("No steps yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Previous period" })).toBeDisabled();

  // With no step to copy, New step asks for an owner before it can add.
  await steps.getByRole("button", { name: "Add step" }).click();
  const modal = page.getByRole("dialog", { name: "New step" });
  const title = unique("Warm up");
  await modal.getByRole("textbox", { name: "Title" }).fill(title);
  const add = modal.getByRole("button", { name: "Add step" });
  await expect(add).toBeDisabled();
  await modal.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("dialog", { name: "Owner" }).getByText(area.title).click();
  await add.click();

  await expect(modal).toBeHidden();
  await expect(steps.getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Day" }).getByText("0/1")).toBeVisible();
});

test("steps are added, renamed, moved, paused, archived and deleted in place", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const health = await createArea(request, unique("Health"), "rose");
  const home = await createArea(request, unique("Home"), "ochre");
  const routine = await createRoutine(request, { title: unique("Evening"), starts_on: today });
  const read = await createRoutineStep(request, routine, {
    title: unique("Read"),
    life_area_id: health.id,
    starts_on: today,
  });
  const metric = await createStepMetric(request, health, read, unique("Reading days"));

  await page.goto(`/areas/routines/${routine.id}`);
  const steps = page.getByRole("region", { name: "Steps" });

  // Add step: the owner starts as the last step's.
  await page.getByRole("button", { name: "Add step" }).click();
  const modal = page.getByRole("dialog", { name: "New step" });
  await expect(modal.getByRole("button", { name: "Owner" })).toContainText(health.title);
  await expect(modal.getByRole("button", { name: "Starts" })).toContainText("Starts today");
  const floss = unique("Floss");
  await modal.getByRole("textbox", { name: "Title" }).fill(floss);
  await modal.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(modal).toBeHidden();
  await expect(steps.getByRole("button", { name: floss, exact: true })).toBeVisible();

  // Rename in place: Esc puts it back, Enter saves.
  await steps.getByRole("button", { name: floss, exact: true }).click();
  const name = steps.getByRole("textbox", { name: "Step name" });
  await name.fill("Nope");
  await name.press("Escape");
  await expect(steps.getByRole("button", { name: floss, exact: true })).toBeVisible();
  const flossed = unique("Floss teeth");
  await steps.getByRole("button", { name: floss, exact: true }).click();
  await name.fill(flossed);
  await name.press("Enter");
  await expect(steps.getByRole("button", { name: flossed, exact: true })).toBeVisible();

  // While editing, the owner chip moves it, with Undo in the toast.
  await steps.getByRole("button", { name: flossed, exact: true }).click();
  await steps.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("dialog", { name: "Owner" }).getByText(home.title).click();
  const moved = page.getByRole("status").filter({ hasText: `Moved “${flossed}” · ${home.title}` });
  await expect(moved).toBeVisible();
  await expect(steps.getByRole("button", { name: "Owner" })).toContainText(home.title);
  await name.press("Enter");
  await expect(name).toBeHidden();

  // ⋯: pause, then resume.
  const actions = steps.getByRole("button", { name: `Actions for ${flossed}` });
  await actions.click();
  await page.getByRole("menuitem", { name: "Pause step" }).click();
  await actions.click();
  await page.getByRole("menuitem", { name: "Resume step" }).click();
  await actions.click();
  await expect(page.getByRole("menuitem", { name: "Pause step" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();

  // Archive leaves the page; Undo brings it back.
  await actions.click();
  await page.getByRole("menuitem", { name: "Archive step" }).click();
  await expect(steps.getByRole("button", { name: flossed, exact: true })).toBeHidden();
  await page
    .getByRole("status")
    .filter({ hasText: `Archived “${flossed}”` })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(steps.getByRole("button", { name: flossed, exact: true })).toBeVisible();

  // A step that feeds a metric can't be deleted; another one can, after asking.
  await steps.getByRole("button", { name: `Actions for ${read.title}` }).click();
  await expect(page.getByRole("menuitem", { name: /Delete step/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await expect(page.getByRole("menuitem", { name: /Delete step/ })).toContainText(
    `Feeds ${metric.title}. Archive it instead.`,
  );
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toBeHidden();
  await actions.click();
  await page.getByRole("menuitem", { name: "Delete step" }).click();
  await page
    .getByRole("alertdialog", { name: `Delete “${flossed}”?` })
    .getByRole("button", { name: "Delete step" })
    .click();
  await expect(steps.getByRole("button", { name: flossed, exact: true })).toBeHidden();
  await expect(steps.getByRole("button", { name: read.title, exact: true })).toBeVisible();
});

test("the Notes card saves as you type", async ({ page, request }) => {
  const routine = await createRoutine(request, { title: unique("Morning") });
  await page.goto(`/areas/routines/${routine.id}`);

  const notes = page.getByRole("region", { name: "Notes" });
  await notes.getByRole("textbox", { name: "Notes" }).click();
  await page.keyboard.type("Phone on the charger first");
  await expect(notes.getByRole("status")).toHaveText("Saved");

  await page.reload();
  await expect(notes.getByText("Phone on the charger first")).toBeVisible();
});

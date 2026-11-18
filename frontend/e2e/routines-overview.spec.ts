import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { addDays, checkStep, createArea, createRoutine, serverToday, unique } from "./api.ts";

// The Routines overview at /areas/routines, against a real API. Other specs share the
// database, so each test only looks at its own routines.

type Created = { id: number; title: string; steps: { id: number; title: string }[] };

async function routineWithHistory(request: Parameters<typeof createArea>[0]) {
  const area = await createArea(request, unique("Health"), "rose");
  const today = await serverToday(request);
  const routine = (await createRoutine(request, {
    title: unique("Morning"),
    starts_on: addDays(today, -3),
    steps: [
      { title: unique("Water"), life_area_id: area.id },
      { title: unique("Stretch"), life_area_id: area.id },
    ],
  })) as Created;
  const [water, stretch] = routine.steps;
  // Water done every day so far; Stretch missed on the three days before today.
  for (const offset of [-3, -2, -1, 0]) await checkStep(request, water, addDays(today, offset));
  return { area, routine, water, stretch };
}

test("the overview shows every routine's days and what to pick up", async ({ page, request }) => {
  const { routine, stretch } = await routineWithHistory(request);

  await page.goto("/areas");
  await page.getByRole("link", { name: "Routines", exact: true }).click();
  await expect(page).toHaveURL(/\/areas\/routines$/);
  await expect(page.getByRole("heading", { level: 1, name: "Routines" })).toBeVisible();

  for (const tile of ["Completion rate", "Steps done", "Full days", "Missed", "Longest run"]) {
    await expect(page.getByRole("article", { name: tile })).toBeVisible();
  }
  const heatmap = page.getByRole("region", { name: "Routines", exact: true });
  await expect(heatmap.getByRole("link", { name: routine.title })).toBeVisible();
  await expect(heatmap.getByText("Every day · 2 steps").first()).toBeVisible();
  await expect(page.getByRole("list", { name: "Key" })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Completion by routine" }).getByRole("link", {
      name: routine.title,
    }),
  ).toBeVisible();

  // Pick up: Stretch is still to do today, and it was missed three times.
  const pickUp = page.getByRole("region", { name: "Pick up" });
  await expect(
    pickUp.getByRole("region", { name: "Open today" }).getByRole("link", { name: routine.title }),
  ).toContainText("1 of 2 steps left");
  const missed = pickUp.getByRole("region", { name: "Most missed" });
  await expect(missed).toBeVisible();
  // It lists the top three across every routine in the shared database.
  if (await missed.getByText(stretch.title).count()) {
    await expect(missed.getByRole("link", { name: stretch.title })).toContainText("3 missed");
  }

  await heatmap.getByRole("link", { name: routine.title }).click();
  await expect(page).toHaveURL(new RegExp(`/areas/routines/${routine.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
});

test("the card menu hides paused routines and sorts by name", async ({ page, request }) => {
  const { routine } = await routineWithHistory(request);
  const paused = (await createRoutine(request, {
    title: unique("Abs"),
    steps: [],
  })) as Created;
  const pause = await request.post(`/api/routines/${paused.id}/pause`);
  expect(pause.ok()).toBe(true);

  await page.goto("/areas/routines");
  const heatmap = page.getByRole("region", { name: "Routines", exact: true });
  await expect(heatmap.getByRole("link", { name: paused.title })).toBeVisible();

  await heatmap.getByRole("button", { name: "Sort and filter Routines" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Paused routines" }).click();
  await expect(heatmap.getByRole("link", { name: paused.title })).toHaveCount(0);
  await expect(heatmap.getByRole("link", { name: routine.title })).toBeVisible();

  await page.getByRole("menuitemcheckbox", { name: "Name" }).click();
  const names = await heatmap.getByRole("link").allTextContents();
  expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
});

test("the ⋯ menu exports the period as CSV and opens archived routines", async ({
  page,
  request,
}) => {
  const { routine, water } = await routineWithHistory(request);
  const archived = (await createRoutine(request, { title: unique("Old"), steps: [] })) as Created;
  const archive = await request.post(`/api/routines/${archived.id}/archive`);
  expect(archive.ok()).toBe(true);

  await page.goto("/areas/routines");
  await page.getByRole("button", { name: "More actions" }).click();
  const download = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export as CSV" }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^routines-quarter-\d{4}-\d{2}-01\.csv$/);
  const csv = await readFile((await file.path()) as string, "utf8");
  expect(csv.split("\n")[0]).toBe("Date,Routine,Step,Life area,Status");
  expect(csv).toContain(`${routine.title},${water.title}`);

  await page.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Archived routines" }).click();
  await expect(page).toHaveURL(/\/areas\/archived/);
  await expect(
    page.getByRole("region", { name: "Archived routines" }).getByRole("link", {
      name: archived.title,
    }),
  ).toBeVisible();
});

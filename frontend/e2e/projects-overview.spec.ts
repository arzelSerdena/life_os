import { expect, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createProject,
  type Project,
  postTask,
  serverToday,
  unique,
} from "./api.ts";

// The Projects overview at /areas/projects, against a real API. Other specs share the
// database, so each test only looks at its own projects.

test("the overview shows the stats, timeline, Next up and the board", async ({ page, request }) => {
  const area = await createArea(request, unique("Career"), "teal");
  const today = await serverToday(request);
  const response = await request.post("/api/projects", {
    data: {
      life_area_id: area.id,
      title: unique("Hackathon"),
      start_date: today,
      due_date: addDays(today, 5),
    },
  });
  expect(response.ok()).toBe(true);
  const due = (await response.json()) as Project;
  await postTask(request, { project_id: due.id, title: unique("Pitch"), scheduled_date: today });
  await postTask(request, {
    project_id: due.id,
    title: unique("Slides"),
    due_date: addDays(today, -1),
  });
  const empty = await createProject(request, area, unique("Portfolio"));

  await page.goto("/areas");
  await page.getByRole("link", { name: "Projects", exact: true }).click();
  await expect(page).toHaveURL(/\/areas\/projects$/);
  await expect(page.getByRole("heading", { level: 1, name: "Projects" })).toBeVisible();

  for (const tile of [
    "Tasks done",
    "On time",
    "Overdue now",
    "Rollovers",
    "Open tasks",
    "Projects finished",
  ]) {
    await expect(page.getByRole("article", { name: tile })).toBeVisible();
  }
  // A five-day bar in a quarter is too narrow for its name, so find it by its tooltip.
  await expect(
    page.getByRole("region", { name: "Timeline" }).locator(`[title^="${due.title}:"]`),
  ).toBeVisible();

  const nextUp = page.getByRole("region", { name: "Next up" });
  await expect(
    nextUp.getByRole("region", { name: "Due next" }).getByRole("listitem").filter({
      hasText: due.title,
    }),
  ).toContainText(/5d.*2 open · 1 overdue/);
  const noNextStep = nextUp
    .getByRole("region", { name: "No next step" })
    .getByRole("listitem")
    .filter({ hasText: empty.title });
  await expect(noNextStep).toContainText("No tasks yet");
  await noNextStep.getByRole("button", { name: "Add task" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText(empty.title);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);

  // The board, grouped by pace: the project without a due date sits in No due date.
  const board = page.getByRole("region", { name: "Projects", exact: true });
  await expect(board.getByRole("region", { name: area.title })).toContainText(due.title);
  await board.getByRole("button", { name: "Sort and filter Projects" }).click();
  await page.getByRole("menuitemcheckbox", { name: "Pace" }).click();
  await page.keyboard.press("Escape");
  await expect(board.getByRole("region", { name: "No due date" })).toContainText(empty.title);

  await board.getByRole("link", { name: new RegExp(due.title) }).click();
  await expect(page).toHaveURL(new RegExp(`/areas/projects/${due.id}$`));
  await expect(page.getByRole("heading", { level: 1, name: due.title })).toBeVisible();

  // Put the menu back for other tests sharing this browser storage.
  await page.evaluate(() => localStorage.removeItem("life-os-projects-overview"));
});

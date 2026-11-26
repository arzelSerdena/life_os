import { expect, type Page, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createRoutine,
  createRoutineStep,
  postTask,
  serverToday,
  unique,
} from "./api.ts";

// Home at /home, against a real API. Other specs share the database, so each test only
// looks at its own items (the first-run message is covered by a unit test).

const todayCard = (page: Page) => page.getByRole("region", { name: "Today", exact: true });
const toast = (page: Page) => page.getByRole("status").filter({ hasText: "Undo" });

test("the rail opens Home on today's date", async ({ page, request }) => {
  await createArea(request, unique("Career"));
  await postTask(request, { title: unique("Anything") });

  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");
  for (const card of ["Today", "Routines today", "Needs a push", "Coming up"]) {
    await expect(page.getByRole("region", { name: card, exact: true })).toBeVisible();
  }
});

test("quick add puts a task in Today; checking it moves it to Completed, with Undo", async ({
  page,
  request,
}) => {
  await createArea(request, unique("Career"));
  const title = unique("Call the landlord");
  await page.goto("/home");

  await todayCard(page).getByRole("button", { name: "New task for today" }).click();
  const dialog = page.getByRole("dialog", { name: "New task" });
  await dialog.getByRole("textbox", { name: "Title" }).fill(title);
  await dialog.getByRole("button", { name: "Create task" }).click();
  await expect(dialog).toBeHidden();
  const tasks = todayCard(page).getByRole("region", { name: "Tasks" });
  await expect(tasks.getByRole("listitem").filter({ hasText: title })).toBeVisible();

  await tasks.getByRole("checkbox", { name: `Mark ${title} done` }).click();
  await expect(toast(page)).toContainText(`Completed “${title}”`);
  await expect(tasks.getByRole("listitem").filter({ hasText: title })).toHaveCount(0);
  const completed = todayCard(page).getByRole("region", { name: "Completed" });
  await completed.getByRole("button", { name: /Completed/ }).click();
  await expect(completed.getByRole("listitem").filter({ hasText: title })).toBeVisible();

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(tasks.getByRole("listitem").filter({ hasText: title })).toBeVisible();
});

test("Tomorrow moves a task off Today, with Undo", async ({ page, request }) => {
  const area = await createArea(request, unique("Career"));
  const today = await serverToday(request);
  const title = unique("Draft the pitch");
  await postTask(request, { life_area_id: area.id, title, scheduled_date: today });
  await page.goto("/home");

  const row = todayCard(page).getByRole("listitem").filter({ hasText: title });
  await row.hover();
  await row.getByRole("button", { name: "Tomorrow" }).click();
  await expect(toast(page)).toContainText(`Moved “${title}” · Tomorrow`);
  await expect(row).toHaveCount(0);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(row).toBeVisible();
});

test("checking a routine step today updates its routine's count", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"));
  const today = await serverToday(request);
  const routine = await createRoutine(request, {
    title: unique("Evening"),
    starts_on: addDays(today, -3),
  });
  const read = await createRoutineStep(request, routine, {
    title: unique("Read"),
    life_area_id: area.id,
    starts_on: addDays(today, -3),
  });
  await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: addDays(today, -3),
  });
  await page.goto("/home");

  const block = page
    .getByRole("region", { name: "Routines today" })
    .getByRole("region", { name: routine.title });
  await expect(block).toContainText("0/2");
  await block.getByRole("checkbox", { name: `Mark ${read.title} done` }).click();
  await expect(block).toContainText("1/2");
});

test("Log today logs a value with Enter, with Undo", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"));
  const created = await request.post("/api/metrics", {
    data: { title: unique("Water"), unit: "glasses", aggregation: "sum", life_area_id: area.id },
  });
  const metric = (await created.json()) as { id: number; title: string };
  const target = await request.post(`/api/metrics/${metric.id}/targets`, {
    data: { kind: "per_period", period: "day", target_value: 8 },
  });
  expect(target.ok()).toBe(true);
  await page.goto("/home");

  const card = page.getByRole("region", { name: "Log today" });
  const input = card.getByRole("textbox", { name: `${metric.title} today` });
  await input.fill("8");
  await input.press("Enter");
  await expect(toast(page)).toContainText(`Logged 8 glasses · ${metric.title}`);
  await expect(card.getByText(metric.title)).toHaveCount(0);

  await toast(page).getByRole("button", { name: "Undo" }).click();
  await expect(
    page.getByRole("region", { name: "Log today" }).getByText(metric.title),
  ).toBeVisible();
});

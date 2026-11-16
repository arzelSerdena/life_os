import { expect, type Locator, type Page, test } from "@playwright/test";
import { addDays, createArea, getTask, postTask, serverToday, unique } from "./api.ts";

// Tasks › Next 7 days against a real API: dragging a task to another day (with Undo) and
// reordering a day.

/** Drags with small steps, so dnd-kit's pointer sensor sees a drag, not a click. */
async function dragTo(page: Page, source: Locator, target: Locator, offsetY = 0.5) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Nothing to drag");
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height * offsetY, { steps: 15 });
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + to.height * offsetY, { steps: 2 });
  await page.mouse.up();
}

const card = (column: Locator, title: string) =>
  column.getByRole("listitem").filter({ has: column.page().getByRole("button", { name: title }) });

test("dragging a task to Tomorrow schedules it there, and Undo puts it back", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Career"));
  const task = await postTask(request, {
    life_area_id: area.id,
    title: unique("Update LinkedIn"),
    scheduled_date: today,
  });

  await page.goto("/tasks/next-7-days");
  const todayColumn = page.getByRole("region", { name: "Today" });
  const tomorrowColumn = page.getByRole("region", { name: "Tomorrow" });
  await expect(card(todayColumn, task.title)).toBeVisible();

  await dragTo(
    page,
    card(todayColumn, task.title),
    page.locator(`[data-drop-target="${addDays(today, 1)}"]`),
  );

  await expect(page.getByText(`Scheduled “${task.title}” · Tomorrow`)).toBeVisible();
  await expect(card(tomorrowColumn, task.title)).toBeVisible();
  await expect(card(todayColumn, task.title)).toHaveCount(0);
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ scheduled_date: addDays(today, 1) });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(todayColumn, task.title)).toBeVisible();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ scheduled_date: today });
});

test("dragging a task onto another in the same day reorders the day", async ({ page, request }) => {
  const today = await serverToday(request);
  const day = addDays(today, 1);
  const area = await createArea(request, unique("Home"), "terracotta");
  const first = await postTask(request, {
    life_area_id: area.id,
    title: unique("Water the plants"),
    scheduled_date: day,
  });
  const second = await postTask(request, {
    life_area_id: area.id,
    title: unique("Clean the oven"),
    scheduled_date: day,
  });

  await page.goto("/tasks/next-7-days");
  const column = page.getByRole("region", { name: "Tomorrow" });
  const titles = () =>
    column
      .getByRole("listitem")
      .getByRole("button", { name: /Water the plants|Clean the oven/ })
      .allTextContents();
  await expect.poll(titles).toEqual([first.title, second.title]);

  await dragTo(page, card(column, second.title), card(column, first.title), 0.2);

  await expect.poll(titles).toEqual([second.title, first.title]);
  await page.reload();
  await expect.poll(titles).toEqual([second.title, first.title]);
});

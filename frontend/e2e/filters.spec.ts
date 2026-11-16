import { expect, test } from "@playwright/test";
import { createArea, postTask, serverToday, unique } from "./api.ts";

// Real-browser checks of the Tasks group's filter-and-sort menu: filters, the accent dot,
// subgroups, Clear filters and the SHOW toggles.

test("the menu hides a priority, changes the subgroup, and Clear filters brings it back", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const high = await postTask(request, {
    life_area_id: area.id,
    title: unique("Send the pitch"),
    priority: "high",
  });
  const low = await postTask(request, {
    life_area_id: area.id,
    title: unique("Tidy the desk"),
    priority: "low",
  });

  await page.goto("/tasks/all");
  await page.getByRole("radio", { name: "Area" }).click();
  const column = page.getByRole("region", { name: area.title });
  await expect(column.getByRole("button", { name: low.title })).toBeVisible();

  await page.getByRole("button", { name: "Filter and sort", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Filter and sort" });
  await menu.getByRole("checkbox", { name: "Low" }).click();
  await expect(column.getByRole("button", { name: low.title })).toHaveCount(0);
  await expect(column.getByRole("button", { name: high.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter and sort (filters on)" })).toBeVisible();

  await menu.getByRole("button", { name: "Subgroup: Project" }).click();
  await page.getByRole("menuitemradio", { name: "Priority" }).click();
  await expect(column.getByRole("button", { name: /^High 1/ })).toBeVisible();

  await menu.getByRole("button", { name: "Clear filters" }).click();
  await expect(column.getByRole("button", { name: low.title })).toBeVisible();
  await expect(page.getByRole("button", { name: "Filter and sort", exact: true })).toBeVisible();
});

test("Next 7 days lists done tasks until Show Completed is turned off", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"), "rose");
  const task = await postTask(request, {
    life_area_id: area.id,
    title: unique("Book the dentist"),
    scheduled_date: today,
  });

  await page.goto("/tasks/next-7-days");
  const day = page.getByRole("region", { name: "Today" });
  await day.getByRole("checkbox", { name: `Mark ${task.title} done` }).click();
  await expect(day.getByRole("checkbox", { name: `Mark ${task.title} not done` })).toBeVisible();

  await page.getByRole("button", { name: "Filter and sort", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Filter and sort" })
    .getByRole("checkbox", { name: "Completed" })
    .click();
  await expect(day.getByRole("button", { name: task.title })).toHaveCount(0);
});

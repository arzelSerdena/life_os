import { expect, test } from "@playwright/test";
import { addDays, createArea, createProject, postTask, serverToday, unique } from "./api.ts";

// Real-browser checks of the Tasks boards against a real API and database: loading the
// week first (rollover), the placement rule, and completing with Undo.

test("Today lists overdue tasks first, and a completed task comes back with Undo", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Career"));
  const late = await postTask(request, {
    life_area_id: area.id,
    title: unique("Update resume"),
    priority: "high",
    due_date: addDays(today, -2),
  });
  const now = await postTask(request, {
    life_area_id: area.id,
    title: unique("Reply to the recruiter"),
    priority: "high",
    scheduled_date: today,
  });
  const later = await postTask(request, {
    life_area_id: area.id,
    title: unique("Draft the pitch"),
    priority: "high",
    scheduled_date: addDays(today, 1),
  });

  await page.goto("/tasks/today");
  const high = page.getByRole("region", { name: "High" });
  await expect(high.getByRole("button", { name: /^Overdue/ })).toBeVisible();
  await expect(high.getByRole("button", { name: late.title })).toBeVisible();
  await expect(high.getByRole("button", { name: now.title })).toBeVisible();
  await expect(page.getByRole("button", { name: later.title })).toHaveCount(0);

  await high.getByRole("checkbox", { name: `Mark ${now.title} done` }).click();
  await expect(high.getByRole("button", { name: now.title })).toHaveCount(0);
  await expect(page.getByText(`Completed “${now.title}”`)).toBeVisible();
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(high.getByRole("button", { name: now.title })).toBeVisible();
});

test("All by area splits a column by project, and subgroups collapse", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Finance"), "teal");
  const project = await createProject(request, area, unique("Emergency fund"));
  const inProject = await postTask(request, {
    project_id: project.id,
    title: unique("Transfer to savings"),
  });
  const loose = await postTask(request, {
    life_area_id: area.id,
    title: unique("Review budget categories"),
  });

  await page.goto("/tasks/all");
  await page.getByRole("radio", { name: "Area" }).click();
  const column = page.getByRole("region", { name: area.title });
  const subgroup = column.getByRole("button", { name: `${project.title} 1`, exact: true });
  await expect(subgroup).toHaveAttribute("aria-expanded", "true");
  // The project's card leads its subgroup, then its task.
  await expect(column.getByRole("button", { name: project.title, exact: true })).toBeVisible();
  await expect(column.getByRole("button", { name: inProject.title })).toBeVisible();
  await expect(column.getByRole("button", { name: /^No project/ })).toBeVisible();
  await expect(column.getByRole("button", { name: loose.title })).toBeVisible();

  await subgroup.click();
  await expect(subgroup).toHaveAttribute("aria-expanded", "false");
  await expect(column.getByRole("button", { name: inProject.title })).toHaveCount(0);
  await subgroup.click();
  await expect(column.getByRole("button", { name: inProject.title })).toBeVisible();
});

test("Unscheduled lists undated tasks with an area, and Completed lists done ones", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Home"), "ochre");
  const undated = await postTask(request, {
    life_area_id: area.id,
    title: unique("Fix the faucet"),
  });
  const dated = await postTask(request, {
    life_area_id: area.id,
    title: unique("Clean the oven"),
    due_date: addDays(today, 3),
  });
  const inbox = await postTask(request, { title: unique("Call the bank") });

  await page.goto("/tasks/unscheduled");
  await expect(page.getByRole("button", { name: undated.title })).toBeVisible();
  await expect(page.getByRole("button", { name: dated.title })).toHaveCount(0);
  await expect(page.getByRole("button", { name: inbox.title })).toHaveCount(0);

  await page.getByRole("checkbox", { name: `Mark ${undated.title} done` }).click();
  await expect(page.getByRole("button", { name: undated.title })).toHaveCount(0);

  await page
    .getByRole("navigation", { name: "Finished tasks" })
    .getByRole("link", { name: "Completed" })
    .click();
  const column = page.getByRole("region", { name: area.title });
  await expect(column.getByRole("button", { name: undated.title })).toBeVisible();
  await expect(column.getByText(/^Done /)).toBeVisible();
});

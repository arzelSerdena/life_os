import { expect, type Page, test } from "@playwright/test";
import {
  createArea,
  createProject,
  createRoutine,
  createStepMetric,
  createTask,
  type Routine,
  type RoutineStep,
  unique,
} from "./api.ts";

// Finished & archived at /areas/archived, against a real API. Other specs share the
// database, so each test only looks at its own rows.

/** A row: its name is a button, and the row around it holds the actions. */
function row(page: Page, title: string) {
  return page.getByRole("button", { name: title, exact: true }).locator("..");
}

test("restoring an area brings back its project, with Undo", async ({ page, request }) => {
  const area = await createArea(request, unique("Language"), "ochre");
  const project = await createProject(request, area, unique("N4 exam"));
  await createTask(request, project, unique("Kanji"));
  expect((await request.post(`/api/life-areas/${area.id}/archive`)).ok()).toBe(true);

  await page.goto("/areas");
  await page.getByRole("link", { name: "Finished & archived" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Finished & archived" })).toBeVisible();
  const areaRow = row(page, area.title);
  await expect(areaRow).toContainText("1 project · 1 task");

  // Its project waits in ARCHIVED, and can't be restored before the area.
  await page.getByRole("radio", { name: /Projects/ }).click();
  await expect(page).toHaveURL(/tab=projects/);
  const archived = page.getByRole("region", { name: "Archived" });
  const projectRow = row(page, project.title);
  await expect(archived.getByRole("button", { name: project.title })).toBeVisible();
  await projectRow.hover();
  await expect(
    projectRow.getByRole("button", { name: `Restore “${project.title}”` }),
  ).toBeDisabled();

  await page.getByRole("radio", { name: /Areas/ }).click();
  await areaRow.hover();
  await areaRow.getByRole("button", { name: `Restore “${area.title}”` }).click();
  await expect(page.getByText(`Restored “${area.title}” · 1 project, 1 task back`)).toBeVisible();
  await expect(page.getByRole("button", { name: area.title, exact: true })).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Life areas" }).getByRole("link", { name: area.title }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("button", { name: area.title, exact: true })).toBeVisible();
});

test("an archived area opens a read-only panel that can restore it", async ({ page, request }) => {
  const area = await createArea(request, unique("Side projects"), "rose");
  expect((await request.post(`/api/life-areas/${area.id}/archive`)).ok()).toBe(true);

  await page.goto("/areas/archived");
  await expect(row(page, area.title)).toContainText("Empty");
  await page.getByRole("button", { name: area.title, exact: true }).click();

  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveAttribute("readonly", "");
  await expect(panel.getByText(/^Archived /)).toBeVisible();
  await expect(panel.getByRole("button", { name: "Color" })).toHaveCount(0);

  await panel.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Restore area" }).click();
  await expect(page.getByText(`Restored “${area.title}”`)).toBeVisible();
  await expect(panel).toHaveCount(0);
  await expect(page.getByRole("button", { name: area.title, exact: true })).toHaveCount(0);
});

test("finished projects reopen, archive, filter by area and delete", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"), "teal");
  const other = await createArea(request, unique("Home"), "blue");
  const done = await createProject(request, area, unique("Couch to 5K"));
  const kept = await createProject(request, area, unique("Q3 budget"));
  const empty = await createProject(request, other, unique("Kitchen repaint"));
  await createTask(request, done, unique("Week 1"));
  await createTask(request, kept, unique("Review"));
  for (const project of [done, kept]) {
    expect((await request.post(`/api/projects/${project.id}/complete`)).ok()).toBe(true);
  }
  expect((await request.post(`/api/projects/${empty.id}/cancel`)).ok()).toBe(true);

  await page.goto("/areas/archived?tab=projects");
  const doneGroup = page.getByRole("region", { name: "Done" });
  await expect(doneGroup.getByRole("button", { name: done.title })).toBeVisible();
  await expect(row(page, done.title)).toContainText(`${area.title} ·`);
  await expect(row(page, done.title)).toContainText("0/1 tasks");
  await expect(
    page.getByRole("region", { name: "Cancelled" }).getByRole("button", { name: empty.title }),
  ).toBeVisible();

  // Reopen applies at once with the undo toast.
  const doneRow = row(page, done.title);
  await doneRow.hover();
  await doneRow.getByRole("button", { name: `Reopen “${done.title}”` }).click();
  await expect(page.getByText(`Reopened “${done.title}”`)).toBeVisible();
  await expect(page.getByRole("button", { name: done.title, exact: true })).toHaveCount(0);

  // Archive moves a done project into ARCHIVED.
  await row(page, kept.title).hover();
  await page.getByRole("button", { name: `More actions for “${kept.title}”` }).click();
  await page.getByRole("menuitem", { name: "Archive project" }).click();
  await expect(
    page.getByRole("region", { name: "Archived" }).getByRole("button", { name: kept.title }),
  ).toBeVisible();

  // The filter hides an area's projects.
  await page.getByRole("button", { name: "Filter by area" }).click();
  await page.getByRole("checkbox", { name: other.title }).uncheck();
  await expect(page.getByRole("button", { name: empty.title, exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: empty.title, exact: true })).toBeVisible();

  // A project with items can't be deleted; an empty one asks first.
  await row(page, kept.title).hover();
  await page.getByRole("button", { name: `More actions for “${kept.title}”` }).click();
  await expect(page.getByRole("menuitem", { name: /Delete project/ })).toHaveAttribute(
    "aria-disabled",
    "true",
  );
  await page.keyboard.press("Escape");
  await row(page, empty.title).hover();
  await page.getByRole("button", { name: `More actions for “${empty.title}”` }).click();
  await page.getByRole("menuitem", { name: "Delete project" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete project" }).click();
  await expect(page.getByRole("button", { name: empty.title, exact: true })).toHaveCount(0);
});

test("an archived routine opens read-only and restores from its page", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"), "plum");
  const routine = (await createRoutine(request, {
    title: unique("Study sprint"),
    steps: [{ title: unique("Anki"), life_area_id: area.id }],
  })) as Routine & { steps: RoutineStep[] };
  const fed = (await createRoutine(request, {
    title: unique("Morning run"),
    steps: [{ title: unique("Run"), life_area_id: area.id }],
  })) as Routine & { steps: RoutineStep[] };
  await createStepMetric(request, area, fed.steps[0], unique("Weekly runs"));
  for (const item of [routine, fed]) {
    expect((await request.post(`/api/routines/${item.id}/archive`)).ok()).toBe(true);
  }

  await page.goto("/areas/archived?tab=routines");
  await expect(row(page, routine.title)).toContainText("Every day · 1 step · Archived");

  // A step feeds a metric, so the routine can't be deleted.
  await row(page, fed.title).hover();
  await page.getByRole("button", { name: `More actions for “${fed.title}”` }).click();
  await expect(page.getByRole("menuitem", { name: /Delete routine/ })).toContainText(
    "A step feeds",
  );
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: routine.title, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/areas/routines/${routine.id}$`));
  await expect(page.getByText(/^Archived [A-Z][a-z]{2} \d+$/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add step" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "More actions" })).toHaveCount(0);

  await page.getByRole("button", { name: "Restore" }).click();
  await expect(page.getByText(`Restored “${routine.title}” · 1 step back`)).toBeVisible();
  await expect(page.getByRole("button", { name: "Add step" })).toBeVisible();
});

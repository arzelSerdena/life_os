import { expect, test } from "@playwright/test";
import { createArea, createProject, createSection, getTask, postTask, unique } from "./api.ts";

// The detail panel's breadcrumb: the owner and section open the shared pickers, and each move
// is one undoable change.

test("the breadcrumb's owner and section pickers move a task, with Undo", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Resume"));
  const section = await createSection(request, project, "Portfolio");
  const task = await postTask(request, { title: unique("Tailor resume") });

  await page.goto("/tasks/inbox");
  await page
    .getByRole("region", { name: "Inbox tasks" })
    .getByRole("button", { name: task.title })
    // Left of the hover actions, which cover the card's top right.
    .click({ position: { x: 10, y: 8 } });
  const panel = page.getByRole("complementary", { name: "Details" });
  const crumbs = panel.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs).toHaveText("Inbox");

  await crumbs.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(project.title.slice(0, 10));
  await page
    .getByRole("dialog", { name: "Owner" })
    .getByRole("button", { name: project.title })
    .click();
  await expect(page.getByText(`Moved “${task.title}” · ${project.title}`)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ project_id: project.id, life_area_id: area.id, section_id: null });
  // The project has sections, so the section shows too.
  await expect(crumbs.getByRole("button", { name: "Section" })).toHaveText("No section");

  await crumbs.getByRole("button", { name: "Section" }).click();
  await page
    .getByRole("dialog", { name: "Section" })
    .getByRole("button", { name: "Portfolio" })
    .click();
  await expect(page.getByText(`Moved “${task.title}” · Portfolio`)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ section_id: section.id });
  await expect(crumbs.getByRole("button", { name: "Section" })).toHaveText("Portfolio");

  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ section_id: null });
});

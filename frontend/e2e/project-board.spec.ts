import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  createArea,
  createProject,
  createSection,
  getTask,
  type Project,
  postTask,
  unique,
} from "./api.ts";

// The project page's Board against a real API: switching to it, its Priority and Section
// columns, and dragging a card to another column or subgroup (with Undo).

/** Drags with small steps, so dnd-kit's pointer sensor sees a drag, not a click. */
async function dragTo(page: Page, source: Locator, target: Locator) {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Nothing to drag");
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + Math.min(to.height / 2, 20), { steps: 15 });
  await page.mouse.move(to.x + to.width / 2 + 1, to.y + Math.min(to.height / 2, 20), { steps: 2 });
  await page.mouse.up();
}

const card = (scope: Locator, title: string) =>
  scope.getByRole("listitem").filter({ has: scope.page().getByRole("button", { name: title }) });

async function openBoard(page: Page, project: Project) {
  await page.goto(`/areas/projects/${project.id}`);
  await expect(page.getByRole("heading", { name: project.title, level: 1 })).toBeVisible();
  await page.getByRole("radio", { name: "Board" }).click();
  await expect(page).toHaveURL(/view=board/);
}

test("the Board lists the project's tasks by priority; dragging sets the priority, and Undo puts it back", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Portfolio"));
  const task = await postTask(request, { project_id: project.id, title: unique("Pick a theme") });

  await openBoard(page, project);
  const none = page.getByRole("region", { name: "No priority" });
  const high = page.getByRole("region", { name: "High" });
  await expect(card(none, task.title)).toBeVisible();

  await dragTo(page, card(none, task.title), page.locator('[data-drop-target="high"]'));

  await expect(page.getByText(`Set “${task.title}” · High priority`)).toBeVisible();
  await expect(card(high, task.title)).toBeVisible();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ priority: "high" });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(card(none, task.title)).toBeVisible();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ priority: "none" });

  // The view is in the URL, so a reload keeps the Board.
  await page.reload();
  await expect(card(none, task.title)).toBeVisible();
});

test("dropping into a section subgroup sets the priority and the section, undone together", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Portfolio"));
  const research = await createSection(request, project, "Research");
  await postTask(request, {
    project_id: project.id,
    section_id: research.id,
    priority: "high",
    title: unique("Read case studies"),
  });
  const task = await postTask(request, { project_id: project.id, title: unique("Collect links") });

  await openBoard(page, project);
  await dragTo(
    page,
    card(page.getByRole("region", { name: "No priority" }), task.title),
    page.locator(`[data-drop-target="high/section-${research.id}"]`),
  );

  await expect(page.getByText(`Moved “${task.title}” · Research · High priority`)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ priority: "high", section_id: research.id });

  await page.getByRole("button", { name: "Undo" }).click();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ priority: "none", section_id: null });
});

test("grouped by Section, dragging to a section's column moves the task there", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Portfolio"));
  const writing = await createSection(request, project, "Writing");
  const task = await postTask(request, { project_id: project.id, title: unique("Outline") });

  await openBoard(page, project);
  await page.getByRole("radio", { name: "Section" }).click();
  const noSection = page.getByRole("region", { name: "No section" });
  await expect(card(noSection, task.title)).toBeVisible();

  await dragTo(
    page,
    card(noSection, task.title),
    page.locator(`[data-drop-target="section-${writing.id}"]`),
  );

  await expect(page.getByText(`Moved “${task.title}” · Writing`)).toBeVisible();
  await expect(card(page.getByRole("region", { name: "Writing" }), task.title)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({ section_id: writing.id });
});

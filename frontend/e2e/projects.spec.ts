import { expect, type Page, test } from "@playwright/test";
import {
  createArea,
  createProject,
  createTask,
  getProject,
  getTask,
  listProjects,
  type Project,
  unique,
} from "./api.ts";

// Real-browser checks of New project and the project status actions, against a real API
// and database: the jsdom tests in src/features/projects stub fetch.

async function openProject(page: Page, project: Project) {
  await page.goto("/areas");
  const sidebar = page.getByRole("navigation", { name: "Projects" });
  await sidebar.getByRole("button", { name: project.title }).click();
  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(project.title);
  return panel;
}

async function chooseAction(page: Page, action: string) {
  const panel = page.getByRole("complementary", { name: "Details" });
  await panel.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: action }).click();
}

test("New project creates the project and opens it", async ({ page, request }) => {
  const area = await createArea(request, unique("Career"));
  const title = unique("Portfolio site");
  await page.goto("/areas");

  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  const create = dialog.getByRole("button", { name: "Create project" });
  await expect(create).toBeDisabled();
  await dialog.getByRole("textbox", { name: "Name" }).fill(title);
  await expect(create).toBeDisabled();
  await dialog.getByText(area.title, { exact: true }).click();
  await expect(dialog.getByRole("radio", { name: area.title })).toBeChecked();
  await dialog.getByRole("textbox", { name: "Notes" }).fill("Two case studies");
  await create.click();

  await expect(dialog).toBeHidden();
  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(title);
  await expect(
    page.getByRole("navigation", { name: "Projects" }).getByRole("button", { name: title }),
  ).toBeVisible();

  const saved = (await listProjects(request)).find((project) => project.title === title);
  expect(saved).toMatchObject({ status: "active", archived_at: null, life_area_id: area.id });
});

test("New project won't save a due date before the start", async ({ page, request }) => {
  const area = await createArea(request, unique("Health"), "teal");
  const title = unique("5K training");
  await page.goto("/areas");

  await page.getByRole("button", { name: "New project" }).click();
  const dialog = page.getByRole("dialog", { name: "New project" });
  await dialog.getByRole("textbox", { name: "Name" }).fill(title);
  await dialog.getByText(area.title, { exact: true }).click();
  await dialog.getByLabel("Start").fill("2026-12-01");
  await dialog.getByLabel("Due").fill("2026-11-30");
  await dialog.getByRole("button", { name: "Create project" }).click();

  await expect(dialog.getByText("Due can't be before the start.")).toBeVisible();
  expect((await listProjects(request)).some((project) => project.title === title)).toBe(false);
});

test("completing a project cancels its open tasks, and Undo restores both", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Resume"));
  const task = await createTask(request, project, unique("Update resume"));
  await openProject(page, project);

  await chooseAction(page, "Complete project");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`Complete “${project.title}”?`);
  await expect(dialog.getByRole("region", { name: "Cancelled" })).toContainText(task.title);
  await expect(dialog).toContainText("You can undo this");
  await dialog.getByRole("button", { name: "Complete project" }).click();

  const toast = page
    .getByRole("status")
    .filter({ hasText: `Completed “${project.title}” · 1 task cancelled` });
  await expect(toast).toBeVisible();
  await expect.poll(async () => (await getProject(request, project.id)).status).toBe("done");
  expect((await getTask(request, task.id)).status).toBe("cancelled");

  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(toast).toBeHidden();
  await expect.poll(async () => (await getProject(request, project.id)).status).toBe("active");
  expect((await getTask(request, task.id)).status).toBe("todo");
});

test("cancelling a project confirms first, and Go back changes nothing", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Job hunt"));
  const task = await createTask(request, project, unique("Apply to Acme"));
  await openProject(page, project);

  await chooseAction(page, "Cancel project");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("region", { name: "Cancelled" })).toContainText(task.title);
  await dialog.getByRole("button", { name: "Go back" }).click();
  await expect(dialog).toBeHidden();
  expect((await getProject(request, project.id)).status).toBe("active");

  await chooseAction(page, "Cancel project");
  await dialog.getByRole("button", { name: "Cancel project" }).click();
  await expect(page.getByText(`Cancelled “${project.title}” · 1 task cancelled`)).toBeVisible();
  await expect.poll(async () => (await getProject(request, project.id)).status).toBe("cancelled");
  expect((await getTask(request, task.id)).status).toBe("cancelled");
});

test("a finished project can be reopened", async ({ page, request }) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Old portfolio"));
  await openProject(page, project);

  // An empty project has nothing to list, so Complete applies at once.
  await chooseAction(page, "Complete project");
  await expect(page.getByText(`Completed “${project.title}”`)).toBeVisible();
  await expect.poll(async () => (await getProject(request, project.id)).status).toBe("done");

  await chooseAction(page, "Reopen project");
  await expect.poll(async () => (await getProject(request, project.id)).status).toBe("active");
});

test("archiving a project with tasks confirms, then it can be restored", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Side project"));
  const task = await createTask(request, project, unique("Write the README"));
  const panel = await openProject(page, project);

  await chooseAction(page, "Archive project");
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("region", { name: "Archived" })).toContainText(task.title);
  await expect(dialog).toContainText("You can restore it from Finished & archived");
  await dialog.getByRole("button", { name: "Archive project" }).click();

  await expect(page.getByText(`Archived “${project.title}”`)).toBeVisible();
  await expect.poll(async () => (await getProject(request, project.id)).archived_at).not.toBeNull();
  await expect(panel.getByText("Archived", { exact: true })).toBeVisible();

  await chooseAction(page, "Restore project");
  await expect.poll(async () => (await getProject(request, project.id)).archived_at).toBeNull();
  expect((await getTask(request, task.id)).archived_at).toBeNull();
});

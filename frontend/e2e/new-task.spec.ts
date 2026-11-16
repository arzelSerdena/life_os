import { expect, type Page, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createProject,
  createSection,
  listTasks,
  listTemplates,
  serverToday,
  unique,
} from "./api.ts";

// Real-browser checks of New task: the column and subgroup + pre-fill their spot, the pickers
// set every field, and a repeat rule makes a recurring task.

const dialog = (page: Page) => page.getByRole("dialog", { name: "New task" });

/** Waits for a picker to close: a chip clicked while the last one closes loses its focus. */
const closed = (page: Page, picker: string) =>
  expect(page.getByRole("dialog", { name: picker })).toHaveCount(0);

test("a column + pre-fills its priority; the pickers set owner, section, dates and subtasks", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Resume"));
  const section = await createSection(request, project, "Portfolio");
  const title = unique("Tailor resume");

  await page.goto("/tasks/all");
  await page.getByRole("radio", { name: "Priority" }).click();
  await page.getByRole("button", { name: "New task in High" }).click();
  const modal = dialog(page);
  await expect(modal.getByRole("button", { name: "Priority" })).toHaveText("High");
  await expect(modal.getByRole("button", { name: "Create task" })).toBeDisabled();

  await modal.getByRole("textbox", { name: "Title" }).fill(title);
  await modal.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("textbox", { name: "Search" }).fill(project.title.slice(0, 8));
  await page.getByRole("button", { name: project.title }).click();
  await closed(page, "Owner");
  await expect(modal.getByRole("button", { name: "Owner" })).toHaveText(project.title);

  // Section shows once the project has sections.
  await modal.getByRole("button", { name: "Section" }).click();
  await page.getByRole("menuitemradio", { name: "Portfolio" }).click();
  await expect(page.getByRole("menu")).toHaveCount(0);

  await modal.getByRole("button", { name: "Scheduled" }).click();
  await page.getByRole("button", { name: /^Tomorrow · / }).click();
  await closed(page, "Scheduled");
  // A typed date shows its match as one row; Enter picks it.
  await modal.getByRole("button", { name: "Due" }).click();
  await page.getByRole("textbox", { name: "Date" }).fill("+3d");
  await page.getByRole("textbox", { name: "Date" }).press("Enter");
  await closed(page, "Due");

  await modal.getByRole("button", { name: "Add subtask" }).click();
  await modal.getByRole("textbox", { name: "Add subtask" }).fill("Match keywords");
  await modal.getByRole("textbox", { name: "Add subtask" }).press("Enter");
  await modal.getByRole("textbox", { name: "Add subtask" }).fill("Export as PDF");
  await modal.getByRole("textbox", { name: "Add subtask" }).press("Enter");
  await expect(modal.getByRole("list", { name: "Subtasks" })).toContainText("Export as PDF");

  await modal.getByRole("button", { name: "Create task" }).click();
  await expect(modal).toHaveCount(0);
  await expect(
    page.getByRole("region", { name: "High" }).getByRole("button", { name: title }),
  ).toBeVisible();

  const created = (await listTasks(request)).find((task) => task.title === title);
  expect(created).toMatchObject({
    priority: "high",
    life_area_id: area.id,
    project_id: project.id,
    section_id: section.id,
    scheduled_date: addDays(today, 1),
    due_date: addDays(today, 3),
  });
  expect(((created?.subtasks ?? []) as { title: string }[]).map((s) => s.title)).toEqual([
    "Match keywords",
    "Export as PDF",
  ]);

  // A subgroup's + shows on hover and fills in its project.
  await page.getByRole("radio", { name: "Area" }).click();
  const column = page.getByRole("region", { name: area.title });
  await column
    .getByRole("button", { name: new RegExp(`^${project.title}`) })
    .first()
    .hover();
  await column.getByRole("button", { name: `New task in ${project.title}` }).click();
  await expect(dialog(page).getByRole("button", { name: "Owner" })).toHaveText(project.title);
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);
});

test("a day's + on Next 7 days pre-fills the day; Escape cancels", async ({ page, request }) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"), "rose");
  const title = unique("Book a dentist cleaning");

  await page.goto("/tasks/next-7-days");
  await page.getByRole("button", { name: "New task in Tomorrow" }).click();
  await expect(dialog(page).getByRole("button", { name: "Scheduled" })).not.toHaveText("Scheduled");
  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveCount(0);

  await page.getByRole("button", { name: "New task", exact: true }).click();
  const modal = dialog(page);
  await modal.getByRole("textbox", { name: "Title" }).fill(title);
  await modal.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("button", { name: area.title }).click();
  await closed(page, "Owner");
  await modal.getByRole("button", { name: "Scheduled" }).click();
  await page.getByRole("button", { name: /^Today · / }).click();
  await closed(page, "Scheduled");
  // Enter in the title creates the task.
  await modal.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(modal).toHaveCount(0);

  const created = (await listTasks(request)).find((task) => task.title === title);
  expect(created).toMatchObject({ life_area_id: area.id, scheduled_date: today });
  await expect(
    page.getByRole("region", { name: "Today" }).getByRole("button", { name: title }),
  ).toBeVisible();
});

test("a custom repeat makes a recurring task whose end comes from After n times", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Home"), "terracotta");
  const title = unique("Water the plants");

  await page.goto("/tasks/inbox");
  await page.getByRole("button", { name: "New task", exact: true }).click();
  const modal = dialog(page);
  await modal.getByRole("textbox", { name: "Title" }).fill(title);
  await modal.getByRole("button", { name: "Owner" }).click();
  await page.getByRole("button", { name: area.title }).click();
  await closed(page, "Owner");

  await modal.getByRole("button", { name: "Repeat" }).click();
  await page.getByRole("button", { name: "Every day" }).click();
  await closed(page, "Repeat");
  await expect(modal.getByRole("button", { name: "Repeat" })).toHaveText("Every day");

  await modal.getByRole("button", { name: "Repeat" }).click();
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByRole("textbox", { name: "Every" }).fill("2");
  await page.getByRole("radio", { name: "After" }).click();
  await page.getByRole("textbox", { name: "Times" }).fill("3");
  await expect(page.getByText("Every 2 days · 3 times")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();
  await closed(page, "Repeat");
  await expect(modal.getByRole("button", { name: "Repeat" })).toHaveText("Every 2 days · 3 times");

  await modal.getByRole("button", { name: "Create task" }).click();
  await expect(modal).toHaveCount(0);

  const template = (await listTemplates(request)).find((t) => t.title === title);
  expect(template).toMatchObject({
    life_area_id: area.id,
    rrule: "FREQ=DAILY;INTERVAL=2",
    repeat_from: "schedule",
    starts_on: today,
    ends_on: addDays(today, 4),
  });
  // Its first occurrence is today's task.
  await page.goto("/tasks/today");
  await expect(page.getByRole("button", { name: title })).toBeVisible();
});

test("Ctrl N and N open New task on any screen, with the page's spot", async ({
  page,
  request,
}) => {
  const title = unique("Call the bank");

  // Plan has no New task button: Ctrl N opens a blank one, and the task lands in the Inbox.
  await page.goto("/areas");
  await page.keyboard.press("Control+n");
  const modal = dialog(page);
  await expect(modal.getByRole("button", { name: "Scheduled" })).toHaveText("Scheduled");
  // Typing N in the title doesn't reopen anything.
  await modal.getByRole("textbox", { name: "Title" }).fill(title);
  await modal.getByRole("textbox", { name: "Title" }).press("Enter");
  await expect(modal).toHaveCount(0);
  const created = (await listTasks(request)).find((task) => task.title === title);
  expect(created).toMatchObject({ life_area_id: null, project_id: null, scheduled_date: null });

  // On Today, N opens it scheduled today, as the header's New task does.
  await page.goto("/tasks/today");
  await expect(page.getByRole("button", { name: "New task", exact: true })).toBeVisible();
  await page.keyboard.press("n");
  await expect(modal.getByRole("button", { name: "Scheduled" })).not.toHaveText("Scheduled");
  await page.keyboard.press("Escape");
  await expect(modal).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
});

test("on a short window the pop-up's body scrolls and its footer stays on screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 240 });
  await page.goto("/areas");
  await page.keyboard.press("Control+n");
  const modal = dialog(page);

  await expect(modal.getByRole("button", { name: "Create task" })).toBeInViewport();
  await expect(modal.getByRole("button", { name: "Cancel" })).toBeInViewport();
});

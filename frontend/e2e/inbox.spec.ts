import { expect, type Locator, type Page, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createProject,
  getTask,
  postTask,
  serverToday,
  unique,
} from "./api.ts";

// The Inbox against a real API: filing a task with its hover actions, its keys and by
// dragging it onto the right container, each with Undo.

/** Drags with small steps, so dnd-kit's pointer sensor sees a drag, not a click. */
async function dragTo(page: Page, source: Locator, target: Locator) {
  // Other specs fill the Inbox too, so the card may sit below the fold of its list.
  await target.scrollIntoViewIfNeeded();
  await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("Nothing to drag");
  await page.mouse.move(from.x + 60, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 80, from.y + from.height / 2, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 15 });
  await page.mouse.up();
}

test("T schedules a focused card for today, and the Area menu files it out of the Inbox", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Home"), "terracotta");
  // The Inbox is what still needs sorting: no area, no scheduled date or no priority.
  const sorted = await postTask(request, {
    life_area_id: area.id,
    title: unique("Sorted"),
    scheduled_date: today,
    priority: "low",
  });
  const undated = await postTask(request, { life_area_id: area.id, title: unique("Undated") });
  const task = await postTask(request, { title: unique("Fix the leaky faucet"), priority: "high" });

  await page.goto("/tasks/inbox");
  const inbox = page.getByRole("region", { name: "Inbox tasks" });
  await expect(inbox.getByRole("button", { name: task.title })).toBeVisible();
  await expect(inbox.getByRole("button", { name: undated.title })).toBeVisible();
  await expect(inbox.getByRole("button", { name: sorted.title })).toHaveCount(0);

  await inbox.getByRole("button", { name: task.title }).focus();
  await page.keyboard.press("t");
  await expect(page.getByText(`Scheduled “${task.title}” · Today`)).toBeVisible();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ scheduled_date: today });
  await page.getByRole("button", { name: "Undo" }).click();
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ scheduled_date: null });

  // Scheduled again, it has a date and a priority: an area is all it lacks.
  await inbox.getByRole("button", { name: task.title }).focus();
  await page.keyboard.press("t");
  await expect.poll(async () => getTask(request, task.id)).toMatchObject({ scheduled_date: today });
  await expect(inbox.getByRole("button", { name: task.title, exact: true })).toBeVisible();

  await inbox.locator("li", { hasText: task.title }).hover({ position: { x: 20, y: 12 } });
  await inbox.getByRole("button", { name: `Move ${task.title} to an area` }).click();
  await page.getByRole("menuitem", { name: area.title }).click();
  await expect(page.getByText(`Moved “${task.title}” · ${area.title}`)).toBeVisible();
  await expect(inbox.getByRole("button", { name: task.title })).toHaveCount(0);
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(inbox.getByRole("button", { name: task.title })).toBeVisible();
});

test("D opens the shared date picker; a typed date schedules the card", async ({
  page,
  request,
}) => {
  const today = await serverToday(request);
  const task = await postTask(request, { title: unique("Book the dentist") });

  await page.goto("/tasks/inbox");
  const inbox = page.getByRole("region", { name: "Inbox tasks" });
  await inbox.getByRole("button", { name: task.title }).focus();
  await page.keyboard.press("d");
  const picker = page.getByRole("dialog", { name: "Schedule" });
  await expect(picker.getByRole("button", { name: /^Tomorrow · / })).toBeVisible();
  await picker.getByRole("textbox", { name: "Date" }).fill("+3d");
  await picker.getByRole("textbox", { name: "Date" }).press("Enter");
  await expect(picker).toHaveCount(0);
  await expect(page.getByText(`Scheduled “${task.title}” · `)).toBeVisible();
  await expect
    .poll(async () => getTask(request, task.id))
    .toMatchObject({
      scheduled_date: addDays(today, 3),
    });
});

test("Dragging a card onto a project or a priority files it", async ({ page, request }) => {
  const area = await createArea(request, unique("Career"));
  const project = await createProject(request, area, unique("Resume & portfolio"));
  const first = await postTask(request, { title: unique("Update the headline") });
  const second = await postTask(request, { title: unique("Call the bank") });

  await page.goto("/tasks/inbox");
  const inbox = page.getByRole("region", { name: "Inbox tasks" });
  const card = (title: string) => inbox.locator("li", { hasText: title });

  await dragTo(
    page,
    card(first.title),
    page.locator(`[data-drop-target="project ${project.title}"]`),
  );
  await expect(page.getByText(`Moved “${first.title}” · ${project.title}`)).toBeVisible();
  // It still has no scheduled date or priority, so it stays in the Inbox, now in its area.
  await expect(card(first.title)).toBeVisible();
  await expect
    .poll(async () => getTask(request, first.id))
    .toMatchObject({ project_id: project.id, life_area_id: area.id });

  await page
    .getByRole("radiogroup", { name: "File by" })
    .getByRole("radio", { name: "Priority" })
    .click();
  await dragTo(page, card(second.title), page.locator('[data-drop-target="priority High"]'));
  await expect(page.getByText(`Set “${second.title}” · High priority`)).toBeVisible();
  // Priority alone doesn't file it out of the Inbox: it still has no life area.
  await expect(card(second.title)).toBeVisible();
  await expect(card(second.title).getByRole("img", { name: "High priority" })).toBeVisible();
});

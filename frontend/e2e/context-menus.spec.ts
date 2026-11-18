import { expect, test } from "@playwright/test";
import {
  addDays,
  createArea,
  createRoutine,
  createRoutineStep,
  postTask,
  serverToday,
  unique,
} from "./api.ts";

// Right-click opens an item's ⋯ menu (STYLE_GUIDE Nov 16, "Navigation"), against a real API:
// on a task card, its checkbox and Shift F10; with the panel open; on a sidebar row and a
// heatmap square; and in a text field, which keeps the browser's menu.

test("right-clicking a task card opens its ⋯ menu at the pointer", async ({ page, request }) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Career"));
  const task = await postTask(request, {
    life_area_id: area.id,
    title: unique("Update resume"),
    scheduled_date: today,
  });

  await page.goto("/tasks/today");
  const card = page.getByRole("button", { name: task.title, exact: true });
  await expect(card).toBeVisible();
  const box = await card.boundingBox();
  if (!box) throw new Error("The card has no box");
  await card.click({ button: "right", position: { x: 10, y: 5 } });

  const menu = page.getByRole("menu", { name: `More actions for “${task.title}”` });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem")).toHaveText([
    "Complete task",
    "Archive task",
    "Delete task",
  ]);
  // It opens where the pointer is, not at a ⋯ button.
  const menuBox = await menu.boundingBox();
  expect(Math.abs((menuBox?.x ?? 0) - (box.x + 10))).toBeLessThan(24);
  // A right-click doesn't open the panel.
  await expect(page.getByRole("complementary", { name: "Details" })).toHaveCount(0);

  await menu.getByRole("menuitem", { name: "Archive task" }).click();
  await expect(card).toHaveCount(0);
  await page
    .getByRole("status")
    .filter({ hasText: `Archived “${task.title}”` })
    .getByRole("button", { name: "Undo" })
    .click();
  await expect(card).toBeVisible();

  // The checkbox sits over the card; right-clicking it opens the same menu.
  await page.getByRole("checkbox", { name: `Mark ${task.title} done` }).click({ button: "right" });
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();

  // Shift F10 opens it under the focused card, and Esc goes back to the card.
  await card.focus();
  await page.keyboard.press("Shift+F10");
  await expect(menu).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(menu).toBeHidden();
  await expect(card).toBeFocused();
});

test("the panel stays open while another item's menu is used", async ({ page, request }) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Health"));
  const first = await postTask(request, {
    life_area_id: area.id,
    title: unique("Book a checkup"),
    scheduled_date: today,
  });
  const second = await postTask(request, {
    life_area_id: area.id,
    title: unique("Buy vitamins"),
    priority: "high",
    scheduled_date: today,
  });

  await page.goto("/tasks/today");
  await page.getByRole("button", { name: first.title, exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(first.title);

  // High is the first column, clear of the floating panel.
  await page
    .getByRole("region", { name: "High" })
    .getByRole("button", { name: second.title, exact: true })
    .click({ button: "right" });
  await page
    .getByRole("menu", { name: `More actions for “${second.title}”` })
    .getByRole("menuitem", { name: "Complete task" })
    .click();
  await expect(
    page.getByRole("status").filter({ hasText: `Completed “${second.title}”` }),
  ).toBeVisible();
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(first.title);
});

test("a sidebar area and a heatmap square open their ⋯ menus", async ({ page, request }) => {
  const today = await serverToday(request);
  const area = await createArea(request, unique("Fitness"), "teal");
  const routine = await createRoutine(request, { title: unique("Morning"), starts_on: today });
  const step = await createRoutineStep(request, routine, {
    title: unique("Stretch"),
    life_area_id: area.id,
    starts_on: addDays(today, -3),
  });

  await page.goto("/areas");
  await page
    .getByRole("navigation", { name: "Life areas" })
    .getByRole("link", { name: area.title })
    .click({ button: "right" });
  const areaMenu = page.getByRole("menu", { name: `More actions for “${area.title}”` });
  await expect(areaMenu.getByRole("menuitem")).toHaveText([
    "Edit area",
    "Archive area",
    /^Delete area/,
  ]);
  await areaMenu.getByRole("menuitem", { name: "Edit area" }).click();
  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel.getByRole("textbox", { name: "Title" })).toHaveValue(area.title);
  await page.keyboard.press("Escape");

  await page
    .getByRole("navigation", { name: "Routines" })
    .getByRole("link", { name: routine.title })
    .click();
  await expect(page.getByRole("heading", { level: 1, name: routine.title })).toBeVisible();
  // A square in the step's heatmap row.
  const stepRow = page.locator(`[data-item-menu="step:${step.id}:${routine.id}"]`).first();
  await stepRow.locator("i").last().click({ button: "right" });
  const stepMenu = page.getByRole("menu", { name: `More actions for “${step.title}”` });
  await expect(stepMenu.getByRole("menuitem")).toHaveText([
    "Pause step",
    "Archive step",
    "Delete step",
  ]);
  await stepMenu.getByRole("menuitem", { name: "Pause step" }).click();
  await expect(stepMenu).toBeHidden();
  await stepRow.locator("i").first().click({ button: "right" });
  await expect(stepMenu.getByRole("menuitem", { name: "Resume step" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(stepMenu).toBeHidden();

  // A text field inside an item keeps the browser's menu (copy, paste, spelling): renaming
  // the step puts its name field in the step's row.
  await page.getByRole("button", { name: step.title, exact: true }).click();
  await expect(page.getByRole("textbox", { name: "Step name" })).toBeVisible();
  const prevented = await page.evaluate(`(() => {
    const field = document.querySelector('input[aria-label="Step name"]');
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 });
    return !field.dispatchEvent(event);
  })()`);
  expect(prevented).toBe(false);
  await expect(page.getByRole("menu")).toHaveCount(0);
});

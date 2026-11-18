import { expect, type Page, test } from "@playwright/test";
import { createArea, createRoutine, unique } from "./api.ts";

// New routine from the Plan sidebar's + and the first-run state, and dragging routines
// into a new order in the sidebar, against a real API.

test("the routines page offers the first routine when there are none", async ({ page }) => {
  // Other specs share the database, so the page sees no routines through a stub.
  for (const url of ["**/api/routines/history*", "**/api/routines/overview*"]) {
    await page.route(url, async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, json: { ...(await response.json()), routines: [] } });
    });
  }
  await page.goto("/areas");
  await page.getByRole("link", { name: "Routines", exact: true }).click();

  await expect(page).toHaveURL(/\/areas\/routines$/);
  await expect(page.getByRole("heading", { name: "Set up your first routine" })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Routines" }).getByText("No routines yet."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Weekly reset" }).click();
  const dialog = page.getByRole("dialog", { name: "New routine" });
  await expect(dialog.getByRole("textbox", { name: "Name" })).toHaveValue("Weekly reset");
});

test("New routine creates a routine with its steps and opens it", async ({ page, request }) => {
  const health = await createArea(request, unique("Health"), "rose");
  const home = await createArea(request, unique("Home"), "ochre");
  const name = unique("Workout");
  const warmUp = unique("Warm up");
  const tidy = unique("Tidy up");

  await page.goto("/areas");
  await page.getByRole("button", { name: "New routine" }).click();
  const dialog = page.getByRole("dialog", { name: "New routine" });
  const create = dialog.getByRole("button", { name: "Create routine" });
  await expect(create).toBeDisabled();

  await dialog.getByRole("textbox", { name: "Name" }).fill(name);
  await dialog.getByRole("button", { name: "Repeat" }).click();
  await page
    .getByRole("dialog", { name: "Repeat" })
    .getByText(/Every weekday/)
    .click();
  await expect(dialog.getByRole("button", { name: "Repeat" })).toContainText("weekday");

  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByRole("textbox", { name: "Add step" }).fill(warmUp);
  await dialog.getByRole("textbox", { name: "Add step" }).press("Enter");
  const steps = dialog.getByRole("list", { name: "Steps" });
  // A first step has no owner yet, so Create waits for one.
  await expect(steps.getByRole("button", { name: "Owner" })).toContainText("Owner");
  await expect(create).toBeDisabled();
  await steps.getByRole("button", { name: "Owner" }).click();
  await page
    .getByRole("dialog", { name: "Owner" })
    .getByText(health.title, { exact: true })
    .click();

  // The next step starts with the step before it's owner.
  await dialog.getByRole("button", { name: "Add step" }).click();
  await dialog.getByRole("textbox", { name: "Add step" }).fill(tidy);
  await dialog.getByRole("textbox", { name: "Add step" }).press("Enter");
  await expect(steps.getByRole("listitem")).toHaveCount(2);
  await steps.getByRole("button", { name: "Owner" }).nth(1).click();
  await page.getByRole("dialog", { name: "Owner" }).getByText(home.title, { exact: true }).click();
  await expect(steps.getByRole("listitem").nth(1)).toContainText(home.title);

  await expect(create).toBeEnabled();
  await create.click();

  await expect(page).toHaveURL(/\/areas\/routines\/\d+$/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await expect(page.getByText(/Every weekday/)).toBeVisible();
  const heatmap = page.getByRole("region", { name: "Steps" });
  await expect(heatmap.getByRole("button", { name: warmUp, exact: true })).toBeVisible();
  await expect(heatmap.getByRole("button", { name: tidy, exact: true })).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Routines" }).getByRole("link", { name }),
  ).toHaveAttribute("aria-current", "page");
});

async function sidebarOrder(page: Page, titles: string[]): Promise<string[]> {
  const rows = await page
    .getByRole("navigation", { name: "Routines" })
    .getByRole("link")
    .allTextContents();
  return rows.filter((text) => titles.includes(text));
}

test("routines are dragged into a new order in the sidebar", async ({ page, request }) => {
  const first = await createRoutine(request, { title: unique("Morning") });
  const second = await createRoutine(request, { title: unique("Evening") });
  const titles = [first.title, second.title];

  await page.goto("/areas");
  const nav = page.getByRole("navigation", { name: "Routines" });
  await expect.poll(() => sidebarOrder(page, titles)).toEqual(titles);

  const from = await nav.getByRole("link", { name: second.title }).boundingBox();
  const to = await nav.getByRole("link", { name: first.title }).boundingBox();
  if (!from || !to) throw new Error("Rows not on screen");
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 - 6, { steps: 4 });
  await expect(nav.getByTestId("routine-drop-spot")).toBeVisible();
  await page.mouse.move(to.x + 40, to.y + 2, { steps: 12 });
  await page.mouse.up();

  await expect.poll(() => sidebarOrder(page, titles)).toEqual([second.title, first.title]);
  // Dropping doesn't open the routine under the pointer.
  await expect(page).toHaveURL(/\/areas$/);
  await page.reload();
  await expect.poll(() => sidebarOrder(page, titles)).toEqual([second.title, first.title]);
});

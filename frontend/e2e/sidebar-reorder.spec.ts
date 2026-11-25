import { expect, type Locator, type Page, test } from "@playwright/test";
import { createArea, createProject, unique } from "./api.ts";

async function navOrder(nav: Locator, titles: string[]): Promise<string[]> {
  const rows = await nav.getByRole("link").allTextContents();
  return rows.filter((text) => titles.includes(text));
}

async function dragRowAbove(
  page: Page,
  nav: Locator,
  fromTitle: string,
  toTitle: string,
  dropTestId: string,
) {
  await nav.getByRole("link", { name: fromTitle }).scrollIntoViewIfNeeded();
  const from = await nav.getByRole("link", { name: fromTitle }).boundingBox();
  const to = await nav.getByRole("link", { name: toTitle }).boundingBox();
  if (!from || !to) throw new Error("Rows not on screen");
  await page.mouse.move(from.x + 40, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + from.height / 2 - 6, { steps: 4 });
  await expect(nav.getByTestId(dropTestId)).toBeVisible();
  await page.mouse.move(to.x + 40, to.y + 2, { steps: 12 });
  await page.mouse.up();
}

test("life areas and projects are dragged into a new order in the Plan sidebar", async ({
  page,
  request,
}) => {
  const areaA = await createArea(request, unique("Area A"));
  const areaB = await createArea(request, unique("Area B"));
  const projA = await createProject(request, areaA, unique("Project A"));
  const projB = await createProject(request, areaA, unique("Project B"));

  await page.goto("/areas");

  // Drag life areas
  const areasNav = page.getByRole("navigation", { name: "Life areas" });
  const areaTitles = [areaA.title, areaB.title];
  await expect.poll(() => navOrder(areasNav, areaTitles)).toEqual(areaTitles);

  await dragRowAbove(page, areasNav, areaB.title, areaA.title, "area-drop-spot");
  await expect.poll(() => navOrder(areasNav, areaTitles)).toEqual([areaB.title, areaA.title]);
  await expect(page).toHaveURL(/\/areas$/);

  // Drag projects
  const projectsNav = page.getByRole("navigation", { name: "Projects" });
  const projTitles = [projA.title, projB.title];
  await expect.poll(() => navOrder(projectsNav, projTitles)).toEqual(projTitles);

  await dragRowAbove(page, projectsNav, projB.title, projA.title, "project-drop-spot");
  await expect.poll(() => navOrder(projectsNav, projTitles)).toEqual([projB.title, projA.title]);
  await expect(page).toHaveURL(/\/areas$/);

  // Persists across reload
  await page.reload();
  await expect.poll(() => navOrder(areasNav, areaTitles)).toEqual([areaB.title, areaA.title]);
  await expect.poll(() => navOrder(projectsNav, projTitles)).toEqual([projB.title, projA.title]);
});

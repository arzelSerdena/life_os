import { expect, test } from "@playwright/test";
import { createArea, createProject, unique } from "./api.ts";

test("metric actions: log from Area/Project tiles, edit all fields, archive and undo", async ({
  page,
  request,
}) => {
  const area = await createArea(request, unique("Health"), "teal");
  const project = await createProject(request, area, unique("Marathon prep"));

  // Create a metric on the Area page
  await page.goto(`/areas/${area.id}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Metric" }).click();
  const createDialog = page.getByRole("dialog");
  const metricTitle = unique("Running distance");
  await createDialog.getByLabel("Name").fill(metricTitle);
  await createDialog.getByRole("button", { name: "Measure as: Number" }).click();
  await page.getByRole("menuitem", { name: /Distance/ }).click();
  await createDialog.getByText("Every period").click();
  await createDialog.getByLabel("Target number").fill("20");
  await createDialog.getByRole("button", { name: "Create metric" }).click();
  await expect(createDialog).toBeHidden();

  // Log an entry directly from the metric tile on the Area page
  const tile = page.getByRole("article", { name: metricTitle });
  await expect(tile).toBeVisible();
  await tile.hover();
  await tile.getByRole("button", { name: `Log entry for ${metricTitle}` }).click();
  const logDialog = page.getByRole("dialog");
  await logDialog.getByLabel("Value").fill("6");
  await logDialog.getByLabel("Note").fill("Park loop");
  await logDialog.getByRole("button", { name: "Log entry" }).click();
  await expect(logDialog).toBeHidden();
  await expect(
    page.getByRole("status").filter({ hasText: `Logged 6 km · ${metricTitle}` }),
  ).toBeVisible();
  await expect(tile).toContainText("6");

  // Open the detail panel, edit fields (unit + aggregation + target), and verify update
  await tile.getByRole("button", { name: metricTitle, exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Details" });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("region", { name: "Entries" })).toContainText("6 km");

  await panel.getByRole("button", { name: "Edit format and unit" }).click();
  const editDialog = page.getByRole("dialog");
  await editDialog.getByLabel("Unit").selectOption("mi");
  await editDialog.getByText("Average").click();
  await editDialog.getByLabel("Target number").fill("10");
  await editDialog.getByRole("button", { name: "Save changes" }).click();
  await expect(editDialog).toBeHidden();
  await expect(panel).toContainText("Distance · mi");
  await expect(panel).toContainText("Average");
  await expect(panel).toContainText("10 mi");

  // Archive metric from the detail panel ⋯ menu, then Undo
  await panel.getByRole("button", { name: "More actions" }).click();
  await page.getByRole("menuitem", { name: "Archive metric" }).click();
  await expect(panel).toBeHidden();
  await expect(tile).toHaveCount(0);
  const toast = page.getByRole("status").filter({ hasText: `Archived “${metricTitle}”` });
  await expect(toast).toBeVisible();
  await toast.getByRole("button", { name: "Undo" }).click();
  await expect(tile).toBeVisible();

  // Also verify logging a metric entry directly from a Project page
  await page.goto(`/areas/projects/${project.id}`);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("menuitem", { name: "Metric" }).click();
  const projectMetricTitle = unique("Long runs");
  const projCreate = page.getByRole("dialog");
  await projCreate.getByLabel("Name").fill(projectMetricTitle);
  await projCreate.getByRole("button", { name: "Create metric" }).click();
  await expect(projCreate).toBeHidden();

  const projTile = page.getByRole("article", { name: projectMetricTitle });
  await projTile.hover();
  await projTile.getByRole("button", { name: `Log entry for ${projectMetricTitle}` }).click();
  const projLog = page.getByRole("dialog");
  await projLog.getByLabel("Value").fill("2");
  await projLog.getByRole("button", { name: "Log entry" }).click();
  await expect(projLog).toBeHidden();
  await expect(projTile).toContainText("2");
});

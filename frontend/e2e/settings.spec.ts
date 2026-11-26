import { expect, test } from "@playwright/test";
import { createArea, unique } from "./api.ts";

// Settings at /settings, against a real API. The tests share one database and run one at
// a time, so Restore here only takes back what this test added after its backup, and the
// settings are put back at the end.

test.afterEach(async ({ request }) => {
  await request.patch("/api/settings", { data: { open_on_start: "home", time_format: "12h" } });
});

test("Open on start and Time format save at once", async ({ page }) => {
  await page.goto("/home");
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Settings" })).toBeVisible();

  await page.getByRole("radio", { name: "Tasks" }).click();
  await page.getByRole("radio", { name: "24-hour" }).click();
  await expect(page.getByText("Daily, 03:00")).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL(/\/tasks/);
});

test("Back up now, then Restore takes the data back to the backup", async ({ page, request }) => {
  await page.goto("/settings");
  const lastBackup = page.getByRole("group", { name: "Last backup" });
  await lastBackup.getByRole("button", { name: "Back up now" }).click();
  await expect(lastBackup).toContainText(/Today, .* · \d+ KB|Today, .* · [\d.]+ MB/);

  const area = await createArea(request, unique("Added after the backup"));

  await page.getByRole("button", { name: "Restore…" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog.getByRole("heading", { name: "Restore from backup" })).toBeVisible();
  await dialog.getByRole("button", { name: "Restore…" }).click();
  await expect(
    dialog.getByRole("heading", { name: /^Restore the backup from Today/ }),
  ).toBeVisible();
  await expect(dialog).toContainText("Your current data is backed up first");
  await dialog.getByRole("button", { name: "Restore backup" }).click();

  await expect(
    page.getByRole("status").filter({ hasText: /Restored the backup from Today/ }),
  ).toBeVisible();
  await expect(dialog).toBeHidden();
  const areas = (await (await request.get("/api/life-areas")).json()) as { title: string }[];
  expect(areas.map((item) => item.title)).not.toContain(area.title);
});

test("Export downloads a zip of the data", async ({ page }) => {
  await page.goto("/settings");

  const download = page.waitForEvent("download");
  await page.getByRole("group", { name: "Export all data" }).getByRole("button").click();

  expect((await download).suggestedFilename()).toMatch(/^life-os-\d{4}-\d{2}-\d{2}\.zip$/);
  await expect(
    page.getByRole("status").filter({ hasText: /Exported life-os-.*\.zip · / }),
  ).toBeVisible();
});

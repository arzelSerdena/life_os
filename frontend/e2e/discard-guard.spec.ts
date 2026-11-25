import { expect, test } from "@playwright/test";

test("dirty modal prompts before discarding on outside click and Escape", async ({ page }) => {
  await page.goto("/areas");

  // Clean New task closes immediately on backdrop click
  await page.keyboard.press("Control+n");
  const modal = page.getByRole("dialog");
  await expect(modal).toBeVisible();
  await page.mouse.click(10, 10);
  await expect(modal).toHaveCount(0);

  // Dirty New task prompts on backdrop click
  await page.keyboard.press("Control+n");
  await expect(modal).toBeVisible();
  await modal.getByLabel("Title").fill("Unsaved task draft");
  await page.mouse.click(10, 10);

  const confirm = page.getByRole("alertdialog");
  await expect(confirm).toBeVisible();
  await expect(confirm).toContainText("Discard changes?");

  // Keep editing returns to the modal with edits intact
  await confirm.getByRole("button", { name: "Keep editing" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel("Title")).toHaveValue("Unsaved task draft");

  // Escape also prompts, and Discard closes both
  await page.keyboard.press("Escape");
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "Discard" }).click();
  await expect(confirm).toHaveCount(0);
  await expect(modal).toHaveCount(0);
});
